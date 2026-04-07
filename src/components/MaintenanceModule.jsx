import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, Clock, CheckCircle2, FilePlus, 
  Plus, ListFilter, X, Printer, RefreshCcw, BellRing
} from 'lucide-react';
import { maintenanceService } from '../services/maintenanceService';
import { userService } from '../services/userService';
import { useAuth } from '../context/authStore'; // Importamos directamente para evitar props stale
import { TicketStatusBadge } from './TicketsModule';

const MaintenanceModule = () => {
  const { profile: authProfile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [view, setView] = useState('active');
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [ticketToResolve, setTicketToResolve] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  
  const normalize = (value = '') => value.toString().trim().toLowerCase();
  const toCanonicalStatus = (value = '') => {
    const s = normalize(value);
    if (s === 'pendiente') return 'Pendiente';
    if (s === 'asignado') return 'Asignado';
    if (s === 'en proceso' || s === 'en_proceso' || s === 'in_progress') return 'En Proceso';
    if (s === 'resuelto' || s === 'resolved') return 'Resuelto';
    return value || 'Pendiente';
  };
  const toITStatus = (status = '') => {
    const current = toCanonicalStatus(status);
    if (current === 'Pendiente') return 'pending_admin';
    if (current === 'Asignado') return 'assigned';
    if (current === 'En Proceso') return 'in_progress';
    return 'resolved';
  };
  const role = normalize(authProfile?.role || authProfile?.Role || authProfile?.user_role);

  const isGlobalAdmin = role === 'admin';
  const isMaintBoss = role === 'jefe_mantenimiento';
  const isBoss = isGlobalAdmin || isMaintBoss;
  const isEngineer = ['tech', 'tecnico', 'técnico', 'ingeniero'].includes(role);

  useEffect(() => {
    if (authProfile) {
      console.log("DEBUG_MAINT_PROFILE:", authProfile);
      fetchData();
      if (isBoss) fetchEngineers();
    }
  }, [authProfile, isBoss]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Jefe/Admin ve todo; técnico solo sus tickets.
      const data = isBoss ? await maintenanceService.getAll() : await maintenanceService.getByEngineer(authProfile?.id);
      setTickets(data || []);
    } catch (err) {
      console.error("FETCH_ERROR:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEngineers = async () => {
    try {
      const users = await userService.getAll();
      setEngineers((users || []).filter(u => {
        const r = normalize(u.role);
        const d = normalize(u.department);
        const isMaintenanceEngineer = (d.includes('mantenimiento') || d.includes('ingenieria') || d.includes('ingeniería'))
          && ['tech', 'tecnico', 'técnico', 'ingeniero'].includes(r);
        return isMaintenanceEngineer;
      }));
    } catch (e) {}
  };

  const openResolveModal = (ticket) => {
    setTicketToResolve(ticket);
    setResolutionNotes(ticket?.notas_resolucion || '');
    setResolveModalOpen(true);
  };

  const handleDownloadReceipt = (ticket) => {
    if (!ticket) return;

    const printDate = new Date(ticket?.fecha_resolucion || Date.now()).toLocaleString('es-MX', {
      dateStyle: 'long',
      timeStyle: 'short'
    });
    const reporterName = ticket?.creador?.full_name || 'Supervisor de Mantenimiento';
    const techName = ticket?.asignado?.full_name || 'Técnico Asignado';
    const folio = ticket?.id?.toString().substring(0, 8) || 'MNT-0000';

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante Orden #${folio}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');
            body {
              font-family: 'Courier Prime', 'Courier New', monospace;
              width: 380px;
              margin: 0 auto;
              padding: 30px 20px;
              color: #1a1a1a;
              font-size: 14px;
              line-height: 1.5;
              background-color: #fff;
            }
            .ticket-container {
              border: 2px dashed #d1d5db;
              border-radius: 16px;
              padding: 24px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .header { text-align: center; margin-bottom: 24px; }
            .logo { font-size: 28px; font-weight: 700; letter-spacing: -1px; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px; }
            .divider { border-top: 1px dashed #d1d5db; margin: 20px 0; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; align-items: baseline; }
            .label { font-weight: 700; color: #4b5563; font-size: 12px; text-transform: uppercase; }
            .value { font-weight: 700; font-size: 14px; text-align: right; }
            .badge { background: #111827; color: white; padding: 4px 12px; border-radius: 99px; font-size: 12px; }
            .content-box { margin: 24px 0; background: #f9fafb; padding: 16px; border-radius: 12px; border: 1px solid #f3f4f6; }
            .content-box .label { margin-bottom: 8px; display: block; color: #111827; }
            .data-text { font-size: 14px; color: #374151; font-weight: 400; }
            .person-row { display: flex; align-items: center; justify-content: space-between; margin: 12px 0; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6; }
            .person-row:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
            .person-title { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
            .person-name { font-weight: 700; font-size: 14px; }
            .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #6b7280; }
            .barcode { margin-top: 16px; text-align: center; font-family: 'Libre Barcode 39', cursive; font-size: 48px; }
            @media print {
              body { width: 100%; padding: 0; background: white; }
              .ticket-container { border: none; box-shadow: none; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="ticket-container">
            <div class="header">
              <div class="logo">IT HELPDESK</div>
              <div class="subtitle">Comprobante de Servicio</div>
            </div>

            <div class="row" style="margin-top: 24px;">
              <span class="label">No. Folio:</span>
              <span class="badge">#${folio}</span>
            </div>
            <div class="row">
              <span class="label">Fecha Solución:</span>
              <span class="value">${printDate}</span>
            </div>
            <div class="row">
              <span class="label">Estado Actual:</span>
              <span class="value" style="color: #059669;">RESUELTO</span>
            </div>

            <div class="divider"></div>

            <div class="content-box">
              <span class="label">Detalle del Requerimiento:</span>
              <div class="data-text">${ticket?.title_falla || 'Sin descripción'}</div>
            </div>

            <div class="content-box" style="margin-top: 0;">
              <span class="label">Ubicación:</span>
              <div class="data-text">${ticket?.ubicacion || 'Sin ubicación'}</div>
            </div>

            <div class="divider"></div>

            <div class="person-row">
              <div>
                <div class="person-title">Reportado por</div>
                <div class="person-name">${reporterName}</div>
              </div>
            </div>

            <div class="person-row">
              <div>
                <div class="person-title">Atendido y Solucionado por</div>
                <div class="person-name">${techName}</div>
              </div>
            </div>

            <div class="divider"></div>

            <div class="content-box" style="margin-top: 0;">
              <span class="label">Notas de Resolución:</span>
              <div class="data-text">${ticket?.notas_resolucion || 'Sin notas registradas.'}</div>
            </div>

            <div class="footer">
              <p style="margin-bottom: 4px; font-weight: 700; color: #111827;">¡Orden Cerrada!</p>
              <p>Este comprobante certifica la atención y solución del requerimiento técnico.</p>
              <div class="barcode">*${folio}*</div>
            </div>
          </div>

          <script>
            window.onload = () => {
              let link = document.createElement('link');
              link.href = 'https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap';
              link.rel = 'stylesheet';
              document.head.appendChild(link);

              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 800);
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=450,height=800');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    const notes = resolutionNotes.trim();
    if (!notes || !ticketToResolve?.id) return;

    setResolving(true);
    const result = await maintenanceService.resolve(ticketToResolve.id, notes, authProfile.id);
    setResolving(false);

    if (result?.success) {
      const resolvedTicket = result.data || { ...ticketToResolve, notas_resolucion: notes, estado: 'Resuelto', fecha_resolucion: new Date().toISOString() };
      setResolveModalOpen(false);
      setTicketToResolve(null);
      setResolutionNotes('');
      await fetchData();
      handleDownloadReceipt(resolvedTicket);
    }
  };

  const inProgressTickets = tickets.filter((t) => toCanonicalStatus(t.estado) === 'En Proceso');
  const visibleTickets = useMemo(
    () => tickets.filter((t) => (view === 'active' ? toCanonicalStatus(t.estado) !== 'Resuelto' : toCanonicalStatus(t.estado) === 'Resuelto')),
    [tickets, view]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {inProgressTickets.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-[2rem] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Atención en curso</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/80 dark:text-blue-300/70">Órdenes ya tomadas por ingeniería</p>
                </div>
                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest">
                  {inProgressTickets.length} en proceso
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inProgressTickets.slice(0, 4).map((ticket) => (
                  <div key={`progress-${ticket.id}`} className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-700 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">
                      Atendiendo ahora
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">{ticket.title_falla}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Responsable: {ticket.asignado?.full_name || 'Ingeniería'}</div>
                  </div>
                ))}
              </div>
            </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none mt-2 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-300">
        <div className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-100/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-800/30">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Órdenes de Mantenimiento</h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
              Vista {view === 'active' ? 'activa' : 'historial'} · Rol {isBoss ? 'supervisor' : 'operativo'}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchData} className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm">
              <ListFilter size={16} />
              Refrescar
            </button>
            <button
              onClick={() => setView(view === 'active' ? 'history' : 'active')}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm"
            >
              <Clock size={16} />
              {view === 'active' ? 'Ver Historial' : 'Ver Activos'}
            </button>
            {isBoss && (
              <button
                onClick={() => setShowAddForm(true)}
                className="group relative overflow-hidden bg-slate-950 dark:bg-blue-600 text-white px-8 py-4 rounded-3xl font-black uppercase text-xs tracking-[0.2em] flex items-center gap-4 shadow-2xl shadow-slate-950/20 dark:shadow-blue-900/30 hover:bg-blue-600 dark:hover:bg-blue-500 transition-all hover:-translate-y-1 active:scale-95 border border-white/10"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <div className="bg-white/10 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                  <FilePlus size={22} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col items-start">
                  <span>Nueva Orden</span>
                  <span className="text-[8px] opacity-60 font-medium">Mantenimiento Desk</span>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="p-4 pl-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Folio</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Orden / Falla</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Ubicación</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Técnico</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Estado</th>
                <th className="p-4 pb-6 border-b border-slate-100/50 dark:border-slate-800/50">Acciones</th>
                <th className="p-4 pr-6 pb-6 border-b border-slate-100/50 dark:border-slate-800/50 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Cargando órdenes desde Supabase...
                    </div>
                  </td>
                </tr>
              ) : visibleTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-medium border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    No hay órdenes en esta vista.
                  </td>
                </tr>
              ) : (
                visibleTickets.map((ticket) => {
                  const currentStatus = toCanonicalStatus(ticket.estado);
                  const isAssignedTech = ticket.asignado_a === authProfile?.id;
                  const isEscalated = Boolean(ticket.escalated_to_it);
                  const canEscalateToIT = (isBoss || (isEngineer && isAssignedTech)) && currentStatus !== 'Resuelto';
                  return (
                    <tr key={ticket.id} className="group transition-all duration-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="p-4 pl-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-transparent group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
                          <span className="font-bold text-slate-900 dark:text-slate-100">#{ticket.id.toString().slice(-6).toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{ticket.title_falla}</span>
                      </td>
                      <td className="p-4 font-medium text-slate-600 dark:text-slate-400">{ticket.ubicacion}</td>
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{ticket.asignado?.full_name || 'Sin Asignar'}</td>
                      <td className="p-4">
                        <TicketStatusBadge status={toITStatus(currentStatus)} size="lg" />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isBoss && currentStatus !== 'Resuelto' && (
                            <select
                              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-200"
                              onChange={async (e) => {
                                const result = await maintenanceService.assign(ticket.id, e.target.value, authProfile.id);
                                if (!result?.success) {
                                  alert(result?.error || 'No se pudo asignar la orden.');
                                }
                                fetchData();
                              }}
                              value={ticket.asignado_a || ''}
                            >
                              <option value="">Asignar...</option>
                              {engineers.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                            </select>
                          )}

                          {isEngineer && isAssignedTech && currentStatus === 'Asignado' && (
                            <button
                              onClick={async () => {
                                const result = await maintenanceService.startWork(ticket.id, authProfile.id);
                                if (!result?.success) {
                                  alert(result?.error || 'No se pudo pasar a En Proceso.');
                                }
                                fetchData();
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white"
                            >
                              <Wrench size={12} /> Atender
                            </button>
                          )}

                          {isEngineer && isAssignedTech && currentStatus === 'En Proceso' && (
                            <button
                              onClick={() => openResolveModal(ticket)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white"
                            >
                              <CheckCircle2 size={12} /> Resolver
                            </button>
                          )}

                          {canEscalateToIT && (
                            <button
                              onClick={async () => {
                                if (isEscalated) return;
                                const ok = window.confirm('¿Notificar a Sistemas (IT Desk) para apoyo en esta orden?');
                                if (!ok) return;
                                const result = await maintenanceService.notifyITDesk(ticket.id, authProfile.id);
                                if (!result?.success) {
                                  alert(result?.error || 'No se pudo notificar a Sistemas.');
                                } else {
                                  alert(`Sistemas notificado correctamente (${result.notified || 0} admins IT).`);
                                }
                                fetchData();
                              }}
                              disabled={isEscalated}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider ${isEscalated ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                              title={isEscalated ? 'Sistemas ya fue notificado en esta orden' : 'Notificar a Sistemas'}
                            >
                              <BellRing size={12} /> {isEscalated ? 'IT Notificado' : 'Notificar a Sistemas'}
                            </button>
                          )}

                          {currentStatus === 'Resuelto' && (
                            <button
                              onClick={() => handleDownloadReceipt(ticket)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white"
                            >
                              <Printer size={12} /> Imprimir
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right font-medium text-slate-400 dark:text-slate-500">
                        {new Date(ticket.fecha_creacion).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resolveModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-300 relative">
            <button
              onClick={() => {
                if (resolving) return;
                setResolveModalOpen(false);
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-red-500 transition-colors"
            >
              <X size={24} />
            </button>

            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Cerrar orden en proceso</h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-1">
              {ticketToResolve?.title_falla || 'Orden de mantenimiento'}
            </p>

            <form onSubmit={handleResolveSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reporte técnico de cierre</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  required
                  minLength={8}
                  rows={5}
                  placeholder="Describe diagnóstico, piezas/correcciones realizadas y resultado final..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={resolving || resolutionNotes.trim().length < 8}
                className="w-full bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all"
              >
                {resolving ? 'Cerrando orden...' : 'Confirmar cierre e imprimir'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA NUEVAS ÓRDENES */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md p-10 rounded-[3.5rem] shadow-[0_0_50px_-12px_rgba(37,99,235,0.25)] relative border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowAddForm(false)} className="absolute top-8 right-8 text-slate-400 hover:text-red-500 transition-colors"><X size={32} /></button>
            <div className="mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Nueva Orden de Ingeniería</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Registrar falla de mantenimiento</p>
            </div>
            <form className="space-y-5" onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              const ok = await maintenanceService.create({ 
                title_falla: f.get('title'), 
                ubicacion: f.get('location'), 
                categoria: f.get('category'), 
                prioridad: f.get('priority') 
              }, authProfile.id);
              if (ok.success) { setShowAddForm(false); fetchData(); }
            }}>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Falla / Equipo</label><input name="title" required placeholder="Ej. A/C no enfría en Hab 302..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 py-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500"/></div>
              <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Ubicación</label><input name="location" required placeholder="Ubicación precisa..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-5 py-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500"/></div>
              <div className="grid grid-cols-2 gap-4">
                <select name="category" className="bg-slate-50 dark:bg-slate-950 border border-slate-200 px-4 py-4 rounded-2xl text-[10px] font-black uppercase"><option>General</option><option>Electricidad</option><option>Plomería</option><option>Climas</option></select>
                <select name="priority" className="bg-slate-50 dark:bg-slate-950 border border-slate-200 px-4 py-4 rounded-2xl text-[10px] font-black uppercase"><option>Baja</option><option>Normal</option><option>Alta</option></select>
              </div>
              <button className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/30 hover:bg-blue-700 transition-all">Emitir Orden de Trabajo</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MaintenanceModule;
