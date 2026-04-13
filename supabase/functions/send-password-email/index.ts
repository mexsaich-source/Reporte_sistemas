import nodemailer from "npm:nodemailer";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailType = "password_setup" | "password_reset";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(input: unknown) {
  return String(input || "").trim().toLowerCase();
}

interface AreaSettings {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_from_name: string | null;
}

async function resolveUserIdByEmail(supabase: any, email: string): Promise<string | null> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

async function getAreaSettingsForUserArea(supabase: any, userId: string): Promise<AreaSettings | null> {
  try {
    // Obtener el área del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("department")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.warn("No profile found for user:", userId);
      return null;
    }

    // Determinar si es IT o ING
    const dept = normalize(profile.department);
    const isING = dept.includes("mantenimiento") || dept.includes("ingenieria") || dept.includes("ingeniería");
    const area = isING ? "ING" : "IT";

    // Obtener settings del área
    const { data: settings, error: settingsError } = await supabase
      .from("notification_area_settings")
      .select("smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name")
      .eq("area", area)
      .maybeSingle();

    if (settingsError || !settings) {
      console.warn(`No SMTP settings found for area ${area}`);
      return null;
    }

    // Si ING no tiene SMTP, usar IT
    if (area === "ING" && (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass)) {
      const { data: itSettings } = await supabase
        .from("notification_area_settings")
        .select("smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name")
        .eq("area", "IT")
        .maybeSingle();
      return itSettings as AreaSettings | null;
    }

    return settings as AreaSettings;
  } catch (error: any) {
    console.error("Error getting area settings:", error?.message || error);
    return null;
  }
}

async function generatePasswordResetLink(supabaseAdmin: any, email: string, redirectTo: string): Promise<string | null> {
  try {
    // Usar la API Admin para generar un link de reset válido en Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo,
      }
    });

    if (error || !data) {
      console.warn("Could not generate reset link:", error?.message || "Unknown error");
      return null;
    }

    // El link viene en data.properties.action_link
    return data.properties?.action_link || null;
  } catch (error: any) {
    console.error("Error generating reset link:", error?.message || error);
    return null;
  }
}

async function sendPasswordEmail(
  to: string,
  emailType: EmailType,
  resetLink: string,
  settings: AreaSettings | null
): Promise<{ success: boolean; error?: string }> {
  // Intentar usar settings del área del usuario; si no, usar vars de entorno
  const smtpHost = String(settings?.smtp_host || Deno.env.get("SMTP_HOST") || "").trim();
  const smtpPort = Number(settings?.smtp_port || Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = String(settings?.smtp_user || Deno.env.get("SMTP_USER") || "").trim();
  const smtpPass = String(settings?.smtp_pass || Deno.env.get("SMTP_PASS") || "").trim();
  const fromName = String(settings?.smtp_from_name || "IT Helpdesk").trim() || "IT Helpdesk";

  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      success: false,
      error: "Missing SMTP configuration in area settings and environment",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
    });

    let subject = "";
    let titleText = "";
    let messageText = "";
    let buttonText = "";

    if (emailType === "password_setup") {
      subject = "Configura tu contraseña - IT Helpdesk";
      titleText = "Bienvenido a IT Helpdesk";
      messageText =
        "Haz clic en el botón a continuación para configurar tu contraseña y acceder al sistema.";
      buttonText = "Configurar Contraseña";
    } else {
      subject = "Recuperar contraseña - IT Helpdesk";
      titleText = "Solicitud de Recuperación";
      messageText =
        "Haz clic en el botón a continuación para restablecer tu contraseña. Este enlace expira en 24 horas.";
      buttonText = "Restablecer Contraseña";
    }

    const html = `
      <table style="width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <tr>
          <td style="padding: 40px 20px; background: #f8f9fa; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #1e293b;">${fromName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 20px; background: white;">
            <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1e293b;">${titleText}</h2>
            <p style="margin: 0 0 30px 0; font-size: 15px; line-height: 1.6; color: #475569;">
              ${messageText}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
                ${buttonText}
              </a>
            </div>
            <p style="margin: 30px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
              <strong>Si no solicitaste esto:</strong><br/>
              Si no reconoces este el intento de acceso, ignora este correo. Tu contraseña es segura.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px; background: #f1f5f9; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              © 2024 ${fromName}. Todos los derechos reservados.
            </p>
          </td>
        </tr>
      </table>
    `;

    const text = `${titleText}\n\n${messageText}\n\n${resetLink}\n\nSi no solicitaste esto, ignora este correo.`;

    await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to,
      subject,
      text,
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error sending password email:", error?.message || error);
    return {
      success: false,
      error: error?.message || "Unknown error sending email",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, user_id, email_type, reset_link, full_name } = await req.json();

    // Validar inputs
    if (!email || !email_type) {
      return jsonResponse(
        {
          success: false,
          error: "Missing required fields: email, email_type",
        },
        400
      );
    }

    if (!["password_setup", "password_reset"].includes(email_type)) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid email_type. Must be 'password_setup' or 'password_reset'",
        },
        400
      );
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(
        {
          success: false,
          error: "Missing Supabase configuration",
        },
        500
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generar el link de reset real desde Supabase Auth
    const authBase = reset_link || Deno.env.get("VITE_AUTH_REDIRECT_BASE") || "https://it-helpdesk-mexsa.vercel.app";
    const redirectUrl = `${authBase}/reset-password`;
    
    const actualResetLink = await generatePasswordResetLink(supabaseAdmin, email, redirectUrl);
    
    if (!actualResetLink) {
      return jsonResponse(
        {
          success: false,
          error: "Could not generate password reset link from Supabase Auth",
        },
        500
      );
    }

    // Obtener settings del área del usuario
    let settings: AreaSettings | null = null;
    const resolvedUserId = user_id || await resolveUserIdByEmail(supabaseAdmin, email);
    if (resolvedUserId) {
      settings = await getAreaSettingsForUserArea(supabaseAdmin, resolvedUserId);
    }

    // Enviar email
    const result = await sendPasswordEmail(email, email_type as EmailType, actualResetLink, settings);

    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          error: result.error || "Failed to send email",
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      message: `${email_type} email sent successfully to ${email}`,
    });
  } catch (error: any) {
    console.error("Function error:", error?.message || error);
    return jsonResponse(
      {
        success: false,
        error: error?.message || "Internal server error",
      },
      500
    );
  }
});
