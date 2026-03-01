import React, { useState, useEffect } from 'react';
import { Plus, ListFilter, X, Clock, MessageSquare, Paperclip, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// --- SUBCOMPONENTE: Badge de Estado Transversal ---
export const TicketStatusBadge = ({ status, withIcon = false, size = 'sm' }) => {
    const config = {
        Open: {
            style: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-100/50 dark:border-rose-500/20 shadow-sm shadow-rose-500/5',
            icon: AlertCircle,
            label: 'Abierto'
        },
        Pending: {
            style: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100/50 dark:border-amber-500/20 shadow-sm shadow-amber-500/5',
            icon: Clock,
            label: 'Pendiente'
        },
        Resolved: {
            style: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100/50 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/5',
            icon: CheckCircle2,
            label: 'Resuelto'
        }
    };

    const current = config[status] || {
        style: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700',
        icon: AlertCircle,
        label: status
    };

    const Icon = current.icon;
    const isSm = size === 'sm';
    const padding = isSm ? 'px-2.5 py-1 text-xs font-medium' : 'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest';

    return (
        <span className={`inline-flex items-center gap-2 rounded-xl border ${padding} ${current.style} transition-all`}>
            {withIcon && <Icon size={isSm ? 14 : 14} className={status === 'Open' ? 'animate-pulse' : ''} />}
            {current.label}
        </span>
    );
};

import TicketDetailSlider from './TicketDetailSlider';

// --- COMPONENTE EXPORTADO PRINCIPAL: Tabla de Tickets ---
const TicketsModule = () => {
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select(`
                    *,
                    profiles:user_id (full_name, email)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formatted = data.map(t => ({
                id: t.id.substring(0, 8).toUpperCase(),
                fullId: t.id,
                reportedBy: t.profiles?.full_name || t.profiles?.email || 'Desconocido',
                issue: t.title,
                tech: t.assigned_to ? 'Técnico Asignado' : 'Unassigned',
                status: t.status,
                date: new Date(t.created_at).toLocaleDateString()
            }));

            setTickets(formatted);
        } catch (err) {
            console.error("Error fetching admin tickets:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
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
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5">
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
                                <tr key={ticket.fullId || ticket.id} onClick={() => setSelectedTicket(ticket)} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer">
                                    <td className="p-4 pl-6">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                                            <span className="font-bold text-slate-900 dark:text-slate-100">{ticket.id}</span>
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
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
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
            />
        </div>
    );
};

export default TicketsModule;
