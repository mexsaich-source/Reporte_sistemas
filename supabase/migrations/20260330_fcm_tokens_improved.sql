-- ============================================================================
-- MIGRACIÓN: Actualizar tabla fcm_tokens con soporte multi-plataforma
-- ============================================================================
-- Descripción:
-- - Agrega campo 'platform' (web, ios, android)
-- - Agrega campo 'is_active' para soft-delete
-- - Implementa trigger automático para last_seen_at
-- - Agrega función de limpieza automática
-- - Mejora índices para búsquedas rápidas
-- Este script es IDEMPOTENTE: se puede ejecutar varias veces sin problemas

-- ============================================================================
-- PASO 1: Crear tabla SI NO EXISTE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id bigserial primary key,
  
  user_id uuid not null,
  token text not null,
  
  device_info text null,
  platform text null check (platform in ('web', 'ios', 'android')),
  
  is_active boolean default true,
  
  created_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  
  constraint fcm_tokens_user_token_unique unique (user_id, token),
  
  constraint fcm_tokens_user_fk
    foreign key (user_id)
    references public.profiles (id)
    on delete cascade
);

-- ============================================================================
-- PASO 2: Agregar columnas faltantes si la tabla ya existía
-- ============================================================================

-- Agregar platform si no existe
ALTER TABLE public.fcm_tokens
ADD COLUMN IF NOT EXISTS platform text check (platform in ('web', 'ios', 'android'));

-- Agregar is_active si no existe (default true para registros existentes)
ALTER TABLE public.fcm_tokens
ADD COLUMN IF NOT EXISTS is_active boolean default true;

-- Llenar is_active = true para registros que no lo tengan (idempotente)
UPDATE public.fcm_tokens 
SET is_active = true 
WHERE is_active IS NULL;

-- ============================================================================
-- PASO 3: Crear índices para búsquedas rápidas
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id
  ON public.fcm_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token
  ON public.fcm_tokens (token);

-- Índice para queries de limpieza (buscar tokens viejos e inactivos)
-- Usa partial index: solo la rama correspondiente a is_active = true
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_last_seen
  ON public.fcm_tokens (last_seen_at) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active
  ON public.fcm_tokens (user_id, is_active);

-- ============================================================================
-- PASO 4: Crear función para actualizar last_seen_at automáticamente
-- ============================================================================
-- Con throttle: solo actualiza si pasaron > 1 hora desde último update
CREATE OR REPLACE FUNCTION public.update_last_seen_fcm()
RETURNS trigger AS $$
BEGIN
  -- Solo actualizar si pasaron más de 1 hora desde el último update
  -- Esto reduce la carga en UPDATE queries repetidas
  IF (now() - new.last_seen_at) > interval '1 hour' THEN
    new.last_seen_at = now();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASO 5: Crear trigger en tabla fcm_tokens
-- ============================================================================
DROP TRIGGER IF EXISTS trg_update_last_seen_fcm ON public.fcm_tokens;

CREATE TRIGGER trg_update_last_seen_fcm
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_seen_fcm();

-- ============================================================================
-- PASO 6: Crear función para limpiar tokens viejos (mantenimiento)
-- ============================================================================
-- Borra tokens inactivos con más de 90 días sin actividad
CREATE OR REPLACE FUNCTION public.cleanup_old_fcm_tokens()
RETURNS TABLE(deleted_count int) AS $$
DECLARE
  v_deleted_count int;
BEGIN
  DELETE FROM public.fcm_tokens
  WHERE 
    is_active = false
    OR (last_seen_at < now() - interval '90 days' AND is_active = true);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASO 7: Crear función para obtener estadísticas de tokens
