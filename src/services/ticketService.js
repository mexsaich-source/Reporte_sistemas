import { supabase } from '../lib/supabaseClient';
import { userService } from './userService';
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
            
            // Map users
            const users = await userService.getAll();
            const userMap = users.reduce((acc, user) => { 
                acc[user.id] = user; 
                return acc; 
            }, {});

            return data.map(ticket => ({
                ...ticket,
                profiles: userMap[ticket.reported_by] || null,
                tech_profile: userMap[ticket.assigned_tech] || null,
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


                }
            }

            return data;
        } catch (error) {
            console.error("Fallo general en update ticket:", error);
            return null;
        }
    }
};