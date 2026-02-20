import React from 'react';
import { Calendar as CalendarIcon, Clock, ChevronRight, CheckCircle2, ChevronLeft } from 'lucide-react';

const UserAgenda = () => {
    const events = [
        { id: 1, title: 'Revisión de Laptop', time: '10:00 AM', date: 'Mañana', type: 'Mantenimiento', status: 'pending' },
        { id: 2, title: 'Instalación ERP', time: '02:30 PM', date: 'Oct 25', type: 'Software', status: 'pending' },
        { id: 3, title: 'Capacitación O365', time: '09:00 AM', date: 'Oct 26', type: 'Soporte', status: 'pending' },
        { id: 4, title: 'Cambio Teclado', time: '04:00 PM', date: 'Ayer', type: 'Hardware', status: 'completed' },
    ];

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Calendar Placeholder - Premium Style */}
            <div className="lg:w-72 bg-white p-5 rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/30 shrink-0">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Octubre 23</h3>
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"><ChevronLeft size={16} className="text-slate-400" /></button>
                        <button className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"><ChevronRight size={16} className="text-slate-400" /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-300 mb-3 uppercase tracking-tighter">
                    <span>Dom</span><span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {Array.from({ length: 31 }, (_, i) => (
                        <div key={i} className={`relative py-2 rounded-xl cursor-pointer transition-all duration-300 font-bold group ${i + 1 === 24 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-blue-50 hover:text-blue-600 text-slate-600'}`}>
                            {i + 1}
                            {i + 1 === 12 && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full"></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Events List - Compacted Premium */}
            <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2 uppercase tracking-widest">
                        <CalendarIcon size={16} className="text-blue-600" />
                        Próximas Actividades
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 px-3 py-1 bg-slate-100 rounded-full uppercase tracking-widest">4 Eventos</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {events.map((event) => (
                        <div key={event.id} className="group relative bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 cursor-pointer overflow-hidden">
                            <div className="absolute left-0 top-0 w-1 h-full bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>

                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 duration-300 ${event.status === 'completed' ? 'bg-emerald-50 text-emerald-600 shadow-sm shadow-emerald-500/10' : 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-500/10'}`}>
                                    {event.status === 'completed' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 transition-colors group-hover:text-blue-600">{event.title}</h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-widest transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">{event.type}</span>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-tighter">
                                            <CalendarIcon size={12} />
                                            {event.date}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-tighter">
                                            <Clock size={12} />
                                            {event.time}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-2 transition-transform group-hover:translate-x-1 duration-300">
                                <ChevronRight size={20} className="text-slate-200 group-hover:text-blue-500" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UserAgenda;
