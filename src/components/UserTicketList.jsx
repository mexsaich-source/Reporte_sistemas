import React, { useState } from 'react';
import { ChevronRight, Hash } from 'lucide-react';
import { recentTickets } from '../data/mockData';
import { TicketStatusBadge } from './TicketsModule';
import TicketDetailSlider from './TicketDetailSlider';

const UserTicketList = () => {
    const [selectedTicket, setSelectedTicket] = useState(null);

    // Simulate only user's tickets (first 3 for demo)
    const userTickets = recentTickets.slice(0, 3);

    return (
        <div className="space-y-3">
            {userTickets.map((ticket) => (
                <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="group relative bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-none cursor-pointer overflow-hidden"
                >
                    {/* Accent Line on Hover */}
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>

                    <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="flex flex-col shrink-0">
                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                                <Hash size={10} />
                                ID de Reporte
                            </div>
                            <span className="font-black text-blue-600 dark:text-blue-400 text-sm tracking-tight">{ticket.id}</span>
                        </div>

                        <div className="h-10 w-px bg-slate-100 dark:bg-slate-800"></div>

                        <div className="flex flex-col flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {ticket.issue}
                            </h4>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-widest">
                                    {ticket.tech}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                    {ticket.date}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 group-hover:scale-105 transition-all">
                            <TicketStatusBadge status={ticket.status} withIcon size="lg" />
                        </div>
                    </div>
                    <div className="ml-6 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all group-hover:rotate-90">
                        <ChevronRight size={18} />
                    </div>
                </div>
            ))}

            <TicketDetailSlider
                ticket={selectedTicket}
                isOpen={!!selectedTicket}
                onClose={() => setSelectedTicket(null)}
            />
        </div>
    );
};

export default UserTicketList;
