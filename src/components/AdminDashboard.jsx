import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import StatCard from './StatCard';
import TicketsModule from './TicketsModule';
import InventoryView from './Inventory';
import ActivitiesView from './Activities';
import ReportsView from './Reports';
import UsersView from './UsersList';
import { AlertCircle, Clock, CheckCircle, MonitorSmartphone } from 'lucide-react';

const statsData = [
    { id: 1, label: 'Open Tickets', value: '0', trend: 'N/A', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
    { id: 2, label: 'Pending Activities', value: '0', trend: 'N/A', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
    { id: 3, label: 'Resolved This Week', value: '0', trend: 'N/A', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 4, label: 'Devices Down', value: '0', trend: 'N/A', icon: MonitorSmartphone, color: 'text-red-600', bg: 'bg-red-100' },
];

const ticketsByDepartment = [
    { name: 'TI', tickets: 0 },
    { name: 'Ventas', tickets: 0 }
];

const failingDevices = [
    { name: 'Ninguno', value: 100 }
];

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';

const ChartSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Bar Chart Container */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col h-[400px]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <BarChart3 size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Carga por Departamento</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Tickets Activos</p>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketsByDepartment} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 600 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 600 }} />
                        <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="tickets" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Donut Chart Container */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col h-[400px]">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <PieChartIcon size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Equipos Problemáticos</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Distribución de Fallas</p>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                        <Pie
                            data={failingDevices}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                        >
                            {failingDevices.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            iconSize={10}
                            wrapperStyle={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
);

const AdminDashboard = ({ onLogout }) => {
    const [currentView, setCurrentView] = useState('Dashboard');
    const [activeTab, setActiveTab] = useState('Overview');

    const renderView = () => {
        switch (currentView) {
            case 'Tickets':
                return <TicketsModule />;
            case 'Inventory':
                return <InventoryView />;
            case 'Activities':
                return <ActivitiesView />;
            case 'Reports':
                return <ReportsView />;
            case 'Users':
                return <UsersView />;
            case 'Dashboard':
            default:
                return (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {statsData.map((stat) => (
                                <StatCard key={stat.id} {...stat} />
                            ))}
                        </div>
                        <ChartSection />
                        <TicketsModule />
                    </>
                );
        }
    };

    return (
        <div className="flex min-h-screen bg-[#f3f4f6] dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans selection:bg-blue-500/30 transition-colors duration-300">
            <Sidebar activeItem={currentView} onSelectItem={setCurrentView} />

            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <Header userRole="admin" onLogout={onLogout} />

                <main className="p-8 lg:p-10 max-w-7xl mx-auto w-full">
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
                                        className={`px-5 py-2 text-sm font-bold transition-all rounded-xl ${activeTab === tab
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
