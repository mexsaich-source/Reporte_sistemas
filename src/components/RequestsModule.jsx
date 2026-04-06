import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Check, X, AlertCircle, Package } from 'lucide-react';
import { useAuth } from '../context/authStore';
import { inventoryService } from '../services/inventoryService';
import { ticketService } from '../services/ticketService';
import { workNotificationService } from '../services/workNotificationService';

const RequestsModule = ({ searchTerm = '' }) => {
    const [tab, setTab] = useState('general');
    const [requests, setRequests] = useState([]);
    const [equipmentReqs, setEquipmentReqs] = useState([]);
    const [profileMap, setProfileMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const { user, profile } = useAuth();
    const actorName = profile?.full_name || user?.email || 'Administrador';

    const [rejectModal, setRejectModal] = useState({ open: false, type: null, row: null });
    const [rejectReason, setRejectReason] = useState('');

    const [approveLoanModal, setApproveLoanModal] = useState({ open: false, row: null });
    const [loanForm, setLoanForm] = useState({ loan_start_date: '', loan_end_date: '' });
    const [extensionReviewModal, setExtensionReviewModal] = useState({ open: false, row: null });
    const [extensionReviewForm, setExtensionReviewForm] = useState({ decision: 'approve', reviewedEndDate: '', rejectReason: '' });

    const [approveEquipModal, setApproveEquipModal] = useState({ open: false, row: null });
    const [equipForm, setEquipForm] = useState({ brand: '', model: '', serial: '' });

    const loadAll = async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const [g, e] = await Promise.all([
                supabase
                    .from('general_requests')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('equipment_requests')
                    .select('*')
                    .order('created_at', { ascending: false }),
            ]);
            if (g.error) throw g.error;
            if (e.error) throw e.error;
            setRequests(g.data || []);
            setEquipmentReqs(e.data || []);

            const allUserIds = [
                ...new Set([
                    ...(g.data || []).map((r) => r.user_id).filter(Boolean),
                    ...(e.data || []).map((r) => r.user_id).filter(Boolean),
                ]),
            ];

            if (allUserIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, department')
                    .in('id', allUserIds);

                if (profilesError) {
                    console.warn('No se pudieron cargar perfiles relacionados:', profilesError);
                } else {
                    setProfileMap(
                        (profilesData || []).reduce((acc, p) => {
                            acc[p.id] = p;
                            return acc;
                        }, {})
                    );
                }
            } else {
                setProfileMap({});
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            setLoadError(error.message || 'Error fetching requests from Supabase');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        const ch = supabase
            .channel('admin_requests_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'general_requests' }, () => {
                loadAll();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_requests' }, () => {
                loadAll();
            })
            .subscribe();
        return () => {
            supabase.removeChannel(ch);
        };
    }, []);

    const filteredGeneral = useMemo(() => {
        if (!searchTerm) return requests;
        const s = searchTerm.toLowerCase();
        return requests.filter((req) =>
            [req.subject, req.first_name, req.last_name, req.department, req.reason, req.status]
                .some((f) => f && String(f).toLowerCase().includes(s))
        );
    }, [requests, searchTerm]);

    const filteredEquipment = useMemo(() => {
        if (!searchTerm) return equipmentReqs;
        const s = searchTerm.toLowerCase();
        return equipmentReqs.filter((req) =>
            [
                req.equipment_type,
                req.reason,
                req.status,
                profileMap[req.user_id]?.full_name,
                profileMap[req.user_id]?.email,
            ]
                .some((f) => f && String(f).toLowerCase().includes(s))
        );
    }, [equipmentReqs, profileMap, searchTerm]);

    const notifyUser = async (userId, title, message) => {
        if (!userId) return;
        await workNotificationService.createNotification(userId, title, message);
    };

    const openApproveLoan = (row) => {
        const today = new Date().toISOString().slice(0, 10);
        setLoanForm({
            loan_start_date: row?.loan_start_date || today,
            loan_end_date: row?.loan_end_date || ''
        });
        setApproveLoanModal({ open: true, row });
    };

    const confirmBorrowLoan = async () => {
        const row = approveLoanModal.row;
        if (!row?.id) return;
        if (!loanForm.loan_end_date) {
            alert('La fecha de devolucion es obligatoria para prestamos.');
            return;
        }

        try {
            const patch = {
                status: 'borrowed',
                loan_start_date: loanForm.loan_start_date || new Date().toISOString().slice(0, 10),
                loan_end_date: loanForm.loan_end_date,
                reject_reason: null,
                extension_requested_end_date: null,
                extension_reason: null,
                extension_status: null,
                extension_requested_at: null,
                extension_reviewed_at: null,
                extension_reject_reason: null,
            };

            const { error } = await supabase
                .from('general_requests')
                .update(patch)
                .eq('id', row.id);

            if (error) throw error;

            await notifyUser(
                row.user_id,
                'Prestamo aprobado',
                `Tu solicitud "${row.subject || 'Prestamo'}" fue aprobada como prestada. Fecha limite de devolucion: ${loanForm.loan_end_date}.`
            );

            setApproveLoanModal({ open: false, row: null });
            await loadAll();
        } catch (err) {
            console.error(err);
            alert(err.message || 'No se pudo aprobar el prestamo.');
        }
    };

    const markLoanAsReturned = async (row) => {
        if (!row?.id) return;
        try {
            const { error } = await supabase
                .from('general_requests')
                .update({ status: 'returned' })
                .eq('id', row.id);
            if (error) throw error;

            await notifyUser(
                row.user_id,
                'Prestamo devuelto',
                `Se confirmo la devolucion de tu solicitud "${row.subject || 'Prestamo'}".`
            );

            await loadAll();
        } catch (err) {
            console.error(err);
            alert(err.message || 'No se pudo marcar como devuelto.');
        }
    };

    const openExtensionReview = (row) => {
        setExtensionReviewForm({
            decision: 'approve',
            reviewedEndDate: row?.extension_requested_end_date || row?.loan_end_date || '',
            rejectReason: ''
        });
        setExtensionReviewModal({ open: true, row });
    };

    const handleExtensionDecision = async () => {
        const row = extensionReviewModal.row;
        if (!row?.id) return;

        const isApprove = extensionReviewForm.decision === 'approve';
        if (isApprove && !extensionReviewForm.reviewedEndDate) {
            alert('Debes indicar la nueva fecha de devolución.');
            return;
        }
        if (!isApprove && !extensionReviewForm.rejectReason.trim()) {
            alert('Debes indicar motivo de rechazo de la prórroga.');
            return;
        }

        try {
            const patch = isApprove
                ? {
                    loan_end_date: extensionReviewForm.reviewedEndDate,
                    extension_status: 'approved',
                    extension_reviewed_at: new Date().toISOString(),
                    extension_reject_reason: null,
                }
                : {
                    extension_status: 'rejected',
                    extension_reviewed_at: new Date().toISOString(),
                    extension_reject_reason: extensionReviewForm.rejectReason.trim(),
                };

            const { error } = await supabase
                .from('general_requests')
                .update(patch)
                .eq('id', row.id)
                .eq('extension_status', 'pending');

            if (error) throw error;

            await notifyUser(
                row.user_id,
                isApprove ? 'Prórroga aprobada' : 'Prórroga rechazada',
                isApprove
                    ? `Tu apelación de préstamo "${row.subject || 'Préstamo'}" fue aprobada. Nueva devolución: ${extensionReviewForm.reviewedEndDate}.`
                    : `Tu apelación de préstamo "${row.subject || 'Préstamo'}" fue rechazada. Motivo: ${extensionReviewForm.rejectReason.trim()}`
            );

            setExtensionReviewModal({ open: false, row: null });
            setExtensionReviewForm({ decision: 'approve', reviewedEndDate: '', rejectReason: '' });
            await loadAll();
        } catch (err) {
            console.error(err);
            alert(err.message || 'No se pudo procesar la apelación de prórroga.');
        }
    };

    const handleGeneralStatus = async (id, newStatus, reasonText = '') => {
        try {
            const { data: reqRow, error: preErr } = await supabase
                .from('general_requests')
                .select('id,user_id,subject,status')
                .eq('id', id)
                .single();
            if (preErr) throw preErr;

            const patch = { status: newStatus };
            if (newStatus === 'rejected') {
                if (!reasonText.trim()) {
                    alert('Debes indicar la razón de rechazo.');
                    return;
                }
                patch.reject_reason = reasonText.trim();
            }

            const { error } = await supabase.from('general_requests').update(patch).eq('id', id);
            if (error) throw error;

            const statusLabel =
                newStatus === 'approved'
                    ? 'Aprobado'
                    : newStatus === 'rejected'
                      ? 'Denegada'
                      : newStatus === 'delivered'
                        ? 'Entregado'
                        : 'Actualizado';

            if (reqRow?.user_id) {
                let msg = `${actorName} marcó tu solicitud "${reqRow.subject || 'Solicitud'}" como ${statusLabel}.`;
                if (newStatus === 'rejected') {
                    msg = `Tu solicitud "${reqRow.subject || 'Solicitud'}" fue denegada. Motivo: ${reasonText.trim()}`;
                }
                await notifyUser(reqRow.user_id, 'Actualización de solicitud', msg);
            }

            await loadAll();
        } catch (error) {
            console.error('Error updating general request:', error);
            alert('Error al actualizar: ' + error.message);
        }
    };

    const openRejectGeneral = (row) => {
        setRejectModal({ open: true, type: 'general', row });
        setRejectReason('');
    };

    const confirmRejectGeneral = async () => {
        if (!rejectReason.trim()) {
            alert('La razón de rechazo es obligatoria.');
            return;
        }
        await handleGeneralStatus(rejectModal.row.id, 'rejected', rejectReason);
        setRejectModal({ open: false, type: null, row: null });
    };

    const handleGeneralAcceptDeliver = async (id) => {
        try {
            const { data: full, error: fe } = await supabase.from('general_requests').select('*').eq('id', id).single();
            if (fe || !full) throw fe || new Error('No se encontró la solicitud.');

            if (full.is_loan) {
                openApproveLoan(full);
                return;
            }

            const { error: ue } = await supabase.from('general_requests').update({ status: 'delivered' }).eq('id', id);
            if (ue) throw ue;

            const newTicket = await ticketService.create({
                title: `Asignación: ${full.subject || 'Solicitud general'}`,
                description: `Petición general #${full.id}\n\nMotivo:\n${full.reason || '—'}\n\nObservaciones:\n${full.observations || '—'}`,
                urgency: 'medium',
                status: 'pending_admin',
                reported_by: full.user_id,
            });
            if (!newTicket?.id) throw new Error('No se pudo crear el ticket de asignación.');

            if (full.user_id) {
                await notifyUser(
                    full.user_id,
                    'Solicitud aceptada',
                    `Tu solicitud "${full.subject || 'Solicitud'}" fue aceptada y marcada como entregada. Ticket de seguimiento #${newTicket.id}.`
                );
            }
            await loadAll();
        } catch (e) {
            console.error(e);
            alert(e.message || 'Error al aceptar la solicitud.');
        }
    };

    const handleEquipmentApproveDeliver = async () => {
        const row = approveEquipModal.row;
        if (!row?.user_id) return;
        if (!equipForm.brand.trim() || !equipForm.model.trim() || !equipForm.serial.trim()) {
            alert('Marca, modelo y número de serie son obligatorios para registrar el activo.');
            return;
        }
        try {
            const created = await inventoryService.add({
                type: row.equipment_type || 'Equipment',
                model: equipForm.model.trim(),
                brand: equipForm.brand.trim(),
                serial: equipForm.serial.trim(),
                status: 'in_use',
                assignedTo: row.user_id,
                category: row.equipment_type || 'Hardware',
                specsDetails: `Entregado por solicitud #${row.id}. ${row.reason || ''}`.slice(0, 500),
            });
            if (!created?.id) throw new Error('No se pudo crear el activo en inventario.');

            const { error } = await supabase
                .from('equipment_requests')
                .update({
                    status: 'delivered',
                    delivered_at: new Date().toISOString(),
                    assigned_asset_id: String(created.id),
                    reject_reason: null,
                })
                .eq('id', row.id);
            if (error) throw error;

            await notifyUser(
                row.user_id,
                'Equipo entregado',
                `Tu solicitud de ${row.equipment_type || 'equipo'} fue aprobada y registrada (activo ${created.id}).`
            );
            setApproveEquipModal({ open: false, row: null });
            setEquipForm({ brand: '', model: '', serial: '' });
            await loadAll();
        } catch (e) {
            console.error(e);
            alert(e.message || 'Error al aprobar y entregar.');
        }
    };

    const openRejectEquipment = (row) => {
        setRejectModal({ open: true, type: 'equipment', row });
        setRejectReason('');
    };

    const confirmRejectEquipment = async () => {
        if (!rejectReason.trim()) {
            alert('La razón de rechazo es obligatoria.');
            return;
        }
        const row = rejectModal.row;
        try {
            const { error } = await supabase
                .from('equipment_requests')
                .update({ status: 'rejected', reject_reason: rejectReason.trim() })
                .eq('id', row.id);
            if (error) throw error;
            await notifyUser(
                row.user_id,
                'Solicitud de equipo rechazada',
                `Tu solicitud de ${row.equipment_type || 'equipo'} no fue aprobada. Motivo: ${rejectReason.trim()}`
            );
            setRejectModal({ open: false, type: null, row: null });
            await loadAll();
        } catch (e) {
            alert(e.message || 'Error al rechazar.');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'approved':
                return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'rejected':
                return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
            case 'borrowed':
                return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
            case 'returned':
                return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'overdue':
                return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            case 'delivered':
                return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            default:
                return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        }
    };

    const getStatusLabel = (status, kind = 'general') => {
        switch (status) {
            case 'approved':
                return 'Aprobado';
            case 'rejected':
                return kind === 'general' ? 'Denegada' : 'Rechazada';
            case 'borrowed':
                return 'Prestado';
            case 'returned':
                return 'Devuelto';
            case 'overdue':
                return 'Vencido';
            case 'delivered':
                return 'Entregado';
            default:
                return 'Pendiente';
        }
    };

    return (
        <div className="space-y-6 relative">
            {loadError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-100">
                    <strong>Error:</strong> {loadError}. Revisa la conexión con Supabase o las políticas RLS.
                </div>
            )}
            <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit">
                <button
                    type="button"
                    onClick={() => setTab('general')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        tab === 'general'
                            ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    Peticiones generales
                </button>
                <button
                    type="button"
                    onClick={() => setTab('equipment')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                        tab === 'equipment'
                            ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Package size={14} /> Equipo / insumos
                </button>
            </div>

            {tab === 'general' && (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-800">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Solicitudes generales</h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                            Aceptar entrega y crea ticket de asignación; denegar exige motivo
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] text-left">
                                    <th className="p-6 pb-4">Usuario</th>
                                    <th className="p-6 pb-4">Asunto</th>
                                    <th className="p-6 pb-4">Estado</th>
                                    <th className="p-6 pb-4">Fecha</th>
                                    <th className="p-6 pb-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="p-20 text-center">
                                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : filteredGeneral.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-16 text-center text-slate-400 font-bold uppercase text-xs">
                                            No hay solicitudes
                                        </td>
                                    </tr>
                                ) : (
                                    filteredGeneral.map((req) => (
                                        <tr
                                            key={req.id}
                                            className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                        >
                                            <td className="p-6">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {req.first_name} {req.last_name}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{req.department}</p>
                                            </td>
                                            <td className="p-6 max-w-xs">
                                                <p className="font-bold text-slate-700 dark:text-slate-200 line-clamp-2">{req.subject}</p>
                                                {req.is_loan && (
                                                    <p className="text-[10px] text-indigo-600 mt-1 font-bold uppercase tracking-widest">
                                                        Prestamo
                                                    </p>
                                                )}
                                                {req.loan_end_date && (
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                                        Devolver: {new Date(req.loan_end_date).toLocaleDateString()}
                                                    </p>
                                                )}
                                                {req.extension_status && (
                                                    <p className={`text-[10px] mt-1 font-bold ${req.extension_status === 'pending' ? 'text-amber-600' : req.extension_status === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        Prórroga: {req.extension_status === 'pending' ? 'En revisión' : req.extension_status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                                    </p>
                                                )}
                                                {req.extension_requested_end_date && (
                                                    <p className="text-[10px] text-indigo-600 mt-1">
                                                        Solicita hasta: {new Date(`${req.extension_requested_end_date}T12:00:00`).toLocaleDateString()}
                                                    </p>
                                                )}
                                                {req.reject_reason && (
                                                    <p className="text-[10px] text-rose-600 mt-1">Rechazo: {req.reject_reason}</p>
                                                )}
                                            </td>
                                            <td className="p-6">
                                                <span
                                                    className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(req.status)}`}
                                                >
                                                    {getStatusLabel(req.status)}
                                                </span>
                                            </td>
                                            <td className="p-6 text-slate-400 text-xs font-medium">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-6">
                                                <div className="flex justify-end gap-2 flex-wrap">
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleGeneralAcceptDeliver(req.id)}
                                                                className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl"
                                                                title={req.is_loan ? 'Aprobar como prestamo' : 'Aceptar: entregado + ticket de asignación'}
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openRejectGeneral(req)}
                                                                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                                                                title="Denegar (motivo obligatorio)"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {(req.status === 'borrowed' || req.status === 'overdue') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => markLoanAsReturned(req)}
                                                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 hover:bg-emerald-100"
                                                            title="Marcar como devuelto"
                                                        >
                                                            Marcar devuelto
                                                        </button>
                                                    )}
                                                    {(req.status === 'borrowed' || req.status === 'overdue') && req.extension_status === 'pending' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openExtensionReview(req)}
                                                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 rounded-xl border border-indigo-200 hover:bg-indigo-100"
                                                            title="Revisar apelación de prórroga"
                                                        >
                                                            Revisar prórroga
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
            )}

            {tab === 'equipment' && (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-800">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Solicitudes de equipo</h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                            Aprobar crea el activo, lo asigna al usuario y marca entregado. Rechazar exige motivo.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-left">
                                    <th className="p-6 pb-4">Usuario</th>
                                    <th className="p-6 pb-4">Equipo</th>
                                    <th className="p-6 pb-4">Motivo</th>
                                    <th className="p-6 pb-4">Estado</th>
                                    <th className="p-6 pb-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="p-20 text-center">
                                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : filteredEquipment.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-16 text-center text-slate-400 font-bold uppercase text-xs">
                                            No hay solicitudes de equipo (tabla equipment_requests)
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEquipment.map((req) => (
                                        <tr key={req.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50">
                                            <td className="p-6">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {(profileMap[req.user_id]?.full_name) || '—'}
                                                </p>
                                                <p className="text-[10px] text-slate-400">{profileMap[req.user_id]?.email || ''}</p>
                                            </td>
                                            <td className="p-6">
                                                <span className="font-black text-blue-600 dark:text-blue-400">
                                                    {req.equipment_type}
                                                </span>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Urgencia: {req.urgency}</p>
                                            </td>
                                            <td className="p-6 max-w-xs text-slate-600 dark:text-slate-300 text-xs line-clamp-3">
                                                {req.reason}
                                                {req.assigned_asset_id && (
                                                    <p className="text-[10px] text-emerald-600 mt-2 font-bold">
                                                        Activo: {req.assigned_asset_id}
                                                    </p>
                                                )}
                                                {req.reject_reason && (
                                                    <p className="text-[10px] text-rose-600 mt-1">Rechazo: {req.reject_reason}</p>
                                                )}
                                            </td>
                                            <td className="p-6">
                                                <span
                                                    className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(req.status)}`}
                                                >
                                                    {getStatusLabel(req.status, 'equipment')}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex justify-end gap-2">
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEquipForm({
                                                                        brand: '',
                                                                        model: req.equipment_type || '',
                                                                        serial: '',
                                                                    });
                                                                    setApproveEquipModal({ open: true, row: req });
                                                                }}
                                                                className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl"
                                                                title="Aprobar y entregar"
                                                            >
                                                                <Check size={18} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openRejectEquipment(req)}
                                                                className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                                                                title="Rechazar"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </>
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
            )}

            {rejectModal.open && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-2 text-rose-600">
                            <AlertCircle size={22} />
                            <h4 className="font-black text-lg text-slate-900 dark:text-white">Razón de rechazo</h4>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            El usuario recibirá una notificación con este texto.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                            placeholder="Ej. No hay presupuesto aprobado para este trimestre..."
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium"
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setRejectModal({ open: false, type: null, row: null })}
                                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    rejectModal.type === 'general' ? confirmRejectGeneral() : confirmRejectEquipment()
                                }
                                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-rose-600 text-white"
                            >
                                Confirmar rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {approveLoanModal.open && approveLoanModal.row && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
                        <h4 className="font-black text-lg text-slate-900 dark:text-white">Aprobar prestamo</h4>
                        <p className="text-xs text-slate-500">
                            Define periodo del prestamo para activar recordatorios de devolucion.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Fecha de salida</label>
                                <input
                                    type="date"
                                    value={loanForm.loan_start_date}
                                    onChange={(e) => setLoanForm((prev) => ({ ...prev, loan_start_date: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Fecha limite de devolucion</label>
                                <input
                                    type="date"
                                    value={loanForm.loan_end_date}
                                    onChange={(e) => setLoanForm((prev) => ({ ...prev, loan_end_date: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setApproveLoanModal({ open: false, row: null })}
                                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmBorrowLoan}
                                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white"
                            >
                                Confirmar prestamo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {approveEquipModal.open && approveEquipModal.row && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
                        <h4 className="font-black text-lg text-slate-900 dark:text-white">Registrar y entregar equipo</h4>
                        <p className="text-xs text-slate-500">
                            Se creará un activo en inventario asignado al solicitante y la solicitud pasará a{" "}
                            <strong>Entregado</strong>.
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Marca</label>
                                <input
                                    value={equipForm.brand}
                                    onChange={(e) => setEquipForm((f) => ({ ...f, brand: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Modelo</label>
                                <input
                                    value={equipForm.model}
                                    onChange={(e) => setEquipForm((f) => ({ ...f, model: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Número de serie</label>
                                <input
                                    value={equipForm.serial}
                                    onChange={(e) => setEquipForm((f) => ({ ...f, serial: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setApproveEquipModal({ open: false, row: null })}
                                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEquipmentApproveDeliver}
                                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white"
                            >
                                Crear activo y entregar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {extensionReviewModal.open && extensionReviewModal.row && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
                        <h4 className="font-black text-lg text-slate-900 dark:text-white">Apelación de prórroga</h4>
                        <p className="text-xs text-slate-500">
                            Solicitud: <strong>{extensionReviewModal.row.subject || 'Préstamo'}</strong>
                        </p>
                        {extensionReviewModal.row.extension_reason && (
                            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Motivo del usuario</p>
                                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{extensionReviewModal.row.extension_reason}</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Decisión</label>
                                <select
                                    value={extensionReviewForm.decision}
                                    onChange={(e) => setExtensionReviewForm((prev) => ({ ...prev, decision: e.target.value }))}
                                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                >
                                    <option value="approve">Aprobar prórroga</option>
                                    <option value="reject">Rechazar prórroga</option>
                                </select>
                            </div>

                            {extensionReviewForm.decision === 'approve' ? (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Nueva fecha de devolución</label>
                                    <input
                                        type="date"
                                        value={extensionReviewForm.reviewedEndDate}
                                        onChange={(e) => setExtensionReviewForm((prev) => ({ ...prev, reviewedEndDate: e.target.value }))}
                                        className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Motivo de rechazo</label>
                                    <textarea
                                        rows={3}
                                        value={extensionReviewForm.rejectReason}
                                        onChange={(e) => setExtensionReviewForm((prev) => ({ ...prev, rejectReason: e.target.value }))}
                                        className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-medium"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setExtensionReviewModal({ open: false, row: null });
                                    setExtensionReviewForm({ decision: 'approve', reviewedEndDate: '', rejectReason: '' });
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleExtensionDecision}
                                className="px-5 py-2 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white"
                            >
                                Confirmar decisión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestsModule;