-- ============================================================================
-- Útil para dashboard de admin
CREATE OR REPLACE FUNCTION public.get_fcm_tokens_stats()
RETURNS TABLE (
  total_tokens bigint,
  active_tokens bigint,
  inactive_tokens bigint,
  by_platform jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_tokens,
    COUNT(*) FILTER (WHERE is_active = true)::bigint as active_tokens,
    COUNT(*) FILTER (WHERE is_active = false)::bigint as inactive_tokens,
    jsonb_object_agg(
      COALESCE(platform, 'unknown'),
      COUNT(*)::bigint
    ) as by_platform
  FROM public.fcm_tokens
  WHERE created_at > now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASO 8: Row Level Security (Opcional pero recomendado)
-- ============================================================================
-- Asegurar que los usuarios solo vean sus propios tokens

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios solo ven sus propios tokens
DROP POLICY IF EXISTS "Users can view their own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can view their own fcm tokens"
  ON public.fcm_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuarios pueden insertar tokens (durante login)
DROP POLICY IF EXISTS "Users can insert their own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can insert their own fcm tokens"
  ON public.fcm_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuarios pueden actualizar sus tokens (para deactivate)
DROP POLICY IF EXISTS "Users can update their own fcm tokens" ON public.fcm_tokens;
CREATE POLICY "Users can update their own fcm tokens"
  ON public.fcm_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PASO 9: Crear vista para debugging (OPCIONAL)
-- ============================================================================
-- Útil para inspeccionar tokens activos por usuario
-- Si tu tabla fcm_tokens no tiene el campo created_at, comenta esta sección

-- CREATE OR REPLACE VIEW public.v_fcm_tokens_active AS
-- SELECT
--   fc.id,
--   fc.user_id,
--   p.email,
--   fc.token,
--   fc.platform,
--   fc.device_info,
--   fc.is_active,
--   fc.last_seen_at,
--   AGE(now(), fc.last_seen_at) as inactivity_duration
-- FROM public.fcm_tokens fc
-- LEFT JOIN public.profiles p ON fc.user_id = p.id
-- WHERE fc.is_active = true
-- ORDER BY fc.last_seen_at DESC;

-- Vista simplificada sin created_at
CREATE OR REPLACE VIEW public.v_fcm_tokens_active AS
SELECT
  fc.id,
  fc.user_id,
  fc.token,
  fc.platform,
  fc.device_info,
  fc.is_active,
  fc.last_seen_at,
  AGE(now(), fc.last_seen_at) as inactivity_duration
FROM public.fcm_tokens fc
WHERE fc.is_active = true
ORDER BY fc.last_seen_at DESC;

-- ============================================================================
-- PASO 10: Comentarios para documentación
-- ============================================================================

COMMENT ON TABLE public.fcm_tokens IS 'Almacena tokens FCM para notificaciones push, soporta múltiples dispositivos por usuario';

COMMENT ON COLUMN public.fcm_tokens.platform IS 'Plataforma: web, ios, android. Se detecta automáticamente en el frontend';

COMMENT ON COLUMN public.fcm_tokens.is_active IS 'Flag para soft-delete. true = activo, false = se marcó como inactivo en logout';

COMMENT ON COLUMN public.fcm_tokens.last_seen_at IS 'Última visto. Actualizado automáticamente por trigger (con throttle de 1 hora)';

COMMENT ON FUNCTION public.update_last_seen_fcm() IS 'Trigger que actualiza last_seen_at cada 1 hora máximo para reducir load';

COMMENT ON FUNCTION public.cleanup_old_fcm_tokens() IS 'Borra tokens inactivos con > 90 días o activos con > 90 días. Llamar vía cron';

COMMENT ON VIEW public.v_fcm_tokens_active IS 'Vista para debugging: muestra todos los tokens activos en el último punto de acceso';

-- ============================================================================
-- PASO 11: Instrucciones para ejecutar limpieza automática (CRON)
-- ============================================================================
-- Opción 1: Usar Supabase Edge Function (requiere configuración aparte)
-- Opción 2: Usar pg_cron extension (requiere permisos especiales)
-- Opción 3: Ejecutar manualmente cada X tiempo desde la app

-- Para verificar que todo está OK:
-- SELECT * FROM public.fcm_tokens LIMIT 5;
-- SELECT * FROM public.v_fcm_tokens_active;
-- SELECT * FROM public.get_fcm_tokens_stats();
