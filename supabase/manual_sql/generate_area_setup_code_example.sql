-- Ejemplo para generar codigo único Base64URL de configuracion por area.
-- Copia el resultado setup_code y pégalo en Dashboard > Notificaciones > Codigo unico.

WITH cfg AS (
  SELECT json_build_object(
    'telegram_bot_token', '123456:ABC-DEF...',
    'smtp_host', 'smtp.gmail.com',
    'smtp_port', 465,
    'smtp_user', 'it-alerts@tuempresa.com',
    'smtp_pass', 'app_password_o_secret',
    'smtp_from_name', 'IT Helpdesk',
    'meta_access_token', 'EAAG...tu_token_meta...',
    'meta_phone_number_id', '123456789012345'
  )::text AS payload
)
SELECT replace(replace(trim(trailing '=' from encode(convert_to(payload, 'UTF8'), 'base64')), '+', '-'), '/', '_') AS setup_code
FROM cfg;
