import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';

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
        const required = ['asset_type', 'brand', 'model', 'serial_number'];
        const missing = required.filter(h => !headers.some(header => header.toLowerCase() === h.toLowerCase()));

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
        if (!row.asset_type && !row.Type && !row.Tipo) errors.push('Falta Tipo de Equipo (asset_type)');
        if (!row.model && !row.Model) errors.push('Falta Modelo (model)');
        if (!row.brand && !row.Marca && !row.marca) errors.push('Falta Marca (brand)');
        if (!row.serial_number && !row.Serial && !row.Serie) errors.push('Falta Número de Serie');
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
                if (!row.status) status = 'in_use';
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
        if (type === 'inventory') {
            const { data: usersData } = await supabase.from('profiles').select('id, email');
            allUsers = usersData || [];
        }

        const inventoryCreates = [];

        for (const row of data) {
            if (row._action === 'skip') { duplicateCount++; continue; }

            try {
                if (type === 'users') {
                    const ALLOWED_IMPORT_ROLES = ['user', 'operativo', 'operador'];
                    const importedRole = (row.role || row.Rol || '').toString().toLowerCase().trim();
                    const safeRole = ALLOWED_IMPORT_ROLES.includes(importedRole) ? importedRole : 'user';

                    const payload = {
                        full_name: row.name || row.Name || row.Nombre,
                        email: row.email || row.Email,
                        department: row.department || row.Department || row.Departamento || 'General',
                        role: safeRole
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

                } else if (type === 'inventory') {
                    const payload = this.buildInventoryPayload(row, allUsers, fileName);

                    if (row._action === 'update' && row._existingId) {
                        const { error } = await supabase.from('assets').update(payload).eq('id', row._existingId);
                        if (error) throw error;
                        updateCount++;
                    } else {
                        inventoryCreates.push(payload);
                    }
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
    }
};