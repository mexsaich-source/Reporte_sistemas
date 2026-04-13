/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { Plus, Search, CheckCircle2, AlertCircle, Wrench, Package, ArrowRightLeft, UploadCloud, Download, X, Laptop, Monitor, Smartphone, Server, FileDigit, Trash2, Edit, AlertTriangle, MonitorPlay, Settings, Filter, Clock } from 'lucide-react';
import StatCard from './StatCard';
import { inventoryService } from '../services/inventoryService';
import { useAuth } from '../context/authStore';

// --- HELPERS ---
const STATUS_MAP = {
    'active': { label: 'En Uso', style: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20', icon: CheckCircle2 },
    'available': { label: 'En Bodega', style: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100/50 dark:border-blue-500/20', icon: Package },
    'loaned': { label: 'Prestado', style: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-100/50 dark:border-purple-500/20', icon: Clock },
    'request_pending': { label: 'Pendiente', style: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20', icon: AlertCircle },
    'denied': { label: 'Denegado', style: 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20', icon: AlertTriangle },
    'decommissioned': { label: 'Obsoleto', style: 'text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700', icon: Trash2 },
};

const DEVICE_TYPES = ['Todos', 'Laptop', 'Workstation', 'Monitor', 'Teclado / Mouse', 'Switch / Red', 'Servidor', 'Smartphone', 'Impresora', 'Otros'];

const STATUS_FILTERS = [
    { value: 'Todos', label: 'Estatus (Todos)' },
    { value: 'active', label: 'En Uso' },
    { value: 'available', label: 'En Bodega' },
    { value: 'loaned', label: 'Prestado' },
    { value: 'request_pending', label: 'Pendiente Solicitud' },
    { value: 'denied', label: 'Denegado' },
    { value: 'decommissioned', label: 'Obsoleto' },
];

const TYPE_FILTER_KEYWORDS = {
    'Laptop': ['laptop', 'notebook'],
    'Workstation': ['workstation', 'desktop', 'pc', 'all in one'],
    'Monitor': ['monitor', 'pantalla'],
    'Teclado / Mouse': ['teclado', 'keyboard', 'mouse', 'periferico', 'periférico'],
    'Switch / Red': ['switch', 'router', 'firewall', 'red', 'access point', 'ap'],
    'Servidor': ['server', 'servidor'],
    'Smartphone': ['smartphone', 'phone', 'celular', 'movil', 'móvil'],
    'Impresora': ['impresora', 'printer'],
};

const getDeviceIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('laptop')) return <Laptop size={18} />;
    if (t.includes('workstation') || t.includes('desktop') || t.includes('pc')) return <MonitorPlay size={18} />;
    if (t.includes('monitor') || t.includes('pantalla')) return <Monitor size={18} />;
    if (t.includes('switch') || t.includes('server') || t.includes('red')) return <Server size={18} />;
    if (t.includes('celular') || t.includes('movil') || t.includes('phone')) return <Smartphone size={18} />;
    return <Package size={18} />;
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
                setError("Archivo vacío."); return;
            }
            const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
            setHeaders(rawHeaders);
            const parsed = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                rawHeaders.forEach((header, index) => { obj[header] = values[index]?.trim() || ''; });
                return obj;
            });
            setCsvData(parsed);
            setError(null);
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        setLoading(true);
        const mappedItems = csvData.map(row => {
            const findCol = (keywords) => {
                for (let h of headers) { for (let k of keywords) { if (h.includes(k)) return row[h]; } }
                return '';
            };

            let serial = findCol(['serial_number', 'serie', 'sn', 'sn_number']);
            if (serial.toUpperCase().startsWith('MEXSA')) {
                serial = serial.substring(5);
            }

            return {
                id: findCol(['asset_type', 'id', 'activo fijo']),
                type: findCol(['tipo', 'laptop', 'pc', 'monitor', 'equipo']),
                brand: findCol(['brand', 'marca']),
                model: findCol(['model', 'modelo']),
                serial: serial,
                status: 'available'
            };
        });

        const { importService } = await import('../services/importService');
        await importService.processImport('inventory', mappedItems, 'Admin', 'Import.csv');
        onImportSuccess();
        setLoading(false);
    };

    const reset = () => { setCsvData([]); setHeaders([]); setError(null); onClose(); };

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]" onClick={reset}></div>
            <div className="fixed inset-4 sm:inset-10 lg:inset-x-32 xl:inset-x-64 bg-white dark:bg-slate-900 shadow-2xl z-[101] rounded-[2.5rem] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-slate-800 dark:text-white">
                    <h2 className="text-2xl font-black">Importador Inteligente</h2>
                    <button onClick={reset} className="p-2 hover:bg-slate-100 rounded-xl"><X size={24}/></button>
                </div>
                <div className="flex-1 p-8 overflow-auto custom-scrollbar">
                    {error && (
                        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                            {error}
                        </div>
                    )}
                    {csvData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem]">
                            <UploadCloud size={48} className="text-blue-500 mb-4" />
                            <label className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs cursor-pointer hover:bg-blue-500 transition-all">
                                Seleccionar CSV
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="font-bold text-slate-500">Detectamos {csvData.length} registros listos.</p>
                            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
                                <table className="w-full text-left text-xs bg-slate-50/50 dark:bg-slate-900/50">
                                    <thead><tr className="border-b"><th className="p-4">Vista Previa</th></tr></thead>
                                    <tbody>{csvData.slice(0, 3).map((r, i) => <tr key={i} className="border-b"><td className="p-4">{JSON.stringify(r)}</td></tr>)}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-8 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <button onClick={reset} className="px-6 py-3 font-black text-xs uppercase text-slate-400">Cancelar</button>
                    <button onClick={handleImport} disabled={csvData.length === 0 || loading} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-500/20">Procesar Ahora</button>
                </div>
            </div>
        </>
    );
};

