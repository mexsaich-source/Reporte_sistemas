import { supabase } from '../lib/supabaseClient';
import { auditService } from './auditService';

const stripAccents = (value = '') =>
    String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normalizeAssetStatus = (value = '') => {
    const raw = stripAccents(String(value || '').trim().toLowerCase());
    const compact = raw.replace(/[^a-z0-9]/g, '');
    if (!raw) return 'available';

    if (
        ['available', 'disponible', 'libre', 'stock', 'bodega'].includes(raw) ||
        ['available', 'disponible', 'libre', 'stock', 'bodega'].includes(compact) ||
        compact.startsWith('dispon')
    ) return 'available';
    if (['active', 'activo', 'asignado', 'enuso', 'inuse'].includes(compact)) return 'active';
    if (['loaned', 'prestado', 'prestamo'].includes(compact)) return 'loaned';
    if (['requestpending', 'pendiente', 'solicitado', 'ensolicitud'].includes(compact)) return 'request_pending';
    if (['denied', 'rechazado', 'rechazada', 'negado'].includes(compact)) return 'denied';
    if (['decommissioned', 'baja', 'retirado', 'descontinuado'].includes(compact)) return 'decommissioned';

    return raw;
};

const normalizeDeviceCategory = (type = '', model = '') => {
    const source = `${type} ${model}`.toLowerCase();
    if (/laptop|notebook/.test(source)) return 'Laptop';
    if (/workstation|desktop|pc|all in one/.test(source)) return 'Workstation';
    if (/monitor|pantalla/.test(source)) return 'Monitor';
    if (/mouse|teclado|keyboard|periferico|perif[eé]rico/.test(source)) return 'Teclado / Mouse';
    if (/switch|router|firewall|ap|access point|red/.test(source)) return 'Switch / Red';
    if (/server|servidor/.test(source)) return 'Servidor';
    if (/phone|smartphone|celular|movil|m[oó]vil/.test(source)) return 'Smartphone';
    if (/printer|impresora/.test(source)) return 'Impresora';
    return 'Otros';
};

