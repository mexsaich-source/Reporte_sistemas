-- ============================================================================
-- FIX: Flujo técnico de mantenimiento (Asignado -> En Proceso -> Resuelto)
-- ============================================================================

-- 1) Asegurar estados permitidos para maintenance_tickets
ALTER TABLE public.maintenance_tickets
  DROP CONSTRAINT IF EXISTS maintenance_tickets_estado_check;

ALTER TABLE public.maintenance_tickets
  ADD CONSTRAINT maintenance_tickets_estado_check
  CHECK (estado IN ('Pendiente', 'Asignado', 'En Proceso', 'Resuelto'));

-- 2) Asegurar columna de notas de resolución
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'maintenance_tickets'
      AND column_name = 'notas_resolucion'
  ) THEN
    ALTER TABLE public.maintenance_tickets
      ADD COLUMN notas_resolucion TEXT;
  END IF;
END $$;

-- 3) Política SELECT: técnico ve asignados; creador ve su orden; jefe/admin ve todo de mantenimiento
DROP POLICY IF EXISTS maintenance_select_policy ON public.maintenance_tickets;
CREATE POLICY maintenance_select_policy
  ON public.maintenance_tickets
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = asignado_a
    OR auth.uid() = creado_por
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(coalesce(p.role, '')) = 'admin'
          OR (
            lower(coalesce(p.role, '')) = 'jefe_mantenimiento'
            AND lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
          )
        )
    )
  );

-- 4) Política UPDATE: técnico asignado puede mover su ticket; jefe/admin también
DROP POLICY IF EXISTS maintenance_update_policy ON public.maintenance_tickets;
CREATE POLICY maintenance_update_policy
  ON public.maintenance_tickets
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = asignado_a
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(coalesce(p.role, '')) = 'admin'
          OR (
            lower(coalesce(p.role, '')) = 'jefe_mantenimiento'
            AND lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
          )
        )
    )
  )
  WITH CHECK (
    auth.uid() = asignado_a
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(coalesce(p.role, '')) = 'admin'
          OR (
            lower(coalesce(p.role, '')) = 'jefe_mantenimiento'
            AND lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
          )
        )
    )
  );

-- 5) Política INSERT: jefe/admin crean órdenes
DROP POLICY IF EXISTS maintenance_insert_policy ON public.maintenance_tickets;
CREATE POLICY maintenance_insert_policy
  ON public.maintenance_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          lower(coalesce(p.role, '')) = 'admin'
          OR (
            lower(coalesce(p.role, '')) = 'jefe_mantenimiento'
            AND lower(coalesce(p.department, '')) LIKE '%mantenimiento%'
          )
        )
    )
  );
