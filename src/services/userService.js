import { supabase } from '../lib/supabaseClient';

export const userService = {
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
    },

    async updateRole(id, role) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Error updating user role:", error);
            return false;
        }
    },

    async register(email, password, fullName, role = 'user', department = 'General') {
        try {
            // 1. Verificar si el perfil ya existe para evitar duplicados
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existingProfile) {
                return { success: false, error: "Este usuario ya tiene un perfil en el Directorio." };
            }

            // 2. Registro en Auth enviando los metadatos
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: role.toLowerCase(),
                        department: department
                    }
                }
            });

            if (error) {
                if (error.message.includes('already registered') || error.status === 422) {
                    return {
                        success: false,
                        error: "El usuario ya existe en Supabase Auth pero su perfil falló. Bórralo de Supabase Auth e intenta de nuevo."
                    };
                }
                if (error.status === 500) {
                    return {
                        success: false,
                        error: "Error 500: Falló el Trigger en Supabase. Revisa el código SQL en tu base de datos."
                    };
                }
                throw error;
            }

            return { success: true, user: data.user };
        } catch (error) {
            console.error("Error creating user:", error);
            return { success: false, error: error.message };
        }
    },

    async unregisterMemberFromDepartment(email, department) {
        try {
            // Borramos de la tabla profiles
            await this.deleteUserFromProfiles(email);

            // Intentamos remover de Auth
            await this.removeUserFromAuth(email);

            return { success: true };
        } catch (error) {
            console.error("Error unregistering member:", error);
            return { success: false, error: error.message };
        }
    },

    // --- FUNCIONES AUXILIARES ---

    async removeUserFromAuth(email) {
        try {
            // IMPORTANTE: Por seguridad, Supabase no permite borrar usuarios de Auth 
            // desde el cliente web. Esto requiere una Edge Function con Service Role Key.
            console.warn(`Nota: Para borrar a ${email} de Auth por completo, necesitas usar una Edge Function o borrarlo a mano en el panel de Supabase.`);
            return { success: true };
        } catch (error) {
            console.error("Error removing user from auth:", error);
            throw error;
        }
    },

    async deleteUserFromProfiles(email) {
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('email', email);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Error deleting user from profiles:", error);
            throw error;
        }
    },

    async updateUserRoles() {
        try {
            const users = await this.getAll();
            return { success: true, updatedCount: users.length };
        } catch (error) {
            console.error("Error updating user roles:", error);
            throw error;
        }
    }
};