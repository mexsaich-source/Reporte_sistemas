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

/**
 * Devuelve el área (IT | ING) según el departamento del perfil.
 * Coincide exactamente con la lógica de Sidebar.jsx:
 *   isMaint = department.includes('mantenimiento' | 'ingenieria' | 'ingeniería')
 */
function resolveProfileArea(profile: ProfileRow): Area | null {
  const dept = normalize(profile.department);
  if (dept.includes("mantenimiento") || dept.includes("ingenieria") || dept.includes("ingeniería")) {
    return "ING";
  }
  // Sin departamento de mantenimiento → IT si tiene rol de staff
  const role = normalize(profile.role);
  const itRoles = ["admin", "tech", "técnico", "tecnico"];
  if (itRoles.includes(role)) return "IT";
  return null;
}

/**
 * ¿Es administrador del área indicada?
 *
 * IT Admin  → role = 'admin'  AND  departamento NO es mantenimiento/ingeniería
 * ING Admin → role = 'admin' OR 'jefe_mantenimiento'  AND  departamento ES mantenimiento/ingeniería
 */
function isAdminForArea(profile: ProfileRow, area: Area): boolean {
  const role = normalize(profile.role);
  const dept = normalize(profile.department);
  const isMaint = dept.includes("mantenimiento") || dept.includes("ingenieria") || dept.includes("ingeniería");

  if (area === "IT") {
    return role === "admin" && !isMaint;
  }
  // ING
  return (role === "admin" && isMaint) || role === "jefe_mantenimiento";
}

/**
 * ¿Es técnico del área indicada?
 *
 * IT Tech  → role = 'tech' | 'técnico'  AND  departamento NO es mantenimiento/ingeniería
 * ING Tech → role = 'tech' | 'técnico' | 'ingeniero'  AND  departamento ES mantenimiento/ingeniería
 */
function isTechForArea(profile: ProfileRow, area: Area): boolean {
  const role = normalize(profile.role);
  const dept = normalize(profile.department);
  const isMaint = dept.includes("mantenimiento") || dept.includes("ingenieria") || dept.includes("ingeniería");
  const isTechRole = ["tech", "técnico", "tecnico"].includes(role);

  if (area === "IT") {
    return isTechRole && !isMaint;
  }
  // ING
  return (isTechRole && isMaint) || role === "ingeniero";
}

/**
 * Intenta resolver el área desde valores sueltos de payload (fallback).
 * Solo usada cuando NO se puede resolver desde el perfil.
 */
