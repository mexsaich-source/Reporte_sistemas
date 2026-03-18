import React from 'react';
import { X, Clock, MessageSquare, Paperclip, Send } from 'lucide-react';
import { TicketStatusBadge } from './TicketsModule';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';

const TicketDetailSlider = ({ ticket, isOpen, onClose, techUsers = [], onUpdateTicket }) => {
    const { profile, user } = useAuth();
    const isTechOrAdmin = profile?.role === 'admin' || profile?.role === 'tech' || profile?.role === 'técnico';
    
    const [messages, setMessages] = React.useState([]);
    const [newMessage, setNewMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const messagesEndRef = React.useRef(null);

    const ticketId = ticket?.id || ticket?.fullId;
    const isClosed = ticket?.status === 'resolved' || ticket?.status === 'closed';

    React.useEffect(() => {
        if (isOpen && ticketId) {
            fetchMessages();
            // Subscribe to real-time changes
            const channel = supabase
                .channel(`messages_${ticketId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ticket_messages',
                    filter: `ticket_id=eq.${ticketId}`
                }, (payload) => {
                    // Re-fetch to get user details, or just append
                    fetchMessages();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            setMessages([]);
        }
    }, [isOpen, ticketId]);

    React.useEffect(() => {
        // Scroll to bottom when messages update
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('ticket_messages')
                .select(`
                    id,
                    message,
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
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !ticketId || isClosed) return;
        setIsSending(true);
        try {
            const { error } = await supabase
                .from('ticket_messages')
                .insert([{
                    ticket_id: ticketId,
                    sender_id: user.id,
                    message: newMessage.trim()
                }]);
            
            if (error) throw error;
            setNewMessage('');
            
            // Auto-create notification for the other party
            const { data: ticketData } = await supabase.from('tickets').select('reported_by, assigned_tech').eq('id', ticketId).single();
            if (ticketData) {
                const recipientId = user.id === ticketData.reported_by ? ticketData.assigned_tech : ticketData.reported_by;
                if (recipientId) {
                    await supabase.from('notifications').insert([{
                        user_id: recipientId,
                        title: `Nuevo mensaje en Ticket #${ticketId}`,
                        message: `${profile?.full_name || 'Alguien'} te ha enviado un mensaje.`,
                    }]);
                }
            }

            // Automatic refetch handled by subscription or immediately
            await fetchMessages();
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
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
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Reportado por</span>
                            <span className="text-slate-900 dark:text-slate-200 font-semibold">{ticket?.reportedBy}</span>
                        </div>
                        
                        {isTechOrAdmin && (
                            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Asignar Técnico</span>
                                <select 
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200"
                                    value={techUsers.find(u => u.full_name === ticket?.tech)?.id || ''}
                                    onChange={(e) => onUpdateTicket(ticket.fullId, { assigned_tech: e.target.value })}
                                >
                                    <option value="">Sin Asignar</option>
                                    {techUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isTechOrAdmin && (
                            <div className="flex flex-col gap-2 mt-4">
                                <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Cambiar Estado</span>
                                <select 
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200"
                                    value={ticket?.status || 'open'}
                                    onChange={(e) => onUpdateTicket(ticket.fullId, { status: e.target.value })}
                                >
                                    <option value="open">Abierto</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="resolved">Resuelto</option>
                                </select>
                            </div>
                        )}

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

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {messages.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-8">No hay mensajes aún.</p>
                            ) : (
                                messages.map(msg => {
                                    const isMine = msg.sender_id === user?.id;
                                    const senderName = msg.profiles?.full_name || 'Usuario';
                                    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    if (isMine) {
                                        return (
                                            <div key={msg.id} className="bg-blue-600 text-white border border-blue-500 p-4 rounded-2xl shadow-sm rounded-tr-none ml-8 relative before:absolute before:content-[''] before:right-[-6px] before:top-4 before:w-3 before:h-3 before:bg-blue-600 before:border-r before:border-t before:border-blue-500 before:rotate-45 transition-colors">
                                                <p className="text-white text-sm whitespace-pre-wrap">{msg.message}</p>
                                                <span className="text-[10px] text-blue-200 font-bold mt-2 block w-full text-right">{time} - Tú</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div key={msg.id} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm rounded-tl-none mr-8 relative before:absolute before:content-[''] before:left-[-6px] before:top-4 before:w-3 before:h-3 before:bg-slate-100 dark:before:bg-slate-800 before:border-l before:border-b before:border-slate-200 dark:before:border-slate-700 before:rotate-45 transition-colors">
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
                        <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-slate-700">
                            Ticket cerrado. El chat está deshabilitado.
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all">
                            <button className="text-slate-400 p-2.5 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all" disabled={isSending}>
                                <Paperclip size={18} />
                            </button>
                            <input 
                                type="text" 
                                placeholder="Escribe un mensaje..." 
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                disabled={isSending}
                                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 px-2" 
                            />
                            <button 
                                onClick={handleSendMessage}
                                disabled={isSending || !newMessage.trim()}
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
