import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Megaphone, Pencil, Plus, RefreshCcw, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../context/authStore';
import { botIncidentService } from '../services/botIncidentService';

const SERVICE_OPTIONS = [
  { value: 'internet', label: 'Internet' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'telefonia', label: 'Telefonia' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'otro', label: 'Otro' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
];

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const priorityClass = (priority) => {
  if (priority === 'high') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';
  if (priority === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
};

const BotIncidentsAdmin = () => {
  const { profile, user } = useAuth();
  const role = (profile?.role || '').toLowerCase().trim();
  const department = (profile?.department || '').toLowerCase().trim();
  const isMaint = department.includes('mantenimiento') || department.includes('ingenieria') || department.includes('ingeniería');
  const canManage = ['admin', 'jefe_it', 'jefe_area_it', 'jefe area it'].includes(role) && !isMaint;

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIncidentId, setEditingIncidentId] = useState(null);
  const [editingForm, setEditingForm] = useState({
    service: 'internet',
    priority: 'medium',
    title: '',
    message: '',
  });
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm] = useState({
    service: 'internet',
    priority: 'medium',
    title: '',
    message: '',
  });

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const data = await botIncidentService.getAllIncidents();
      setIncidents(data);
    } catch (error) {
      console.error('Error loading TI incidents:', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const visibleIncidents = useMemo(() => {
    if (statusFilter === 'all') return incidents;
    return incidents.filter((incident) => incident.status === statusFilter);
  }, [incidents, statusFilter]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canManage || !user?.id) return;
    if (!form.title.trim() || !form.message.trim()) return;

    setSaving(true);
    try {
      await botIncidentService.createIncident(
        {
          service: form.service,
          priority: form.priority,
          title: form.title.trim(),
          message: form.message.trim(),
          scope: 'global',
        },
        user.id
      );
      setForm({ service: 'internet', priority: 'medium', title: '', message: '' });
      await loadIncidents();
    } catch (error) {
      console.error('Error creating TI incident:', error.message || error);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (incidentId) => {
    if (!canManage || !user?.id) return;
    const resolutionNote = window.prompt('Nota de cierre (opcional):', 'Incidente estabilizado y validado.');
    if (resolutionNote === null) return;

    try {
      await botIncidentService.resolveIncident(incidentId, resolutionNote, user.id);
      await loadIncidents();
    } catch (error) {
      console.error('Error resolving incident:', error.message || error);
    }
  };

  const handleStartEdit = (incident) => {
    setEditingIncidentId(incident.id);
    setEditingForm({
      service: incident.service || 'internet',
      priority: incident.priority || 'medium',
      title: incident.title || '',
      message: incident.message || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingIncidentId(null);
    setEditingForm({
      service: 'internet',
      priority: 'medium',
      title: '',
      message: '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingIncidentId) return;
    if (!editingForm.title.trim() || !editingForm.message.trim()) return;

    setSaving(true);
    try {
      await botIncidentService.updateIncident(editingIncidentId, {
        service: editingForm.service,
        priority: editingForm.priority,
        title: editingForm.title.trim(),
        message: editingForm.message.trim(),
      });
      handleCancelEdit();
      await loadIncidents();
    } catch (error) {
      console.error('Error updating TI incident:', error.message || error);
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/20 p-6 text-rose-700 dark:text-rose-200 font-semibold flex items-center gap-3">
        <ShieldAlert size={18} />
        No tienes permisos para administrar noticias IT.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-xl shadow-slate-200/40 dark:shadow-none">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <Megaphone size={20} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white tracking-tight">Nueva Noticia TI</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Este aviso sera visible en el portal de usuarios como noticia técnica.</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Servicio
            <select
              value={form.service}
              onChange={(event) => setForm((prev) => ({ ...prev, service: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5"
            >
              {SERVICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Prioridad
            <select
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            Titulo corto
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ej. Caida de Internet en Torre A"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5"
            />
          </label>

          <label className="md:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            Mensaje para usuarios
            <textarea
              rows={3}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Describe alcance y avance para que el bot responda correctamente."
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5"
            />
          </label>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || !form.title.trim() || !form.message.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Publicar noticia
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-wide">Historial de noticias IT</h4>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs font-semibold"
            >
              <option value="active">Activos</option>
              <option value="resolved">Resueltos</option>
              <option value="all">Todos</option>
            </select>
            <button
              onClick={loadIncidents}
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-300"
            >
              <RefreshCcw size={14} />
              Refrescar
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-500">Cargando noticias...</div>
          ) : visibleIncidents.length === 0 ? (
            <div className="text-sm text-slate-500">No hay noticias para este filtro.</div>
          ) : (
            visibleIncidents.map((incident) => (
              <div key={incident.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${priorityClass(incident.priority)}`}>
                        {incident.priority}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{incident.service}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{incident.status}</span>
                    </div>
                    <h5 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{incident.title}</h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{incident.message}</p>
                    <p className="text-[11px] text-slate-500 mt-2">Inicio: {formatDate(incident.started_at)}</p>
                    {incident.resolved_at && (
                      <p className="text-[11px] text-slate-500">Cierre: {formatDate(incident.resolved_at)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(incident)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    {incident.status === 'active' && (
                      <button
                        onClick={() => handleResolve(incident.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <CheckCircle2 size={14} />
                        Marcar resuelto
                      </button>
                    )}
                  </div>
                </div>

                {editingIncidentId === incident.id && (
                  <div className="mt-4 p-4 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/10 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Servicio
                      <select
                        value={editingForm.service}
                        onChange={(event) => setEditingForm((prev) => ({ ...prev, service: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                      >
                        {SERVICE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Prioridad
                      <select
                        value={editingForm.priority}
                        onChange={(event) => setEditingForm((prev) => ({ ...prev, priority: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                      >
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="md:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                      Titulo corto
                      <input
                        value={editingForm.title}
                        onChange={(event) => setEditingForm((prev) => ({ ...prev, title: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                      />
                    </label>

                    <label className="md:col-span-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                      Mensaje para usuarios
                      <textarea
                        rows={3}
                        value={editingForm.message}
                        onChange={(event) => setEditingForm((prev) => ({ ...prev, message: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                      />
                    </label>

                    <div className="md:col-span-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold"
                      >
                        <X size={14} />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={saving || !editingForm.title.trim() || !editingForm.message.trim()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Pencil size={14} />
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BotIncidentsAdmin;
