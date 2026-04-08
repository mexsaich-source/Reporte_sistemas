import React from 'react';
import { X, Clock, MessageSquare, Send, Printer, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { TicketStatusBadge } from './TicketsModule';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';
import { uploadTicketChatImage, deleteTicketChatFileByUrl } from '../services/ticketChatStorage';
import { workNotificationService } from '../services/workNotificationService';

const TicketDetailSlider = ({ ticket, isOpen, onClose, techUsers = [], onUpdateTicket }) => {
    const { profile, user } = useAuth();
    const isTechOrAdmin = profile?.role === 'admin' || profile?.role === 'tech' || profile?.role === 'técnico';
    const isMaintenanceTech = () => {
        const dept = String(ticket?.tech_department || '').trim().toLowerCase();
        return dept.includes('mantenimiento') || dept.includes('ingenieria') || dept.includes('ingeniería');
    };

    const [messages, setMessages] = React.useState([]);
    const [messagesLoading, setMessagesLoading] = React.useState(true);
    const [newMessage, setNewMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [uploadingImage, setUploadingImage] = React.useState(false);
    const [deletingAttachmentId, setDeletingAttachmentId] = React.useState(null);
    const [notifyingSistemas, setNotifyingSistemas] = React.useState(false);
    const messagesEndRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    const ticketId = ticket?.id || ticket?.fullId;
    const isClosed = ticket?.status === 'resolved' || ticket?.status === 'closed';
    const isAdmin = profile?.role === 'admin';

    const getITAdminRecipients = React.useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, role, department, status')
            .eq('status', true);

        return (data || [])
            .filter((p) => {
                const role = String(p?.role || '').toLowerCase().trim();
                const dept = String(p?.department || '').toLowerCase().trim();
                const isMaintArea = dept.includes('mantenimiento') || dept.includes('ingenieria') || dept.includes('ingeniería');
                const itAdminRoles = ['admin', 'jefe_it', 'jefe_area_it', 'jefe area it'];
                return itAdminRoles.includes(role) && !isMaintArea;
            })
            .map((p) => p.id)
            .filter(Boolean);
    }, []);

    const toLocalDatetimeInput = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const [scheduleDraft, setScheduleDraft] = React.useState('');

    React.useEffect(() => {
        setScheduleDraft(toLocalDatetimeInput(ticket?.scheduled_for));
    }, [ticket?.fullId, ticket?.scheduled_for, ticket?.id]);

    const systemTimes = React.useMemo(() => {
        const assigned = messages.find(m => (m?.message || '').startsWith('[STATUS_ASSIGNED]'))?.created_at || null;
        const inProgress = messages.find(m => (m?.message || '').startsWith('[STATUS_IN_PROGRESS]'))?.created_at || null;
        const resolved = messages.find(m => (m?.message || '').startsWith('[STATUS_RESOLVED]'))?.created_at || null;
        return { assigned, inProgress, resolved };
    }, [messages]);

    const renderMessageText = (raw) => {
        if (!raw) return '';
        return raw
            .replace(/^\[STATUS_ASSIGNED\]\s*/u, '')
            .replace(/^\[STATUS_IN_PROGRESS\]\s*/u, '')
            .replace(/^\[STATUS_RESOLVED\]\s*/u, '')
            .replace(/^\[STATUS_SCHEDULED\]\s*/u, '');
    };

    const isSystemMessage = (raw) => {
        if (!raw) return false;
        return (
            raw.startsWith('[STATUS_ASSIGNED]') ||
            raw.startsWith('[STATUS_IN_PROGRESS]') ||
            raw.startsWith('[STATUS_RESOLVED]') ||
            raw.startsWith('[STATUS_SCHEDULED]')
        );
    };

    const fetchMessages = React.useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('ticket_messages')
                .select(`
                    id,
                    message,
                    attachment_url,
                    created_at,
                    sender_id,
                    profiles:sender_id (full_name, role)
                `)
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setMessagesLoading(false);
        }
    }, [ticketId]);

    const mergeInsertedMessage = React.useCallback(async (row) => {
        if (!row?.id) {
            fetchMessages();
            return;
        }
        const { data, error } = await supabase
            .from('ticket_messages')
            .select(`
                id,
                message,
                attachment_url,
                created_at,
                sender_id,
                profiles:sender_id (full_name, role)
            `)
            .eq('id', row.id)
            .single();

        if (error || !data) {
            fetchMessages();
            return;
        }
        setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
        });
    }, [fetchMessages]);

    React.useEffect(() => {
        if (isOpen && ticketId) {
            setMessages([]);
            setMessagesLoading(true);
            fetchMessages();
            const channel = supabase
                .channel(`messages_${ticketId}_${Date.now()}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'ticket_messages',
                        filter: `ticket_id=eq.${ticketId}`
                    },
                    (payload) => mergeInsertedMessage(payload.new)
                )
                .subscribe((status) => {
                    if (import.meta.env.DEV && status === 'CHANNEL_ERROR') {
                        console.warn('Realtime ticket_messages: CHANNEL_ERROR (revisa publicación y RLS).');
                    }
                });

            return () => {
                supabase.removeChannel(channel);
            };
        }
        setMessages([]);
        setMessagesLoading(true);
    }, [isOpen, ticketId, fetchMessages, mergeInsertedMessage]);

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !ticketId || isClosed) return;
        setIsSending(true);
        try {
            const { data: inserted, error } = await supabase
                .from('ticket_messages')
                .insert([{
                    ticket_id: ticketId,
                    sender_id: user.id,
                    message: newMessage.trim()
                }])
                .select('id')
                .single();

            if (error) throw error;
            setNewMessage('');
            await mergeInsertedMessage(inserted);

            const { data: ticketData } = await supabase.from('tickets').select('reported_by, assigned_tech').eq('id', ticketId).single();
            if (ticketData) {
                const recipientId = user.id === ticketData.reported_by ? ticketData.assigned_tech : ticketData.reported_by;
                const itAdmins = await getITAdminRecipients();
                const recipients = new Set([...(itAdmins || [])]);
                if (recipientId) recipients.add(recipientId);
                recipients.delete(user.id);

                await Promise.all(
                    [...recipients].map((recipient) =>
                        workNotificationService.createNotification(
                            recipient,
                            `Nuevo mensaje en Ticket #${ticketId}`,
                            `${profile?.full_name || 'Alguien'} te ha enviado un mensaje.`
                        )
                    )
                );
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    const handleChatImageSelect = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !ticketId || isClosed || !user?.id) return;
        if (!file.type.startsWith('image/')) {
            alert('Solo se permiten imágenes.');
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            alert('La imagen no debe superar 4 MB.');
            return;
        }
        setUploadingImage(true);
        try {
            const { url, error: upErr } = await uploadTicketChatImage(ticketId, file);
            if (upErr || !url) throw upErr || new Error('No se pudo subir la imagen.');

            const caption = newMessage.trim() || '(Imagen adjunta)';
            const { data: inserted, error } = await supabase
                .from('ticket_messages')
                .insert([{
                    ticket_id: ticketId,
                    sender_id: user.id,
                    message: caption,
                    attachment_url: url,
                }])
                .select('id')
                .single();

            if (error) throw error;
            setNewMessage('');
            await mergeInsertedMessage(inserted);

            const { data: ticketData } = await supabase.from('tickets').select('reported_by, assigned_tech').eq('id', ticketId).single();
            if (ticketData) {
                const recipientId = user.id === ticketData.reported_by ? ticketData.assigned_tech : ticketData.reported_by;
                const itAdmins = await getITAdminRecipients();
                const recipients = new Set([...(itAdmins || [])]);
                if (recipientId) recipients.add(recipientId);
                recipients.delete(user.id);

                await Promise.all(
                    [...recipients].map((recipient) =>
                        workNotificationService.createNotification(
                            recipient,
                            `Nuevo adjunto en Ticket #${ticketId}`,
                            `${profile?.full_name || 'Alguien'} compartió una imagen en el chat.`
                        )
                    )
                );
            }
        } catch (err) {
            console.error(err);
            alert(err.message || 'Error al subir la imagen. Revisa el bucket Storage y políticas RLS.');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleDeleteAttachment = async (msg) => {
        if (!isAdmin || !msg?.attachment_url || !ticketId) return;
        const ok = window.confirm('¿Eliminar este adjunto del chat? Esta acción no se puede deshacer.');
        if (!ok) return;

        setDeletingAttachmentId(msg.id);
        try {
            await deleteTicketChatFileByUrl(ticketId, msg.attachment_url);

            const previous = String(msg.message || '').trim();
            const nextMessage = previous && previous !== '(Imagen adjunta)'
                ? previous
                : 'Adjunto eliminado por administrador.';

            const { error } = await supabase
                .from('ticket_messages')
                .update({
                    attachment_url: null,
                    message: nextMessage,
                })
                .eq('id', msg.id);

            if (error) throw error;

            setMessages((prev) => prev.map((m) => (
                m.id === msg.id
                    ? { ...m, attachment_url: null, message: nextMessage }
                    : m
            )));
        } catch (err) {
            console.error('Error deleting attachment:', err);
            alert('No se pudo eliminar el adjunto. Revisa permisos de Storage y RLS de ticket_messages.');
        } finally {
            setDeletingAttachmentId(null);
        }
    };

    // ==========================================
    // FUNCIÓN: Notificar a Sistemas IT sobre un ticket de Ing/Mant
    // ==========================================
    const handleNotifySistemas = async () => {
        if (notifyingSistemas) return;
        setNotifyingSistemas(true);
        try {
            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('id, role, department, status')
                .eq('status', true);

            const itRecipients = (allProfiles || []).filter((p) => {
                const role = String(p?.role || '').toLowerCase().trim();
                const dept = String(p?.department || '').toLowerCase().trim();
                const isMaint = dept.includes('mantenimiento') || dept.includes('ingenieria') || dept.includes('ingeniería');
                return (role === 'admin' || role === 'tech' || role === 'técnico') && !isMaint;
            }).map((p) => p.id).filter(Boolean);

            await Promise.all(
                itRecipients.map((id) =>
                    workNotificationService.createNotification(
                        id,
                        `Ticket Ing/Mant #${ticket?.shortId} — Notificación`,
                        `El ticket "${ticket?.issue || `#${ticket?.shortId}`}" asignado a ${ticket?.tech || 'un técnico'} de ${ticket?.tech_department || 'Mantenimiento/Ingeniería'} requiere atención de Sistemas IT.`
                    )
                )
            );
            alert(`Sistemas IT notificado (${itRecipients.length} destinatario${itRecipients.length !== 1 ? 's' : ''}).`);
        } catch (err) {
            console.error('Error notificando a Sistemas:', err);
            alert('No se pudo enviar la notificación. Intenta de nuevo.');
        } finally {
            setNotifyingSistemas(false);
        }
    };
    // ==========================================

    // ==========================================
    // FUNCIÓN: Orden de Trabajo (ticket asignado)
    // ==========================================
    const handlePrintWorkOrder = () => {
        const printDate = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
        const scheduledStr = ticket?.scheduled_for
            ? new Date(ticket.scheduled_for).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
            : '—';
        const statusLabel = {
            assigned: 'ASIGNADO',
            in_progress: 'EN PROCESO',
            open: 'PENDIENTE',
            pending_admin: 'PENDIENTE',
        }[ticket?.status] || ticket?.status?.toUpperCase() || 'ASIGNADO';

        const workOrderHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8"/>
    <title>Orden de Trabajo #${ticket?.shortId || ticket?.id}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            color: #111;
            background: #fff;
            padding: 20px;
        }
        .page { max-width: 720px; margin: 0 auto; }
        /* HEADER */
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 14px; }
        .header-left .brand { font-size: 18pt; font-weight: 900; letter-spacing: -1px; }
        .header-left .sub { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; color: #555; margin-top: 3px; }
        .header-right { text-align: right; }
        .folio-box { border: 2px solid #111; display: inline-block; padding: 6px 18px; border-radius: 6px; }
        .folio-box .folio-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 2px; color: #666; }
        .folio-box .folio-num { font-size: 20pt; font-weight: 900; letter-spacing: -1px; }
        .doc-type { font-size: 8pt; text-transform: uppercase; letter-spacing: 3px; color: #555; margin-top: 6px; }
        /* SECTION */
        .section { margin-bottom: 12px; }
        .section-title { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #fff; background: #111; padding: 4px 10px; display: inline-block; border-radius: 3px; margin-bottom: 8px; }
        /* GRID */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .field { }
        .field-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #666; font-weight: 700; margin-bottom: 3px; }
        .field-value { font-size: 10.5pt; font-weight: 700; border-bottom: 1.5px solid #ccc; padding-bottom: 4px; min-height: 22px; }
        /* ISSUE BOX */
        .issue-box { border: 1.5px solid #111; border-radius: 6px; padding: 10px 14px; min-height: 60px; font-size: 10.5pt; background: #f9f9f9; line-height: 1.5; }
        /* STATUS BADGE */
        .status-badge { display: inline-block; border: 2px solid #111; padding: 4px 14px; border-radius: 99px; font-size: 8.5pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; }
        /* TASKS */
        .task-line { display: flex; align-items: flex-start; gap: 10px; padding: 5px 0; border-bottom: 1px dashed #ddd; }
        .task-num { font-size: 9pt; font-weight: 900; min-width: 20px; color: #555; padding-top: 1px; }
        .task-check { width: 14px; height: 14px; border: 2px solid #111; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }
        .task-write { flex: 1; border-bottom: 1px solid #bbb; min-height: 18px; }
        /* NOTES */
        .notes-lines { border: 1.5px solid #ccc; border-radius: 6px; padding: 8px; }
        .note-line { border-bottom: 1px solid #e0e0e0; height: 20px; margin-bottom: 2px; }
        /* SIGNATURES */
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 10px; }
        .sig-box { text-align: center; }
        .sig-line { border-top: 2px solid #111; margin-top: 50px; padding-top: 6px; }
        .sig-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: #555; font-weight: 700; }
        .sig-sub { font-size: 7.5pt; color: #888; margin-top: 2px; }
        /* FOOTER */
        .footer { margin-top: 14px; border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; }
        .footer-left { font-size: 7pt; color: #888; }
        .barcode { font-family: 'Libre Barcode 39', 'Free 3 of 9', monospace; font-size: 36pt; line-height: 1; }
        @media print {
            body { padding: 10px; }
            @page { margin: 15mm; size: A4 portrait; }
        }
    </style>
</head>
<body>
<div class="page">

    <!-- HEADER -->
    <div class="header">
        <div class="header-left">
            <div class="brand">IT HELPDESK</div>
            <div class="sub">Hotel Hilton Mexico City Santa Fe</div>
        </div>
        <div class="header-right">
            <div class="folio-box">
                <div class="folio-label">Folio</div>
                <div class="folio-num">#${ticket?.shortId || String(ticket?.id || '').padStart(4, '0')}</div>
            </div>
            <div class="doc-type">Orden de Trabajo</div>
        </div>
    </div>

    <!-- DATOS GENERALES -->
    <div class="section">
        <div class="section-title">Datos Generales</div>
        <div class="grid-3">
            <div class="field">
                <div class="field-label">Fecha emisión</div>
                <div class="field-value">${printDate}</div>
            </div>
            <div class="field">
                <div class="field-label">Fecha atención programada</div>
                <div class="field-value">${scheduledStr}</div>
            </div>
            <div class="field">
                <div class="field-label">Estado</div>
                <div class="field-value"><span class="status-badge">${statusLabel}</span></div>
            </div>
        </div>
    </div>

    <!-- PERSONAS -->
    <div class="section">
        <div class="section-title">Involucrados</div>
        <div class="grid-2">
            <div class="field">
                <div class="field-label">Reportado por</div>
                <div class="field-value">${ticket?.reportedBy || '—'}</div>
            </div>
            <div class="field">
                <div class="field-label">Técnico asignado</div>
                <div class="field-value">${ticket?.tech || '—'}</div>
            </div>
        </div>
    </div>

    <!-- DESCRIPCIÓN -->
    <div class="section">
        <div class="section-title">Descripción del Requerimiento / Falla</div>
        <div class="issue-box">${ticket?.issue || 'Sin descripción'}</div>
    </div>

    <!-- TAREAS -->
    <div class="section">
        <div class="section-title">Tareas a Realizar (llenar en papel)</div>
        ${[1,2,3,4,5,6].map(n => `
        <div class="task-line">
            <span class="task-num">${n}.</span>
            <div class="task-check"></div>
            <div class="task-write"></div>
        </div>`).join('')}
    </div>

    <!-- NOTAS -->
    <div class="section">
        <div class="section-title">Observaciones / Notas del Técnico</div>
        <div class="notes-lines">
            ${[1,2,3].map(() => '<div class="note-line"></div>').join('')}
        </div>
    </div>

    <!-- FIRMAS -->
    <div class="section">
        <div class="section-title">Firmas</div>
        <div class="sig-grid">
            <div class="sig-box">
                <div class="sig-line"></div>
                <div class="sig-label">Firma Técnico Responsable</div>
                <div class="sig-sub">${ticket?.tech || 'Asignado'}</div>
            </div>
            <div class="sig-box">
                <div class="sig-line"></div>
                <div class="sig-label">Firma Vo. Bo. Gerente / Supervisor</div>
                <div class="sig-sub">IT Helpdesk Mexsa</div>
            </div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        <div class="footer-left">
            Sistema IT Helpdesk — Hotel Hilton Mexico City Santa Fe<br/>
            Impreso el ${printDate} | Solo para uso interno
        </div>
        <div class="barcode">*${ticket?.shortId || String(ticket?.id || '').padStart(4, '0')}*</div>
    </div>

</div>
<script>
    window.onload = () => {
        let link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        setTimeout(() => { window.print(); setTimeout(() => window.close(), 600); }, 800);
    };
</script>
</body>
</html>`;

        const w = window.open('', '_blank', 'width=800,height=960');
        if (w) { w.document.write(workOrderHTML); w.document.close(); }
    };
    // ==========================================

    // ==========================================
    // FUNCIÓN: Ticket IT asignado (comprobante térmico de asignación)
    // ==========================================
    const handlePrintITTicket = () => {
        const printDate = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
        const reporterName = ticket?.reportedBy || 'Desconocido';
        const techName = ticket?.tech || 'Técnico Asignado';
        const scheduledStr = ticket?.scheduled_for
            ? new Date(ticket.scheduled_for).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })
            : '—';
        const statusLabel = ticket?.status === 'in_progress' ? 'EN PROCESO' : 'ASIGNADO';
        const statusColor = ticket?.status === 'in_progress' ? '#d97706' : '#2563eb';

        const receiptHTML = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Ticket IT #${ticket?.shortId || ticket?.id?.toString().substring(0, 8)}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
                        body {
                            font-family: 'Courier Prime', 'Courier New', monospace;
                            width: 380px;
                            margin: 0 auto;
                            padding: 30px 20px;
                            color: #1a1a1a;
                            font-size: 14px;
                            line-height: 1.5;
                            background-color: #fff;
                        }
                        .ticket-container {
                            border: 2px dashed #d1d5db;
                            border-radius: 16px;
                            padding: 24px;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        }
                        .header { text-align: center; margin-bottom: 24px; }
                        .logo { font-size: 28px; font-weight: 700; letter-spacing: -1px; margin-bottom: 4px; }
                        .subtitle { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; }
                        .divider { border-top: 1px dashed #d1d5db; margin: 20px 0; }
                        .row { display: flex; justify-content: space-between; margin: 8px 0; align-items: baseline; }
                        .label { font-weight: 700; color: #4b5563; font-size: 12px; text-transform: uppercase; }
                        .value { font-weight: 700; font-size: 14px; text-align: right; }
                        .badge { background: #111827; color: white; padding: 4px 12px; border-radius: 99px; font-size: 12px; }
                        .content-box { margin: 24px 0; background: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6; }
                        .content-box .label { margin-bottom: 8px; display: block; color: #111827; }
                        .data-text { font-size: 14px; color: #374151; font-weight: 400; }
                        .person-row { display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
                        .person-row:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
                        .person-title { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
                        .person-name { font-weight: 700; font-size: 14px; }
                        .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #6b7280; }
                        .barcode { margin-top: 16px; text-align: center; font-family: 'Libre Barcode 39', cursive; font-size: 48px; }
                        @media print {
                            body { width: 100%; padding: 0; background: white; }
                            .ticket-container { border: none; box-shadow: none; padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="ticket-container">
                        <div class="header">
                            <div class="logo">IT HELPDESK</div>
                            <div class="subtitle">Ticket de Servicio IT</div>
                        </div>

                        <div class="row" style="margin-top: 24px;">
                            <span class="label">No. Folio:</span>
                            <span class="badge">#${ticket?.shortId || ticket?.id?.toString().substring(0, 8)}</span>
                        </div>
                        <div class="row">
                            <span class="label">Fecha Asignación:</span>
                            <span class="value">${printDate}</span>
                        </div>
                        <div class="row">
                            <span class="label">Fecha Atención:</span>
                            <span class="value">${scheduledStr}</span>
                        </div>
                        <div class="row">
                            <span class="label">Estado:</span>
                            <span class="value" style="color: ${statusColor};">${statusLabel}</span>
                        </div>

                        <div class="divider"></div>

                        <div class="content-box">
                            <span class="label">Detalle del Requerimiento:</span>
                            <div class="data-text">${ticket?.issue || 'Sin descripción'}</div>
                        </div>

                        <div class="divider"></div>

                        <div class="person-row">
                            <div>
                                <div class="person-title">Reportado por</div>
                                <div class="person-name">${reporterName}</div>
                            </div>
                        </div>

                        <div class="person-row">
                            <div>
                                <div class="person-title">Técnico Asignado</div>
                                <div class="person-name">${techName}</div>
                            </div>
                        </div>

                        <div class="divider"></div>

                        <div class="footer">
                            <p style="margin-bottom: 4px; font-weight: 700; color: #111827;">Ticket en Atención</p>
                            <p>Este comprobante acredita la asignación del requerimiento al técnico de IT.</p>
                            <div class="barcode">*${ticket?.shortId || ticket?.id?.toString().substring(0, 8)}*</div>
                        </div>
                    </div>

                    <script>
                        window.onload = () => {
                            let link = document.createElement('link');
                            link.href = 'https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap';
                            link.rel = 'stylesheet';
                            document.head.appendChild(link);
                            setTimeout(() => {
                                window.print();
                                setTimeout(() => window.close(), 500);
                            }, 800);
                        }
                    </script>
                </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=450,height=800');
        if (printWindow) {
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
        }
    };
    // ==========================================

    // ==========================================
    // NUEVA FUNCIÓN: Generador de Recibo Térmico
    // ==========================================
    const handleDownloadReceipt = () => {
        const printDate = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
        const reporterName = ticket?.reportedBy || "Desconocido";
        const techName = ticket?.tech || "Técnico Asignado";

        const receiptHTML = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Comprobante Ticket #${ticket?.shortId || ticket?.id?.toString().substring(0, 8)}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
                        body {
                            font-family: 'Courier Prime', 'Courier New', monospace;
                            width: 380px;
                            margin: 0 auto;
                            padding: 30px 20px;
                            color: #1a1a1a;
                            font-size: 14px;
                            line-height: 1.5;
                            background-color: #fff;
                        }
                        .ticket-container {
                            border: 2px dashed #d1d5db;
                            border-radius: 16px;
                            padding: 24px;
                            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        }
                        .header { text-align: center; margin-bottom: 24px; }
                        .logo { font-size: 28px; font-weight: 700; letter-spacing: -1px; margin-bottom: 4px; }
                        .subtitle { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; }
                        .divider { border-top: 1px dashed #d1d5db; margin: 20px 0; }
                        .row { display: flex; justify-content: space-between; margin: 8px 0; align-items: baseline; }
                        .label { font-weight: 700; color: #4b5563; font-size: 12px; text-transform: uppercase; }
                        .value { font-weight: 700; font-size: 14px; text-align: right; }
                        .badge { background: #111827; color: white; padding: 4px 12px; border-radius: 99px; font-size: 12px; }
                        .content-box { margin: 24px 0; background: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6; }
                        .content-box .label { margin-bottom: 8px; display: block; color: #111827; }
                        .data-text { font-size: 14px; color: #374151; font-weight: 400; }
                        .person-row { display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
                        .person-row:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
                        .person-title { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
                        .person-name { font-weight: 700; font-size: 14px; }
                        .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #6b7280; }
                        .barcode { margin-top: 16px; text-align: center; font-family: 'Libre Barcode 39', cursive; font-size: 48px; }
                        @media print {
                            body { width: 100%; padding: 0; background: white; }
                            .ticket-container { border: none; box-shadow: none; padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="ticket-container">
                        <div class="header">
                            <div class="logo">IT HELPDESK</div>
                            <div class="subtitle">Comprobante de Servicio</div>
                        </div>
                        
                        <div class="row" style="margin-top: 24px;">
                            <span class="label">No. Folio:</span>
                            <span class="badge">#${ticket?.shortId || ticket?.id?.toString().substring(0, 8)}</span>
                        </div>
                        <div class="row">
                            <span class="label">Fecha Solución:</span>
                            <span class="value">${printDate}</span>
                        </div>
                        <div class="row">
                            <span class="label">Estado Actual:</span>
                            <span class="value" style="color: #059669;">RESUELTO</span>
                        </div>

                        <div class="divider"></div>
                        
                        <div class="content-box">
                            <span class="label">Detalle del Requerimiento:</span>
                            <div class="data-text">${ticket?.issue || 'Sin descripción'}</div>
                        </div>

                        <div class="divider"></div>

                        <div class="person-row">
                            <div>
                                <div class="person-title">Reportado por</div>
                                <div class="person-name">${reporterName}</div>
                            </div>
                        </div>

                        <div class="person-row">
                            <div>
                                <div class="person-title">Atendido y Solucionado por</div>
                                <div class="person-name">${techName}</div>
                            </div>
                        </div>

                        <div class="divider"></div>
                        
                        <div class="footer">
                            <p style="margin-bottom: 4px; font-weight: 700; color: #111827;">¡Ticket Cerrado!</p>
                            <p>Este comprobante certifica la atención y solución del requerimiento técnico.</p>
                            <div class="barcode">*${ticket?.shortId || ticket?.id?.toString().substring(0, 8)}*</div>
                        </div>
                    </div>

                    <script>
                        window.onload = () => { 
                            let link = document.createElement('link');
                            link.href = 'https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap';
                            link.rel = 'stylesheet';
                            document.head.appendChild(link);
                            
                            setTimeout(() => {
                                window.print(); 
                                setTimeout(() => window.close(), 500); 
                            }, 800);
                        }
                    </script>
                </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=450,height=800');
        if (printWindow) {
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
        }
    };
    // ==========================================

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[500] transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-[510] flex flex-col animate-in slide-in-from-right duration-300`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalle de Ticket</span>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{ticket?.id}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 text-sm">
                    <div className="space-y-4">
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{ticket?.issue}</h3>
                        <div className="flex items-center gap-3">
                            <TicketStatusBadge status={ticket?.status} size="lg" withIcon />
                            <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1"><Clock size={14} /> {ticket?.date}</span>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
                                Asignado: {systemTimes.assigned ? new Date(systemTimes.assigned).toLocaleString() : '—'}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
                                Resuelto: {systemTimes.resolved ? new Date(systemTimes.resolved).toLocaleString() : '—'}
                            </div>
                            {ticket?.scheduled_for && (
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-800 px-3 py-2 rounded-xl">
                                    Atención: {new Date(ticket.scheduled_for).toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Reportado por</span>
                            <span className="text-slate-900 dark:text-slate-200 font-semibold">{ticket?.reportedBy}</span>
                        </div>

                        <div className="flex border-t border-slate-200 dark:border-slate-700 pt-6 mt-2 flex-col gap-4">
                            {isAdmin && ticket?.status === 'pending_admin' && !ticket?.assigned_tech && (
                                <button
                                    onClick={() => onUpdateTicket(ticket.fullId, { assigned_tech: user.id, status: 'assigned' }, user.id)}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                                >
                                    Tomar Ticket
                                </button>
                            )}

                            {isAdmin && (
                                <div className="space-y-2">
                                    <label className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-widest ml-1">Asignar a Técnico</label>
                                    <select
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={ticket?.assigned_tech || ''}
                                        onChange={(e) => onUpdateTicket(ticket.fullId, { assigned_tech: e.target.value, status: e.target.value ? 'assigned' : 'pending_admin' }, user.id)}
                                    >
                                        <option value="">Sin Asignar</option>
                                        {techUsers.filter(u => u.role !== 'user').map(u => (
                                            <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {isTechOrAdmin && !isClosed && (
                                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <label className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-widest ml-1">
                                        Agendar fecha de atención
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduleDraft}
                                        onChange={(e) => setScheduleDraft(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const iso = scheduleDraft
                                                    ? new Date(scheduleDraft).toISOString()
                                                    : null;
                                                onUpdateTicket(ticket.fullId, { scheduled_for: iso }, user.id);
                                            }}
                                            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-indigo-700 transition-all"
                                        >
                                            Guardar fecha
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScheduleDraft('');
                                                onUpdateTicket(ticket.fullId, { scheduled_for: null }, user.id);
                                            }}
                                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            Quitar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isTechOrAdmin && ticket?.assigned_tech && (
                                <div className="space-y-2">
                                    <label className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-widest ml-1">Estado del Ticket</label>
                                    <select
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={ticket?.status || 'pending_admin'}
                                        onChange={(e) => onUpdateTicket(ticket.fullId, { status: e.target.value }, user.id)}
                                    >
                                        <option value="pending_admin">Pendiente Admin</option>
                                        <option value="assigned">Asignado</option>
                                        <option value="in_progress">En Proceso</option>
                                        <option value="resolved">Resuelto</option>
                                    </select>
                                </div>
                            )}

                            {isAdmin && ticket?.assigned_tech && !isClosed && isMaintenanceTech() && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePrintWorkOrder}
                                        className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:border-amber-600 dark:hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all active:scale-95"
                                    >
                                        <Printer size={14} /> Imprimir Orden
                                    </button>
                                    <button
                                        onClick={handleNotifySistemas}
                                        disabled={notifyingSistemas}
                                        className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-400 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:border-violet-600 dark:hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {notifyingSistemas
                                            ? <span className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                            : <MessageSquare size={14} />
                                        }
                                        Notificar Sistemas
                                    </button>
                                </div>
                            )}
                        </div>

                        {!isTechOrAdmin && (
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Técnico Asignado</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{ticket?.tech}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 flex-1 flex flex-col min-h-[300px]">
                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <MessageSquare size={14} className="text-blue-500" /> Historial de chat
                        </h4>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[120px] transition-opacity duration-300">
                            {messagesLoading ? (
                                <div className="space-y-3 py-4 animate-pulse" aria-busy="true" aria-label="Cargando mensajes">
                                    <div className="h-14 rounded-2xl bg-slate-200/80 dark:bg-slate-700/60 ml-8" />
                                    <div className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mr-8 w-4/5" />
                                    <div className="h-14 rounded-2xl bg-slate-200/80 dark:bg-slate-700/60 ml-12 w-3/5" />
                                </div>
                            ) : messages.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-8">No hay mensajes aún.</p>
                            ) : (
                                messages.map(msg => {
                                    const isMine = msg.sender_id === user?.id;
                                    const senderName = msg.profiles?.full_name || 'Usuario';
                                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const system = isSystemMessage(msg.message);
                                    const text = renderMessageText(msg.message);

                                    if (system) {
                                        return (
                                            <div
                                                key={msg.id}
                                                className="mx-auto max-w-[90%] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-sm"
                                            >
                                                <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap font-semibold">{text}</p>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 block text-right">{time}</span>
                                            </div>
                                        );
                                    }

                                    if (isMine) {
                                        return (
                                            <div key={msg.id} className="bg-blue-600 text-white border border-blue-500 p-4 rounded-2xl shadow-sm rounded-tr-none ml-8 relative before:absolute before:content-[''] before:right-[-6px] before:top-4 before:w-3 before:h-3 before:bg-blue-600 before:border-r before:border-t before:border-blue-500 before:rotate-45 transition-colors">
                                                {msg.attachment_url && (
                                                    <div className="relative mb-2">
                                                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
                                                            <img src={msg.attachment_url} alt="" className="rounded-xl max-h-52 max-w-full object-contain border border-white/20 bg-black/10" />
                                                        </a>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteAttachment(msg)}
                                                                disabled={deletingAttachmentId === msg.id}
                                                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white disabled:opacity-50"
                                                                title="Eliminar adjunto"
                                                            >
                                                                {deletingAttachmentId === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="text-white text-sm whitespace-pre-wrap">{msg.message}</p>
                                                <span className="text-[10px] text-blue-200 font-bold mt-2 block w-full text-right">{time} - Tú</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div key={msg.id} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm rounded-tl-none mr-8 relative before:absolute before:content-[''] before:left-[-6px] before:top-4 before:w-3 before:h-3 before:bg-slate-100 dark:before:bg-slate-800 before:border-l before:border-b before:border-slate-200 dark:before:border-slate-700 before:rotate-45 transition-colors">
                                                {msg.attachment_url && (
                                                    <div className="relative mb-2">
                                                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
                                                            <img src={msg.attachment_url} alt="" className="rounded-xl max-h-52 max-w-full object-contain border border-slate-200/80 dark:border-slate-600 bg-white/50 dark:bg-black/20" />
                                                        </a>
                                                        {isAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteAttachment(msg)}
                                                                disabled={deletingAttachmentId === msg.id}
                                                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 text-white disabled:opacity-50"
                                                                title="Eliminar adjunto"
                                                            >
                                                                {deletingAttachmentId === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="text-slate-800 dark:text-slate-200 text-sm whitespace-pre-wrap">{msg.message}</p>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-2 block w-full">{time} - {senderName}</span>
                                            </div>
                                        );
                                    }
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    {isClosed ? (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDownloadReceipt}
                                className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-600 transition-all shadow-md active:scale-95"
                            >
                                <Printer size={16} /> Descargar Comprobante
                            </button>
                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-slate-700">
                                Ticket cerrado. El chat está deshabilitado.
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all">
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleChatImageSelect} />
                            <button
                                type="button"
                                className="text-slate-400 p-2.5 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all disabled:opacity-40"
                                disabled={isSending || uploadingImage}
                                title="Adjuntar imagen"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {uploadingImage ? <Loader2 size={18} className="animate-spin text-blue-500" /> : <ImagePlus size={18} />}
                            </button>
                            <input
                                type="text"
                                placeholder="Escribe un mensaje..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                disabled={isSending || uploadingImage}
                                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 px-2"
                            />
                            <button
                                type="button"
                                onClick={handleSendMessage}
                                disabled={isSending || uploadingImage || !newMessage.trim()}
                                className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSending ? <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div> : <Send size={16} />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default TicketDetailSlider;