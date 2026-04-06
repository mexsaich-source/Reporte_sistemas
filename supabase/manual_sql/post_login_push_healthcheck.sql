-- SQL MANUAL: Healthcheck post-login de Push (sin placeholders)
-- Objetivo:
-- 1) Detectar automaticamente un admin activo.
-- 2) Verificar tokens FCM activos y recientes.
-- 3) Insertar notificacion de prueba.
-- 4) Confirmar estado del trigger FCM.

BEGIN;

-- A) Admin objetivo automatico (activo)
DROP TABLE IF EXISTS _tmp_push_target_user;
CREATE TEMP TABLE _tmp_push_target_user AS
SELECT p.id, p.full_name, p.email, p.role
FROM public.profiles p
WHERE lower(coalesce(p.role, '')) = 'admin'
  AND coalesce(p.status, true) = true
ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
LIMIT 1;

-- Validacion: debe existir al menos un admin activo
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM _tmp_push_target_user;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No se encontro admin activo en public.profiles';
  END IF;
END $$;

-- B) Limpiar logs recientes para prueba controlada (ultima hora)
DELETE FROM public.fcm_trigger_logs
WHERE triggered_at >= now() - interval '1 hour';

-- C) Insertar notificacion de prueba al admin objetivo
INSERT INTO public.notifications (user_id, title, message, type)
SELECT id,
       'Push Test Post-Login',
       'Prueba automatica tras login para validar trigger + FCM',
       'info'
FROM _tmp_push_target_user;

COMMIT;

-- 1) Usuario objetivo
SELECT id AS target_user_id, full_name, email, role
FROM _tmp_push_target_user;

-- 2) Tokens activos del usuario objetivo
SELECT ft.user_id, ft.platform, ft.device_info, ft.is_active, ft.last_seen_at,
       left(ft.token, 20) || '...' AS token_preview
FROM public.fcm_tokens ft
JOIN _tmp_push_target_user t ON t.id = ft.user_id
WHERE ft.is_active = true
ORDER BY ft.last_seen_at DESC NULLS LAST
LIMIT 20;

-- 3) Notificacion de prueba insertada
SELECT n.id, n.user_id, n.title, n.type, n.is_read, n.created_at
FROM public.notifications n
JOIN _tmp_push_target_user t ON t.id = n.user_id
WHERE n.title = 'Push Test Post-Login'
ORDER BY n.created_at DESC
LIMIT 5;

-- 4) Resultado del trigger FCM para la prueba
SELECT l.notification_id, l.user_id, l.status, l.error_message, l.response, l.triggered_at
FROM public.fcm_trigger_logs l
JOIN _tmp_push_target_user t ON t.id = l.user_id
ORDER BY l.triggered_at DESC
LIMIT 20;

-- 5) Resumen rapido
SELECT status, count(*) AS total
FROM public.fcm_trigger_logs
WHERE triggered_at >= now() - interval '1 hour'
GROUP BY status
ORDER BY total DESC;
