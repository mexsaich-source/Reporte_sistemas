import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Clock, FileText, CheckCircle, AlertCircle, User, Download } from 'lucide-react';

const ImportLogsView = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('import_logs')
                .select(`
                    *,
                    profiles:user_id (full_name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data);
        } catch (error) {
            console.error("Error fetching import logs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    if (loading) {
        return (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold uppercase tracking-widest text-xs">Cargando Historial...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Historial de Importaciones</h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Registro de cargas masivas realizadas</p>
                    </div>
                    <button onClick={fetchLogs} className="p-3 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <Clock size={20} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                                <th className="px-8 py-5">Fecha y Usuario</th>
                                <th className="px-6 py-5">Archivo / Tipo</th>
                                <th className="px-6 py-5">Resultado</th>
                                <th className="px-6 py-5 text-right">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center text-slate-400 italic">
                                        No hay registros de importación disponibles.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                                    <User size={20} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 dark:text-white leading-tight">{log.profiles?.full_name || 'Admin'}</span>
                                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-blue-600 dark:text-blue-400 text-xs uppercase tracking-widest font-mono truncate max-w-[150px]">
                                                    {log.file_name}
                                                </span>
                                                <span className={`text-[10px] font-bold mt-1 uppercase tracking-tighter ${log.import_type === 'users' ? 'text-indigo-500' : 'text-emerald-500'}`}>
                                                    {log.import_type === 'users' ? 'Personal' : 'Inventario'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-medium">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-base">{log.new_records}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Nuevos</span>
                                                </div>
                                                <div className="w-px h-6 bg-slate-100 dark:bg-slate-800"></div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-amber-600 dark:text-amber-400 font-black text-base">{log.updated_records}</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Sync</span>
                                                </div>
                                                {log.errors > 0 && (
                                                    <>
                                                        <div className="w-px h-6 bg-slate-100 dark:bg-slate-800"></div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-rose-600 dark:text-rose-400 font-black text-base">{log.errors}</span>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-rose-500">Errores</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-200/50 dark:border-slate-700/50">
                                                <CheckCircle size={12} className="text-emerald-500" />
                                                Cerrado
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ImportLogsView;
