import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Chrome, Apple, Facebook } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const { login, register, user, profile, loading, logout, authError, setAuthError } = useAuth();
    const navigate = useNavigate();

    // Redirigir automáticamente si ya está logeado y el perfil cargado
    useEffect(() => {
        if (!loading && user) {
            if (authError === 'BLOCKED') {
                setError('Acceso Denegado: Tu sesión ha sido cerrada por un administrador. Si crees que es un error, contacta a IT.');
                setIsSubmitting(false);
                return;
            }

            if (authError === 'NO_PROFILE') {
                setError('Error de Perfil: Tu usuario existe pero no se encontró tu perfil de seguridad. Registra tu cuenta de nuevo o contacta a un administrador.');
                setIsSubmitting(false);
                return;
            }

            if (profile) {
                const role = profile.role?.toLowerCase();
                if (role === 'admin' || role === 'tech') {
                    navigate('/admin', { replace: true });
                } else {
                    navigate('/portal', { replace: true });
                }
            } else if (!authError) {
                // Estado de carga o espera
            }
        }
    }, [user, profile, loading, authError, navigate]);

    const [isRegister, setIsRegister] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('user');

    // Status State
    const [error, setError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const illustrationPath = "/image.png";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (isRegister) {
                const { error: signUpError } = await register(email, password, fullName, role);
                if (signUpError) throw signUpError;
                // Auto-login might happen via session listener, or user needs to confirm email depending on Supabase settings.
                // Assuming auto-login or alert for email confirmation.
                if (!signUpError) {
                    setError('Revisa tu correo para confirmar tu cuenta (si aplica), o intenta iniciar sesión.');
                    setIsRegister(false);
                }
            } else {
                const { error: signInError } = await login(email, password);
                if (signInError) {
                    if (signInError.message.includes('Invalid login credentials')) {
                        throw new Error('Correo o contraseña incorrectos.');
                    }
                    throw signInError;
                }
            }
        } catch (err) {
            setError(err.message || 'Ocurrió un error inesperado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 lg:p-8 font-sans">
            <div className="bg-white w-full max-w-6xl flex flex-col lg:flex-row rounded-none sm:rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[600px] lg:h-[800px]">

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
                            Gestiona tus recursos y reportes con la inteligencia de Mexsa. Rápido, intuitivo y siempre conectado.
                        </p>

                        <div className="flex gap-2 justify-center mt-10">
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-200"></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-200"></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-200"></div>
                        </div>
                    </div>
                </div>

                <div className="lg:w-1/2 bg-white p-8 lg:p-20 flex flex-col justify-center relative overflow-hidden">
                    <div className="max-w-md mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-700">

                        <div className="mb-10 text-center lg:text-left">
                            <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                                {isRegister ? 'Crea una cuenta' : '¡Hola de nuevo!'}
                            </h3>
                            <p className="text-slate-500 font-medium">
                                {isRegister ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'} {' '}
                                <button
                                    onClick={() => { setIsRegister(!isRegister); setError(null); setAuthError(null); }}
                                    className="text-indigo-600 font-bold hover:underline transition-all"
                                >
                                    {isRegister ? 'Inicia sesión' : 'Regístrate aquí'}
                                </button>
                            </p>
                        </div>

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

                        {/* Form Inputs */}
                        {(!user || profile) && (
                            <>
                                <form className="space-y-6" onSubmit={handleSubmit}>
                                    {isRegister && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                            <input
                                                type="text"
                                                placeholder="Juan Pérez"
                                                required
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-medium text-slate-700 placeholder:text-slate-300"
                                            />
                                        </div>
                                    )}

                                    {isRegister && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Rol de Usuario</label>
                                            <select
                                                value={role}
                                                onChange={(e) => setRole(e.target.value)}
                                                className="w-full bg-[#f8f9fc] border border-slate-100 px-6 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                                            >
                                                <option value="user">Usuario (Operativo)</option>
                                                <option value="tech">Técnico (Soporte)</option>
                                                <option value="admin">Administrador (IT)</option>
                                            </select>
                                        </div>
                                    )}

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
                                            {!isRegister && (
                                                <button type="button" className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest">
                                                    ¿Olvidaste tu contraseña?
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                required
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
                                        {isSubmitting && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                                        {isRegister ? 'Crear mi cuenta' : 'Continuar'}
                                    </button>
                                </form>

                                <div className="my-10 flex items-center gap-4 text-slate-300 font-bold text-[10px] uppercase tracking-[0.2em]">
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                    <span>o continuar con</span>
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <button className="flex items-center justify-center py-4 px-2 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all hover:shadow-lg shadow-slate-200/50 group duration-300">
                                        <Chrome size={20} className="text-slate-800" />
                                    </button>
                                    <button className="flex items-center justify-center py-4 px-2 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all hover:shadow-lg shadow-slate-200/50 group duration-300">
                                        <Apple size={20} className="text-slate-800" />
                                    </button>
                                    <button className="flex items-center justify-center py-4 px-2 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all hover:shadow-lg shadow-slate-200/50 group duration-300">
                                        <Facebook size={20} className="text-[#1877F2]" />
                                    </button>
                                </div>

                                <div className="mt-12 text-center">
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                                        Al continuar, aceptas nuestros <button className="text-indigo-600 font-bold">Términos de servicio</button> y la <button className="text-indigo-600 font-bold">Política de privacidad</button>.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Remove demo section entirely */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
