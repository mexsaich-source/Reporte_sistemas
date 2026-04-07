-- Politicas RLS para bucket de chat de tickets (ticket-chat)
-- Ejecutar en Supabase SQL Editor

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
