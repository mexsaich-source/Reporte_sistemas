import { supabase } from '../lib/supabaseClient';

export const TICKET_STATUS = {
    PENDING_ADMIN: 'pending_admin',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved'
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
                    assigned_tech,
                    owner_id
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error fetching tickets:", error);
            return [];
        }
    },

    async create(ticketData) {
        try {
            const { data, error } = await supabase
                .from('tickets')
                .insert([ticketData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error creating ticket:", error);
            return null;
        }
    },

    async update(id, updates) {
        try {
            const { data, error } = await supabase
                .from('tickets')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error updating ticket:", error);
            return null;
        }
    }
};
