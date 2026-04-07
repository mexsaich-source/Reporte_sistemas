import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/authStore';
import { workNotificationService } from '../services/workNotificationService';
import { 
    Send, Laptop, Calendar, FileText, User as UserIcon, Tag, Building, Briefcase
} from 'lucide-react';

const normalize = (value = '') => value.toString().trim().toLowerCase();

async function getITAdminRecipients() {
    const { data } = await supabase
        .from('profiles')
        .select('id, role, department, status')
        .eq('status', true);

    return (data || [])
        .filter((p) => {
            const role = normalize(p.role);
            const dept = normalize(p.department);
            const isMaintArea = dept.includes('mantenimiento') || dept.includes('ingenieria') || dept.includes('ingeniería');
            const itAdminRoles = ['admin', 'jefe_it', 'jefe_area_it', 'jefe area it'];
            return itAdminRoles.includes(role) && !isMaintArea;
        })
        .map((p) => p.id)
        .filter(Boolean);
}

const GeneralRequestForm = ({ onCancel, onSuccess }) => {
    const { user, profile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        department: '',
        subject: '',
        reason: '',
        is_loan: false,
        serial_number: '',
        loan_start_date: '',
        loan_end_date: '',
        observations: ''
    });

    useEffect(() => {
        if (profile) {
            const names = (profile.full_name || '').split(' ');
            setFormData(prev => ({
                ...prev,
                first_name: names[0] || '',
                last_name: names.slice(1).join(' ') || '',
                department: profile.department || ''
            }));
        }
    }, [profile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const fullObservations = `[Departamento: ${formData.department}]\n${formData.observations}`;

            const { error } = await supabase
                .from('general_requests')
                .insert([{
                    user_id: user.id,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    department: formData.department,
                    subject: formData.subject,
                    reason: formData.reason,
                    is_loan: formData.is_loan,
                    serial_number: formData.is_loan ? formData.serial_number : null,
                    loan_start_date: formData.is_loan ? formData.loan_start_date : null,
                    loan_end_date: formData.is_loan ? formData.loan_end_date : null,
                    observations: fullObservations,
                    status: 'pending'
                }]);

            if (error) throw error;

            // Notificación best-effort para admin/tech
            try {
                const actorName = profile?.full_name || user?.email || 'Un usuario';
                const recipients = await getITAdminRecipients();

                const title = 'Nueva solicitud de equipo';
                const message = `${actorName} envió una solicitud: "${formData.subject || 'Solicitud'}".`;

                if (recipients.length) {
                    await Promise.all(
                        recipients.map((recipientId) =>
                            workNotificationService.createNotification(recipientId, title, message)
                        )
                    );
                }
            } catch (notifyErr) {
                console.warn('General request notification failed:', notifyErr);
            }
            onSuccess();
        } catch (error) {
            console.error('Error creating general request:', error);
            alert('Error al crear la petición: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl border border-slate-100 dark:border-slate-800 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                    <FileText size={32} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Peticiones Generales</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Solicita equipos, accesos o préstamos temporales.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Datos del Solicitante */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <UserIcon size={14} />
                        Datos del Solicitante
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre</label>
                            <input
                                required
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-5 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Apellidos</label>
                            <input
                                required
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-5 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Área / Departamento</label>
                        <div className="relative">
                            <Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                required
                                type="text"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-11 pr-5 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Detalles de la Petición */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Asunto</label>
                        <input
                            required
                            placeholder="Ej. Préstamo de proyector, Acceso a VPN..."
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Motivo / Justificación</label>
                        <textarea
                            required
                            placeholder="Describe detalladamente tu petición..."
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Sección de Préstamo Opción */}
                <div className="bg-blue-50 dark:bg-blue-500/5 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/50 space-y-4 transition-all">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={formData.is_loan}
                            onChange={(e) => setFormData({ ...formData, is_loan: e.target.checked })}
                            className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                        />
                        <span className="font-bold text-blue-900 dark:text-blue-300 group-hover:text-blue-700 dark:group-hover:text-blue-200 transition-colors">¿Es un préstamo de equipo?</span>
                    </label>

                    {formData.is_loan && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha Salida</label>
                                <input
                                    required={formData.is_loan}
                                    type="date"
                                    value={formData.loan_start_date}
                                    onChange={(e) => setFormData({ ...formData, loan_start_date: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 px-5 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha Devolución</label>
                                <input
                                    required={formData.is_loan}
                                    type="date"
                                    value={formData.loan_end_date}
                                    onChange={(e) => setFormData({ ...formData, loan_end_date: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 px-5 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Número de Serie (si se requiere)</label>
                                <div className="relative">
                                    <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Ej. SN-123456"
                                        value={formData.serial_number}
                                        onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 pl-11 pr-5 py-3 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Observaciones</label>
                    <textarea
                        placeholder="Comentarios adicionales..."
                        value={formData.observations}
                        onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                        rows={2}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none"
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 hover:bg-black dark:hover:bg-blue-500 transition-all flex justify-center items-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                Enviar Petición
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GeneralRequestForm;
