-- ============================================================================
-- MIGRACIÓN: Agregar columnas faltantes a tabla activities existente
-- ============================================================================
-- Descripción:
-- La tabla activities ya existe pero le faltan columnas.
-- Esta migración agrega solo las columnas necesarias sin destruir datos existentes.
-- Es IDEMPOTENTE: no fallará si las columnas ya existen

-- ============================================================================
-- PASO 1: Agregar columnas faltantes a activities (si no existen)
-- ============================================================================

-- Agregar columna assigned_to si no existe
DO $$ BEGIN
  ALTER TABLE public.activities ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna created_by si no existe
DO $$ BEGIN
  ALTER TABLE public.activities ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna due_date si no existe
DO $$ BEGIN
  ALTER TABLE public.activities ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna completed_at si no existe
DO $$ BEGIN
  ALTER TABLE public.activities ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna asset_id si no existe
DO $$ BEGIN
  ALTER TABLE public.activities ADD COLUMN asset_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columna notes si no existe
DO $$ BEGIN
  ALTER TABLE public.activities ADD COLUMN notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- PASO 2: Crear índices si no existen
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON public.activities(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON public.activities(created_by);

-- ============================================================================
-- PASO 3: Verificar y habilitar RLS (si no está habilitado)
-- ============================================================================
-- Nota: Si RLS ya está habilitado, esto no hará nada
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 4: Crear o reemplazar políticas RLS
-- ============================================================================

-- Política SELECT: usuarios ven sus propias actividades + admins ven todas
DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select"
  ON public.activities FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Política INSERT: admin puede crear actividades
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Política UPDATE: admin y técnico asignado pueden actualizar
DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update"
  ON public.activities FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Política DELETE: solo admin puede eliminar
DROP POLICY IF EXISTS "activities_delete" ON public.activities;
CREATE POLICY "activities_delete"
  ON public.activities FOR DELETE TO authenticated
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
