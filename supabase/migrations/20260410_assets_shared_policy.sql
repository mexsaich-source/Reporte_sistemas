-- Ejecutar en el Editor SQL de Supabase
-- Relax Policy para permitir leer "Equipos Compartidos"

DROP POLICY IF EXISTS assets_select_policy ON public.assets;

CREATE POLICY assets_select_policy
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    -- El usuario es el dueño directo
    assigned_to = auth.uid()
    OR 
    -- Ó el equipo está marcado como compartido de área "is_shared"
    (specs->>'is_shared')::boolean = true
    OR 
    -- Ó el usuario es de soporte/admin
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico', 'jefe_mantenimiento')
    )
  );

-- Listo! Esto permitirá que el portal consulte también estas herramientas sin violar la seguridad.
