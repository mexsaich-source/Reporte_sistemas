import React, { useState, useEffect } from 'react';
import { Plus, ListFilter, X, Clock, MessageSquare, Paperclip, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ticketService } from '../services/ticketService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';

// --- SUBCOMPONENTE: Badge de Estado Transversal ---
export const TicketStatusBadge = ({ status, withIcon = false, size = 'sm' }) => {
    const config = {
        open: {
            style: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-100/50 dark:border-rose-500/20 shadow-sm shadow-rose-500/5',
            icon: AlertCircle,
            label: 'Abierto'
        },
        pending: {
            style: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100/50 dark:border-amber-500/20 shadow-sm shadow-amber-500/5',
            icon: Clock,
            label: 'Pendiente'
        },
        resolved: {
            style: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100/50 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/5',
            icon: CheckCircle2,
            label: 'Resuelto'
        }
    };

    // Handle both case variations just in case
    const normalizedStatus = status ? status.toLowerCase() : 'open';
    const current = config[normalizedStatus] || config['open'];

    const Icon = current.icon;
    const isSm = size === 'sm';
    const padding = isSm ? 'px-2.5 py-1 text-xs font-medium' : 'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest';

    return (
        <span className={`inline-flex items-center gap-2 rounded-xl border ${padding} ${current.style} transition-all`}>
            {withIcon && <Icon size={isSm ? 14 : 14} className={normalizedStatus === 'open' ? 'animate-pulse' : ''} />}
            {current.label}
        </span>
    );
};

import TicketDetailSlider from './TicketDetailSlider';

// --- SUBCOMPONENTE: Formulario para Nuevo Ticket ---
const AddTicketSlider = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await onSave({ title, status: 'open', description: title });
        setLoading(false);
        if (result) {
            setTitle('');
            onClose();
        }
    };

    return (
        <React.Fragment>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in" onClick={onClose}></div>
            <div className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-500">
                <div className="p-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Nuevo Ticket</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">Reportar Falla o Requerimiento</p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción Falla / Asunto</label>
                        <textarea
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-4 rounded-2xl text-sm font-semibold text-slate-800 dark:text-slate-200 min-h-[160px] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                            placeholder="Ej. La impresora central no tiene tinta negra y al prender la PC la pantalla se queda en negro..."
                        />
                    </div>
                    <div className="pt-4 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="flex-1 py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-black shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Registrar Ticket"}
                        </button>
                    </div>
                </form>
            </div>
        </React.Fragment>
    );
};

// --- COMPONENTE EXPORTADO PRINCIPAL: Tabla de Tickets ---
const TicketsModule = () => {
    const { profile } = useAuth();
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [techUsers, setTechUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await ticketService.getAll();

            let filteredData = data;
            if (profile?.role === 'tech') {
                filteredData = data.filter(t => t.assigned_tech === profile.id);
            } else if (profile?.role === 'user') {
                filteredData = data.filter(t => t.reported_by === profile?.id);
            }

            const formatted = filteredData.map(t => ({
                id: t.id.toString(),
                shortId: t.id.toString().padStart(4, '0'),
                fullId: t.id,
                reportedBy: t.profiles?.full_name || t.profiles?.email || 'Desconocido',
                issue: t.title,
                tech: t.tech_profile?.full_name || 'Unassigned',
                assigned_tech: t.assigned_tech,
                status: t.status,
                date: new Date(t.created_at).toLocaleDateString()
            }));

            setTickets(formatted);
        } catch (err) {
            console.error("Error loading tickets:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTechUsers = async () => {
        try {
            const users = await userService.getAll();
            setTechUsers(users.filter(u => u.role === 'tech' || u.role === 'admin'));
        } catch (error) {
            console.error("Error fetching tech users:", error);
        }
    };

    const handleUpdateTicket = async (ticketId, updates) => {
        const data = await ticketService.update(ticketId, updates);
        if (data) {
            // Recargar la lista para reflejar los cambios globalmente
            await fetchTickets();
            // Si el slider está abierto, actualizamos su info visual temporalmente
            if (selectedTicket && selectedTicket.fullId === ticketId) {
                // Pequeño parche visual para que no se cierre el modal, pero se refresque localmente
                setSelectedTicket(prev => ({ 
                    ...prev, 
                    tech: updates.assigned_tech 
                        ? techUsers.find(u => u.id === updates.assigned_tech)?.full_name 
                        : prev.tech,
                    status: updates.status || prev.status
                }));
            }
        } else {
            alert('Hubo un error al actualizar el ticket.');
        }
    };

    const handleAddTicket = async (ticketData) => {
        const payload = {
            ...ticketData,
            reported_by: profile?.id
        };
        const res = await ticketService.create(payload);
        if (res) {
            fetchTickets();
        } else {
            alert('Error al crear ticket');
        }
        return res;
    };

    useEffect(() => {
        fetchTickets();
        fetchTechUsers();
    }, []);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none mt-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Table Header Controls */}
            <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Actividad Reciente</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Últimos Tickets Registrados en el Sistema</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchTickets} className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm">
                        <ListFilter size={16} />
                        Refrescar
                    </button>
                    <button 
                        onClick={() => setIsAddOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5"
                    >
                        <Plus size={18} strokeWidth={2.5} />
                        Nuevo Ticket
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                            <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Ticket ID</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Reportado Por</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Falla / Equipo</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Técnico Asignado</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado</th>
                            <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        Cargando reportes desde Supabase...
                                    </div>
                                </td>
                            </tr>
                        ) : tickets.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                    No hay reportes registrados en el sistema.
                                </td>
                            </tr>
                        ) : (
                            tickets.map((ticket) => (
                                <tr key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer">
                                    <td className="p-4 pl-6">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                                            <span className="font-bold text-slate-900 dark:text-slate-100">#{ticket.shortId}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{ticket.reportedBy}</td>
                                    <td className="p-4">
                                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{ticket.issue}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {ticket.tech !== 'Unassigned' ? (
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                                                    {ticket.tech.charAt(0)}
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-300">
                                                    ?
                                                </div>
                                            )}
                                            <span className={`font-semibold ${ticket.tech === 'Unassigned' ? 'text-slate-400 italic dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {ticket.tech === 'Unassigned' ? 'Sin Asignar' : ticket.tech}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4"><TicketStatusBadge status={ticket.status} size="lg" /></td>
                                    <td className="p-4 pr-6 text-right font-medium text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                        {ticket.date}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <TicketDetailSlider
                ticket={selectedTicket}
                isOpen={!!selectedTicket}
                onClose={() => setSelectedTicket(null)}
                techUsers={techUsers}
                onUpdateTicket={handleUpdateTicket}
            />

            <AddTicketSlider
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                onSave={handleAddTicket}
            />
        </div>
    );
};

export default TicketsModule;

