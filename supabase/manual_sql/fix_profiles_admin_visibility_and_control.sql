-- Fix: Admin global debe ver/controlar todos los perfiles.
-- Uso: ejecutar en Supabase SQL Editor.
-- Objetivo:
-- 1) Admin: SELECT/UPDATE sobre todos los usuarios.
-- 2) Jefe de Mantenimiento: SELECT/UPDATE solo su departamento y nunca admins.
-- 3) Usuario normal: solo su propio perfil.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- IMPORTANTE:
-- Evitamos subconsultas directas a public.profiles dentro de la policy,
-- porque eso puede causar recursion infinita en RLS.
-- Usamos funciones SECURITY DEFINER para leer el perfil del auth.uid() sin RLS recursivo.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p.role, '')))
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p.department, '')))
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_department() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_department() TO authenticated;

CREATE POLICY "profiles_select_policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.current_user_role() IN ('admin', 'tech', 'técnico')
    OR (
      public.current_user_role() = 'jefe_mantenimiento'
      AND lower(trim(coalesce(public.profiles.department, ''))) = public.current_user_department()
    )
  );

CREATE POLICY "profiles_update_policy"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'jefe_mantenimiento'
      AND lower(trim(coalesce(public.profiles.department, ''))) = public.current_user_department()
      AND lower(trim(coalesce(public.profiles.role, ''))) <> 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id
    OR public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'jefe_mantenimiento'
      AND lower(trim(coalesce(public.profiles.department, ''))) = public.current_user_department()
      AND lower(trim(coalesce(public.profiles.role, ''))) <> 'admin'
    )
  );

COMMIT;

-- Verificación rápida (ejecutar autenticado como admin):
-- select id, email, role, department, status from public.profiles order by created_at desc limit 50;
