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

    // 2. Obtener datos de contacto del usuario (email, whatsapp)
    let email, whatsapp_phone;

    if (type === 'test') {
      // Para pruebas, limpiamos el celular
      whatsapp_phone = payload.whatsapp_phone ? String(payload.whatsapp_phone).replace(/\D/g, '') : '';
    } else {
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
      email = profile.email;
      whatsapp_phone = profile.whatsapp_phone ? String(profile.whatsapp_phone).replace(/\D/g, '') : '';
    }

    const promises = [];

    // 3. WhatsApp (Twilio Sandbox)
    if (whatsapp_phone) {
      const waText = type === 'test' 
        ? `*[IT Helpdesk]*\n🔔 *PRUEBA DE CONEXIÓN*\n¡Felicidades! Tu alerta por Twilio está funcionando.`
        : `*[IT Helpdesk]*\n🔔 *${title || 'Nueva Notificación'}*\n${message}${ticket_id ? `\nTicket ID: #${ticket_id}` : ''}`;
      
      const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (twilioSid && twilioToken && twilioPhone) {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        
        // Twilio requiere formato local e.g. +521...
        const formattedTo = `+${whatsapp_phone}`;
        const formattedFrom = twilioPhone.startsWith('+') ? twilioPhone : `+${twilioPhone}`;

        const bodyParams = new URLSearchParams();
        bodyParams.append('To', `whatsapp:${formattedTo}`);
        bodyParams.append('From', `whatsapp:${formattedFrom}`);
        bodyParams.append('Body', waText);

        const waPromise = fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(twilioSid + ':' + twilioToken)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        })
        .then(async (res) => {
          const text = await res.text();
          return { channel: "whatsapp", status: res.ok ? "sent" : "failed", response: text };
        })
        .catch(err => ({ channel: "whatsapp", status: "error", error: err.message }));
        
        promises.push(waPromise);
      } else {
        promises.push(Promise.resolve({ channel: "whatsapp", status: "skipped", reason: "Faltan credenciales de Twilio" }));
      }
    }

    // 4. Email HTML (Resend)
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (email && resendApiKey) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">IT Helpdesk</h2>
          <h3 style="color: #374151;">${title || 'Nueva Notificación'}</h3>
          <p style="padding: 15px; background-color: #f3f4f6; border-left: 4px solid #3b82f6; border-radius: 4px; line-height: 1.6;">
            ${message}
          </p>
          ${ticket_id ? `<p style="margin-top: 15px;">Referencia de Ticket: <strong>#${ticket_id}</strong></p>` : ''}
          <div style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">
            <p>Este es un mensaje automático del sistema de Helpdesk. Por favor no responder a este correo.</p>
          </div>
        </div>
      `;

      const emailPromise = fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "IT Helpdesk <onboarding@resend.dev>", // Cambia a tu dominio (ej. soporte@tudominio.com) si lo verificas en Resend
          to: [email],
          subject: title || "Alerta de IT Helpdesk",
          html: emailHtml
        })
      })
      .then(res => res.json())
      .then(data => ({ channel: "email", status: data.error ? "failed" : "sent", res: data }))
      .catch(err => ({ channel: "email", status: "error", error: err.message }));

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
