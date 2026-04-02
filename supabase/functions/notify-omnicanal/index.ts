import nodemailer from "npm:nodemailer";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { user_id, title, message, ticket_id, type } = payload;

    if (!user_id || !message) {
      return new Response(JSON.stringify({ error: "Faltan datos obligatorios (user_id, message)" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Conectar a Supabase con Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Obtener datos de contacto del usuario
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('email, whatsapp_phone')
      .eq('id', user_id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let email = profile.email;
    let whatsapp_phone = profile.whatsapp_phone ? String(profile.whatsapp_phone).replace(/\D/g, '') : '';

    if (type === 'test') {
      if (payload.email) email = payload.email;
      if (payload.whatsapp_phone) whatsapp_phone = String(payload.whatsapp_phone).replace(/\D/g, '');
    }

    const promises = [];

    // 3. Telegram (Bot API)
    if (whatsapp_phone) {
      const tgText = type === 'test' 
        ? `*[IT Helpdesk]*\n🔔 *PRUEBA DE CONEXIÓN*\n¡Felicidades! Tu bot de Telegram está recibiendo alertas correctamente.`
        : `*${title || 'Nueva Notificación'}*\n\n${message}${ticket_id ? `\n\nTicket ID: #${ticket_id}` : ''}`;
      
      const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

      if (tgToken) {
        const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
        
        const payloadTG = {
          chat_id: whatsapp_phone,
          text: tgText,
          parse_mode: 'Markdown'
        };

        const tgPromise = fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadTG)
        })
        .then(async (res) => {
          const json = await res.json();
          return { channel: "telegram", status: res.ok ? "sent" : "failed", response: json };
        })
        .catch(err => ({ channel: "telegram", status: "error", error: err.message }));
        
        promises.push(tgPromise);
      }
    }

    // 4. Email HTML (SMTP Universal)
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (email && smtpHost && smtpUser && smtpPass) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">IT Helpdesk</h2>
          <h3 style="color: #374151;">${title || 'Nueva Notificación'}</h3>
          <p style="padding: 15px; background-color: #f3f4f6; border-left: 4px solid #3b82f6; border-radius: 4px; line-height: 1.6;">
            ${message}
          </p>
          ${ticket_id ? `<p style="margin-top: 15px;">Referencia de Ticket: <strong>#${ticket_id}</strong></p>` : ''}
          <p style="margin-top: 30px; font-size: 11px; color: #6b7280; text-align: center;">
            Enviado desde cuenta: ${smtpUser}
          </p>
        </div>
      `;

      const emailPromise = (async () => {
        try {
          console.log(`[DEBUG] Iniciando conexión SMTP (Nodemailer) a ${smtpHost}:465...`);
          
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: 465,
            secure: true, // true for 465
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            // Pequeño timeout por seguridad
            connectionTimeout: 10000,
          });

          await transporter.sendMail({
            from: `"IT Helpdesk" <${smtpUser}>`,
            to: email,
            subject: title || "Alerta de IT Helpdesk",
            text: message,
            html: emailHtml
          });

          console.log(`[DEBUG] Correo enviado exitosamente.`);
          return { channel: "email", status: "sent" };
        } catch (err: any) {
          console.error(`[DEBUG] Fallo en Email:`, err.message || err);
          return { 
            channel: "email", 
            status: "error", 
            error: err.message || "Error de conexión SMTP desconocido",
            detail: String(err)
          };
        }
      })();

      promises.push(emailPromise);
    }

    // 5. Ejecutar ambos envíos al mismo tiempo
    const results = await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, channels_processed: promises.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Error global notify-omnicanal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
