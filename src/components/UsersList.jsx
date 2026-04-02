import React, { useState, useEffect } from 'react';
import { Plus, ListFilter, X, Users, ShieldCheck, UserCheck, Shield, ChevronRight, Search, Activity, Mail, Trash2, Smartphone } from 'lucide-react';
import { userService } from '../services/userService';
import { useAuth } from '../context/authStore';
import StatCard from './StatCard';

// --- SUBCOMPONENTE: Status Badge ---
const UserStatusBadge = ({ status }) => {
    const isActive = status === true;
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
        'admin': { label: 'Administrador', icon: ShieldCheck, color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
        'tech': { label: 'Técnico', icon: Shield, color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' },
        'user': { label: 'Usuario', icon: UserCheck, color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' }
    };

    const current = config[role] || config['user'];
    const Icon = current.icon;

    return (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${current.color}`}>
            <Icon size={12} />
            {current.label}
        </span>
    );
};

// --- SUBCOMPONENTE: Slider de Detalles del Usuario ---
const UserDetailSlider = ({ user, isOpen, onClose, onUpdateRole, onDeleteUser }) => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin';

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
                        <h2 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px]">{user?.id}</h2>
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
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || '')}&background=3b82f6&color=fff&size=128&bold=true`}
                                className="w-20 h-20 rounded-[2rem] border-4 border-white dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-none"
                                alt="Profile"
                            />
                            <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${user?.status ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{user?.full_name}</h3>
                            <UserRoleBadge role={user?.role} />
                        </div>
                    </div>

                    {/* Información Rápida - Visible para todos (incluyendo Técnicos) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Mail size={16} className="text-slate-400" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Correo</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block max-w-[150px]">{user?.email}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Users size={16} className="text-indigo-400" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Área</span>
                                <span className="font-bold text-indigo-700 dark:text-indigo-400">{user?.department || 'General'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Smartphone size={16} className="text-blue-400" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Localización</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{user?.location || 'Por asignar'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner">
                            <div className="bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm"><Activity size={16} className="text-emerald-400" /></div>
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Equipos</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block max-w-[150px]">{user?.assigned_equipment || 'Ninguno'}</span>
                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="space-y-6 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px]">Gestión Administrativa</h4>
                                {profile.id !== user?.id && (
                                    <button 
                                        onClick={async () => {
                                            const success = await userService.toggleUserStatus(user.id, user.status, profile.id);
                                            if (success) onClose(); 
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${user?.status 
                                            ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-600 hover:text-white' 
                                            : 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-600 hover:text-white'}`}
                                    >
                                        {user?.status ? 'Suspender Acceso' : 'Reactivar Acceso'}
                                    </button>
                                )}
                            </div>

                            {/* Formulario de Edición Admin */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-blue-500">Telegram Chat ID</label>
                                        <input 
                                            type="text"
                                            id={`telegram_${user?.id}`}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500"
                                            defaultValue={user?.whatsapp_phone || ''}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Área / Depto</label>
                                        <input 
                                            type="text"
                                            id={`dept_${user?.id}`}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500"
                                            defaultValue={user?.department || ''}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Localización Física</label>
                                    <input 
                                        type="text"
                                        id={`loc_${user?.id}`}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500"
                                        defaultValue={user?.location || ''}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Máquinas / Equipos Asignados</label>
                                    <textarea 
                                        id={`equip_${user?.id}`}
                                        rows="2"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500"
                                        defaultValue={user?.assigned_equipment || ''}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] tracking-widest">Rol del Sistema</label>
                                    <select 
                                        id={`role_${user?.id}`}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white"
                                        defaultValue={user?.role || 'user'}
                                    >
                                        <option value="user">Usuario (Lectura)</option>
                                        <option value="tech">Técnico (Soporte)</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>

                                <button 
                                    onClick={async () => {
                                        const profileData = {
                                            telegram_chat_id: document.getElementById(`telegram_${user?.id}`).value,
                                            department: document.getElementById(`dept_${user?.id}`).value,
                                            location: document.getElementById(`loc_${user?.id}`).value,
                                            assigned_equipment: document.getElementById(`equip_${user?.id}`).value,
                                            role: document.getElementById(`role_${user?.id}`).value
                                        };
                                        const success = await userService.updateAdminUserInfo(user.id, profileData, profile.id);
                                        if (success) {
                                            alert('Perfil actualizado correctamente.');
                                            onClose();
                                        }
                                    }}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Actualizar Datos del Empleado
                                </button>
                            </div>

                            {profile.id !== user?.id && (
                                <button
                                    onClick={() => {
                                        if(window.confirm(`¿BORRADO TOTAL? Eliminarás a ${user?.full_name} de Auth y Base de Datos.`)) {
                                            onDeleteUser(user?.email);
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-all border border-red-100"
                                >
                                    <Trash2 size={14} />
                                    Eliminar Perfil de Raíz
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

// --- SUBCOMPONENTE: Slider para Agregar Usuario ---
const AddUserSlider = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'user',
        department: 'General'
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await onSave(formData);
        setLoading(false);
        if (result.success) onClose();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 animate-in fade-in transition-opacity" onClick={onClose}></div>
            <div className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-500">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Nuevo Usuario</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Acceso al sistema</p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                        <input
                            type="text"
                            name="full_name"
                            required
                            value={formData.full_name}
                            onChange={handleChange}
                            placeholder="Nombre del empleado"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                        <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="usuario@mexsa.com"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña Provisoria</label>
                        <input
                            type="password"
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rol</label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-all"
                            >
                                <option value="user">Usuario (Lectura)</option>
                                <option value="tech">Técnico (Soporte)</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-all"
                            >
                                <option value="General">General</option>
                                <option value="Sistemas">Sistemas</option>
                                <option value="Recursos Humanos">RRHH</option>
                                <option value="Finanzas">Finanzas</option>
                                <option value="Mantenimiento">Mantenimiento</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-8 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="flex-1 py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-black shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Crear Usuario"}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

// --- COMPONENTE PRINCIPAL: Módulo de Usuarios ---
const UsersView = ({ searchTerm = '' }) => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [stats, setStats] = useState({ total: 0, active: 0, techs: 0, admins: 0 });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await userService.getAll();
            setUsers(data);

            const newStats = {
                total: data.length,
                active: data.filter(u => u.status).length,
                techs: data.filter(u => u.role === 'tech').length,
                admins: data.filter(u => u.role === 'admin').length
            };
            setStats(newStats);
        } catch (err) {
            console.error("Error loading users:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = React.useMemo(() => {
        if (!searchTerm) return users;
        const s = searchTerm.toLowerCase();
        return users.filter(u => 
            (u.full_name && u.full_name.toLowerCase().includes(s)) ||
            (u.email && u.email.toLowerCase().includes(s)) ||
            (u.role && u.role.toLowerCase().includes(s)) ||
            (u.department && u.department.toLowerCase().includes(s))
        );
    }, [users, searchTerm]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSaveUser = async (formData) => {
        const result = await userService.register(
            formData.email,
            formData.password,
            formData.full_name,
            formData.role,
            formData.department
        );

        if (result.success) {
            await fetchUsers();
            alert("Usuario creado exitosamente. Se ha enviado un correo de confirmación (si está habilitado en Supabase).");
        } else {
            alert("Error al crear usuario: " + result.error);
        }
        return result;
    };

    const handleUpdateRole = async (userId, newRole) => {
        const success = await userService.updateRole(userId, newRole);
        if (success) {
            await fetchUsers();
            // Actualizar localmente el slider si sigue abierto
            if(selectedUser && selectedUser.id === userId) {
                setSelectedUser(prev => ({ ...prev, role: newRole }));
            }
        } else {
            alert('Error al actualizar el rol.');
        }
    };

    const handleDeleteUser = async (email) => {
        const result = await userService.unregisterMemberFromDepartment(email);
        if (result.success) {
            await fetchUsers();
            setSelectedUser(null);
        } else {
            alert("Error al inhabilitar usuario: " + result.error);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Empleados" value={stats.total} trend="Totales" icon={Users} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Activos" value={stats.active} trend="En línea" icon={UserCheck} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="Técnicos" value={stats.techs} trend="Soporte" icon={Shield} color="text-blue-600" bg="bg-blue-100" />
                <StatCard label="Administradores" value={stats.admins} trend="Sistemas" icon={ShieldCheck} color="text-purple-600" bg="bg-purple-100" />
            </div>

            {/* Main Table Container */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors duration-300">
                <div className="p-4 sm:p-8 flex flex-col justify-between items-start gap-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
                    <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Directorio del Personal</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Control de Accesos y Empleados</p>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button onClick={fetchUsers} className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm">
                                <ListFilter size={16} />
                                Refrescar
                            </button>
                            <button
                                onClick={() => setIsAddUserOpen(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5 whitespace-nowrap">
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
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Registrado</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-500">
                                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            Cargando directorio...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        {searchTerm ? 'No se encontraron usuarios con esa búsqueda.' : 'No hay usuarios registrados.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} onClick={() => setSelectedUser(user)} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-4">
                                                <img
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=3b82f6&color=fff&bold=true`}
                                                    className="w-10 h-10 rounded-2xl border border-slate-200 dark:border-slate-700 group-hover:scale-110 transition-transform"
                                                    alt={user.full_name}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight">{user.full_name}</span>
                                                    <span className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{user.department || 'General'}</span>
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
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Diálogos y Deslizables */}
            <UserDetailSlider
                user={selectedUser}
                isOpen={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdateRole={handleUpdateRole}
                onDeleteUser={handleDeleteUser}
            />

            <AddUserSlider
                isOpen={isAddUserOpen}
                onClose={() => setIsAddUserOpen(false)}
                onSave={handleSaveUser}
            />
        </div>
    );
};

export default UsersView;



