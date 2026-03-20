import React, { useState, useEffect } from 'react';
import { FileText, Download, TrendingUp, Clock, ShieldCheck, Zap, Filter, Search, AlertTriangle, Hammer, CheckCircle2 } from 'lucide-react';
import StatCard from './StatCard';
import { ticketService } from '../services/ticketService';
import { inventoryService } from '../services/inventoryService';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981'];

const ReportsView = () => {
    const [tickets, setTickets] = useState([]);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [failureAnalytics, setFailureAnalytics] = useState({
        byType: [],
        byUrgency: [],
        resolutionTrend: []
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [ticketsData, assetsData] = await Promise.all([
                    ticketService.getAll(),
                    inventoryService.getAll()
                ]);
                
                setTickets(ticketsData);
                setAssets(assetsData);
                
                // Process Failure Analytics
                analyzeData(ticketsData, assetsData);
            } catch (err) {
                console.error("Error loading reports data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analyzeData = (ticketsData, assetsData) => {
        // 1. Failures by Device Type
        const typeCount = {};
        ticketsData.forEach(t => {
            const matchedType = t.device_type || 'General';
            typeCount[matchedType] = (typeCount[matchedType] || 0) + 1;
        });

        const byType = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

        // 2. Tickets by Urgency
        const urgencyCount = {};
        ticketsData.forEach(t => {
            const u = t.urgency || 'medium';
            const label = u.charAt(0).toUpperCase() + u.slice(1);
            urgencyCount[label] = (urgencyCount[label] || 0) + 1;
        });
        const byUrgency = Object.entries(urgencyCount).map(([name, value]) => ({ name, value }));

        // 3. Resolution Trend (Real usage of ticket dates)
        const last5Days = Array.from({length: 5}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (4 - i));
            return d.toLocaleDateString([], { weekday: 'short' });
        });

        const trendData = last5Days.map(day => {
            const count = ticketsData.filter(t => 
                new Date(t.created_at).toLocaleDateString([], { weekday: 'short' }) === day
            ).length;
            return { name: day, tickets: count };
        });

        setFailureAnalytics({
            byType,
            byUrgency,
            resolutionTrend: trendData
        });
    };

    const generateCSV = () => {
        const headers = ["ID", "Título", "Estado", "Urgencia", "Fecha Creación"];
        const rows = tickets.map(t => [t.id, t.title, t.status, t.urgency, t.created_at]);
        const content = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_equipos_${new Date().toISOString().slice(0,10)}.csv`);
        link.click();
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest gap-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            Analizando Infraestructura...
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Tickets" value={tickets.length} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-100" />
                <StatCard label="Equipos en Inventario" value={assets.length} icon={Hammer} color="text-blue-600" bg="bg-blue-100" />
                <StatCard label="Tickets Resueltos" value={tickets.filter(t => t.status === 'resolved').length} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="Tasa de Falla" value={`${((tickets.length / (assets.length || 1)) * 10).toFixed(1)}%`} icon={TrendingUp} color="text-amber-600" bg="bg-amber-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Fallas por Tipo de Equipo */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Fallas por Equipo</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Identificando lo más problemático</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={failureAnalytics.byType}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Composición de Urgencia */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Densidad de Urgencia</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Crucial para prioridad</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                            <Zap size={24} />
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={failureAnalytics.byUrgency} innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value" stroke="none">
                                    {failureAnalytics.byUrgency.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <button 
                    onClick={generateCSV}
                    className="flex items-center gap-3 bg-slate-900 dark:bg-blue-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-blue-600 dark:hover:bg-blue-500 transition-all hover:-translate-y-1 active:scale-95 border border-white/10"
                >
                    <Download size={20} />
                    Generar Reporte Integral
                </button>
            </div>
        </div>
    );
};

export default ReportsView;
