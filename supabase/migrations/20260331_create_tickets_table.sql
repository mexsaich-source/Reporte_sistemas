-- ============================================================================
-- MIGRACIÓN: Crear tabla tickets si no existe (con todas las columnas)
-- ============================================================================
-- Descripción:
-- Crea la tabla de tickets con campos para helpdesk (soporte técnico)
-- Incluye asignación a técnico, estados, urgencia, notificaciones
-- Es IDEMPOTENTE: no fallaará si la tabla ya existe

-- ============================================================================
-- PASO 1: Crear tabla tickets (solo si no existe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  urgency TEXT DEFAULT 'Normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_tech UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  asset_id TEXT,
  asset_serial_number TEXT
);

-- ============================================================================
-- PASO 2: Crear índices para búsquedas frecuentes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_tech ON public.tickets(assigned_tech);
CREATE INDEX IF NOT EXISTS idx_tickets_reported_by ON public.tickets(reported_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_scheduled_for ON public.tickets(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- ============================================================================
-- PASO 3: Habilitar RLS
-- ============================================================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 4: Crear políticas RLS
-- ============================================================================

-- Política SELECT: usuarios ven sus propios tickets + admins ven todos
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR assigned_tech = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Política INSERT: usuarios pueden crear tickets
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
CREATE POLICY "tickets_insert"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid() OR auth.uid() IS NOT NULL);

-- Política UPDATE: admin y técnico asignado pueden actualizar
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    assigned_tech = auth.uid()
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
-- PASO 5: Crear tabla ticket_messages (si no existe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_user_id ON public.ticket_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON public.ticket_messages(created_at DESC);

-- Habilitar RLS para ticket_messages
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Política SELECT para ticket_messages
DROP POLICY IF EXISTS "ticket_messages_select" ON public.ticket_messages;
CREATE POLICY "ticket_messages_select"
  ON public.ticket_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.reported_by = auth.uid()
          OR t.assigned_tech = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
          )
        )
    )
  );

-- Política INSERT para ticket_messages
DROP POLICY IF EXISTS "ticket_messages_insert" ON public.ticket_messages;
CREATE POLICY "ticket_messages_insert"
  ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.reported_by = auth.uid()
          OR t.assigned_tech = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
          )
        )
    )
  );

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================
