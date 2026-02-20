import React from 'react';

const StatCard = ({ label, value, trend, icon: Icon, color, bg }) => {
    // Generate a softer shadow color based on the bg class (e.g., bg-blue-100 -> shadow-blue-500/10)
    // This is a simple mapping for the mockData colors to look premium
    const shadowMap = {
        'bg-blue-100': 'group-hover:shadow-blue-500/20 text-blue-600',
        'bg-slate-100': 'group-hover:shadow-slate-500/20 text-slate-700',
        'bg-emerald-100': 'group-hover:shadow-emerald-500/20 text-emerald-600',
        'bg-purple-100': 'group-hover:shadow-purple-500/20 text-purple-600',
        'bg-amber-100': 'group-hover:shadow-amber-500/20 text-amber-600',
    };

    const isPositive = trend.startsWith('+');
    const isNegative = trend.startsWith('-');

    return (
        <div className="bg-white p-6 lg:p-7 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col gap-5 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 group cursor-default">
            <div className="flex justify-between items-start">
                <div className={`p-3.5 rounded-2xl ${bg} ${shadowMap[bg] || color} transition-transform group-hover:scale-110 duration-300`}>
                    <Icon size={26} strokeWidth={2.5} />
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-1 ${isPositive ? 'bg-emerald-50 text-emerald-600' :
                        isNegative ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
                    }`}>
                    {trend}
                </div>
            </div>

            <div className="mt-2">
                <h3 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">{value}</h3>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{label}</p>
            </div>

            {/* Decorative bottom line */}
            <div className="h-1 w-12 bg-slate-100 rounded-full mt-2 group-hover:w-full group-hover:bg-blue-500 transition-all duration-500"></div>
        </div>
    );
};

export default StatCard;
