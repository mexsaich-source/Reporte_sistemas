import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';

const normalizeImportedDepartment = (rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return 'General';

    const value = raw.toLowerCase();
    if (value.includes('ama de llav')) return 'Ama de Llaves';
    if (value.includes('banquete')) return 'Banquetes';
    if (value.includes('evento')) return 'Eventos';
    if (value.includes('compra')) return 'Compras';
    if (value.includes('mantenimiento')) return 'Mantenimiento';
    if (value.includes('ingenieria') || value.includes('ingeniería')) return 'Ingeniería';
    if (value.includes('sistema')) return 'Sistemas';
    if (value.includes('recursos') || value.includes('rrhh')) return 'Recursos Humanos';
    if (value.includes('finanza')) return 'Finanzas';
    if (value.includes('general')) return 'General';

    return raw;
};

const norm = (v) => String(v ?? '').trim();

const getValueByKeys = (row, keys = []) => {
    const map = Object.entries(row || {}).reduce((acc, [k, v]) => {
        acc[String(k).toLowerCase().trim()] = v;
        return acc;
    }, {});
    for (const key of keys) {
        const value = map[String(key).toLowerCase().trim()];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
};

const normalizeInputRow = (row = {}) => ({
    employee_id: norm(getValueByKeys(row, ['employee_id', 'team_member', 'team member', 'numero team member', 'número team member', 'id_empleado'])),
    name: norm(getValueByKeys(row, ['name', 'nombre', 'full_name', 'full name'])),
    email: norm(getValueByKeys(row, ['email', 'correo', 'mail'])).toLowerCase(),
    department: normalizeImportedDepartment(getValueByKeys(row, ['department', 'departamento', 'area', 'área'])),
    position: norm(getValueByKeys(row, ['position', 'puesto', 'cargo'])),
    location: norm(getValueByKeys(row, ['location', 'localizacion', 'localización', 'ubicacion', 'ubicación', 'ubicación física', 'localización física'])),
    assigned_equipment: norm(getValueByKeys(row, ['assigned_equipment', 'equipos', 'equipos asignados'])),
    status: norm(getValueByKeys(row, ['status', 'estado'])) || 'active',
    role: norm(getValueByKeys(row, ['role', 'rol'])) || 'user',

    asset_id: norm(getValueByKeys(row, ['asset_id', 'id_activo', 'id', 'asset id'])),
    asset_type: norm(getValueByKeys(row, ['asset_type', 'tipo', 'type'])),
    brand: norm(getValueByKeys(row, ['brand', 'marca'])),
    model: norm(getValueByKeys(row, ['model', 'modelo'])),
    serial_number: norm(getValueByKeys(row, ['serial_number', 'serial', 'serie', 'numero de serie', 'número de serie'])),
    inventory_tag: norm(getValueByKeys(row, ['inventory_tag', 'placa', 'tag', 'etiqueta inventario'])),
    hostname: norm(getValueByKeys(row, ['hostname', 'host'])),
    purchase_date: norm(getValueByKeys(row, ['purchase_date', 'fecha compra', 'fecha de compra'])),
    assigned_to_email: norm(getValueByKeys(row, ['assigned_to_email', 'correo asignado (opcional)', 'asignado_a', 'asignado a'])).toLowerCase(),
});

const detectEntityType = (row) => {
    const hasUserSignal = Boolean(row.email || row.name || row.employee_id || row.position);
    const hasAssetSignal = Boolean(row.serial_number || row.asset_id || row.asset_type || row.brand || row.model || row.inventory_tag || row.hostname);

    if (hasAssetSignal && !hasUserSignal) return 'inventory';
    if (hasUserSignal && !hasAssetSignal) return 'user';
    if (hasAssetSignal && hasUserSignal) return (row.serial_number || row.asset_id) ? 'inventory' : 'user';
    return 'unknown';
};

export const importService = {
    /**
     * Parse Excel file into JSON
     */
    parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    resolve(json);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Validate columns for Users
     */
    validateUserColumns(data) {
        if (data.length === 0) return { valid: false, error: 'El archivo está vacío' };
        const headers = Object.keys(data[0]);
        const required = ['email', 'name'];
        const missing = required.filter(h => !headers.some(header => header.toLowerCase() === h.toLowerCase()));
        return { valid: missing.length === 0, missing: missing, headers: headers };
    },

    /**
     * Validate columns for Inventory
     */
    validateInventoryColumns(data) {
        if (data.length === 0) return { valid: false, error: 'El archivo está vacío' };
        const headers = Object.keys(data[0]);

        if (!headers.some(h => h.toLowerCase().includes('serial'))) {
            return { valid: false, missing: ['serial_number (Número de Serie)'] };
        }
        return { valid: true, headers: headers };
    },

    /**
     * Duplicate detection and preview for Users
     */
    async previewUsers(data) {
        const { data: existingUsers } = await supabase.from('profiles').select('id, email, full_name, department');
        return data.map(row => {
            const email = row.email || row.Email;
            const duplicate = (existingUsers || []).find(u => email && u.email.toLowerCase() === email.toLowerCase());

            return {
                ...row,
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create',
                _errors: this.getUserErrors(row)
            };
        });
    },

    async previewMixed(data) {
        const [{ data: existingUsers }, { data: existingAssets }] = await Promise.all([
            supabase.from('profiles').select('id, email, full_name, department'),
            supabase.from('assets').select('id, specs'),
        ]);

        const normalizedRows = data.map((raw) => normalizeInputRow(raw));

        const emailsToMatch = [...new Set(normalizedRows
            .flatMap((r) => [r.email, r.assigned_to_email])
            .filter(Boolean)
            .map((e) => e.toLowerCase()))];

        let usersMap = {};
        if (emailsToMatch.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name')
                .in('email', emailsToMatch);
            (profiles || []).forEach((p) => {
                usersMap[String(p.email || '').toLowerCase()] = { id: p.id, name: p.full_name };
            });
        }

        return normalizedRows.map((row) => {
            const entityType = detectEntityType(row);
            if (entityType === 'unknown') {
                return {
                    ...row,
                    _entityType: 'unknown',
                    _status: 'new',
                    _existingId: null,
                    _action: 'skip',
                    _errors: ['No se detectó si la fila es usuario o inventario. Completa email/nombre o serial/modelo en vista previa.'],
                };
            }

            if (entityType === 'user') {
                const duplicate = (existingUsers || []).find((u) => row.email && String(u.email || '').toLowerCase() === row.email.toLowerCase());
                return {
                    ...row,
                    _entityType: 'user',
                    _status: duplicate ? 'duplicate' : 'new',
                    _existingId: duplicate ? duplicate.id : null,
                    _action: duplicate ? 'update' : 'create',
                    _errors: this.getUserErrors(row),
                };
            }

            const duplicate = (existingAssets || []).find((a) =>
                (row.asset_id && String(a.id) === row.asset_id) ||
                (row.serial_number && a.specs?.serial_number === row.serial_number)
            );

            const matched = row.assigned_to_email ? usersMap[row.assigned_to_email] : null;
            return {
                ...row,
                _entityType: 'inventory',
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create',
                _errors: this.getInventoryErrors(row),
                _assignee_email: row.assigned_to_email || null,
                _assignee_name: matched ? matched.name : null,
                assigned_to: matched ? matched.id : null,
            };
        });
    },

    getUserErrors(row) {
        const errors = [];
        if (!row.email && !row.Email) errors.push('Falta el correo (email)');
        if (!row.name && !row.Name && !row.full_name) errors.push('Falta el nombre (name)');
        return errors;
    },

    /**
     * Duplicate detection and preview for Inventory (CON BÚSQUEDA DE USUARIOS)
     */
    async previewInventory(data) {
        const { data: existingAssets } = await supabase.from('assets').select('id, specs');

        // NUEVO: Extraer correos del Excel para previsualizar si existen en la BD
        const emails = [...new Set(data.map(r => r.assigned_to_email || r['Correo Asignado (Opcional)'] || r.Asignado_A).filter(Boolean).map(e => String(e).trim().toLowerCase()))];
        let usersMap = {};

        if (emails.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('email', emails);
            if (profiles) {
                profiles.forEach(p => {
                    usersMap[p.email.toLowerCase()] = { id: p.id, name: p.full_name };
                });
            }
        }

        return data.map(row => {
            const serial = String(row.serial_number || row.Serial || row.Serie || '').trim();
            const assetId = String(row.asset_id || row.id || '').trim();

            const duplicate = (existingAssets || []).find(a =>
                (assetId && String(a.id) === assetId) ||
                (serial && a.specs?.serial_number === serial)
            );

            // NUEVO: Verificamos si el correo del excel coincide con algún usuario
            const emailRaw = row.assigned_to_email || row['Correo Asignado (Opcional)'] || row.Asignado_A;
            const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
            const matchedUser = email ? usersMap[email] : null;

            return {
                ...row,
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create',
                _errors: this.getInventoryErrors(row),
                // Variables para la UI:
                _assignee_email: email,
                _assignee_name: matchedUser ? matchedUser.name : null,
                assigned_to: matchedUser ? matchedUser.id : null
            };
        });
    },

    getInventoryErrors(row) {
        const errors = [];
        if (!row.serial_number && !row.Serial && !row.Serie && !row.asset_id) errors.push('Falta Número de Serie o ID de activo');
        if (!row.asset_type && !row.Type && !row.Tipo && !row.model && !row.Model) errors.push('Falta Tipo o Modelo de equipo');
        return errors;
    },

    /**
     * Agrupa la previsualización por correo de asignación: un mismo usuario puede tener N filas (N equipos).
     */
    summarizeInventoryAssignees(previewRows) {
        const map = new Map();
        for (const row of previewRows) {
            const email = (row._assignee_email || '').toLowerCase();
            if (!email) continue;
            if (!map.has(email)) map.set(email, { email, count: 0, matched: !!row.assigned_to, name: row._assignee_name || null });
            const e = map.get(email);
            e.count += 1;
            e.matched = e.matched || !!row.assigned_to;
            if (row._assignee_name) e.name = row._assignee_name;
        }
        return [...map.values()].sort((a, b) => b.count - a.count);
    },

    buildInventoryPayload(row, allUsers, fileName) {
        const rawId = row.asset_id || row.id || row.ID;
        const finalId = rawId ? String(rawId) : `AST-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`;

        let assignedUserId = null;
        let status = row.status || 'available';
        const assignedEmail = (row.assigned_to_email || row['Correo Asignado (Opcional)'] || row.Asignado_A || '').toString().trim().toLowerCase();
        if (assignedEmail) {
            const foundUser = allUsers.find((u) => u.email.toLowerCase() === assignedEmail);
            if (foundUser) {
                assignedUserId = foundUser.id;
                if (!row.status) status = 'active';
            }
        }

        return {
            id: finalId,
            type: row.asset_type || row.Type || row.Tipo || 'Equipment',
            model: row.model || row.Model || 'Desconocido',
            status,
            assigned_to: assignedUserId,
            specs: {
                serial_number: String(row.serial_number || row.Serial || row.Serie || '').trim(),
                brand: row.brand || row.Marca || 'Desconocida',
                category: row.asset_type || row.Type || 'Hardware',
                model: row.model || row.Model || '',
                inventory_tag: row.inventory_tag || row.Placa || '',
                details: `Importado de ${fileName}`
            }
        };
    },

    /**
     * Process bulk import
     */
    async processImport(type, data, adminId, fileName) {
        let newCount = 0, updateCount = 0, errorCount = 0, duplicateCount = 0;

        let allUsers = [];
        if (type === 'inventory' || type === 'mixed') {
            const { data: usersData } = await supabase.from('profiles').select('id, email');
            allUsers = usersData || [];
        }

        const inventoryCreates = [];

        for (const row of data) {
            if (row._action === 'skip') { duplicateCount++; continue; }

            try {
                if (type === 'users' || (type === 'mixed' && row._entityType === 'user')) {
                    const ALLOWED_IMPORT_ROLES = ['user', 'operativo', 'operador'];
                    const importedRole = (row.role || row.Rol || '').toString().toLowerCase().trim();
                    const safeRole = ALLOWED_IMPORT_ROLES.includes(importedRole) ? importedRole : 'user';

                    const payload = {
                        full_name: row.name || row.Name || row.Nombre,
                        email: row.email || row.Email,
                        department: normalizeImportedDepartment(row.department || row.Department || row.Departamento || 'General'),
                        role: safeRole,
                        location:
                            row.location ||
                            row.Location ||
                            row.localizacion ||
                            row.Localizacion ||
                            row['Localización'] ||
                            row.Ubicacion ||
                            row['Ubicación'] ||
                            row['Ubicación Física'] ||
                            row['Localización Física'] ||
                            null,
                        assigned_equipment: row.assigned_equipment || row.Assigned_Equipment || row.Equipos || row['Equipos Asignados'] || null,
                    };

                    if (row._action === 'update' && row._existingId) {
                        const { error } = await supabase.from('profiles').update(payload).eq('id', row._existingId);
                        if (error) throw error;
                        updateCount++;
                    } else {
                        const { error } = await supabase.from('profiles').insert([payload]);
                        if (error) throw error;
                        newCount++;
                    }

                } else if (type === 'inventory' || (type === 'mixed' && row._entityType === 'inventory')) {
                    const payload = this.buildInventoryPayload(row, allUsers, fileName);

                    if (row._action === 'update' && row._existingId) {
                        const { error } = await supabase.from('assets').update(payload).eq('id', row._existingId);
                        if (error) throw error;
                        updateCount++;
                    } else {
                        inventoryCreates.push(payload);
                    }
                } else if (type === 'mixed' && row._entityType === 'unknown') {
                    errorCount++;
                }
            } catch (err) {
                console.error(`Error importing row:`, err);
                errorCount++;
            }
        }

        const CHUNK = 50;
        for (let i = 0; i < inventoryCreates.length; i += CHUNK) {
            const chunk = inventoryCreates.slice(i, i + CHUNK);
            const { error } = await supabase.from('assets').insert(chunk);
            if (error) {
                for (const payload of chunk) {
                    try {
                        const { error: oneErr } = await supabase.from('assets').insert([payload]);
                        if (oneErr) throw oneErr;
                        newCount++;
                    } catch (e) {
                        console.error('Error importando asset:', e);
                        errorCount++;
                    }
                }
            } else {
                newCount += chunk.length;
            }
        }

        return { newCount, updateCount, duplicateCount, errorCount };
    },

    async getAssignmentDiagnostics() {
        const [{ data: profiles, error: profilesError }, { data: assets, error: assetsError }] = await Promise.all([
            supabase.from('profiles').select('id, full_name, email, role, status').eq('status', true),
            supabase.from('assets').select('id, type, model, status, assigned_to, specs'),
        ]);

        if (profilesError) throw profilesError;
        if (assetsError) throw assetsError;

        const userRows = profiles || [];
        const assetRows = assets || [];

        const eligibleRoles = new Set(['user', 'tech', 'operativo', 'operador', 'jefe_mantenimiento']);
        const eligibleUsers = userRows.filter((u) => eligibleRoles.has(String(u.role || '').toLowerCase()));

        const userIdSet = new Set(userRows.map((u) => u.id));
        const assignedByUser = new Map();
        const orphanAssets = [];
        const availableAssets = [];

        for (const asset of assetRows) {
            if (asset.assigned_to) {
                if (!userIdSet.has(asset.assigned_to)) {
                    orphanAssets.push(asset);
                } else {
                    assignedByUser.set(asset.assigned_to, (assignedByUser.get(asset.assigned_to) || 0) + 1);
                }
            } else {
                availableAssets.push(asset);
            }
        }

        const usersWithoutAssets = eligibleUsers.filter((u) => !assignedByUser.get(u.id));

        const toAssetLabel = (asset) => {
            const specs = asset.specs || {};
            const label = [
                specs.brand || null,
                asset.model || specs.model || null,
                specs.serial_number || specs.serial || null,
            ].filter(Boolean).join(' · ');
            return label || `${asset.type || 'Equipo'} · ${asset.id}`;
        };

        const coverage = eligibleUsers.length > 0
            ? Math.round(((eligibleUsers.length - usersWithoutAssets.length) / eligibleUsers.length) * 100)
            : 100;

        return {
            totals: {
                eligibleUsers: eligibleUsers.length,
                usersWithoutAssets: usersWithoutAssets.length,
                orphanAssets: orphanAssets.length,
                availableAssets: availableAssets.length,
                coverage,
            },
            usersWithoutAssets: usersWithoutAssets.map((u) => ({
                id: u.id,
                full_name: u.full_name,
                email: u.email,
                role: u.role,
            })),
            orphanAssets: orphanAssets.map((a) => ({
                id: a.id,
                assigned_to: a.assigned_to,
                label: toAssetLabel(a),
            })),
            availableAssets: availableAssets.map((a) => ({
                id: a.id,
                label: toAssetLabel(a),
            })),
        };
    },

    async quickAssignAsset(userId, assetId) {
        const { data: currentAsset, error: fetchError } = await supabase
            .from('assets')
            .select('id, assigned_to')
            .eq('id', assetId)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!currentAsset) throw new Error('Equipo no encontrado.');
        if (currentAsset.assigned_to && currentAsset.assigned_to !== userId) {
            throw new Error('El equipo ya fue asignado a otro usuario.');
        }

        const { error } = await supabase
            .from('assets')
            .update({ assigned_to: userId, status: 'active' })
            .eq('id', assetId);

        if (error) throw error;
        return true;
    },

    async clearOrphanAsset(assetId) {
        const { error } = await supabase
            .from('assets')
            .update({ assigned_to: null, status: 'available' })
            .eq('id', assetId);

        if (error) throw error;
        return true;
    }
};