function normalizeAreaFromString(input: unknown): Area | null {
  const value = normalize(input);
  if (["it", "sistemas", "helpdesk", "soporte"].some((k) => value.includes(k))) return "IT";
  if (["ing", "ingenieria", "ingeniería", "mantenimiento", "engineering"].some((k) => value.includes(k))) return "ING";
  return null;
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

  const forcedArea = normalizeAreaFromString(payload.department || payload.area);

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

// ─────────────────────────────────────────────────────────────────────────────
// EVENTO 1: NUEVO TICKET CREADO
// → Telegram al Admin del área (IT o Ingeniería) únicamente.
// ─────────────────────────────────────────────────────────────────────────────
async function handleNewTicketCreated(supabase: any, payload: any) {
  const ctx = await resolveTicketContext(supabase, payload);
  if (!ctx) return { ok: false, status: 404, error: "No se pudo resolver el ticket o su area" };

  const admins = await getAdminsByArea(supabase, ctx.area);
  const targets = admins
    .map((a) => ({ id: a.id, chatId: getTelegramChatId(a), name: a.full_name || a.id }))
    .filter((a) => Boolean(a.chatId));

  const areaLabel = ctx.area === "IT" ? "IT" : "Ingeniería";
  const text =
    `🔔 *Nuevo ticket — ${areaLabel}*\n` +
    `📋 Folio: \`#${ctx.ticketId}\`` + `\n` +
    `📝 Asunto: ${ctx.title}\n` +
    `⚡ Acción requerida: revisar y asignar a un técnico.`;

  const results = await Promise.all(targets.map((t) => sendTelegramMessage(t.chatId as string, text)));

  return {
    ok: true,
    status: 200,
    event: "NEW_TICKET_CREATED",
    area: ctx.area,
    notified_admins: targets.length,
    admin_names: targets.map((t) => t.name),
    results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTO 2: TICKET ASIGNADO
// → Telegram ÚNICAMENTE al Técnico asignado de ese departamento.
// ─────────────────────────────────────────────────────────────────────────────
async function handleTicketAssigned(supabase: any, payload: any) {
  const ctx = await resolveTicketContext(supabase, payload);
  if (!ctx) return { ok: false, status: 404, error: "No se pudo resolver el ticket o su area" };
  if (!ctx.assignedTechId) return { ok: false, status: 400, error: "Falta assigned_tech_id para evento TICKET_ASSIGNED" };

  const techProfile = await getProfileById(supabase, ctx.assignedTechId);
  if (!techProfile) return { ok: false, status: 404, error: "Tecnico asignado no encontrado" };

  // Validación estricta: el técnico debe pertenecer al mismo departamento del ticket.
  if (!isTechForArea(techProfile, ctx.area)) {
    return {
      ok: false,
      status: 400,
      error: `El usuario "${techProfile.full_name}" no es técnico del departamento ${ctx.area}. Rol: ${techProfile.role}, Depto: ${techProfile.department}`,
    };
  }

  const chatId = getTelegramChatId(techProfile);
  if (!chatId) return { ok: false, status: 400, error: `Técnico ${techProfile.full_name} no tiene Chat ID de Telegram configurado` };

  const areaLabel = ctx.area === "IT" ? "IT" : "Ingeniería";
  const text =
    `🛠 *Ticket asignado — ${areaLabel}*\n` +
    `📋 Folio: \`#${ctx.ticketId}\`` + `\n` +
    `📝 Asunto: ${ctx.title}\n` +
    `⚡ Acción requerida: atender y resolver el ticket.`;

  const result = await sendTelegramMessage(chatId, text);

  return {
    ok: true,
    status: 200,
    event: "TICKET_ASSIGNED",
    area: ctx.area,
    assigned_tech: techProfile.full_name,
    assigned_tech_id: techProfile.id,
    result,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTO 3: TICKET RESUELTO
// → a) Telegram al Admin del área: el técnico completó el ticket.
// → b) Email SMTP al usuario reportador: su solicitud fue resuelta.
// ─────────────────────────────────────────────────────────────────────────────
async function handleTicketResolved(supabase: any, payload: any) {
  const ctx = await resolveTicketContext(supabase, payload);
  if (!ctx) return { ok: false, status: 404, error: "No se pudo resolver el ticket o su area" };

  const areaLabel = ctx.area === "IT" ? "IT" : "Ingeniería";

  // ── a) Telegram → Admin del departamento ─────────────────────────────────
  const admins = await getAdminsByArea(supabase, ctx.area);
  const adminTargets = admins
    .map((a) => ({ id: a.id, chatId: getTelegramChatId(a), name: a.full_name || a.id }))
    .filter((a) => Boolean(a.chatId));

  const techName = payload.tech_name ||
    (ctx.assignedTechId ? (await getProfileById(supabase, ctx.assignedTechId))?.full_name : null) ||
    "Técnico";

  const telegramText =
    `✅ *Ticket resuelto — ${areaLabel}*\n` +
    `📋 Folio: \`#${ctx.ticketId}\`` + `\n` +
    `📝 Asunto: ${ctx.title}\n` +
    `👷 Resuelto por: ${techName}\n` +
    `📌 Estado: completado.`;

  const telegramResults = await Promise.all(
    adminTargets.map((a) => sendTelegramMessage(a.chatId as string, telegramText))
  );

  // ── b) Email → Usuario reportador (SMTP únicamente, NO Telegram) ──────────
  const toEmail = ctx.reporterEmail || payload.reporter_email || null;
  let emailResult: Record<string, unknown> = {
    channel: "email",
    status: "skipped",
    reason: "missing_reporter_email",
  };

  if (toEmail) {
    emailResult = await sendEmail(
      toEmail,
      `Tu solicitud ha sido resuelta — Ticket #${ctx.ticketId}`,
      `Hola,\n\nTe informamos que tu solicitud "${ctx.title}" ha sido atendida y marcada como resuelta por el equipo de ${areaLabel}.\n\nSi el problema persiste o tienes alguna duda, crea un nuevo ticket desde la plataforma.\n\nGracias,\nEquipo de ${areaLabel}`
    );
  }

  return {
    ok: true,
    status: 200,
    event: "TICKET_RESOLVED",
    area: ctx.area,
    notified_admins: adminTargets.length,
    admin_names: adminTargets.map((a) => a.name),
    reporter_email: toEmail,
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
