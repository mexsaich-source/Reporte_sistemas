-- =============================================================================
-- HELPdesk Mexsa – Supabase SQL Editor (ejecuta en orden, bloque por bloque)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOQUE A – Tabla equipment_requests (si NO la tenías, esto la crea)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equipment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  equipment_type text NOT NULL DEFAULT 'Laptop',
  reason text,
  urgency text DEFAULT 'Normal',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reject_reason text,
  delivered_at timestamptz,
  assigned_asset_id text
);

CREATE INDEX IF NOT EXISTS equipment_requests_user_id_idx ON public.equipment_requests (user_id);
CREATE INDEX IF NOT EXISTS equipment_requests_status_idx ON public.equipment_requests (status);

ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_requests_select" ON public.equipment_requests;
CREATE POLICY "equipment_requests_select"
  ON public.equipment_requests FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

DROP POLICY IF EXISTS "equipment_requests_insert" ON public.equipment_requests;
CREATE POLICY "equipment_requests_insert"
  ON public.equipment_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "equipment_requests_update_admin" ON public.equipment_requests;
CREATE POLICY "equipment_requests_update_admin"
  ON public.equipment_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(coalesce(p.role, '')) IN ('admin', 'tech', 'técnico')
    )
  );

-- Si la tabla ya existía sin columnas nuevas, añade las que falten:
ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_asset_id text;

-- -----------------------------------------------------------------------------
-- BLOQUE B – general_requests: solo si YA tienes la tabla → columnas extra
-- Si te marca error "relation does not exist", salta este bloque o usa BLOQUE B2
-- -----------------------------------------------------------------------------
ALTER TABLE public.general_requests
  ADD COLUMN IF NOT EXISTS reject_reason text;

-- BLOQUE B2 (opcional) – Crea general_requests solo si no existe NADA aún
-- Descomenta solo si BLOQUE B falló por "relation does not exist":
/*
CREATE TABLE IF NOT EXISTS public.general_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  department text,
  subject text,
  reason text,
  is_loan boolean DEFAULT false,
  serial_number text,
  loan_start_date date,
  loan_end_date date,
  observations text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reject_reason text
);
ALTER TABLE public.general_requests ENABLE ROW LEVEL SECURITY;
-- Añade políticas similares a equipment_requests según tu modelo
*/

-- -----------------------------------------------------------------------------
-- BLOQUE C – Tickets y mensajes de chat
-- -----------------------------------------------------------------------------
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS asset_id text,
  ADD COLUMN IF NOT EXISTS asset_serial_number text;

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS attachment_url text;

-- -----------------------------------------------------------------------------
-- BLOQUE D – FCM (solo si existe la tabla fcm_tokens)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fcm_tokens'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_id_token_key ON public.fcm_tokens (user_id, token)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE E – Realtime en ticket_messages (solo si aún no está en la publicación)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE F – Storage: crea bucket "ticket-chat" en Dashboard → Storage
-- Luego ejecuta políticas:
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ticket_chat_select_authenticated" ON storage.objects;
CREATE POLICY "ticket_chat_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-chat');

DROP POLICY IF EXISTS "ticket_chat_insert_authenticated" ON storage.objects;
CREATE POLICY "ticket_chat_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-chat');

DROP POLICY IF EXISTS "ticket_chat_delete_authenticated" ON storage.objects;
CREATE POLICY "ticket_chat_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-chat');

-- -----------------------------------------------------------------------------
-- BLOQUE G – Cron (opcional, con pg_cron descomentado)
-- -----------------------------------------------------------------------------
-- SELECT cron.schedule(
--   'purge_notifications_daily',
--   '0 5 * * *',
--   $$ DELETE FROM public.notifications WHERE created_at < now() - interval '1 day'; $$
-- );
-- SELECT cron.schedule(
--   'purge_ticket_chat_after_month',
--   '30 5 * * *',
--   $$
--   DELETE FROM public.ticket_messages tm
--   USING public.tickets t
--   WHERE tm.ticket_id = t.id
--     AND t.status = 'resolved'
--     AND t.closed_at IS NOT NULL
--     AND t.closed_at < now() - interval '1 month';
--   $$
-- );
