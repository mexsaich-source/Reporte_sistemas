import React, { useState } from 'react';
import { Send, X, AlertCircle, Laptop, Settings, Smartphone, Monitor, ImagePlus } from 'lucide-react';

const NewTicketForm = ({ onCancel }) => {
    const [deviceType, setDeviceType] = useState('Laptop');

    const deviceTypes = [
        { id: 'Laptop', icon: Laptop },
        { id: 'Monitor', icon: Monitor },
        { id: 'Desktop', icon: Settings }, // Using Settings as PC icon for variety
        { id: 'Phone', icon: Smartphone },
    ];

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                        <AlertCircle size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-950 text-xl tracking-tight">Reportar Falla Técnica</h3>
                        <p className="text-xs text-slate-500 font-medium">Completa los detalles para asignar un soporte.</p>
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="p-10">
                <form className="space-y-8 max-w-2xl mx-auto">
                    {/* Device Selection Grid */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">1. Tipo de Dispositivo</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {deviceTypes.map((type) => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setDeviceType(type.id)}
                                    className={`flex flex-col items-center gap-3 p-5 rounded-3xl border-2 transition-all duration-300 ${deviceType === type.id
                                        ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-lg shadow-blue-500/5'
                                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <type.icon size={28} strokeWidth={deviceType === type.id ? 2.5 : 2} />
                                    <span className="text-xs font-black uppercase tracking-widest">{type.id}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Título del Problema</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Laptop no conecta a WiFi"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-5 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all font-medium text-sm"
                                />
                            </div>
                            <div className="group space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">ID de Activo / Asset Tag</label>
                                <input
                                    type="text"
                                    placeholder="Ej: MEX-LAP-042"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-5 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nivel de Urgencia</label>
                            <div className="flex gap-2">
                                {['Baja', 'Media', 'Alta', 'Crítica'].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${level === 'Media'
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                                            }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Descripción Detallada</label>
                            <textarea
                                placeholder="Explique paso a paso el problema..."
                                rows="3"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-5 py-4 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 transition-all placeholder:text-slate-400 font-medium text-sm resize-none"
                            ></textarea>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Evidencia Visual (Opcional)</label>
                            <label className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 rounded-3xl p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group-hover:bg-slate-50">
                                <input type="file" className="hidden" accept="image/*" />
                                <div className="bg-white p-2.5 rounded-full shadow-sm text-blue-500 mb-1">
                                    <ImagePlus size={20} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-700">Subir Captura de Pantalla</p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">PNG, JPG hasta 5MB</p>
                                </div>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2 text-slate-400 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                                <div className="bg-white p-2 rounded-xl shadow-sm">
                                    <AlertCircle size={18} className="text-emerald-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-tight">Ubicación Actual</span>
                                    <span className="text-xs font-bold text-slate-700 leading-tight">Detección Automática por Red</span>
                                </div>
                            </div>
                            <div className="space-y-2 text-slate-400 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <div className="bg-white p-2 rounded-xl shadow-sm">
                                    <AlertCircle size={18} className="text-blue-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Tiempo de Respuesta</span>
                                    <span className="text-xs font-bold text-slate-700 leading-tight">SLA Estándar (4h laborables)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-8 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-50 hover:border-slate-300 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            onClick={(e) => { e.preventDefault(); onCancel(); }}
                            className="flex-[2] bg-slate-950 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 hover:bg-blue-600 hover:shadow-blue-600/20 transition-all hover:-translate-y-1 active:scale-95"
                        >
                            <Send size={18} />
                            Crear Reporte IT
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewTicketForm;
