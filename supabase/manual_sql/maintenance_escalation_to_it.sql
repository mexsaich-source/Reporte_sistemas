-- Escalacion de ordenes de mantenimiento hacia IT Desk
-- Ejecutar en Supabase SQL Editor (idempotente)

ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS escalated_to_it boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_escalated_to_it
  ON public.maintenance_tickets (escalated_to_it);

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_escalated_at
  ON public.maintenance_tickets (escalated_at DESC);
