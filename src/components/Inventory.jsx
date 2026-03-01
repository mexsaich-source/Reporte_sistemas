import React, { useState, useEffect } from 'react';
import { Plus, ListFilter, X, Laptop, Monitor, Smartphone, CheckCircle2, AlertCircle, Wrench, Search, HardDrive, Cpu, ShieldCheck } from 'lucide-react';
import StatCard from './StatCard';
import { inventoryService } from '../services/inventoryService';

// --- SUBCOMPONENTE: Badge de Estado del Dispositivo ---
export const DeviceStatusBadge = ({ status, size = 'sm' }) => {
    const config = {
        Active: {
            style: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100/50 dark:border-emerald-500/20 shadow-sm shadow-emerald-500/5',
            icon: CheckCircle2,
            label: 'Activo'
        },
        'In Repair': {
            style: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100/50 dark:border-amber-500/20 shadow-sm shadow-amber-500/5',
            icon: Wrench,
            label: 'En Reparación'
        },
        Available: {
            style: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100/50 dark:border-blue-500/20 shadow-sm shadow-blue-500/5',
            icon: AlertCircle,
            label: 'Disponible'
        }
    };

    const current = config[status] || {
        style: 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700',
        icon: AlertCircle,
        label: status
    };

    const Icon = current.icon;
    const isSm = size === 'sm';
    const padding = isSm ? 'px-2.5 py-1 text-xs font-medium' : 'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest';

    return (
        <span className={`inline-flex items-center gap-2 rounded-xl border ${padding} ${current.style} transition-all`}>
            <Icon size={isSm ? 14 : 14} className={status === 'In Repair' ? 'animate-pulse' : ''} />
            {current.label}
        </span>
    );
};

// --- SUBCOMPONENTE: Icono Dinámico según Tipo ---
const DeviceTypeIcon = ({ type }) => {
    switch (type) {
        case 'Laptop': return <Laptop size={18} />;
        case 'Monitor': return <Monitor size={18} />;
        case 'Smartphone': return <Smartphone size={18} />;
        case 'Desktop': return <Laptop size={18} />; // Defaulting to generic tech icon
        default: return <Laptop size={18} />;
    }
};

