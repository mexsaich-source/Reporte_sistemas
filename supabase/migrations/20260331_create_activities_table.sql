-- ============================================================================
-- MIGRACIÓN: Crear tabla activities si no existe
-- ============================================================================
-- Descripción:
-- Tabla para actividades de trabajo asignadas a técnicos
-- Incluye seguimiento de estado, fechas límite, y notificaciones
-- Es IDEMPOTENTE: no fallará si la tabla ya existe

-- ============================================================================
-- PASO 1: Crear tabla activities (solo si no existe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  urgency TEXT DEFAULT 'Normal',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  asset_id TEXT,
  notes TEXT
);

-- ============================================================================
-- PASO 2: Crear índices para búsquedas frecuentes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON public.activities(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON public.activities(created_by);

-- ============================================================================
-- PASO 3: Habilitar RLS
-- ============================================================================
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 4: Crear políticas RLS
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
