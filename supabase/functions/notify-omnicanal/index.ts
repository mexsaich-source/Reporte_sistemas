import nodemailer from "npm:nodemailer";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Area = "IT" | "ING";
type TicketEvent = "NEW_TICKET_CREATED" | "TICKET_ASSIGNED" | "TICKET_RESOLVED";

type ProfileRow = {
  id: string;
  role: string | null;
  department: string | null;
  status: boolean | null;
  full_name: string | null;
  email: string | null;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
};

type TicketContext = {
  ticketId: string;
  area: Area;
  title: string;
  reporterId: string | null;
  assignedTechId: string | null;
  reporterEmail: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(input: unknown) {
  return String(input || "").trim().toLowerCase();
}

function normalizeArea(input: unknown): Area | null {
  const value = normalize(input);
  if (["it", "admin it", "tech it", "admin_it", "tech_it"].includes(value)) return "IT";
  if (["ing", "ingenieria", "ingenieria", "engineering", "admin ing", "tech ing", "admin_ing", "tech_ing", "mantenimiento"].includes(value)) return "ING";
  return null;
}

function resolveProfileArea(profile: ProfileRow): Area | null {
  const fromDept = normalizeArea(profile.department);
  if (fromDept) return fromDept;

  const role = normalize(profile.role);
  if (role.includes("admin_it") || role.includes("tech_it")) return "IT";
  if (role.includes("admin_ing") || role.includes("tech_ing")) return "ING";
  if (role.includes("jefe_mantenimiento") || role.includes("ingeniero")) return "ING";
  return null;
}

function isAdminForArea(profile: ProfileRow, area: Area): boolean {
  const role = normalize(profile.role);
  const profileArea = resolveProfileArea(profile);

  if (area === "IT") {
    return role === "admin_it" || (role === "admin" && profileArea === "IT");
  }
  return role === "admin_ing" || role === "jefe_mantenimiento" || (role === "admin" && profileArea === "ING");
}

function isTechForArea(profile: ProfileRow, area: Area): boolean {
  const role = normalize(profile.role);
  const profileArea = resolveProfileArea(profile);

  if (area === "IT") {
    return role === "tech_it" || ((role === "tech" || role === "tecnico" || role === "técnico") && profileArea === "IT");
  }
  return role === "tech_ing" || role === "ingeniero" || ((role === "tech" || role === "tecnico" || role === "técnico") && profileArea === "ING");
}

function getTelegramChatId(profile: ProfileRow): string | null {
  const direct = String(profile.telegram_chat_id || "").trim();
  if (direct) return direct;

  const legacy = String(profile.whatsapp_phone || "").trim();
  if (!legacy) return null;
  if (legacy.startsWith("-")) return legacy;
  return legacy.replace(/\D/g, "");
}

async function sendTelegramMessage(chatId: string, text: string) {
  const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!tgToken) {
    return { channel: "telegram", status: "skipped", reason: "missing_telegram_token" };
  }

  const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    const json = await res.json();
    return { channel: "telegram", status: res.ok ? "sent" : "failed", response: json };
  } catch (error: any) {
    return { channel: "telegram", status: "error", error: error?.message || String(error) };
  }
}

