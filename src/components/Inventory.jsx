import React, { useState, useEffect } from 'react';
import { Plus, Search, CheckCircle2, AlertCircle, Wrench, Package, ArrowRightLeft, UploadCloud, Download, X, Laptop, Monitor, Smartphone, Server, FileDigit, Trash2, Edit } from 'lucide-react';
import StatCard from './StatCard';
import { inventoryService } from '../services/inventoryService';

// --- HELPERS ---
const STATUS_MAP = {
    'active': { label: 'Activo', style: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: CheckCircle2 },
    'available': { label: 'En Almacén', style: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20', icon: Package },
    'decommissioned': { label: 'Dado de Baja', style: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20', icon: Trash2 },
};

const getDeviceIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes('laptop') || t.includes('pc')) return <Laptop size={18} />;
    if (t.includes('monitor') || t.includes('pantalla')) return <Monitor size={18} />;
    if (t.includes('switch') || t.includes('server') || t.includes('red')) return <Server size={18} />;
    if (t.includes('celular') || t.includes('movil') || t.includes('phone')) return <Smartphone size={18} />;
    return <Laptop size={18} />;
};

const DeviceStatusBadge = ({ status, size = 'sm' }) => {
    const s = STATUS_MAP[status] || STATUS_MAP['available'];
    const Icon = s.icon;
    const padding = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';
    
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-xl border ${padding} font-black uppercase tracking-widest ${s.style}`}>
            <Icon size={size === 'sm' ? 12 : 14} />
            {s.label}
        </span>
    );
};

// --- IMPORT MODAL ---
const ImportModal = ({ isOpen, onClose, onImportSuccess }) => {
    const [csvData, setCsvData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length < 2) {
                setError("El archivo parece estar vacío o no tiene encabezados.");
                return;
            }
            
            const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
            setHeaders(rawHeaders);
            
            const parsed = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                rawHeaders.forEach((header, index) => {
                    obj[header] = values[index]?.trim() || '';
                });
                return obj;
            });
            
            setCsvData(parsed);
            setError(null);
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        setLoading(true);
        // Map detected columns to backend schema
        const mappedItems = csvData.map(row => {
            // Find columns by matching keywords
            const findCol = (keywords) => {
                for (let h of headers) {
                    for (let k of keywords) {
                        if (h.includes(k)) return row[h];
                    }
                }
                return '';
            };

            return {
                id: findCol(['id', 'activo fijo', 'asset']),
                type: findCol(['nombre', 'tipo', 'equipo', 'name', 'type']),
                model: findCol(['modelo', 'model']),
                serial: findCol(['serie', 'serial']),
                category: findCol(['categoria', 'category']),
                status: 'available' // Todos entran a almacén por defecto al importar
            };
        });

        const success = await inventoryService.bulkImport(mappedItems);
        if (success) {
            onImportSuccess();
        } else {
            setError("Ocurrió un error al importar los equipos. Revisa el formato.");
        }
        setLoading(false);
    };

    const reset = () => {
        setCsvData([]);
        setHeaders([]);
        setError(null);
        onClose();
    };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity" onClick={reset}></div>
            <div className="fixed inset-4 sm:inset-10 lg:inset-x-32 xl:inset-x-64 bg-white dark:bg-slate-900 shadow-2xl z-50 rounded-[2rem] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Importación Masiva</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Cargar Inventario desde CSV</p>
                    </div>
                    <button onClick={reset} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={24} /></button>
                </div>
                
                <div className="flex-1 overflow-auto p-6 md:p-10 custom-scrollbar">
                    {csvData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <label className="w-full max-w-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group">
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-blue-500 group-hover:scale-110 transition-transform">
                                    <UploadCloud size={32} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-black text-slate-700 dark:text-slate-200">Subir Archivo CSV</h3>
                                    <p className="text-sm text-slate-500 font-medium mt-1">El archivo debe contener columnas como: Activo Fijo, Nombre, Modelo, Serie, Categoría</p>
                                </div>
                            </label>
                            {error && <div className="text-red-500 text-sm font-bold bg-red-50 p-4 rounded-xl">{error}</div>}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-slate-800 dark:text-white text-lg">Previsualización de Datos ({csvData.length} equipos)</h3>
                                <button onClick={() => setCsvData([])} className="text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white underline uppercase">Subir otro archivo</button>
                            </div>
                            
                            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            {headers.slice(0, 6).map((h, i) => (
                                                <th key={i} className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{h}</th>
                                            ))}
                                            {headers.length > 6 && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">...</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {csvData.slice(0, 5).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                                {headers.slice(0, 6).map((h, i) => (
                                                    <td key={i} className="p-4 text-sm font-medium text-slate-700 dark:text-slate-300">{row[h] || '-'}</td>
                                                ))}
                                                {headers.length > 6 && <td className="p-4 text-sm font-medium text-slate-500">...</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {csvData.length > 5 && <div className="p-3 text-center text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 uppercase tracking-widest">Mostrando 5 de {csvData.length} filas</div>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4 bg-white dark:bg-slate-900">
                    <button onClick={reset} className="px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</button>
                    <button 
                        onClick={handleImport}
                        disabled={csvData.length === 0 || loading}
                        className="px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                    >
                        {loading ? 'Importando...' : 'Confirmar y Guardar'}
                    </button>
                </div>
            </div>
        </>
    );
};

// --- ADD/EDIT DEVICE SLIDER ---
const DeviceSlider = ({ isOpen, onClose, onSave, editingDevice = null }) => {
    const [formData, setFormData] = useState({
        id: '',
        type: '',
        model: '',
        serial: '',
        category: '',
        status: 'available',
        specsDetails: ''
    });

    useEffect(() => {
        if (editingDevice) {
            setFormData({
                id: editingDevice.id,
                type: editingDevice.type || '',
                model: editingDevice.model || '',
                serial: editingDevice.serial || '',
                category: editingDevice.category || '',
                status: editingDevice.status || 'available',
                specsDetails: editingDevice.specsDetails || ''
            });
        } else {
            setFormData({
                id: '', type: '', model: '', serial: '', category: '', status: 'available', specsDetails: ''
            });
        }
    }, [editingDevice, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity animate-in fade-in" onClick={onClose}></div>
            <div className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{editingDevice ? 'Editar Equipo' : 'Alta de Equipo'}</h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Gestión de Inventario IT</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><X size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Activo Fijo (Opcional)</label>
                                <input type="text" name="id" disabled={!!editingDevice} value={formData.id} onChange={handleChange} placeholder="Auto-generado si vacío" className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 outline-none ${editingDevice ? 'opacity-60 cursor-not-allowed' : ''}`} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estatus</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none">
                                    <option value="active">Activo (En Uso)</option>
                                    <option value="available">En Almacén</option>
                                    <option value="decommissioned">Dado de Baja (Obsoleto)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre / Tipo de Equipo</label>
                            <input type="text" name="type" required value={formData.type} onChange={handleChange} placeholder="Ej. Laptop, PC, Switch..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo / Marca</label>
                                <input type="text" name="model" value={formData.model} onChange={handleChange} placeholder="Ej. Dell XPS 15" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Serie</label>
                                <input type="text" name="serial" value={formData.serial} onChange={handleChange} placeholder="S/N..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                            <input type="text" name="category" value={formData.category} onChange={handleChange} placeholder="Ej. Laptops Nuevas, Redes, etc." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Especificaciones Adicionales</label>
                            <textarea name="specsDetails" value={formData.specsDetails} onChange={handleChange} rows="4" placeholder="RAM, Disco Duro, Observaciones libres..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 resize-none"></textarea>
                        </div>
                    </div>

                    <div className="pt-8 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
                        <button type="submit" className="flex-[2] py-4 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-black dark:hover:bg-blue-500 shadow-xl shadow-blue-500/20 transition-all">{editingDevice ? 'Guardar Cambios' : 'Registrar Equipo'}</button>
                    </div>
                </form>
            </div>
        </>
    );
}

