import { supabase } from '../lib/supabaseClient';
import { auditService } from './auditService';

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

    async updateRole(id, role, actorId = null) {
        try {
            // Obtener rol previo para el audit log
            const { data: prev } = await supabase.from('profiles').select('role, email').eq('id', id).single();

            const { error } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', id);

            if (error) throw error;

            // Audit log: registrar cambio de rol
            if (actorId) {
                await auditService.log(actorId, 'CHANGE_ROLE', 'profiles', id, {
                    from: prev?.role,
                    to: role,
                    target_email: prev?.email
                });
            }

            return true;
        } catch (error) {
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
            // Hacemos borrado suave (soft delete) para preservar historial de tickets/actividades
            const result = await this.softDeleteUser(email);
            if (!result.success) throw new Error(result.error);

            // Nota: El borrado en Auth requiere una Edge Function
            // Ver: supabase.com -> Edge Functions
            return { success: true };
        } catch (error) {
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

    // Borrado suave: desactiva el usuario sin borrar sus registros
    // Esto evita errores 409 por claves foráneas (tickets, actividades, etc.)
    async softDeleteUser(email, actorId = null) {
        try {
            const { data: prev } = await supabase.from('profiles').select('id, full_name').eq('email', email).maybeSingle();

            const { error } = await supabase
                .from('profiles')
                .update({
                    // status no existe en la tabla — se desactiva quitando el rol y renombrando el email
                    role: 'user',
                    email: `deleted_${Date.now()}_${email}`
                })
                .eq('email', email);

            if (error) {
                if (error.code === 'PGRST116') return { success: false, error: 'Usuario no encontrado.' };
                throw error;
            }

            // Audit log: registrar borrado de usuario
            if (actorId && prev?.id) {
                await auditService.log(actorId, 'SOFT_DELETE_USER', 'profiles', prev.id, {
                    deleted_email: email,
                    name: prev.full_name
                });
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'No se pudo desactivar el usuario: ' + error.message };
        }
    },

    // Mantenemos la firma original por compatibilidad
    async deleteUserFromProfiles(email) {
        return this.softDeleteUser(email);
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