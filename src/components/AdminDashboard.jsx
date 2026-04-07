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
import MaintenanceModule from './MaintenanceModule';
import BotIncidentsAdmin from './BotIncidentsAdmin';
import ProfileSettingsModal from './ProfileSettingsModal';
import ITFailureReportForm from './ITFailureReportForm';
import { userService } from '../services/userService';
import { workNotificationService } from '../services/workNotificationService';
import { AlertCircle, Clock, CheckCircle, MonitorSmartphone, ShieldCheck, Wrench, Activity } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, Users } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

// --- SECCIÓN DE GRÁFICAS ---
const ChartSection = ({ ticketsByDept, ticketsByStatus }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col min-h-[450px]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <BarChart3 size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Top Departamentos</h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Áreas con más reportes</p>
                </div>
            </div>
            <div className="w-full flex-1 min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                    <BarChart data={ticketsByDept.length > 0 ? ticketsByDept : [{ name: 'Sin datos', tickets: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="tickets" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col min-h-[450px]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <PieChartIcon size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Distribución de Estado</h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Estatus global de tickets</p>
                </div>
            </div>
            <div className="w-full flex-1 min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                    <PieChart>
                        <Pie
                            data={ticketsByStatus.length > 0 ? ticketsByStatus : [{ name: 'Sin tickets', value: 1 }]}
                            cx="50%" cy="50%"
                            innerRadius={70} outerRadius={100}
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

// --- TABLA DE RENDIMIENTO DE TÉCNICOS ---
const TechPerformanceTable = ({ techStats }) => (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-8 mt-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                <Users size={20} strokeWidth={2.5} />
            </div>
            <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Rendimiento del Equipo</h3>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Carga de trabajo por técnico</p>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Técnico</th>
                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tickets Activos</th>
                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Actividades Pendientes</th>
                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tickets Resueltos</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {techStats.length === 0 ? (
                        <tr><td colSpan="4" className="py-8 text-center text-slate-400 text-xs font-bold">No hay datos de técnicos</td></tr>
                    ) : (
                        techStats.map(tech => (
                            <tr key={tech.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                <td className="py-4 px-4">
                                    <div className="flex items-center gap-3">
                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tech.full_name || '')}&background=3b82f6&color=fff&size=64&bold=true`} alt={tech.full_name} className="w-10 h-10 rounded-xl" />
                                        <div>
                                            <div className="font-bold text-sm text-slate-900 dark:text-white">{tech.full_name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                                {tech.role === 'admin' ? <ShieldCheck size={10} /> : <Wrench size={10} />} {tech.role}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-black text-xs border border-blue-100 dark:border-blue-500/20">
                                        {tech.activeTickets}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-black text-xs border border-amber-100 dark:border-amber-500/20">
                                        {tech.pendingActivities}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 font-black text-xs border border-emerald-100 dark:border-emerald-500/20">
                                        {tech.resolvedTickets}
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// --- DASHBOARD PRINCIPAL ---
const AdminDashboard = () => {
    const { profile } = useAuth();
    const role = (profile?.role || '').toLowerCase().trim();
    const department = (profile?.department || '').toLowerCase().trim();
    const isMaint = department.includes('mantenimiento') || department.includes('ingenieria') || department.includes('ingeniería');
    const isIT = ['admin', 'tech', 'técnico'].includes(role) && !isMaint;

    const [currentView, setCurrentView] = useState(isMaint ? 'Maintenance' : 'Dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [stats, setStats] = useState({ openTickets: 0, pendingActivities: 0, resolvedThisWeek: 0, devicesDown: 0 });
    const [ticketsByDept, setTicketsByDept] = useState([]);
    const [ticketsByStatus, setTicketsByStatus] = useState([]);
    const [techStats, setTechStats] = useState([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        const loadDashboardData = async () => {
            if (!isIT) {
                setStatsLoading(false);
                return;
            }
            setStatsLoading(true);
            try {
                // 1. Cargar TODOS los usuarios para cruzar los departamentos
                const users = await userService.getAll();
                const techsOnly = users.filter(u => u.role === 'tech' || u.role === 'admin');

                // 2. Cargar Tickets (CORRECCIÓN: Usamos las columnas reales de tu base de datos)
                const { data: tickets, error: ticketsError } = await supabase
                    .from('tickets')
                    .select('status, urgency, created_at, reported_by, assigned_tech');

                if (ticketsError) {
                    console.error("Error cargando tickets:", ticketsError.message);
                }

                // 3. Activos con estado problemático
                const { data: maintenanceAssets } = await supabase
                    .from('assets')
                    .select('id')
                    .in('status', ['maintenance', 'in_maintenance', 'repair']);

                // 4. Actividades pendientes y asignadas
                const { data: activities, error: actError } = await supabase
                    .from('activities')
                    .select('id, status, assigned_tech');

                if (actError) {
                    console.error("Error cargando actividades:", actError.message);
                }

                // Asegurarnos de que tickets exista (aunque esté vacío) para no romper la pantalla
                if (tickets) {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);

                    // --- STATS GLOBALES (CORREGIDO: Incluimos pending_admin y assigned) ---
                    const openStatusList = ['open', 'pending_admin', 'assigned', 'in_progress'];
                    const open = tickets.filter(t => openStatusList.includes(t.status)).length;

                    const resolvedWeek = tickets.filter(t => t.status === 'resolved' && new Date(t.created_at) >= weekAgo).length;

                    // Si no hay actividades aún, lo dejamos en 0
                    const pendingActs = activities ? activities.filter(a => ['pending', 'assigned', 'in_progress'].includes(a.status)).length : 0;

                    setStats({
                        openTickets: open,
                        pendingActivities: pendingActs,
                        resolvedThisWeek: resolvedWeek,
                        devicesDown: maintenanceAssets?.length || 0,
                    });

                    // --- GRÁFICA DE ESTADOS (Mapeo completo) ---
                    const statusMap = {};
                    const statusLabels = {
                        open: 'Abierto',
                        pending_admin: 'Pend. Admin',
                        assigned: 'Asignado',
                        in_progress: 'En Proceso',
                        resolved: 'Resuelto'
                    };

                    tickets.forEach(t => {
                        const label = statusLabels[t.status] || 'Otros';
                        statusMap[label] = (statusMap[label] || 0) + 1;
                    });
                    setTicketsByStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

                    // --- GRÁFICA DE DEPARTAMENTOS ---
                    const deptMap = {};
                    tickets.forEach(t => {
                        const reporter = users.find(u => u.id === t.reported_by);
                        const deptName = reporter?.department ? reporter.department.trim() : 'TI / General';
                        deptMap[deptName] = (deptMap[deptName] || 0) + 1;
                    });

                    const deptData = Object.entries(deptMap)
                        .map(([name, ticketsCount]) => ({ name, tickets: ticketsCount }))
                        .sort((a, b) => b.tickets - a.tickets)
                        .slice(0, 5);
                    setTicketsByDept(deptData);

                    // --- RENDIMIENTO DE TÉCNICOS ---
                    const techDataMap = techsOnly.reduce((acc, tech) => {
                        acc[tech.id] = { ...tech, activeTickets: 0, resolvedTickets: 0, pendingActivities: 0 };
                        return acc;
                    }, {});

                    tickets.forEach(t => {
                        if (t.assigned_tech && techDataMap[t.assigned_tech]) {
                            if (t.status === 'resolved') techDataMap[t.assigned_tech].resolvedTickets++;
                            else techDataMap[t.assigned_tech].activeTickets++;
                        }
                    });

                    if (activities) {
                        activities.forEach(a => {
                            if (a.assigned_tech && techDataMap[a.assigned_tech]) {
                                if (['pending', 'assigned', 'in_progress'].includes(a.status)) {
                                    techDataMap[a.assigned_tech].pendingActivities++;
                                }
                            }
                        });
                    }

                    const sortedTechs = Object.values(techDataMap).sort((a, b) =>
                        (b.activeTickets + b.pendingActivities) - (a.activeTickets + a.pendingActivities)
                    );
                    setTechStats(sortedTechs);
                }

            } catch (err) {
                console.error('Error catastrófico cargando stats:', err.message);
            } finally {
                setStatsLoading(false);
            }
        };

        loadDashboardData();
    }, [isIT]);

    useEffect(() => {
        if ((profile?.role || '').toLowerCase().trim() !== 'admin') return undefined;

        workNotificationService.runDueReminders();
        const timer = setInterval(() => {
            workNotificationService.runDueReminders();
        }, 5 * 60 * 1000);

        return () => clearInterval(timer);
    }, [profile?.role]);

    const dynamicStats = [
        { id: 1, label: 'Tickets Abiertos', value: statsLoading ? '...' : stats.openTickets, trend: stats.openTickets > 5 ? '+12%' : '+2%', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
        { id: 2, label: 'Actividades Pendientes', value: statsLoading ? '...' : stats.pendingActivities, trend: '-5%', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-100' },
        { id: 3, label: 'Resueltos Esta Semana', value: statsLoading ? '...' : stats.resolvedThisWeek, trend: '+24%', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
        { id: 4, label: 'Equipos en Mant.', value: statsLoading ? '...' : stats.devicesDown, trend: 'Estable', icon: MonitorSmartphone, color: 'text-red-600', bg: 'bg-red-100' },
    ];

    const renderView = () => {
        // Bloqueo de acceso: Redirigir si intenta entrar a áreas no permitidas
        const isBoss = isMaint && ['admin', 'jefe_mantenimiento'].includes(role);
        const canManageNews = (['admin', 'jefe_it', 'jefe_area_it', 'jefe area it'].includes(role)) && !isMaint;
        const canReportITFailure = isMaint && ['admin', 'jefe_mantenimiento'].includes(role);
        const restrictedViews = ['Tickets', 'Inventory', 'Activities', 'Reports', 'Import', 'Requests'];
        
        // Si es de mantenimiento pero NO es jefe, también bloqueamos 'Users'
        if (isMaint && !isBoss && currentView === 'Users') {
            return <MaintenanceModule />;
        }

        if (!isIT && restrictedViews.includes(currentView)) {
            return <MaintenanceModule />;
        }

        if (currentView === 'NewsTI' && !canManageNews) {
            return <MaintenanceModule />;
        }

        if (currentView === 'ITFailureReport' && !canReportITFailure) {
            return <MaintenanceModule />;
        }

        switch (currentView) {
            case 'Tickets': return <TicketsModule searchTerm={searchTerm} />;
            case 'Inventory': return <InventoryView searchTerm={searchTerm} />;
            case 'Activities': return <ActivitiesView searchTerm={searchTerm} />;
            case 'Reports': return <ReportsView searchTerm={searchTerm} />;
            case 'Users': return <UsersView searchTerm={searchTerm} />;
            case 'Import': return <ImportModule />;
            case 'Requests': return <RequestsModule searchTerm={searchTerm} />;
            case 'NewsTI': return <BotIncidentsAdmin />;
            case 'ITFailureReport': return <ITFailureReportForm onCancel={() => setCurrentView('Maintenance')} onSuccess={() => setCurrentView('Maintenance')} />;
            case 'Maintenance': return <MaintenanceModule />;
            case 'Dashboard':
            default:
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {isIT ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    {dynamicStats.map((stat) => (
                                        <StatCard key={stat.id} {...stat} />
                                    ))}
                                </div>
                                <ChartSection ticketsByDept={ticketsByDept} ticketsByStatus={ticketsByStatus} />
                                <TechPerformanceTable techStats={techStats} />
                            </>
                        ) : (
                            <MaintenanceModule />
                        )}
                    </div>
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
                    onSelectItem={(item) => { setCurrentView(item); setIsSidebarOpen(false); setSearchTerm(''); }}
                    onSettingsClick={() => setIsSettingsOpen(true)}
                />
            </div>

            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <Header
                    onMenuClick={() => setIsSidebarOpen(true)}
                    userName={profile?.full_name || 'Usuario'}
                    userType={profile?.role || (isMaint ? 'Mantenimiento' : 'Cargando...')}
                    searchTerm={(currentView === 'Dashboard' || currentView === 'Maintenance' || currentView === 'NewsTI' || currentView === 'ITFailureReport') ? '' : searchTerm}
                    onSearchChange={setSearchTerm}
                    hideSearch={currentView === 'Dashboard' || currentView === 'Maintenance' || currentView === 'NewsTI' || currentView === 'ITFailureReport'}
                />

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full min-h-0">
                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {currentView === 'Dashboard' ? (isIT ? 'Centro de Mando IT' : 'Portal de Mantenimiento') : 
                                currentView === 'Maintenance' ? 'Gestión de Mantenimiento' : currentView === 'NewsTI' ? 'Administración Noticias IT' : currentView === 'ITFailureReport' ? 'Reporte de Falla TI' : currentView}
                        </h1>

                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
                            {currentView === 'Dashboard' ? (isIT ? 'Métricas en tiempo real y carga operativa.' : 'Bienvenido jefe, gestione sus órdenes de trabajo.') : 
                                currentView === 'Maintenance' ? 'Control de ingeniería y reparaciones.' : currentView === 'NewsTI' ? 'Publica y cierra avisos técnicos para todo el hotel.' : currentView === 'ITFailureReport' ? 'Canal exclusivo para escalar fallas de TI desde Ingeniería.' : `sección de ${currentView}.`}
                        </p>

                    </div>

                    {renderView()}
                </main>
            </div>

            <ProfileSettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </div>
    );
};

export default AdminDashboard;