-- SQL MANUAL: ING solo bot/API y SMTP central de IT
-- Objetivo:
-- - Evitar que ING guarde SMTP propio.
-- - Mantener SMTP administrado solo por IT.
-- - Permitir que ING actualice solo bot/API.

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_my_notification_area_settings(
  p_telegram_bot_token TEXT,
  p_smtp_host TEXT,
  p_smtp_port INTEGER,
  p_smtp_user TEXT,
  p_smtp_pass TEXT,
  p_smtp_from_name TEXT,
  p_meta_access_token TEXT,
  p_meta_phone_number_id TEXT
)
RETURNS TABLE(area TEXT, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_area TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_area := public.resolve_my_admin_area();
  IF v_area IS NULL THEN
    RAISE EXCEPTION 'No autorizado para administrar configuracion por area';
  END IF;

  IF v_area = 'ING' THEN
    INSERT INTO public.notification_area_settings (
      area,
      telegram_bot_token,
      meta_access_token,
      meta_phone_number_id,
      updated_by,
      updated_at
    )
    VALUES (
      v_area,
      nullif(trim(coalesce(p_telegram_bot_token, '')), ''),
      nullif(trim(coalesce(p_meta_access_token, '')), ''),
      nullif(trim(coalesce(p_meta_phone_number_id, '')), ''),
      auth.uid(),
      v_now
    )
    ON CONFLICT ON CONSTRAINT notification_area_settings_area_key DO UPDATE SET
      telegram_bot_token = EXCLUDED.telegram_bot_token,
      meta_access_token = EXCLUDED.meta_access_token,
      meta_phone_number_id = EXCLUDED.meta_phone_number_id,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at;
  ELSE
    INSERT INTO public.notification_area_settings (
      area,
      telegram_bot_token,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_from_name,
      meta_access_token,
      meta_phone_number_id,
      updated_by,
      updated_at
    )
    VALUES (
      v_area,
      nullif(trim(coalesce(p_telegram_bot_token, '')), ''),
      nullif(trim(coalesce(p_smtp_host, '')), ''),
      p_smtp_port,
      nullif(trim(coalesce(p_smtp_user, '')), ''),
      nullif(trim(coalesce(p_smtp_pass, '')), ''),
      nullif(trim(coalesce(p_smtp_from_name, '')), ''),
      nullif(trim(coalesce(p_meta_access_token, '')), ''),
      nullif(trim(coalesce(p_meta_phone_number_id, '')), ''),
      auth.uid(),
      v_now
    )
    ON CONFLICT ON CONSTRAINT notification_area_settings_area_key DO UPDATE SET
      telegram_bot_token = EXCLUDED.telegram_bot_token,
      smtp_host = EXCLUDED.smtp_host,
      smtp_port = EXCLUDED.smtp_port,
      smtp_user = EXCLUDED.smtp_user,
      smtp_pass = EXCLUDED.smtp_pass,
      smtp_from_name = EXCLUDED.smtp_from_name,
      meta_access_token = EXCLUDED.meta_access_token,
      meta_phone_number_id = EXCLUDED.meta_phone_number_id,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN QUERY
  SELECT v_area, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_notification_area_settings(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_notification_area_settings(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;

-- Verificación:
SELECT area, smtp_host, smtp_port, smtp_user, telegram_bot_token, updated_at
FROM public.notification_area_settings
ORDER BY area;