// --- DEVICE SLIDER ---
const DeviceSlider = ({ isOpen, onClose, onSave, editingDevice = null, onAddNote }) => {
    const [formData, setFormData] = useState({ 
        id: '', type: 'Laptop', brand: '', model: '', serial: '', category: '', location: '',
        status: 'available', specsDetails: '', loanDate: '', returnDate: '', loanUser: '' 
    });
    const [noteDraft, setNoteDraft] = useState('');
    const [notes, setNotes] = useState([]);
    useEffect(() => {
        if (editingDevice) {
            setFormData({
                id: editingDevice.id,
                type: editingDevice.type || 'Laptop',
                brand: editingDevice.brand || '',
                model: editingDevice.model || '',
                serial: editingDevice.serial || '',
                category: editingDevice.category || '',
                location: editingDevice.location || editingDevice.currentLocation || '',
                status: editingDevice.status || 'available',
                specsDetails: editingDevice.specsDetails || '',
                loanDate: editingDevice.loanDate || '',
                returnDate: editingDevice.returnDate || '',
                loanUser: editingDevice.loanUser || '',
                rejectReason: editingDevice.rejectReason || '',
                requestReason: editingDevice.requestReason || '',
                requestedById: editingDevice.requestedById || '',
                deliveredAt: editingDevice.deliveredAt || '',
                receivedAt: editingDevice.receivedAt || '',
                returnedAt: editingDevice.returnedAt || ''
            });
            setNotes(Array.isArray(editingDevice.notesHistory) ? editingDevice.notesHistory : []);
            setNoteDraft('');
        } else {
            setFormData({ 
                id: '', type: 'Laptop', brand: '', model: '', serial: '', category: '', location: '',
                status: 'available', specsDetails: '', loanDate: '', returnDate: '', loanUser: '',
                rejectReason: '', requestReason: '', requestedById: '', deliveredAt: '', receivedAt: '', returnedAt: ''
            });
            setNotes([]);
            setNoteDraft('');
        }
    }, [editingDevice, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); onClose(); };
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]" onClick={onClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-white dark:bg-slate-950 shadow-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300`}>
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{editingDevice ? 'Editar Equipo' : 'Alta de Equipo'}</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Ficha Técnica de Activo</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"><X size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Activo Fijo</label>
                                <input type="text" name="id" disabled={!!editingDevice} value={formData.id} onChange={handleChange} placeholder="Ej. 11709" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estatus</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white">
                                    <option value="available">En Bodega (Disponible)</option>
                                    <option value="active">En Uso / Operación</option>
                                    <option value="request_pending">Solicitar Préstamo (Pendiente)</option>
                                    <option value="loaned">Prestado (En Tránsito)</option>
                                    <option value="decommissioned">Obsoleto / Baja</option>
                                    <option value="denied">Denegado</option>
                                </select>
                            </div>
                        </div>

                        {formData.status === 'denied' && formData.rejectReason && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                                <div>
                                    <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Motivo de Rechazo</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{formData.rejectReason}</p>
                                </div>
                            </div>
                        )}

                        {(formData.status === 'loaned' || formData.status === 'request_pending' || formData.status === 'approved') && (
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">¿A quién se le presta?</label>
                                    <input type="text" name="loanUser" value={formData.loanUser} onChange={handleChange} placeholder="Nombre del usuario" className="w-full bg-white dark:bg-slate-900 border border-purple-100 dark:border-gray-800 px-4 py-3 rounded-xl text-sm font-bold" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">Fecha Salida</label>
                                        <input type="date" name="loanDate" value={formData.loanDate} onChange={handleChange} className="w-full bg-white dark:bg-slate-900 border border-purple-100 dark:border-gray-800 px-4 py-3 rounded-xl text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">Fecha Devolución</label>
                                        <input type="date" name="returnDate" value={formData.returnDate} onChange={handleChange} className="w-full bg-white dark:bg-slate-900 border border-purple-100 dark:border-gray-800 px-4 py-3 rounded-xl text-sm font-bold" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Activo</label>
                            <input type="text" name="type" required value={formData.type} onChange={handleChange} placeholder="Ej. Laptop, Monitor..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                                <input type="text" name="brand" value={formData.brand} onChange={handleChange} placeholder="Ej. HP, Dell..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                                <input type="text" name="model" value={formData.model} onChange={handleChange} placeholder="Ej. EliteBook 840 G3" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Serial</label>
                            <input type="text" name="serial" value={formData.serial} onChange={handleChange} placeholder="S/N..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación</label>
                            <input type="text" name="location" value={formData.location || ''} onChange={handleChange} placeholder="Ej. Site, Bodega TI, Piso 3" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-white" />
                        </div>

                        {editingDevice && (
                            <div className="rounded-2xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/10 p-4 space-y-3">
                                <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase tracking-widest ml-1">Notas del equipo (bitácora)</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={noteDraft}
                                        onChange={(e) => setNoteDraft(e.target.value)}
                                        placeholder="Escribe una nota técnica para este equipo..."
                                        className="flex-1 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-700 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const text = String(noteDraft || '').trim();
                                            if (!text) return;
                                            const ok = await onAddNote?.(editingDevice.id, text);
                                            if (!ok) {
                                                alert('No se pudo guardar la nota del equipo.');
                                                return;
                                            }
                                            const fresh = await inventoryService.getAll();
                                            const updated = fresh.find((d) => d.id === editingDevice.id);
                                            setNotes(Array.isArray(updated?.notesHistory) ? updated.notesHistory : []);
                                            setNoteDraft('');
                                        }}
                                        className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700"
                                    >
                                        Guardar nota
                                    </button>
                                </div>

                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                                    {notes.length === 0 ? (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Sin notas registradas.</p>
                                    ) : (
                                        [...notes].reverse().map((n, idx) => (
                                            <div key={`${n?.at || 'note'}-${idx}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{n?.text || ''}</p>
                                                <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400 font-bold">
                                                    {n?.by || 'Sistema'} · {n?.at ? new Date(n.at).toLocaleString() : 'Sin fecha'}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="pt-8 flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 px-6 rounded-xl text-[10px] font-black uppercase text-slate-500 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100">Cancelar</button>
                        <button type="submit" className="flex-[2] py-4 px-6 rounded-xl text-[10px] font-black uppercase text-white bg-blue-600 shadow-xl shadow-blue-500/20">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </>
    );
};

// --- MAIN VIEW ---
const InventoryView = ({ searchTerm = '' }) => {
    const { profile, user } = useAuth();
    const [activeTab, setActiveTab] = useState('inventory');
    const [inventoryList, setInventoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterType, setFilterType] = useState('Todos');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingDevice, setEditingDevice] = useState(null);
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');

    const loadInventory = async () => {
        setIsLoading(true);
        const data = await inventoryService.getAll();
        setInventoryList(data || []);
        setIsLoading(false);
    };

    const handleSaveDevice = async (formData) => {
        const success = editingDevice ? await inventoryService.update(editingDevice.id, formData) : await inventoryService.add(formData);
        if (success) { await loadInventory(); setEditingDevice(null); }
    };

    const handlePermanentDelete = async (id) => {
        if (window.confirm("Borrando permanentemente... ¿Continuar?")) {
            if (await inventoryService.remove(id)) loadInventory();
        }
    };

    const handleAddAssetNote = async (assetId, noteText) => {
        const actorName = profile?.full_name || user?.email || 'Administrador';
        const ok = await inventoryService.appendNote(assetId, noteText, actorName);
        if (ok) await loadInventory();
        return ok;
    };

    useEffect(() => { loadInventory(); }, []);

    const filteredList = inventoryList.filter(d => {
        const matchesTab = activeTab === 'inventory' ? (d.status !== 'decommissioned') : (d.status === 'decommissioned');
        const typeSource = `${d.type || ''} ${d.category || ''}`.toLowerCase();
        const typeKeywords = TYPE_FILTER_KEYWORDS[filterType] || [];
        const matchesType = filterType === 'Todos' || typeKeywords.some((kw) => typeSource.includes(kw));
        const matchesStatus = filterStatus === 'Todos' || d.status === filterStatus;
        const search = (localSearchTerm || '').toLowerCase();
        const assignedSearch = (d.assignedToName || d.user || '').toLowerCase();
        const displayId = (d.displayId || d.id || '').toLowerCase();
        const hostname = (d.hostname || '').toLowerCase();
        const serial = (d.serial || '').toLowerCase();
        const model = (d.model || '').toLowerCase();
        const brand = (d.brand || '').toLowerCase();
        const locationSearch = (d.currentLocation || d.location || d.assignedToDepartment || '').toLowerCase();
        const matchesSearch = displayId.includes(search) || d.id.toLowerCase().includes(search) || model.includes(search) || brand.includes(search) || serial.includes(search) || hostname.includes(search) || assignedSearch.includes(search) || locationSearch.includes(search);
        
        return matchesTab && matchesType && matchesStatus && matchesSearch;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                <div className="flex-1 bg-slate-950 p-6 rounded-[2rem] flex items-center justify-between shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity"><Settings size={120} className="animate-spin-slow" /></div>
                    <div className="relative z-10">
                        <h2 className="text-xl font-black text-white tracking-tight">Equipos</h2>
                        <button onClick={()=>{setEditingDevice(null); setIsAddModalOpen(true);}} className="mt-3 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-black uppercase text-[10px] transition-all shadow-lg shadow-blue-500/20 active:scale-95">Alta Manual</button>
                    </div>

                    <div className="flex gap-4 relative z-10 h-full">
                        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-5 py-3 rounded-2xl">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Package size={18} /></div>
                            <div>
                                <div className="text-[18px] font-black text-white leading-none">{inventoryList.filter(i=>i.status==='available').length}</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Bodega</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-5 py-3 rounded-2xl">
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><CheckCircle2 size={18} /></div>
                            <div>
                                <div className="text-[18px] font-black text-white leading-none">{inventoryList.filter(i=>i.status==='active').length}</div>
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Operación</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex flex-col gap-8">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl">
                        <button onClick={()=>setActiveTab('inventory')} className={`px-10 py-3 rounded-xl font-black uppercase text-xs transition-all ${activeTab==='inventory' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xl' : 'text-slate-400'}`}>Inventario Activo</button>
                        <button onClick={()=>setActiveTab('obsolete')} className={`px-10 py-3 rounded-xl font-black uppercase text-xs transition-all ${activeTab==='obsolete' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-white shadow-xl' : 'text-slate-400'}`}>Bajas / Obsoletos</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative md:col-span-2">
                            <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="w-full bg-slate-50 dark:bg-slate-800/50 pl-16 pr-6 py-5 rounded-[2rem] border-none outline-none font-bold text-slate-700 dark:text-white" placeholder="Buscar ID, Marca o Serial..." value={localSearchTerm} onChange={(e)=>setLocalSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-6 py-5 rounded-[2rem]">
                            <Filter size={18} className="text-slate-400" />
                            <select className="bg-transparent border-none outline-none font-bold text-sm w-full text-slate-600 dark:text-slate-300 dark:[color-scheme:dark]" value={filterType} onChange={(e)=>setFilterType(e.target.value)}>
                                {DEVICE_TYPES.map(t=><option key={t} value={t} className="bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-100">{t}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-6 py-5 rounded-[2rem]">
                            <ArrowRightLeft size={18} className="text-slate-400" />
                            <select className="bg-transparent border-none outline-none font-bold text-sm w-full text-slate-600 dark:text-slate-300 dark:[color-scheme:dark]" value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)}>
                                {STATUS_FILTERS.map((s) => (
                                    <option key={s.value} value={s.value} className="bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-100">{s.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="p-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Dispositivo</th>
                                <th className="p-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Identificadores</th>
                                <th className="p-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Marca</th>
                                <th className="p-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Asignado / Ubicación</th>
                                <th className="p-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest">Estado Actual</th>
                                <th className="p-5 px-8 font-black text-[10px] uppercase text-slate-400 tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-20 text-center font-black uppercase text-xs text-slate-300 animate-pulse">Sincronizando...</td></tr>
                            ) : filteredList.map(item => (
                                <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all">
                                    <td className="p-5 px-8 text-slate-200">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">{getDeviceIcon(item.type)}</div>
                                            <div>
                                                <div className="font-black text-slate-800 dark:text-white text-sm">{item.type}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.model || 'Genérico'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5 px-8">
                                        <div className="font-black text-slate-900 dark:text-white text-xs">{item.displayId || item.id}</div>
                                        <div className="text-[9px] text-blue-500 font-bold uppercase tracking-[0.15em] mt-0.5">SN: {item.serial || 'NO REGISTRADO'}</div>
                                    </td>
                                    <td className="p-5 px-8"><span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">{item.brand || 'Personalizado'}</span></td>
                                    <td className="p-5 px-8">
                                        {item.assigned_to ? (
                                            <div className="space-y-1">
                                                <span className="inline-flex items-center px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {item.assignedToName || 'Usuario asignado'}
                                                </span>
                                                {item.assignedToEmail && (
                                                    <p className="text-[10px] text-slate-500 truncate">{item.assignedToEmail}</p>
                                                )}
                                                <p className="text-[10px] text-slate-500 truncate">{item.currentLocation || item.assignedToLocation || item.assignedToDepartment || 'Con usuario'}</p>
                                            </div>
                                        ) : item.status === 'active' ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                                                {item.currentLocation || 'Infraestructura TI'}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200">
                                                {item.currentLocation || 'Sin asignar'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-5 px-8"><DeviceStatusBadge status={item.status} size="sm" /></td>
                                    <td className="p-5 px-8 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                            <button onClick={()=>{setEditingDevice(item); setIsAddModalOpen(true);}} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 hover:text-blue-600 shadow-sm"><Edit size={16}/></button>
                                            {activeTab === 'obsolete' ? (
                                                <>
                                                    <button onClick={()=>inventoryService.update(item.id, {status: 'available'}).then(loadInventory)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-500/20">Reactivar</button>
                                                    <button onClick={()=>handlePermanentDelete(item.id)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white"><Trash2 size={16}/></button>
                                                </>
                                            ) : (
                                                <button onClick={()=>inventoryService.update(item.id, {status: 'decommissioned'}).then(loadInventory)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 hover:text-rose-500"><ArrowRightLeft size={16}/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <DeviceSlider
                isOpen={isAddModalOpen}
                onClose={()=>setIsAddModalOpen(false)}
                onSave={handleSaveDevice}
                editingDevice={editingDevice}
                onAddNote={handleAddAssetNote}
            />
            <ImportModal isOpen={isImportModalOpen} onClose={()=>setIsImportModalOpen(false)} onImportSuccess={()=>{setIsImportModalOpen(false); loadInventory();}} />
        </div>
    );
};

export default InventoryView;
