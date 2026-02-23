import React, { useState } from 'react';
import { Plus, ListFilter, X, Laptop, Monitor, Smartphone, CheckCircle2, AlertCircle, Wrench, Search } from 'lucide-react';
import { inventoryData, inventoryStats } from '../data/mockData';
import StatCard from './StatCard';

// --- SUBCOMPONENTE: Badge de Estado del Dispositivo ---
export const DeviceStatusBadge = ({ status, size = 'sm' }) => {
    const config = {
        Active: {
            style: 'text-emerald-600 bg-emerald-50 border-emerald-100/50 shadow-sm shadow-emerald-500/5',
            icon: CheckCircle2,
            label: 'Activo'
        },
        'In Repair': {
            style: 'text-amber-600 bg-amber-50 border-amber-100/50 shadow-sm shadow-amber-500/5',
            icon: Wrench,
            label: 'En Reparación'
        },
        Available: {
            style: 'text-blue-600 bg-blue-50 border-blue-100/50 shadow-sm shadow-blue-500/5',
            icon: AlertCircle,
            label: 'Disponible'
        }
    };

    const current = config[status] || {
        style: 'text-slate-500 bg-slate-50 border-slate-100',
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
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in"
                onClick={onClose}
            ></div>

            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300`}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ficha Técnica</span>
                        <h2 className="text-xl font-black text-slate-900">{device?.id}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 text-sm">
                    {/* Header Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-blue-600 bg-blue-50 p-3 w-fit rounded-2xl border border-blue-100 shadow-sm shadow-blue-500/10">
                            <DeviceTypeIcon type={device?.type} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{device?.model}</h3>
                        <div className="flex items-center gap-3">
                            <DeviceStatusBadge status={device?.status} size="lg" />
                            <span className="text-slate-400 font-medium flex items-center gap-1">• Garantía: {device?.warranty}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest block">Asignado a</span>
                            <span className="text-slate-900 font-bold text-base block">{device?.user}</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest block">Departamento</span>
                            <span className="text-indigo-600 font-bold text-base block">{device?.department}</span>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            Especificaciones Técnicas Registradas
                        </h4>

                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="grid grid-cols-2 border-b border-slate-100 p-4">
                                <span className="text-slate-500 font-medium">Condición Física</span>
                                <span className="text-slate-900 font-bold text-right">{device?.condition}</span>
                            </div>
                            <div className="grid grid-cols-2 border-b border-slate-100 p-4 bg-slate-50/50">
                                <span className="text-slate-500 font-medium">RAM Registrada</span>
                                <span className="text-slate-900 font-bold text-right">16 GB DDR4</span>
                            </div>
                            <div className="grid grid-cols-2 p-4">
                                <span className="text-slate-500 font-medium">Almacenamiento</span>
                                <span className="text-slate-900 font-bold text-right">512 GB SSD NVMe</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- COMPONENTE EXPORTADO PRINCIPAL: Módulo de Inventario ---
const InventoryView = () => {
    const [selectedDevice, setSelectedDevice] = useState(null);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Dispositivos" value={inventoryStats.total} trend="Activos" icon={Laptop} color="text-slate-600" bg="bg-slate-100" />
                <StatCard label="Asignados" value={inventoryStats.active} trend="~85%" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-100" />
                <StatCard label="En Reparación" value={inventoryStats.inRepair} trend="Urgente" icon={Wrench} color="text-amber-600" bg="bg-amber-100" />
                <StatCard label="Disponibles" value={inventoryStats.available} trend="Almacén" icon={AlertCircle} color="text-blue-600" bg="bg-blue-100" />
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="p-8 flex flex-col justify-between items-start gap-6 border-b border-slate-100/60 bg-slate-50/30">
                    <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Registro de Activos Fijos</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Control de Equipos de Cómputo</p>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="flex-1 md:w-64 flex items-center gap-3 text-slate-400 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                                <Search size={16} className="group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar Serie o Empleado..."
                                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400 font-medium"
                                />
                            </div>
                            <button className="flex items-center gap-2 bg-blue-600 hover:bg-black text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-black/20 hover:-translate-y-0.5 whitespace-nowrap">
                                <Plus size={18} strokeWidth={2.5} />
                                <span className="hidden sm:inline">Nuevo Equipo</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto p-4">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50">ID Activo</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50">Tipo / Modelo</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50">Asignación</th>
                                <th className="p-4 pb-6 border-b border-slate-100/50">Estado</th>
                                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 text-right">Garantía</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {inventoryData.map((device) => (
                                <tr key={device.id} onClick={() => setSelectedDevice(device)} className="group transition-all duration-300 hover:bg-slate-50/80 cursor-pointer">
                                    <td className="p-4 pl-6">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-colors">
                                            <span className="font-bold text-slate-900">{device.id}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="text-slate-400 bg-slate-50 group-hover:bg-blue-50 group-hover:text-blue-600 p-2 rounded-xl transition-colors">
                                                <DeviceTypeIcon type={device.type} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-slate-900 font-bold">{device.model}</span>
                                                <span className="text-slate-400 text-xs font-medium">{device.type}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${device.user === 'Unassigned' ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                                                {device.user === 'Unassigned' ? 'Sin Asignar (Bodega)' : device.user}
                                            </span>
                                            <span className="text-indigo-600 text-xs font-bold uppercase tracking-widest">{device.department}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <DeviceStatusBadge status={device.status} />
                                    </td>
                                    <td className="p-4 pr-6 text-right font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                                        {device.warranty}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drawer Component Mounted Here */}
            <DeviceDetailSlider
                device={selectedDevice}
                isOpen={!!selectedDevice}
                onClose={() => setSelectedDevice(null)}
            />
        </div>
    );
};

export default InventoryView;
