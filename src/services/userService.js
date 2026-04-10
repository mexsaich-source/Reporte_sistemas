import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import { auditService } from './auditService';

const formatRpcError = (error) => {
    if (!error) return 'Error desconocido';
    const code = error.code ? `[${error.code}] ` : '';
    const msg = error.message || 'Error en RPC';
    const details = error.details ? ` Detalle: ${error.details}` : '';
    const hint = error.hint ? ` Sugerencia: ${error.hint}` : '';
    return `${code}${msg}${details}${hint}`.trim();
};

const isMaintenanceArea = (value = '') => {
    const dep = String(value || '').trim().toLowerCase();
    return dep.includes('mantenimiento') || dep.includes('ingenieria') || dep.includes('ingeniería');
};

const isAllowedMaintDepartment = (value = '') => {
    const dep = String(value || '').trim().toLowerCase();
    return dep === 'mantenimiento' || dep === 'ingenieria' || dep === 'ingeniería';
};

const buildTemporaryPassword = () => {
    // Supabase exige password en signUp; luego forzamos flujo por correo para que el usuario cree su propia clave.
    const random = Math.random().toString(36).slice(-10);
    return `Tmp_${Date.now()}_${random}!`;
};

const getAuthRedirectBase = () => {
    const envBase = String(import.meta.env.VITE_AUTH_REDIRECT_BASE || '').trim();
    if (envBase) {
        return envBase.replace(/\/$/, '');
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }
    return 'https://it-helpdesk-mexsa.vercel.app';
};

const getAssetMetaEmail = (specs = {}) =>
    String(specs?.assigned_to_email || specs?.assigned_user_email || '')
        .trim()
        .toLowerCase();

const getAssetSerial = (specs = {}) =>
    String(
        specs?.serial_number ||
        specs?.serial ||
        specs?.ns ||
        specs?.numero_serie ||
        ''
    ).trim();

