-- ============================================================================
-- HOTFIX: Hacer no bloqueante el trigger de FCM
-- ============================================================================
-- Objetivo:
-- - Evitar que fallas de net.http_post rompan inserts de negocio (tickets, etc.)
-- - Mantener registro de errores en fcm_trigger_logs
-- - Reemplazar funcion/trigger existentes de forma segura

CREATE TABLE IF NOT EXISTS public.fcm_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  response TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_fcm_trigger_logs_user_id ON public.fcm_trigger_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_trigger_logs_triggered_at ON public.fcm_trigger_logs(triggered_at DESC);

CREATE OR REPLACE FUNCTION public.trigger_send_fcm_on_notification()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Intento de envio. Si falla por extension/configuracion, no rompe la transaccion.
    PERFORM net.http_post(
      url := concat(
        'https://',
        current_setting('app.supabase_url')::text,
        '/functions/v1/send-fcm-push'
      ),
      headers := jsonb_build_object(
        'Authorization', concat('Bearer ', current_setting('app.supabase_service_role_key')::text),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );

    INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status, response)
    VALUES (NEW.id, NEW.user_id, 'sent', 'dispatched via net.http_post');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status, error_message)
      VALUES (NEW.id, NEW.user_id, 'failed', SQLERRM);
    EXCEPTION WHEN OTHERS THEN
      -- Nunca bloquear el insert original
      NULL;
    END;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS send_fcm_on_notification_insert ON public.notifications;

CREATE TRIGGER send_fcm_on_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_fcm_on_notification();
