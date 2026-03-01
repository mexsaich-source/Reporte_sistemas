import React, { useState } from 'react';
import {
    FilePlus, History, Calendar as CalendarIcon, LogOut, Search, Bell,
    Ticket as TicketIcon, CheckCircle, Clock, AlertCircle, ChevronRight, User,
    CheckCircle2, ChevronLeft, Send, X, Laptop, Settings, Smartphone, Monitor, ImagePlus, Hash
} from 'lucide-react';
import Header from './Header';
import StatCard from './StatCard';
import { TicketStatusBadge } from './TicketsModule';
import TicketDetailSlider from './TicketDetailSlider';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

// --- SUBCOMPONENTE: Agenda de Usuario ---
const UserAgenda = () => {
    const events = [
        { id: 1, title: 'Revisión de Laptop', time: '10:00 AM', date: 'Mañana', type: 'Mantenimiento', status: 'pending' },
        { id: 2, title: 'Instalación ERP', time: '02:30 PM', date: 'Oct 25', type: 'Software', status: 'pending' },
        { id: 3, title: 'Capacitación O365', time: '09:00 AM', date: 'Oct 26', type: 'Soporte', status: 'pending' },
        { id: 4, title: 'Cambio Teclado', time: '04:00 PM', date: 'Ayer', type: 'Hardware', status: 'completed' },
    ];

    return (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700 transition-colors">
            {/* Calendar Placeholder - Premium Style */}
            <div className="lg:w-72 bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/30 dark:shadow-none shrink-0 transition-colors">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Octubre 23</h3>
                    <div className="flex gap-2">
                        <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors"><ChevronLeft size={16} className="text-slate-400 dark:text-slate-500" /></button>
                        <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors"><ChevronRight size={16} className="text-slate-400 dark:text-slate-500" /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 mb-3 uppercase tracking-tighter">
                    <span>Dom</span><span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {Array.from({ length: 31 }, (_, i) => (
                        <div key={i} className={`relative py-2 rounded-xl cursor-pointer transition-all duration-300 font-bold group ${i + 1 === 24 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-400'}`}>
                            {i + 1}
                            {i + 1 === 12 && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-400 rounded-full"></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* Events List - Compacted Premium */}
            <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-2 uppercase tracking-widest">
                        <CalendarIcon size={16} className="text-blue-600 dark:text-blue-400" />
                        Próximas Actividades
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full uppercase tracking-widest">4 Eventos</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {events.map((event) => (
                        <div key={event.id} className="group relative bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-blue-200 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-none cursor-pointer overflow-hidden">
                            <div className="absolute left-0 top-0 w-1 h-full bg-blue-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>

                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 duration-300 ${event.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/10' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/10'}`}>
                                    {event.status === 'completed' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">{event.title}</h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 dark:group-hover:text-blue-400">{event.type}</span>
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                                            <CalendarIcon size={12} />
                                            {event.date}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                                            <Clock size={12} />
                                            {event.time}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-2 transition-transform group-hover:translate-x-1 duration-300">
                                <ChevronRight size={20} className="text-slate-200 dark:text-slate-700 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- SUBCOMPONENTE: Formulario de Nuevo Ticket ---
const NewTicketForm = ({ onCancel, onSuccess }) => {
    const { user } = useAuth();

    // Form state
    const [deviceType, setDeviceType] = useState('Laptop');
    const [title, setTitle] = useState('');
    const [assetTag, setAssetTag] = useState('');
    const [urgency, setUrgency] = useState('Media');
    const [description, setDescription] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const deviceTypes = [
        { id: 'Laptop', icon: Laptop },
        { id: 'Monitor', icon: Monitor },
        { id: 'Desktop', icon: Settings },
        { id: 'Phone', icon: Smartphone },
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim() || !description.trim()) {
            setError("El título y la descripción son obligatorios.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Asumiendo que el demo-user no puede insertar en la DB real.
            if (user?.id === 'demo-user') {
                throw new Error("No puedes crear tickets reales en modo Demo. Usa una cuenta real.");
            }

            const newTicket = {
                user_id: user.id,
                title: title.trim(),
                description: description.trim(),
                device_type: deviceType,
                asset_tag: assetTag.trim() || null,
                urgency: urgency,
                status: 'Open' // Por defecto cuando se crea
            };

            const { error: insertError } = await supabase
                .from('tickets')
                .insert([newTicket]);

            if (insertError) throw insertError;

            // Success
            if (onSuccess) onSuccess();
            else onCancel();

        } catch (err) {
            console.error(err);
            setError(err.message || "Ocurrió un error al guardar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 transition-colors">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                        <AlertCircle size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-950 dark:text-white text-xl tracking-tight">Reportar Falla Técnica</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Completa los detalles para asignar un soporte.</p>
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="p-10">
                <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Device Selection Grid */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">1. Tipo de Dispositivo</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {deviceTypes.map((type) => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setDeviceType(type.id)}
                                    className={`flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-300 ${deviceType === type.id
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/5'
                                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <type.icon size={28} strokeWidth={deviceType === type.id ? 2.5 : 2} />
                                    <span className="text-xs font-black uppercase tracking-widest">{type.id}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Título del Problema</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Laptop no conecta a WiFi"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-5 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 dark:focus:border-blue-500 transition-all font-medium text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                            <div className="group space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">ID de Activo / Asset Tag</label>
                                <input
                                    type="text"
                                    value={assetTag}
                                    onChange={(e) => setAssetTag(e.target.value)}
                                    placeholder="Ej: MEX-LAP-042"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-5 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 dark:focus:border-blue-500 transition-all font-medium text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Nivel de Urgencia</label>
                            <div className="flex gap-2">
                                {['Baja', 'Media', 'Alta', 'Crítica'].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setUrgency(level)}
                                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${urgency === level
                                            ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500 shadow-md shadow-blue-500/20'
                                            : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Descripción Detallada</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explique paso a paso el problema..."
                                rows="3"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-5 py-4 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 dark:focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium text-sm resize-none"
                            ></textarea>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Evidencia Visual (Opcional)</label>
                            <label className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer">
                                <input type="file" className="hidden" accept="image/*" />
                                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-full shadow-sm text-blue-500 mb-1">
                                    <ImagePlus size={20} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Subir Captura de Pantalla</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">PNG, JPG hasta 5MB</p>
                                </div>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2 text-slate-400 bg-emerald-50/30 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3">
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm">
                                    <AlertCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest leading-tight">Ubicación Actual</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">Detección Automática por Red</span>
                                </div>
                            </div>
                            <div className="space-y-2 text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                                <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm">
                                    <AlertCircle size={18} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">Tiempo de Respuesta</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">SLA Estándar (4h laborables)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-8 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all font-bold disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-slate-950 dark:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 dark:shadow-blue-900/20 hover:bg-blue-600 dark:hover:bg-blue-500 hover:shadow-blue-600/20 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Send size={18} />
                            )}
                            Crear Reporte IT
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- SUBCOMPONENTE: Lista de Tickets del Usuario ---
const UserTicketList = ({ tickets }) => {
    const [selectedTicket, setSelectedTicket] = useState(null);

    if (!tickets || tickets.length === 0) {
        return <div className="p-8 text-center text-slate-500 font-medium border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">No hay reportes recientes.</div>;
    }

    return (
        <div className="space-y-3">
            {tickets.map((ticket) => (
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
                                ID
                            </div>
                            <span className="font-black text-blue-600 dark:text-blue-400 text-sm tracking-tight">{ticket.displayId}</span>
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

// --- COMPONENTE PRINCIPAL: Portal de Usuario ---
const UserPortal = ({ onLogout }) => {
    const { user, profile } = useAuth();
    const [currentView, setCurrentView] = useState('MyTickets');
    const [myTickets, setMyTickets] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    const [stats, setStats] = useState({ open: 0, pending: 0, resolved: 0 });

    const fetchMyTickets = async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Compute stats
            let open = 0, pending = 0, resolved = 0;
            const formattedTickets = data.map(t => {
                if (t.status === 'Open') open++;
                if (t.status === 'Pending' || t.status === 'In Progress') pending++;
                if (t.status === 'Resolved' || t.status === 'Closed') resolved++;

                return {
                    id: t.id,
                    displayId: t.id.substring(0, 8).toUpperCase(),
                    issue: t.title,
                    tech: t.assigned_to ? 'Técnico Asignado' : 'Sin Asignar',
                    status: t.status,
                    date: new Date(t.created_at).toLocaleDateString()
                };
            });

            setStats({ open, pending, resolved });
            setMyTickets(formattedTickets);
        } catch (error) {
            console.error("Error fetching tickets:", error);
        } finally {
            setLoadingData(false);
        }
    };

    React.useEffect(() => {
        if (currentView === 'MyTickets') {
            fetchMyTickets();
        }
    }, [currentView, user]);

    const menuItems = [
        { name: 'Mis Actividades', icon: History, id: 'MyTickets' },
        { name: 'Nuevo Reporte', icon: FilePlus, id: 'NewTicket' },
        { name: 'Agenda', icon: CalendarIcon, id: 'Agenda' },
    ];

    const formatCount = (count) => count < 10 ? `0${count}` : `${count}`;

    const renderView = () => {
        switch (currentView) {
            case 'NewTicket':
                return <NewTicketForm onCancel={() => setCurrentView('MyTickets')} onSuccess={() => setCurrentView('MyTickets')} />;
            case 'Agenda':
                return <UserAgenda />;
            case 'MyTickets':
            default:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Abiertos" value={formatCount(stats.open)} trend="" icon={AlertCircle} color="text-red-500" bg="bg-red-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="En Proceso" value={formatCount(stats.pending)} trend="" icon={Clock} color="text-amber-500" bg="bg-amber-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Resueltos" value={formatCount(stats.resolved)} trend="" icon={CheckCircle} color="text-emerald-500" bg="bg-emerald-500/10" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Historial de Reportes</h3>
                                </div>
                                <button onClick={fetchMyTickets} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">Refrescar</button>
                            </div>
                            <div className="p-4">
                                {loadingData ? (
                                    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        Cargando desde la nube...
                                    </div>
                                ) : (
                                    <UserTicketList tickets={myTickets} />
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex min-h-screen bg-[#fcfdfe] dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-300">
            {/* User Sidebar - Premium Dark Design */}
            <aside className="w-64 bg-slate-950 flex flex-col min-h-screen sticky top-0 z-20 overflow-hidden">
                {/* Decorative Background for Sidebar */}
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="absolute top-[-20%] left-[-20%] w-full h-[60%] bg-blue-600/30 rounded-full blur-[80px]"></div>
                </div>

                <div className="relative p-7 flex items-center gap-3 border-b border-white/5">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                        <TicketIcon size={22} strokeWidth={2.5} />
                    </div>
                    <span className="font-black text-xl text-white tracking-tight">Mexsa<span className="text-blue-500">.</span></span>
                </div>

                <nav className="relative flex-1 py-8 px-4 space-y-2">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-3">Principal</div>
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${currentView === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white font-medium'
                                }`}
                        >
                            <item.icon size={20} className={`${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`} />
                            <span className="text-sm">{item.name}</span>
                            {currentView === item.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
                        </button>
                    ))}
                </nav>

                <div className="relative p-6 mt-auto">
                    <div className="bg-white/5 rounded-3xl p-4 border border-white/5 backdrop-blur-sm">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Tu Soporte</p>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-blue-500/20 p-2 rounded-xl">
                                <AlertCircle size={18} className="text-blue-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">¿Ayuda?</span>
                                <span className="text-[10px] text-slate-400">Ext: 4050</span>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-300 text-xs font-black uppercase tracking-widest"
                        >
                            <LogOut size={16} />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <Header userRole="user" userName={profile?.full_name || user?.email || "Usuario Local"} onLogout={onLogout} />

                <main className="p-10 max-w-7xl mx-auto w-full">
                    <div className="flex items-center justify-between mb-10">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                                {currentView === 'MyTickets' ? 'Mis Actividades' :
                                    currentView === 'NewTicket' ? 'Nuevo Reporte' : 'Agenda Personal'}
                            </h1>
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm">
                                <span>IT Service Desk</span>
                                <ChevronRight size={12} />
                                <span className="text-blue-600 dark:text-blue-400">
                                    {currentView === 'MyTickets' ? 'Panel de Control' :
                                        currentView === 'NewTicket' ? 'Solicitud Manual' : 'Planificación'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setCurrentView('NewTicket')}
                            className="bg-slate-950 dark:bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-3 shadow-xl shadow-slate-950/20 dark:shadow-blue-900/20 hover:bg-blue-600 dark:hover:bg-blue-500 hover:shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:scale-95"
                        >
                            <FilePlus size={20} />
                            Reportar Falla
                        </button>
                    </div>

                    <div className="relative">
                        {renderView()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default UserPortal;
