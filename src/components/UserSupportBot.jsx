import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, RefreshCcw, Wifi } from 'lucide-react';
import { botIncidentService } from '../services/botIncidentService';
import { supabase } from '../lib/supabaseClient';

const UserSupportBot = () => {
  const [loading, setLoading] = useState(true);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [recentResolved, setRecentResolved] = useState([]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const [active, all] = await Promise.all([
        botIncidentService.getActiveIncidents(),
        botIncidentService.getAllIncidents(),
      ]);

      setActiveIncidents(active || []);
      setRecentResolved((all || []).filter((item) => item.status === 'resolved').slice(0, 6));
    } catch (error) {
      console.error('Error loading TI news:', error?.message || error);
      setActiveIncidents([]);
      setRecentResolved([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();

    const channel = supabase
      .channel('ti_news_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_incidents' }, () => {
        loadNews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const highPriorityActive = useMemo(() => {
    return activeIncidents.filter((item) => item.priority === 'high');
  }, [activeIncidents]);

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString();
  };

  const getServiceLabel = (service) => {
    const map = {
      internet: 'Internet',
      wifi: 'WiFi',
      telefonia: 'Telefonia',
      sistema: 'Sistemas',
      otro: 'General',
    };
    return map[service] || 'General';
  };

  const priorityClass = (priority) => {
    if (priority === 'high') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';
    if (priority === 'medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 p-6 shadow-xl shadow-slate-200/40 dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <BellRing size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white tracking-tight">Noticias IT</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Estado actual de incidentes tecnicos del hotel.</p>
            </div>
          </div>
          <button
            onClick={loadNews}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <RefreshCcw size={14} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <AlertTriangle size={14} />
            Incidentes Activos
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{activeIncidents.length} activos</div>
        </div>

        <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
          {loading ? (
            <div className="text-sm text-slate-500">Cargando noticias IT...</div>
          ) : activeIncidents.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/70 dark:bg-emerald-500/10 dark:border-emerald-500/20 p-4">
              <div className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-200 text-sm font-semibold">
                <CheckCircle2 size={16} />
                Sin incidentes activos en este momento.
              </div>
            </div>
          ) : (
            activeIncidents.map((incident) => (
              <div key={incident.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${priorityClass(incident.priority)}`}>
                    {incident.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                    {getServiceLabel(incident.service)}
                  </span>
                  <span className="text-[11px] text-slate-500">Desde: {formatDateTime(incident.started_at)}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{incident.title}</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{incident.message}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Wifi size={14} />
            Historial Reciente
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{recentResolved.length} resueltos</div>
        </div>

        <div className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="text-sm text-slate-500">Actualizando historial...</div>
          ) : recentResolved.length === 0 ? (
            <div className="text-sm text-slate-500">No hay incidentes resueltos recientes.</div>
          ) : (
            recentResolved.map((incident) => (
              <div key={`resolved-${incident.id}`} className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-500/10 dark:border-emerald-500/20 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                    Resuelto
                  </span>
                  <span className="text-[11px] text-slate-500">Cierre: {formatDateTime(incident.resolved_at)}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{incident.title}</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{incident.resolution_note || 'Incidente estabilizado.'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {highPriorityActive.length > 0 && (
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 dark:bg-rose-500/10 dark:border-rose-500/20 p-4 text-sm text-rose-700 dark:text-rose-200 font-semibold">
          Hay {highPriorityActive.length} incidente(s) critico(s) activo(s). Sigue las indicaciones de TI y evita reinicios no coordinados en areas afectadas.
        </div>
      )}
    </div>
  );
};

export default UserSupportBot;