const getAssetSerial = (specs = {}) => String(specs.serial_number || specs.serial || specs.ns || '').trim();

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

            const assignedUserIds = [...new Set((data || []).map((a) => a.assigned_to).filter(Boolean))];
            let assignedUsersMap = {};

            if (assignedUserIds.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, location, department')
                    .in('id', assignedUserIds);

                if (!profilesError && profilesData) {
                    assignedUsersMap = profilesData.reduce((acc, p) => {
                        acc[p.id] = {
                            full_name: p.full_name || '',
                            email: p.email || '',
                            location: p.location || '',
                            department: p.department || '',
                        };
                        return acc;
                    }, {});
                }
            }

            return (data || []).map(asset => {
                const specs = asset.specs || {};
                const normalizedStatus = normalizeAssetStatus(asset.status);
                const assignedProfile = asset.assigned_to ? assignedUsersMap[asset.assigned_to] : null;
                const assignedToName =
                    assignedProfile?.full_name ||
                    specs.assigned_user_name ||
                    (asset.assigned_to ? 'Usuario asignado' : '');
                const fixedAssetId = String(specs.asset_fixed_id || '').trim();
                const deviceType = asset.type || specs.asset_type || specs.type || 'General';
                const deviceModel = asset.model || specs.model || '';
                const serial = getAssetSerial(specs);
                const assignedToLocation = assignedProfile?.location || specs.assigned_location || '';
                const assignedToDepartment = assignedProfile?.department || specs.assigned_department || '';
                const storageLocation = specs.storage_location || specs.location || specs.department || '';
                const currentLocation = asset.assigned_to
                    ? (assignedToLocation || assignedToDepartment || 'Con usuario')
                    : (storageLocation || (normalizedStatus === 'available' ? 'Bodega' : 'Infraestructura TI'));
                
                return {
                    id: String(asset.id), 
                    displayId: fixedAssetId || String(asset.id),
                    // Priority: Column -> Specs -> Default
                    type: deviceType,
                    model: deviceModel,
                    brand: specs.brand || '',
                    serial,
                    category: normalizeDeviceCategory(deviceType, deviceModel),
                    specsDetails: specs.details || '',
                    user: assignedToName,
                    assignedToName,
                    assignedToEmail: assignedProfile?.email || '',
                    assignedToLocation,
                    assignedToDepartment,
                    currentLocation,
                    location: storageLocation,
                    assigned_to: asset.assigned_to || null,
                    department: specs.department || '',
                    status: normalizedStatus,
                    condition: asset.condition || 'good',
                    loanDate: specs.loan_date || '',
                    returnDate: specs.return_date || '',
                    loanUser: specs.loan_user || '',
                    rejectReason: specs.reject_reason || '',
                    requestReason: specs.request_reason || '',
                    requestedById: specs.requested_by_id || '',
                    deliveredAt: specs.delivered_at || '',
                    receivedAt: specs.received_at || '',
                    returnedAt: specs.returned_at || '',
                    hostname: specs.hostname || '',
                    extension: specs.extension || ''
                    ,notesHistory: Array.isArray(specs.notes_history) ? specs.notes_history : []
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
                status: normalizeAssetStatus(item.status),
                assigned_to: item.assignedTo ?? item.assigned_to ?? null,
                condition: item.condition || 'good',
                specs: {
                    asset_type: item.type,
                    brand: item.brand || '',
                    model: item.model || '',
                    serial_number: String(item.serial || '').trim(),
                    ns: String(item.serial || '').trim(),
                    category: item.category || '',
                    details: item.specsDetails || '',
                    assigned_user_name: item.user || '',
                    department: item.department || '',
                    storage_location: item.location || '',
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
                ns: updates.serial !== undefined ? String(updates.serial).trim() : currentSpecs.ns,
                category: updates.category !== undefined ? updates.category : currentSpecs.category,
                details: updates.specsDetails !== undefined ? updates.specsDetails : currentSpecs.details,
                assigned_user_name: updates.user !== undefined ? updates.user : currentSpecs.assigned_user_name,
                department: updates.department !== undefined ? updates.department : currentSpecs.department,
                storage_location: updates.location !== undefined ? updates.location : currentSpecs.storage_location,
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
                status: updates.status !== undefined ? normalizeAssetStatus(updates.status) : undefined,
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

    async appendNote(id, noteText, actorName = 'Sistema') {
        try {
            const text = String(noteText || '').trim();
            if (!text) return false;

            const { data: current, error: readErr } = await supabase
                .from('assets')
                .select('specs')
                .eq('id', id)
                .single();

            if (readErr) throw readErr;

            const specs = current?.specs || {};
            const notes = Array.isArray(specs.notes_history) ? specs.notes_history : [];
            const nextNotes = [
                ...notes,
                {
                    at: new Date().toISOString(),
                    by: String(actorName || 'Sistema').trim(),
                    text,
                },
            ].slice(-50);

            const { error } = await supabase
                .from('assets')
                .update({ specs: { ...specs, notes_history: nextNotes } })
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Inventory appendNote error:', error);
            return false;
        }
    },

    /**
     * PERMANENT DELETION: Removes the record from the database.
     * Use only when a record was an error or is no longer needed in any history.
     */
    async remove(id, actorId = null) {
        try {
            const { error } = await supabase.from('assets').delete().eq('id', id);
            if (error) throw error;

            // Audit log: registrar borrado permanente de activo
            if (actorId) {
                await auditService.log(actorId, 'DELETE_ASSET', 'assets', id, { deleted_id: id });
            }

            return true;
        } catch (error) {
            if (import.meta.env.DEV) console.error("Inventory Delete Error:", error);
            return false;
        }
    },

    /**
     * Repara asignaciones de activos importados:
     * - activos sin asignacion pero con specs.assigned_to_email
     * - activos con assigned_to invalido (usuario ya no existe)
     *
     * Si no se puede reconciliar por email, en activos huérfanos se libera
     * el equipo para evitar referencias rotas.
     */
    async repairAssignedTo() {
        try {
            const [{ data: assets, error: assetsError }, { data: profiles, error: profilesError }] = await Promise.all([
                supabase.from('assets').select('id, specs, status, assigned_to'),
                supabase.from('profiles').select('id, email'),
            ]);

            if (assetsError) throw assetsError;
            if (profilesError) throw profilesError;

            const allAssets = assets || [];
            const allProfiles = profiles || [];
            const validUserIds = new Set(allProfiles.map((p) => p.id));
            const emailToId = allProfiles.reduce((acc, p) => {
                const key = String(p.email || '').trim().toLowerCase();
                if (key) acc[key] = p.id;
                return acc;
            }, {});

            const candidates = allAssets.filter((a) => !a.assigned_to || !validUserIds.has(a.assigned_to));
            if (!candidates.length) return { fixed: 0, cleared: 0, total: 0 };

            let fixed = 0;
            let cleared = 0;

            for (const asset of candidates) {
                const email = String(asset.specs?.assigned_to_email || '').trim().toLowerCase();
                const userId = email ? emailToId[email] : null;

                if (userId) {
                    const { error: updateErr } = await supabase
                        .from('assets')
                        .update({ assigned_to: userId, status: 'active' })
                        .eq('id', asset.id);

                    if (!updateErr) fixed++;
                    continue;
                }

                // Solo liberar cuando realmente hay referencia huérfana (ID inválido)
                if (asset.assigned_to && !validUserIds.has(asset.assigned_to)) {
                    const { error: clearErr } = await supabase
                        .from('assets')
                        .update({ assigned_to: null, status: 'available' })
                        .eq('id', asset.id);

                    if (!clearErr) cleared++;
                }
            }

            return { fixed, cleared, total: candidates.length };
        } catch (error) {
            console.error('repairAssignedTo error:', error);
            return { fixed: 0, total: 0, error: error.message };
        }
    }
};
