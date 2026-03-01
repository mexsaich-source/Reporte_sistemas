import React, { useState } from 'react';
import { Plus, ListFilter, X, Users, ShieldCheck, UserCheck, Shield, ChevronRight, Search, Activity, Mail } from 'lucide-react';
const usersData = [];
const userStats = { total: 0, active: 0, techs: 0, admins: 0 };
import StatCard from './StatCard';

// --- SUBCOMPONENTE: Status Badge ---
const UserStatusBadge = ({ status }) => {
    const isActive = status === 'Active';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${isActive
            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
            : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            {isActive ? 'Activo' : 'Inactivo'}
        </span>
    );
};

// --- SUBCOMPONENTE: Role Badge ---
const UserRoleBadge = ({ role }) => {
    const config = {
        'Administrador': { icon: ShieldCheck, color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
        'Técnico': { icon: Shield, color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' },
        'Usuario': { icon: UserCheck, color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }
    };

    const { icon: Icon, color } = config[role] || config['Usuario'];

    return (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${color}`}>
            <Icon size={12} />
            {role}
        </span>
    );
};

// --- SUBCOMPONENTE: Slider de Detalles del Usuario ---
const UserDetailSlider = ({ user, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Perfil de Usuario</span>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{user?.id}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 text-sm">
                    {/* Header Perfil */}
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}&background=3b82f6&color=fff&size=128&bold=true`}
                                className="w-20 h-20 rounded-[2rem] border-4 border-white dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none"
                                alt="Profile"
                            />
                            <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${user?.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{user?.name}</h3>
                            <UserRoleBadge role={user?.role} />
                        </div>
                    </div>

                    {/* Información Rápida */}
                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80 hover:border-slate-200 dark:hover:border-slate-600 transition-colors shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Mail size={16} className="text-slate-400 dark:text-slate-500" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Correo Electrónico</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.email}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80 hover:border-slate-200 dark:hover:border-slate-600 transition-colors shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Users size={16} className="text-indigo-400" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Departamento</span>
                                <span className="font-bold text-indigo-700 dark:text-indigo-400">{user?.department}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800/80 hover:border-slate-200 dark:hover:border-slate-600 transition-colors shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Activity size={16} className="text-emerald-400" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Última Conexión</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.lastLogin}</span>
                            </div>
                        </div>
                    </div>

                    {/* Simulación de Inventario Asignado */}
                    <div className="space-y-4 pt-2">
                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px]">
                            Equipos Asignados (2)
                        </h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">Laptop Dell Latitude 7420</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">DEV-8920</span>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">Monitor Dell 27"</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">DEV-8921</span>
                                </div>
                                <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- COMPONENTE PRINCIPAL: Módulo de Usuarios ---
const UsersView = () => {
    const [selectedUser, setSelectedUser] = useState(null);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Empleados" value={userStats.total} trend="Totales" icon={Users} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Activos Hoy" value={userStats.active} trend="~95%" icon={UserCheck} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="Técnicos" value={userStats.techs} trend="Soporte" icon={Shield} color="text-blue-600" bg="bg-blue-100" />
                <StatCard label="Administradores" value={userStats.admins} trend="Sistemas" icon={ShieldCheck} color="text-purple-600" bg="bg-purple-100" />
            </div>

            {/* Main Table Container */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors duration-300">
                <div className="p-8 flex flex-col justify-between items-start gap-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
                    <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Directorio del Personal</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Control de Accesos y Empleados</p>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="flex-1 md:w-72 flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                                <Search size={16} className="group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar por Nombre o Correo..."
                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
                                />
                            </div>
                            <button className="flex items-center gap-2 bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5 whitespace-nowrap">
                                <Plus size={18} strokeWidth={2.5} />
                                <span className="hidden sm:inline">Nuevo Usuario</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Empleado</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Contacto</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Rol en Sistema</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado</th>
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Último Acceso</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {usersData.map((user) => (
                                <tr key={user.id} onClick={() => setSelectedUser(user)} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-4">
                                            <img
                                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3b82f6&color=fff&bold=true`}
                                                className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform"
                                                alt={user.name}
                                            />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user.name}</span>
                                                <span className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{user.department}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">{user.email}</span>
                                    </td>
                                    <td className="p-4">
                                        <UserRoleBadge role={user.role} />
                                    </td>
                                    <td className="p-4">
                                        <UserStatusBadge status={user.status} />
                                    </td>
                                    <td className="p-4 pr-6 text-right font-medium text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                        {user.lastLogin}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Slider Extraíble Funcional */}
            <UserDetailSlider
                user={selectedUser}
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
            />
        </div>
    );
};

export default UsersView;
