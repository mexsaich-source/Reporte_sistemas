-- BLOQUE 1: BASE DE DATOS (SQL) OMNICANAL
-- Instrucciones: Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. SOPORTE DE FCM MULTIDISPOSITIVO (Evita que el token de celular sobreescriba al de laptop)
-- Si la tabla fcm_tokens existe pero con una clave primaria incorrecta, la reconstruimos para soportar "n" tokens por usuario.
DROP TABLE IF EXISTS fcm_tokens CASCADE;

CREATE TABLE fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_info TEXT,
    platform TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    -- El secreto para multidispositivo: un usuario puede tener varios tokens únicos
    UNIQUE(user_id, token) 
);

-- Políticas RLS de FCM Tokens (Para que la web pueda hacer el upsert)
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden insertar sus tokens" 
ON fcm_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden ver sus tokens" 
ON fcm_tokens FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus tokens" 
ON fcm_tokens FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus tokens" 
ON fcm_tokens FOR DELETE USING (auth.uid() = user_id);

-- 2. INTEGRACIÓN WHATSAPP EN PERFILES
-- Añadimos los campos necesarios si no existen
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_apikey TEXT;

-- 3. FUNCIÓN DE NOTIFICACIÓN SEGURA (RPC)
-- Corrige errores de permisos y ambigüedad de columnas
CREATE OR REPLACE FUNCTION public.create_notification_safe(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, created_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  v_notification_id UUID;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Validar permisos: Solo admin/tech o el mismo usuario
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND lower(coalesce(role, '')) IN ('admin', 'tech', 'técnico')
  ) THEN
    IF auth.uid() != p_user_id THEN
      RAISE EXCEPTION 'No tienes permiso para crear notificaciones a otros usuarios';
    END IF;
  END IF;

  -- Insertar la notificación
  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (p_user_id, p_title, p_message, p_type, p_action_url)
  RETURNING notifications.id, notifications.created_at INTO v_notification_id, v_created_at;

  RETURN QUERY SELECT v_notification_id, v_created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. FUNCIÓN DE APOYO PARA EVITAR RECURSION EN POLÍTICAS
-- Esta función corre con privilegios de sistema para checar el rol sin activar RLS de nuevo
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND lower(coalesce(role, '')) = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. POLÍTICAS DE SEGURIDAD (RLS) PARA PROFILES
-- Esto permite que los usuarios guarden su propia configuración de WhatsApp
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.profiles;
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Los usuarios pueden actualizar su propio perfil" ON public.profiles;
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON public.profiles;
CREATE POLICY "Admins pueden ver todos los perfiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins pueden actualizar cualquier perfil" ON public.profiles;
CREATE POLICY "Admins pueden actualizar cualquier perfil" 
ON public.profiles FOR UPDATE 
USING (public.is_admin());


-- 6. ACTUALIZACIÓN DE TABLA NOTIFICATIONS
-- Aseguramos que existan las columnas necesarias para el sistema omnicanal
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
        ALTER TABLE public.notifications ADD COLUMN type TEXT DEFAULT 'info';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_url') THEN
        ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
    END IF;
END $$;


-- 7. RE-CREACIÓN DE FUNCIÓN SEGURA (Final)
-- Asegura que use profiles.id y maneje correctamente los nuevos campos
CREATE OR REPLACE FUNCTION public.create_notification_safe(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_action_url TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, created_at TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
  v_notification_id UUID;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Validar permisos usando la función is_admin que ya no causa recursión
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND (lower(coalesce(role, '')) IN ('admin', 'tech', 'técnico') OR auth.uid() = p_user_id)
  ) THEN
      RAISE EXCEPTION 'No tienes permiso para crear notificaciones';
  END IF;

  -- Insertar la notificación
  INSERT INTO public.notifications (user_id, title, message, type, action_url)
  VALUES (p_user_id, p_title, p_message, p_type, p_action_url)
  RETURNING notifications.id, notifications.created_at INTO v_notification_id, v_created_at;

  RETURN QUERY SELECT v_notification_id, v_created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. REGISTRO DE AUDITORÍA (Audit Logs)
-- Creamos la tabla por si no existe
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de Inserción: Cualquier usuario logueado puede registrar una acción
DROP POLICY IF EXISTS "Los usuarios pueden registrar logs" ON public.audit_logs;
CREATE POLICY "Los usuarios pueden registrar logs" 
ON public.audit_logs FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política de Selección: Solo los Admins pueden ver el historial
DROP POLICY IF EXISTS "Solo Admins pueden ver logs" ON public.audit_logs;
CREATE POLICY "Solo Admins pueden ver logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (public.is_admin());
