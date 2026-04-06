// @ts-ignore: Deno remote import
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type LocalDiagnosis = {
  reply: string;
  topic: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((m) => {
      const role: "user" | "assistant" = m?.role === "assistant" ? "assistant" : "user";
      return {
        role,
        text: String(m?.text || "").trim(),
      };
    })
    .filter((m) => m.text.length > 0)
    .slice(-12);
}

function buildSystemPrompt() {
  return [
    "Eres un asistente de mesa de ayuda TI para un hotel.",
    "Objetivo: diagnostico rapido y practico para problemas internos operativos.",
    "Responde en espanol, breve (4 a 8 lineas), claro y accionable.",
    "No pidas ticket de entrada. Primero guia con checks rapidos y ordenados.",
    "Haz una sola pregunta de aclaracion cuando falte contexto critico.",
    "Evita temas de VPN salvo que el usuario lo mencione explicitamente.",
    "Contexto del hotel: equipos administrativos, impresoras, correo interno, sistema PMS/POS, telefonia interna, red local.",
    "Si el problema parece por estado de equipo (apagado, suspendido, cable suelto), prioriza esas validaciones antes de escalar.",
    "Cierra con un mini resumen 'Siguiente paso recomendado: ...'.",
  ].join("\n");
}

function localDiagnose(lastUserMessage: string): LocalDiagnosis {
  const text = String(lastUserMessage || "").toLowerCase();

  if (text.includes("impres") || text.includes("print")) {
    return {
      topic: "impresora",
      reply: [
        "Perfecto, revisemos impresion en 4 pasos rapidos:",
        "1) Confirma que la impresora este encendida (no suspendida) y sin alerta en pantalla.",
        "2) Verifica cable red/usb y que la PC este en la red interna correcta.",
        "3) Limpia la cola de impresion y reintenta con una pagina de prueba.",
        "4) Reinicia spooler o reinicia impresora + equipo.",
        "Siguiente paso recomendado: dime modelo de impresora y area exacta para darte el ajuste de driver/puerto.",
      ].join("\n"),
    };
  }

  if (text.includes("internet") || text.includes("wifi") || text.includes("red")) {
    return {
      topic: "red",
      reply: [
        "Vamos por diagnostico de red interno:",
        "1) Valida si el equipo esta encendido o quedo en suspension sin reconectar red.",
        "2) Prueba cable/AP alterno y deshabilitar-habilitar adaptador.",
        "3) Confirma si falla solo en tu puesto o en toda el area.",
        "4) Ejecuta prueba basica a gateway local y DNS interno.",
        "Siguiente paso recomendado: comparte area (recepcion, administracion, etc.) y si la falla es general o individual.",
      ].join("\n"),
    };
  }

  if (text.includes("correo") || text.includes("mail") || text.includes("outlook")) {
    return {
      topic: "correo",
      reply: [
        "Para correo interno, valida esto:",
        "1) Hora/fecha del equipo correctas (si no, falla autenticacion).",
        "2) Estado de red y acceso web al correo.",
        "3) Cerrar y abrir sesion en cliente de correo.",
        "4) Revisar bandeja saturada o bloqueo por password incorrecto.",
        "Siguiente paso recomendado: dime si falla envio, recepcion o acceso para darte la ruta exacta.",
      ].join("\n"),
    };
  }

  if (text.includes("telefono") || text.includes("extension") || text.includes("llamada")) {
    return {
      topic: "telefonia",
      reply: [
        "Para telefonia interna, revisa:",
        "1) Energia y cableado del telefono.",
        "2) Si hay tono en la extension.",
        "3) Reinicio rapido del equipo.",
        "4) Prueba llamada interna a otra extension.",
        "Siguiente paso recomendado: comparte numero de extension y area para validar si es falla puntual o de segmento.",
      ].join("\n"),
    };
  }

  if (text.includes("sistema") || text.includes("pms") || text.includes("pos") || text.includes("no abre") || text.includes("error")) {
    return {
      topic: "sistema",
      reply: [
        "Para sistema interno (PMS/POS u otro), vamos asi:",
        "1) Cierra sesion y abre nuevamente.",
        "2) Verifica red y permisos del usuario.",
        "3) Prueba en otro equipo del area para aislar si es local o general.",
        "4) Reinicia aplicacion y valida mensaje de error exacto.",
        "Siguiente paso recomendado: pasame texto/codigo del error para darte solucion puntual.",
      ].join("\n"),
    };
  }

  return {
    topic: "general",
    reply: [
      "Te ayudo con un diagnostico rapido TI interno:",
      "1) Confirma estado del equipo (encendido vs suspendido).",
      "2) Revisa conexiones fisicas (corriente/red/perifericos).",
      "3) Reinicia la app y luego el equipo si persiste.",
      "4) Dime si pasa solo en un puesto o en todo el area.",
      "Siguiente paso recomendado: escribe equipo/sistema y area exacta para darte pasos mas precisos.",
    ].join("\n"),
  };
}

