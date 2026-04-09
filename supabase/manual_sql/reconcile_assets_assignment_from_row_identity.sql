-- Reconciliacion de asignaciones de activos por identidad de fila (email/nombre)
-- Objetivo:
-- 1) Resolver assigned_to usando specs.assigned_to_email
-- 2) Resolver por specs.assigned_user_name cuando el nombre es unico
-- 3) Limpiar assigned_to huerfano (UUID inexistente)
-- 4) Sincronizar metadatos en specs para que UI refleje usuario/maquina
--
-- Ejecutar como SQL manual en Supabase SQL Editor.

BEGIN;

-- 0) Mapa canonico de perfiles por email (normalizado)
WITH profile_by_email AS (
  SELECT DISTINCT ON (lower(trim(email)))
    id,
    lower(trim(email)) AS email_key,
    full_name
  FROM public.profiles
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  ORDER BY lower(trim(email)), created_at DESC NULLS LAST
),

-- 1) Resolver asignacion por specs.assigned_to_email
resolved_by_email AS (
  UPDATE public.assets a
  SET assigned_to = p.id,
      status = CASE WHEN a.status IS NULL OR a.status = 'available' THEN 'active' ELSE a.status END,
      specs = jsonb_set(
                jsonb_set(
                  coalesce(a.specs, '{}'::jsonb),
                  '{assigned_to_email}',
                  to_jsonb(p.email_key),
                  true
                ),
                '{assigned_user_name}',
                to_jsonb(coalesce(p.full_name, '')),
                true
              )
  FROM profile_by_email p
  WHERE lower(trim(coalesce(a.specs->>'assigned_to_email', ''))) = p.email_key
    AND (a.assigned_to IS NULL OR a.assigned_to <> p.id)
  RETURNING a.id
),

-- 2) Resolver por nombre (solo si es match unico y no se pudo por email)
name_candidates AS (
  SELECT
    lower(trim(full_name)) AS name_key,
    min(id::text)::uuid AS profile_id,
    count(*) AS qty
  FROM public.profiles
  WHERE full_name IS NOT NULL
    AND trim(full_name) <> ''
  GROUP BY lower(trim(full_name))
),
resolved_by_name AS (
  UPDATE public.assets a
  SET assigned_to = nc.profile_id,
      status = CASE WHEN a.status IS NULL OR a.status = 'available' THEN 'active' ELSE a.status END
  FROM name_candidates nc
  WHERE nc.qty = 1
    AND lower(trim(coalesce(a.specs->>'assigned_user_name', ''))) = nc.name_key
    AND (a.assigned_to IS NULL)
  RETURNING a.id
),

-- 3) Detectar huerfanos: assigned_to con UUID que ya no existe en profiles
orphan_assets AS (
  SELECT a.id
  FROM public.assets a
  LEFT JOIN public.profiles p ON p.id = a.assigned_to
  WHERE a.assigned_to IS NOT NULL
    AND p.id IS NULL
),

-- 4) Limpiar huerfanos para que no contaminen vistas de usuarios
cleared_orphans AS (
  UPDATE public.assets a
  SET assigned_to = NULL,
      status = CASE WHEN a.status = 'active' THEN 'available' ELSE a.status END
  WHERE a.id IN (SELECT id FROM orphan_assets)
  RETURNING a.id
),

-- 5) Sincronizar metadata textual en specs con assigned_to actual
synced_specs_assigned AS (
  UPDATE public.assets a
  SET specs = jsonb_set(
              jsonb_set(
                coalesce(a.specs, '{}'::jsonb),
                '{assigned_user_name}',
                to_jsonb(coalesce(p.full_name, '')),
                true
              ),
              '{assigned_to_email}',
              to_jsonb(lower(trim(coalesce(p.email, '')))),
              true
            )
  FROM public.profiles p
  WHERE a.assigned_to = p.id
  RETURNING a.id
),

-- 6) Limpiar metadata textual en activos sin asignacion
synced_specs_unassigned AS (
  UPDATE public.assets a
  SET specs = (coalesce(a.specs, '{}'::jsonb) - 'assigned_user_name')
  WHERE a.assigned_to IS NULL
    AND (a.specs ? 'assigned_user_name')
  RETURNING a.id
)
SELECT
  (SELECT count(*) FROM resolved_by_email)      AS fixed_by_email,
  (SELECT count(*) FROM resolved_by_name)       AS fixed_by_name,
  (SELECT count(*) FROM cleared_orphans)        AS cleared_orphans,
  (SELECT count(*) FROM synced_specs_assigned)  AS synced_assigned_specs,
  (SELECT count(*) FROM synced_specs_unassigned) AS cleaned_unassigned_specs;

COMMIT;

-- Verificacion 1: activos asignados con usuario
SELECT
  a.id,
  a.status,
  a.assigned_to,
  p.full_name,
  p.email,
  a.specs->>'hostname' AS hostname,
  a.specs->>'serial_number' AS serial_number,
  a.specs->>'assigned_to_email' AS assigned_to_email_meta
FROM public.assets a
LEFT JOIN public.profiles p ON p.id = a.assigned_to
WHERE a.assigned_to IS NOT NULL
ORDER BY a.id
LIMIT 100;

-- Verificacion 2: activos sin asignar pero con metadato de email (para investigar)
SELECT
  a.id,
  a.status,
  a.specs->>'hostname' AS hostname,
  a.specs->>'serial_number' AS serial_number,
  a.specs->>'assigned_to_email' AS assigned_to_email_meta,
  a.specs->>'assigned_user_name' AS assigned_user_name_meta
FROM public.assets a
WHERE a.assigned_to IS NULL
  AND (
    coalesce(a.specs->>'assigned_to_email', '') <> ''
    OR coalesce(a.specs->>'assigned_user_name', '') <> ''
  )
ORDER BY a.id
LIMIT 100;
