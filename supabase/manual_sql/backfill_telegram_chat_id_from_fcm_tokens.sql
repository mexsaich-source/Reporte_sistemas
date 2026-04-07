-- Backfill Telegram Chat ID desde fcm_tokens hacia profiles
-- Objetivo: normalizar la fuente de verdad en profiles.telegram_chat_id / profiles.whatsapp_phone
-- Uso: ejecutar una sola vez en Supabase SQL Editor.
-- Nota: este script detecta automaticamente el nombre de columna disponible en fcm_tokens.

DO $$
DECLARE
  v_source_col text;
  v_rows_updated bigint := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fcm_tokens'
  ) THEN
    RAISE NOTICE 'Tabla public.fcm_tokens no existe; backfill omitido.';
    RETURN;
  END IF;

  SELECT c.column_name
  INTO v_source_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'fcm_tokens'
    AND c.column_name IN ('whatsapp_phone', 'telegram_chat_id', 'chat_id')
  ORDER BY CASE c.column_name
    WHEN 'whatsapp_phone' THEN 1
    WHEN 'telegram_chat_id' THEN 2
    WHEN 'chat_id' THEN 3
    ELSE 99
  END
  LIMIT 1;

  IF v_source_col IS NULL THEN
    RAISE NOTICE 'No se encontro columna de chat id en fcm_tokens (esperadas: whatsapp_phone, telegram_chat_id, chat_id).';
    RETURN;
  END IF;

  EXECUTE format($q$
    WITH candidate_ids AS (
      SELECT DISTINCT ON (t.user_id)
        t.user_id,
        nullif(trim(t.%I::text), '') AS chat_id
      FROM public.fcm_tokens t
      WHERE t.user_id IS NOT NULL
        AND nullif(trim(t.%I::text), '') IS NOT NULL
      ORDER BY t.user_id, t.created_at DESC NULLS LAST
    ),
    updated AS (
      UPDATE public.profiles p
      SET
        telegram_chat_id = c.chat_id,
        whatsapp_phone = c.chat_id,
        updated_at = now()
      FROM candidate_ids c
      WHERE p.id = c.user_id
        AND (
          nullif(trim(coalesce(p.telegram_chat_id, '')), '') IS NULL
          OR nullif(trim(coalesce(p.whatsapp_phone, '')), '') IS NULL
          OR p.telegram_chat_id IS DISTINCT FROM c.chat_id
          OR p.whatsapp_phone IS DISTINCT FROM c.chat_id
        )
      RETURNING p.id
    )
    SELECT count(*) FROM updated
  $q$, v_source_col, v_source_col)
  INTO v_rows_updated;

  RAISE NOTICE 'Backfill completado usando fcm_tokens.%: % filas actualizadas.', v_source_col, v_rows_updated;
END;
$$;

-- Verificacion: perfiles con Telegram ID despues del backfill
SELECT id, email, telegram_chat_id, whatsapp_phone
FROM public.profiles
WHERE nullif(trim(coalesce(telegram_chat_id, '')), '') IS NOT NULL
   OR nullif(trim(coalesce(whatsapp_phone, '')), '') IS NOT NULL
ORDER BY updated_at DESC NULLS LAST
LIMIT 100;
