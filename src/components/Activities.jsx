import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  MessageSquare,
  Plus,
  Send,
  X,
  PieChart,
  Zap,
  Search,
  Calendar,
  Flame
} from 'lucide-react';
import { useAuth } from '../context/authStore';
import { userService } from '../services/userService';
import { activityService, ACTIVITY_STATUS } from '../services/activityService';

// --- UTILIDAD PARA EL TIEMPO (SLA) ---
const timeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `hace ${interval} año${interval === 1 ? '' : 's'}`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `hace ${interval} mes${interval === 1 ? '' : 'es'}`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `hace ${interval} día${interval === 1 ? '' : 's'}`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `hace ${interval} hr${interval === 1 ? '' : 's'}`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `hace ${interval} min${interval === 1 ? '' : 's'}`;
  return 'hace unos segundos';
};

const ActivityStatusBadge = ({ status }) => {
  const s = (status || ACTIVITY_STATUS.pending).toLowerCase();
  const config = {
    [ACTIVITY_STATUS.pending]: {
      label: 'Pendiente',
      style: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'
    },
    [ACTIVITY_STATUS.assigned]: {
      label: 'Asignada',
      style: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20'
    },
    [ACTIVITY_STATUS.in_progress]: {
      label: 'En Proceso',
      style: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'
    },
    [ACTIVITY_STATUS.resolved]: {
      label: 'Resuelta',
      style: 'text-slate-700 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-600'
    }
  };

  const current = config[s] || config[ACTIVITY_STATUS.pending];
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${current.style}`}>
      {current.label}
    </span>
  );
};

const ActivitiesSection = ({ viewerRole, viewerId }) => {
  const isAdmin = viewerRole === 'admin';
  const isTech = viewerRole === 'tech' || viewerRole === 'técnico';

  const [techUsers, setTechUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // --- ESTADOS NUEVOS: Buscador y Modal ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_tech: '',
    due_date: '',
    priority: 'medium'
  });

  const [comment, setComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const [adminTechIds, setAdminTechIds] = useState([]);
  const [adminStatusView, setAdminStatusView] = useState('pendientes');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const isErrorLike = useCallback((a) => {
    const text = `${a?.title || ''} ${a?.description || ''}`.toLowerCase();
    const keywords = ['error', 'falla', 'fallo', 'bug', 'problema', 'no funciona', 'no conecta', 'no prende'];
    return keywords.some(k => text.includes(k));
  }, []);

  const withinDateRange = useCallback((a) => {
    if (!createdFrom && !createdTo) return true;
    const dt = a?.created_at ? new Date(a.created_at) : null;
    if (!dt) return false;

    const dtLocal = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const fromLocal = createdFrom ? new Date(`${createdFrom}T00:00:00`) : null;
    const toLocal = createdTo ? new Date(`${createdTo}T23:59:59`) : null;

    return (!fromLocal || dtLocal >= new Date(fromLocal.getFullYear(), fromLocal.getMonth(), fromLocal.getDate()))
      && (!toLocal || dtLocal <= new Date(toLocal.getFullYear(), toLocal.getMonth(), toLocal.getDate()));
  }, [createdFrom, createdTo]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (isAdmin) {
        const users = await userService.getAll();
        const onlyTech = (users || []).filter(u => u.role === 'tech' || u.role === 'técnico');
        if (mounted) setTechUsers(onlyTech);
      }
    };
    run();
    return () => { mounted = false; };
  }, [isAdmin]);

  const refreshActivities = useCallback(async () => {
    setLoading(true);
    try {
      const all = await activityService.getAll();
      const filtered = isTech ? all.filter(a => a.assigned_tech === viewerId) : all;
      setActivities(filtered);
    } catch (err) {
      console.error('Error loading activities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [isTech, viewerId]);

  useEffect(() => {
    refreshActivities();
  }, [refreshActivities]);

  const selectedActivity = useMemo(() => {
    if (!selectedActivityId) return null;
    return activities.find(a => a.id === selectedActivityId) || null;
  }, [activities, selectedActivityId]);

  const exportBaseActivities = useMemo(() => {
    if (!isAdmin) return activities;
    let base = activities;
    if (adminTechIds.length > 0) {
      base = base.filter(a => adminTechIds.includes(a.assigned_tech || 'unassigned'));
    }
    base = base.filter(withinDateRange);
    return base;
  }, [activities, isAdmin, adminTechIds, withinDateRange]);

  const visibleActivities = useMemo(() => {
    let base = isAdmin ? exportBaseActivities : activities;

    // Filtro por Estado (Admin)
    if (isAdmin) {
      if (adminStatusView === 'pendientes') {
        base = base.filter(a => ['pending', 'assigned', 'in_progress'].includes((a.status || '').toLowerCase()));
      } else if (adminStatusView === 'en_progreso') {
        base = base.filter(a => (a.status || '').toLowerCase() === 'in_progress');
      } else if (adminStatusView === 'resueltas') {
        base = base.filter(a => (a.status || '').toLowerCase() === 'resolved');
      } else if (adminStatusView === 'errores') {
        base = base.filter(a => (a.status || '').toLowerCase() === 'in_progress' && isErrorLike(a));
      }
    }

    // NUEVO: Filtro por Buscador
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      base = base.filter(a =>
        (a.title && a.title.toLowerCase().includes(term)) ||
        (a.description && a.description.toLowerCase().includes(term))
      );
    }

    return base;
  }, [activities, isAdmin, exportBaseActivities, adminStatusView, isErrorLike, searchTerm]);

  const techCounts = useMemo(() => {
    if (!isAdmin) return [];
    const base = activities.filter(withinDateRange);
    const byTech = new Map();
    base.forEach(a => {
      const techId = a.assigned_tech || 'unassigned';
      if (!byTech.has(techId)) {
        byTech.set(techId, { techId, pending: 0, in_progress: 0, resolved: 0 });
      }
      const st = (a.status || '').toLowerCase();
      const slot = byTech.get(techId);
      if (st === 'resolved') slot.resolved += 1;
      else if (st === 'in_progress') slot.in_progress += 1;
      else slot.pending += 1;
    });

    const rows = techUsers
      .map(t => byTech.get(t.id) || { techId: t.id, pending: 0, in_progress: 0, resolved: 0 })
      .sort((a, b) => (b.pending + b.in_progress) - (a.pending + a.in_progress));

    const unassignedCount = byTech.get('unassigned');
    if (unassignedCount && (unassignedCount.pending > 0 || unassignedCount.in_progress > 0)) {
      rows.push(unassignedCount);
    }
    return rows;
  }, [isAdmin, activities, withinDateRange, techUsers]);

  const dashboardStats = useMemo(() => {
    const stats = { pending: 0, inProgress: 0, resolved: 0, urgent: 0 };
    exportBaseActivities.forEach(a => {
      const st = (a.status || '').toLowerCase();
      if (st === 'resolved') stats.resolved++;
      else if (st === 'in_progress') stats.inProgress++;
      else stats.pending++;

      if (a.priority === 'high' && st !== 'resolved') stats.urgent++;
    });
    return stats;
  }, [exportBaseActivities]);

  const urgentActivitiesList = useMemo(() => {
    return exportBaseActivities
      .filter(a => a.priority === 'high' && (a.status || '').toLowerCase() !== 'resolved')
      .slice(0, 5);
  }, [exportBaseActivities]);

  const toggleTech = (tId) => {
    setAdminTechIds(prev => prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]);
  };

  const clearTechFilters = () => setAdminTechIds([]);

  const downloadCSV = (rows, filename) => {
    const headers = ['id', 'title', 'status', 'priority', 'assigned_tech', 'due_date', 'created_at', 'description'];
    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needsQuotes = s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r');
      const safe = s.replace(/"/g, '""');
      return needsQuotes ? `"${safe}"` : safe;
    };
    const content = [
      headers.join(','),
      ...rows.map(r => headers.map(h => escape(r?.[h])).join(','))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const refreshLogs = async (activityId) => {
    if (!activityId) return;
    setLogsLoading(true);
    try {
      const data = await activityService.getLogs(activityId);
      setLogs(data);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedActivityId) return;
    refreshLogs(selectedActivityId);
  }, [selectedActivityId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return alert('Título es requerido.');
    const assignedTech = isAdmin ? form.assigned_tech : viewerId;
    if (isAdmin && !assignedTech) return alert('Debes asignar a un técnico.');
    setCreateLoading(true);
    try {
      const created = await activityService.createActivity({
        title: form.title.trim(), description: form.description.trim(),
        assigned_tech: assignedTech, priority: form.priority,
        due_date: form.due_date || null, created_by: viewerId,
        status: isAdmin ? ACTIVITY_STATUS.assigned : ACTIVITY_STATUS.in_progress
      });
      if (!created) throw new Error('No se pudo crear la actividad.');
      setForm({ title: '', description: '', assigned_tech: '', due_date: '', priority: 'medium' });
      setIsModalOpen(false); // Cerramos el modal
      setSelectedActivityId(created.id);
      await refreshActivities();
      await refreshLogs(created.id);
    } catch (err) { alert(err.message || 'Error al crear la actividad.'); } finally { setCreateLoading(false); }
  };

  const handleUpdate = async (updates) => {
    if (!selectedActivityId) return;
    const res = await activityService.updateActivity(selectedActivityId, updates, { actor_id: viewerId });
    if (!res) alert('Error al actualizar actividad.');
    await refreshActivities();
    await refreshLogs(selectedActivityId);
  };

  const availableStatusForTech = [ACTIVITY_STATUS.in_progress, ACTIVITY_STATUS.resolved];
  const availableStatusForAdmin = [ACTIVITY_STATUS.pending, ACTIVITY_STATUS.assigned, ACTIVITY_STATUS.in_progress, ACTIVITY_STATUS.resolved];
  const statusOptions = isTech ? availableStatusForTech : availableStatusForAdmin;

  const handleAddLog = async () => {
    if (!selectedActivityId || !comment.trim()) return;
    setCommentLoading(true);
    try {
      const ok = await activityService.addLog({ activity_id: selectedActivityId, actor_id: viewerId, event_type: 'comment', message: comment.trim() });
      if (!ok) throw new Error('No se pudo guardar el comentario.');
      setComment(''); await refreshLogs(selectedActivityId);
    } catch (err) { alert(err.message || 'Error al guardar comentario.'); } finally { setCommentLoading(false); }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest gap-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Sincronizando Actividades...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* PANEL IZQUIERDO: Listado y Filtros */}
        <div className="lg:w-[450px] bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[900px]">

          <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Actividades</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                    {isAdmin ? 'Gestión Técnica' : 'Tus Tareas'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={refreshActivities} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all" title="Refrescar">
                  <Clock size={16} />
                </button>
                {isAdmin && (
                  <button onClick={() => setIsModalOpen(true)} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all" title="Nueva Actividad">
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* NUEVO: Buscador */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por título o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-3 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          <div className="p-4 overflow-y-auto shrink-0 border-b border-slate-100 dark:border-slate-800">
            {isAdmin && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar por Técnicos</div>
                    {adminTechIds.length > 0 && (
                      <button onClick={clearTechFilters} className="text-[10px] font-bold text-blue-500 hover:text-blue-700">Limpiar Selección</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={clearTechFilters} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${adminTechIds.length === 0 ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      Todos
                    </button>
                    {techCounts.map(tc => {
                      const isSelected = adminTechIds.includes(tc.techId);
                      const techName = techUsers.find(t => t.id === tc.techId)?.full_name || (tc.techId === 'unassigned' ? 'Sin Asignar' : tc.techId);
                      return (
                        <button key={tc.techId} onClick={() => toggleTech(tc.techId)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${isSelected ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/50' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                          {techName.split(' ')[0]} <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>{tc.pending + tc.in_progress}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista de Estado</div>
                    <select value={adminStatusView} onChange={(e) => setAdminStatusView(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200">
                      <option value="pendientes">Pendientes / Asignadas</option>
                      <option value="en_progreso">Solo En Progreso</option>
                      <option value="errores">Errores/Bugs</option>
                      <option value="resueltas">Resueltas</option>
                      <option value="todas">Ver Todas</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde</div>
                      <input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-3 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200" onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hasta</div>
                      <input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-3 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200" onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {visibleActivities.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest italic text-xs">
                No hay actividades que mostrar.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleActivities.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedActivityId(a.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedActivityId === a.id
                      ? 'border-blue-500/40 bg-blue-50/40 dark:bg-blue-500/10 shadow-sm'
                      : 'border-white dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-200 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 mb-1">
                          {a.priority === 'high' && <Flame size={14} className="text-rose-500 fill-rose-500 shrink-0 mt-0.5" />}
                          <div className="font-black text-sm text-slate-900 dark:text-white line-clamp-2">{a.title}</div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Clock size={10} /> {timeAgo(a.created_at)}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                            {isAdmin ? (techUsers.find(t => t.id === a.assigned_tech)?.full_name || 'Sin asignar') : (a.due_date ? `Vence: ${a.due_date}` : 'Sin fecha límite')}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <ActivityStatusBadge status={a.status} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Detalle o Mini Dashboard */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
          {!selectedActivity ? (

            <div className="flex-1 p-8 lg:p-12 overflow-y-auto flex flex-col justify-center animate-in fade-in zoom-in-95 duration-500">
              <div className="max-w-xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 p-4 rounded-[2rem]">
                    <PieChart size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Resumen de Actividades</h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                      {adminTechIds.length > 0 ? 'Métricas de los técnicos seleccionados' : 'Métricas globales de todos los técnicos'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-10">
                  <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center">
                    <span className="text-4xl font-black text-amber-600 dark:text-amber-400 mb-2">{dashboardStats.pending}</span>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-700/70 dark:text-amber-500/70">Pendientes</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center">
                    <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">{dashboardStats.inProgress}</span>
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-700/70 dark:text-emerald-500/70">En Proceso</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center">
                    <span className="text-4xl font-black text-slate-600 dark:text-slate-400 mb-2">{dashboardStats.resolved}</span>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Resueltas</span>
                  </div>
                  <div className="bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 p-6 rounded-[2rem] flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <AlertTriangle size={80} className="absolute -right-4 -bottom-4 text-rose-500/10 dark:text-rose-500/5" />
                    <span className="text-4xl font-black text-rose-600 dark:text-rose-400 mb-2 relative z-10">{dashboardStats.urgent}</span>
                    <span className="text-xs font-black uppercase tracking-widest text-rose-700/70 dark:text-rose-500/70 relative z-10">Alta Prioridad</span>
                  </div>
                </div>

                {urgentActivitiesList.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Zap size={16} className="text-amber-500 fill-amber-500" />
                      Requieren Atención Inmediata
                    </h3>
                    <div className="space-y-3">
                      {urgentActivitiesList.map(a => (
                        <button key={a.id} onClick={() => setSelectedActivityId(a.id)} className="w-full text-left bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl hover:border-blue-300 transition-all flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">{a.title}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                              Técnico: {techUsers.find(t => t.id === a.assigned_tech)?.full_name || 'Nadie'}
                            </div>
                          </div>
                          <ArrowRightLeft size={16} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          ) : (

            <div className="flex flex-col h-full max-h-[900px]">
              <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    {selectedActivity.priority === 'high' ? <><Flame size={12} className="text-rose-500" /> Prioridad Alta</> : `Prioridad ${selectedActivity.priority || 'Media'}`}
                    <span>•</span>
                    {timeAgo(selectedActivity.created_at)}
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{selectedActivity.title}</div>
                  {selectedActivity.description && (
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-4 leading-relaxed bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                      {selectedActivity.description}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 items-end shrink-0">
                  <ActivityStatusBadge status={selectedActivity.status} />
                  <button className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all" onClick={() => setSelectedActivityId(null)} title="Cerrar detalle">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isAdmin && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignar técnico</div>
                      <select value={selectedActivity.assigned_tech || ''} onChange={(e) => { const newTech = e.target.value; const nextStatus = newTech ? ACTIVITY_STATUS.assigned : ACTIVITY_STATUS.pending; handleUpdate({ assigned_tech: newTech || null, status: nextStatus }); }} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200">
                        <option value="">Sin asignar</option>
                        {techUsers.map(t => (<option key={t.id} value={t.id}>{t.full_name} ({t.role})</option>))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Actual</div>
                    <select value={selectedActivity.status || ACTIVITY_STATUS.pending} onChange={(e) => handleUpdate({ status: e.target.value })} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200" disabled={isTech && selectedActivity.assigned_tech !== viewerId}>
                      {statusOptions.map(s => (<option key={s} value={s}>{s === ACTIVITY_STATUS.pending ? 'Pendiente' : s === ACTIVITY_STATUS.assigned ? 'Asignada' : s === ACTIVITY_STATUS.in_progress ? 'En Proceso' : 'Resuelta'}</option>))}
                    </select>
                  </div>
                </div>

                {/* Bitácora */}
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 p-2 rounded-2xl"><MessageSquare size={18} /></div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white">Bitácora</h4>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Historial y Comentarios</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-4 max-h-[350px] overflow-y-auto">
                    {logsLoading ? (
                      <div className="p-6 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando bitácora...</div>
                    ) : logs.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 font-bold uppercase tracking-widest italic text-xs">Sin eventos todavía.</div>
                    ) : (
                      <div className="space-y-3">
                        {logs.map(l => (
                          <div key={l.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg">
                                {l.event_type === 'created' ? 'Creación' : l.event_type === 'status_changed' ? 'Cambio de estado' : l.event_type === 'assigned_tech_changed' ? 'Asignación' : 'Comentario'}
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</div>
                            </div>
                            <div className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{l.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mt-4">
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Escribe un nuevo comentario o actualización..." className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all" disabled={commentLoading || (isTech && selectedActivity.assigned_tech !== viewerId)} />
                    <div className="flex justify-end">
                      <button onClick={handleAddLog} disabled={commentLoading || !comment.trim() || (isTech && selectedActivity.assigned_tech !== viewerId)} className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100">
                        {commentLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <><Send size={14} /> Guardar Comentario</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NUEVO: MODAL PARA CREAR ACTIVIDAD */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 p-2.5 rounded-2xl">
                  <Plus size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">Nueva Actividad</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asignación manual</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Título</div>
                  <input value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Ej. Reparar impresora..." className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" required />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridad</div>
                  <select value={form.priority} onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta (Urgente)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción detallada</div>
                <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Describe el problema o tarea..." className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-medium focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignar a técnico</div>
                  <select value={form.assigned_tech} onChange={(e) => setForm(prev => ({ ...prev, assigned_tech: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" required>
                    <option value="">Selecciona...</option>
                    {techUsers.map(t => (<option key={t.id} value={t.id}>{t.full_name}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha límite</div>
                  <div className="relative">
                    {/* AQUÍ ESTÁ LA MAGIA DEL CALENDARIO: onClick showPicker() */}
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                      onClick={(e) => e.target.showPicker && e.target.showPicker()}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all cursor-pointer"
                    />
                    <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={createLoading} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                  {createLoading ? 'Creando...' : 'Crear y Asignar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ActivitiesView = () => {
  const { profile, user } = useAuth();
  const role = (profile?.role || '').toLowerCase();
  const viewerId = user?.id;

  if (!viewerId || !profile) return <div className="p-20 text-center animate-spin">Cargando...</div>;

  return (
    <div className="w-full">
      <ActivitiesSection viewerRole={role} viewerId={viewerId} />
    </div>
  );
};

export default ActivitiesView;