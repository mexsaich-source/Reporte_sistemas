-- Fecha/hora de atención programada por el admin
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Realtime: peticiones generales (panel usuario + admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'general_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.general_requests;
  END IF;
END $$;

-- Agenda usuario: cambios en tickets del propio usuario (filtro en cliente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;
END $$;
