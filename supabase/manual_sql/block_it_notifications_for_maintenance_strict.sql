-- SQL MANUAL (ESTRICTO)
-- Archivo: block_it_notifications_for_maintenance_strict.sql
-- Objetivo:
-- 1) Limpiar notificaciones IT ya guardadas para usuarios de Mantenimiento/Ingenieria.
-- 2) Bloquear permanentemente nuevas notificaciones IT para esas areas.
-- 3) Permitir SOLO notificaciones de mantenimiento (allowlist estricta).
--
-- Ejecutar en Supabase SQL Editor.

BEGIN;

-- =====================================================================
-- A) BACKUP DE SEGURIDAD (por si se requiere rollback manual)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications_backup_20260407_strict AS
SELECT * FROM public.notifications WHERE false;

INSERT INTO public.notifications_backup_20260407_strict
SELECT n.*
FROM public.notifications n
JOIN public.profiles p ON p.id = n.user_id
WHERE (
  lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
  OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
  OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
)
AND (
  -- Todo lo que claramente sea flujo IT/general
  lower(coalesce(n.title, '')) IN (
    'nuevo ticket por revisar',
    'nuevo ticket asignado',
    'ticket asignado',
    'ticket agendado',
    'ticket resuelto',
    'nueva solicitud de equipo',
    'prestamo vencido de usuario',
    'actualización de solicitud',
    'solicitud aceptada',
    'prórroga aprobada',
    'prórroga rechazada'
  )
  OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
  OR lower(coalesce(n.message, '')) LIKE '%ticket %'
  OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
  OR lower(coalesce(n.message, '')) LIKE '%prestamo%'
)
AND lower(coalesce(n.title, '')) NOT LIKE '%mantenimiento%'
AND lower(coalesce(n.message, '')) NOT LIKE '%mantenimiento%'
AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
AND lower(coalesce(n.message, '')) NOT LIKE '%orden%';

-- =====================================================================
-- B) LIMPIEZA DE HISTORICO IT EN MANTENIMIENTO/INGENIERIA
-- =====================================================================
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
      'prestamo vencido de usuario',
      'actualización de solicitud',
      'solicitud aceptada',
      'prórroga aprobada',
      'prórroga rechazada'
    )
    OR lower(coalesce(n.message, '')) LIKE '%nuevo ticket%'
    OR lower(coalesce(n.message, '')) LIKE '%ticket %'
    OR lower(coalesce(n.message, '')) LIKE '%solicitud%'
    OR lower(coalesce(n.message, '')) LIKE '%prestamo%'
  )
  AND lower(coalesce(n.title, '')) NOT LIKE '%mantenimiento%'
  AND lower(coalesce(n.message, '')) NOT LIKE '%mantenimiento%'
  AND lower(coalesce(n.title, '')) NOT LIKE '%orden%'
  AND lower(coalesce(n.message, '')) NOT LIKE '%orden%';

COMMIT;

-- =====================================================================
-- C) BLOQUEO ESTRICTO PERMANENTE (TRIGGER BEFORE INSERT)
--    Regla: Si el usuario es de Mantenimiento/Ingenieria,
--    SOLO se permite notificacion de mantenimiento (allowlist).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.block_it_notifications_for_maintenance_strict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_department text;
  v_title text := lower(coalesce(NEW.title, ''));
  v_message text := lower(coalesce(NEW.message, ''));
  v_is_maint boolean := false;
  v_allowed_maintenance boolean := false;
BEGIN
  SELECT lower(coalesce(p.department, ''))
  INTO v_department
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  v_is_maint :=
    v_department LIKE '%mantenimiento%'
    OR v_department LIKE '%ingenieria%'
    OR v_department LIKE '%ingeniería%';

  -- Si no es mantenimiento/ingenieria, no filtramos
  IF NOT v_is_maint THEN
    RETURN NEW;
  END IF;

  -- ALLOWLIST estricta para mantenimiento
  v_allowed_maintenance :=
    v_title LIKE '%mantenimiento%'
    OR v_message LIKE '%mantenimiento%'
    OR v_title LIKE 'nueva orden de mantenimiento%'
    OR v_title LIKE 'orden de mantenimiento asignada%'
    OR v_title LIKE 'orden en proceso%'
    OR v_title LIKE 'orden resuelta%'
    OR v_title LIKE 'escalación de mantenimiento a it%'
    OR v_message LIKE '%orden de mantenimiento%'
    OR v_message LIKE '%orden "%' -- cubre mensajes de orden con comillas
    OR v_message LIKE '%fue escalada a sistemas%';

  IF v_allowed_maintenance THEN
    RETURN NEW;
  END IF;

  -- Bloqueo total de cualquier otro tipo de notificacion
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_it_notifications_for_maintenance_strict ON public.notifications;

CREATE TRIGGER trg_block_it_notifications_for_maintenance_strict
BEFORE INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.block_it_notifications_for_maintenance_strict();

-- =====================================================================
-- D) VERIFICACION RAPIDA
-- =====================================================================
SELECT n.id, n.user_id, p.full_name, p.department, n.title, n.message, n.created_at
FROM public.notifications n
JOIN public.profiles p ON p.id = n.user_id
WHERE (
  lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
  OR lower(coalesce(p.department, '')) LIKE '%ingenieria%'
  OR lower(coalesce(p.department, '')) LIKE '%ingeniería%'
)
ORDER BY n.created_at DESC
LIMIT 120;

-- =====================================================================
-- ROLLBACK MANUAL (si se necesita restaurar historico borrado)
-- =====================================================================
-- INSERT INTO public.notifications
-- SELECT * FROM public.notifications_backup_20260407_strict b
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.notifications n WHERE n.id = b.id
-- );
