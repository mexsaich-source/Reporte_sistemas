import { supabase } from '../lib/supabaseClient';

export const aiAssistantService = {
  async ask(messages = []) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Falta configuracion de Supabase en variables de entorno');
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('No se pudo leer la sesion para el asistente:', sessionError.message || sessionError);
    }

    const headers = {
      apikey: anonKey,
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/chat-assistant`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      let detail =
        body?.details?.error?.message ||
        body?.details?.message ||
        body?.error ||
        `Edge Function HTTP ${response.status}`;

      if (String(detail).toLowerCase().includes('api key expired')) {
        throw new Error('La clave de Google AI expiro. Actualiza GOOGLE_AI_API_KEY en Supabase Secrets.');
      }

      throw new Error(detail);
    }

    const data = body;
    if (!data?.reply) throw new Error('No response from assistant');

    return data.reply;
  },
};
