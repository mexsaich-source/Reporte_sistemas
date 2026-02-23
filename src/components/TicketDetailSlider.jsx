import React from 'react';
import { X, Clock, MessageSquare, Paperclip, Send } from 'lucide-react';
import { TicketStatusBadge } from './TicketsModule';

const TicketDetailSlider = ({ ticket, isOpen, onClose }) => {
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

                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Reportado por</span>
                            <span className="text-slate-900 dark:text-slate-200 font-semibold">{ticket?.reportedBy}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest">Técnico Asignado</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{ticket?.tech}</span>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <MessageSquare size={14} className="text-blue-500" /> Historial de notas
                        </h4>

                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl shadow-sm rounded-tr-none ml-8 relative before:absolute before:content-[''] before:right-[-6px] before:top-4 before:w-3 before:h-3 before:bg-white dark:before:bg-slate-800 before:border-r before:border-t before:border-slate-100 dark:before:border-slate-700 before:rotate-45 transition-colors">
                            <p className="text-slate-600 dark:text-slate-300">Por favor, adjunta una captura del error que aparece al arrancar el equipo.</p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-2 block w-full text-right">Ayer, 14:30 - {ticket?.tech}</span>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-4 rounded-2xl shadow-sm rounded-tl-none mr-8 relative before:absolute before:content-[''] before:left-[-6px] before:top-4 before:w-3 before:h-3 before:bg-blue-50 dark:before:bg-blue-500/10 before:border-l before:border-b before:border-blue-100 dark:before:border-blue-500/20 before:rotate-45 transition-colors">
                            <p className="text-slate-800 dark:text-slate-200">Claro, enseguida lo subo. La pantalla se queda en negro.</p>
                            <span className="text-[10px] text-blue-400 dark:text-blue-500/60 font-bold mt-2 block">Hoy, 09:15 - {ticket?.reportedBy}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-all">
                        <button className="text-slate-400 p-2.5 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all">
                            <Paperclip size={18} />
                        </button>
                        <input type="text" placeholder="Escribe una nota..." className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                        <button className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-black dark:hover:bg-blue-500 hover:shadow-black/20 transition-all">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TicketDetailSlider;
