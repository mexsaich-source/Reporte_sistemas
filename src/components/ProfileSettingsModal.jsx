import React, { useState, useEffect } from 'react';
import { X, Save, MessageSquare, ShieldCheck, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/authStore';
import { userService } from '../services/userService';

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const { user, profile, updateProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    const [formData, setFormData] = useState({
        whatsapp_phone: ''
    });

    useEffect(() => {
        if (isOpen && profile) {
            setFormData({
                whatsapp_phone: profile.whatsapp_phone || ''
            });
            setSuccessMsg('');
            setErrorMsg('');
        }
    }, [isOpen, profile]);

    if (!isOpen) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const success = await userService.updateWhatsAppCredentials(
                user.id, 
                formData.whatsapp_phone, 
                user.id
            );

            if (!success) throw new Error('No se pudo guardar en la base de datos.');
            
            // Actualizar el contexto si existe la función
            if (updateProfile) {
                await updateProfile();
            }
            
            setSuccessMsg('Configuración guardada correctamente.');
            setTimeout(() => onClose(), 1500);
        } catch (err) {
            console.error('Error saving profile settings:', err);
            setErrorMsg('Error al guardar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTestWhatsApp = async () => {
        if (!formData.whatsapp_phone) {
            setErrorMsg('Debes ingresar tu Chat ID de Telegram.');
            return;
        }
        
        setTesting(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const result = await userService.sendTestWhatsApp(
                user.id, 
                formData.whatsapp_phone
            );
            
            if (result.success && result.data && result.data.results) {
                const tgRes = result.data.results.find(r => r.channel === 'telegram');
                const emailRes = result.data.results.find(r => r.channel === 'email');
                
                let detailMsg = '';
                if (tgRes?.status === 'sent' && emailRes?.status === 'sent') {
                    setSuccessMsg('¡Telegram y Email enviados con éxito! 🚀✨');
                } else {
                    if (tgRes?.status === 'sent') detailMsg += '✅ Telegram OK. ';
                    else detailMsg += `❌ Telegram Falló: ${tgRes?.error || tgRes?.reason || 'Error desconocido'}. `;
                    
                    if (emailRes?.status === 'sent') detailMsg += '✅ Email OK.';
                    else detailMsg += `❌ Email Falló: ${emailRes?.error || 'Falla de conexión (SMTP)'}.`;
                    
                    setErrorMsg(detailMsg);
                }
            } else {
                throw new Error(result.error || 'El servidor no respondió con resultados válidos.');
            }
        } catch (err) {
            console.error('Test WhatsApp error:', err);
            setErrorMsg('Error: ' + err.message);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="p-8 pb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Notificaciones</h2>
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">Configuración Omnicanal</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 rounded-2xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-8 pt-4 space-y-6">
                    
                    {/* Alertas */}
                    {successMsg && (
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl animate-in slide-in-from-top-2">
                            <CheckCircle size={18} className="text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{successMsg}</span>
                        </div>
                    )}
                    {errorMsg && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl animate-in slide-in-from-top-2">
                            <AlertCircle size={18} className="text-red-500" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">{errorMsg}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Telegram Chat ID */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Telegram Chat ID</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <MessageSquare size={18} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Ej: 6962000993"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                                    value={formData.whatsapp_phone}
                                    onChange={(e) => setFormData({...formData, whatsapp_phone: e.target.value})}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 ml-1 leading-relaxed italic">
                                Obtén tu ID escribiendo <b>/start</b> al bot <b>@userinfobot</b> en Telegram.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={handleTestWhatsApp}
                            disabled={testing || !formData.whatsapp_phone}
                            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {testing ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                            {testing ? 'Probando...' : 'Probar Telegram'}
                        </button>

                        <button
                            type="submit"
                            disabled={loading || testing}
                            className="w-full h-14 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileSettingsModal;
