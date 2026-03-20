import { supabase } from '../lib/supabaseClient';

export const inventoryService = {
    /**
     * Get all assets with unified mapping
     * Logic: We ensure brand, model, and serial are always string-based and extracted 
     * from either columns or the specs JSON to prevent mixed data.
     */
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('assets')
                .select(`id, type, model, status, warranty_date, condition, specs, assigned_to`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data || []).map(asset => {
                const specs = asset.specs || {};
                
                return {
                    id: String(asset.id), 
                    // Priority: Column -> Specs -> Default
                    type: asset.type || specs.asset_type || specs.type || 'General', 
                    model: asset.model || specs.model || '',
                    brand: specs.brand || '',
                    serial: String(specs.serial_number || specs.serial || '').trim(), 
                    category: specs.category || '',
                    specsDetails: specs.details || '',
                    user: specs.assigned_user_name || '',
                    department: specs.department || '',
                    status: asset.status || 'available', 
                    condition: asset.condition || 'good',
                    loanDate: specs.loan_date || '',
                    returnDate: specs.return_date || '',
                    loanUser: specs.loan_user || '',
                    rejectReason: specs.reject_reason || '',
                    requestReason: specs.request_reason || '',
                    requestedById: specs.requested_by_id || '',
                    deliveredAt: specs.delivered_at || '',
                    receivedAt: specs.received_at || '',
                    returnedAt: specs.returned_at || ''
                };
            });
        } catch (error) {
            console.error("Inventory Fetch Error:", error);
            return [];
        }
    },

    /**
     * Add new asset with clean object structure
     */
    async add(item) {
        try {
            const finalId = item.id ? String(item.id).trim() : `MEX-${Date.now().toString().slice(-6)}`;
            
            const newAsset = {
                id: finalId,
                type: item.type || 'General',
                model: item.model || '',
                status: item.status || 'available', 
                condition: item.condition || 'good',
                specs: {
                    asset_type: item.type,
                    brand: item.brand || '',
                    model: item.model || '',
                    serial_number: String(item.serial || '').trim(),
                    category: item.category || '',
                    details: item.specsDetails || '',
                    assigned_user_name: item.user || '',
                    department: item.department || '',
                    loan_date: item.loanDate || '',
                    return_date: item.returnDate || '',
                    loan_user: item.loanUser || ''
                }
            };

            const { data, error } = await supabase.from('assets').insert([newAsset]).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Inventory Add Error:", error);
            return null;
        }
    },

    /**
     * Update asset ensuring specs are merged not overwritten
     */
    async update(id, updates) {
        try {
            const { data: current } = await supabase.from('assets').select('specs').eq('id', id).single();
            const currentSpecs = current?.specs || {};

            const mergedSpecs = {
                ...currentSpecs,
                asset_type: updates.type !== undefined ? updates.type : currentSpecs.asset_type,
                brand: updates.brand !== undefined ? updates.brand : currentSpecs.brand,
                model: updates.model !== undefined ? updates.model : currentSpecs.model,
                serial_number: updates.serial !== undefined ? String(updates.serial).trim() : currentSpecs.serial_number,
                category: updates.category !== undefined ? updates.category : currentSpecs.category,
                details: updates.specsDetails !== undefined ? updates.specsDetails : currentSpecs.details,
                assigned_user_name: updates.user !== undefined ? updates.user : currentSpecs.assigned_user_name,
                department: updates.department !== undefined ? updates.department : currentSpecs.department,
                loan_date: updates.loanDate !== undefined ? updates.loanDate : currentSpecs.loan_date,
                return_date: updates.returnDate !== undefined ? updates.returnDate : currentSpecs.return_date,
                loan_user: updates.loanUser !== undefined ? updates.loanUser : currentSpecs.loan_user,
                reject_reason: updates.rejectReason !== undefined ? updates.rejectReason : currentSpecs.reject_reason,
                request_reason: updates.requestReason !== undefined ? updates.requestReason : currentSpecs.request_reason,
                requested_by_id: updates.requestedById !== undefined ? updates.requestedById : currentSpecs.requested_by_id,
                delivered_at: updates.deliveredAt !== undefined ? updates.deliveredAt : currentSpecs.delivered_at,
                received_at: updates.receivedAt !== undefined ? updates.receivedAt : currentSpecs.received_at,
                returned_at: updates.returnedAt !== undefined ? updates.returnedAt : currentSpecs.returned_at,
            };

            const dbUpdates = {
                type: updates.type,
                model: updates.model,
                status: updates.status,
                condition: updates.condition,
                specs: mergedSpecs
            };

            // Clean undefined
            Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

            const { error } = await supabase.from('assets').update(dbUpdates).eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Inventory Update Error:", error);
            return false;
        }
    },

    /**
     * PERMANENT DELETION: Removes the record from the database.
     * Use only when a record was an error or is no longer needed in any history.
     */
    async remove(id) {
        try {
            const { error } = await supabase.from('assets').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Inventory Delete Error:", error);
            return false;
        }
    }
};