// --- SUBCOMPONENTE: Slider Lateral Extraíble de Dispositivo ---
const DeviceDetailSlider = ({ device, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ficha Técnica</span>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{device?.id}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 text-sm">
                    {/* Header Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 p-3 w-fit rounded-2xl border border-blue-100 dark:border-blue-500/20 shadow-sm shadow-blue-500/10">
                            <DeviceTypeIcon type={device?.type} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{device?.model}</h3>
                        <div className="flex items-center gap-3">
                            <DeviceStatusBadge status={device?.status} size="lg" />
                            <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">• Garantía: {device?.warranty}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-1 shadow-inner">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest block">Asignado a</span>
                            <span className="text-slate-900 dark:text-slate-200 font-bold text-base block">{device?.user}</span>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-1 shadow-inner">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest block">Departamento</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-base block">{device?.department}</span>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[10px] flex items-center gap-2">
                            Especificaciones Técnicas Registradas
                        </h4>

                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                            <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-700 p-4">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Condición Física</span>
                                <span className="text-slate-900 dark:text-slate-200 font-bold text-right">{device?.condition}</span>
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-700/30">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">RAM Registrada</span>
                                <span className="text-slate-900 dark:text-slate-200 font-bold text-right">16 GB DDR4</span>
                            </div>
                            <div className="grid grid-cols-2 p-4">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Almacenamiento</span>
                                <span className="text-slate-900 dark:text-slate-200 font-bold text-right">512 GB SSD NVMe</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- SUBCOMPONENTE: Formulario para Añadir Nuevo Equipo ---
const AddDeviceSlider = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        type: 'Laptop',
        model: '',
        user: '',
        department: 'Sistemas',
        status: 'Available',
        warranty: '2027-01-01',
        condition: 'Nuevo'
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
        // Reset form
        setFormData({
            type: 'Laptop',
            model: '',
            user: '',
            department: 'Sistemas',
            status: 'Available',
            warranty: '2027-01-01',
            condition: 'Nuevo'
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[550px] bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-500`}>
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Nuevo Equipo</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Registro de activo fijo</p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* Sección: Información Básica */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Laptop size={16} className="text-blue-500" />
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[11px]">Información del Equipo</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Dispositivo</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                                >
                                    <option value="Laptop">Laptop</option>
                                    <option value="Monitor">Monitor</option>
                                    <option value="Smartphone">Smartphone</option>
                                    <option value="Desktop">Workstation</option>
                                    <option value="Tablet">Tablet</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado Inicial</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                                >
                                    <option value="Available">Disponible (Almacén)</option>
                                    <option value="Active">Activo (En Uso)</option>
                                    <option value="In Repair">En Reparación</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo / Marca</label>
                            <input
                                type="text"
                                name="model"
                                required
                                value={formData.model}
                                onChange={handleChange}
                                placeholder="Ej. Dell Latitude 7420"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Sección: Asignación */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <ShieldCheck size={16} className="text-indigo-500" />
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[11px]">Asignación y Ubicación</h3>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuario Asignado</label>
                            <input
                                type="text"
                                name="user"
                                value={formData.user}
                                onChange={handleChange}
                                placeholder="Ej. Juan Pérez (O dejar en blanco)"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                            >
                                <option value="Sistemas">Sistemas</option>
                                <option value="Recursos Humanos">Recursos Humanos</option>
                                <option value="Finanzas">Finanzas</option>
                                <option value="Operaciones">Operaciones</option>
                                <option value="Ventas">Ventas</option>
                                <option value="Mantenimiento">Mantenimiento</option>
                            </select>
                        </div>
                    </div>

                    {/* Sección: Detalles Técnicos */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <Cpu size={16} className="text-amber-500" />
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[11px]">Especificaciones Técnicas</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condición</label>
                                <select
                                    name="condition"
                                    value={formData.condition}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none appearance-none"
                                >
                                    <option value="Nuevo">Completamente Nuevo</option>
                                    <option value="Excelente">Excelente (Usado)</option>
                                    <option value="Bueno">Bueno (Con detalles)</option>
                                    <option value="Regular">Regular</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fin de Garantía</label>
                                <input
                                    type="date"
                                    name="warranty"
                                    value={formData.warranty}
                                    onChange={handleChange}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer con acciones */}
                    <div className="pt-8 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-black dark:hover:bg-blue-500 shadow-xl shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5 transition-all"
                        >
                            Guardar Equipo
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

// --- COMPONENTE EXPORTADO PRINCIPAL: Módulo de Inventario ---
const InventoryView = () => {
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [inventoryList, setInventoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadInventory();
    }, []);

    const loadInventory = async () => {
        setIsLoading(true);
        const data = await inventoryService.getAll();
        setInventoryList(data);
        setIsLoading(false);
    };

    const handleSaveNewDevice = async (formData) => {
        const newItem = {
            ...formData,
            user: formData.user || 'Unassigned'
        };
        const added = await inventoryService.add(newItem);
        if (added) {
            loadInventory(); // Reload from storage
        }
    };

    const filteredInventory = inventoryList.filter(device =>
        device.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Dispositivos" value={inventoryList.length} trend="Activos" icon={Laptop} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Asignados" value={inventoryList.filter(i => i.status === 'Active').length} trend="Operacionales" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="En Reparación" value={inventoryList.filter(i => i.status === 'In Repair').length} trend="Taller" icon={Wrench} color="text-amber-600" bg="bg-amber-100" />
                <StatCard label="Disponibles" value={inventoryList.filter(i => i.status === 'Available').length} trend="Almacén" icon={AlertCircle} color="text-blue-600" bg="bg-blue-100" />
            </div>

            {/* Table Area */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors duration-300">
                <div className="p-8 flex flex-col justify-between items-start gap-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
                    <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Registro de Activos Fijos</h3>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Control de Equipos de Cómputo</p>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="flex-1 md:w-64 flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                                <Search size={16} className="group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar Serie o Empleado..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
                                />
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5 whitespace-nowrap"
                            >
                                <Plus size={18} strokeWidth={2.5} />
                                <span className="hidden sm:inline">Nuevo Equipo</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto p-4 min-h-[400px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-slate-400">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                            <span className="font-bold text-xs uppercase tracking-widest">Sincronizando Inventario...</span>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                                    <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">ID Activo</th>
                                    <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Tipo / Modelo</th>
                                    <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Asignación</th>
                                    <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado</th>
                                    <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Garantía</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredInventory.map((device) => (
                                    <tr key={device.id} onClick={() => setSelectedDevice(device)} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer">
                                        <td className="p-4 pl-6">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-700 border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                                                <span className="font-bold text-slate-900 dark:text-slate-100">{device.id}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 p-2 rounded-xl transition-colors">
                                                    <DeviceTypeIcon type={device.type} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 dark:text-slate-200 font-bold">{device.model}</span>
                                                    <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">{device.type}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className={`font-bold ${device.user === 'Unassigned' ? 'text-slate-400 italic dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {device.user === 'Unassigned' ? 'Sin Asignar (Bodega)' : device.user}
                                                </span>
                                                <span className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest">{device.department}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <DeviceStatusBadge status={device.status} />
                                        </td>
                                        <td className="p-4 pr-6 text-right font-medium text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                                            {device.warranty}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Drawers */}
            <DeviceDetailSlider
                device={selectedDevice}
                isOpen={!!selectedDevice}
                onClose={() => setSelectedDevice(null)}
            />

            <AddDeviceSlider
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleSaveNewDevice}
            />
        </div>
    );
};

export default InventoryView;
