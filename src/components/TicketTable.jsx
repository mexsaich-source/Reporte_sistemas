import React from 'react';
import { Plus, ListFilter } from 'lucide-react';
import { recentTickets } from '../data/mockData';

const TicketTable = () => {
    const getStatusBadge = (status) => {
        switch (status) {
            case 'Open': return <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-red-50 text-red-600 border border-red-100">Abierto</span>;
            case 'Pending': return <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-50 text-amber-600 border border-amber-100">En Proceso</span>;
            case 'Resolved': return <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">Resuelto</span>;
            default: return <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-slate-50 text-slate-600 border border-slate-200">{status}</span>;
        }
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 mt-8 overflow-hidden">
            {/* Table Header Controls */}
            <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-100/60 bg-slate-50/30">
                <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Actividad Reciente</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Últimos Tickets Registrados</p>
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
                        {recentTickets.map((ticket, index) => (
                            <tr key={ticket.id} className="group transition-all duration-300 hover:bg-slate-50/80 cursor-pointer">
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
                                <td className="p-4">{getStatusBadge(ticket.status)}</td>
                                <td className="p-4 pr-6 text-right font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                                    {ticket.date}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TicketTable;
