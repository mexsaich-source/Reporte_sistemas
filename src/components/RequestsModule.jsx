import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
    Clock, CheckCircle, AlertCircle, Trash2, 
    Check, X, Laptop, User, Calendar, FileText
} from 'lucide-react';
import { TicketStatusBadge } from './TicketsModule';

const RequestsModule = () => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('equipment_requests')
                .select(`
                    *,
                    profiles:user_id (full_name, email, department)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('equipment_requests')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            await loadRequests();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar el estado: ' + error.message);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'rejected': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
            case 'delivered': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            default: return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'approved': return 'Aprobado';
            case 'rejected': return 'Rechazado';
            case 'delivered': return 'Entregado';
            default: return 'Pendiente';
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-50 dark:border-slate-800">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Solicitudes de Equipamiento</h3>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Gestión de recursos solicitados por usuarios</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] text-left">
                                <th className="p-6 pb-4">Usuario / Depto</th>
                                <th className="p-6 pb-4">Equipo / Motivo</th>
                                <th className="p-6 pb-4">Prioridad</th>
                                <th className="p-6 pb-4">Estado</th>
                                <th className="p-6 pb-4">Fecha</th>
                                <th className="p-6 pb-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="p-20 text-center">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No hay solicitudes registradas</td>
                                </tr>
                            ) : requests.map((req) => (
                                <tr key={req.id} className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-white">{req.profiles?.full_name || 'Usuario desconocido'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{req.profiles?.department || 'Sin Depto'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <Laptop size={18} />
                                            </div>
                                            <div className="max-w-[200px]">
                                                <p className="font-bold text-slate-700 dark:text-slate-200">{req.equipment_type}</p>
                                                <p className="text-[10px] text-slate-400 line-clamp-1">{req.reason}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-1.5 font-bold text-xs">
                                            <div className={`w-1.5 h-1.5 rounded-full ${req.urgency === 'Crítica' ? 'bg-rose-500' : req.urgency === 'Alta' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                                            <span className="text-slate-500 dark:text-slate-400">{req.urgency}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(req.status)}`}>
                                            {getStatusLabel(req.status)}
                                        </span>
                                    </td>
                                    <td className="p-6 font-medium text-slate-400 dark:text-slate-500">
                                        {new Date(req.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-6">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button 
                                                        onClick={() => handleUpdateStatus(req.id, 'approved')}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all"
                                                        title="Aprobar"
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateStatus(req.id, 'rejected')}
                                                        className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                                                        title="Rechazar"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </>
                                            )}
                                            {req.status === 'approved' && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(req.id, 'delivered')}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                                                    title="Marcar como Entregado"
                                                >
                                                    <Laptop size={18} />
                                                </button>
                                            )}
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

export default RequestsModule;
