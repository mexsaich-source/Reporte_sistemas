-- ============================================================================
-- RPC PUBLICA: Validar si un correo puede activar cuenta como nuevo miembro
-- Uso: flujo "Eres nuevo" en Login sin exponer toda la tabla profiles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_member_eligible_for_onboarding(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_exists boolean;
BEGIN
  v_email := lower(trim(coalesce(p_email, '')));

  IF v_email = '' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(trim(coalesce(p.email, ''))) = v_email
      AND coalesce(p.status, true) = true
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

REVOKE ALL ON FUNCTION public.is_member_eligible_for_onboarding(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_eligible_for_onboarding(text) TO anon, authenticated;