// --- MAIN MODULE VIEW ---
const InventoryView = () => {
    const [activeTab, setActiveTab] = useState('active'); // active, obsolete
    const [inventoryList, setInventoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);

    const loadInventory = async () => {
        setIsLoading(true);
        const data = await inventoryService.getAll();
        setInventoryList(data || []);
        setIsLoading(false);
    };

    useEffect(() => { loadInventory(); }, []);

    const handleSaveDevice = async (formData) => {
        let success = false;
        if (editingDevice) {
            success = await inventoryService.update(editingDevice.id, formData);
        } else {
            success = await inventoryService.add(formData);
        }
        
        if (success) {
            await loadInventory();
            setEditingDevice(null);
        } else {
            alert("Hubo un error al procesar el equipo.");
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm("¿Seguro que deseas eliminar permanentemente este registro? (No aparecerá en Obsoletos)")) {
            if(await inventoryService.remove(id)){
                loadInventory();
            }
        }
    };

    const handleStatusQuickChange = async (id, newStatus) => {
        if(await inventoryService.update(id, {status: newStatus})){
            loadInventory();
        }
    }

    // Filters
    const filteredList = inventoryList.filter(d => {
        const matchesTab = activeTab === 'active' 
            ? (d.status === 'active' || d.status === 'available')
            : d.status === 'decommissioned';
            
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
            (d.id && d.id.toLowerCase().includes(search)) ||
            (d.type && d.type.toLowerCase().includes(search)) ||
            (d.model && d.model.toLowerCase().includes(search)) ||
            (d.serial && d.serial.toLowerCase().includes(search)) ||
            (d.category && d.category.toLowerCase().includes(search));
            
        return matchesTab && matchesSearch;
    });

    const activeCount = inventoryList.filter(i => i.status === 'active').length;
    const warehouseCount = inventoryList.filter(i => i.status === 'available').length;
    const obsoleteCount = inventoryList.filter(i => i.status === 'decommissioned').length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300 relative z-0">
            {/* Headers & Stats */}
            <div className="flex flex-col xl:flex-row gap-6">
                <div className="xl:w-2/3 bg-slate-950 dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <h2 className="text-3xl font-black text-white tracking-tight leading-tight">Gestión de Activos Fijos</h2>
                    <p className="text-slate-400 text-sm font-medium max-w-lg mt-2 mb-6">Administra el inventario de hardware. Mantén un control de equipos activos, almacenados y aquellos que han cumplido su ciclo de vida.</p>
                    
                    <div className="flex flex-wrap gap-4 mt-auto relative z-10">
                        <button onClick={() => {setEditingDevice(null); setIsAddModalOpen(true);}} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2">
                            <Plus size={16} /> Alta Manual
                        </button>
                        <button onClick={() => setIsImportModalOpen(true)} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all backdrop-blur-sm flex items-center gap-2">
                            <UploadCloud size={16} /> Importar Desde Excel
                        </button>
                    </div>
                </div>

                <div className="xl:w-1/3 flex flex-col gap-4">
                    <StatCard label="Equipos Asignados (En Uso)" value={activeCount} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-500/10" />
                    <StatCard label="Disponibles (Almacén)" value={warehouseCount} icon={Package} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-500/10" />
                    <StatCard label="Viejos / Obsoletos" value={obsoleteCount} icon={Trash2} color="text-rose-500" bg="bg-rose-50 dark:bg-rose-500/10" />
                </div>
            </div>

            {/* Inventory Container */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col transition-colors">
                
                {/* Search and Tabs Bar */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto">
                        <button onClick={() => setActiveTab('active')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                            Nuevos y Activos
                        </button>
                        <button onClick={() => setActiveTab('obsolete')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'obsolete' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                            Viejos / Obsoletos
                        </button>
                    </div>

                    <div className="w-full sm:max-w-xs flex items-center gap-3 bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                        <Search size={16} className="text-slate-400 focus-within:text-blue-500" />
                        <input type="text" placeholder="Buscar ID, Modelo, Serie..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-bold" />
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Equipo</th>
                                <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Identificación</th>
                                <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Categoría</th>
                                <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Estatus</th>
                                <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Cargando inventario...</td>
                                </tr>
                            ) : filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <FileDigit size={32} />
                                            <span className="font-bold uppercase tracking-widest text-[10px]">No hay equipos en esta sección.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map(item => (
                                    <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/40 group-hover:text-blue-500 transition-colors">
                                                    {getDeviceIcon(item.type)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{item.type} <span className="text-slate-400 font-normal">| {item.model || 'Sin Modelo'}</span></div>
                                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">{item.specsDetails ? 'Ver Especificaciones...' : 'Sin especificaciones detalladas'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900 dark:text-white tracking-tight">{item.id}</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5 font-bold shrink-0">SN: {item.serial || 'N/A'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                {item.category || 'General'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <DeviceStatusBadge status={item.status} />
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                {activeTab === 'active' ? (
                                                    <button onClick={() => handleStatusQuickChange(item.id, item.status === 'active' ? 'available' : 'active')} title="Cambiar Almacén / Uso" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 transition-colors rounded-xl">
                                                        <ArrowRightLeft size={16} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleStatusQuickChange(item.id, 'available')} title="Reactivar a Almacén" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-600 transition-colors rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-1">
                                                        <CheckCircle2 size={14} /> Reactivar
                                                    </button>
                                                )}

                                                <button onClick={() => {setEditingDevice(item); setIsAddModalOpen(true);}} title="Editar" className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 transition-colors rounded-xl">
                                                    <Edit size={16} />
                                                </button>

                                                {activeTab === 'active' ? (
                                                    <button onClick={() => handleStatusQuickChange(item.id, 'decommissioned')} title="Dar de Baja" className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors rounded-xl">
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleDelete(item.id)} title="Eliminar Definitivo" className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors rounded-xl">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <DeviceSlider 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                editingDevice={editingDevice}
                onSave={handleSaveDevice}
            />
            
            <ImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                onImportSuccess={() => { setIsImportModalOpen(false); loadInventory(); }}
            />
        </div>
    );
};

export default InventoryView;
