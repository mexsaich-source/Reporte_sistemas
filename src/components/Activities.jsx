import React from 'react';
import { Activity, CheckCircle2, Clock, AlertTriangle, Hammer, Globe, Shield, Code, ChevronRight } from 'lucide-react';
const activitiesData = [];
const activityStats = { total: 0, completed: 0, pending: 0, delayed: 0 };
import StatCard from './StatCard';

const PriorityBadge = ({ priority }) => {
    const config = {
        'Critical': 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20',
        'High': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20',
        'Medium': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20'
    };
    return (
        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${config[priority] || config.Medium}`}>
            {priority}
        </span>
    );
};

const ActivityTypeIcon = ({ type }) => {
    const config = {
        'System': { icon: Hammer, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800' },
        'Software': { icon: Code, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
        'Security': { icon: Shield, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
        'Network': { icon: Globe, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' }
    };
    const { icon: Icon, color } = config[type] || config.System;
    return (
        <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon size={18} />
        </div>
    );
};

const ActivitiesView = () => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Resumen de Actividades */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Mensual" value={activityStats.total} trend="Activas" icon={Activity} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Completadas" value={activityStats.completed} trend="~67%" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="En Espera" value={activityStats.pending} trend="Pendiente" icon={Clock} color="text-amber-600" bg="bg-amber-100" />
                <StatCard label="Retrasadas" value={activityStats.delayed} trend="Urgente" icon={AlertTriangle} color="text-rose-600" bg="bg-rose-100" />
            </div>

            {/* Log de Actividades */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors duration-300">
                <div className="p-8 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Registro de Operaciones</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Monitoreo de tareas y mantenimiento</p>
                </div>

                <div className="overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Actividad</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Prioridad</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Programación</th>
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {activitiesData.map((activity) => (
                                <tr key={activity.id} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-4">
                                            <ActivityTypeIcon type={activity.type} />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-slate-200">{activity.title}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activity.type}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${activity.status === 'Completed' ? 'bg-emerald-500' :
                                                activity.status === 'In Progress' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
                                                }`}></div>
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">{activity.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <PriorityBadge priority={activity.priority} />
                                    </td>
                                    <td className="p-4 text-slate-500 dark:text-slate-500 font-medium">
                                        {activity.date}
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button className="p-2 text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                            <ChevronRight size={18} />
                                        </button>
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

export default ActivitiesView;
