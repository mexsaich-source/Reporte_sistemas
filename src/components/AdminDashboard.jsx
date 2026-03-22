import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';

import Header from './Header';
import Sidebar from './Sidebar';
import StatCard from './StatCard';
import TicketsModule from './TicketsModule';
import InventoryView from './Inventory';
import ActivitiesView from './Activities';
import ReportsView from './Reports';
import UsersView from './UsersList';
import ImportModule from './ImportModule';
import RequestsModule from './RequestsModule';
import { userService } from '../services/userService';
import { AlertCircle, Clock, CheckCircle, MonitorSmartphone, Wrench, ShieldCheck, Shield } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

// --- GRÁFICAS CON DATOS REALES ---
const ChartSection = ({ ticketsByDept, ticketsByStatus }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Bar Chart: Tickets por Departamento */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col h-[400px]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <BarChart3 size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Carga por Departamento</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Tickets Activos (Datos Reales)</p>
                </div>
            </div>
            <div className="w-full flex-1">
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ticketsByDept.length > 0 ? ticketsByDept : [{ name: 'Sin datos', tickets: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="tickets" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Pie Chart: Tickets por Estado */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col h-[400px]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <PieChartIcon size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Distribución de Estado</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Tickets por Estatus</p>
                </div>
            </div>
            <div className="w-full flex-1">
                <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                        <Pie
                            data={ticketsByStatus.length > 0 ? ticketsByStatus : [{ name: 'Sin tickets', value: 1 }]}
                            cx="50%" cy="50%"
                            innerRadius={70} outerRadius={110}
                            paddingAngle={6} dataKey="value" stroke="none"
                        >
                            {ticketsByStatus.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
);

// --- DASHBOARD PRINCIPAL ---
const AdminDashboard = () => {
    const { profile } = useAuth();

    const [currentView, setCurrentView] = useState('Dashboard');
    const [activeTab, setActiveTab] = useState('General');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [techs, setTechs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // FIX #10: Stats reales desde Supabase
    const [stats, setStats] = useState({
        openTickets: 0,
        pendingActivities: 0,
        resolvedThisWeek: 0,
        devicesDown: 0,
    });
    const [ticketsByDept, setTicketsByDept] = useState([]);
    const [ticketsByStatus, setTicketsByStatus] = useState([]);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        // Cargar técnicos
        userService.getAll().then(data => {
            setTechs(data.filter(u => u.role === 'tech' || u.role === 'admin'));
        });

        // Cargar estadísticas reales
        const loadStats = async () => {
            setStatsLoading(true);
            try {
                // 1. Todas los tickets de una sola query
                const { data: tickets } = await supabase
                    .from('tickets')
                    .select('status, urgency, created_at');

                // 2. Activos con estado problemático (SELECT devuelve array con datos reales)
                const { data: maintenanceAssets } = await supabase
                    .from('assets')
                    .select('id')
                    .in('status', ['maintenance', 'in_maintenance', 'repair']);

                // 3. Actividades pendientes
                const { data: pendingActData } = await supabase
                    .from('activities')
                    .select('id')
                    .in('status', ['pending', 'assigned']);

                const devicesDown = maintenanceAssets?.length ?? 0;
                const pendingActivities = pendingActData?.length ?? 0;

                if (tickets) {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);

                    const open = tickets.filter(t => t.status === 'open').length;
                    const resolvedWeek = tickets.filter(t =>
                        t.status === 'resolved' && new Date(t.created_at) >= weekAgo
                    ).length;

                    // Tickets por estado para el gráfico
                    const statusMap = {};
                    const statusLabels = { open: 'Abierto', pending: 'En Proceso', resolved: 'Resuelto' };
                    tickets.forEach(t => {
                        const label = statusLabels[t.status] || t.status;
                        statusMap[label] = (statusMap[label] || 0) + 1;
                    });
                    setTicketsByStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

                    setStats({
                        openTickets: open,
                        pendingActivities: pendingActivities || 0,
                        resolvedThisWeek: resolvedWeek,
                        devicesDown: devicesDown || 0,
                    });
                }

                // Tickets por departamento (aproximado por urgencia si no hay departamento)
                setTicketsByDept([
                    { name: 'Alta', tickets: tickets?.filter(t => t.urgency === 'high').length || 0 },
                    { name: 'Media', tickets: tickets?.filter(t => t.urgency === 'medium').length || 0 },
                    { name: 'Baja', tickets: tickets?.filter(t => t.urgency === 'low').length || 0 },
                ]);

            } catch (err) {
                if (import.meta.env.DEV) console.warn('Stats load error:', err.message);
            } finally {
                setStatsLoading(false);
            }
        };

        loadStats();
    }, []);

    const dynamicStats = [
        { id: 1, label: 'Tickets Abiertos', value: statsLoading ? '...' : stats.openTickets, icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
        { id: 2, label: 'Actividades Pendientes', value: statsLoading ? '...' : stats.pendingActivities, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
        { id: 3, label: 'Resueltos Esta Semana', value: statsLoading ? '...' : stats.resolvedThisWeek, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
        { id: 4, label: 'Equipos en Mant.', value: statsLoading ? '...' : stats.devicesDown, icon: MonitorSmartphone, color: 'text-red-600', bg: 'bg-red-100' },
    ];

    const TecnicosView = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {techs.length === 0 ? (
                    <p className="col-span-3 text-center text-slate-400 dark:text-slate-500 py-20 font-medium">No hay técnicos registrados.</p>
                ) : techs.map(tech => (
                    <div key={tech.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 flex items-center gap-5 transition-all hover:-translate-y-1 hover:shadow-2xl">
                        <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tech.full_name || '')}&background=3b82f6&color=fff&size=128&bold=true`}
                            className="w-16 h-16 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm"
                            alt={tech.full_name}
                        />
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-black text-slate-900 dark:text-white tracking-tight truncate">{tech.full_name}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">{tech.email}</span>
                            <div className="flex items-center gap-2 mt-1">
                                {tech.role === 'admin' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20">
                                        <ShieldCheck size={10} /> Admin
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20">
                                        <Wrench size={10} /> Técnico
                                    </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{tech.department || 'IT'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderView = () => {
        switch (currentView) {
            case 'Tickets':    return <TicketsModule searchTerm={searchTerm} />;
            case 'Inventory':  return <InventoryView searchTerm={searchTerm} />;
            case 'Activities': return <ActivitiesView searchTerm={searchTerm} />;
            case 'Reports':    return <ReportsView searchTerm={searchTerm} />;
            case 'Users':      return <UsersView searchTerm={searchTerm} />;
            case 'Import':     return <ImportModule />;
            case 'Requests':   return <RequestsModule searchTerm={searchTerm} />;
            case 'Dashboard':
            default:
                if (activeTab === 'Cola de Tickets') return <TicketsModule />;
                if (activeTab === 'Técnicos') return <TecnicosView />;
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {dynamicStats.map((stat) => (
                                <StatCard key={stat.id} {...stat} />
                            ))}
                        </div>
                        <ChartSection ticketsByDept={ticketsByDept} ticketsByStatus={ticketsByStatus} />
                        <TicketsModule />
                    </>
                );
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f3f4f6] dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans selection:bg-blue-500/30 transition-colors duration-300">

            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            <div className={`fixed lg:static inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
                <Sidebar
                    activeItem={currentView}
                    onSelectItem={(item) => { setCurrentView(item); setIsSidebarOpen(false); }}
                />
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <Header
                    onMenuClick={() => setIsSidebarOpen(true)}
                    userName={profile?.full_name || 'Admin'}
                    userType={profile?.role || 'Personal IT'}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                />

                <main className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">
                    <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {currentView === 'Dashboard' ? 'Operaciones IT' : currentView}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
                                {currentView === 'Dashboard' ? 'Resumen general del estado de la infraestructura.' : `Gestionando la sección de ${currentView}.`}
                            </p>
                        </div>

                        {currentView === 'Dashboard' && (
                            <div className="flex gap-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                {['General', 'Cola de Tickets', 'Técnicos'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-2 text-xs sm:text-sm font-bold transition-all rounded-xl ${activeTab === tab
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;