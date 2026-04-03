-- 1. Eliminar las llaves foráneas actuales que apuntan a auth.users
ALTER TABLE public.maintenance_tickets DROP CONSTRAINT IF EXISTS maintenance_tickets_creado_por_fkey;
ALTER TABLE public.maintenance_tickets DROP CONSTRAINT IF EXISTS maintenance_tickets_asignado_a_fkey;

-- 2. Volver a crearlas apuntando a la tabla public.profiles
-- Esto permite que Supabase entienda la relación para traer el 'full_name' automáticamente
ALTER TABLE public.maintenance_tickets 
  ADD CONSTRAINT maintenance_tickets_creado_por_fkey 
  FOREIGN KEY (creado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_tickets 
  ADD CONSTRAINT maintenance_tickets_asignado_a_fkey 
  FOREIGN KEY (asignado_a) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Actualizar RLS para restringir a los ingenieros a ver SOLO sus tickets asignados
DROP POLICY IF EXISTS "maintenance_select_policy" ON public.maintenance_tickets;
CREATE POLICY "maintenance_select_policy"
  ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (
    -- REGLA 1: Es su propio ticket (asignado o creado por él)
    auth.uid() = asignado_a
    OR auth.uid() = creado_por
    
    -- REGLA 2: Es Jefe o Admin del área de Mantenimiento (ve todo lo de su área)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department = 'Mantenimiento'
        AND lower(p.role) IN ('admin', 'jefe_mantenimiento')
    )
    
    -- REGLA 3: Es el Super Administrador global
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.department != 'Mantenimiento'
        AND lower(p.role) = 'admin'
    )
  );
