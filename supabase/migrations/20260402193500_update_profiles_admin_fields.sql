-- Agregar columnas para control administrativo y de hardware
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS assigned_equipment TEXT;

-- Asegurar que la columna status exista (ya se leía en frontend pero aseguramos)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='status') THEN
        ALTER TABLE public.profiles ADD COLUMN status BOOLEAN DEFAULT true;
    END IF;
END $$;