async function sendEmail(to: string, subject: string, body: string) {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { channel: "email", status: "skipped", reason: "missing_smtp_config" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
    });

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">IT Helpdesk</h2>
        <h3 style="color: #374151;">${subject}</h3>
        <p style="padding: 15px; background-color: #f3f4f6; border-left: 4px solid #3b82f6; border-radius: 4px; line-height: 1.6;">${body}</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"IT Helpdesk" <${smtpUser}>`,
      to,
      subject,
      text: body,
      html,
    });

    return { channel: "email", status: "sent" };
  } catch (error: any) {
    return { channel: "email", status: "error", error: error?.message || String(error) };
  }
}

async function getProfileById(supabase: any, userId: string): Promise<ProfileRow | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, department, status, full_name, email, telegram_chat_id, whatsapp_phone")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}

async function getAdminsByArea(supabase: any, area: Area): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, department, status, full_name, email, telegram_chat_id, whatsapp_phone")
    .eq("status", true);

  if (error || !data) return [];
  return (data as ProfileRow[]).filter((p) => isAdminForArea(p, area));
}

async function resolveTicketContext(supabase: any, payload: any): Promise<TicketContext | null> {
  const ticketId = String(payload.ticket_id || "").trim();
  if (!ticketId) return null;

  const forcedArea = normalizeArea(payload.department || payload.area);

  const { data: itTicket } = await supabase
    .from("tickets")
    .select("id, title, reported_by, assigned_tech")
    .eq("id", ticketId)
    .maybeSingle();

  if (itTicket) {
    const reporter = await getProfileById(supabase, itTicket.reported_by || "");
    return {
      ticketId,
      area: forcedArea || "IT",
      title: itTicket.title || `Ticket #${ticketId}`,
      reporterId: itTicket.reported_by || null,
      assignedTechId: payload.assigned_tech_id || itTicket.assigned_tech || null,
      reporterEmail: payload.reporter_email || reporter?.email || null,
    };
  }

  const { data: ingTicket } = await supabase
    .from("maintenance_tickets")
    .select("id, title_falla, creado_por, asignado_a")
    .eq("id", ticketId)
    .maybeSingle();

  if (ingTicket) {
    const reporter = await getProfileById(supabase, ingTicket.creado_por || "");
    return {
      ticketId,
      area: forcedArea || "ING",
      title: ingTicket.title_falla || `Orden #${ticketId}`,
      reporterId: ingTicket.creado_por || null,
      assignedTechId: payload.assigned_tech_id || ingTicket.asignado_a || null,
      reporterEmail: payload.reporter_email || reporter?.email || null,
    };
  }

  if (forcedArea) {
    return {
      ticketId,
      area: forcedArea,
      title: payload.title || `Ticket #${ticketId}`,
      reporterId: payload.reporter_id || null,
      assignedTechId: payload.assigned_tech_id || null,
      reporterEmail: payload.reporter_email || null,
    };
  }

  return null;
}

async function handleNewTicketCreated(supabase: any, payload: any) {
  const ctx = await resolveTicketContext(supabase, payload);
  if (!ctx) return { ok: false, status: 404, error: "No se pudo resolver el ticket o su area" };

  const admins = await getAdminsByArea(supabase, ctx.area);
  const targets = admins
    .map((a) => ({ id: a.id, chatId: getTelegramChatId(a), name: a.full_name || a.id }))
    .filter((a) => Boolean(a.chatId));

  const text = `*Nuevo ticket ${ctx.area}*\nFolio: #${ctx.ticketId}\nTitulo: ${ctx.title}\nAccion: revisar y asignar.`;
  const results = await Promise.all(targets.map((t) => sendTelegramMessage(t.chatId as string, text)));

  return { ok: true, status: 200, event: "NEW_TICKET_CREATED", area: ctx.area, notified_admins: targets.length, results };
}

async function handleTicketAssigned(supabase: any, payload: any) {
  const ctx = await resolveTicketContext(supabase, payload);
  if (!ctx) return { ok: false, status: 404, error: "No se pudo resolver el ticket o su area" };
  if (!ctx.assignedTechId) return { ok: false, status: 400, error: "Falta assigned_tech_id para evento TICKET_ASSIGNED" };

  const techProfile = await getProfileById(supabase, ctx.assignedTechId);
  if (!techProfile) return { ok: false, status: 404, error: "Tecnico asignado no encontrado" };
  if (!isTechForArea(techProfile, ctx.area)) {
    return { ok: false, status: 400, error: `El usuario asignado no es tecnico del departamento ${ctx.area}` };
  }

  const chatId = getTelegramChatId(techProfile);
  if (!chatId) return { ok: false, status: 400, error: "Tecnico sin chat_id de Telegram" };

  const text = `*Ticket asignado*\nArea: ${ctx.area}\nFolio: #${ctx.ticketId}\nTitulo: ${ctx.title}\nAccion: atender ticket.`;
  const result = await sendTelegramMessage(chatId, text);

  return { ok: true, status: 200, event: "TICKET_ASSIGNED", area: ctx.area, assigned_tech_id: techProfile.id, result };
}

