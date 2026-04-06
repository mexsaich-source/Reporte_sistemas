-- Habilita RLS y políticas mínimas para que el usuario final pueda ver
-- sus equipos asignados desde public.assets.

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas con los mismos nombres (idempotente)
DROP POLICY IF EXISTS assets_select_policy ON public.assets;
DROP POLICY IF EXISTS assets_insert_policy ON public.assets;
DROP POLICY IF EXISTS assets_update_policy ON public.assets;
DROP POLICY IF EXISTS assets_delete_policy ON public.assets;

-- SELECT:
-- - Usuario autenticado puede ver sus propios equipos (assigned_to = auth.uid())
-- - Admin / Tech / Jefe de mantenimiento pueden ver todo
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

-- INSERT: solo roles de gestión
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

-- UPDATE: solo roles de gestión
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

-- DELETE: solo admin
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
