-- Fechas de préstamo/devolución y reagendado para equipment_requests
ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS loan_start_date date,
  ADD COLUMN IF NOT EXISTS loan_end_date date,
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz;

-- Permitir que admin/tech creen solicitudes para terceros (flujo administrativo)
DROP POLICY IF EXISTS "equipment_requests_insert" ON public.equipment_requests;
CREATE POLICY "equipment_requests_insert"
  ON public.equipment_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_it', 'jefe_area_it', 'jefe area it')
    )
  );