export const userService = {
    async getAll() {
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const { data: allAssets, error: assetsError } = await supabase
                .from('assets')
                .select('id, type, model, status, assigned_to, specs')
                .order('created_at', { ascending: false });

            if (assetsError) {
                console.warn('No se pudieron cargar equipos asignados:', assetsError.message);
                return profiles || [];
            }

            const profilesById = (profiles || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});

            const profilesByEmail = (profiles || []).reduce((acc, p) => {
                const key = String(p.email || '').trim().toLowerCase();
                if (key && !acc[key]) acc[key] = p.id;
                return acc;
            }, {});

            const assetsByUser = (allAssets || []).reduce((acc, asset) => {
                const specs = asset.specs || {};

                let userId = asset.assigned_to || null;
                let relationSource = userId ? 'assigned_to' : 'none';

                // Fallback histórico: hay cargas donde solo se guardó assigned_to_email en specs.
                // Eso debe reflejarse en la vista de usuarios aunque falte el UUID.
                if (!userId) {
                    const emailFromSpecs = getAssetMetaEmail(specs);
                    if (emailFromSpecs && profilesByEmail[emailFromSpecs]) {
                        userId = profilesByEmail[emailFromSpecs];
                        relationSource = 'email_meta';
                    }
                }

                // Si assigned_to apunta a UUID inválido, no mapear aquí (quedará en diagnóstico de huérfanos).
                if (userId && !profilesById[userId]) {
                    userId = null;
                }

                if (!userId) return acc;
                if (!acc[userId]) acc[userId] = [];

                const hostname = String(specs.hostname || '').trim();
                const serial = getAssetSerial(specs) || null;
                const fallbackLabel = [
                    specs.brand || null,
                    asset.model || specs.model || null,
                    serial,
                ]
                    .filter(Boolean)
                    .join(' · ');
                const label = hostname
                    ? `${hostname}${serial ? ` · ${serial}` : ''}`
                    : fallbackLabel;

                acc[userId].push({
                    id: asset.id,
                    type: asset.type,
                    model: asset.model,
                    status: asset.status,
                    hostname,
                    assigned_to_email: getAssetMetaEmail(specs) || null,
                    relation_source: relationSource,
                    serial_number: serial,
                    brand: specs.brand || null,
                    label: label || `${asset.type || 'Equipo'} · ${asset.id}`,
                });

                return acc;
            }, {});

            return (profiles || []).map((profile) => {
                const realAssignedAssets = assetsByUser[profile.id] || [];
                return {
                    ...profile,
                    assigned_assets: realAssignedAssets,
                    assigned_equipment_real: realAssignedAssets.map((a) => a.label).join(', '),
                };
            });
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
    },

    async getAssignableAssets(userId = null) {
        try {
            const [{ data: assets, error: assetsError }, { data: profiles, error: profilesError }] = await Promise.all([
                supabase
                    .from('assets')
                    .select('id, type, model, status, assigned_to, specs')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('profiles')
                    .select('id, email'),
            ]);

            if (assetsError) throw assetsError;
            if (profilesError) throw profilesError;

            const profileIds = new Set((profiles || []).map((p) => p.id));
            const profileByEmail = (profiles || []).reduce((acc, p) => {
                const key = String(p.email || '').trim().toLowerCase();
                if (key && !acc[key]) acc[key] = p.id;
                return acc;
            }, {});

            const userEmail = userId
                ? String((profiles || []).find((p) => p.id === userId)?.email || '').trim().toLowerCase()
                : '';

            const filtered = (assets || []).filter((asset) => {
                const assignedTo = asset.assigned_to;
                const metaEmail = getAssetMetaEmail(asset.specs || {});
                const metaUserId = metaEmail ? profileByEmail[metaEmail] : null;
                const isOrphan = !!assignedTo && !profileIds.has(assignedTo);

                if (!userId) {
                    return !assignedTo || isOrphan;
                }

                return (
                    !assignedTo ||
                    assignedTo === userId ||
                    isOrphan ||
                    (metaUserId && metaUserId === userId) ||
                    (userEmail && metaEmail === userEmail)
                );
            });

            return filtered.map((asset) => {
                const specs = asset.specs || {};
                const isOrphan = !!asset.assigned_to && !profileIds.has(asset.assigned_to);
                return {
                    ...asset,
                    serial_number: getAssetSerial(specs) || null,
                    brand: specs.brand || null,
                    is_orphan: isOrphan,
                    label: [
                        specs.hostname || null,
                        specs.brand || null,
                        asset.model || specs.model || null,
                        getAssetSerial(specs) || null,
                    ]
                        .filter(Boolean)
                        .join(' · ') || `${asset.type || 'Equipo'} · ${asset.id}`,
                };
            });
        } catch (error) {
            console.error('Error loading assignable assets:', error);
            return [];
        }
    },

    async assignAssetToUser(assetId, userId, actorId = null) {
        try {
            if (actorId) {
                const { data: actor } = await supabase
                    .from('profiles')
                    .select('department')
                    .eq('id', actorId)
                    .single();

                if (isMaintenanceArea(actor?.department)) {
                    console.warn('Bloqueado: mantenimiento no puede asignar equipos de inventario IT.');
                    return false;
                }
            }

            const { error } = await supabase
                .from('assets')
                .update({ assigned_to: userId, status: 'active' })
                .eq('id', assetId);

            if (error) throw error;

            if (actorId) {
                await auditService.log(actorId, 'ASSIGN_ASSET_TO_USER', 'assets', assetId, {
                    user_id: userId,
                });
            }

            return true;
        } catch (error) {
            console.error('Error assigning asset to user:', error);
            return false;
        }
    },

    async unassignAssetFromUser(assetId, actorId = null) {
        try {
            if (actorId) {
                const { data: actor } = await supabase
                    .from('profiles')
                    .select('department')
                    .eq('id', actorId)
                    .single();

                if (isMaintenanceArea(actor?.department)) {
                    console.warn('Bloqueado: mantenimiento no puede desasignar equipos de inventario IT.');
                    return false;
                }
            }

            const { error } = await supabase
                .from('assets')
                .update({ assigned_to: null, status: 'available' })
                .eq('id', assetId);

            if (error) throw error;

            if (actorId) {
                await auditService.log(actorId, 'UNASSIGN_ASSET_FROM_USER', 'assets', assetId, {});
            }

            return true;
        } catch (error) {
            console.error('Error unassigning asset from user:', error);
            return false;
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
        } catch {
            return false;
        }
    },

    async updateAdminUserInfo(id, profileData, actorId = null) {
        try {
            const { telegram_chat_id, role, department, location, assigned_equipment } = profileData;
            
            // 1. Obtener rol previo
            const { data: prev } = await supabase.from('profiles').select('role, email').eq('id', id).single();

            // 2. Seguridad de Área: Si el actor es de Mantenimiento, forzamos el departamento
            let finalDept = department;
            const { data: actor } = await supabase.from('profiles').select('department').eq('id', actorId).single();
            if (isMaintenanceArea(actor?.department)) {
                finalDept = isAllowedMaintDepartment(department) ? department : 'Mantenimiento';
            }

            // 3. Actualizar la tabla profiles
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    whatsapp_phone: telegram_chat_id, 
                    role: role,
                    department: finalDept,
                    location: location,
                    assigned_equipment: assigned_equipment
                })
                .eq('id', id);

            if (error) throw error;

            // 3. Log
            if (actorId) {
                await auditService.log(actorId, 'UPDATE_USER_ADMIN', 'profiles', id, {
                    updated_email: prev?.email,
                    changes: profileData
                });
            }

            return true;
        } catch (error) {
            console.error("Error updating admin info:", error);
            return false;
        }
    },

    async toggleUserStatus(id, currentStatus, actorId = null) {
        try {
            const newStatus = !currentStatus;
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            if (actorId) {
                await auditService.log(actorId, 'TOGGLE_USER_STATUS', 'profiles', id, {
                    newStatus: newStatus ? 'active' : 'suspended'
                });
            }

            return true;
        } catch (error) {
            console.error("Error toggling user status:", error);
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

    async updateWhatsAppCredentials(userId, whatsappPhone, actorId = null) {
        try {
            const clean = (whatsappPhone || '').toString().trim();
            const { error } = await supabase
                .from('profiles')
                .update({
                    whatsapp_phone: clean || null,
                    telegram_chat_id: clean || null,
                })
                .eq('id', userId);

            if (error) throw error;

            if (actorId) {
                await auditService.log(actorId, 'UPDATE_OWN_NOTIFICATION_CONTACT', 'profiles', userId, {
                    whatsapp_phone: clean || null,
                });
            }

            return true;
        } catch (error) {
            console.error('Error updating notification contact:', error);
            return false;
        }
    },

    async getMyAreaNotificationSettings() {
        try {
            const { data, error } = await supabase.rpc('get_my_notification_area_settings');
            if (error) throw error;
            return { success: true, data: Array.isArray(data) ? (data[0] || null) : null };
        } catch (error) {
            console.error('Error loading area notification settings:', error);
            return { success: false, error: error.message, data: null };
        }
    },

    async saveMyAreaNotificationSettings(payload = {}) {
        try {
            const {
                telegram_bot_token = '',
                smtp_host = '',
                smtp_port = null,
                smtp_user = '',
                smtp_pass = '',
                smtp_from_name = '',
                meta_access_token = '',
                meta_phone_number_id = '',
            } = payload;

            const normalizedPort = smtp_port === '' || smtp_port === null || smtp_port === undefined
                ? null
                : Number(smtp_port);

            if (normalizedPort !== null && Number.isNaN(normalizedPort)) {
                return { success: false, error: 'El puerto SMTP no es numérico.' };
            }

            // Intento 1: firma actual (8 parámetros)
            const argsV2 = {
                p_telegram_bot_token: telegram_bot_token,
                p_smtp_host: smtp_host,
                p_smtp_port: normalizedPort,
                p_smtp_user: smtp_user,
                p_smtp_pass: smtp_pass,
                p_smtp_from_name: smtp_from_name,
                p_meta_access_token: meta_access_token,
                p_meta_phone_number_id: meta_phone_number_id,
            };

            let { data, error } = await supabase.rpc('upsert_my_notification_area_settings', argsV2);

            // Intento 2 (compat): firma antigua sin campos Meta
            if (error && /function|No function matches|does not exist|PGRST202/i.test(formatRpcError(error))) {
                const argsV1 = {
                    p_telegram_bot_token: telegram_bot_token,
                    p_smtp_host: smtp_host,
                    p_smtp_port: normalizedPort,
                    p_smtp_user: smtp_user,
                    p_smtp_pass: smtp_pass,
                    p_smtp_from_name: smtp_from_name,
                };
                ({ data, error } = await supabase.rpc('upsert_my_notification_area_settings', argsV1));
            }

            // Intento 3 (compat extrema): sin puerto (si la función no lo soporta)
            if (error && /function|No function matches|does not exist|PGRST202/i.test(formatRpcError(error))) {
                const argsLegacy = {
                    p_telegram_bot_token: telegram_bot_token,
                    p_smtp_host: smtp_host,
                    p_smtp_user: smtp_user,
                    p_smtp_pass: smtp_pass,
                    p_smtp_from_name: smtp_from_name,
                };
                ({ data, error } = await supabase.rpc('upsert_my_notification_area_settings', argsLegacy));
            }

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error saving area notification settings:', error);
            return { success: false, error: formatRpcError(error) };
        }
    },

    async applyMyAreaNotificationSetupCode(setupCode) {
        try {
            const raw = String(setupCode || '').trim();
            if (!raw) {
                return { success: false, error: 'Código vacío.' };
            }

            let parsed = null;

            // Formato 1: JSON directo
            if (raw.startsWith('{') && raw.endsWith('}')) {
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    return { success: false, error: 'JSON inválido en el código de configuración.' };
                }
            }

            // Formato 2: prefijo setup:BASE64...
            let encodedChunk = raw;
            const prefixed = raw.match(/^setup\s*:\s*(.+)$/i);
            if (prefixed?.[1]) encodedChunk = prefixed[1].trim();

            // Formato 3: Base64/Base64URL
            if (!parsed) {
                const normalized = encodedChunk.replace(/-/g, '+').replace(/_/g, '/');
                const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

                let decoded;
                try {
                    decoded = atob(padded);
                } catch {
                    return { success: false, error: 'El código no es válido. Usa Base64, Base64URL o JSON.' };
                }

                try {
                    parsed = JSON.parse(decoded);
                } catch {
                    return { success: false, error: 'El código decodificó pero no contiene JSON válido.' };
                }
            }

            const payload = {
                telegram_bot_token: parsed.telegram_bot_token || '',
                smtp_host: parsed.smtp_host || '',
                smtp_port: parsed.smtp_port || null,
                smtp_user: parsed.smtp_user || '',
                smtp_pass: parsed.smtp_pass || '',
                smtp_from_name: parsed.smtp_from_name || '',
                meta_access_token: parsed.meta_access_token || '',
                meta_phone_number_id: parsed.meta_phone_number_id || '',
            };

            const hasAnyField = Object.values(payload).some((v) => v !== '' && v !== null);
            if (!hasAnyField) {
                return { success: false, error: 'El código no incluye campos de configuración.' };
            }

            return this.saveMyAreaNotificationSettings(payload);
        } catch (error) {
            console.error('Error applying setup code:', error);
            return { success: false, error: error.message || 'No se pudo aplicar el código.' };
        }
    },

    async register(email, password, fullName, role = 'user', department = 'General', actorId = null) {
        try {
            let finalRole = role;
            let finalDepartment = department;
            const finalPassword = String(password || '').trim() || buildTemporaryPassword();
            const authBase = getAuthRedirectBase();

            if (actorId) {
                const { data: actor } = await supabase
                    .from('profiles')
                    .select('department')
                    .eq('id', actorId)
                    .single();

                if (isMaintenanceArea(actor?.department)) {
                    finalDepartment = isAllowedMaintDepartment(department) ? department : 'Mantenimiento';
                    if (String(role || '').toLowerCase().trim() === 'admin') {
                        finalRole = 'user';
                    }
                }
            }

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
                password: finalPassword,
                options: {
                    emailRedirectTo: `${authBase}/login`,
                    data: {
                        full_name: fullName,
                        role: String(finalRole || 'user').toLowerCase(),
                        department: finalDepartment
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

            let passwordSetupEmailSent = false;
            let passwordSetupEmailError = null;
            try {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${authBase}/reset-password`
                });
                if (!resetError) {
                    passwordSetupEmailSent = true;
                } else {
                    passwordSetupEmailError = resetError.message || 'No se pudo enviar correo de configuración de contraseña.';
                    console.warn('No se pudo enviar correo para definir contraseña:', resetError.message);
                }
            } catch (mailErr) {
                passwordSetupEmailError = mailErr?.message || 'Error inesperado enviando correo de recuperación.';
                console.warn('Error enviando correo de recuperación:', mailErr?.message || mailErr);
            }

            return { success: true, user: data.user, passwordSetupEmailSent, passwordSetupEmailError };
        } catch (error) {
            console.error("Error creating user:", error);
            return { success: false, error: error.message };
        }
    },

    // --- EL NUEVO SISTEMA DE BORRADO REAL  ---

    async unregisterMemberFromDepartment(email) {
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