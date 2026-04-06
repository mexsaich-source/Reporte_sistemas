-- SQL MANUAL: Fix trigger FCM sin depender de current_setting(app.*)
-- Causa detectada: missing_setting:supabase_url
-- Este trigger usa URL fija del proyecto y no requiere settings de Postgres.

BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_send_fcm_on_notification()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://bksshgibtxnkeeovkujy.supabase.co/functions/v1/send-fcm-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('record', to_jsonb(NEW))
    );

    INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status, response)
    VALUES (NEW.id, NEW.user_id, 'sent', 'dispatched via net.http_post (fixed-url)');
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

-- Prueba rápida
-- 1) Limpiar logs de prueba
-- DELETE FROM public.fcm_trigger_logs;
-- 2) Insertar una notificación de prueba
-- INSERT INTO public.notifications (user_id, title, message, type)
-- VALUES ('f540c266-3e76-4622-be2c-2accabf9409a', 'Test Push Trigger', 'Prueba automática del trigger', 'info');
-- 3) Ver último resultado
-- SELECT status, error_message, triggered_at
-- FROM public.fcm_trigger_logs
-- ORDER BY triggered_at DESC
-- LIMIT 10;
