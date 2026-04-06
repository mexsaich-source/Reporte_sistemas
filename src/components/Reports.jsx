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

const normalizeIncidentTitle = (title = '') => {
    const cleaned = String(title || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return 'Sin descripcion';
    return cleaned.split(' ').slice(0, 5).join(' ');
};

const toTitleCase = (text = '') =>
    String(text || '')
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

const getAssetLabel = (ticket, assetsById = {}, assetsBySerial = {}) => {
    const byId = ticket?.asset_id ? assetsById[String(ticket.asset_id)] : null;
    const bySerial = ticket?.asset_serial_number ? assetsBySerial[String(ticket.asset_serial_number).toLowerCase()] : null;
    const asset = byId || bySerial;

    if (asset) {
        const base = [asset.type || 'Equipo', asset.brand || null, asset.model || null].filter(Boolean).join(' · ');
        const serial = asset.serial || ticket?.asset_serial_number || asset.id;
        const owner = asset.assignedToName ? `Usuario: ${asset.assignedToName}` : 'Infraestructura TI';
        return `${base || 'Equipo'} · ${serial} · ${owner}`;
    }

    const fallback = ticket?.asset_id || ticket?.asset_serial_number || ticket?.device_type;
    return fallback ? String(fallback) : 'Sin equipo identificado';
};

const resolveAssetFromTicket = (ticket, assetsById = {}, assetsBySerial = {}) => {
    const byId = ticket?.asset_id ? assetsById[String(ticket.asset_id)] : null;
    const bySerial = ticket?.asset_serial_number ? assetsBySerial[String(ticket.asset_serial_number).toLowerCase()] : null;
    return byId || bySerial || null;
};

const ReportsView = ({ searchTerm = '' }) => {
    const [tickets, setTickets] = useState([]);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);

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
            } catch (err) {
                console.error("Error loading reports data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredTickets = React.useMemo(() => {
        if (!searchTerm) return tickets;
        const s = searchTerm.toLowerCase();
        return tickets.filter(t => 
            (t.id && String(t.id).toLowerCase().includes(s)) ||
            (t.title && t.title.toLowerCase().includes(s)) ||
            (t.status && t.status.toLowerCase().includes(s)) ||
            (t.urgency && t.urgency.toLowerCase().includes(s)) ||
            (t.description && t.description.toLowerCase().includes(s)) ||
            (t.asset_id && t.asset_id.toLowerCase().includes(s)) ||
            (t.asset_serial_number && t.asset_serial_number.toLowerCase().includes(s)) ||
            (t.device_type && t.device_type.toLowerCase().includes(s))
        );
    }, [tickets, searchTerm]);

    const failureAnalytics = React.useMemo(() => {
        const assetsById = (assets || []).reduce((acc, a) => {
            acc[String(a.id)] = a;
            return acc;
        }, {});
        const assetsBySerial = (assets || []).reduce((acc, a) => {
            const serial = (a.serial || '').toString().toLowerCase().trim();
            if (serial) acc[serial] = a;
            return acc;
        }, {});

        // 1. Top equipos con mas fallas
        const typeCount = {};
        filteredTickets.forEach(t => {
            const matchedType = getAssetLabel(t, assetsById, assetsBySerial);
            typeCount[matchedType] = (typeCount[matchedType] || 0) + 1;
        });
        const byType = Object.entries(typeCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // 1.1 Top equipos de usuario final vs infraestructura
        const endUserCount = {};
        const infraCount = {};
        let unresolvedAssetRef = 0;

        filteredTickets.forEach((t) => {
            const matchedAsset = resolveAssetFromTicket(t, assetsById, assetsBySerial);
            const label = getAssetLabel(t, assetsById, assetsBySerial);

            if (!matchedAsset) {
                unresolvedAssetRef += 1;
                return;
            }

            if (matchedAsset.assigned_to) {
                endUserCount[label] = (endUserCount[label] || 0) + 1;
            } else {
                infraCount[label] = (infraCount[label] || 0) + 1;
            }
        });

        const byEndUserAssets = Object.entries(endUserCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

        const byInfraAssets = Object.entries(infraCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

        // 2. Incidentes mas comunes (por titulo normalizado)
        const incidentCount = {};
        filteredTickets.forEach(t => {
            const key = normalizeIncidentTitle(t.title || t.description || 'Sin descripcion');
            incidentCount[key] = (incidentCount[key] || 0) + 1;
        });
        const topIncidents = Object.entries(incidentCount)
            .map(([name, value]) => ({ name: toTitleCase(name), value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // 3. Tickets by Urgency
        const urgencyCount = {};
        filteredTickets.forEach(t => {
            const u = t.urgency || 'medium';
            const label = u.charAt(0).toUpperCase() + u.slice(1);
            urgencyCount[label] = (urgencyCount[label] || 0) + 1;
        });
        const byUrgency = Object.entries(urgencyCount).map(([name, value]) => ({ name, value }));

        // 4. Resolution Trend
        const last5Days = Array.from({length: 5}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (4 - i));
            return d.toLocaleDateString([], { weekday: 'short' });
        });

        const trendData = last5Days.map(day => {
            const count = filteredTickets.filter(t => 
                new Date(t.created_at).toLocaleDateString([], { weekday: 'short' }) === day
            ).length;
            return { name: day, tickets: count };
        });

        return {
            byType,
            byEndUserAssets,
            byInfraAssets,
            unresolvedAssetRef,
            topIncidents,
            byUrgency,
            resolutionTrend: trendData
        };
    }, [filteredTickets, assets]);

    const generateCSV = () => {
        // SECURITY FIX #9: Prevenir CSV Injection
        // Saneamos cada valor para evitar que ejecute fórmulas en Excel
        const sanitizeCSV = (val) => {
            const str = String(val ?? '').replace(/"/g, '""'); // Escapar comillas dobles
            // Bloquear inicio de fórmulas maliciosas (=, +, -, @)
            const dangerous = ['=', '+', '-', '@', '\t', '\r'];
            if (dangerous.some(c => str.startsWith(c))) {
                return `"'${str}"`; // Prefijar con apóstrofe para forzar texto
            }
            return `"${str}"`;
        };

        const headers = ["ID", "Título", "Incidente Normalizado", "Equipo", "Estado", "Urgencia", "Fecha Creación"];
        const assetsById = (assets || []).reduce((acc, a) => {
            acc[String(a.id)] = a;
            return acc;
        }, {});
        const assetsBySerial = (assets || []).reduce((acc, a) => {
            const serial = (a.serial || '').toString().toLowerCase().trim();
            if (serial) acc[serial] = a;
            return acc;
        }, {});
        const rows = filteredTickets.map(t => [
            sanitizeCSV(t.id),
            sanitizeCSV(t.title),
            sanitizeCSV(toTitleCase(normalizeIncidentTitle(t.title || t.description || 'Sin descripcion'))),
            sanitizeCSV(getAssetLabel(t, assetsById, assetsBySerial)),
            sanitizeCSV(t.status),
            sanitizeCSV(t.urgency),
            sanitizeCSV(t.created_at)
        ]);
        const content = [headers.map(sanitizeCSV), ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' }); // BOM para UTF-8 en Excel
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_tickets_${new Date().toISOString().slice(0,10)}.csv`);
        link.click();
        URL.revokeObjectURL(url); // Limpiar URL en memoria
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
                <StatCard label="Total Tickets" value={filteredTickets.length} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-100" />
                <StatCard label="Equipos en Inventario" value={assets.length} icon={Hammer} color="text-blue-600" bg="bg-blue-100" />
                <StatCard label="Tickets Resueltos" value={filteredTickets.filter(t => t.status === 'resolved').length} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="Tasa de Falla" value={`${((filteredTickets.length / (assets.length || 1)) * 10).toFixed(1)}%`} icon={TrendingUp} color="text-amber-600" bg="bg-amber-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Fallas por Tipo de Equipo */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Fallas por Equipo</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Equipos con mayor recurrencia de tickets</p>
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

                {/* Top Incidentes Comunes */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Incidentes Más Comunes</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Top 10 patrones por descripción reportada</p>
                        </div>
                        <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
                            <FileText size={24} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {failureAnalytics.topIncidents.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin datos para calcular incidentes comunes.</p>
                        ) : (
                            failureAnalytics.topIncidents.map((item, index) => (
                                <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/40">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="inline-flex w-6 h-6 items-center justify-center text-[10px] font-black rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">{index + 1}</span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.value} casos</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Ranking Usuario Final */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Equipos de Usuario con Más Fallas</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Solo equipos asignados a colaboradores</p>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <CheckCircle2 size={24} />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {failureAnalytics.byEndUserAssets.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin datos suficientes en equipos de usuario.</p>
                        ) : (
                            failureAnalytics.byEndUserAssets.map((item, index) => (
                                <div key={`${item.name}-u-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/40">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="inline-flex w-6 h-6 items-center justify-center text-[10px] font-black rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">{index + 1}</span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.value} casos</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Ranking Infraestructura */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Infraestructura TI con Más Fallas</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Switches, red, servidores y equipos sin dueño</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                            <Hammer size={24} />
                        </div>
                    </div>
                    <div className="space-y-3 mb-4">
                        {failureAnalytics.byInfraAssets.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin datos suficientes en infraestructura TI.</p>
                        ) : (
                            failureAnalytics.byInfraAssets.map((item, index) => (
                                <div key={`${item.name}-i-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/40">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="inline-flex w-6 h-6 items-center justify-center text-[10px] font-black rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">{index + 1}</span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{item.value} casos</span>
                                </div>
                            ))
                        )}
                    </div>
                    {failureAnalytics.unresolvedAssetRef > 0 && (
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            {failureAnalytics.unresolvedAssetRef} ticket(s) no pudieron vincularse a un activo real por falta de asset_id/serie.
                        </p>
                    )}
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
