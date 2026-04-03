-- ============================================================================
-- MIGRACIÓN: RLS de perfiles para Jefe de Mantenimiento
-- ============================================================================

-- Eliminar políticas antiguas para evitar duplicados
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- Política SELECT global mejorada:
-- 1. Usuarios ven su propio perfil.
-- 2. Admin ve todo.
-- 3. Técnicos/Staff IT ven todo (para soporte).
-- 4. Jefes de Mantenimiento ven SOLO perfiles de su mismo departamento.
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND (
        lower(p.role) IN ('admin', 'tech', 'técnico')
        OR (lower(p.role) = 'jefe_mantenimiento' AND p.department = profiles.department)
      )
    )
  );

-- Política UPDATE mejorada:
-- 1. Usuarios editan lo básico de su perfil (ya manejado por otra política o incluimos aquí).
-- 2. Admin edita todo.
-- 3. Jefes de Mantenimiento editan usuarios de SU departamento (pero no a admins).
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND (
        lower(p.role) = 'admin'
        OR (lower(p.role) = 'jefe_mantenimiento' AND p.department = profiles.department AND lower(profiles.role) != 'admin')
      )
    )
  );
