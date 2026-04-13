import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    FilePlus, History, Calendar as CalendarIcon, LogOut, Search, Bell, LayoutDashboard,
    Ticket as TicketIcon, CheckCircle, Clock, AlertCircle, ChevronRight, User,
    CheckCircle2, ChevronLeft, Send, X, Laptop, Settings, Smartphone, Monitor, ImagePlus, Hash, Menu, FileText,
    Cpu, Cable, Keyboard, MousePointer2, ChevronDown, ChevronUp, Sparkles, Wifi, Briefcase, Trash2
} from 'lucide-react';
import Header from './Header';
import StatCard from './StatCard';
import { TicketStatusBadge } from './TicketsModule';
import GeneralRequestForm from './GeneralRequestForm';
import TermsModal from './TermsModal';
import ProfileSettingsModal from './ProfileSettingsModal';
import TicketDetailSlider from './TicketDetailSlider';
import UserSupportBot from './UserSupportBot';
import { useAuth } from '../context/authStore';
import { supabase } from '../lib/supabaseClient';
import { userService } from '../services/userService';
import { ticketService } from '../services/ticketService';
import { workNotificationService } from '../services/workNotificationService';

// --- SUBCOMPONENTE: Agenda de Usuario ---
const UserAgenda = () => {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(null);
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchEvents = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [{ data: ticketsData }, { data: genReqs }] = await Promise.all([
                supabase
                    .from('tickets')
                    .select('id,title,status,created_at,scheduled_for,reported_by')
                    .eq('reported_by', user.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('general_requests')
                    .select('id,subject,status,is_loan,loan_start_date,loan_end_date,created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false }),
            ]);

            const scheduled = [];
            for (const t of ticketsData || []) {
                if (t.scheduled_for && (t.status || '').toLowerCase() !== 'resolved') {
                    const rd = new Date(t.scheduled_for);
                    scheduled.push({
                        id: `sched_${t.id}`,
                        title: t.title,
                        time: rd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        date: rd.toLocaleDateString(),
                        rawDate: rd,
                        markerKind: 'scheduled',
                        type: 'Atención programada',
                        status: 'pending',
                        fullItem: t,
                    });
                }
            }

            const loanFromGeneral = [];
            for (const g of genReqs || []) {
                const st = (g.status || '').toLowerCase();
                if (g.is_loan && g.loan_end_date && (st === 'delivered' || st === 'approved')) {
                    const end = new Date(`${g.loan_end_date}T12:00:00`);
                    const start = g.loan_start_date ? new Date(`${g.loan_start_date}T12:00:00`) : null;
                    loanFromGeneral.push({
                        id: `loan_req_${g.id}`,
                        title: `Préstamo: ${g.subject || 'Equipo'}`,
                        time: `Hasta ${end.toLocaleDateString()}`,
                        date: end.toLocaleDateString(),
                        rawDate: end,
                        markerKind: 'loan_range',
                        loanStart: start,
                        loanEnd: end,
                        type: 'Préstamo (petición)',
                        itemStatus: g.status,
                        status: end < new Date() ? 'completed' : 'pending',
                        fullItem: g,
                    });
                }
            }

            const allEvents = [...scheduled, ...loanFromGeneral];
            setEvents(allEvents.sort((a, b) => b.rawDate - a.rawDate));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    useEffect(() => {
        if (!user?.id) return;
        const ch = supabase
            .channel(`user_agenda_${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets', filter: `reported_by=eq.${user.id}` },
                () => fetchEvents()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'general_requests', filter: `user_id=eq.${user.id}` },
                () => fetchEvents()
            )
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [user?.id, fetchEvents]);

    const daysInMonth = (mo, yr) => new Date(yr, mo + 1, 0).getDate();
    const firstDayOfMonth = (mo, yr) => new Date(yr, mo, 1).getDay();

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const numDays = daysInMonth(month, year);
    const startDay = firstDayOfMonth(month, year);
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const changeMonth = (offset) => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + offset);
        setCurrentDate(d);
    };

    const normalizeDay = (dateValue) => {
        const d = new Date(dateValue);
        d.setHours(12, 0, 0, 0);
        return d;
    };

    const sameCalDay = (a, b) =>
        a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

    const hasEvent = (day) => {
        const cell = new Date(year, month, day);
        cell.setHours(12, 0, 0, 0);
        if (events.some((e) => e.markerKind === 'scheduled' && sameCalDay(e.rawDate, cell))) return true;
        return events.some((e) => {
            if (e.markerKind !== 'loan_range' || !e.loanEnd) return false;
            const s = e.loanStart ? new Date(e.loanStart) : new Date(e.loanEnd);
            s.setHours(0, 0, 0, 0);
            const en = new Date(e.loanEnd);
            en.setHours(23, 59, 59, 999);
            return cell >= s && cell <= en;
        });
    };

    const monthEventsCount = useMemo(() => {
        return events.filter((e) => e.rawDate.getMonth() === month && e.rawDate.getFullYear() === year).length;
    }, [events, month, year]);

    const getRelativeTag = (rawDate) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());
        const diff = Math.floor((target - today) / (1000 * 60 * 60 * 24));

        if (diff < 0) return { label: 'Vencido', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' };
        if (diff === 0) return { label: 'Hoy', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' };
        if (diff === 1) return { label: 'Mañana', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200' };
        return { label: `En ${diff} días`, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200' };
    };

    const visibleEvents = useMemo(() => {
        const filtered = events.filter((event) => {
            if (selectedDay && !sameCalDay(normalizeDay(event.rawDate), selectedDay)) return false;
            if (typeFilter !== 'all') {
                if (typeFilter === 'scheduled' && event.markerKind !== 'scheduled') return false;
                if (typeFilter === 'loan' && event.markerKind !== 'loan_range') return false;
            }
            if (statusFilter !== 'all' && event.status !== statusFilter) return false;
            return true;
        });

        return filtered.sort((a, b) => {
            const nowTs = Date.now();
            const aTs = a.rawDate.getTime();
            const bTs = b.rawDate.getTime();
            const aWeight = aTs < nowTs ? 1 : 0;
            const bWeight = bTs < nowTs ? 1 : 0;
            if (aWeight !== bWeight) return aWeight - bWeight;
            return aTs - bTs;
        });
    }, [events, selectedDay, typeFilter, statusFilter]);

    return (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700 transition-colors">
            {/* Real Interactive Calendar */}
            <div className="lg:w-80 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 shadow-2xl shadow-slate-200/20 dark:shadow-none shrink-0 transition-all hover:shadow-blue-500/5">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{monthNames[month]} {year}</h3>
                    <div className="flex gap-2">
                        <button onClick={() => changeMonth(-1)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 transition-all active:scale-90"><ChevronLeft size={16} className="text-slate-500" /></button>
                        <button onClick={() => changeMonth(1)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 transition-all active:scale-90"><ChevronRight size={16} className="text-slate-500" /></button>
                    </div>
                </div>
                <div className="mb-4 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl px-3 py-2 text-center">
                    {monthEventsCount} evento{monthEventsCount === 1 ? '' : 's'} este mes
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-300 dark:text-slate-600 mb-4 uppercase tracking-[0.2em]">
                    <span>Dom</span><span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {/* Empty slots for first week */}
                    {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} className="py-2.5"></div>)}

                    {Array.from({ length: numDays }, (_, i) => {
                        const day = i + 1;
                        const cellDate = normalizeDay(new Date(year, month, day));
                        const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                        const isSelected = selectedDay && sameCalDay(selectedDay, cellDate);
                        const dayHasEvent = hasEvent(day);

                        return (
                            <div
                                key={day}
                                onClick={() => setSelectedDay(isSelected ? null : cellDate)}
                                className={`relative py-3 rounded-xl cursor-pointer transition-all duration-300 font-black group ${isToday ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-600 dark:text-slate-400'} ${isSelected && !isToday ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}`}
                            >
                                {day}
                                {dayHasEvent && <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-blue-500'}`}></div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Interactive Activities List */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-3 uppercase tracking-[0.2em]">
                        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <CalendarIcon size={14} />
                        </div>
                        Próximas Actividades
                    </h3>
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800 uppercase tracking-widest leading-none">{visibleEvents.length} visibles / {events.length}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${selectedDay ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-slate-900 text-white border-slate-900'}`}
                    >
                        Todo el mes
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${typeFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                    >
                        Todos
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('scheduled')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${typeFilter === 'scheduled' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >
                        Tickets
                    </button>
                    <button
                        type="button"
                        onClick={() => setTypeFilter('loan')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${typeFilter === 'loan' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}
                    >
                        Préstamos
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${statusFilter === 'pending' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}
                    >
                        Pendientes
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${statusFilter === 'completed' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                    >
                        Completados
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Sincronizando...</div>
                    ) : visibleEvents.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 font-black uppercase tracking-[0.2em] text-xs border-4 border-dashed border-slate-50 dark:border-slate-900 rounded-[3rem]">{selectedDay ? 'No hay actividades para este día' : 'No hay actividades registradas'}</div>
                    ) : visibleEvents.map((event) => (
                        <div key={event.id} className="group bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/40 dark:hover:shadow-none cursor-pointer">
                            <div className="flex items-center gap-5">
                                <div className={`p-4 rounded-2xl transition-all group-hover:rotate-12 duration-500 ${event.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                    {event.status === 'completed' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                                </div>
                                <div>
                                    <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight">{event.title}</h4>
                                    <div className="flex flex-wrap items-center gap-4 mt-2">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest ${event.markerKind === 'scheduled' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{event.type}{event.itemStatus ? ` (${event.itemStatus})` : ''}</span>
                                        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                            <CalendarIcon size={12} /> {event.date}
                                        </div>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest ${getRelativeTag(event.rawDate).cls}`}>
                                            {getRelativeTag(event.rawDate).label}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-all">
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MyGeneralRequestsPanel = () => {
    const { user } = useAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showResolvedHistory, setShowResolvedHistory] = useState(false);
    const [extendModal, setExtendModal] = useState({ open: false, row: null });
    const [extendForm, setExtendForm] = useState({ requestedEndDate: '', reason: '' });
    const [extendSubmitting, setExtendSubmitting] = useState(false);

    const fetchRows = React.useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('general_requests')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            setRows(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    React.useEffect(() => {
        fetchRows();
    }, [fetchRows]);

    React.useEffect(() => {
        if (!user?.id) return;
        const ch = supabase
            .channel(`my_general_req_${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'general_requests', filter: `user_id=eq.${user.id}` },
                () => fetchRows()
            )
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [user?.id, fetchRows]);

    const handleDeleteRejected = async (id) => {
        if (!id || !user?.id) return;
        if (!window.confirm('¿Eliminar esta petición denegada de tu historial?')) return;
        try {
            const { error } = await supabase
                .from('general_requests')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id)
                .eq('status', 'rejected');

            if (error) throw error;
            await fetchRows();
        } catch (e) {
            console.error(e);
            alert('No se pudo eliminar la petición denegada.');
        }
    };

    const statusLabel = (s) => {
        if (s === 'borrowed') return 'Prestado';
        if (s === 'overdue') return 'Vencido';
        if (s === 'returned') return 'Devuelto';
        if (s === 'delivered') return 'Entregada';
        if (s === 'rejected') return 'Denegada';
        if (s === 'approved') return 'Aprobada';
        return 'Pendiente';
    };

    const statusClass = (s) => {
        if (s === 'borrowed') return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
        if (s === 'overdue') return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
        if (s === 'returned') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        if (s === 'delivered') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        if (s === 'rejected') return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
        if (s === 'approved') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    };

    const extensionStatusLabel = (value) => {
        const s = (value || '').toLowerCase();
        if (s === 'pending') return 'Prórroga en revisión';
        if (s === 'approved') return 'Prórroga aprobada';
        if (s === 'rejected') return 'Prórroga rechazada';
        return null;
    };

    const extensionStatusClass = (value) => {
        const s = (value || '').toLowerCase();
        if (s === 'pending') return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
        if (s === 'approved') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
        if (s === 'rejected') return 'bg-rose-500/10 text-rose-700 border-rose-500/30';
        return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
    };

    const canRequestExtension = (row) => {
        if (!row?.is_loan) return false;
        const st = (row.status || '').toLowerCase();
        const ext = (row.extension_status || '').toLowerCase();
        return (st === 'borrowed' || st === 'overdue') && ext !== 'pending';
    };

    const openExtensionModal = (row) => {
        const currentEndDate = row?.loan_end_date || '';
        setExtendForm({
            requestedEndDate: currentEndDate,
            reason: '',
        });
        setExtendModal({ open: true, row });
    };

    const handleSubmitExtensionRequest = async () => {
        const row = extendModal.row;
        if (!row?.id) return;
        if (!extendForm.requestedEndDate) {
            alert('Debes indicar una nueva fecha de devolución.');
            return;
        }
        if (!extendForm.reason.trim()) {
            alert('Debes explicar por qué necesitas más tiempo.');
            return;
        }

        setExtendSubmitting(true);
        try {
            const { error } = await supabase.rpc('request_general_request_extension', {
                p_request_id: row.id,
                p_requested_end_date: extendForm.requestedEndDate,
                p_reason: extendForm.reason.trim(),
            });
            if (error) throw error;

            const { data: admins } = await supabase
                .from('profiles')
                .select('id, role, department, status')
                .eq('status', true);

            const recipients = (admins || [])
                .filter((a) => {
                    const role = String(a?.role || '').toLowerCase().trim();
                    const dept = String(a?.department || '').toLowerCase().trim();
                    const isMaintArea = dept.includes('mantenimiento') || dept.includes('ingenieria') || dept.includes('ingeniería');
                    const itAdminRoles = ['admin', 'jefe_it', 'jefe_area_it', 'jefe area it'];
                    return itAdminRoles.includes(role) && !isMaintArea;
                })
                .map((a) => a?.id)
                .filter(Boolean);

            await Promise.all(
                recipients.map((recipientId) =>
                    workNotificationService.createNotification(
                        recipientId,
                        'Nueva apelación de préstamo',
                        `El usuario solicitó ampliar devolución de "${row.subject || 'Préstamo'}" hasta ${extendForm.requestedEndDate}.`
                    )
                )
            );

            setExtendModal({ open: false, row: null });
            setExtendForm({ requestedEndDate: '', reason: '' });
            await fetchRows();
        } catch (e) {
            console.error(e);
            alert(e.message || 'No se pudo enviar la apelación de prórroga.');
        } finally {
            setExtendSubmitting(false);
        }
    };

    if (!user) return null;

    const activeRows = rows.filter((r) => !['approved', 'delivered', 'returned'].includes((r.status || '').toLowerCase()));
    const resolvedRows = rows.filter((r) => ['approved', 'delivered', 'returned'].includes((r.status || '').toLowerCase()));

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Mis peticiones generales</h3>
                </div>
                <button type="button" onClick={fetchRows} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    Actualizar
                </button>
            </div>
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="p-6 text-center text-slate-500 text-sm">Cargando…</div>
                ) : rows.length === 0 ? (
                    <p className="p-6 text-center text-slate-500 text-sm">Aún no has enviado peticiones generales.</p>
                ) : (
                    <>
                        {activeRows.map((r) => (
                            <div
                                key={r.id}
                                className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40"
                            >
                                <div className="flex flex-wrap justify-between gap-2 items-start">
                                    <p className="font-black text-slate-900 dark:text-white text-sm">{r.subject}</p>
                                    <span
                                        className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${statusClass(r.status)}`}
                                    >
                                        {statusLabel(r.status)}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                                {r.is_loan && (
                                    <div className="mt-2 space-y-2">
                                        {r.loan_end_date && (
                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                                Devolver: {new Date(`${r.loan_end_date}T12:00:00`).toLocaleDateString()}
                                            </p>
                                        )}
                                        {extensionStatusLabel(r.extension_status) && (
                                            <span
                                                className={`inline-flex text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${extensionStatusClass(r.extension_status)}`}
                                            >
                                                {extensionStatusLabel(r.extension_status)}
                                            </span>
                                        )}
                                        {r.extension_status === 'rejected' && r.extension_reject_reason && (
                                            <p className="text-[11px] text-rose-700 dark:text-rose-300">
                                                Motivo rechazo prórroga: {r.extension_reject_reason}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {r.status === 'rejected' && r.reject_reason && (
                                    <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-900/40">
                                        <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 mb-1">
                                            Motivo de denegación
                                        </p>
                                        <p className="text-sm text-rose-800 dark:text-rose-200 font-medium whitespace-pre-wrap">
                                            {r.reject_reason}
                                        </p>
                                        <div className="mt-3 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRejected(r.id)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-rose-300 text-rose-700 bg-white hover:bg-rose-600 hover:text-white"
                                            >
                                                <Trash2 size={12} /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {canRequestExtension(r) && (
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => openExtensionModal(r)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-600 hover:text-white"
                                        >
                                            Solicitar prórroga
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {resolvedRows.length > 0 && (
                            <div className="mt-2 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/40 dark:bg-slate-800/30">
                                <button
                                    type="button"
                                    onClick={() => setShowResolvedHistory((v) => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3"
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Historial cerrado ({resolvedRows.length})
                                    </span>
                                    {showResolvedHistory ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </button>
                                {showResolvedHistory && (
                                    <div className="px-3 pb-3 space-y-2">
                                        {resolvedRows.map((r) => (
                                            <div key={r.id} className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-3 py-2.5 flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{r.subject}</p>
                                                    <p className="text-[10px] text-slate-500">{new Date(r.created_at).toLocaleString()}</p>
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${statusClass(r.status)}`}>
                                                    {statusLabel(r.status)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {extendModal.open && extendModal.row && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
                        <h4 className="font-black text-lg text-slate-900 dark:text-white">Apelar prórroga de préstamo</h4>
                        <p className="text-xs text-slate-500">
                            Solicita más tiempo para devolver: <strong>{extendModal.row.subject || 'Préstamo'}</strong>
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Nueva fecha de devolución</label>
                                <input
                                    type="date"
                                    value={extendForm.requestedEndDate}
                                    onChange={(e) => setExtendForm((prev) => ({ ...prev, requestedEndDate: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Motivo de la apelación</label>
                                <textarea
                                    rows={4}
                                    value={extendForm.reason}
                                    onChange={(e) => setExtendForm((prev) => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Ej. Aún estoy en pruebas de campo y necesito 2 días adicionales."
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setExtendModal({ open: false, row: null });
                                    setExtendForm({ requestedEndDate: '', reason: '' });
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitExtensionRequest}
                                disabled={extendSubmitting}
                                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white disabled:opacity-60"
                            >
                                {extendSubmitting ? 'Enviando...' : 'Enviar apelación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUBCOMPONENTE: Formulario de Nuevo Ticket ---
const NewTicketForm = ({ onCancel, onSuccess }) => {
    const { user, profile } = useAuth();

    const [myAssets, setMyAssets] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(true);
    const [showAltCategories, setShowAltCategories] = useState(false);

    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [selectedGenericDeviceType, setSelectedGenericDeviceType] = useState('Laptop');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState('Media');
    const [assetTag, setAssetTag] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const profileAssignedEquipment = (profile?.assigned_equipment || '').toString().trim();

    const genericDeviceTypes = [
        { id: 'Laptop', label: 'Laptop', icon: Laptop },
        { id: 'Monitor', label: 'Monitor', icon: Monitor },
        { id: 'Workstation', label: 'Workstation', icon: Cpu },
        { id: 'Phone', label: 'Teléfono', icon: Smartphone },
    ];

    useEffect(() => {
        let cancelled = false;
        const fetchMyAssets = async () => {
            if (!user?.id) return;
            setLoadingAssets(true);
            try {
                const { data, error: qErr } = await supabase
                    .from('assets')
                    .select('id, type, model, status, specs, assigned_to')
                    .or(`assigned_to.eq.${user.id},specs->>is_shared.eq.true`)
                    .order('created_at', { ascending: false });

                if (qErr) throw qErr;
                
                const userDept = (profile?.department || '').trim().toLowerCase();
                
                const filteredData = (data || []).filter(a => {
                    if (a.assigned_to === user.id) return true;
                    // Si es compartido, filtrarlo por el departamento del usuario para no saturar su UI
                    if (a.specs?.is_shared) {
                        const aDept = (a.specs?.department || '').trim().toLowerCase();
                        if (!userDept || !aDept) return true; // Mostrarlo como fallback
                        return aDept.includes(userDept) || userDept.includes(aDept);
                    }
                    return false;
                });

                const normalized = filteredData.map((a) => {
                    const s = a.specs || {};
                    const typeLabel = (a.type || s.category || s.asset_type || 'Equipo').toString();
                    const extraLabel = s.is_shared ? ` (Compartido en ${s.shared_area || s.department || 'Área'})` : '';
                    return {
                        id: a.id,
                        model: (a.model || s.model || '—') + extraLabel,
                        brand: (s.brand || '').trim(),
                        serial_number: String(s.serial_number || s.serial || '').trim(),
                        category: typeLabel,
                        status: a.status,
                    };
                });
                if (!cancelled) {
                    setMyAssets(normalized);
                    if (normalized.length > 0) {
                        const firstAsset = normalized[0];
                        setSelectedCategoryId((prev) => prev || firstAsset.id);
                        setAssetTag((prev) => prev || firstAsset.serial_number || String(firstAsset.id));
                    }
                    if (normalized.length === 1) {
                        const onlyAsset = normalized[0];
                        setSelectedCategoryId((prev) => prev || onlyAsset.id);
                        setAssetTag((prev) => prev || onlyAsset.serial_number || String(onlyAsset.id));
                    }
                    if (normalized.length === 0) {
                        setShowAltCategories(true);
                        setSelectedCategoryId((prev) => prev || 'category_otro_equipo');
                        setAssetTag((prev) => prev || profileAssignedEquipment);
                    }
                }
            } catch (err) {
                console.error('Error al cargar equipos del usuario:', err);
                if (!cancelled) {
                    setMyAssets([]);
                    setShowAltCategories(true);
                    setSelectedCategoryId((prev) => prev || 'category_otro_equipo');
                    setAssetTag((prev) => prev || profileAssignedEquipment);
                }
            } finally {
                if (!cancelled) setLoadingAssets(false);
            }
        };
        fetchMyAssets();
        return () => { cancelled = true; };
    }, [user, profileAssignedEquipment]);

    const handleCategorySelection = (selection) => {
        setSelectedGenericDeviceType('Laptop');
        if (typeof selection === 'object' && selection.id) {
            setSelectedCategoryId(selection.id);
            setAssetTag(selection.serial_number || String(selection.id));
            return;
        }
        setSelectedCategoryId(selection);
        if (selection === 'category_otro_equipo') setAssetTag('');
        else setAssetTag('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const effectiveCategoryId = selectedCategoryId || (myAssets.length === 0 ? 'category_otro_equipo' : null);
        if (!effectiveCategoryId) {
            setError('Selecciona uno de tus equipos o despliega “Otro tipo de incidencia”.');
            return;
        }

        if (!title.trim() || !description.trim()) {
            setError('El título y la descripción son obligatorios.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (user?.id === 'demo-user') {
                throw new Error('No puedes crear tickets reales en modo Demo.');
            }

            const urgencyMap = {
                Baja: 'low',
                Media: 'medium',
                Alta: 'high',
                Crítica: 'critical',
            };

            let finalDeviceType = 'Hardware';
            const assetRow = myAssets.find((a) => a.id === effectiveCategoryId);
            if (assetRow) {
                finalDeviceType = assetRow.category || 'Hardware';
            } else if (effectiveCategoryId === 'category_otro_equipo') {
                finalDeviceType = selectedGenericDeviceType;
            } else if (effectiveCategoryId === 'category_software') {
                finalDeviceType = 'Software';
            } else if (effectiveCategoryId === 'category_red') {
                finalDeviceType = 'Network';
            }

            const fullDescription = `[Dispositivo: ${finalDeviceType}]\n${assetTag.trim() ? `[Etiqueta/Serie: ${assetTag.trim()}]\n` : ''}${description.trim()}`;

            const newTicket = {
                title: title.trim(),
                description: fullDescription,
                urgency: urgencyMap[urgency] || 'medium',
                status: 'pending_admin',
                reported_by: user.id,
            };

            if (assetRow) {
                newTicket.asset_id = String(assetRow.id);
            }

            const finalAssetSerial = (assetRow?.serial_number || assetTag || profileAssignedEquipment || '').toString().trim();
            if (finalAssetSerial) {
                newTicket.asset_serial_number = finalAssetSerial;
            }

            const res = await ticketService.create(newTicket);

            if (!res) throw new Error('Ocurrió un error al guardar el reporte.');

            if (onSuccess) onSuccess();
            else onCancel();
        } catch (err) {
            console.error(err);
            setError(err.message || 'Ocurrió un error al guardar el reporte.');
        } finally {
            setLoading(false);
        }
    };

    const getAssetIcon = (category) => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('monitor')) return <Monitor className="w-6 h-6" strokeWidth={2} />;
        if (cat.includes('laptop')) return <Laptop className="w-6 h-6" strokeWidth={2} />;
        if (cat.includes('teléfono') || cat.includes('celular') || cat.includes('phone')) return <Smartphone className="w-6 h-6" strokeWidth={2} />;
        if (cat.includes('dock')) return <Cable className="w-6 h-6" strokeWidth={2} />;
        if (cat.includes('teclado')) return <Keyboard className="w-6 h-6" strokeWidth={2} />;
        if (cat.includes('mouse')) return <MousePointer2 className="w-6 h-6" strokeWidth={2} />;
        if (cat.includes('workstation') || cat.includes('desktop') || cat.includes('pc')) return <Cpu className="w-6 h-6" strokeWidth={2} />;
        return <Cpu className="w-6 h-6" strokeWidth={2} />;
    };

    const selectedAsset = myAssets.find((a) => a.id === selectedCategoryId);
    const isAssignedAssetSelected = !!selectedAsset;
    const isSingleAssignedAsset = myAssets.length === 1 && !!selectedAsset;
    const showGenericIcons = selectedCategoryId === 'category_otro_equipo';
    const showAssetTagInput = selectedCategoryId === 'category_otro_equipo' || isAssignedAssetSelected;

    return (
        <div className="rounded-[2.5rem] border border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.18)] dark:shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all">
            <div className="p-8 border-b border-slate-200/50 dark:border-slate-800/80 bg-gradient-to-r from-slate-50/90 via-white/40 to-blue-50/30 dark:from-slate-900/90 dark:via-slate-900/50 dark:to-blue-950/20 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/30 ring-2 ring-white/30 dark:ring-slate-800/50">
                        <Sparkles size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-950 dark:text-white text-xl tracking-tight">Reportar Falla Técnica</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {myAssets.length > 0
                                ? `Equipo detectado en inventario: ${myAssets.length} asignado(s).`
                                : 'Sin equipo visible en inventario. Puedes reportar por categoría alterna.'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onCancel}
                    className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800 rounded-2xl transition-all duration-200"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="p-8 sm:p-10">
                <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto">
                    {error && (
                        <div className="bg-red-500/10 text-red-700 dark:text-red-300 p-4 rounded-2xl text-sm font-bold border border-red-200/60 dark:border-red-900/40 flex items-center gap-2 animate-in fade-in duration-200">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="flex items-center gap-2 ml-1">
                            <div className="h-1 w-8 rounded-full bg-blue-600" />
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">1. Tu equipo en inventario</label>
                        </div>

                        {isSingleAssignedAsset && (
                            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/10 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">Equipo preasignado detectado</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {selectedAsset?.brand ? `${selectedAsset.brand} · ` : ''}{selectedAsset?.model || 'Equipo'}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">S/N: {selectedAsset?.serial_number || selectedAsset?.id || 'N/A'}</p>
                            </div>
                        )}

                        {!isSingleAssignedAsset && isAssignedAssetSelected && (
                            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/10 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-1">Equipo seleccionado</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {selectedAsset?.brand ? `${selectedAsset.brand} · ` : ''}{selectedAsset?.model || 'Equipo'}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">S/N: {selectedAsset?.serial_number || selectedAsset?.id || 'N/A'}</p>
                            </div>
                        )}

                        {!isSingleAssignedAsset && (
                            <>
                        {loadingAssets ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Cargando equipos asignados">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="h-[5.5rem] rounded-3xl bg-gradient-to-br from-slate-100/90 to-slate-200/30 dark:from-slate-800/80 dark:to-slate-900/40 animate-pulse border border-white/50 dark:border-slate-700/40"
                                    />
                                ))}
                            </div>
                        ) : myAssets.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-8 text-center">
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">No hay equipos asignados a tu usuario en inventario.</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Si deberías ver equipos aquí, contacta a TI.</p>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-4">Activamos modo alterno para que puedas crear tu reporte sin bloqueo.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAltCategories(true);
                                        setSelectedCategoryId((prev) => prev || 'category_otro_equipo');
                                    }}
                                    className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Otro tipo de incidencia
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {myAssets.map((asset) => (
                                    <button
                                        key={asset.id}
                                        type="button"
                                        onClick={() => handleCategorySelection(asset)}
                                        className={`group flex items-center text-left gap-4 p-5 rounded-3xl border-2 transition-all duration-300 ease-out ${selectedCategoryId === asset.id
                                            ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15 text-blue-900 dark:text-blue-100 shadow-lg shadow-blue-500/10 scale-[1.01]'
                                            : 'border-slate-200/80 dark:border-slate-700/80 bg-white/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:border-blue-300/80 dark:hover:border-blue-600/50 hover:shadow-md'
                                            }`}
                                    >
                                        <div className={`p-3.5 rounded-2xl transition-colors duration-300 ${selectedCategoryId === asset.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                                            {getAssetIcon(asset.category)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">{asset.category}</p>
                                            <p className="text-sm font-black truncate text-slate-900 dark:text-white">
                                                {asset.brand ? `${asset.brand} · ` : ''}{asset.model}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 truncate mt-1">
                                                S/N: {asset.serial_number || 'N/A'}
                                            </p>
                                        </div>
                                        {selectedCategoryId === asset.id && <CheckCircle2 size={20} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}
                            </>
                        )}

                        {!isSingleAssignedAsset && (
                            <button
                                type="button"
                                onClick={() => setShowAltCategories((v) => !v)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700 bg-white/40 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all duration-200"
                            >
                                <ChevronDown size={16} className={`transition-transform duration-200 ${showAltCategories ? 'rotate-180' : ''}`} />
                                {showAltCategories ? 'Ocultar otras incidencias' : 'Otro tipo de incidencia (software, red, equipo no listado)'}
                            </button>
                        )}

                        {!isSingleAssignedAsset && showAltCategories && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 rounded-3xl border border-slate-200/60 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-800/30 p-5 backdrop-blur-sm">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 ml-1 block">Software, red u otro hardware</span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleCategorySelection('category_otro_equipo')}
                                        className={`flex items-center text-left gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${selectedCategoryId === 'category_otro_equipo'
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10 shadow-md'
                                            : 'border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`p-2.5 rounded-xl ${selectedCategoryId === 'category_otro_equipo' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            <Monitor size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black truncate">Otro equipo</p>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">No está en tu lista</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCategorySelection('category_software')}
                                        className={`flex items-center text-left gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${selectedCategoryId === 'category_software'
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10 shadow-md'
                                            : 'border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`p-2.5 rounded-xl ${selectedCategoryId === 'category_software' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            <Settings size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black truncate">Software</p>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Apps y licencias</p>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleCategorySelection('category_red')}
                                        className={`flex items-center text-left gap-3 p-4 rounded-2xl border-2 transition-all duration-300 ${selectedCategoryId === 'category_red'
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10 shadow-md'
                                            : 'border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`p-2.5 rounded-xl ${selectedCategoryId === 'category_red' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            <Wifi size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black truncate">Red / Internet</p>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">VPN, correo, WiFi</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {showGenericIcons && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 rounded-3xl border border-slate-200/60 dark:border-slate-700 bg-white/50 dark:bg-slate-800/30 p-6 backdrop-blur-sm">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Tipo de dispositivo</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {genericDeviceTypes.map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setSelectedGenericDeviceType(type.id)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 ${selectedGenericDeviceType === type.id
                                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200'
                                            : 'border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        <type.icon size={22} strokeWidth={selectedGenericDeviceType === type.id ? 2.5 : 2} />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- Detalles del Reporte --- */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group space-y-2">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Título del Problema</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: La pantalla parpadea"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-5 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 dark:focus:border-blue-500 transition-all font-medium text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>

                            {/* NUEVO: Ocultar o Bloquear el Asset Tag automáticamente */}
                            {showAssetTagInput && (
                                <div className="group space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                                        ID de Activo / Serie {isAssignedAssetSelected && '(Autocompletado)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={assetTag}
                                        onChange={(e) => setAssetTag(e.target.value)}
                                        readOnly={isAssignedAssetSelected} // Bloquear si es equipo asignado
                                        placeholder={selectedCategoryId === 'category_otro_equipo' ? "Opcional (Ej. MEX-IMP-001)" : "Selecciona un equipo arriba"}
                                        className={`w-full border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-5 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 dark:focus:border-blue-500 transition-all font-medium text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 ${isAssignedAssetSelected
                                                ? 'bg-slate-100 dark:bg-slate-900/80 opacity-70 cursor-not-allowed' // Estilo bloqueado
                                                : 'bg-slate-50 dark:bg-slate-800'
                                            }`}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Nivel de Urgencia</label>
                            <div className="flex gap-2">
                                {['Baja', 'Media', 'Alta', 'Crítica'].map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setUrgency(level)}
                                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${urgency === level
                                            ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500 shadow-md shadow-blue-500/20'
                                            : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="group space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Descripción Detallada</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Explique paso a paso el problema..."
                                rows="3"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-5 py-4 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-600 dark:focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium text-sm resize-none"
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-8 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] bg-slate-950 dark:bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 dark:shadow-blue-900/20 hover:bg-blue-600 dark:hover:bg-blue-500 hover:shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Send size={18} />
                            )}
                            Crear Reporte IT
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- SUBCOMPONENTE: Lista de Tickets del Usuario ---
const UserTicketList = ({ tickets, onTicketClick }) => {
    return (
        <div className="space-y-4">
            {tickets.map((ticket) => (
                <div 
                    key={ticket.id} 
                    onClick={() => onTicketClick && onTicketClick(ticket)}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group bg-slate-50/30 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                                #{ticket.shortId}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight text-sm">
                                    {ticket.issue}
                                </h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ticket.date}</span>
                                    <span className="text-[10px] text-slate-300">•</span>
                                    <span className="text-[10px] text-slate-500 font-medium">Técnico: {ticket.tech}</span>
                                </div>
                                {ticket.scheduled_for && ticket.status !== 'resolved' && (
                                    <p className="text-[10px] mt-1 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest">
                                        Atención: {new Date(ticket.scheduled_for).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                        <TicketStatusBadge status={ticket.status} withIcon size="sm" />
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL: Portal de Usuario ---
const UserPortal = () => {
    const { user, profile } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [currentView, setCurrentView] = useState('Dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [myTickets, setMyTickets] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [stats, setStats] = useState({ open: 0, pending: 0, resolved: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [termsType, setTermsType] = useState('terms');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        const requestedView = searchParams.get('view');
        if (!requestedView) return;
        setCurrentView(requestedView);
    }, [searchParams]);

    const handleSelectView = (item) => {
        setCurrentView(item);
        setIsSidebarOpen(false);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('view', item);
        if (item !== 'Tickets') nextParams.delete('ticketId');
        setSearchParams(nextParams, { replace: true });
    };

    const toUIStatus = (status, assignedTech) => {
        const s = (status || '').toLowerCase();
        if (s === 'open') return 'pending_admin';
        if (s === 'pending') return assignedTech ? 'in_progress' : 'assigned';
        if (s === 'resolved') return 'resolved';
        return status;
    };

    const fetchMyTickets = async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('reported_by', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const users = await userService.getAll();
            const userMap = users.reduce((acc, u) => {
                acc[u.id] = u;
                return acc;
            }, {});

            let open = 0;
            let pending = 0;
            let resolved = 0;
            const formattedTickets = data.map((t) => {
                const uiStatus = toUIStatus(t.status, t.assigned_tech);
                if (uiStatus === 'pending_admin') open += 1;
                if (uiStatus === 'assigned' || uiStatus === 'in_progress') pending += 1;
                if (uiStatus === 'resolved') resolved += 1;

                const techUser = t.assigned_tech ? userMap[t.assigned_tech] : null;

                return {
                    id: t.id,
                    fullId: t.id,
                    displayId: String(t.id).substring(0, 8).toUpperCase(),
                    shortId: String(t.id).substring(0, 4),
                    issue: t.title,
                    tech: techUser ? techUser.full_name : 'Sin Asignar',
                    reportedBy: profile?.full_name || user.email || 'Desconocido',
                    status: uiStatus,
                    assigned_tech: t.assigned_tech,
                    scheduled_for: t.scheduled_for || null,
                    date: new Date(t.created_at).toLocaleDateString(),
                };
            });

            setStats({ open, pending, resolved });
            setMyTickets(formattedTickets);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoadingData(false);
        }
    };

    React.useEffect(() => {
        if (currentView === 'Tickets' || currentView === 'Dashboard') {
            fetchMyTickets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentView, user]);

    const filteredMyTickets = React.useMemo(() => {
        if (!searchTerm) return myTickets;
        const s = searchTerm.toLowerCase();
        return myTickets.filter(t =>
            (t.displayId && t.displayId.toLowerCase().includes(s)) ||
            (t.issue && t.issue.toLowerCase().includes(s)) ||
            (t.status && t.status.toLowerCase().includes(s)) ||
            (t.tech && t.tech.toLowerCase().includes(s))
        );
    }, [myTickets, searchTerm]);

    const menuItems = [
        { name: 'Inicio', icon: LayoutDashboard, id: 'Dashboard' },
        { name: 'Mis Actividades', icon: History, id: 'Tickets' },
        { name: 'Peticiones Generales', icon: FileText, id: 'NewRequest' },
        { name: 'Agenda', icon: CalendarIcon, id: 'Agenda' },
        { name: 'Noticias IT', icon: Sparkles, id: 'Assistant' },
    ];

    const formatCount = (count) => count < 10 ? `0${count}` : `${count}`;

    const renderView = () => {
        switch (currentView) {
            case 'NewTicket':
                return <NewTicketForm onCancel={() => setCurrentView('Dashboard')} onSuccess={() => setCurrentView('Tickets')} />;
            case 'NewRequest':
                return <GeneralRequestForm onCancel={() => setCurrentView('Dashboard')} onSuccess={() => setCurrentView('Dashboard')} />;
            case 'Agenda':
                return <UserAgenda />;
            case 'Assistant':
                return <UserSupportBot />;
            case 'Tickets':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Historial de Reportes</h3>
                                </div>
                                <button onClick={fetchMyTickets} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">Refrescar</button>
                            </div>
                            <div className="p-4">
                                {loadingData ? (
                                    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        Cargando desde la nube...
                                    </div>
                                ) : filteredMyTickets.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                                        No hay reportes que coincidan con la búsqueda.
                                    </div>
                                ) : (
                                    <UserTicketList 
                                        tickets={filteredMyTickets} 
                                        onTicketClick={(t) => setSelectedTicket({ ...t, fullId: t.id })}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'Dashboard':
            default:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Prominent Action Card */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                            {/* Decorative graphics */}
                            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                            <div className="absolute bottom-[-10%] left-[-5%] w-32 h-32 bg-blue-400/20 rounded-full blur-2xl group-hover:bg-blue-400/30 transition-all duration-700"></div>

                            <div className="relative z-10 space-y-3 text-center md:text-left">
                                <h2 className="text-3xl font-black tracking-tight">¿Tienes un problema técnico?</h2>
                                <p className="text-blue-100 font-medium max-w-md">Estamos listos para ayudarte. Crea un reporte detallado y nuestro equipo de TI lo resolverá a la brevedad.</p>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                                        <Clock size={12} />
                                        SLA: 4 Horas
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                                        <CheckCircle size={12} />
                                        Soporte de Lunes a Viernes de 8:00 AM a 6:00 PM
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => setCurrentView('NewTicket')}
                                    className="bg-white text-blue-600 px-8 py-4 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-slate-900 hover:text-white transition-all hover:-translate-y-2 active:scale-95 flex items-center gap-3 group/btn"
                                >
                                    <FilePlus size={18} className="group-hover/btn:rotate-12 transition-transform" />
                                    Reportar Falla
                                </button>
                                <button
                                    onClick={() => setCurrentView('NewRequest')}
                                    className="bg-blue-500/20 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-white hover:text-blue-600 transition-all hover:-translate-y-2 active:scale-95 flex items-center gap-3 group/btn"
                                >
                                    <FileText size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    Peticiones Generales
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Abiertos" value={formatCount(stats.open)} trend="" icon={AlertCircle} color="text-red-500" bg="bg-red-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="En Proceso" value={formatCount(stats.pending)} trend="" icon={Clock} color="text-amber-500" bg="bg-amber-500/10" />
                            </div>
                            <div className="group transition-transform hover:-translate-y-1">
                                <StatCard label="Resueltos" value={formatCount(stats.resolved)} trend="" icon={CheckCircle} color="text-emerald-500" bg="bg-emerald-500/10" />
                            </div>
                        </div>

                        <MyGeneralRequestsPanel />

                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden transition-colors">
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Historial de Reportes</h3>
                                </div>
                                <button onClick={fetchMyTickets} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">Refrescar</button>
                            </div>
                            <div className="p-4">
                                {loadingData ? (
                                    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        Cargando desde la nube...
                                    </div>
                                ) : filteredMyTickets.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                                        No hay reportes que coincidan con la búsqueda.
                                    </div>
                                ) : (
                                    <UserTicketList 
                                        tickets={filteredMyTickets} 
                                        onTicketClick={(t) => setSelectedTicket({ ...t, fullId: t.id })}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex min-h-screen bg-[#fcfdfe] dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans transition-colors duration-300">

            {/* Overlay en móvil */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar como drawer en móvil */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-40
                transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                {/* User Sidebar - Premium Dark Design */}
                <aside className="w-64 bg-slate-950 flex flex-col h-screen overflow-hidden sticky top-0 z-20">
                    {/* Decorative Background for Sidebar */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                        <div className="absolute top-[-20%] left-[-20%] w-full h-[60%] bg-blue-600/30 rounded-full blur-[80px]"></div>
                    </div>

                    <div className="relative p-7 flex items-center gap-3 border-b border-white/5">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <TicketIcon size={22} strokeWidth={2.5} />
                        </div>
                        <span className="font-black text-xl text-white tracking-tight">IT Helpdesk<span className="text-blue-500">.</span></span>
                    </div>

                    <nav className="relative flex-1 py-8 px-4 space-y-2">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-3">Principal</div>
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleSelectView(item.id)}
                                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${currentView === item.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white font-medium'
                                    }`}
                            >
                                <item.icon size={20} className={`${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`} />
                                <span className="text-sm">{item.name}</span>
                                {currentView === item.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
                            </button>
                        ))}
                    </nav>

                    <div className="relative p-6 mt-auto">
                        <div className="bg-white/5 rounded-3xl p-4 border border-white/5 backdrop-blur-sm">
                            {(profile?.role === 'admin' || profile?.role === 'tech') && (
                                <div className="flex items-center gap-3 mb-4 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all" onClick={() => setIsSettingsOpen(true)}>
                                    <div className="bg-blue-500/20 p-2 rounded-xl">
                                        <Settings size={18} className="text-blue-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white">Configuración</span>
                                        <span className="text-[10px] text-slate-400">Alertas de WhatsApp</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-slate-500/20 p-2 rounded-xl">
                                    <AlertCircle size={18} className="text-slate-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white">¿Ayuda?</span>
                                    <span className="text-[10px] text-slate-400">Ext:9026 </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
                                <button onClick={() => { setTermsType('terms'); setIsTermsOpen(true); }} className="text-left text-[10px] text-slate-400 hover:text-white transition-colors font-medium">Términos de Servicio</button>
                                <button onClick={() => { setTermsType('privacy'); setIsTermsOpen(true); }} className="text-left text-[10px] text-slate-400 hover:text-white transition-colors font-medium">Política de Privacidad</button>
                            </div>

                        </div>
                    </div>
                </aside>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <Header
                    onMenuClick={() => setIsSidebarOpen(true)}
                    userName={profile?.full_name || user?.email || "Usuario"}
                    userType={profile?.role || "Operativo"}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                />

                <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full">

                    <div className="relative">
                        {renderView()}
                    </div>
                </main>
            </div>

            <TermsModal
                isOpen={isTermsOpen}
                onClose={() => setIsTermsOpen(false)}
                type={termsType}
            />

            <TicketDetailSlider
                ticket={selectedTicket}
                isOpen={!!selectedTicket}
                onClose={() => setSelectedTicket(null)}
                onUpdateTicket={async (ticketId, updates) => {
                    const data = await ticketService.update(ticketId, updates, user?.id);
                    await fetchMyTickets();
                    if (selectedTicket && String(selectedTicket.id) === String(ticketId)) {
                        setSelectedTicket((prev) => ({
                            ...prev,
                            ...(updates.scheduled_for !== undefined && {
                                scheduled_for: data?.scheduled_for ?? updates.scheduled_for,
                            }),
                            ...(updates.status !== undefined && { status: data?.status ?? updates.status }),
                            ...(updates.assigned_tech !== undefined && {
                                assigned_tech: data?.assigned_tech ?? updates.assigned_tech,
                            }),
                        }));
                    }
                }}
            />

            <ProfileSettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </div>
    );
};

export default UserPortal;
