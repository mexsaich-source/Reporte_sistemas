import React from 'react';
import { Search, Bell, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Header = ({ userName = "Usuario", userType = "Operativo" }) => {
    const { isDark, toggleTheme } = useTheme();
    const { logout } = useAuth();

    return (
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm transition-all duration-300">
            <div className="flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl w-full max-w-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                <Search size={18} className="group-focus-within:text-blue-500 transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar tickets, equipos, reportes..."
                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                />
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    className="p-2.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all duration-300 active:scale-90"
                    title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                >
                    {isDark ? <Sun size={22} className="animate-in spin-in-90 duration-500" /> : <Moon size={22} className="animate-in spin-in-90 duration-500" />}
                </button>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

                <button className="relative p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                    <Bell size={22} />
                    <span className="absolute top-2.5 right-2 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
                </button>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

                <button
                    onClick={logout}
                    className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all text-sm font-bold tracking-wide"
                >
                    <LogOut size={18} />
                    <span className="hidden sm:inline">Salir</span>
                </button>

            </div>
        </header>
    );
};

export default Header;
