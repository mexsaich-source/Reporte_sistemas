-- SQL MANUAL: general_requests
-- Objetivos:
-- 1) Asegurar RLS consistente para peticiones generales.
-- 2) Permitir que el usuario borre sus solicitudes denegadas (rejected) para limpiar historial.
-- 3) Mantener control administrativo para aprobar/denegar/entregar.
-- 4) Permitir apelación de prórroga en préstamos sin abrir UPDATE inseguro para usuarios.

BEGIN;

ALTER TABLE public.general_requests ENABLE ROW LEVEL SECURITY;

-- ===== Extensión de préstamo (apelación) =====
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

-- RPC segura: usuario solicita prórroga de su préstamo (sin policy UPDATE para dueño)
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
    RAISE EXCEPTION 'La solicitud no es un préstamo';
  END IF;

  IF lower(coalesce(v_row.status, '')) NOT IN ('borrowed', 'overdue') THEN
    RAISE EXCEPTION 'Solo se puede apelar cuando el préstamo está prestado o vencido';
  END IF;

  IF v_row.loan_end_date IS NOT NULL AND p_requested_end_date <= v_row.loan_end_date THEN
    RAISE EXCEPTION 'La nueva fecha debe ser mayor a la fecha de devolución actual';
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

DROP POLICY IF EXISTS general_requests_select_policy ON public.general_requests;
DROP POLICY IF EXISTS general_requests_insert_policy ON public.general_requests;
DROP POLICY IF EXISTS general_requests_update_staff_policy ON public.general_requests;
DROP POLICY IF EXISTS general_requests_delete_user_rejected_policy ON public.general_requests;
DROP POLICY IF EXISTS general_requests_delete_admin_policy ON public.general_requests;

-- SELECT: dueño o personal de gestión
CREATE POLICY general_requests_select_policy
  ON public.general_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_mantenimiento')
    )
  );

-- INSERT: el usuario crea su propia solicitud
CREATE POLICY general_requests_insert_policy
  ON public.general_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: solo staff de gestión
CREATE POLICY general_requests_update_staff_policy
  ON public.general_requests
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

-- DELETE: usuario solo puede borrar sus denegadas
CREATE POLICY general_requests_delete_user_rejected_policy
  ON public.general_requests
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND lower(coalesce(status, '')) = 'rejected'
  );

-- DELETE adicional para admin (depuración)
CREATE POLICY general_requests_delete_admin_policy
  ON public.general_requests
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

COMMIT;

-- Verificación #1: conteo por estado (global)
SELECT status, count(*)
FROM public.general_requests
GROUP BY status
ORDER BY count(*) DESC;

-- Verificación #2: últimas denegadas
SELECT id, user_id, subject, status, created_at, reject_reason
FROM public.general_requests
WHERE lower(coalesce(status, '')) = 'rejected'
ORDER BY created_at DESC
LIMIT 50;

-- Verificación #3: apelaciones de prórroga
SELECT id, user_id, subject, status, loan_end_date, extension_requested_end_date, extension_status, extension_requested_at, extension_reviewed_at
FROM public.general_requests
WHERE is_loan = true
  AND extension_status IS NOT NULL
ORDER BY extension_requested_at DESC NULLS LAST
LIMIT 50;
