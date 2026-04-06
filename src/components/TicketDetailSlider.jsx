import React from 'react';
import { X, Clock, MessageSquare, Send, Printer, ImagePlus, Loader2 } from 'lucide-react';
import { TicketStatusBadge } from './TicketsModule';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';
import { uploadTicketChatImage } from '../services/ticketChatStorage';
import { workNotificationService } from '../services/workNotificationService';

const TicketDetailSlider = ({ ticket, isOpen, onClose, techUsers = [], onUpdateTicket }) => {
    const { profile, user } = useAuth();
    const isTechOrAdmin = profile?.role === 'admin' || profile?.role === 'tech' || profile?.role === 'técnico';

    const [messages, setMessages] = React.useState([]);
    const [messagesLoading, setMessagesLoading] = React.useState(true);
    const [newMessage, setNewMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [uploadingImage, setUploadingImage] = React.useState(false);
    const messagesEndRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    const ticketId = ticket?.id || ticket?.fullId;
    const isClosed = ticket?.status === 'resolved' || ticket?.status === 'closed';
    const isAdmin = profile?.role === 'admin';

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
                if (recipientId) {
                    await workNotificationService.createNotification(
                        recipientId,
                        `Nuevo mensaje en Ticket #${ticketId}`,
                        `${profile?.full_name || 'Alguien'} te ha enviado un mensaje.`
                    );
                }
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
                if (recipientId) {
                    await workNotificationService.createNotification(
                        recipientId,
                        `Nuevo adjunto en Ticket #${ticketId}`,
                        `${profile?.full_name || 'Alguien'} compartió una imagen en el chat.`
                    );
                }
            }
        } catch (err) {
            console.error(err);
            alert(err.message || 'Error al subir la imagen. Revisa el bucket Storage y políticas RLS.');
        } finally {
            setUploadingImage(false);
        }
    };

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
                                                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                                        <img src={msg.attachment_url} alt="" className="rounded-xl max-h-52 max-w-full object-contain border border-white/20 bg-black/10" />
                                                    </a>
                                                )}
                                                <p className="text-white text-sm whitespace-pre-wrap">{msg.message}</p>
                                                <span className="text-[10px] text-blue-200 font-bold mt-2 block w-full text-right">{time} - Tú</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div key={msg.id} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm rounded-tl-none mr-8 relative before:absolute before:content-[''] before:left-[-6px] before:top-4 before:w-3 before:h-3 before:bg-slate-100 dark:before:bg-slate-800 before:border-l before:border-b before:border-slate-200 dark:before:border-slate-700 before:rotate-45 transition-colors">
                                                {msg.attachment_url && (
                                                    <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                                                        <img src={msg.attachment_url} alt="" className="rounded-xl max-h-52 max-w-full object-contain border border-slate-200/80 dark:border-slate-600 bg-white/50 dark:bg-black/20" />
                                                    </a>
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