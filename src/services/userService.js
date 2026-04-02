import { supabase, supabaseAdmin } from '../lib/supabaseClient';
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

    async updateWhatsAppCredentials(id, phone, actorId = null) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    whatsapp_phone: phone,
                    // whatsapp_apikey is obsolete
                })
                .eq('id', id);

            if (error) throw error;

            if (actorId) {
                await auditService.log(actorId, 'UPDATE_TELEGRAM_CREDENTIALS', 'profiles', id, {
                    telegram_chat_id: phone
                });
            }

            return true;
        } catch (error) {
            console.error("Error updating whatsapp credentials:", error);
            return false;
        }
    },

    async sendTestWhatsApp(userId, whatsappPhone) {
        try {
            const { data, error } = await supabase.functions.invoke('notify-omnicanal', {
                body: {
                    user_id: userId,
                    type: 'test',
                    whatsapp_phone: whatsappPhone,
                    message: 'Prueba de conexión'
                }
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error("Error sending test telegram:", error);
            return { success: false, error: error.message };
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

            // 2. Registro en Auth usando el cliente secudario sin persistencia
            const { data, error } = await supabaseAdmin.auth.signUp({
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

    // --- EL NUEVO SISTEMA DE BORRADO REAL  ---

    async unregisterMemberFromDepartment(email, department) {
        // Redirigimos esto a nuestra función de borrado real
        return this.deleteUserCompleto(email);
    },

    async deleteUserFromProfiles(email) {
        // Redirigimos esto a nuestra función de borrado real
        return this.deleteUserCompleto(email);
    },

    // Esta es la función maestra que hace el trabajo sucio
    async deleteUserCompleto(email, actorId = null) {
        try {
            console.log(`Intentando borrar usuario con correo: ${email}`);

            // 1. Buscamos el ID del usuario usando su correo
            const { data: user } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('email', email)
                .maybeSingle();

            if (!user) {
                return { success: false, error: 'Usuario no encontrado en la base de datos.' };
            }

            console.log(`ID encontrado: ${user.id}. Ejecutando Modo Dios (RPC)...`);

            // 2. Ejecutamos la función SQL (RPC) para borrar de raíz (Auth, Profiles, limpia Inventario)
            const { error } = await supabase.rpc('delete_auth_user', {
                target_user_id: user.id
            });

            if (error) {
                // AQUÍ ESTÁ EL TRUCO: Imprimir el error real en la consola
                console.error("Detalle del error de Supabase:", JSON.stringify(error, null, 2));
                throw error;
            }

            // 3. Audit log: registrar que eliminamos al usuario
            if (actorId) {
                await auditService.log(actorId, 'HARD_DELETE_USER', 'profiles', user.id, {
                    deleted_email: email,
                    name: user.full_name,
                    details: 'Usuario eliminado completamente del sistema.'
                });
            }

            return { success: true };
        } catch (error) {
            console.error("Error crítico al eliminar:", error);
            return { success: false, error: error.message || 'No se pudo eliminar el usuario de raíz.' };
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