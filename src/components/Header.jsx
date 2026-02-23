import React from 'react';
import { Search, Bell, LogOut } from 'lucide-react';

const Header = ({ userRole, onLogout, userName = "Usuario", userType = "Operativo" }) => {
    return (
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm transition-all">
            <div className="flex items-center gap-3 text-slate-400 bg-white px-4 py-2.5 rounded-2xl w-full max-w-md border border-slate-200/60 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                <Search size={18} className="group-focus-within:text-blue-500 transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar tickets, equipos, reportes..."
                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400 font-medium"
                />
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
                <button className="relative p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                    <Bell size={22} />
                    <span className="absolute top-2.5 right-2 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                </button>

                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                {userRole === 'admin' ? (
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-all text-sm font-bold tracking-wide"
                    >
                        <LogOut size={18} />
                        <span className="hidden sm:inline">Salir</span>
                    </button>
                ) : (
                    <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="flex flex-col text-right hidden md:flex">
                            <span className="text-sm font-black text-slate-900 leading-tight">{userName}</span>
                            <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest leading-tight">{userType}</span>
                        </div>
                        <div className="relative">
                            <img
                                src={`https://ui-avatars.com/api/?name=${userName.replace(' ', '+')}&background=3b82f6&color=fff&size=128&bold=true`}
                                className="w-11 h-11 rounded-2xl border-2 border-slate-50 shadow-md group-hover:scale-105 transition-transform"
                                alt="Profile"
                            />
                            <div className="absolute bottom-[-2px] right-[-2px] w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white"></div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
