-- ============================================================================
-- MIGRACION: Apelacion de prorroga para prestamos en general_requests
-- ============================================================================
-- Objetivo:
-- - Permitir que el usuario solicite mas tiempo de devolucion sin exponer UPDATE
-- - Admin/tech revisa y decide (aprobado/rechazado)

ALTER TABLE public.general_requests
  ADD COLUMN IF NOT EXISTS extension_requested_end_date DATE,
  ADD COLUMN IF NOT EXISTS extension_reason TEXT,
  ADD COLUMN IF NOT EXISTS extension_status TEXT,
  ADD COLUMN IF NOT EXISTS extension_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extension_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extension_reject_reason TEXT;

ALTER TABLE public.general_requests
  DROP CONSTRAINT IF EXISTS general_requests_extension_status_check;

ALTER TABLE public.general_requests
  ADD CONSTRAINT general_requests_extension_status_check
  CHECK (extension_status IS NULL OR extension_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_general_requests_extension_status
  ON public.general_requests (extension_status);

CREATE OR REPLACE FUNCTION public.request_general_request_extension(
  p_request_id UUID,
  p_requested_end_date DATE,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.general_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_requested_end_date IS NULL THEN
    RAISE EXCEPTION 'Fecha solicitada obligatoria';
  END IF;

  IF coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Motivo obligatorio';
  END IF;

  SELECT *
  INTO v_row
  FROM public.general_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF v_row.user_id <> v_uid THEN
    RAISE EXCEPTION 'Sin permisos para esta solicitud';
  END IF;

  IF coalesce(v_row.is_loan, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'La solicitud no es un prestamo';
  END IF;

  IF lower(coalesce(v_row.status, '')) NOT IN ('borrowed', 'overdue') THEN
    RAISE EXCEPTION 'Solo se puede apelar cuando el prestamo esta prestado o vencido';
  END IF;

  IF v_row.loan_end_date IS NOT NULL AND p_requested_end_date <= v_row.loan_end_date THEN
    RAISE EXCEPTION 'La nueva fecha debe ser mayor a la fecha de devolucion actual';
  END IF;

  UPDATE public.general_requests
  SET extension_requested_end_date = p_requested_end_date,
      extension_reason = trim(p_reason),
      extension_status = 'pending',
      extension_requested_at = now(),
      extension_reviewed_at = NULL,
      extension_reject_reason = NULL
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.request_general_request_extension(UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_general_request_extension(UUID, DATE, TEXT) TO authenticated;
