import { supabase } from '../lib/supabaseClient';

/**
 * Audit Log Service — Fix #11
 * Registra acciones críticas: cambio de roles, borrado de activos,
 * resolución de tickets y accesos administrativos.
 */
export const auditService = {
    /**
     * Registra una acción en el log de auditoría.
     * @param {string} actorId - UUID del usuario que realiza la acción
     * @param {string} action - Tipo de acción (ej: 'DELETE_USER', 'CHANGE_ROLE')
     * @param {string} targetTable - Tabla afectada ('profiles', 'assets', etc.)
     * @param {string|null} targetId - ID del registro afectado
     * @param {object|null} details - Información adicional (valor anterior/nuevo)
     */
    async log(actorId, action, targetTable, targetId = null, details = null) {
        if (!actorId || !action) return;
        try {
            await supabase.from('audit_logs').insert([{
                actor_id: actorId,
                action,
                target_table: targetTable,
                target_id: targetId ? String(targetId) : null,
                details: details ? JSON.stringify(details) : null,
            }]);
        } catch (err) {
            // El log nunca debe romper el flujo principal
            if (import.meta.env.DEV) console.warn('Audit log failed:', err.message);
        }
    },

    /**
     * Obtiene los últimos N logs de auditoría (solo admins)
     */
    async getRecent(limit = 50) {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data || [];
        } catch (err) {
            if (import.meta.env.DEV) console.warn('Audit fetch failed:', err.message);
            return [];
        }
    }
};
