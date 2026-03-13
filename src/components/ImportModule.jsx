import React, { useState } from 'react';
import { 
    Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, 
    XCircle, Info, Download, Trash2, ArrowRight, Save, Clock, History
} from 'lucide-react';
import { importService } from '../services/importService';
import { useAuth } from '../context/AuthContext';
import ImportLogsView from './ImportLogsView';
import * as XLSX from 'xlsx';

const ImportModule = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('import'); // 'import' or 'logs'
    const [importType, setImportType] = useState('inventory'); // 'users' or 'inventory'
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importStatus, setImportStatus] = useState(null); // { success, newCount, updateCount, errorCount }

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setLoading(true);
        setFile(selectedFile);
        try {
            const data = await importService.parseExcel(selectedFile);
            
            // Validate columns
            const validation = importType === 'users' 
                ? importService.validateUserColumns(data)
                : importService.validateInventoryColumns(data);

            if (!validation.valid) {
                alert(`Error en columnas: faltan ${validation.missing.join(', ')}`);
                setLoading(false);
                return;
            }

            // Get preview with duplicate detection
            const preview = importType === 'users'
                ? await importService.previewUsers(data)
                : await importService.previewInventory(data);

            setPreviewData(preview);
        } catch (err) {
            console.error("Error parsing file:", err);
            alert("Error al leer el archivo Excel.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAction = (index) => {
        const newData = [...previewData];
        const row = newData[index];
        if (row._status === 'duplicate') {
            row._action = row._action === 'update' ? 'skip' : 'update';
        }
        setPreviewData(newData);
    };

    const handleProcessImport = async () => {
        if (!previewData.length) return;
        setLoading(true);
        try {
            const result = await importService.processImport(importType, previewData, user.id, file.name);
            setImportStatus(result);
            setPreviewData([]);
            setFile(null);
        } catch (err) {
            console.error("Import failed:", err);
            alert("Error durante la importación.");
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = (type) => {
        const headers = type === 'users' 
            ? [['employee_id', 'name', 'email', 'department', 'position', 'location', 'status', 'role']]
            : [['asset_id', 'asset_type', 'brand', 'model', 'serial_number', 'inventory_tag', 'hostname', 'status', 'purchase_date']];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headers);
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `template_${type}.xlsx`);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Carga Masiva de Datos</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Sincroniza inventario y personal mediante archivos Excel.</p>
                </div>
                <div className="flex gap-4 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800">
                    <button 
                        onClick={() => setActiveTab('import')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'import' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        Nueva Carga
                    </button>
                    <button 
                        onClick={() => setActiveTab('logs')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <History size={14} />
                        Historial
                    </button>
                </div>
            </div>

            {activeTab === 'logs' ? (
                <ImportLogsView />
            ) : (
                <>
                    <div className="flex justify-end gap-3 mb-2">
                        <button 
                            onClick={() => downloadTemplate('users')}
                            className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm group"
                        >
                            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                            Plantilla Usuarios
                        </button>
                        <button 
                            onClick={() => downloadTemplate('inventory')}
                            className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm group"
                        >
                            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                            Plantilla Inventario
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Configuration Sidebar */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none transition-colors">
                        <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">1. Configuración de Carga</h4>
                        
                        <div className="space-y-4">
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">¿Qué deseas importar?</span>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => { setImportType('inventory'); setPreviewData([]); }}
                                        className={`py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${importType === 'inventory' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700'}`}
                                    >
                                        Inventario
                                    </button>
                                    <button 
                                        onClick={() => { setImportType('users'); setPreviewData([]); }}
                                        className={`py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${importType === 'users' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-700'}`}
                                    >
                                        Usuarios
                                    </button>
                                </div>
                            </label>

                            <div className="pt-4">
                                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] block mb-3">2. Seleccionar Archivo</span>
                                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl group cursor-pointer hover:border-blue-500 dark:hover:border-blue-500/50 hover:bg-blue-50/10 transition-all bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm mb-3 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-blue-500">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{file ? file.name : "Subir Excel (.xlsx)"}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium italic">Arrastra o selecciona el archivo</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} disabled={loading} />
                                </label>
                            </div>
                        </div>

                        {previewData.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    onClick={handleProcessImport}
                                    disabled={loading}
                                    className="w-full bg-slate-950 dark:bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-950/20 dark:shadow-blue-900/20 hover:bg-blue-600 dark:hover:bg-blue-500 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            Confirmar Sincronización
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {importStatus && (
                        <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-[2rem] p-6 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-emerald-500 p-2 rounded-xl text-white">
                                    <CheckCircle2 size={20} />
                                </div>
                                <h5 className="font-black text-emerald-900 dark:text-emerald-400 text-sm uppercase tracking-widest">Importación Finalizada</h5>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-emerald-500/10">
                                    <span className="text-[10px] font-black text-slate-400 uppercase block tracking-tighter">Nuevos</span>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{importStatus.newCount}</span>
                                </div>
                                <div className="bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-emerald-500/10">
                                    <span className="text-[10px] font-black text-slate-400 uppercase block tracking-tighter">Actualizados</span>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{importStatus.updateCount}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Main Table */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col min-h-[500px] transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-base uppercase tracking-widest">Previsualización de Datos</h3>
                            </div>
                            {previewData.length > 0 && (
                                <span className="text-[10px] font-black bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full uppercase tracking-widest border border-blue-100 dark:border-blue-500/20">
                                    {previewData.length} Registros detectados
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto p-4 max-h-[600px]">
                            {!previewData.length ? (
                                <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 dark:text-slate-500">
                                    <FileSpreadsheet size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Sin datos para previsualizar</p>
                                    <p className="text-xs mt-1 italic">Sube un archivo para comenzar</p>
                                </div>
                            ) : (
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                            <th className="px-4 py-2">Estado</th>
                                            <th className="px-4 py-2">Identificador</th>
                                            <th className="px-4 py-2">Info Principal</th>
                                            <th className="px-4 py-2 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {previewData.map((row, index) => (
                                            <tr key={index} className="group animate-in fade-in slide-in-from-right duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                                <td className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-800 overflow-hidden">
                                                    {row._errors.length > 0 ? (
                                                        <div className="flex items-center gap-2 text-rose-500 font-bold text-xs uppercase tracking-tighter">
                                                            <XCircle size={14} />
                                                            Error
                                                        </div>
                                                    ) : row._status === 'duplicate' ? (
                                                        <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-tighter">
                                                            <AlertTriangle size={14} />
                                                            Duplicado
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-tighter">
                                                            <CheckCircle2 size={14} />
                                                            Nuevo
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-y border-slate-100 dark:border-slate-800">
                                                    <span className="font-black text-slate-900 dark:text-white">
                                                        {importType === 'users' ? (row.email || row.Email) : (row.serial_number || row.Serial || row.Serie || row.asset_id || row.Asset_ID)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-y border-slate-100 dark:border-slate-800">
                                                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate block max-w-[200px]">
                                                        {importType === 'users' ? (row.name || row.Name || row.full_name) : (row.asset_type || row.type || row.model)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-800 text-right">
                                                    {row._errors.length > 0 ? (
                                                        <div className="group relative inline-block">
                                                            <XCircle size={18} className="text-rose-300 ml-auto" />
                                                            <div className="absolute right-0 top-full mt-2 w-48 bg-rose-500 text-white p-3 rounded-xl text-[10px] font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                                                                {row._errors.join(', ')}
                                                            </div>
                                                        </div>
                                                    ) : row._status === 'duplicate' ? (
                                                        <button 
                                                            onClick={() => handleToggleAction(index)}
                                                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${row._action === 'update' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 border-transparent text-slate-400 dark:text-slate-500'}`}
                                                        >
                                                            {row._action === 'update' ? 'Sincronizar' : 'Ignorar'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20">Registrar</span>
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
            )}
        </div>
    );
};

export default ImportModule;
