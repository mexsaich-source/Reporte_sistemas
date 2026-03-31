-- ============================================================================
-- MIGRACIÓN: Hotfix tickets (estructura + RLS)
-- ============================================================================
-- Descripción:
-- - Asegura que la tabla tickets exista
-- - Alinea columnas con el frontend (assigned_tech)
-- - Mantiene compatibilidad con esquemas anteriores (assigned_to)
-- - Configura políticas RLS consistentes
-- Idempotente y segura para re-ejecución

-- ============================================================================
-- PASO 1: Agregar columnas faltantes a tickets (si no existen)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Sin título',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  urgency TEXT DEFAULT 'Normal',
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_tech UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  asset_id TEXT,
  asset_serial_number TEXT,
  notes TEXT
);

-- Agregar columna title si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN title TEXT NOT NULL DEFAULT 'Sin título';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna description si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN description TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna urgency si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN urgency TEXT DEFAULT 'Normal';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna status si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna reported_by si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna assigned_to si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna assigned_tech si no existe (columna que usa el frontend)
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN assigned_tech UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna created_at si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna updated_at si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna closed_at si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna scheduled_for si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN scheduled_for TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna asset_id si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN asset_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna asset_serial_number si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN asset_serial_number TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna notes si no existe
DO $$ BEGIN
  ALTER TABLE public.tickets ADD COLUMN notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Si había datos históricos en assigned_to, copiar a assigned_tech cuando falte
UPDATE public.tickets
SET assigned_tech = assigned_to
WHERE assigned_tech IS NULL
  AND assigned_to IS NOT NULL;

-- ============================================================================
-- PASO 2: Índices
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_tech ON public.tickets(assigned_tech);
CREATE INDEX IF NOT EXISTS idx_tickets_reported_by ON public.tickets(reported_by);

-- ============================================================================
-- PASO 3: Crear índices si no existen
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_scheduled_for ON public.tickets(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_urgency ON public.tickets(urgency);

-- ============================================================================
-- PASO 4: Verificar y habilitar RLS (si no está habilitado)
-- ============================================================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 5: Crear o reemplazar políticas RLS
-- ============================================================================

-- Política SELECT: usuarios ven sus propios tickets + admins ven todos
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR assigned_tech = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Política INSERT: usuarios autenticados pueden crear tickets
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Política UPDATE: admin y técnico asignado pueden actualizar
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    assigned_tech = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Política DELETE: solo admin puede eliminar
DROP POLICY IF EXISTS "tickets_delete" ON public.tickets;
CREATE POLICY "tickets_delete"
  ON public.tickets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) = 'admin'
    )
  );

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
