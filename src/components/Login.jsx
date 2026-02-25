import React, { useState } from 'react';
import { Eye, EyeOff, Laptop, Chrome, Apple, Facebook, ChevronLeft } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const illustrationPath = "/image.png";

    const handleSubmit = (e, role = 'user') => {
        e.preventDefault();
        onLogin(role);
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
                                    onClick={() => setIsRegister(!isRegister)}
                                    className="text-indigo-600 font-bold hover:underline transition-all"
                                >
                                    {isRegister ? 'Inicia sesión' : 'Regístrate aquí'}
                                </button>
                            </p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <input
                                    type="email"
                                    placeholder="ejemplo@mexsa.com"
                                    required
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
                                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-black hover:shadow-black/20 transition-all active:scale-[0.98] duration-300"
                            >
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

                        <div className="mt-8 flex justify-center gap-4">
                            <button onClick={() => onLogin('admin')} className="text-[9px] font-bold text-slate-300 hover:text-indigo-400 transition-colors uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-full">Dev: Admin</button>
                            <button onClick={() => onLogin('user')} className="text-[9px] font-bold text-slate-300 hover:text-indigo-400 transition-colors uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-full">Dev: User</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
