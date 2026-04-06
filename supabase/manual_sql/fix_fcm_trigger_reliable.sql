-- SQL MANUAL: Reparar trigger FCM para envio confiable
-- Objetivo:
-- 1) Evitar fallas por diferencias de nombres en settings de Supabase.
-- 2) Registrar errores claros para diagnostico rapido.
-- 3) Mantener trigger no bloqueante para inserts de negocio.

BEGIN;

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
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Compatibilidad de settings segun proyecto/version
  v_url := coalesce(
    nullif(current_setting('app.supabase_url', true), ''),
    nullif(current_setting('app.settings.supabase_url', true), ''),
    nullif(current_setting('supabase_url', true), '')
  );

  v_service_key := coalesce(
    nullif(current_setting('app.supabase_service_role_key', true), ''),
    nullif(current_setting('app.settings.supabase_service_role_key', true), ''),
    nullif(current_setting('app.settings.service_role_key', true), '')
  );

  IF coalesce(v_url, '') = '' THEN
    INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status, error_message)
    VALUES (NEW.id, NEW.user_id, 'failed', 'missing_setting:supabase_url');
    RETURN NEW;
  END IF;

  IF coalesce(v_service_key, '') = '' THEN
    INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status, error_message)
    VALUES (NEW.id, NEW.user_id, 'failed', 'missing_setting:service_role_key');
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := concat('https://', v_url, '/functions/v1/send-fcm-push'),
      headers := jsonb_build_object(
        'Authorization', concat('Bearer ', v_service_key),
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

COMMIT;

-- Verificacion rapida
SELECT status, count(*) AS total
FROM public.fcm_trigger_logs
WHERE triggered_at >= now() - interval '24 hours'
GROUP BY status
ORDER BY total DESC;
