import React from 'react';
import {
    LayoutDashboard,
    Ticket,
    MonitorSmartphone,
    Activity,
    FileText,
    Users,
    Laptop,
    Settings
} from 'lucide-react';

const Sidebar = ({ activeItem, onSelectItem }) => {
    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, id: 'Dashboard' },
        { name: 'Tickets', icon: Ticket, id: 'Tickets' },
        { name: 'Inventario', icon: MonitorSmartphone, id: 'Inventory' },
        { name: 'Actividades', icon: Activity, id: 'Activities' },
        { name: 'Reportes', icon: FileText, id: 'Reports' },
        { name: 'Usuarios', icon: Users, id: 'Users' },
    ];

    return (
        <div className="w-72 bg-slate-950 text-slate-300 flex flex-col min-h-screen sticky top-0 border-r border-slate-800 shadow-2xl z-20 transition-all duration-300">
            {/* Header/Logo */}
            <div className="p-8 flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                    <Laptop size={28} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                    <span className="font-black text-xl text-white tracking-tight leading-none">Mexsa IT</span>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Admin Portal</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-4 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-4">Plataforma</div>
                {menuItems.map((item) => {
                    const isActive = activeItem === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onSelectItem(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${isActive
                                ? 'bg-blue-600/10 text-blue-400 font-bold'
                                : 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 font-medium'
                                }`}
                        >
                            <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-blue-600/20' : 'bg-transparent group-hover:bg-slate-800'}`}>
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className="text-sm tracking-wide">{item.name}</span>

                            {/* Active Indicator Line */}
                            {isActive && (
                                <div className="ml-auto w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Footer / Profile */}
            <div className="p-6">
                <div className="bg-slate-900 rounded-3xl p-4 flex items-center justify-between border border-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img
                                src="https://ui-avatars.com/api/?name=Admin+Root&background=3b82f6&color=fff&bold=true"
                                alt="Admin"
                                className="w-10 h-10 rounded-2xl border-2 border-slate-700 object-cover shadow-sm"
                            />
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-bold text-white leading-tight mb-0.5 group-hover:text-blue-400 transition-colors">Admin Root</span>
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">SysAdmin</span>
                        </div>
                    </div>
                    <Settings size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
