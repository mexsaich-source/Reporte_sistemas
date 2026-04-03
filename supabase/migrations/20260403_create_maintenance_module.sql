-- ============================================================================
-- MIGRACIÓN: Módulo de Mantenimiento e Ingeniería
-- ============================================================================

-- 1. Crear Tabla de Tickets de Mantenimiento
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_falla TEXT NOT NULL,
    ubicacion TEXT NOT NULL,
    categoria TEXT CHECK (categoria IN ('Plomería', 'Electricidad', 'Climas', 'General')),
    prioridad TEXT CHECK (prioridad IN ('Baja', 'Normal', 'Alta')) DEFAULT 'Normal',
    estado TEXT CHECK (estado IN ('Pendiente', 'Asignado', 'Resuelto')) DEFAULT 'Pendiente',
    creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    fecha_resolucion TIMESTAMPTZ,
    notas_resolucion TEXT
);

-- Indexar campos comunes
CREATE INDEX IF NOT EXISTS idx_maintenance_estado ON public.maintenance_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_maintenance_asignado_a ON public.maintenance_tickets(asignado_a);

-- 2. Habilitar Seguridad (RLS)
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
-- Política SELECT: Admin y Jefe ven todo. Ingeniero ve lo suyo.
DROP POLICY IF EXISTS "maintenance_select_policy" ON public.maintenance_tickets;
CREATE POLICY "maintenance_select_policy"
  ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (
    auth.uid() = asignado_a
    OR auth.uid() = creado_por
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'jefe_mantenimiento', 'técnico', 'tech')
    )
  );

-- Política INSERT: Solo Admin y Jefes pueden crear (o cualquier usuario si se desea reportar desde portal)
-- El usuario pidió que el Jefe cree los tickets inicialmente.
DROP POLICY IF EXISTS "maintenance_insert_policy" ON public.maintenance_tickets;
CREATE POLICY "maintenance_insert_policy"
  ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'jefe_mantenimiento')
    )
  );

-- Política UPDATE: Jefe asigna, Ingeniero resuelve.
DROP POLICY IF EXISTS "maintenance_update_policy" ON public.maintenance_tickets;
CREATE POLICY "maintenance_update_policy"
  ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (
    auth.uid() = asignado_a
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'jefe_mantenimiento')
    )
  );
