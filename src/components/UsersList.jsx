import React, { useState, useEffect } from 'react';
import { Plus, ListFilter, X, Users, ShieldCheck, UserCheck, Shield, ChevronRight, Search, Activity, Mail, Trash2, Smartphone, Monitor, Laptop } from 'lucide-react';
import { userService } from '../services/userService';
import { useAuth } from '../context/authStore';
import StatCard from './StatCard';

const isMaintenanceArea = (value = '') => {
    const dep = String(value || '').trim().toLowerCase();
    return dep.includes('mantenimiento') || dep.includes('ingenieria') || dep.includes('ingeniería');
};

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
const UserDetailSlider = ({ user, isOpen, onClose, onDeleteUser, onToggleStatus, onAssetsChanged }) => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin' && !isMaintenanceArea(profile?.department);
    const isMaintScoped = !isAdmin && isMaintenanceArea(profile?.department);
    const canEdit = isAdmin || (isMaintScoped && isMaintenanceArea(user?.department));
    const canManageAssets = !isMaintScoped;
    const [assignableAssets, setAssignableAssets] = useState([]);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [loadingAssets, setLoadingAssets] = useState(false);

    const currentAssignedAssets = user?.assigned_assets || [];

    const loadAssignableAssets = async () => {
        if (!user?.id) return;
        setLoadingAssets(true);
        try {
            const list = await userService.getAssignableAssets(user.id);
            setAssignableAssets(list);
        } finally {
            setLoadingAssets(false);
        }
    };

    useEffect(() => {
        if (isOpen && canEdit && user?.id) {
            loadAssignableAssets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, user?.id, canEdit]);

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
                                <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block max-w-[150px]">{currentAssignedAssets.length > 0 ? `${currentAssignedAssets.length} asignado(s)` : (user?.assigned_equipment || 'Ninguno')}</span>
                            </div>
                        </div>
                    </div>

                    {currentAssignedAssets.length > 0 && (
                        <div className="rounded-2xl border border-slate-100 dark:border-slate-700 p-4 bg-slate-50/70 dark:bg-slate-800/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Inventario real asignado</p>
                            <div className="flex flex-wrap gap-2">
                                {currentAssignedAssets.map((asset) => (
                                    <span key={asset.id} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                                        {asset.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {canEdit && (
                        <div className="space-y-6 pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px]">Gestión Administrativa</h4>
                                {profile.id !== user?.id && (
                                    <button 
                                        onClick={async () => {
                                            await onToggleStatus?.(user);
                                            onClose();
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
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500 disabled:opacity-50"
                                            defaultValue={user?.department || ''}
                                            disabled={isMaintScoped}
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

                                {canManageAssets && (
                                <>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Máquinas / Equipos Asignados</label>
                                    <textarea 
                                        id={`equip_${user?.id}`}
                                        rows="2"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white outline-none focus:border-blue-500"
                                        defaultValue={user?.assigned_equipment || ''}
                                    />
                                </div>

                                <div className="rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10 p-4 space-y-3">
                                    <label className="text-[9px] font-bold text-blue-500 uppercase tracking-widest ml-1">Asignar equipo real desde inventario</label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <select
                                            value={selectedAssetId}
                                            onChange={(e) => setSelectedAssetId(e.target.value)}
                                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white"
                                            disabled={loadingAssets}
                                        >
                                            <option value="">Selecciona un equipo disponible</option>
                                            {assignableAssets
                                                .filter((a) => !a.assigned_to || a.assigned_to === user?.id)
                                                .map((a) => (
                                                    <option key={a.id} value={a.id}>{a.label}</option>
                                                ))}
                                        </select>
                                        <button
                                            type="button"
                                            disabled={!selectedAssetId || loadingAssets}
                                            onClick={async () => {
                                                const ok = await userService.assignAssetToUser(selectedAssetId, user.id, profile.id);
                                                if (!ok) {
                                                    alert('No se pudo asignar el equipo.');
                                                    return;
                                                }
                                                setSelectedAssetId('');
                                                await loadAssignableAssets();
                                                await onAssetsChanged?.();
                                            }}
                                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white disabled:opacity-50"
                                        >
                                            Asignar
                                        </button>
                                    </div>

                                    {currentAssignedAssets.length > 0 && (
                                        <div className="space-y-2">
                                            {currentAssignedAssets.map((asset) => (
                                                <div key={`editable-${asset.id}`} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{asset.label}</span>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (!window.confirm('¿Quitar este equipo del usuario?')) return;
                                                            const ok = await userService.unassignAssetFromUser(asset.id, profile.id);
                                                            if (!ok) {
                                                                alert('No se pudo desasignar el equipo.');
                                                                return;
                                                            }
                                                            await loadAssignableAssets();
                                                            await onAssetsChanged?.();
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:text-white"
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                </>
                                )}

                                <div className="flex flex-col gap-2">
                                    <select 
                                        id={`role_${user?.id}`}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-white disabled:opacity-50"
                                        defaultValue={user?.role || 'user'}
                                        disabled={isMaintScoped && profile.id === user?.id}
                                    >
                                        <option value="user">Usuario (Lectura)</option>
                                        <option value="tech">Ingeniero / Técnico</option>
                                        <option value="jefe_mantenimiento">Jefe de Área</option>
                                        {isAdmin && <option value="admin">Administrador Global</option>}
                                    </select>
                                </div>

                                <button 
                                    onClick={async () => {
                                        const equipEl = document.getElementById(`equip_${user?.id}`);
                                        const profileData = {
                                            telegram_chat_id: document.getElementById(`telegram_${user?.id}`).value,
                                            department: document.getElementById(`dept_${user?.id}`).value,
                                            location: document.getElementById(`loc_${user?.id}`).value,
                                            assigned_equipment: equipEl ? equipEl.value : (user?.assigned_equipment || ''),
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
    const { profile } = useAuth();
    const isMaint = isMaintenanceArea(profile?.department);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        role: 'user',
        department: isMaint ? 'Mantenimiento' : 'General'
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

                    <div className="rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 px-4 py-3">
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                            No necesitas capturar contraseña. Al crear el usuario se enviará correo para activar y establecer su clave.
                        </p>
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
                                {isMaint ? (
                                    <option value="jefe_mantenimiento">Jefe de Área</option>
                                ) : (
                                    <option value="admin">Administrador</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-all disabled:opacity-50"
                            >
                                {isMaint ? (
                                    <>
                                        <option value="Mantenimiento">Mantenimiento</option>
                                        <option value="Ingeniería">Ingeniería</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="General">General</option>
                                        <option value="Sistemas">Sistemas</option>
                                        <option value="Compras">Compras</option>
                                        <option value="Banquetes">Banquetes</option>
                                        <option value="Eventos">Eventos</option>
                                        <option value="Ama de Llaves">Ama de Llaves</option>
                                        <option value="Recursos Humanos">RRHH</option>
                                        <option value="Finanzas">Finanzas</option>
                                        <option value="Mantenimiento">Mantenimiento</option>
                                    </>
                                )}
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
    const { profile } = useAuth();
    const role = (profile?.role || '').toLowerCase();
    const isAdmin = role === 'admin' && !isMaintenanceArea(profile?.department);
    const isMaintScoped = !isAdmin && isMaintenanceArea(profile?.department);
    const canManageStatus = role === 'admin' || role === 'jefe_mantenimiento';

    const [selectedUser, setSelectedUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [stats, setStats] = useState({ total: 0, active: 0, techs: 0, admins: 0 });

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        try {
            let data = await userService.getAll();
            
            // Solo jefatura de mantenimiento queda acotada a su área.
            // Admin global siempre ve todo el directorio.
            if (isMaintScoped) {
                data = data.filter(u => isMaintenanceArea(u.department));
            }

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
    }, [isMaintScoped]);

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
    }, [fetchUsers]);

    const handleSaveUser = async (formData) => {
        const result = await userService.register(
            formData.email,
            null,
            formData.full_name,
            formData.role,
            formData.department,
            profile?.id
        );

        if (result.success) {
            await fetchUsers();
            const emailNote = result.passwordSetupEmailSent
                ? ' También se envió correo para definir contraseña.'
                : ' Si no llegó correo para contraseña, usa "Recuperar contraseña" en login.';
            alert("Usuario creado exitosamente. Revisa correo de confirmación/activación." + emailNote);
        } else {
            alert("Error al crear usuario: " + result.error);
        }
        return result;
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

    const handleToggleStatus = async (targetUser) => {
        if (!targetUser?.id || !profile?.id) return;
        const success = await userService.toggleUserStatus(targetUser.id, targetUser.status, profile.id);

        if (success) {
            setUsers((prev) => prev.map((u) =>
                u.id === targetUser.id ? { ...u, status: !targetUser.status } : u
            ));

            if (selectedUser?.id === targetUser.id) {
                setSelectedUser((prev) => ({ ...prev, status: !targetUser.status }));
            }

            await fetchUsers();
        } else {
            alert('No se pudo actualizar el estado del usuario.');
        }
    };

    const getEquipmentSummary = (targetUser) => {
        const assets = targetUser?.assigned_assets || [];
        if (assets.length === 0) {
            return {
                total: 0,
                breakdown: targetUser?.assigned_equipment || 'Sin equipos asignados',
            };
        }

        const labels = assets
            .map((asset) => asset?.hostname || asset?.label || null)
            .filter(Boolean);
        const parts = labels.slice(0, 3);
        if (labels.length > 3) {
            parts.push(`+${labels.length - 3} más`);
        }

        return {
            total: assets.length,
            breakdown: parts.join(', '),
        };
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Empleados" value={stats.total} trend={isMaintScoped ? "Mantenimiento" : "Totales"} icon={Users} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Activos" value={stats.active} trend="En línea" icon={UserCheck} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label={isMaintScoped ? "Ingenieros" : "Técnicos"} value={stats.techs} trend="Área" icon={Shield} color="text-blue-600" bg="bg-blue-100" />
                {!isMaintScoped && <StatCard label="Administradores" value={stats.admins} trend="Sistemas" icon={ShieldCheck} color="text-purple-600" bg="bg-purple-100" />}
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
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Equipos</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Acceso</th>
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Registrado</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-500">
                                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            Cargando directorio...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500">
                                        {searchTerm ? 'No se encontraron usuarios con esa búsqueda.' : 'No hay usuarios registrados.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const equipment = getEquipmentSummary(user);
                                    return (
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
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">
                                                        <Monitor size={12} />
                                                        <Laptop size={12} />
                                                        {equipment.total}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={equipment.breakdown}>
                                                    {equipment.breakdown}
                                                </p>
                                                {!isMaintScoped && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedUser(user);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-600 hover:text-white"
                                                    >
                                                        Asignar equipo
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <UserStatusBadge status={user.status} />
                                        </td>
                                        <td className="p-4">
                                            {canManageStatus && profile?.id !== user.id ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleStatus(user);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${user?.status
                                                        ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-600 hover:text-white'
                                                        : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-600 hover:text-white'
                                                        }`}
                                                >
                                                    {user?.status ? 'Suspender' : 'Reactivar'}
                                                </button>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin acción</span>
                                            )}
                                        </td>
                                        <td className="p-4 pr-6 text-right font-medium text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                    );
                                })
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
                onDeleteUser={handleDeleteUser}
                onToggleStatus={handleToggleStatus}
                onAssetsChanged={async () => {
                    await fetchUsers();
                    if (selectedUser?.id) {
                        const refreshed = await userService.getAll();
                        const found = refreshed.find((u) => u.id === selectedUser.id);
                        if (found) setSelectedUser(found);
                    }
                }}
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



