import React, { useState } from 'react';
import {
    FilePlus,
    History,
    Calendar,
    LogOut,
    Search,
    Bell,
    Ticket as TicketIcon,
    CheckCircle,
    Clock,
    AlertCircle,
    ChevronRight,
    User
} from 'lucide-react';
import Header from './Header';
import StatCard from './StatCard';
import { recentTickets } from '../data/mockData';
import UserTicketList from './UserTicketList';
import NewTicketForm from './NewTicketForm';
import UserAgenda from './UserAgenda';

const UserPortal = ({ onLogout }) => {
    const [currentView, setCurrentView] = useState('MyTickets');

    const menuItems = [
        { name: 'Mis Actividades', icon: History, id: 'MyTickets' },
        { name: 'Nuevo Reporte', icon: FilePlus, id: 'NewTicket' },
        { name: 'Agenda', icon: Calendar, id: 'Agenda' },
    ];

    const openCount = recentTickets.filter(t => t.status === 'Open').length;
    const pendingCount = recentTickets.filter(t => t.status === 'Pending').length;
    const resolvedCount = recentTickets.filter(t => t.status === 'Resolved').length;
    const formatCount = (count) => count < 10 ? `0${count}` : `${count}`;

    const renderView = () => {
        switch (currentView) {
            case 'NewTicket':
                return <NewTicketForm onCancel={() => setCurrentView('MyTickets')} />;
            case 'Agenda':
                return <UserAgenda />;
            case 'MyTickets':
            default:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Abiertos" value={formatCount(openCount)} trend="" icon={AlertCircle} color="text-red-500" bg="bg-red-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="En Proceso" value={formatCount(pendingCount)} trend="" icon={Clock} color="text-amber-500" bg="bg-amber-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Resueltos" value={formatCount(resolvedCount)} trend="" icon={CheckCircle} color="text-emerald-500" bg="bg-emerald-500/10" />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Historial de Reportes</h3>
                                </div>
                                <button className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">Ver Historial Completo</button>
                            </div>
                            <div className="p-4">
                                <UserTicketList />
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
                <Header userRole="user" userName="Usuario Demo" onLogout={onLogout} />

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
