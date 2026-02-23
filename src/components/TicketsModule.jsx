import React, { useState } from 'react';
import { Plus, ListFilter, X, Clock, MessageSquare, Paperclip, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { recentTickets } from '../data/mockData';

// --- SUBCOMPONENTE: Badge de Estado Transversal ---
export const TicketStatusBadge = ({ status, withIcon = false, size = 'sm' }) => {
    const config = {
        Open: {
            style: 'text-rose-600 bg-rose-50 border-rose-100/50 shadow-sm shadow-rose-500/5',
            icon: AlertCircle,
            label: 'Abierto'
        },
        Pending: {
            style: 'text-amber-600 bg-amber-50 border-amber-100/50 shadow-sm shadow-amber-500/5',
            icon: Clock,
            label: 'Pendiente'
        },
        Resolved: {
            style: 'text-emerald-600 bg-emerald-50 border-emerald-100/50 shadow-sm shadow-emerald-500/5',
            icon: CheckCircle2,
            label: 'Resuelto'
        }
    };

    const current = config[status] || {
        style: 'text-slate-500 bg-slate-50 border-slate-100',
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

// --- SUBCOMPONENTE: Slider Lateral Extraíble ---
const TicketDetailSlider = ({ ticket, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalle de Ticket</span>
                        <h2 className="text-xl font-black text-slate-900">{ticket?.id}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 text-sm">
                    <div className="space-y-4">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">{ticket?.issue}</h3>
                        <div className="flex items-center gap-3">
                            <TicketStatusBadge status={ticket?.status} size="lg" withIcon />
                            <span className="text-slate-400 font-medium flex items-center gap-1"><Clock size={14} /> {ticket?.date}</span>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Reportado por</span>
                            <span className="text-slate-900 font-semibold">{ticket?.reportedBy}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Técnico Asignado</span>
                            <span className="text-indigo-600 font-bold">{ticket?.tech}</span>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <MessageSquare size={14} className="text-blue-500" /> Historial de notas
                        </h4>

                        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm rounded-tr-none ml-8 relative before:absolute before:content-[''] before:right-[-6px] before:top-4 before:w-3 before:h-3 before:bg-white before:border-r before:border-t before:border-slate-100 before:rotate-45">
                            <p className="text-slate-600">Por favor, adjunta una captura del error que aparece al arrancar el equipo.</p>
                            <span className="text-[10px] text-slate-400 font-bold mt-2 block w-full text-right">Ayer, 14:30 - {ticket?.tech}</span>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl shadow-sm rounded-tl-none mr-8 relative before:absolute before:content-[''] before:left-[-6px] before:top-4 before:w-3 before:h-3 before:bg-blue-50 before:border-l before:border-b before:border-blue-100 before:rotate-45">
                            <p className="text-slate-800">Claro, enseguida lo subo. La pantalla se queda en negro.</p>
                            <span className="text-[10px] text-blue-400 font-bold mt-2 block">Hoy, 09:15 - {ticket?.reportedBy}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
                        <button className="text-slate-400 p-2.5 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                            <Paperclip size={18} />
                        </button>
                        <input type="text" placeholder="Escribe una nota..." className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 font-medium placeholder:text-slate-400" />
                        <button className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-black hover:shadow-black/20 transition-all">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- COMPONENTE EXPORTADO PRINCIPAL: Tabla de Tickets ---
const TicketsModule = () => {
    const [selectedTicket, setSelectedTicket] = useState(null);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 mt-8 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Table Header Controls */}
            <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-100/60 bg-slate-50/30">
                <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Actividad Reciente</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Últimos Tickets Registrados en el Sistema</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm">
                        <ListFilter size={16} />
                        Filtrar
                    </button>
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-black text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5">
                        <Plus size={18} strokeWidth={2.5} />
                        Nuevo Ticket
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto p-4">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                            <th className="p-4 pl-6 pb-6 border-b border-slate-100/50">Ticket ID</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50">Reportado Por</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50">Falla / Equipo</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50">Técnico Asignado</th>
                            <th className="p-4 pb-6 border-b border-slate-100/50">Estado</th>
                            <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 text-right">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {recentTickets.map((ticket) => (
                            <tr key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="group transition-all duration-300 hover:bg-slate-50/80 cursor-pointer">
                                <td className="p-4 pl-6">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-colors">
                                        <span className="font-bold text-slate-900">{ticket.id}</span>
                                    </div>
                                </td>
                                <td className="p-4 font-medium text-slate-600">{ticket.reportedBy}</td>
                                <td className="p-4">
                                    <span className="text-slate-800 font-semibold">{ticket.issue}</span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        {ticket.tech !== 'Unassigned' ? (
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100 shadow-sm">
                                                {ticket.tech.charAt(0)}
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                            </div>
                                        )}
                                        <span className={`font-semibold ${ticket.tech === 'Unassigned' ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                                            {ticket.tech === 'Unassigned' ? 'Sin Asignar' : ticket.tech}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4"><TicketStatusBadge status={ticket.status} size="lg" /></td>
                                <td className="p-4 pr-6 text-right font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                                    {ticket.date}
                                </td>
                            </tr>
                        ))}
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
