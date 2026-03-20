import { supabase } from '../lib/supabaseClient';

// Estos son los estados que tu React UI conoce y usa
export const TICKET_STATUS = {
    PENDING_ADMIN: 'pending_admin',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved'
};

// --- TRADUCTORES INTELIGENTES ---
const toDBStatus = (status) => {
    const map = {
        'pending_admin': 'open',
        'assigned': 'pending',      
        'in_progress': 'pending',   
        'resolved': 'resolved'
    };
    return map[status] || status;
};

const toUIStatus = (status, assignedTech) => {
    if (status === 'open') return 'pending_admin';
    if (status === 'pending') {
        return assignedTech ? 'in_progress' : 'assigned';
    }
    if (status === 'resolved') return 'resolved';
    return status;
};

export const ticketService = {
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('tickets')
                .select(`
                    id,
                    title,
                    description,
                    status,
                    urgency,
                    created_at,
                    reported_by,
                    assigned_tech
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            return data.map(ticket => ({
                ...ticket,
                status: toUIStatus(ticket.status, ticket.assigned_tech)
            }));
        } catch (error) {
            console.error("Error fetching tickets:", error);
            return [];
        }
    },

    async create(ticketData) {
        try {
            const dbData = { ...ticketData };
            if (dbData.status) {
                dbData.status = toDBStatus(dbData.status);
            }

            const { data, error } = await supabase
                .from('tickets')
                .insert([dbData])
                .select()
                .single();

            if (error) throw error;
            
            if (data && data.status) data.status = toUIStatus(data.status, data.assigned_tech);

            // Notificaciones
            try {
                const { data: recipients } = await supabase
                    .from('profiles')
                    .select('id, role')
                    .in('role', ['admin', 'tech', 'técnico']);

                const ticketTitle = data?.title ? String(data.title) : 'Nuevo ticket';
                const title = `Nuevo ticket #${data?.id ?? ''}`.trim();
                const message = `Se registró un nuevo reporte: ${ticketTitle}`;

                if (recipients?.length) {
                    await Promise.all(
                        recipients
                            .map(r => r?.id)
                            .filter(Boolean)
                            .map(recipientId =>
                                supabase.from('notifications').insert([
                                    { user_id: recipientId, title, message }
                                ])
                            )
                    );
                }
            } catch (notifyErr) {
                console.warn('Ticket create notification failed:', notifyErr);
            }

            return data;
        } catch (error) {
            console.error("Error creating ticket:", error);
            return null;
        }
    },

    async update(id, updates, actorId) {
        try {
            const cleanUpdates = { ...updates };
            if (cleanUpdates.assigned_tech === '') {
                cleanUpdates.assigned_tech = null;
            }
            if (cleanUpdates.status) {
                cleanUpdates.status = toDBStatus(cleanUpdates.status);
            }

            const { data: prev, error: prevErr } = await supabase
                .from('tickets')
                .select('status, reported_by, assigned_tech')
                .eq('id', id)
                .single();

            if (prevErr) {
                console.error("Error obteniendo ticket previo:", prevErr);
                throw prevErr;
            }

            const { data, error } = await supabase
                .from('tickets')
                .update(cleanUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error("Error DE SUPABASE al actualizar:", error);
                throw error;
            }

            if (data && data.status) data.status = toUIStatus(data.status, data.assigned_tech);
            if (prev && prev.status) prev.status = toUIStatus(prev.status, prev.assigned_tech);

            if (data && prev && actorId) {
                const uiStatusUpdate = updates.status || data.status;
                const statusChanged = uiStatusUpdate && uiStatusUpdate !== prev.status;
                const assignedTechChanged = updates.hasOwnProperty('assigned_tech') && updates.assigned_tech !== prev.assigned_tech;

                if (statusChanged || assignedTechChanged) {
                    const recipients = new Set();
                    if (data.reported_by) recipients.add(data.reported_by);
                    if (data.assigned_tech) recipients.add(data.assigned_tech);

                    const newStatus = uiStatusUpdate;

                    if (statusChanged) {
                        const systemMessageByStatus = {
                            'assigned': '[STATUS_ASSIGNED] Ticket asignado',
                            'in_progress': '[STATUS_IN_PROGRESS] Ticket en proceso',
                            'resolved': '[STATUS_RESOLVED] Ticket resuelto'
                        };
                        const systemMsg = systemMessageByStatus[newStatus] || `Estado del ticket actualizado a: ${newStatus}`;
                        await supabase.from('ticket_messages').insert([
                            { ticket_id: id, sender_id: actorId, message: systemMsg }
                        ]);
                    } else if (assignedTechChanged) {
                        await supabase.from('ticket_messages').insert([
                            {
                                ticket_id: id,
                                sender_id: actorId,
                                message: cleanUpdates.assigned_tech ? '[STATUS_ASSIGNED] Técnico asignado' : '[STATUS_ASSIGNED] Técnico desasignado'
                            }
                        ]);
                    }

                    const recipientIds = [...recipients].filter(rid => rid && rid !== actorId);
                    if (recipientIds.length > 0) {
                        let title = `Ticket #${id}`;
                        let message = 'Tu ticket fue actualizado.';

                        if (statusChanged) {
                            if (newStatus === 'assigned') message = 'Tu ticket fue tomado y asignado al técnico.';
                            else if (newStatus === 'in_progress') message = 'Tu ticket ya está en proceso.';
                            else if (newStatus === 'resolved') message = 'Tu ticket fue resuelto. ¡Gracias!';
                        } else {
                            message = cleanUpdates.assigned_tech ? 'Tu ticket fue asignado a un nuevo técnico.' : 'Tu ticket fue desasignado.';
                        }

                        await Promise.all(
                            recipientIds.map(recipientId =>
                                supabase.from('notifications').insert([
                                    { user_id: recipientId, title, message }
                                ])
                            )
                        );
                    }
                }
            }

            return data;
        } catch (error) {
            console.error("Fallo general en update ticket:", error);
            return null;
        }
    }
};