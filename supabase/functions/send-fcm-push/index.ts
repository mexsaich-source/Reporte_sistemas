import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

// Función para obtener token Bearer de Google usando JWT en Deno
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
  try {
    // 1. Obtener payload del Webhook de Supabase
    const payload = await req.json();
    const notificationRecord = payload.record; // La fila insertada en 'notifications'

    if (!notificationRecord || !notificationRecord.user_id) {
        return new Response(JSON.stringify({ error: "No record found" }), { status: 400 });
    }

    // 2. Conectar a Supabase usando llaves internas (Edge Functions env)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Buscar el fcm_token del usuario asociado a la notificación
    const { data: profile, error: dbError } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', notificationRecord.user_id)
        .single();
    
    if (dbError || !profile || !profile.fcm_token) {
        console.log(`Usuario no tiene FCM token. Omitiendo push.`);
        return new Response("No target fcm_token", { status: 200 });
    }

    // 4. Leer Credenciales de Firebase desde los Secretos de Supabase
    const firebaseConfigStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!firebaseConfigStr) {
        console.error("FIREBASE_SERVICE_ACCOUNT nulo en env");
        return new Response("Missing Firebase Service object", { status: 500 });
    }
    const serviceAccount = JSON.parse(firebaseConfigStr);

    // 5. Cargar token de OAuth y enviar
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    const fcmMessage = {
        message: {
            token: profile.fcm_token,
            notification: {
                title: notificationRecord.title,
                body: notificationRecord.message
            },
            data: {
                url: "/"
            }
        }
    };

    const pushResponse = await fetch(fcmUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(fcmMessage)
    });

    const pushResult = await pushResponse.json();
    console.log("Push enviado con éxito:", pushResult);

    return new Response(JSON.stringify(pushResult), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Error global en el script push:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
