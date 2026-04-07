import { supabase } from '../lib/supabaseClient';

const BUCKET = import.meta.env.VITE_STORAGE_TICKET_CHAT_BUCKET || 'ticket-chat';

function sanitizeName(name) {
    return String(name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 120);
}

/**
 * Sube una imagen al bucket ticket-chat/{ticketId}/...
 * Requiere bucket "ticket-chat" y políticas Storage en Supabase.
 */
export async function uploadTicketChatImage(ticketId, file) {
    if (!ticketId || !file) return { url: null, error: new Error('Datos inválidos') };
    const path = `${String(ticketId)}/${Date.now()}_${sanitizeName(file.name)}`;

    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
    });

    if (error) return { url: null, error };

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return { url: pub?.publicUrl || null, path: data.path, error: null };
}

export async function deleteAllTicketChatFiles(ticketId) {
    const prefix = String(ticketId);
    const { data: list, error: listErr } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (listErr) {
        if (import.meta.env.DEV) console.warn('ticketChatStorage list:', listErr.message);
        return false;
    }
    if (!list?.length) return true;
    const paths = list.map((f) => `${prefix}/${f.name}`);
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) {
        if (import.meta.env.DEV) console.warn('ticketChatStorage remove:', error.message);
        return false;
    }
    return true;
}

function extractStoragePathFromPublicUrl(fileUrl) {
    const raw = String(fileUrl || '').trim();
    if (!raw) return null;
    const marker = `/object/public/${BUCKET}/`;
    const idx = raw.indexOf(marker);
    if (idx === -1) return null;
    const path = raw.slice(idx + marker.length).split('?')[0];
    if (!path) return null;
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}

export async function deleteTicketChatFileByUrl(ticketId, fileUrl) {
    const path = extractStoragePathFromPublicUrl(fileUrl);
    if (!path) return false;

    const prefix = `${String(ticketId || '').trim()}/`;
    if (prefix !== '/' && !path.startsWith(prefix)) return false;

    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    return !error;
}

export { BUCKET as TICKET_CHAT_BUCKET };
