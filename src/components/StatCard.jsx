import React from 'react';

const StatCard = ({ label, value, trend = '', icon: Icon, color, bg }) => {
    // Premium color mapping with gradients and glowing borders
    const styleMap = {
        'bg-blue-100': {
            iconBg: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            trendBg: 'bg-blue-500/10 text-blue-500',
            bar: 'bg-blue-500 shadow-[0_0_15px_-3px_rgba(59,130,246,0.6)]',
            hover: 'group-hover:border-blue-500/30'
        },
        'bg-emerald-100': {
            iconBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            trendBg: 'bg-emerald-500/10 text-emerald-500',
            bar: 'bg-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.6)]',
            hover: 'group-hover:border-emerald-500/30'
        },
        'bg-purple-100': {
            iconBg: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            trendBg: 'bg-purple-500/10 text-purple-500',
            bar: 'bg-purple-500 shadow-[0_0_15px_-3px_rgba(139,92,246,0.6)]',
            hover: 'group-hover:border-purple-500/30'
        },
        'bg-amber-100': {
            iconBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
            trendBg: 'bg-amber-500/10 text-amber-500',
            bar: 'bg-amber-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.6)]',
            hover: 'group-hover:border-amber-500/30'
        },
        'bg-slate-100': {
            iconBg: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
            trendBg: 'bg-slate-500/10 text-slate-500',
            bar: 'bg-slate-500 shadow-[0_0_15px_-3px_rgba(100,116,139,0.6)]',
            hover: 'group-hover:border-slate-500/30'
        }
    };

    const currentStyle = styleMap[bg] || styleMap['bg-blue-100'];
    const isPositive = trend?.startsWith('+');
    const isNegative = trend?.startsWith('-');

    return (
        <div className={`
            relative overflow-hidden
            bg-white dark:bg-slate-900/60 p-6 lg:p-7 rounded-[2.5rem] 
            border border-slate-100 dark:border-slate-800/60 
            shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none 
            flex flex-col gap-6 cursor-default
            transition-all duration-500 ease-out group
            hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)]
            dark:hover:bg-slate-900/80 ${currentStyle.hover}
        `}>
            {/* Background Accent Glow */}
            <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${currentStyle.iconBg.split(' ')[0]}`}></div>

            <div className="flex justify-between items-start relative z-10">
                <div className={`
                    p-4 rounded-2xl border ${currentStyle.iconBg}
                    transition-all duration-500 group-hover:scale-110 group-hover:rotate-6
                `}>
                    <Icon size={28} strokeWidth={2} />
                </div>
                
                {trend && (
                    <div className={`
                        px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5
                        ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 
                          isNegative ? 'bg-rose-500/10 text-rose-500' : 
                          currentStyle.trendBg}
                    `}>
                        <div className={`w-1 h-1 rounded-full ${isPositive ? 'bg-emerald-500' : isNegative ? 'bg-rose-500' : 'bg-current'}`}></div>
                        {trend}
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{value}</h3>
                </div>
            </div>

            {/* Accent Bar */}
            <div className="relative h-1.5 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-full overflow-hidden transition-all duration-700 group-hover:w-full">
                <div className={`absolute inset-y-0 left-0 w-full ${currentStyle.bar} translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-700 rounded-full`}></div>
            </div>
        </div>
    );
};

export default StatCard;
