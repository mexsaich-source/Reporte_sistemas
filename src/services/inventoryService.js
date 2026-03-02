import { supabase } from '../lib/supabaseClient';

export const inventoryService = {

    async getAll() {
        try {
            // Hacemos el fetch principal buscando los perfiles asignados también por si existe UUID (para el futuro)
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
                    assigned_to,
                    profiles:assigned_to (full_name, department)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase Error fetching assets:", error);
                return [];
            }

            // Mapeamos los datos de backend a lo que el frontend Inventory.jsx espera
            return data.map(asset => {

                // Determinamos el usuario asignado basado en BD o meta info spec
                let assignedUser = 'Unassigned';
                let assignedDept = 'General';

                if (asset.profiles?.full_name) {
                    // Si tiene una relación real con UUID
                    assignedUser = asset.profiles.full_name;
                    assignedDept = asset.profiles.department || 'General';
                } else if (asset.specs?.assigned_user_name) {
                    // Si usamos la metadata temporal ingresada desde el frontend
                    assignedUser = asset.specs.assigned_user_name;
                    assignedDept = asset.specs.department || 'General';
                }

                // Transformamos los enums de BD a formato visual del frontend
                const statusMap = {
                    'active': 'Active',
                    'in_repair': 'In Repair',
                    'available': 'Available',
                    'decommissioned': 'Available'
                };

                const conditionMap = {
                    'excellent': 'Excelente',
                    'good': 'Bueno',
                    'failing': 'Regular'
                };

                return {
                    id: asset.id,
                    type: asset.type,
                    model: asset.model,
                    user: assignedUser,
                    department: assignedDept,
                    status: statusMap[asset.status] || 'Available',
                    warranty: asset.warranty_date || 'Sin registrar',
                    condition: conditionMap[asset.condition] || asset.specs?.condition || 'No definida'
                };
            });
        } catch (error) {
            console.error("Catch Exception fetching assets:", error);
            return [];
        }
    },

    async add(item) {
        try {
            const newId = `MEX-DEV-${Math.floor(1000 + Math.random() * 9000)}`;

            // Transformamos los estados visuales del form a los Enums de BD
            const statusMapToDB = {
                'Available': 'available',
                'Active': 'active',
                'In Repair': 'in_repair'
            };

            const conditionMapToDB = {
                'Nuevo': 'excellent',
                'Excelente': 'excellent',
                'Bueno': 'good',
                'Regular': 'failing'
            };

            const newAsset = {
                id: item.id || newId, // Si ya trae un ID o generamos uno automático
                type: item.type,
                model: item.model,
                status: statusMapToDB[item.status] || 'available',
                warranty_date: item.warranty ? new Date(item.warranty).toISOString().split('T')[0] : null,
                condition: conditionMapToDB[item.condition] || 'good',
                // En lugar de meter el texto libre a assigned_to (que rompería FK), lo guardamos en specs
                specs: {
                    assigned_user_name: item.user || 'Unassigned',
                    department: item.department || 'Sin Departamento',
                    condition_raw_frontend: item.condition // Respaldamos el valor original por si aca
                }
            };

            const { data, error } = await supabase
                .from('assets')
                .insert([newAsset])
                .select()
                .single();

            if (error) {
                console.error("--- Supabase Error adding asset ---");
                console.error("Código:", error.code);
                console.error("Mensaje:", error.message);
                console.error("Detalles:", error.details);
                console.error("Hint:", error.hint);
                console.error("Payload enviado:", JSON.stringify(newAsset, null, 2));
                return null;
            }

            return data;
        } catch (error) {
            console.error("Catch Exception adding asset:", error);
            return null;
        }
    },

    async update(id, updates) {
        try {
            // Mapeo inverso de DB Enums opcional (dependiendo de que manda el form, usualmente no se usa aún update en el frontend actual)
            const { data, error } = await supabase
                .from('assets')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Catch Exception updating asset:", error);
            return false;
        }
    },

    async remove(id) {
        try {
            const { error } = await supabase
                .from('assets')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Catch Exception removing asset:", error);
            return false;
        }
    }
};
