import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ResetPassword = () => {
    const [loading, setLoading] = useState(true);
    const [isRecoveryFlow, setIsRecoveryFlow] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [emailHint, setEmailHint] = useState('');

    useEffect(() => {
        const hash = window.location.hash || '';
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        const type = params.get('type');
        setIsRecoveryFlow(type === 'recovery');

        supabase.auth.getUser().then(({ data }) => {
            setEmailHint(data?.user?.email || '');
        }).finally(() => {
            setLoading(false);
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;

            setSuccessMessage('Contraseña actualizada correctamente. Ahora puedes iniciar sesión.');
            await supabase.auth.signOut();
            setPassword('');
            setConfirmPassword('');
            window.history.replaceState({}, document.title, '/reset-password');
        } catch (err) {
            setError(err.message || 'No se pudo actualizar la contraseña.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isRecoveryFlow) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center">
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Enlace no válido</h2>
                    <p className="text-slate-500 text-sm font-medium mb-6">
                        Este enlace de recuperación no es válido o ya expiró. Solicita uno nuevo desde el inicio de sesión.
                    </p>
                    <Link to="/login" className="inline-flex items-center justify-center bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">
                        Ir a Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-6">
            <div className="max-w-xl w-full bg-white rounded-none sm:rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 sm:p-12">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Restablecer contraseña</h1>
                    <p className="text-slate-500 text-sm font-medium mt-2">
                        {emailHint ? `Cuenta: ${emailHint}` : 'Define tu nueva contraseña para continuar.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold border border-red-100 text-center">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-6 bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-bold border border-emerald-100 text-center">
                        {successMessage}
                    </div>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nueva contraseña</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700"
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

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar contraseña</label>
                        <input
                            type="password"
                            required
                            minLength={8}
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

                <div className="mt-8 text-center">
                    <Link to="/login" className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline">
                        Volver a iniciar sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
