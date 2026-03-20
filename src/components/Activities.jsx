import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  User,
  ArrowRightLeft,
  MessageSquare,
  Plus,
  Send,
  X
} from 'lucide-react';
import { useAuth } from '../context/authStore';
import StatCard from './StatCard';
import { inventoryService } from '../services/inventoryService';
import { userService } from '../services/userService';
import { activityService, ACTIVITY_STATUS } from '../services/activityService';

const StatusBadge = ({ status, daysRemaining }) => {
    const config = {
        'request_pending': { label: 'Solicitud Pendiente', styles: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' },
        'loaned': { label: 'Aprobado', styles: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' },
        'delivered': { label: 'Entregado (Oficina)', styles: 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20' },
        'received': { label: 'Recibido por Usuario', styles: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20' },
        'returned': { label: 'Devuelto (Pendiente)', styles: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' },
        'denied': { label: 'Rechazado', styles: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20' },
        'available': { label: 'En Bodega', styles: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' }
    };

    const s = config[status] || config['loaned'];
    let label = s.label;

    if (status === 'loaned') {
        if (daysRemaining < 0) label = `Retrasado (${Math.abs(daysRemaining)}d)`;
        else if (daysRemaining <= 2) label = `Por vencer (${daysRemaining}d)`;
    }

    return (
        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border ${s.styles}`}>
            {label}
        </span>
    );
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

  // Admin filters (para ver pendientes/en progreso/resueltas por técnico y por rango de fechas)
  const [adminTechId, setAdminTechId] = useState('all');
  const [adminStatusView, setAdminStatusView] = useState('pendientes'); // pendientes | en_progreso | errores | resueltas | todas
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const isErrorLike = useCallback((a) => {
    const text = `${a?.title || ''} ${a?.description || ''}`.toLowerCase();
    const keywords = [
      'error',
      'falla',
      'fallo',
      'bug',
      'problema',
      'no funciona',
      'no conecta',
      'no prende'
    ];
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
    return () => {
      mounted = false;
    };
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
    if (adminTechId !== 'all') base = base.filter(a => a.assigned_tech === adminTechId);
    base = base.filter(withinDateRange);
    return base;
  }, [activities, isAdmin, adminTechId, withinDateRange]);

  const visibleActivities = useMemo(() => {
    if (!isAdmin) return activities;

    let base = exportBaseActivities;

    if (adminStatusView === 'pendientes') {
      base = base.filter(a => ['pending', 'assigned', 'in_progress'].includes((a.status || '').toLowerCase()));
    } else if (adminStatusView === 'en_progreso') {
      base = base.filter(a => (a.status || '').toLowerCase() === 'in_progress');
    } else if (adminStatusView === 'resueltas') {
      base = base.filter(a => (a.status || '').toLowerCase() === 'resolved');
    } else if (adminStatusView === 'errores') {
      base = base.filter(a => (a.status || '').toLowerCase() === 'in_progress' && isErrorLike(a));
    } else {
      // todas
    }

    return base;
  }, [activities, isAdmin, exportBaseActivities, adminStatusView, isErrorLike]);

  const techCounts = useMemo(() => {
    if (!isAdmin) return [];

    const base = exportBaseActivities;
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
      else slot.pending += 1; // pending o assigned
    });

    const rows = techUsers
      .map(t => byTech.get(t.id) || { techId: t.id, pending: 0, in_progress: 0, resolved: 0 })
      .sort((a, b) => (b.pending + b.in_progress) - (a.pending + a.in_progress));

    return rows;
  }, [isAdmin, exportBaseActivities, techUsers]);

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

  const handleAdminDownloadPending = () => {
    if (!isAdmin) return;
    const rows = exportBaseActivities
      .filter(a => ['pending', 'assigned', 'in_progress'].includes((a.status || '').toLowerCase()))
      .map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
        priority: a.priority,
        assigned_tech: a.assigned_tech,
        due_date: a.due_date,
        created_at: a.created_at,
        description: a.description || ''
      }));
    const fileName = `actividades_pendientes_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(rows, fileName);
  };

  const handleAdminDownloadResolved = () => {
    if (!isAdmin) return;
    const rows = exportBaseActivities
      .filter(a => (a.status || '').toLowerCase() === 'resolved')
      .map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
        priority: a.priority,
        assigned_tech: a.assigned_tech,
        due_date: a.due_date,
        created_at: a.created_at,
        description: a.description || ''
      }));
    const fileName = `actividades_resueltas_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(rows, fileName);
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
    if (!form.title.trim()) {
      alert('Título es requerido.');
      return;
    }

    const assignedTech = isAdmin ? form.assigned_tech : viewerId;
    if (isAdmin && !assignedTech) {
      alert('Debes asignar a un técnico.');
      return;
    }

    setCreateLoading(true);
    try {
      const created = await activityService.createActivity({
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_tech: assignedTech,
        priority: form.priority,
        due_date: form.due_date || null,
        created_by: viewerId,
        status: isAdmin ? ACTIVITY_STATUS.assigned : ACTIVITY_STATUS.in_progress
      });

      if (!created) throw new Error('No se pudo crear la actividad.');
      setForm({ title: '', description: '', assigned_tech: '', due_date: '', priority: 'medium' });
      setSelectedActivityId(created.id);
      await refreshActivities();
      await refreshLogs(created.id);
    } catch (err) {
      console.error('Create activity error:', err);
      alert(err.message || 'Error al crear la actividad.');
    } finally {
      setCreateLoading(false);
    }
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
    if (!selectedActivityId) return;
    if (!comment.trim()) return;
    setCommentLoading(true);
    try {
      const ok = await activityService.addLog({
        activity_id: selectedActivityId,
        actor_id: viewerId,
        event_type: 'comment',
        message: comment.trim()
      });
      if (!ok) throw new Error('No se pudo guardar el comentario.');
      setComment('');
      await refreshLogs(selectedActivityId);
    } catch (err) {
      console.error('Add log error:', err);
      alert(err.message || 'Error al guardar comentario.');
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest gap-4">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        Sincronizando Actividades...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Listado */}
        <div className="lg:w-[420px] bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={18} className="text-blue-600" />
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Actividades</h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  {isAdmin ? 'Para gestionar y asignar' : 'Asignadas a ti'}
                </p>
              </div>
            </div>
            <button
              onClick={refreshActivities}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              title="Refrescar"
            >
              <Clock size={18} />
            </button>
          </div>

          <div className="p-4">
            {isAdmin && (
              <div className="space-y-4 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</div>
                    <select
                      value={adminTechId}
                      onChange={(e) => setAdminTechId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">Todos</option>
                      {techUsers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista</div>
                    <select
                      value={adminStatusView}
                      onChange={(e) => setAdminStatusView(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                    >
                      <option value="pendientes">Pendientes</option>
                      <option value="en_progreso">En Progreso</option>
                      <option value="errores">Errores en Progreso</option>
                      <option value="resueltas">Resueltas</option>
                      <option value="todas">Todas</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desde</div>
                    <input
                      type="date"
                      value={createdFrom}
                      onChange={(e) => setCreatedFrom(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hasta</div>
                    <input
                      type="date"
                      value={createdTo}
                      onChange={(e) => setCreatedTo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAdminDownloadPending}
                    className="flex-1 min-w-[190px] flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Descargar Pendientes
                  </button>
                  <button
                    onClick={handleAdminDownloadResolved}
                    className="flex-1 min-w-[190px] flex items-center justify-center gap-2 bg-slate-900 dark:bg-blue-600 text-white px-4 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-slate-900/20 hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Descargar Resueltas
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Por técnico (counts en el rango)</div>
                  <div className="space-y-2 max-h-[140px] overflow-auto pr-2">
                    {techCounts.map(tc => (
                      <button
                        key={tc.techId}
                        onClick={() => setAdminTechId(tc.techId)}
                        className={`w-full text-left px-4 py-2 rounded-2xl border transition-all ${
                          adminTechId === tc.techId
                            ? 'border-blue-500/50 bg-blue-50/40 dark:bg-blue-500/10'
                            : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white/50 dark:bg-slate-800/30'
                        }`}
                        title="Filtrar por este técnico"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 font-black text-slate-900 dark:text-white truncate text-sm">
                            {techUsers.find(t => t.id === tc.techId)?.full_name || tc.techId}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                            <span className="px-2 py-1 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{tc.pending}</span>
                            <span className="px-2 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{tc.in_progress}</span>
                            <span className="px-2 py-1 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">{tc.resolved}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {visibleActivities.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                No hay actividades registradas.
              </div>
            ) : (
              <div className="space-y-3 max-h-[540px] overflow-auto pr-2">
                {visibleActivities.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedActivityId(a.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedActivityId === a.id
                        ? 'border-blue-500/40 bg-blue-50/40 dark:bg-blue-500/10'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 dark:text-white truncate">{a.title}</div>
                        {a.due_date && (
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Vence: {a.due_date}
                          </div>
                        )}
                      </div>
                      <ActivityStatusBadge status={a.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detalle + bitacora */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          {!selectedActivity ? (
            <div className="h-full min-h-[520px] flex items-center justify-center p-8 text-center">
              <div className="p-10 text-center text-slate-400 font-black uppercase tracking-widest italic border-4 border-dashed border-slate-50 dark:border-slate-900 rounded-[3rem]">
                Selecciona una actividad para ver detalle y bitácora.
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{selectedActivity.priority || 'medium'}</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white truncate">{selectedActivity.title}</div>
                  {selectedActivity.description && (
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                      {selectedActivity.description}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <ActivityStatusBadge status={selectedActivity.status} />
                  {isAdmin && (
                    <button
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                      onClick={async () => {
                        setSelectedActivityId(null);
                      }}
                      title="Limpiar selección"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Controles */}
              <div className="p-6 space-y-6">
                {isAdmin && (
                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Asignar técnico</div>
                    <select
                      value={selectedActivity.assigned_tech || ''}
                      onChange={(e) => {
                        const newTech = e.target.value;
                        const nextStatus = newTech ? ACTIVITY_STATUS.assigned : ACTIVITY_STATUS.pending;
                        handleUpdate({ assigned_tech: newTech || null, status: nextStatus });
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                    >
                      <option value="">Sin asignar</option>
                      {techUsers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} ({t.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado</div>
                  <select
                    value={selectedActivity.status || ACTIVITY_STATUS.pending}
                    onChange={(e) => handleUpdate({ status: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                    disabled={isTech && selectedActivity.assigned_tech !== viewerId}
                  >
                    {statusOptions.map(s => (
                      <option key={s} value={s}>
                        {s === ACTIVITY_STATUS.pending
                          ? 'Pendiente'
                          : s === ACTIVITY_STATUS.assigned
                            ? 'Asignada'
                            : s === ACTIVITY_STATUS.in_progress
                              ? 'En Proceso'
                              : 'Resuelta'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bitácora */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 p-2 rounded-2xl">
                        <MessageSquare size={18} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white">Bitácora</h4>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                          Historial de cambios y comentarios
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {logs.length} eventos
                    </div>
                  </div>

                  <div className="bg-slate-50/30 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-4 max-h-[300px] overflow-auto">
                    {logsLoading ? (
                      <div className="p-6 text-center text-slate-400 font-bold uppercase tracking-widest">Cargando bitácora...</div>
                    ) : logs.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                        Sin eventos todavía.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {logs.map(l => (
                          <div key={l.id} className="bg-white/70 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {l.event_type === 'created'
                                  ? 'Creada'
                                  : l.event_type === 'status_changed'
                                    ? 'Cambio de estado'
                                    : l.event_type === 'assigned_tech_changed'
                                      ? 'Asignación'
                                      : 'Comentario'}
                              </div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {l.created_at ? new Date(l.created_at).toLocaleString() : ''}
                              </div>
                            </div>
                            <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                              {l.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Agregar a bitácora</div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Escribe un comentario para el historial..."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                      disabled={commentLoading || (isTech && selectedActivity.assigned_tech !== viewerId)}
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddLog}
                        disabled={commentLoading || !comment.trim() || (isTech && selectedActivity.assigned_tech !== viewerId)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {commentLoading ? (
                          <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send size={16} />
                            Enviar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Form create (admin/tech) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 p-2 rounded-2xl">
                <Plus size={18} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white">Crear actividad</h4>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  Admin asigna al técnico y queda en bitácora
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Título</div>
                <input
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Ej. Revisar laptop de usuario"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Prioridad</div>
                <select
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Descripción</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                placeholder="Detalles para el técnico..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Asignar a técnico</div>
                <select
                  value={form.assigned_tech}
                  onChange={(e) => setForm(prev => ({ ...prev, assigned_tech: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                  required
                >
                  <option value="">Selecciona...</option>
                  {techUsers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Fecha límite</div>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm({ title: '', description: '', assigned_tech: '', due_date: '', priority: 'medium' })}
                className="px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                disabled={createLoading}
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createLoading ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={16} />
                    Crear y asignar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isAdmin && isTech && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/10 text-blue-600 dark:text-blue-400 p-2 rounded-2xl">
                <MessageSquare size={18} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white">Reportar actividad</h4>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                  Se crea en progreso y queda en tu bitácora
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Título</div>
                <input
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Ej. Error de impresora (fallo en driver)"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Prioridad</div>
                <select
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Descripción</div>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
                placeholder="Qué pasó, a qué sistema afecta y cómo lo vas a resolver..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Fecha límite</div>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm({ title: '', description: '', assigned_tech: '', due_date: '', priority: 'medium' })}
                className="px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                disabled={createLoading}
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createLoading ? (
                  <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={16} />
                    Crear en progreso
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const LoansSection = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalActive: 0, pending: 0, delayed: 0, available: 0 });

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getAll();
      const relevantStatuses = ['loaned', 'request_pending', 'delivered', 'received', 'returned', 'denied'];
      const filteredData = data.filter(item => relevantStatuses.includes(item.status));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const processedLoans = filteredData.map(item => {
        const returnDate = item.returnDate ? new Date(item.returnDate) : null;
        let daysRemaining = null;
        if (returnDate) {
          const diffTime = returnDate - today;
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return { ...item, daysRemaining };
      });

      setLoans(processedLoans);

      setStats({
        totalActive: data.filter(i => i.status === 'loaned').length,
        pending: data.filter(i => i.status === 'request_pending').length,
        delayed: processedLoans.filter(l => l.status === 'loaned' && l.daysRemaining !== null && l.daysRemaining < 0).length,
        available: data.filter(i => i.status === 'available').length
      });
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleApprove = async (id) => {
    if (confirm('¿Aprobar este préstamo?')) {
      await inventoryService.update(id, { status: 'loaned' });
      fetchLoans();
    }
  };

  const handleDeny = async (id) => {
    const reason = prompt('Motivo del rechazo:');
    if (reason) {
      await inventoryService.update(id, { status: 'denied', rejectReason: reason });
      fetchLoans();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest gap-4">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        Sincronizando Calendario...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Préstamos Activos" value={stats.totalActive} icon={ArrowRightLeft} color="text-purple-600" bg="bg-purple-100" />
        <StatCard label="Solicitudes" value={stats.pending} icon={Clock} color="text-amber-600" bg="bg-amber-100" />
        <StatCard label="Retrasados" value={stats.delayed} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-100" />
        <StatCard label="Stock Bodega" value={stats.available} icon={Package} color="text-blue-600" bg="bg-blue-100" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Préstamos</h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Aprobaciones y seguimiento de solicitudes</p>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Equipo / Usuario</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado / Alerta</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Programación</th>
                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Acciones de Admin</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest italic">
                    No hay solicitudes o préstamos activos.
                  </td>
                </tr>
              ) : loans.map((loan) => (
                <tr key={loan.id} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
                        <User size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-slate-200">{loan.loanUser || 'Usuario Desconocido'}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{loan.type} - {loan.brand} {loan.model}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={loan.status} daysRemaining={loan.daysRemaining} />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Entrega: {loan.loanDate || 'N/A'}</span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">Devuelve: {loan.returnDate || 'Abierta'}</span>
                    </div>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    {loan.status === 'request_pending' && (
                      <div className="flex flex-col items-end gap-2">
                        {loan.requestReason && (
                          <div className="text-[10px] bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-slate-500 italic mb-1 max-w-[200px] whitespace-normal">
                            Motivo: {loan.requestReason}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(loan.id)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-500">
                            Aprobar
                          </button>
                          <button onClick={() => handleDeny(loan.id)} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-500/20 hover:bg-rose-500">
                            Rechazar
                          </button>
                        </div>
                      </div>
                    )}
                    {loan.status === 'loaned' && (
                      <button
                        onClick={() => inventoryService.update(loan.id, { status: 'delivered', deliveredAt: new Date().toISOString() }).then(fetchLoans)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 hover:bg-black transition-all"
                      >
                        Entregar Equipo
                      </button>
                    )}
                    {(loan.status === 'delivered' || loan.status === 'received') && (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                        Esperando Devolución...
                      </span>
                    )}
                    {loan.status === 'returned' && (
                      <button
                        onClick={() => inventoryService.update(loan.id, { status: 'available' }).then(fetchLoans)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition-all"
                      >
                        Confirmar Recepción
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ActivitiesView = () => {
  const { profile, user } = useAuth();
  const role = (profile?.role || '').toLowerCase();
  const viewerId = user?.id;

  const [tab, setTab] = useState('actividades');

  // Mientras carga el perfil, mostramos una pantalla neutral.
  if (!viewerId || !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold uppercase tracking-widest gap-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Cargando Actividades...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
        {[
          { id: 'actividades', label: 'Actividades' },
          { id: 'prestamos', label: 'Préstamos' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs sm:text-sm font-bold transition-all rounded-xl ${
              tab === t.id
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'actividades' ? (
        <ActivitiesSection viewerRole={role} viewerId={viewerId} />
      ) : (
        <LoansSection />
      )}
    </div>
  );
};

export default ActivitiesView;

