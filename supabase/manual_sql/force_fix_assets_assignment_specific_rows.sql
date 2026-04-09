-- Fix puntual para filas que no entraron: crea o actualiza activos por NS/Hostname
-- y los asigna al usuario por email o nombre.
--
-- Ejecutar completo en Supabase SQL Editor.

ROLLBACK;

-- ==========================================
-- 1) Diagnostico rapido de match en assets
-- ==========================================
WITH targets(ns, hostname, user_name, email) AS (
  VALUES
    ('1HF5380M7C', 'MEXSA5380M7C', 'Kenia Gonzale',  'kenia.gonzale@hilton.com'),
    ('1HF5380M6H', 'MEXSA5380M6H', 'Liz Enriquez',   'liz.enriquez@hilton.com'),
    ('1HF5380M64', 'MEXSA5380M64', 'Paola Aguilar',  'paola.aguilar@hilton.com'),
    ('1HF5380M69', 'MEXSA5083M69', 'Rafael Jimenez', 'rafael.jimenez@hilton.com'),
    ('1HF5380M6P', 'MEXSA5380M6P', 'Sergio Barbosa', 'sergio.barbosa@hilton.com')
)
SELECT
  t.*,
  a.id AS asset_id,
  a.status,
  a.assigned_to,
  a.specs->>'serial_number' AS serial_number_db,
  a.specs->>'ns' AS ns_db,
  a.specs->>'hostname' AS hostname_db
FROM targets t
LEFT JOIN public.assets a
  ON upper(regexp_replace(coalesce(a.specs->>'serial_number', a.specs->>'serial', a.specs->>'ns', ''), '\\s+', '', 'g'))
     = upper(regexp_replace(t.ns, '\\s+', '', 'g'))
  OR lower(trim(coalesce(a.specs->>'hostname', '')))
     = lower(trim(t.hostname))
ORDER BY t.hostname;

-- ==========================================
-- 2) Fix total (update o insert + asignacion)
-- ==========================================
BEGIN;

