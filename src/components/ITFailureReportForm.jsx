import React, { useState } from 'react';
import { AlertCircle, Send, X } from 'lucide-react';
import { useAuth } from '../context/authStore';
import { ticketService } from '../services/ticketService';

const ITFailureReportForm = ({ onCancel, onSuccess }) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState('Media');
    const [assetTag, setAssetTag] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) {
            setError('Título y descripción son obligatorios.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const urgencyMap = {
                Baja: 'low',
                Media: 'medium',
                Alta: 'high',
                Critica: 'critical',
            };

            const fullDescription = `[Origen: Ingeniería/Mantenimiento -> TI]\n${assetTag.trim() ? `[Serie/Activo: ${assetTag.trim()}]\n` : ''}${description.trim()}`;

            const created = await ticketService.create({
                title: title.trim(),
                description: fullDescription,
                urgency: urgencyMap[urgency] || 'medium',
                status: 'pending_admin',
                reported_by: user?.id,
            });

            if (!created?.id) throw new Error('No se pudo crear el reporte de falla TI.');

            if (onSuccess) onSuccess(created);
        } catch (err) {
            setError(err?.message || 'Error creando reporte.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-blue-600 text-white">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">Reportar Falla TI</h3>
                        <p className="text-xs text-slate-500">Canal exclusivo de Ingeniería/Mantenimiento hacia Sistemas.</p>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-w-3xl">
                {error && (
                    <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-semibold">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Título</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Falla de red en estación de ingeniería"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Serie o Activo (Opcional)</label>
                    <input
                        type="text"
                        value={assetTag}
                        onChange={(e) => setAssetTag(e.target.value)}
                        placeholder="Ej: MEX-LT-009"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Urgencia</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {['Baja', 'Media', 'Alta', 'Critica'].map((level) => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setUrgency(level)}
                                className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${urgency === level
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descripción</label>
                    <textarea
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe la falla TI detectada por ingeniería..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onCancel} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 text-slate-600">
                        Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-600 text-white inline-flex items-center gap-2 disabled:opacity-60">
                        <Send size={14} />
                        {loading ? 'Enviando...' : 'Crear Reporte TI'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ITFailureReportForm;
