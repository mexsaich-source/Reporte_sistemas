import { supabase } from '../lib/supabaseClient';

export const inventoryService = {
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('assets')
                .select(`
                    id, 
                    type, 
                    model, 
                    status, 
                    warranty_date, 
                    condition, 
                    specs, 
                    assigned_to
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase Error fetching assets:", error);
                return [];
            }

            return data.map(asset => {
                const specs = asset.specs || {};
                
                return {
                    id: asset.id, 
                    type: asset.type || specs.type || '', 
                    model: asset.model || '',
                    serial: specs.serial_number || '', 
                    category: specs.category || '',
                    specsDetails: specs.details || '',
                    user: specs.assigned_user_name || '',
                    department: specs.department || '',
                    status: asset.status || 'available', 
                    condition: asset.condition || 'good'
                };
            });
        } catch (error) {
            console.error("Catch Exception fetching assets:", error);
            return [];
        }
    },

    async add(item) {
        try {
            const newAsset = {
                id: item.id || `MEX-DEV-${Date.now().toString().slice(-6)}`,
                type: item.type || 'General',
                model: item.model || '',
                status: item.status || 'available', 
                condition: item.condition || 'good',
                specs: {
                    serial_number: item.serial || '',
                    category: item.category || '',
                    details: item.specsDetails || '',
                    assigned_user_name: item.user || '',
                    department: item.department || ''
                }
            };

            const { data, error } = await supabase.from('assets').insert([newAsset]).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Exception adding asset:", error);
            return null;
        }
    },

    async update(id, updates) {
        try {
            const { data: current } = await supabase.from('assets').select('specs').eq('id', id).single();
            const currentSpecs = current?.specs || {};

            const mergedSpecs = {
                ...currentSpecs,
                serial_number: updates.serial !== undefined ? updates.serial : currentSpecs.serial_number,
                category: updates.category !== undefined ? updates.category : currentSpecs.category,
                details: updates.specsDetails !== undefined ? updates.specsDetails : currentSpecs.details,
                assigned_user_name: updates.user !== undefined ? updates.user : currentSpecs.assigned_user_name,
                department: updates.department !== undefined ? updates.department : currentSpecs.department,
            };

            const dbUpdates = {
                type: updates.type,
                model: updates.model,
                status: updates.status,
                condition: updates.condition,
                specs: mergedSpecs
            };

            Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

            const { error } = await supabase.from('assets').update(dbUpdates).eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Exception updating asset:", error);
            return false;
        }
    },

    async bulkImport(items) {
        try {
            const assetsToInsert = items.map((item, idx) => ({
                id: item.id || `MEX-DEV-${Date.now().toString().slice(-4)}${idx}`,
                type: item.type || 'General',
                model: item.model || '',
                status: item.status || 'available',
                condition: 'good',
                specs: {
                    serial_number: item.serial || '',
                    category: item.category || '',
                    details: item.specsDetails || ''
                }
            }));

            const { data, error } = await supabase.from('assets').insert(assetsToInsert).select();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Bulk import exception:", error);
            return null;
        }
    },

    async remove(id) {
        try {
            const { error } = await supabase.from('assets').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Catch Exception removing asset:", error);
            return false;
        }
    }
};
