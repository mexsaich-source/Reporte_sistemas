import React, { useState, useEffect } from 'react';
import { X, MessageSquare, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/authStore';
import { userService } from '../services/userService';
import { supabase } from '../lib/supabaseClient';

const TELEGRAM_TOKEN_RE = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;

function extractTelegramBotToken(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (TELEGRAM_TOKEN_RE.test(raw)) return raw;

    const fromInline = raw.match(/bot(\d{5,}:[A-Za-z0-9_-]{20,})/i)?.[1];
    if (fromInline && TELEGRAM_TOKEN_RE.test(fromInline)) return fromInline;

    try {
        const parsed = new URL(raw);
        const fromPath = parsed.pathname.match(/\/bot(\d{5,}:[A-Za-z0-9_-]{20,})(?:\/|$)/i)?.[1];
        if (fromPath && TELEGRAM_TOKEN_RE.test(fromPath)) return fromPath;
        const fromQuery = parsed.searchParams.get('token') || '';
        if (fromQuery && TELEGRAM_TOKEN_RE.test(fromQuery)) return fromQuery;
    } catch {
        // Ignorar: no es URL válida.
    }

    return '';
}

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const { user, profile } = useAuth();
    const [testing, setTesting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    
    const [formData, setFormData] = useState({
        whatsapp_phone: ''
    });
    const [areaSettings, setAreaSettings] = useState({
        area: '',
        telegram_bot_token: '',
        smtp_user: '',
        smtp_pass: '',
        smtp_from_name: '',
    });
    const [areaUpdatedAt, setAreaUpdatedAt] = useState('');
    const [quickSetup, setQuickSetup] = useState({
        smtp_user: '',
        smtp_pass: '',
        bot_url: '',
    });
    const [quickSaving, setQuickSaving] = useState(false);

    const department = (profile?.department || '').toLowerCase().trim();
    const role = (profile?.role || '').toLowerCase().trim();
    const isMaintArea = department.includes('mantenimiento') || department.includes('ingenieria') || department.includes('ingeniería');
    const canManageAreaSettings = role === 'admin' || role === 'jefe_mantenimiento';
    const myArea = role === 'jefe_mantenimiento' ? 'ING' : (isMaintArea ? 'ING' : 'IT');

    useEffect(() => {
        if (isOpen && profile) {
            const chatIdFromProfile = (profile?.telegram_chat_id || profile?.whatsapp_phone || '').toString().trim();
            setFormData({
                whatsapp_phone: chatIdFromProfile
            });
            setSuccessMsg('');
            setErrorMsg('');
            setAreaUpdatedAt('');
            setQuickSetup({
                smtp_user: '',
                smtp_pass: '',
                bot_url: '',
            });
        }
    }, [isOpen, profile]);

    useEffect(() => {
        let mounted = true;

        const loadChatIdFromDb = async () => {
            if (!isOpen || !user?.id) return;

            const { data: profileRow, error: profileErr } = await supabase
                .from('profiles')
                .select('telegram_chat_id, whatsapp_phone')
                .eq('id', user.id)
                .maybeSingle();

            if (!mounted || profileErr) return;

            const liveChatId = (profileRow?.telegram_chat_id || profileRow?.whatsapp_phone || '').toString().trim();

            setFormData((prev) => ({
                ...prev,
                whatsapp_phone: liveChatId,
            }));
        };

        loadChatIdFromDb();

        return () => {
            mounted = false;
        };
    }, [isOpen, user?.id]);

    useEffect(() => {
        let mounted = true;
        const loadAreaSettings = async () => {
            if (!isOpen || !canManageAreaSettings) return;
            const res = await userService.getMyAreaNotificationSettings();
            if (!mounted) return;

            setAreaSettings((prev) => ({
                ...prev,
                area: myArea,
                telegram_bot_token: res?.data?.telegram_bot_token || '',
                smtp_user: res?.data?.smtp_user || '',
                smtp_pass: res?.data?.smtp_pass || '',
                smtp_from_name: res?.data?.smtp_from_name || '',
            }));
            setAreaUpdatedAt(res?.data?.updated_at || '');
            setQuickSetup({
                smtp_user: res?.data?.smtp_user || '',
                smtp_pass: res?.data?.smtp_pass || '',
                bot_url: res?.data?.telegram_bot_token || '',
            });
        };

        loadAreaSettings();
        return () => {
            mounted = false;
        };
    }, [isOpen, canManageAreaSettings, myArea]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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

    const handleQuickSetupSave = async () => {
        const smtpUser = quickSetup.smtp_user.trim();
        const smtpPass = quickSetup.smtp_pass.trim();
        const botInput = quickSetup.bot_url.trim();
        const parsedBotToken = extractTelegramBotToken(botInput);

        if (!smtpUser || !smtpPass) {
            setErrorMsg('Completa correo remitente y contraseña de aplicación.');
            return;
        }

        if (botInput && !parsedBotToken) {
            setErrorMsg('El dato del bot no es válido. Pega token (123456:AA...) o URL oficial de Telegram Bot API.');
            return;
        }

        setQuickSaving(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const defaultFromName = smtpUser.includes('@') ? smtpUser.split('@')[0] : 'Notificaciones';
            const result = await userService.saveMyAreaNotificationSettings({
                telegram_bot_token: parsedBotToken || areaSettings.telegram_bot_token || '',
                smtp_host: 'smtp.gmail.com',
                smtp_port: 465,
                smtp_user: smtpUser,
                smtp_pass: smtpPass,
                smtp_from_name: areaSettings.smtp_from_name || defaultFromName,
                meta_access_token: '',
                meta_phone_number_id: '',
            });

            if (!result.success) {
                throw new Error(result.error || 'No se pudo guardar configuración rápida.');
            }

            const reload = await userService.getMyAreaNotificationSettings();
            if (reload.success && reload.data) {
                setAreaSettings((prev) => ({
                    ...prev,
                    area: myArea,
                    telegram_bot_token: reload.data.telegram_bot_token || '',
                    smtp_user: reload.data.smtp_user || '',
                    smtp_pass: reload.data.smtp_pass || '',
                    smtp_from_name: reload.data.smtp_from_name || '',
                }));
                setQuickSetup((prev) => ({
                    ...prev,
                    bot_url: reload.data.telegram_bot_token || '',
                }));
                setAreaUpdatedAt(reload.data.updated_at || '');
            }

            setSuccessMsg('SMTP guardado. Host y puerto quedaron configurados por defecto.');
        } catch (err) {
            setErrorMsg(err.message || 'No se pudo guardar la configuración rápida.');
        } finally {
            setQuickSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                
                {/* Header */}
                <div className="p-5 pb-3 sm:p-6 sm:pb-3 flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-slate-800/80">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Notificaciones</h2>
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-1">Configuración Omnicanal Automática</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 rounded-2xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 pt-3 space-y-4 overflow-y-auto">
                    
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

                    <div className="space-y-3">
                        {/* Telegram Chat ID */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Tu Telegram Chat ID (desde base de datos)</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <MessageSquare size={18} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="No configurado"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                                    value={formData.whatsapp_phone}
                                    readOnly
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 ml-1 leading-relaxed italic">
                                Este ID se jala de la BD automáticamente para tus avisos personales.
                            </p>
                        </div>

                        {canManageAreaSettings && (
                            <div className="mt-1 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50/80 dark:bg-emerald-900/10 space-y-3">
                                    <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-[0.2em] block ml-1">Configuración SMTP rápida</label>
                                    <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 ml-1">
                                        Solo escribe correo remitente y contraseña de aplicación. El sistema configura lo demás por defecto.
                                    </p>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Correo remitente</label>
                                            <input
                                                type="email"
                                                placeholder="alertas@tuempresa.com"
                                                className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                                value={quickSetup.smtp_user}
                                                onChange={(e) => setQuickSetup((prev) => ({ ...prev, smtp_user: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Contraseña de aplicación</label>
                                            <input
                                                type="text"
                                                placeholder="abcd efgh ijkl mnop"
                                                className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                                value={quickSetup.smtp_pass}
                                                onChange={(e) => setQuickSetup((prev) => ({ ...prev, smtp_pass: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Bot por área (token o URL)</label>
                                        <input
                                            type="text"
                                            placeholder="123456:AA... o https://api.telegram.org/bot..."
                                            className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl py-3 px-4 text-sm font-bold text-slate-900 dark:text-white outline-none"
                                            value={quickSetup.bot_url}
                                            onChange={(e) => setQuickSetup((prev) => ({ ...prev, bot_url: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleQuickSetupSave}
                                            disabled={quickSaving}
                                            className="px-4 h-10 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                        >
                                            {quickSaving ? 'Guardando...' : 'Guardar SMTP'}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-1">Área administrada</label>
                                    <input
                                        type="text"
                                        value={areaSettings.area || myArea}
                                        readOnly
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 px-4 text-sm font-black text-blue-600 dark:text-blue-400 outline-none"
                                    />
                                    {areaUpdatedAt && (
                                        <p className="text-[10px] text-slate-500 mt-2 ml-1">
                                            Última actualización: {new Date(areaUpdatedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>

                    <div className="pt-1 flex flex-col gap-2.5">
                        <button
                            type="button"
                            onClick={handleTestWhatsApp}
                            disabled={testing || !formData.whatsapp_phone}
                            className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {testing ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} />}
                            {testing ? 'Probando...' : 'Probar Telegram'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettingsModal;
