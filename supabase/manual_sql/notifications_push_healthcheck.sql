-- SQL MANUAL: Diagnostico rapido de notificaciones push
-- Ejecuta este script en Supabase SQL Editor para validar cobertura y salud.

-- 1) Ultimas notificaciones generadas
SELECT id, user_id, title, type, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 50;

-- 2) Tokens FCM activos por usuario
SELECT user_id, count(*) AS active_tokens
FROM public.fcm_tokens
WHERE is_active = true
GROUP BY user_id
ORDER BY active_tokens DESC;

-- 3) Trigger logs de FCM (errores recientes)
SELECT notification_id, user_id, status, error_message, triggered_at
FROM public.fcm_trigger_logs
ORDER BY triggered_at DESC
LIMIT 100;

-- 4) Errores agregados en 24h
SELECT status, count(*) AS total
FROM public.fcm_trigger_logs
WHERE triggered_at >= now() - interval '24 hours'
GROUP BY status
ORDER BY total DESC;

-- 4.1) Top errores exactos del trigger (24h)
SELECT coalesce(error_message, 'sin_error') AS error_message, count(*) AS total
FROM public.fcm_trigger_logs
WHERE triggered_at >= now() - interval '24 hours'
GROUP BY coalesce(error_message, 'sin_error')
ORDER BY total DESC, error_message ASC;

-- 4.2) Ultimos errores detallados
SELECT notification_id, user_id, error_message, triggered_at
FROM public.fcm_trigger_logs
WHERE status = 'failed'
ORDER BY triggered_at DESC
LIMIT 30;

-- 5) Notificaciones que podrian no haber llegado (sin token activo)
SELECT n.id, n.user_id, n.title, n.created_at
FROM public.notifications n
LEFT JOIN public.fcm_tokens ft
  ON ft.user_id = n.user_id
  AND ft.is_active = true
WHERE n.created_at >= now() - interval '7 days'
GROUP BY n.id, n.user_id, n.title, n.created_at
HAVING count(ft.token) = 0
ORDER BY n.created_at DESC
LIMIT 100;
