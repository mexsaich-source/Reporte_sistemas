-- FIX SQL: RPC upsert_my_notification_area_settings devuelve 400
-- Ejecutar completo en Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_area_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL UNIQUE CHECK (area IN ('IT', 'ING')),
  telegram_bot_token TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  smtp_from_name TEXT,
  meta_access_token TEXT,
  meta_phone_number_id TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_area_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_area_settings_no_direct_select ON public.notification_area_settings;
CREATE POLICY notification_area_settings_no_direct_select
  ON public.notification_area_settings
  FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS notification_area_settings_no_direct_write ON public.notification_area_settings;
CREATE POLICY notification_area_settings_no_direct_write
  ON public.notification_area_settings
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.resolve_my_admin_area()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_department TEXT;
BEGIN
  SELECT lower(coalesce(role, '')), lower(coalesce(department, ''))
  INTO v_role, v_department
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_role = 'jefe_mantenimiento' THEN
    RETURN 'ING';
  END IF;

  IF v_role = 'admin' THEN
    IF v_department LIKE '%mantenimiento%' OR v_department LIKE '%ingenieria%' OR v_department LIKE '%ingeniería%' THEN
      RETURN 'ING';
    END IF;
    RETURN 'IT';
  END IF;

  RETURN NULL;
END;
$$;

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
  ON CONFLICT (area) DO UPDATE SET
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

  RETURN QUERY
  SELECT v_area, v_now;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_my_admin_area() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_my_notification_area_settings(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_my_admin_area() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_notification_area_settings(TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
