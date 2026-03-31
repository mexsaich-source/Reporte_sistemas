-- ============================================================================
-- MIGRACIÓN: Trigger para disparar FCM automáticamente en nuevas notificaciones
-- ============================================================================
-- Descripción:
-- Esta migración agrega un trigger que automáticamente invoca la función
-- send-fcm-push cuando se inserta un nuevo registro en la tabla 'notifications'.
-- Esto asegura que las notificaciones lleguen por push al técnico/usuario
-- sin necesidad de código manual en la aplicación.

-- ============================================================================
-- PASO 1: Crear función que invoca la Edge Function de envío FCM
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_send_fcm_on_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Intento no bloqueante de invocar la Edge Function.
  -- Si pg_net o settings no estan disponibles, NO bloquea la transaccion.
  BEGIN
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
    INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status, error_message)
    VALUES (NEW.id, NEW.user_id, 'failed', SQLERRM);
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PASO 2: Crear o reemplazar el trigger en la tabla notifications
-- ============================================================================
DROP TRIGGER IF EXISTS send_fcm_on_notification_insert ON public.notifications;

CREATE TRIGGER send_fcm_on_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION trigger_send_fcm_on_notification();

-- ============================================================================
-- PASO 3: Crear tabla de log para debugging del trigger (opcional pero recomendado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fcm_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  response TEXT,
  error_message TEXT
);

-- Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_fcm_trigger_logs_user_id ON public.fcm_trigger_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_trigger_logs_triggered_at ON public.fcm_trigger_logs(triggered_at DESC);

-- ============================================================================
-- PASO 4: Crear función alternativa con fallback si net.http_post no funciona
-- ============================================================================
-- En algunos casos, la extensión pg_net puede no estar habilitada.
-- Esta es una alternativa que simplemente registra y confía en un proceso externo:

CREATE OR REPLACE FUNCTION public.queue_fcm_notification(p_notification_id UUID)
RETURNS VOID AS $$
DECLARE
  v_notification RECORD;
BEGIN
  -- Obtener detalles de la notificación
  SELECT id, user_id, title, message INTO v_notification
  FROM public.notifications
  WHERE id = p_notification_id;

  IF v_notification.id IS NOT NULL THEN
    -- Insertar en cola de envío (para processing externo si es necesario)
    INSERT INTO public.fcm_trigger_logs (notification_id, user_id, status)
    VALUES (v_notification.id, v_notification.user_id, 'pending');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PASO 5: Verificación de RLS (asegurar que el trigger puede leer/escribir)
-- ============================================================================
-- Los triggers pueden ejecutarse sin respetar RLS, así que deben estar OK
-- Pero si hay problemas, verificar que:
-- - La Edge Function tiene acceso a fcm_tokens
-- - La tabla notifications existe y tiene la columna user_id
-- - Los índices usan las columnas correctas

-- FIN DE LA MIGRACIÓN