async function handleTicketResolved(supabase: any, payload: any) {
  const ctx = await resolveTicketContext(supabase, payload);
  if (!ctx) return { ok: false, status: 404, error: "No se pudo resolver el ticket o su area" };

  const admins = await getAdminsByArea(supabase, ctx.area);
  const adminTargets = admins
    .map((a) => ({ id: a.id, chatId: getTelegramChatId(a), name: a.full_name || a.id }))
    .filter((a) => Boolean(a.chatId));

  const telegramText = `*Ticket resuelto*\nArea: ${ctx.area}\nFolio: #${ctx.ticketId}\nTitulo: ${ctx.title}\nEstado: completado por tecnico.`;
  const telegramResults = await Promise.all(adminTargets.map((a) => sendTelegramMessage(a.chatId as string, telegramText)));

  const toEmail = ctx.reporterEmail || payload.reporter_email || null;
  let emailResult: Record<string, unknown> = { channel: "email", status: "skipped", reason: "missing_reporter_email" };
  if (toEmail) {
    emailResult = await sendEmail(
      toEmail,
      `Solicitud resuelta - Ticket #${ctx.ticketId}`,
      `Hola, tu solicitud "${ctx.title}" fue marcada como resuelta por el equipo de ${ctx.area}.`
    );
  }

  return {
    ok: true,
    status: 200,
    event: "TICKET_RESOLVED",
    area: ctx.area,
    notified_admins: adminTargets.length,
    telegram_results: telegramResults,
    email_result: emailResult,
  };
}

async function handleLegacyNotification(supabase: any, payload: any) {
  const { user_id, title, message, ticket_id, type } = payload;

  if (!user_id || !message) {
    return { ok: false, status: 400, error: "Faltan datos obligatorios (user_id, message)" };
  }

  const profile = await getProfileById(supabase, user_id);
  if (!profile) {
    return { ok: false, status: 404, error: "Usuario no encontrado" };
  }

  if (profile.status === false && type !== "test") {
    return { ok: true, status: 200, success: true, reason: "Usuario suspendido, notificacion omitida" };
  }

  let email = profile.email;
  let chatId = getTelegramChatId(profile);

  if (type === "test") {
    if (payload.email) email = payload.email;
    if (payload.whatsapp_phone) chatId = String(payload.whatsapp_phone).trim();
  }

  const jobs: Promise<unknown>[] = [];
  if (chatId) {
    const tgText = type === "test"
      ? `*[IT Helpdesk]*\nPRUEBA DE CONEXION\nTu bot de Telegram esta recibiendo alertas correctamente.`
      : `*${title || "Nueva Notificacion"}*\n\n${message}${ticket_id ? `\n\nTicket ID: #${ticket_id}` : ""}`;
    jobs.push(sendTelegramMessage(chatId, tgText));
  }

  if (email) {
    jobs.push(sendEmail(email, title || "Alerta de IT Helpdesk", message));
  }

  const results = await Promise.all(jobs);
  return { ok: true, status: 200, success: true, channels_processed: jobs.length, results };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const event = String(payload?.event || "").trim().toUpperCase() as TicketEvent;

    if (event === "NEW_TICKET_CREATED") {
      const out = await handleNewTicketCreated(supabase, payload);
      return jsonResponse(out.ok ? out : { error: out.error }, out.status);
    }

    if (event === "TICKET_ASSIGNED") {
      const out = await handleTicketAssigned(supabase, payload);
      return jsonResponse(out.ok ? out : { error: out.error }, out.status);
    }

    if (event === "TICKET_RESOLVED") {
      const out = await handleTicketResolved(supabase, payload);
      return jsonResponse(out.ok ? out : { error: out.error }, out.status);
    }

    const legacy = await handleLegacyNotification(supabase, payload);
    return jsonResponse(legacy.ok ? legacy : { error: legacy.error }, legacy.status);
  } catch (err) {
    console.error("Error global notify-omnicanal:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
