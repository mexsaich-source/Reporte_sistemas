import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/authStore';
import { workNotificationService } from '../services/workNotificationService';
import { 
    Plus, Search, Filter, Clock, CheckCircle, AlertCircle, 
    MoreHorizontal, Smartphone, Laptop, Monitor, Mail, 
    Calendar, User, ChevronRight, X, Send, ImagePlus, Hash,
    FileText, Tag, MessageSquare, Briefcase
} from 'lucide-react';
import Header from './Header';

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

const EquipmentRequestForm = ({ onCancel, onSuccess }) => {
    const { user, profile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        equipment_type: 'Laptop',
        reason: '',
        urgency: 'Normal'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('equipment_requests')
                .insert([{
                    user_id: user.id,
                    equipment_type: formData.equipment_type,
                    reason: formData.reason,
                    urgency: formData.urgency,
                    status: 'pending'
                }]);

            if (error) throw error;

            const admins = await getITAdminRecipients();

            const title = 'Nueva solicitud de equipo';
            const message = `${profile?.full_name || user.email || 'Usuario'} solicitó: ${formData.equipment_type}. Revisa Solicitudes → Equipo.`;
            for (const adminId of admins) {
                await workNotificationService.createNotification(adminId, title, message);
            }

            onSuccess();
        } catch (error) {
            console.error('Error creating request:', error);
            alert('Error al crear la solicitud: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl border border-slate-100 dark:border-slate-800 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                    <Laptop size={32} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Solicitud de Equipo</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Completa los detalles para tu nuevo recurso.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo de Equipo</label>
                        <select
                            value={formData.equipment_type}
                            onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                        >
                            <option>Laptop</option>
                            <option>Desktop</option>
                            <option>Monitor</option>
                            <option>Teclado/Mouse</option>
                            <option>Smartphone</option>
                            <option>Impresora</option>
                            <option>Otro</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Prioridad</label>
                        <select
                            value={formData.urgency}
                            onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-6 py-4 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                        >
                            <option>Baja</option>
                            <option>Normal</option>
                            <option>Alta</option>
                            <option>Crítica</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Motivo / Justificación</label>
                    <textarea
                        required
                        placeholder="Describe por qué necesitas este equipo..."
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        rows={4}
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
                        className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 hover:bg-black dark:hover:bg-blue-500 transition-all flex justify-center items-center gap-2 group"
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                Enviar Solicitud
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EquipmentRequestForm;
