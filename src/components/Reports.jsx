import React from 'react';
import { FileText, Download, Eye, TrendingUp, Clock, ShieldCheck, Zap, Filter, Search } from 'lucide-react';
const reportsList = [];
const reportStats = { efficiency: '0%', avgResolution: '0 hrs', compliance: '0%', costSavings: '$0' };
import StatCard from './StatCard';

const ReportsView = () => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Métricas de Reportes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Eficiencia Operativa" value={reportStats.efficiency} trend="+2.4%" icon={Zap} color="text-yellow-600" bg="bg-amber-100" />
                <StatCard label="Resolución Promedio" value={reportStats.avgResolution} trend="-15m" icon={Clock} color="text-blue-600" bg="bg-blue-100" />
                <StatCard label="Cumplimiento SLA" value={reportStats.compliance} trend="Estable" icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="Ahorro Estimado" value={reportStats.costSavings} trend="Anual" icon={TrendingUp} color="text-purple-600" bg="bg-purple-100" />
            </div>

            {/* Contenedor Principal de Reportes */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors duration-300">
                <div className="p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Centro de Reportes</h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Análisis de Datos y Exportación</p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="flex-1 md:w-64 flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-blue-500 transition-all group">
                            <Search size={16} className="group-focus-within:text-blue-500" />
                            <input
                                type="text"
                                placeholder="Filtrar reportes..."
                                className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            />
                        </div>
                        <button className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Nombre del Reporte</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Categoría</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-center">Formato</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Fecha de Generación</th>
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {reportsList.map((report) => (
                                <tr key={report.id} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                                                <FileText size={20} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-slate-200">{report.title}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{report.size}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                                        {report.category}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${report.type === 'PDF'
                                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                                            }`}>
                                            {report.type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 dark:text-slate-500 font-medium">
                                        {report.date}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm">
                                                <Eye size={18} />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm">
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
