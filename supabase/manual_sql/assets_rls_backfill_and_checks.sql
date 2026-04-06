-- Ejecuta este script en Supabase SQL Editor si quieres aplicar/verificar todo manualmente.
-- 1) RLS de assets para usuario final + roles de gestion
-- 2) Backfill opcional de nombre/correo asignado dentro de specs
-- 3) Consultas de verificacion

BEGIN;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assets_select_policy ON public.assets;
DROP POLICY IF EXISTS assets_insert_policy ON public.assets;
DROP POLICY IF EXISTS assets_update_policy ON public.assets;
DROP POLICY IF EXISTS assets_delete_policy ON public.assets;

CREATE POLICY assets_select_policy
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_mantenimiento')
    )
  );

CREATE POLICY assets_insert_policy
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_mantenimiento')
    )
  );

CREATE POLICY assets_update_policy
  ON public.assets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_mantenimiento')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_mantenimiento')
    )
  );

CREATE POLICY assets_delete_policy
  ON public.assets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) = 'admin'
    )
  );

-- Backfill opcional: reflejar nombre/correo de assigned_to en specs para datos historicos.
UPDATE public.assets a
SET specs =
  jsonb_set(
    jsonb_set(
      coalesce(a.specs, '{}'::jsonb),
      '{assigned_user_name}',
      to_jsonb(coalesce(p.full_name, '')),
      true
    ),
    '{assigned_user_email}',
    to_jsonb(coalesce(p.email, '')),
    true
  )
FROM public.profiles p
WHERE a.assigned_to = p.id;

-- Limpiar metadato textual si el activo ya no esta asignado.
UPDATE public.assets
SET specs = (coalesce(specs, '{}'::jsonb) - 'assigned_user_name' - 'assigned_user_email')
WHERE assigned_to IS NULL
  AND (specs ? 'assigned_user_name' OR specs ? 'assigned_user_email');

COMMIT;

-- Verificacion rapida #1: activos con usuario asignado
SELECT a.id, a.type, a.model, a.status, a.assigned_to, p.full_name, p.email
FROM public.assets a
LEFT JOIN public.profiles p ON p.id = a.assigned_to
WHERE a.assigned_to IS NOT NULL
ORDER BY a.id
LIMIT 50;

-- Verificacion rapida #2: tickets sin referencia usable de activo
SELECT id, title, status, asset_id, asset_serial_number, created_at
FROM public.tickets
WHERE coalesce(asset_id, '') = ''
  AND coalesce(asset_serial_number, '') = ''
ORDER BY created_at DESC
LIMIT 50;
