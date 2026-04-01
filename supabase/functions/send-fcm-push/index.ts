import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Obtener token Bearer de Google usando JWT (para FCM v1 API)
async function getFirebaseAccessToken(serviceAccount: any) {
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Payload del Webhook de Supabase (dispara cuando se inserta en 'notifications')
    const payload = await req.json();
    const notificationRecord = payload.record;

    if (!notificationRecord || !notificationRecord.user_id) {
      return new Response(JSON.stringify({ error: "No record found" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Conectar a Supabase con Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Buscar TODOS los tokens FCM del usuario (multi-dispositivo)
    let { data: tokenRows, error: dbError } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', notificationRecord.user_id)
      .eq('is_active', true);

    if (dbError) {
      console.error("Error leyendo fcm_tokens:", dbError);
    }

    const tokensFromTable = (tokenRows || []).map((r: { token: string }) => r.token).filter(Boolean);
    let targetTokens = [...new Set(tokensFromTable)];

    if (targetTokens.length === 0) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', notificationRecord.user_id)
        .maybeSingle();
      if (prof?.fcm_token) {
        targetTokens = [prof.fcm_token];
        console.log(`Usuario ${notificationRecord.user_id}: usando fcm_token de profiles (respaldo).`);
      }
    }

    if (targetTokens.length === 0) {
      console.log(`Usuario ${notificationRecord.user_id} no tiene tokens FCM. Omitiendo push.`);
      return new Response(JSON.stringify({ message: "No FCM tokens found" }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const tokenRowsForSend = targetTokens.map((token) => ({ token }));
    console.log(`Enviando push a ${targetTokens.length} dispositivo(s) para el usuario ${notificationRecord.user_id}`);

    // 4. Credenciales Firebase desde Secretos de Supabase
    const firebaseConfigStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!firebaseConfigStr) {
      console.error("FIREBASE_SERVICE_ACCOUNT no configurado");
      return new Response(JSON.stringify({ error: "Missing Firebase Service Account" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const serviceAccount = JSON.parse(firebaseConfigStr);

    // 5. Obtener Access Token OAuth de Google
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // 6. Enviar push a CADA dispositivo en paralelo
    const results = await Promise.allSettled(
      tokenRowsForSend.map(({ token }: { token: string }) => {
        const fcmMessage = {
          message: {
            token,
            notification: {
              title: notificationRecord.title || 'IT Helpdesk',
              body: notificationRecord.message || 'Nueva alerta recibida',
            },
            webpush: {
              notification: {
                icon: '/logo.svg',
                badge: '/logo.svg',
              },
              fcm_options: {
                link: '/'
              }
            },
            data: { url: "/" }
          }
        };

        return fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(fcmMessage)
        }).then(r => r.json());
      })
    );

    // Desactiva tokens obsoletos o invalidos para mejorar entregabilidad futura.
    const invalidTokenMarkers = [
      'UNREGISTERED',
      'registration-token-not-registered',
      'invalid-registration-token',
      'INVALID_ARGUMENT'
    ];

    const invalidTokens: string[] = [];
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const payload = (r as PromiseFulfilledResult<any>).value;
      const code = String(payload?.error?.status || payload?.error?.message || '');
      if (invalidTokenMarkers.some((m) => code.includes(m))) {
        invalidTokens.push(tokenRowsForSend[i].token);
      }
    });

    if (invalidTokens.length > 0) {
      const { error: deactivateErr } = await supabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .in('token', invalidTokens)
        .eq('user_id', notificationRecord.user_id);

      if (deactivateErr) {
        console.error('Error desactivando tokens invalidos:', deactivateErr);
      }
    }

    const summary = results.map((r, i) => ({
      token: tokenRowsForSend[i].token.substring(0, 20) + '...',
      status: r.status,
      result: r.status === 'fulfilled' ? (r as PromiseFulfilledResult<any>).value : (r as PromiseRejectedResult).reason
    }));

    console.log("Resumen FCM:", JSON.stringify(summary));

    return new Response(JSON.stringify({ sent: targetTokens.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Error en send-fcm-push:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
