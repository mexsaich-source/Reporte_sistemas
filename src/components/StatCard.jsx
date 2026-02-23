import React from 'react';

const StatCard = ({ label, value, trend, icon: Icon, color, bg }) => {
    // Generate a softer shadow color based on the bg class (e.g., bg-blue-100 -> shadow-blue-500/10)
    const shadowMap = {
        'bg-blue-100': 'group-hover:shadow-blue-500/20 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
        'bg-slate-100': 'group-hover:shadow-slate-500/20 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
        'bg-emerald-100': 'group-hover:shadow-emerald-500/20 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
        'bg-purple-100': 'group-hover:shadow-purple-500/20 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
        'bg-amber-100': 'group-hover:shadow-amber-500/20 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    };

    const isPositive = trend.startsWith('+');
    const isNegative = trend.startsWith('-');

    return (
        <div className="bg-white dark:bg-slate-900 p-6 lg:p-7 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col gap-5 hover:-translate-y-1 hover:shadow-2xl dark:hover:shadow-white/5 transition-all duration-300 group cursor-default">
            <div className="flex justify-between items-start">
                <div className={`p-3.5 rounded-2xl ${bg === 'bg-slate-100' ? 'bg-slate-100 dark:bg-slate-800' : bg} ${shadowMap[bg] || color} transition-transform group-hover:scale-110 duration-300`}>
                    <Icon size={26} strokeWidth={2.5} />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-1 ${isPositive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    isNegative ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                    {trend}
                </div>
            </div>

            <div className="mt-2">
                <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">{value}</h3>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</p>
            </div>

            {/* Decorative bottom line */}
            <div className="h-1 w-12 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 group-hover:w-full group-hover:bg-blue-500 transition-all duration-500"></div>
        </div>
    );
};

export default StatCard;
