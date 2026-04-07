-- SQL MANUAL: Limpieza de notificaciones historicas de IT en usuarios de Mantenimiento/Ingenieria
-- Objetivo:
-- - Quitar notificaciones viejas de flujo IT que quedaron almacenadas para perfiles de Mantenimiento/Ingenieria.
-- - No tocar notificaciones propias de mantenimiento (ordenes, escalaciones, etc.).
--
-- Uso recomendado:
-- 1) Ejecuta primero SOLO los bloques de PREVIEW.
-- 2) Si el resultado es correcto, ejecuta el bloque DELETE dentro de transaccion.

-- =========================
-- PREVIEW 1: Conteo por usuario
-- =========================
WITH candidates AS (
  SELECT n.id, n.user_id, n.title, n.message, n.created_at
  FROM public.notifications n
  JOIN public.profiles p ON p.id = n.user_id
  WHERE (
    lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
    OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
    OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
  )
  AND (
    lower(coalesce(n.title, '')) IN (
      'nuevo ticket por revisar',
      'nuevo ticket asignado',
      'ticket asignado',
      'ticket agendado',
      'ticket resuelto',
      'nueva solicitud de equipo',
      'prestamo vencido de usuario'
    )
    OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
    OR lower(coalesce(n.message, '')) LIKE '%ticket %'
    OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
  )
  AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
  AND lower(coalesce(n.message, '')) NOT LIKE '%orden de mantenimiento%'
)
SELECT c.user_id, p.full_name, p.department, count(*) AS total
FROM candidates c
JOIN public.profiles p ON p.id = c.user_id
GROUP BY c.user_id, p.full_name, p.department
ORDER BY total DESC, p.full_name;

-- =========================
-- PREVIEW 2: Muestra detallada
-- =========================
WITH candidates AS (
  SELECT n.id, n.user_id, n.title, n.message, n.created_at
  FROM public.notifications n
  JOIN public.profiles p ON p.id = n.user_id
  WHERE (
    lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
    OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
    OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
  )
  AND (
    lower(coalesce(n.title, '')) IN (
      'nuevo ticket por revisar',
      'nuevo ticket asignado',
      'ticket asignado',
      'ticket agendado',
      'ticket resuelto',
      'nueva solicitud de equipo',
      'prestamo vencido de usuario'
    )
    OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
    OR lower(coalesce(n.message, '')) LIKE '%ticket %'
    OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
  )
  AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
  AND lower(coalesce(n.message, '')) NOT LIKE '%orden de mantenimiento%'
)
SELECT id, user_id, title, message, created_at
FROM candidates
ORDER BY created_at DESC
LIMIT 300;

-- =========================
-- DELETE (ejecutar cuando valides preview)
-- =========================
BEGIN;

-- Backup rapido para rollback manual posterior (persistente)
CREATE TABLE IF NOT EXISTS public.notifications_backup_20260407 AS
SELECT *
FROM public.notifications
WHERE false;

INSERT INTO public.notifications_backup_20260407
SELECT n.*
FROM public.notifications n
JOIN public.profiles p ON p.id = n.user_id
WHERE (
  lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
  OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
  OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
)
AND (
  lower(coalesce(n.title, '')) IN (
    'nuevo ticket por revisar',
    'nuevo ticket asignado',
    'ticket asignado',
    'ticket agendado',
    'ticket resuelto',
    'nueva solicitud de equipo',
    'prestamo vencido de usuario'
  )
  OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
  OR lower(coalesce(n.message, '')) LIKE '%ticket %'
  OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
)
AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
AND lower(coalesce(n.message, '')) NOT LIKE '%orden de mantenimiento%';

DELETE FROM public.notifications n
USING public.profiles p
WHERE p.id = n.user_id
  AND (
    lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
    OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
    OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
  )
  AND (
    lower(coalesce(n.title, '')) IN (
      'nuevo ticket por revisar',
      'nuevo ticket asignado',
      'ticket asignado',
      'ticket agendado',
      'ticket resuelto',
      'nueva solicitud de equipo',
      'prestamo vencido de usuario'
    )
    OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
    OR lower(coalesce(n.message, '')) LIKE '%ticket %'
    OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
  )
  AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
  AND lower(coalesce(n.message, '')) NOT LIKE '%orden de mantenimiento%';

-- Verificacion post-delete
SELECT count(*) AS remaining_candidates
FROM public.notifications n
JOIN public.profiles p ON p.id = n.user_id
WHERE (
  lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
  OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
  OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
)
AND (
  lower(coalesce(n.title, '')) IN (
    'nuevo ticket por revisar',
    'nuevo ticket asignado',
    'ticket asignado',
    'ticket agendado',
    'ticket resuelto',
    'nueva solicitud de equipo',
    'prestamo vencido de usuario'
  )
  OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
  OR lower(coalesce(n.message, '')) LIKE '%ticket %'
  OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
)
AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
AND lower(coalesce(n.message, '')) NOT LIKE '%orden de mantenimiento%';

COMMIT;

-- ROLLBACK MANUAL (si hace falta):
-- INSERT INTO public.notifications
-- SELECT * FROM public.notifications_backup_20260407 b
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.notifications n WHERE n.id = b.id
-- );
