import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/authStore';
import { Navigate } from 'react-router-dom';
import TermsModal from './TermsModal';
import { supabase } from '../lib/supabaseClient';
import { notificationService } from '../services/notificationService';

const Login = () => {
    const { login, user, loading, logout, authError } = useAuth();

    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [termsType, setTermsType] = useState('terms');
    const [mode, setMode] = useState('login'); // login | new-member
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);

    const getAuthRedirectBase = () => {
        const envBase = String(import.meta.env.VITE_AUTH_REDIRECT_BASE || '').trim();
        if (envBase) return envBase.replace(/\/$/, '');
        return window.location.origin;
    };

    const illustrationPath = "/image.png";

    useEffect(() => {
        const hash = window.location.hash || '';
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        const type = params.get('type');
        setIsRecoveryFlow(type === 'recovery');
    }, []);

    const normalizedNewEmail = useMemo(() => newMemberEmail.trim().toLowerCase(), [newMemberEmail]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Redirigir solo si no hay error de autenticación pendiente
    if (user && !authError && !isRecoveryFlow) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // SECURITY FIX #6: Política mínima de contraseña
        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: signInData, error: signInError } = await login(email, password);
            if (signInError) {
                if (signInError.message.includes('Invalid login credentials')) {
                    throw new Error('Correo o contraseña incorrectos.');
                }
                throw signInError;
            }

            const signedUserId = signInData?.user?.id || null;
            if (signedUserId) {
                // Intento inmediato de push dentro del gesto de login.
                const pushResult = await notificationService.requestPermission(signedUserId);
                if (pushResult === 'denied') {
                    setInfoMessage('Inicio de sesión correcto. Activa notificaciones del navegador para recibir alertas push en tiempo real.');
                }
            }
        } catch (err) {
            setError(err.message || 'Ocurrió un error inesperado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        setError(null);
        setInfoMessage('');
        if (!email.trim()) {
            setError('Ingresa tu correo para recuperar contraseña.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                redirectTo: `${getAuthRedirectBase()}/reset-password`
            });
            if (resetError) throw resetError;
            setInfoMessage('Si el correo existe, te enviamos un enlace para restablecer tu contraseña.');
        } catch (err) {
            setError(err.message || 'No se pudo iniciar la recuperación de contraseña.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNewMemberStart = async (e) => {
        e.preventDefault();
        setError(null);
        setInfoMessage('');

        if (!normalizedNewEmail) {
            setError('Ingresa tu correo corporativo.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data, error: eligibilityError } = await supabase.rpc('is_member_eligible_for_onboarding', {
                p_email: normalizedNewEmail
            });

            if (eligibilityError) {
                throw eligibilityError;
            }

            if (!data) {
                setInfoMessage('No encontramos un perfil activo con ese correo. Solicita al administrador tu alta en carga masiva.');
                return;
            }

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedNewEmail, {
                redirectTo: `${getAuthRedirectBase()}/reset-password`
            });
            if (resetError) throw resetError;

            setInfoMessage('Listo. Te enviamos un enlace para crear tu contraseña. Ábrelo desde tu correo para continuar.');
        } catch (err) {
            setError(err.message || 'No se pudo iniciar el alta de nuevo miembro.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSetPassword = async (e) => {
        e.preventDefault();
        setError(null);
        setInfoMessage('');

        if (newPassword.length < 8) {
            setError('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            setInfoMessage('Contraseña creada correctamente. Ahora puedes iniciar sesión.');
            setNewPassword('');
            setConfirmPassword('');
            setIsRecoveryFlow(false);
            window.history.replaceState({}, document.title, '/login');
            await supabase.auth.signOut();
            setMode('login');
        } catch (err) {
            setError(err.message || 'No se pudo crear la contraseña. Intenta abrir nuevamente el enlace de correo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 lg:p-8 font-sans">
            <div className="bg-white w-full max-w-6xl flex flex-col lg:flex-row rounded-none sm:rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[600px] lg:h-[800px]">

                {/* Panel Izquierdo — Ilustración */}
                <div className="lg:w-1/2 bg-[#efebff] p-8 lg:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                    <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-left-8 duration-1000">
                        <div className="mb-10 bg-white/40 p-4 rounded-[3rem] backdrop-blur-sm shadow-xl shadow-indigo-500/10">
                            <img
                                src={illustrationPath}
                                alt="Support Illustration"
                                className="w-full h-auto rounded-[2.5rem] transform transition-transform hover:scale-105 duration-700"
                            />
                        </div>

                        <h2 className="text-3xl lg:text-4xl font-black text-indigo-950 mb-4 leading-tight tracking-tight">
                            Soporte IT <br /> <span className="text-indigo-600">Simplificado</span>
                        </h2>
                        <p className="text-slate-600 font-medium text-base lg:text-lg max-w-xs mx-auto leading-relaxed opacity-80">
                            Gestiona tus recursos y reportes con la inteligencia de IT Helpdesk. Rápido, intuitivo y listo para ayudarte.
                        </p>
                    </div>
                </div>

                {/* Panel Derecho — Login */}
                <div className="lg:w-1/2 bg-white p-8 lg:p-20 flex flex-col justify-center relative overflow-hidden">
                    <div className="max-w-md mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-700">

                        <div className="mb-10 text-center lg:text-left">
                            {!isRecoveryFlow && (
                                <div className="mb-5 inline-flex bg-slate-100 rounded-2xl p-1 border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => { setMode('login'); setError(null); setInfoMessage(''); }}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Iniciar sesión
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setMode('new-member'); setError(null); setInfoMessage(''); }}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'new-member' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Eres nuevo
                                    </button>
                                </div>
                            )}

                            <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                                {isRecoveryFlow ? 'Crear contraseña' : mode === 'new-member' ? 'Nuevo miembro' : '¡Hola de nuevo!'}
                            </h3>
                            <p className="text-slate-500 font-medium text-sm">
                                {isRecoveryFlow
                                    ? 'Define tu contraseña para activar el acceso.'
                                    : mode === 'new-member'
                                        ? 'Activa tu cuenta con el correo cargado por administración.'
                                        : 'Acceso restringido al personal autorizado.'}
                            </p>
                        </div>

                        {infoMessage && (
                            <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-bold border border-emerald-100 text-center">
                                {infoMessage}
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex flex-col items-center gap-3 text-center">
                                <span>⚠️ {error}</span>
                                {(error.toLowerCase().includes('crítico') || error.toLowerCase().includes('perfil')) && (
                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="mt-2 bg-red-600 text-white px-6 py-2 rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 font-black uppercase text-xs tracking-widest"
                                    >
                                        Limpiar Sesión y Reintentar
                                    </button>
                                )}
                            </div>
                        )}

                        {isRecoveryFlow ? (
                            <form className="space-y-6" onSubmit={handleSetPassword}>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Correo</label>
                                    <input
                                        type="email"
                                        readOnly
                                        value={user?.email || normalizedNewEmail || ''}
                                        className="w-full bg-slate-100 border border-slate-200 px-6 py-4 rounded-2xl font-medium text-slate-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nueva contraseña</label>
                                    <input
                                        type="password"
                                        minLength={8}
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar contraseña</label>
                                    <input
                                        type="password"
                                        minLength={8}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-black hover:shadow-black/20 transition-all active:scale-[0.98] duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {isSubmitting && <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>}
                                    Guardar contraseña
                                </button>
                            </form>
                        ) : mode === 'new-member' ? (
                            <form className="space-y-6" onSubmit={handleNewMemberStart}>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Correo corporativo</label>
                                    <input
                                        type="email"
                                        placeholder="ejemplo@mexsa.com"
                                        required
                                        value={newMemberEmail}
                                        onChange={(e) => setNewMemberEmail(e.target.value)}
                                        className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-black hover:shadow-black/20 transition-all active:scale-[0.98] duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {isSubmitting && <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>}
                                    Activar cuenta
                                </button>
                            </form>
                        ) : (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input
                                    type="email"
                                    placeholder="ejemplo@mexsa.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Contraseña</label>
                                    <button type="button" onClick={handleForgotPassword} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest">
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                                <div className="relative group">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-black hover:shadow-black/20 transition-all active:scale-[0.98] duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {isSubmitting && <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>}
                                Continuar
                            </button>
                        </form>
                        )}

                        <div className="mt-12 text-center">
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                                Al acceder, iniciar sesión o usar esta plataforma, aceptas automáticamente nuestros <button type="button" onClick={() => { setTermsType('terms'); setIsTermsOpen(true); }} className="text-indigo-600 font-bold hover:underline">Términos de servicio</button> y la <button type="button" onClick={() => { setTermsType('privacy'); setIsTermsOpen(true); }} className="text-indigo-600 font-bold hover:underline">Política de privacidad</button>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TermsModal
                isOpen={isTermsOpen}
                onClose={() => setIsTermsOpen(false)}
                type={termsType}
            />
        </div>
    );
};

export default Login;