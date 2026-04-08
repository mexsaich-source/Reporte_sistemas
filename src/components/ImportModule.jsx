import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
    XCircle, Info, Download, Trash2, ArrowRight, Save, Clock, X, User
} from 'lucide-react';
import { importService } from '../services/importService';
import { useAuth } from '../context/authStore';
import * as XLSX from 'xlsx';

const ImportModule = () => {
    const { user } = useAuth();
    const [importType, setImportType] = useState('mixed');
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importStatus, setImportStatus] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [diagnostics, setDiagnostics] = useState(null);
    const [loadingDiagnostics, setLoadingDiagnostics] = useState(true);
    const [fixSelection, setFixSelection] = useState({});
    const [applyingFix, setApplyingFix] = useState(false);

    const loadDiagnostics = useCallback(async () => {
        setLoadingDiagnostics(true);
        try {
            const result = await importService.getAssignmentDiagnostics();
            setDiagnostics(result);
        } catch (err) {
            console.error('Error loading assignment diagnostics:', err);
            setDiagnostics(null);
        } finally {
            setLoadingDiagnostics(false);
        }
    }, []);

    useEffect(() => {
        loadDiagnostics();
    }, [loadDiagnostics]);

    const processFile = useCallback(async (selectedFile) => {
        if (!selectedFile) return;
        setLoading(true);
        setFile(selectedFile);
        setImportStatus(null);

        try {
            const data = await importService.parseExcel(selectedFile);

            const preview = importType === 'users'
                ? await importService.previewUsers(data)
                : importType === 'inventory'
                    ? await importService.previewInventory(data)
                    : await importService.previewMixed(data);

            setPreviewData(preview);
        } catch (err) {
            console.error("Error parsing file:", err);
            alert("Error al leer el archivo Excel. Asegúrate de que sea un formato válido.");
            setFile(null);
        } finally {
            setLoading(false);
        }
    }, [importType]);

    const handleFileChange = (e) => {
        processFile(e.target.files[0]);
    };

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
            processFile(droppedFile);
        } else {
            alert('Por favor, arrastra solo archivos Excel (.xlsx, .xls)');
        }
    }, [processFile]);

    const clearFile = () => {
        setFile(null);
        setPreviewData([]);
        setImportStatus(null);
    };

    const handleTypeChange = (type) => {
        setImportType(type);
        clearFile();
    };

    const recalcErrors = (row) => {
        if (row._entityType === 'user') return importService.getUserErrors(row);
        if (row._entityType === 'both') {
            return [
                ...importService.getUserErrors(row),
                ...importService.getInventoryErrors(row),
            ];
        }
        if (row._entityType === 'inventory') return importService.getInventoryErrors(row);
        return row._errors || [];
    };

    const handleEditPreviewCell = (index, field, value) => {
        setPreviewData((prev) => {
            const next = [...prev];
            const row = { ...next[index], [field]: value };
            if (field === 'assigned_to_email') {
                row._assignee_email = String(value || '').trim().toLowerCase();
            }
            row._errors = recalcErrors(row);
            next[index] = row;
            return next;
        });
    };

    const handleToggleAction = (index) => {
        const newData = [...previewData];
        const row = newData[index];
        if (row._status === 'duplicate') {
            row._action = row._action === 'update' ? 'skip' : 'update';
        }
        setPreviewData(newData);
    };

    const assigneeSummary = useMemo(() => {
        if (!previewData.length) return [];
        return importService.summarizeInventoryAssignees(previewData);
    }, [importType, previewData]);

    const handleProcessImport = async () => {
        if (!previewData.length) return;
        setLoading(true);
        try {
            const result = await importService.processImport(importType, previewData, user.id, file.name);
            setImportStatus(result);
            setPreviewData([]);
            setFile(null);
            await loadDiagnostics();
        } catch (err) {
            console.error("Import failed:", err);
            alert("Error durante la importación.");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAssign = async (userId) => {
        const assetId = fixSelection[userId];
        if (!assetId) return;

        setApplyingFix(true);
        try {
            await importService.quickAssignAsset(userId, assetId);
            setFixSelection((prev) => ({ ...prev, [userId]: '' }));
            await loadDiagnostics();
        } catch (err) {
            console.error('Quick assign failed:', err);
            alert('No se pudo asignar el equipo.');
        } finally {
            setApplyingFix(false);
        }
    };

    const handleClearOrphan = async (assetId) => {
        setApplyingFix(true);
        try {
            await importService.clearOrphanAsset(assetId);
            await loadDiagnostics();
        } catch (err) {
            console.error('Clear orphan failed:', err);
            alert('No se pudo liberar el equipo huérfano.');
        } finally {
            setApplyingFix(false);
        }
    };

    const downloadTemplate = (type) => {
        // NUEVO: Agregamos assigned_to_email a la plantilla de inventario
        const headers = type === 'users'
            ? [['employee_id', 'name', 'email', 'department', 'position', 'location', 'assigned_equipment', 'status', 'role']]
            : [['asset_id', 'asset_type', 'brand', 'model', 'serial_number', 'inventory_tag', 'hostname', 'status', 'purchase_date', 'assigned_to_email']];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `template_${type}.xlsx`);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Carga Masiva de Datos</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Sincroniza inventario y personal mediante archivos Excel.</p>
                </div>
            </div>

            <>
                    <div className="flex justify-end gap-3 mb-2">
                        <button onClick={() => downloadTemplate('users')} className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 border px-5 py-3 rounded-2xl text-sm font-bold shadow-sm group">
                            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" /> Plantilla Usuarios
                        </button>
                        <button onClick={() => downloadTemplate('inventory')} className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 border px-5 py-3 rounded-2xl text-sm font-bold shadow-sm group">
                            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" /> Plantilla Inventario
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border shadow-xl shadow-slate-200/40 dark:shadow-none">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">1. Configuración de Carga</h4>
                                <div className="space-y-4">
                                    <label className="block">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Importación mixta automática</span>
                                        <div className="mt-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
                                            Puedes mezclar filas de usuarios e inventario en un solo archivo. Si falta algo, corrígelo en la vista previa.
                                        </div>
                                    </label>

                                    <div className="pt-4 relative">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 flex justify-between items-center">
                                            2. Seleccionar Archivo
                                            {file && (
                                                <button onClick={clearFile} className="text-rose-500 hover:text-rose-700 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-md transition-colors"><X size={12} /> Limpiar</button>
                                            )}
                                        </span>

                                        <label
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-3xl transition-all cursor-pointer 
                                                ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-200 bg-slate-50 hover:border-blue-500'} 
                                                ${file ? 'border-emerald-500 bg-emerald-50/30' : ''}`
                                            }
                                        >
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                                <div className={`p-4 rounded-2xl shadow-sm mb-3 transition-transform ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'}`}>
                                                    {file ? <FileSpreadsheet size={24} /> : <Upload size={24} />}
                                                </div>
                                                <p className={`text-sm font-bold truncate max-w-full ${file ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                    {file ? file.name : "Subir Excel (.xlsx)"}
                                                </p>
                                                {!file && <p className="text-xs text-slate-400 mt-1 font-medium italic">Arrastra el archivo aquí o haz clic</p>}
                                            </div>
                                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} disabled={loading} />
                                        </label>
                                    </div>
                                </div>

                                {previewData.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <button onClick={handleProcessImport} disabled={loading} className="w-full bg-slate-950 dark:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
                                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save size={18} /> Confirmar Sincronización</>}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {importStatus && (
                                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-[2rem] p-6 animate-in zoom-in-95 relative">
                                    <button onClick={() => setImportStatus(null)} className="absolute top-4 right-4 text-emerald-600 hover:text-emerald-800"><X size={16} /></button>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-emerald-500 p-2 rounded-xl text-white"><CheckCircle2 size={20} /></div>
                                        <h5 className="font-black text-emerald-900 dark:text-emerald-300 text-sm uppercase tracking-widest">Importación Finalizada</h5>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/20">
                                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-tighter">Nuevos</span>
                                            <span className="text-lg font-black text-slate-900 dark:text-white">{importStatus.newCount}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/20">
                                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-tighter">Actualizados</span>
                                            <span className="text-lg font-black text-slate-900 dark:text-white">{importStatus.updateCount}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-amber-500/10 dark:border-amber-500/20">
                                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-tighter">Duplicados omitidos</span>
                                            <span className="text-lg font-black text-amber-600">{importStatus.duplicateCount || 0}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-rose-500/10 dark:border-rose-500/20">
                                            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-tighter">Errores</span>
                                            <span className="text-lg font-black text-rose-600">{importStatus.errorCount || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border shadow-xl shadow-slate-200/30 dark:shadow-none">
                                <div className="flex items-center justify-between mb-4">
                                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Diagnóstico Post-Carga</h5>
                                    <button
                                        onClick={loadDiagnostics}
                                        disabled={loadingDiagnostics || applyingFix}
                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50"
                                    >
                                        Refrescar
                                    </button>
                                </div>

                                {loadingDiagnostics ? (
                                    <p className="text-sm text-slate-500">Analizando asignaciones...</p>
                                ) : !diagnostics ? (
                                    <p className="text-sm text-rose-600">No se pudo cargar el diagnóstico.</p>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <span className="text-[10px] font-black uppercase text-slate-400">Cobertura</span>
                                                <p className="text-lg font-black text-slate-900 dark:text-white">{diagnostics.totals.coverage}%</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <span className="text-[10px] font-black uppercase text-slate-400">Usuarios sin equipo</span>
                                                <p className="text-lg font-black text-amber-600">{diagnostics.totals.usersWithoutAssets}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <span className="text-[10px] font-black uppercase text-slate-400">Equipos huérfanos</span>
                                                <p className="text-lg font-black text-rose-600">{diagnostics.totals.orphanAssets}</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                                <span className="text-[10px] font-black uppercase text-slate-400">Disponibles</span>
                                                <p className="text-lg font-black text-emerald-600">{diagnostics.totals.availableAssets}</p>
                                            </div>
                                        </div>

                                        {diagnostics.usersWithoutAssets.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Corrección rápida: asignar equipo</p>
                                                {diagnostics.usersWithoutAssets.slice(0, 6).map((u) => (
                                                    <div key={u.id} className="p-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{u.full_name} · {u.email}</p>
                                                        <div className="flex gap-2">
                                                            <select
                                                                value={fixSelection[u.id] || ''}
                                                                onChange={(e) => setFixSelection((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                                                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                                            >
                                                                <option value="">Selecciona equipo disponible</option>
                                                                {diagnostics.availableAssets.map((a) => (
                                                                    <option key={a.id} value={a.id}>{a.label}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                type="button"
                                                                disabled={!fixSelection[u.id] || applyingFix}
                                                                onClick={() => handleQuickAssign(u.id)}
                                                                className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                                            >
                                                                Asignar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {diagnostics.orphanAssets.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Corrección rápida: liberar huérfanos</p>
                                                {diagnostics.orphanAssets.slice(0, 6).map((a) => (
                                                    <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-rose-100 bg-rose-50/60 dark:bg-rose-500/10 dark:border-rose-500/20">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{a.label}</p>
                                                            <p className="text-[10px] text-slate-500">Asignado a ID inexistente: {a.assigned_to}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={applyingFix}
                                                            onClick={() => handleClearOrphan(a.id)}
                                                            className="px-3 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                                        >
                                                            Liberar
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="xl:col-span-2 space-y-4">
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/70 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col min-h-[500px]">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/40 flex flex-col gap-3 shrink-0">
                                    <div className="flex justify-between items-center gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                            <h3 className="font-bold text-slate-900 dark:text-white text-base uppercase tracking-widest">Previsualización de Datos</h3>
                                        </div>
                                        {previewData.length > 0 && (
                                            <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded-full uppercase tracking-widest border border-blue-100 dark:border-blue-500/20">
                                                {previewData.length} Registros
                                            </span>
                                        )}
                                    </div>
                                    {assigneeSummary.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {assigneeSummary.slice(0, 8).map((s) => (
                                                <span
                                                    key={s.email}
                                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${s.matched ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-100 dark:border-amber-500/20'}`}
                                                    title={s.matched ? 'Usuario encontrado en la base' : 'Correo sin usuario en la base'}
                                                >
                                                    {s.name || s.email} · {s.count} equipo{s.count > 1 ? 's' : ''}
                                                </span>
                                            ))}
                                            {assigneeSummary.length > 8 && (
                                                <span className="text-[10px] font-black text-slate-400 self-center">+{assigneeSummary.length - 8} usuarios</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-auto p-4 max-h-[600px]">
                                    {!previewData.length ? (
                                        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                                            <FileSpreadsheet size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Sin datos para previsualizar</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-separate border-spacing-y-2">
                                            <thead>
                                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                    <th className="px-4 py-2">Estado</th>
                                                    <th className="px-4 py-2">Tipo</th>
                                                    <th className="px-4 py-2">Identificador</th>
                                                    <th className="px-4 py-2">Info Principal</th>
                                                    <th className="px-4 py-2">Asignado / Área</th>
                                                    <th className="px-4 py-2 text-right">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm">
                                                {previewData.map((row, index) => (
                                                    <tr key={index} className="group animate-in fade-in slide-in-from-right duration-300">
                                                        <td className="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/50 rounded-l-2xl border-y border-l border-slate-200 dark:border-slate-700">
                                                            {row._errors.length > 0 ? (
                                                                <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase" title={row._errors.join(', ')}><XCircle size={14} /> Error</div>
                                                            ) : row._status === 'duplicate' ? (
                                                                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase"><AlertTriangle size={14} /> Duplicado</div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase"><CheckCircle2 size={14} /> Nuevo</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${row._entityType === 'user' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20' : row._entityType === 'inventory' ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-100 dark:border-cyan-500/20' : row._entityType === 'both' ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600'}`}>
                                                                {row._entityType === 'user' ? 'Usuario' : row._entityType === 'inventory' ? 'Inventario' : row._entityType === 'both' ? 'Mixto' : 'Sin tipo'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                                                            {row._entityType === 'user' || row._entityType === 'both' ? (
                                                                <input
                                                                    type="text"
                                                                    value={row.email || ''}
                                                                    onChange={(e) => handleEditPreviewCell(index, 'email', e.target.value)}
                                                                    placeholder="email"
                                                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                                                                />
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={row.serial_number || row.asset_id || ''}
                                                                    onChange={(e) => handleEditPreviewCell(index, 'serial_number', e.target.value)}
                                                                    placeholder="serie o id activo"
                                                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                                                            {row._entityType === 'user' || row._entityType === 'both' ? (
                                                                <div className="space-y-1">
                                                                    <input
                                                                        type="text"
                                                                        value={row.name || ''}
                                                                        onChange={(e) => handleEditPreviewCell(index, 'name', e.target.value)}
                                                                        placeholder="nombre"
                                                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={row.department || ''}
                                                                        onChange={(e) => handleEditPreviewCell(index, 'department', e.target.value)}
                                                                        placeholder="departamento"
                                                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-900 dark:text-slate-100"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    <input
                                                                        type="text"
                                                                        value={row.asset_type || ''}
                                                                        onChange={(e) => handleEditPreviewCell(index, 'asset_type', e.target.value)}
                                                                        placeholder="tipo"
                                                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={row.model || ''}
                                                                        onChange={(e) => handleEditPreviewCell(index, 'model', e.target.value)}
                                                                        placeholder="modelo"
                                                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-900 dark:text-slate-100"
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
                                                            {row._entityType === 'inventory' || row._entityType === 'both' ? (
                                                                <div className="space-y-1">
                                                                    <input
                                                                        type="text"
                                                                        value={row.assigned_to_email || row._assignee_email || ''}
                                                                        onChange={(e) => handleEditPreviewCell(index, 'assigned_to_email', e.target.value)}
                                                                        placeholder="correo asignado opcional"
                                                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-900 dark:text-slate-100"
                                                                    />
                                                                    {row.assigned_to ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 text-[10px] font-bold">
                                                                            <User size={12} /> {row._assignee_name}
                                                                        </span>
                                                                    ) : row._assignee_email ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 text-[10px] font-bold" title="El correo no existe en la BD">
                                                                            <AlertTriangle size={12} /> No encontrado
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400 font-bold">Bodega / Libre</span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={row.role || 'user'}
                                                                    onChange={(e) => handleEditPreviewCell(index, 'role', e.target.value)}
                                                                    placeholder="rol"
                                                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-900 dark:text-slate-100"
                                                                />
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 bg-slate-50/60 dark:bg-slate-800/50 rounded-r-2xl border-y border-r border-slate-200 dark:border-slate-700 text-right">
                                                            {row._errors.length > 0 ? (
                                                                <button title={row._errors.join(', ')} className="text-rose-500 hover:text-rose-700 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-lg ml-auto flex"><Info size={16} /></button>
                                                            ) : row._status === 'duplicate' ? (
                                                                <button onClick={() => handleToggleAction(index)} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${row._action === 'update' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-200 border-transparent text-slate-400'}`}>
                                                                    {row._action === 'update' ? 'Sincronizar' : 'Ignorar'}
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">Registrar</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
        </div>
    );
};

export default ImportModule;