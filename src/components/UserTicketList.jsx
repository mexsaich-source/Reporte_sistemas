import React from 'react';
import { ChevronRight, Clock, CheckCircle2, AlertCircle, Hash } from 'lucide-react';
import { recentTickets } from '../data/mockData';

const UserTicketList = () => {
    const getStatusStyle = (status) => {
        switch (status) {
            case 'Open': return 'text-rose-600 bg-rose-50 border-rose-100/50 shadow-sm shadow-rose-500/5';
            case 'Pending': return 'text-amber-600 bg-amber-50 border-amber-100/50 shadow-sm shadow-amber-500/5';
            case 'Resolved': return 'text-emerald-600 bg-emerald-50 border-emerald-100/50 shadow-sm shadow-emerald-500/5';
            default: return 'text-slate-500 bg-slate-50 border-slate-100';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Open': return <AlertCircle size={14} className="animate-pulse" />;
            case 'Pending': return <Clock size={14} />;
            case 'Resolved': return <CheckCircle2 size={14} />;
            default: return null;
        }
    };

    // Simulate only user's tickets (first 3 for demo)
    const userTickets = recentTickets.slice(0, 3);

    return (
        <div className="space-y-3">
            {userTickets.map((ticket) => (
                <div
                    key={ticket.id}
                    className="group relative bg-white hover:bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 cursor-pointer overflow-hidden"
                >
                    {/* Accent Line on Hover */}
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>

                    <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="flex flex-col shrink-0">
                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                <Hash size={10} />
                                ID de Reporte
                            </div>
                            <span className="font-black text-blue-600 text-sm tracking-tight">{ticket.id}</span>
                        </div>

                        <div className="h-10 w-px bg-slate-100"></div>

                        <div className="flex flex-col flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                                {ticket.issue}
                            </h4>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors uppercase tracking-widest">
                                    {ticket.tech}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {ticket.date}
                                </span>
                            </div>
                        </div>

                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(ticket.status)} transition-all group-hover:scale-105`}>
                            {getStatusIcon(ticket.status)}
                            {ticket.status}
                        </div>
                    </div>
                    <div className="ml-6 p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all group-hover:rotate-90">
                        <ChevronRight size={18} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserTicketList;
