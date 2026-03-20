import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Clock, AlertTriangle, Package, User, Calendar as CalendarIcon, ChevronRight, ArrowRightLeft } from 'lucide-react';
import StatCard from './StatCard';
import { inventoryService } from '../services/inventoryService';

const StatusBadge = ({ status, daysRemaining }) => {
    const config = {
        'request_pending': { label: 'Solicitud Pendiente', styles: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' },
        'loaned': { label: 'Aprobado', styles: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' },
        'delivered': { label: 'Entregado (Oficina)', styles: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20' },
        'received': { label: 'Recibido por Usuario', styles: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' },
        'returned': { label: 'Devuelto (Pendiente)', styles: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' },
        'denied': { label: 'Rechazado', styles: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20' },
        'available': { label: 'En Bodega', styles: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' }
    };

    const s = config[status] || config['loaned'];
    let label = s.label;

    if (status === 'loaned') {
        if (daysRemaining < 0) label = `Retrasado (${Math.abs(daysRemaining)}d)`;
        else if (daysRemaining <= 2) label = `Por vencer (${daysRemaining}d)`;
    }

    return (
        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${s.styles}`}>
            {label}
        </span>
    );
};

const ActivitiesView = () => {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalActive: 0, pending: 0, delayed: 0, available: 0 });

    const fetchLoans = async () => {
        setLoading(true);
        try {
            const data = await inventoryService.getAll();
            const relevantStatuses = ['loaned', 'request_pending', 'delivered', 'received', 'returned', 'denied'];
            const filteredData = data.filter(item => relevantStatuses.includes(item.status));
            
            const today = new Date();
            today.setHours(0,0,0,0);

            const processedLoans = filteredData.map(item => {
                const returnDate = item.returnDate ? new Date(item.returnDate) : null;
                let daysRemaining = null;
                if (returnDate) {
                    const diffTime = returnDate - today;
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
                return { ...item, daysRemaining };
            });

            setLoans(processedLoans);
            
            setStats({
                totalActive: data.filter(i => i.status === 'loaned').length,
                pending: data.filter(i => i.status === 'request_pending').length,
                delayed: processedLoans.filter(l => l.status === 'loaned' && l.daysRemaining !== null && l.daysRemaining < 0).length,
                available: data.filter(i => i.status === 'available').length
            });
        } catch (err) {
            console.error("Error fetching activities:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLoans(); }, []);

    const handleApprove = async (id) => {
        if (confirm('¿Aprobar este préstamo?')) {
            await inventoryService.update(id, { status: 'loaned' });
            fetchLoans();
        }
    };

    const handleDeny = async (id) => {
        const reason = prompt('Motivo del rechazo:');
        if (reason) {
            await inventoryService.update(id, { status: 'denied', rejectReason: reason });
            fetchLoans();
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest gap-4">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            Sincronizando Calendario...
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Resumen de Préstamos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Préstamos Activos" value={stats.totalActive} icon={ArrowRightLeft} color="text-purple-600" bg="bg-purple-100" />
                <StatCard label="Solicitudes" value={stats.pending} icon={Clock} color="text-amber-600" bg="bg-amber-100" />
                <StatCard label="Retrasados" value={stats.delayed} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-100" />
                <StatCard label="Stock Bodega" value={stats.available} icon={Package} color="text-blue-600" bg="bg-blue-100" />
            </div>

            {/* Registro de Préstamos */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Préstamos</h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Aprobaciones y seguimiento de solicitudes</p>
                    </div>
                </div>

                <div className="overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Equipo / Usuario</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado / Alerta</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Programación</th>
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Acciones de Admin</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loans.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                                        No hay solicitudes o préstamos activos.
                                    </td>
                                </tr>
                            ) : loans.map((loan) => (
                                <tr key={loan.id} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
                                                <User size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-slate-200">{loan.loanUser || 'Usuario Desconocido'}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{loan.type} - {loan.brand} {loan.model}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <StatusBadge status={loan.status} daysRemaining={loan.daysRemaining} />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Entrega: {loan.loanDate || 'N/A'}</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-bold">Devuelve: {loan.returnDate || 'Abierta'}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        {loan.status === 'request_pending' && (
                                            <div className="flex flex-col items-end gap-2">
                                                {loan.requestReason && (
                                                    <div className="text-[10px] bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-slate-500 italic mb-1 max-w-[200px] whitespace-normal">
                                                        Motivo: {loan.requestReason}
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleApprove(loan.id)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-500">Aprobar</button>
                                                    <button onClick={() => handleDeny(loan.id)} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-500/20 hover:bg-rose-500">Rechazar</button>
                                                </div>
                                            </div>
                                        )}
                                        {loan.status === 'loaned' && (
                                            <button onClick={() => inventoryService.update(loan.id, { status: 'delivered', deliveredAt: new Date().toISOString() }).then(fetchLoans)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 hover:bg-black transition-all">Entregar Equipo</button>
                                        )}
                                        {(loan.status === 'delivered' || loan.status === 'received') && (
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Esperando Devolución...</span>
                                        )}
                                        {loan.status === 'returned' && (
                                            <button onClick={() => inventoryService.update(loan.id, { status: 'available' }).then(fetchLoans)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-all">Confirmar Recepción</button>
                                        )}
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

