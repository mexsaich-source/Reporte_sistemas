-- SQL opcional: asegurar campo location en profiles (idempotente)
-- Ejecuta solo si tu entorno marca error de columna faltante al importar usuarios.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location TEXT;

-- Verificacion rapida
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'location';
