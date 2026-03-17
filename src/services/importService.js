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
                    const json = XLSX.utils.sheet_to_json(worksheet);
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
        const required = ['name', 'email', 'department'];
        if (data.length === 0) return { valid: false, error: 'File is empty' };

        const headers = Object.keys(data[0]);
        const missing = required.filter(h => !headers.some(header => header.toLowerCase() === h.toLowerCase()));

        return {
            valid: missing.length === 0,
            missing: missing,
            headers: headers
        };
    },

    /**
     * Validate columns for Inventory
     */
    validateInventoryColumns(data) {
        const required = ['asset_type', 'brand', 'model', 'serial_number'];
        if (data.length === 0) return { valid: false, error: 'File is empty' };

        const headers = Object.keys(data[0]);
        const missing = required.filter(h => !headers.some(header => header.toLowerCase() === h.toLowerCase()));

        return {
            valid: missing.length === 0,
            missing: missing,
            headers: headers
        };
    },

    /**
     * Duplicate detection and preview for Users
     */
    async previewUsers(data) {
        const { data: existingUsers } = await supabase.from('profiles').select('id, email, employee_id, full_name, department');

        return data.map(row => {
            const email = row.email || row.Email;
            const employeeId = row.employee_id || row.Employee_ID || row.id_empleado;
            const name = row.name || row.Name || row.full_name || row.Nombre;
            const dept = row.department || row.Department || row.Departamento;

            const duplicate = existingUsers.find(u =>
                (email && u.email === email) ||
                (employeeId && u.employee_id === String(employeeId)) ||
                (name && dept && u.full_name === name && u.department === dept)
            );

            return {
                ...row,
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create', // Default action
                _errors: this.getUserErrors(row)
            };
        });
    },

    getUserErrors(row) {
        const errors = [];
        if (!row.email && !row.Email) errors.push('Missing email');
        if (!row.name && !row.Name && !row.full_name && !row.Nombre) errors.push('Missing name');
        return errors;
    },

    /**
     * Duplicate detection and preview for Inventory
     */
    async previewInventory(data) {
        const { data: existingAssets } = await supabase.from('assets').select('id, serial_number, inventory_tag, hostname');

        return data.map(row => {
            const serial = row.serial_number || row.Serial || row.Serie;
            const assetId = row.asset_id || row.Asset_ID || row.id;
            const tag = row.inventory_tag || row.Tag;
            const hostname = row.hostname;

            const duplicate = existingAssets.find(a =>
                (serial && a.serial_number === String(serial)) ||
                (assetId && a.id === String(assetId)) ||
                (tag && a.inventory_tag === String(tag)) ||
                (hostname && a.hostname === String(hostname))
            );

            return {
                ...row,
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create',
                _errors: this.getInventoryErrors(row)
            };
        });
    },

    getInventoryErrors(row) {
        const errors = [];
        if (!row.asset_type && !row.type && !row.Tipo) errors.push('Missing asset type');
        if (!row.brand && !row.Marca) errors.push('Missing brand');
        if (!row.model && !row.Modelo) errors.push('Missing model');
        return errors;
    },

    /**
     * Process bulk import
     */
    async processImport(type, data, adminId, fileName) {
        let newCount = 0;
        let updateCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;

        const results = [];

        for (const row of data) {
            if (row._action === 'skip') {
                duplicateCount++;
                continue;
            }

            try {
                if (type === 'users') {
                    const payload = {
                        full_name: row.name || row.Name || row.full_name || row.Nombre,
                        email: row.email || row.Email,
                        employee_id: String(row.employee_id || row.Employee_ID || row.id_empleado || ''),
                        department: row.department || row.Department || row.Departamento || 'General',
                        position: row.position || row.Position || row.Puesto,
                        location: row.location || row.Location || row.Ubicación,
                        status: row.status || row.Status || 'active',
                        role: row.role?.toLowerCase() || 'user'
                    };

                    if (row._action === 'update' && row._existingId) {
                        const { error } = await supabase.from('profiles').update(payload).eq('id', row._existingId);
                        if (error) throw error;
                        updateCount++;
                    } else {
                        // For new users, we don't handle Auth here automatically to avoid bulk password issues.
                        // We record them in profiles, and they might need invite or password reset.
                        const { error } = await supabase.from('profiles').insert([payload]);
                        if (error) throw error;
                        newCount++;
                    }
                } else {
                    // Inventory
                    const payload = {
                        id: String(row.asset_id || row.Asset_ID || row.id || ''),
                        type: row.asset_type || row.type || row.Tipo,
                        brand: row.brand || row.Marca,
                        model: row.model || row.Modelo,
                        serial_number: String(row.serial_number || row.Serial || row.Serie || ''),
                        status: (row.status || row.Status || 'available').toLowerCase(),
                        purchase_date: row.purchase_date || null,
                        inventory_tag: String(row.inventory_tag || row.Tag || ''),
                        hostname: String(row.hostname || ''),
                        specs: {
                            condition: row.condition || 'good',
                            department: row.department || row.Department || 'General'
                        }
                    };

                    if (row._action === 'update' && row._existingId) {
                        const { error } = await supabase.from('assets').update(payload).eq('id', row._existingId);
                        if (error) throw error;
                        updateCount++;
                    } else {
                        const { error } = await supabase.from('assets').insert([payload]);
                        if (error) throw error;
                        newCount++;
                    }
                }
            } catch (err) {
                console.error(`Error importing row:`, err, row);
                errorCount++;
            }
        }

        // Log the import
        await supabase.from('import_logs').insert([{
            user_id: adminId,
            file_name: fileName,
            import_type: type,
            new_records: newCount,
            updated_records: updateCount,
            duplicates: duplicateCount,
            errors: errorCount
        }]);

        return { newCount, updateCount, duplicateCount, errorCount };
    }
};