function buildQuotaFallbackReply(lastUserMessage: string) {
  const text = String(lastUserMessage || "").toLowerCase();

  if (text.includes("impres") || text.includes("print")) {
    return [
      "No pude usar IA externa por limite temporal, pero te ayudo con un check rapido de impresion:",
      "1) Verifica que la impresora este encendida (no suspendida) y sin alertas en panel.",
      "2) Confirma cable de red/USB y que el equipo este en la misma red interna.",
      "3) Revisa cola de impresion y elimina trabajos atascados.",
      "4) Reinicia servicio de cola (spooler) o reinicia impresora y PC.",
      "Siguiente paso recomendado: si no imprime tras estos 4 pasos, indica modelo y area para guiarte con driver/puerto.",
    ].join("\n");
  }

  if (text.includes("internet") || text.includes("wifi") || text.includes("red")) {
    return [
      "No pude usar IA externa por limite temporal, pero te dejo un check rapido de red:",
      "1) Confirma si el equipo esta conectado o quedo en suspension sin reconectar.",
      "2) Revisa cable de red/AP cercano y prueba reconectar adaptador.",
      "3) Valida si afecta solo a tu equipo o a todo el area.",
      "4) Ejecuta prueba basica: gateway interno y DNS del hotel.",
      "Siguiente paso recomendado: comparte area exacta y si es falla general o individual para darte ruta precisa.",
    ].join("\n");
  }

  return [
    "La IA externa esta con limite temporal, pero seguimos operando en modo respaldo.",
    "1) Verifica energia/estado del equipo (encendido vs suspendido).",
    "2) Revisa conexiones fisicas (corriente, red, perifericos).",
    "3) Reinicia aplicacion y luego el equipo si el fallo persiste.",
    "4) Confirma si el problema ocurre en un solo puesto o en toda el area.",
    "Siguiente paso recomendado: dime sistema/equipo y area para darte pasos exactos.",
  ].join("\n");
}

function isQuotaIssue(details: unknown) {
  const detailsText = JSON.stringify(details || {}).toLowerCase();
  return (
    detailsText.includes("quota exceeded") ||
    detailsText.includes("rate limit") ||
    detailsText.includes("resource_exhausted") ||
    detailsText.includes("free_tier") ||
    detailsText.includes("retry in")
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json();
    const messages = sanitizeMessages(payload?.messages);

    if (!messages.length) {
      return jsonResponse({ error: "messages is required" }, 400);
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.text || "";

    // Modo gratis por defecto: asistente local sin costo.
    const externalEnabled = Deno.env.get("USE_EXTERNAL_AI") === "true";
    if (!externalEnabled) {
      const local = localDiagnose(lastUserMessage);
      return jsonResponse({
        reply: local.reply,
        mode: "local_free",
        topic: local.topic,
      }, 200);
    }

    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      const local = localDiagnose(lastUserMessage);
      return jsonResponse({
        reply: local.reply,
        mode: "local_no_api_key",
        topic: local.topic,
      }, 200);
    }

    const systemPrompt = buildSystemPrompt();
    const transcript = messages
      .map((m) => `${m.role === "assistant" ? "Asistente" : "Usuario"}: ${m.text}`)
      .join("\n");

    const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
    let lastGeminiError: unknown = null;

    for (const model of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const geminiResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nConversacion:\n${transcript}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: 350,
          },
        }),
      });

      const geminiJson = await geminiResponse.json();

      if (geminiResponse.ok) {
        const text =
          geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No pude generar respuesta en este momento. Intenta de nuevo.";

        return jsonResponse({ reply: text.trim(), mode: "gemini", model }, 200);
      }

      lastGeminiError = geminiJson;

      // Si es cuota, intenta el siguiente modelo.
      if (isQuotaIssue(geminiJson)) {
        continue;
      }

      // Si no es cuota, devolvemos error para visibilidad.
      return jsonResponse({
        error: "Gemini request failed",
        details: geminiJson,
      }, 502);
    }

    // Si todos los modelos fallaron por cuota/rate limit, usar fallback local.
    return jsonResponse({
      reply: buildQuotaFallbackReply(lastUserMessage),
      mode: "fallback_quota",
      details: lastGeminiError,
    }, 200);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || String(error) }, 500);
  }
});
