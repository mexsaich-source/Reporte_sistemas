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
import StatCard from './StatCard';
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
                                <StatCard label="Abiertos" value="03" trend="" icon={AlertCircle} color="text-red-500" bg="bg-red-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="En Proceso" value="01" trend="" icon={Clock} color="text-amber-500" bg="bg-amber-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Resueltos" value="12" trend="" icon={CheckCircle} color="text-emerald-500" bg="bg-emerald-500/10" />
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-bold text-slate-900 text-base">Historial de Reportes</h3>
                                </div>
                                <button className="text-xs text-blue-600 font-bold hover:text-blue-700 p-2 hover:bg-blue-50 rounded-xl transition-all">Ver Historial Completo</button>
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
        <div className="flex min-h-screen bg-[#fcfdfe] text-slate-800 font-sans">
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
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-10 transition-all">
                    <div className="flex items-center gap-3 text-slate-400 bg-slate-50 px-4 py-2.5 rounded-2xl w-[400px] border border-slate-100 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all group">
                        <Search size={18} className="group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar en tus reportes..."
                            className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400 font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-5">
                        <button className="relative p-2.5 text-slate-400 hover:text-slate-900 transition-all hover:bg-slate-50 rounded-xl">
                            <Bell size={22} />
                            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-bounce-slow"></span>
                        </button>

                        <div className="h-8 w-px bg-slate-100 mx-2"></div>

                        <div className="flex items-center gap-4 group cursor-pointer">
                            <div className="flex flex-col text-right">
                                <span className="text-sm font-black text-slate-900 leading-tight">Usuario Demo</span>
                                <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest leading-tight">Operativo</span>
                            </div>
                            <div className="relative">
                                <img
                                    src="https://ui-avatars.com/api/?name=User+Demo&background=3b82f6&color=fff&size=128&bold=true"
                                    className="w-11 h-11 rounded-2xl border-2 border-slate-50 shadow-md group-hover:scale-105 transition-transform"
                                    alt="Profile"
                                />
                                <div className="absolute bottom-[-2px] right-[-2px] w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white"></div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="p-10 max-w-7xl mx-auto w-full">
                    <div className="flex items-center justify-between mb-10">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black text-slate-950 tracking-tight">
                                {currentView === 'MyTickets' ? 'Mis Actividades' :
                                    currentView === 'NewTicket' ? 'Nuevo Reporte' : 'Agenda Personal'}
                            </h1>
                            <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                <span>IT Service Desk</span>
                                <ChevronRight size={12} />
                                <span className="text-blue-600">
                                    {currentView === 'MyTickets' ? 'Panel de Control' :
                                        currentView === 'NewTicket' ? 'Solicitud Manual' : 'Planificación'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setCurrentView('NewTicket')}
                            className="bg-slate-950 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-3 shadow-xl shadow-slate-950/20 hover:bg-blue-600 hover:shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:scale-95"
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
