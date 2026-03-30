import React from 'react';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export const Toast = ({ title, message, type = 'info', onClose }) => {
    const icons = {
        info: <Info className="text-blue-500" size={20} />,
        success: <CheckCircle className="text-emerald-500" size={20} />,
        warning: <AlertTriangle className="text-amber-500" size={20} />,
        error: <AlertCircle className="text-rose-500" size={20} />,
    };

    const borders = {
        info: 'border-blue-500/20',
        success: 'border-emerald-500/20',
        warning: 'border-amber-500/20',
        error: 'border-rose-500/20',
    };

    const bgs = {
        info: 'bg-blue-500/10',
        success: 'bg-emerald-500/10',
        warning: 'bg-amber-500/10',
        error: 'bg-rose-500/10',
    };

    return (
        <div className={`
            min-w-[320px] max-w-sm
            bg-white/70 dark:bg-slate-900/70 border ${borders[type]} 
            backdrop-blur-xl p-4 rounded-2xl shadow-2xl 
            flex gap-4 items-start pointer-events-auto
            animate-in slide-in-from-right-10 fade-in duration-300
        `}>
            <div className={`p-2 rounded-xl ${bgs[type]}`}>
                {icons[type]}
            </div>
            
            <div className="flex-1">
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">{message}</p>
            </div>

            <button 
                onClick={onClose}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
            >
                <X size={16} />
            </button>
        </div>
    );
};
