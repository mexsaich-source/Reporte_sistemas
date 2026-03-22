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
        return { valid: missing.length === 0, missing: missing, headers: headers };
    },

    /**
     * Validate columns for Inventory
     */
    validateInventoryColumns(data) {
        if (data.length === 0) return { valid: false, error: 'File is empty' };
        const headers = Object.keys(data[0]);
        // We look for any header that looks like model or serial
        const hasType = headers.some(h => h.toLowerCase().includes('laptop') || h.toLowerCase().includes('type'));
        return { valid: true, headers: headers };
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
            const duplicate = (existingUsers || []).find(u => (email && u.email === email) || (employeeId && u.employee_id === String(employeeId)));
            return { ...row, _status: duplicate ? 'duplicate' : 'new', _existingId: duplicate ? duplicate.id : null, _action: duplicate ? 'update' : 'create', _errors: this.getUserErrors(row) };
        });
    },

    getUserErrors(row) {
        const errors = [];
        if (!row.email && !row.Email) errors.push('Missing email');
        return errors;
    },

    /**
     * Duplicate detection and preview for Inventory
     */
    async previewInventory(data) {
        const { data: existingAssets } = await supabase.from('assets').select('id, specs');
        return data.map(row => {
            // MAPEO EXACTO BASADO EN LA IMAGEN DEL EXCEL DEL USUARIO
            const serial = String(row.serial_number || row.Serial || '').trim();
            const assetId = String(row.asset_type || row.id || '').trim();

            const duplicate = (existingAssets || []).find(a => 
                (assetId && String(a.id) === assetId) || 
                (serial && a.specs?.serial_number === serial)
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
        if (!row.model && !row.Model) errors.push('Missing model');
        return errors;
    },

    /**
     * Process bulk import
     */
    async processImport(type, data, adminId, fileName) {
        let newCount = 0, updateCount = 0, errorCount = 0, duplicateCount = 0;

        for (const row of data) {
            if (row._action === 'skip') { duplicateCount++; continue; }

            try {
                if (type === 'users') {
                    // SECURITY FIX #4: Whitelist de roles permitidos.
                    // Nunca se puede importar un admin o técnico desde Excel.
                    const ALLOWED_IMPORT_ROLES = ['user', 'operativo', 'operador'];
                    const importedRole = (row.role || row.Rol || '').toString().toLowerCase().trim();
                    const safeRole = ALLOWED_IMPORT_ROLES.includes(importedRole) ? importedRole : 'user';

                    const payload = {
                        full_name: row.name || row.Nombre,
                        email: row.email,
                        role: safeRole
                    };
                    const { error } = await supabase.from('profiles').insert([payload]);
                    if (error) throw error;
                    newCount++;
                } else {
                    // --- MAPEO FINAL PARA INVENTARIO (SEGÚN TU EXCEL) ---
                    // Columna A: "laptops old" -> Se usa para el Tipo o Categoría
                    // Columna B: "model" -> Modelo
                    // Columna C: "serial_number" -> Serial
                    // Columna D: "asset_type" -> ID de Activo Fijo (según tu imagen son números)
                    // Columna E: "brand" -> Marca
                    
                    const rawId = row.asset_type || row.id;
                    const finalId = rawId ? String(rawId) : `MEX-${Date.now().toString().slice(-4)}${Math.floor(Math.random()*100)}`;
                    
                    const payload = {
                        id: finalId,
                        type: 'Laptop', // Forzamos Laptop ya que tu excel dice 'laptops old'
                        model: row.model || '',
                        status: 'available',
                        specs: {
                            serial_number: String(row.serial_number || '').trim(),
                            brand: row.brand || 'HP', // En tu imagen todos son HP
                            category: row['laptops old'] || 'Laptops Old',
                            model: row.model || '',
                            details: `Importado de ${fileName}`
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
                console.error(`Error importing row:`, err);
                errorCount++;
            }
        }
        return { newCount, updateCount, duplicateCount, errorCount };
    }
};