WITH targets(ns, hostname, user_name, email, brand, model_txt) AS (
  VALUES
    ('1HF5380M7C', 'MEXSA5380M7C', 'Kenia Gonzale',  'kenia.gonzale@hilton.com',  'HP', 'HP'),
    ('1HF5380M6H', 'MEXSA5380M6H', 'Liz Enriquez',   'liz.enriquez@hilton.com',   'HP', 'HP'),
    ('1HF5380M64', 'MEXSA5380M64', 'Paola Aguilar',  'paola.aguilar@hilton.com',  'HP', 'HP'),
    ('1HF5380M69', 'MEXSA5083M69', 'Rafael Jimenez', 'rafael.jimenez@hilton.com', 'HP', 'HP'),
    ('1HF5380M6P', 'MEXSA5380M6P', 'Sergio Barbosa', 'sergio.barbosa@hilton.com', 'HP', 'HP')
),
profile_match AS (
  SELECT
    t.*,
    p.id AS profile_id,
    p.full_name AS profile_name,
    lower(trim(p.email)) AS profile_email
  FROM targets t
  LEFT JOIN LATERAL (
    SELECT id, full_name, email
    FROM public.profiles
    WHERE lower(trim(email)) = lower(trim(t.email))
       OR regexp_replace(lower(trim(full_name)), '[^a-z0-9 ]', '', 'g')
          = regexp_replace(lower(trim(t.user_name)), '[^a-z0-9 ]', '', 'g')
    ORDER BY CASE WHEN lower(trim(email)) = lower(trim(t.email)) THEN 0 ELSE 1 END
    LIMIT 1
  ) p ON true
),
asset_match AS (
  SELECT
    pm.*,
    a.id AS asset_id
  FROM profile_match pm
  LEFT JOIN LATERAL (
    SELECT id
    FROM public.assets a
    WHERE upper(regexp_replace(coalesce(a.specs->>'serial_number', a.specs->>'serial', a.specs->>'ns', ''), '\\s+', '', 'g'))
          = upper(regexp_replace(pm.ns, '\\s+', '', 'g'))
       OR lower(trim(coalesce(a.specs->>'hostname', ''))) = lower(trim(pm.hostname))
    ORDER BY CASE
      WHEN upper(regexp_replace(coalesce(a.specs->>'serial_number', a.specs->>'serial', a.specs->>'ns', ''), '\\s+', '', 'g'))
           = upper(regexp_replace(pm.ns, '\\s+', '', 'g')) THEN 0
      ELSE 1
    END
    LIMIT 1
  ) a ON true
),
updated_existing AS (
  UPDATE public.assets a
  SET
    assigned_to = am.profile_id,
    status = CASE WHEN a.status IS NULL OR a.status = 'available' THEN 'active' ELSE a.status END,
    specs = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      coalesce(a.specs, '{}'::jsonb),
                      '{serial_number}', to_jsonb(upper(regexp_replace(am.ns, '\\s+', '', 'g'))), true
                    ),
                    '{ns}', to_jsonb(upper(regexp_replace(am.ns, '\\s+', '', 'g'))), true
                  ),
                  '{hostname}', to_jsonb(am.hostname), true
                ),
                '{assigned_to_email}', to_jsonb(coalesce(am.profile_email, lower(trim(am.email)))), true
              ),
              '{assigned_user_name}', to_jsonb(coalesce(am.profile_name, am.user_name)), true
            )
  FROM asset_match am
  WHERE a.id = am.asset_id
    AND am.profile_id IS NOT NULL
  RETURNING a.id
),
to_insert AS (
  SELECT *
  FROM asset_match
  WHERE asset_id IS NULL
    AND profile_id IS NOT NULL
),
inserted_new AS (
  INSERT INTO public.assets (id, type, model, status, assigned_to, specs)
  SELECT
    'AST-' || substr(md5(random()::text || ns || hostname), 1, 12),
    'Computer',
    model_txt,
    'active',
    profile_id,
    jsonb_build_object(
      'serial_number', upper(regexp_replace(ns, '\\s+', '', 'g')),
      'ns', upper(regexp_replace(ns, '\\s+', '', 'g')),
      'hostname', hostname,
      'brand', brand,
      'model', model_txt,
      'assigned_to_email', coalesce(profile_email, lower(trim(email))),
      'assigned_user_name', coalesce(profile_name, user_name),
      'details', 'Alta automatica por fix SQL puntual'
    )
  FROM to_insert
  RETURNING id
)
SELECT
  (SELECT count(*) FROM profile_match WHERE profile_id IS NULL) AS profiles_not_found,
  (SELECT count(*) FROM updated_existing) AS updated_assets,
  (SELECT count(*) FROM inserted_new) AS inserted_assets;

COMMIT;

-- ==========================================
-- 3) Verificacion final
-- ==========================================
WITH targets(ns, hostname) AS (
  VALUES
    ('1HF5380M7C', 'MEXSA5380M7C'),
    ('1HF5380M6H', 'MEXSA5380M6H'),
    ('1HF5380M64', 'MEXSA5380M64'),
    ('1HF5380M69', 'MEXSA5083M69'),
    ('1HF5380M6P', 'MEXSA5380M6P')
)
SELECT
  a.id,
  a.status,
  a.assigned_to,
  p.full_name,
  p.email,
  a.specs->>'hostname' AS hostname,
  a.specs->>'serial_number' AS serial_number,
  a.specs->>'ns' AS ns,
  a.specs->>'assigned_to_email' AS assigned_to_email
FROM public.assets a
LEFT JOIN public.profiles p ON p.id = a.assigned_to
JOIN targets t
  ON upper(regexp_replace(coalesce(a.specs->>'serial_number', a.specs->>'serial', a.specs->>'ns', ''), '\\s+', '', 'g'))
     = upper(regexp_replace(t.ns, '\\s+', '', 'g'))
  OR lower(trim(coalesce(a.specs->>'hostname', '')))
     = lower(trim(t.hostname))
ORDER BY hostname;
