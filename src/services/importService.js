import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { userService } from './userService';

const normalizeImportedDepartment = (rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return 'General';

    const value = raw.toLowerCase().replace(/[.\s]/g, '');

    // Abreviaciones de hotel (excel de inventario)
    if (value === 'bqt') return 'Banquetes';
    if (value === 'mkt') return 'Marketing';
    if (value === 'fin') return 'Finanzas';
    if (value === 'sec') return 'Seguridad';
    if (value === 'eng') return 'Ingeniería';
    if (value === 'fo') return 'Front Office';
    if (value === 'fro') return 'Front Office';
    if (value === 'fom') return 'FOM';
    if (value === 'mz') return 'Mezzanine';
    if (value === 'site') return 'Sistemas';
    if (value === 'rsv') return 'Reservaciones';
    if (value === 'prc') return 'Compras';
    if (value === 'hsk') return 'Ama de Llaves';
    if (value === 'f&b' || value === 'f&') return 'F&B';
    if (value === 'rrhh' || value === 'rr.hh') return 'Recursos Humanos';

    // Palabras completas
    if (value.includes('amadellav')) return 'Ama de Llaves';
    if (value.includes('banquete')) return 'Banquetes';
    if (value.includes('evento')) return 'Eventos';
    if (value.includes('compra')) return 'Compras';
    if (value.includes('mantenimiento')) return 'Mantenimiento';
    if (value.includes('ingenieria') || value.includes('ingeniería')) return 'Ingeniería';
    if (value.includes('sistema')) return 'Sistemas';
    if (value.includes('recursos') || value.includes('recursoshumanos')) return 'Recursos Humanos';
    if (value.includes('finanza')) return 'Finanzas';
    if (value.includes('general')) return 'General';
    if (value.includes('marketing')) return 'Marketing';
    if (value.includes('seguridad')) return 'Seguridad';
    if (value.includes('reserva')) return 'Reservaciones';

    return raw;
};

const norm = (v) => String(v ?? '').trim();

const stripAccents = (value = '') =>
    String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const normalizeLookupKey = (value = '') =>
    stripAccents(String(value || '').toLowerCase().trim())
        .replace(/[^a-z0-9]/g, '');

const normalizePersonName = (value = '') =>
    stripAccents(String(value || '').toLowerCase().trim())
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const isProbablyEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const sanitizeImportedEmail = (value = '') => {
    const email = String(value || '').trim().toLowerCase();
    return isProbablyEmail(email) ? email : '';
};

const normalizeSerialValue = (value = '') =>
    String(value || '')
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase();

const levenshteinDistance = (a = '', b = '') => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
};

const getValueByKeys = (row, keys = []) => {
    const entries = Object.entries(row || {}).map(([k, v]) => ({
        rawKey: String(k),
        normalizedKey: normalizeLookupKey(k),
        value: v,
    }));

    const nonEmpty = (value) => value !== undefined && value !== null && String(value).trim() !== '';
    const candidates = keys.map((k) => normalizeLookupKey(k)).filter(Boolean);

    // 1) Match exacto normalizado
    for (const key of candidates) {
        const hit = entries.find((entry) => entry.normalizedKey === key && nonEmpty(entry.value));
        if (hit) return hit.value;
    }

        // 2) Match por inclusión para llaves largas (evita falsos positivos como hostNAME -> name)
    for (const key of candidates) {
            if (key.length < 6) continue;
        const hit = entries.find((entry) => {
            if (!nonEmpty(entry.value)) return false;
                return entry.normalizedKey.includes(key);
        });
        if (hit) return hit.value;
    }

    // 3) Match fuzzy para typos en encabezados (ej: "ususarios" vs "usuarios")
    let best = null;
    for (const key of candidates) {
        if (key.length < 5) continue;
        for (const entry of entries) {
            if (!entry.normalizedKey || !nonEmpty(entry.value)) continue;
            const distance = levenshteinDistance(entry.normalizedKey, key);
            const maxDistance = key.length >= 10 ? 3 : 2;
            if (distance <= maxDistance) {
                if (!best || distance < best.distance) {
                    best = { distance, value: entry.value };
                }
            }
        }
    }

    if (best) return best.value;

    return '';
};

const buildProfileMaps = (profiles = []) => {
    const byEmail = {};
    const byName = {};

    (profiles || []).forEach((p) => {
        const emailKey = sanitizeImportedEmail(p.email);
        const nameKey = normalizePersonName(p.full_name || '');
        if (emailKey) byEmail[emailKey] = { id: p.id, name: p.full_name || null, email: p.email || null };
        if (nameKey && !byName[nameKey]) byName[nameKey] = { id: p.id, name: p.full_name || null, email: p.email || null };
    });

    return { byEmail, byName };
};

const resolveAssigneeFromMaps = (row, maps) => {
    const email = sanitizeImportedEmail(row.assigned_to_email);
    if (email && maps.byEmail[email]) {
        return { profile: maps.byEmail[email], resolvedEmail: email, resolvedName: maps.byEmail[email].name || null };
    }

    const nameCandidate = normalizePersonName(row.assigned_to_name || row.user_display_name || row.name || '');
    if (!nameCandidate) return { profile: null, resolvedEmail: email || null, resolvedName: null };

    if (maps.byName[nameCandidate]) {
        const profile = maps.byName[nameCandidate];
        return {
            profile,
            resolvedEmail: sanitizeImportedEmail(profile.email) || email || null,
            resolvedName: profile.name || null,
        };
    }

    // Fuzzy para nombres abreviados o con typo menor
    let best = null;
    for (const [nameKey, profile] of Object.entries(maps.byName)) {
        const distance = levenshteinDistance(nameCandidate, nameKey);
        const maxDistance = nameCandidate.length >= 12 ? 3 : 2;
        if (distance <= maxDistance) {
            if (!best || distance < best.distance) best = { distance, profile };
        }
    }

    if (best?.profile) {
        return {
            profile: best.profile,
            resolvedEmail: sanitizeImportedEmail(best.profile.email) || email || null,
            resolvedName: best.profile.name || row.assigned_to_name || row.user_display_name || row.name || null,
        };
    }

    return {
        profile: null,
        resolvedEmail: email || null,
        resolvedName: row.assigned_to_name || row.user_display_name || row.name || null,
    };
};

const normalizeInputRow = (row = {}) => {
    const rowName = norm(getValueByKeys(row, ['name', 'nombre', 'full_name', 'full name', 'empleado', 'colaborador', 'usuario', 'nombre usuario', 'nombre de usuario']));
    const emailRaw = sanitizeImportedEmail(getValueByKeys(row, ['email', 'correo', 'mail', 'e-mail', 'correo electronico', 'correo electrónico']));
    const assignedRaw = norm(getValueByKeys(row, [
        'assigned_to_email',
        'correo asignado (opcional)',
        'asignado_a',
        'asignado a',
        'correo asignado',
        'email asignado',
    ]));
    const assignedEmailRaw = sanitizeImportedEmail(assignedRaw);
    const userDisplayName = norm(getValueByKeys(row, [
        'usuario',
        'usuarios',
        'ususario',
        'ususarios',
        'user',
        'users',
        'nombre usuario',
        'nombre de usuario',
        'colaborador',
        'responsable',
    ]));
    const assignedToNameRaw = norm(getValueByKeys(row, [
        'assigned_to_name',
        'nombre asignado',
        'asignado a nombre',
        'responsable',
        'nombre responsable',
    ]));
    const isDisponible = userDisplayName.toLowerCase() === 'disponible';

    // Para filas de inventario: si no hay columna explícita de asignación pero sí
    // hay una columna "email", asumir que ese email es el destinatario del equipo.
    // Si el usuario es "DISPONIBLE", no asignar.
    const resolvedAssignedEmail = isDisponible
        ? ''
        : (assignedEmailRaw || emailRaw);

    const resolvedAssignedName = isDisponible
        ? ''
        : (assignedToNameRaw || (!assignedEmailRaw && assignedRaw ? assignedRaw : '') || userDisplayName || rowName);

    return {
        employee_id: norm(getValueByKeys(row, ['employee_id', 'team_member', 'team member', 'numero team member', 'número team member', 'id_empleado'])),
        name: rowName,
        email: emailRaw,
        department: normalizeImportedDepartment(getValueByKeys(row, ['department', 'departamento', 'depto', 'dpto', 'dept', 'area', 'área'])),
        position: norm(getValueByKeys(row, ['position', 'puesto', 'cargo', 'job title', 'titulo'])),
        location: norm(getValueByKeys(row, ['location', 'localizacion', 'localización', 'ubicacion', 'ubicación', 'ubicación física', 'localización física'])),
        assigned_equipment: norm(getValueByKeys(row, ['assigned_equipment', 'equipos', 'equipos asignados'])),
        status: norm(getValueByKeys(row, ['status', 'estado'])) || 'active',
        role: norm(getValueByKeys(row, ['role', 'rol', 'perfil', 'tipo usuario', 'tipo de usuario'])) || 'user',

        asset_id: norm(getValueByKeys(row, ['asset_id', 'id_activo', 'id', 'asset id'])),
        asset_type: norm(getValueByKeys(row, ['asset_type', 'tipo', 'type', 'tipo equipo', 'tipo de equipo'])),
        brand: norm(getValueByKeys(row, ['brand', 'marca'])),
        model: norm(getValueByKeys(row, ['model', 'modelo'])),
        // NS, N/S, Serie, serial, serial_number — todas apuntan al mismo campo
        serial_number: normalizeSerialValue(getValueByKeys(row, ['serial_number', 'serial', 'serie', 'numero de serie', 'número de serie', 'ns', 'n/s', 'n.s.', 'n.s', 'no serie', 'no. serie', 'n serie', 'num serie', 'num. serie', 'serial no', 'serial number', 'sn', 's/n'])),
        inventory_tag: norm(getValueByKeys(row, ['inventory_tag', 'placa', 'tag', 'etiqueta inventario', 'placa inventario'])),
        hostname: norm(getValueByKeys(row, ['hostname', 'host', 'host name', 'nombre host', 'nombre de host', 'nombre equipo', 'nombre de equipo', 'computer name', 'pc name'])),
        purchase_date: norm(getValueByKeys(row, ['purchase_date', 'fecha compra', 'fecha de compra'])),
        assigned_to_email: resolvedAssignedEmail,
        assigned_to_name: resolvedAssignedName,
        // Campos extras del Excel de inventario de hotel
        user_display_name: isDisponible ? '' : userDisplayName,
        extension: norm(getValueByKeys(row, ['if', 'ext', 'extension', 'extensión', 'interno', 'ext.'])),
    };
};

const detectEntityType = (row) => {
    const hasAssetSignal = Boolean(row.serial_number || row.asset_id || row.asset_type || row.brand || row.model || row.inventory_tag || row.hostname);

    // En cargas mixtas de inventario suelen venir nombre/email del usuario en la misma fila.
    // Eso NO debe convertir la fila en alta/edición de usuario por sí solo.
    const hasUserIdentity = Boolean(row.email || row.employee_id || row.name);
    const hasExplicitUserPayload = Boolean(
        row.employee_id ||
        row.position ||
        row.assigned_equipment ||
        (row.role && String(row.role).toLowerCase().trim() !== 'user')
    );

    if (hasAssetSignal) {
        return hasExplicitUserPayload ? 'both' : 'inventory';
    }

    if (hasUserIdentity) return 'user';
    return 'unknown';
};

const COLUMN_ALIASES = {
    email: ['email', 'correo', 'mail', 'e-mail', 'correo electronico', 'correo electrónico'],
        name: ['name', 'nombre', 'full_name', 'full name', 'empleado', 'colaborador', 'usuario', 'nombre usuario', 'nombre de usuario'],
    department: ['department', 'departamento', 'depto', 'dpto', 'dept', 'area', 'área'],
    role: ['role', 'rol', 'perfil', 'tipo usuario', 'tipo de usuario'],
    asset_id: ['asset_id', 'id_activo', 'id', 'asset id'],
    asset_type: ['asset_type', 'tipo', 'type', 'tipo equipo', 'tipo de equipo'],
    model: ['model', 'modelo'],
    serial_number: ['serial_number', 'serial', 'serie', 'numero de serie', 'número de serie', 'ns', 'n/s', 'n.s.', 'n.s', 'no serie', 'no. serie', 'n serie', 'num serie', 'num. serie', 'serial no', 'serial number', 'sn', 's/n'],
    hostname: ['hostname', 'host', 'host name', 'nombre host', 'nombre de host', 'nombre equipo', 'nombre de equipo', 'computer name', 'pc name'],
    assigned_to_email: ['assigned_to_email', 'correo asignado (opcional)', 'asignado_a', 'asignado a', 'correo asignado', 'email asignado'],
};

const detectBestHeaderMatch = (headers = [], aliases = []) => {
    const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeLookupKey(h) }));
    const normalizedAliases = aliases.map((a) => normalizeLookupKey(a)).filter(Boolean);

    for (const alias of normalizedAliases) {
        const hit = normalizedHeaders.find((h) => h.norm === alias);
        if (hit) return { header: hit.raw, confidence: 'alta', mode: 'exact' };
    }

    for (const alias of normalizedAliases) {
        if (alias.length < 4) continue;
        const hit = normalizedHeaders.find((h) => h.norm.includes(alias) || alias.includes(h.norm));
        if (hit) return { header: hit.raw, confidence: 'media', mode: 'contains' };
    }

    let best = null;
    for (const alias of normalizedAliases) {
        if (alias.length < 5) continue;
        for (const header of normalizedHeaders) {
            const distance = levenshteinDistance(header.norm, alias);
            const maxDistance = alias.length >= 10 ? 3 : 2;
            if (distance <= maxDistance) {
                if (!best || distance < best.distance) {
                    best = { distance, header: header.raw };
                }
            }
        }
    }

    if (best) return { header: best.header, confidence: 'baja', mode: 'fuzzy' };
    return { header: null, confidence: 'sin match', mode: 'none' };
};

const parseUserStatusBoolean = (rawValue = '') => {
    const value = String(rawValue || '').trim().toLowerCase();
    if (!value) return null;
    if (['true', '1', 'si', 'sí', 'activo', 'active', 'enabled', 'habilitado'].includes(value)) return true;
    if (['false', '0', 'no', 'inactivo', 'inactive', 'disabled', 'suspendido'].includes(value)) return false;
    return null;
};

const buildTempPassword = (email = '') => {
    const seed = String(email || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'User';
    return `${seed}#2026!`;
};

const findProfileByEmailWithRetry = async (email, maxAttempts = 5) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { data } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', email)
            .maybeSingle();

        if (data?.id) return data;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
    return null;
};

const resolveProfileIdByEmail = async (email = '') => {
    const cleanEmail = sanitizeImportedEmail(email);
    if (!cleanEmail) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

    if (error) throw error;
    return data?.id || null;
};

const resolveProfileIdByIdentity = async ({ email = '', name = '' } = {}) => {
    const byEmail = await resolveProfileIdByEmail(email);
    if (byEmail) return byEmail;

    const cleanName = String(name || '').trim();
    if (!cleanName) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', cleanName)
        .limit(1);

    if (error) throw error;
    return data?.[0]?.id || null;
};

const resolveProfileIdFromCache = (allUsers = [], { email = '', name = '' } = {}) => {
    const cleanEmail = sanitizeImportedEmail(email);
    if (cleanEmail) {
        const byEmail = (allUsers || []).find((u) => sanitizeImportedEmail(u.email) === cleanEmail);
        if (byEmail?.id) return byEmail.id;
    }

    const targetName = normalizePersonName(name);
    if (!targetName) return null;

    const candidates = (allUsers || []).filter((u) => u?.full_name);
    for (const u of candidates) {
        if (normalizePersonName(u.full_name) === targetName) return u.id;
    }

    let best = null;
    for (const u of candidates) {
        const current = normalizePersonName(u.full_name);
        if (!current) continue;
        const distance = levenshteinDistance(targetName, current);
        const maxDistance = targetName.length >= 12 ? 3 : 2;
        if (distance <= maxDistance) {
            if (!best || distance < best.distance) {
                best = { distance, id: u.id };
            }
        }
    }

    return best?.id || null;
};

const getAssetMetaEmail = (specs = {}) =>
    String(specs?.assigned_to_email || specs?.assigned_user_email || '')
        .trim()
        .toLowerCase();

const getNormalizedSerial = (row = {}, specs = {}) => {
    const rowSerial = normalizeSerialValue(
        row.serial_number ||
        row.Serial ||
        row.Serie ||
        row.NS ||
        row.ns ||
        ''
    );

    if (rowSerial) return rowSerial;

    const specSerial = normalizeSerialValue(
        specs.serial_number ||
        specs.serial ||
        specs.ns ||
        specs.numero_serie ||
        ''
    );

    return specSerial;
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

    analyzeColumnMapping(data = []) {
        const headers = data.length > 0 ? Object.keys(data[0] || {}) : [];
        const mappings = Object.entries(COLUMN_ALIASES).map(([field, aliases]) => {
            const match = detectBestHeaderMatch(headers, aliases);
            return {
                field,
                aliases,
                detectedHeader: match.header,
                confidence: match.confidence,
                mode: match.mode,
            };
        });

        return {
            headers,
            mappings,
            matched: mappings.filter((m) => !!m.detectedHeader).length,
            total: mappings.length,
        };
    },

    /**
     * Validate columns for Users
     */
    validateUserColumns(data) {
        if (data.length === 0) return { valid: false, error: 'El archivo está vacío' };
        const headers = Object.keys(data[0]);
        const email = getValueByKeys(data[0], ['email', 'correo', 'mail', 'correo electronico', 'correo electrónico']);
        const name = getValueByKeys(data[0], ['name', 'nombre', 'full_name', 'full name', 'empleado', 'colaborador']);
        const missing = [];
        if (!email) missing.push('email/correo');
        if (!name) missing.push('name/nombre');
        return { valid: missing.length === 0, missing, headers };
    },

    /**
     * Validate columns for Inventory
     */
    validateInventoryColumns(data) {
        if (data.length === 0) return { valid: false, error: 'El archivo está vacío' };
        const headers = Object.keys(data[0]).map((h) => normalizeLookupKey(h));

        // Acepta: serial, serial_number, serie, ns, n/s, n.s., no serie
        const serialAliases = ['serial', 'serialnumber', 'serie', 'ns', 'numerodeserie', 'numeroserie', 'noserie'];
        const hasSerial = headers.some((h) =>
            serialAliases.some((alias) => h === alias || h.includes(alias) || levenshteinDistance(h, alias) <= 2)
        );
        if (!hasSerial) {
            return { valid: false, missing: ['serial_number / NS (Número de Serie)'] };
        }
        return { valid: true, headers };
    },

    /**
     * Duplicate detection and preview for Users
     */
    async previewUsers(data) {
        const { data: existingUsers } = await supabase.from('profiles').select('id, email, full_name, department');
        return data.map((rawRow) => {
            const row = normalizeInputRow(rawRow);
            const email = row.email;
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
        const profileMaps = buildProfileMaps(existingUsers || []);

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

            if (entityType === 'user' || entityType === 'both') {
                const duplicate = (existingUsers || []).find((u) => row.email && String(u.email || '').toLowerCase() === row.email.toLowerCase());
                return {
                    ...row,
                    _entityType: entityType,
                    _status: duplicate ? 'duplicate' : 'new',
                    _existingId: duplicate ? duplicate.id : null,
                    _action: duplicate ? 'update' : 'create',
                    _errors: this.getUserErrors(row),
                };
            }

            const duplicate = (existingAssets || []).find((a) =>
                (row.asset_id && String(a.id) === row.asset_id) ||
                (row.serial_number && normalizeSerialValue(a.specs?.serial_number || a.specs?.serial || a.specs?.ns) === normalizeSerialValue(row.serial_number))
            );
            const assignee = resolveAssigneeFromMaps(row, profileMaps);
            const matched = assignee.profile;
            return {
                ...row,
                _entityType: 'inventory',
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create',
                _errors: this.getInventoryErrors(row),
                _assignee_email: assignee.resolvedEmail || null,
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
    async previewInventory(rawData) {
        // Normalizar todas las filas primero para reconocer NS, email → assigned_to, Area abreviada, etc.
        const data = rawData.map((r) => normalizeInputRow(r));

        const [{ data: existingAssets }, { data: profiles }] = await Promise.all([
            supabase.from('assets').select('id, specs'),
            supabase.from('profiles').select('id, email, full_name'),
        ]);
        const profileMaps = buildProfileMaps(profiles || []);

        return data.map(row => {
            const serial = row.serial_number;
            const assetId = row.asset_id;

            const duplicate = (existingAssets || []).find(a =>
                (assetId && String(a.id) === assetId) ||
                (serial && normalizeSerialValue(a.specs?.serial_number || a.specs?.serial || a.specs?.ns) === normalizeSerialValue(serial))
            );
            const assignee = resolveAssigneeFromMaps(row, profileMaps);
            const matchedUser = assignee.profile;

            return {
                ...row,
                _status: duplicate ? 'duplicate' : 'new',
                _existingId: duplicate ? duplicate.id : null,
                _action: duplicate ? 'update' : 'create',
                _errors: this.getInventoryErrors(row),
                _assignee_email: assignee.resolvedEmail,
                _assignee_name: matchedUser ? matchedUser.name : (assignee.resolvedName || null),
                assigned_to: matchedUser ? matchedUser.id : null
            };
        });
    },

    getInventoryErrors(row) {
        const errors = [];
        // row ya está normalizado cuando viene de previewInventory/previewMixed
        if (!row.serial_number && !row.asset_id) errors.push('Falta Número de Serie o ID de activo');
        if (!row.asset_type && !row.brand && !row.model && !row.hostname) errors.push('Falta Tipo, Marca o Modelo de equipo');
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

        let assignedUserId = row.assigned_to || null;
        let status = row.status || 'available';
        const assignedEmail = sanitizeImportedEmail(row.assigned_to_email || row['Correo Asignado (Opcional)'] || row.Asignado_A || '');
        if (!assignedUserId && assignedEmail) {
            const foundUser = allUsers.find((u) => u.email.toLowerCase() === assignedEmail);
            if (foundUser) {
                assignedUserId = foundUser.id;
                if (!row.status) status = 'active';
            }
        }

        return {
            id: finalId,
            type: row.asset_type || row.Type || row.Tipo || 'Computer',
            model: row.model || row.Model || row.brand || row.Marca || 'Desconocido',
            status,
            assigned_to: assignedUserId,
            specs: {
                serial_number: getNormalizedSerial(row),
                brand: row.brand || row.Marca || 'Desconocida',
                category: row.asset_type || row.Type || 'Hardware',
                model: row.model || row.Model || '',
                inventory_tag: row.inventory_tag || row.Placa || '',
                hostname: row.hostname || '',
                extension: row.extension || '',
                assigned_user_name: row._assignee_name || row.assigned_to_name || row.user_display_name || row.name || '',
                // Guardar el email para poder reparar asignaciones en futuro si el UUID faltó
                assigned_to_email: assignedEmail || '',
                // Compatibilidad con cargas históricas que usaban "ns" en specs.
                ns: getNormalizedSerial(row),
                department: row.department || '',
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
            const { data: usersData } = await supabase.from('profiles').select('id, email, full_name');
            allUsers = usersData || [];
        }

        const inventoryCreates = [];

        for (const row of data) {
            if (row._action === 'skip') { duplicateCount++; continue; }

            try {
                const shouldProcessUser = type === 'users' || (type === 'mixed' && (row._entityType === 'user' || row._entityType === 'both'));
                const shouldProcessInventory = type === 'inventory' || (type === 'mixed' && (row._entityType === 'inventory' || row._entityType === 'both'));

                if (shouldProcessUser) {
                    const ALLOWED_IMPORT_ROLES = ['user', 'operativo', 'operador'];
                    const importedRole = (row.role || row.Rol || '').toString().toLowerCase().trim();
                    const safeRole = ALLOWED_IMPORT_ROLES.includes(importedRole) ? importedRole : 'user';
                    const mappedStatus = parseUserStatusBoolean(row.status || row.Estado || '');

                    const payload = {
                        full_name: row.name || row.Name || row.Nombre,
                        email: row.email || row.Email,
                        department: normalizeImportedDepartment(row.department || row.Department || row.Departamento || 'General'),
                        role: safeRole,
                        // Regla de negocio: usuarios creados por carga masiva quedan inactivos
                        // hasta completar alta real de credenciales en Auth.
                        status: row._action === 'create' ? false : (mappedStatus ?? undefined),
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
                        const regResult = await userService.register(
                            payload.email,
                            buildTempPassword(payload.email),
                            payload.full_name,
                            payload.role,
                            payload.department,
                            adminId
                        );

                        if (!regResult.success) {
                            throw new Error(regResult.error || `No se pudo registrar ${payload.email}`);
                        }

                        const createdProfile = await findProfileByEmailWithRetry(payload.email);
                        if (!createdProfile?.id) {
                            throw new Error(`El perfil de ${payload.email} no apareció tras el registro.`);
                        }

                        const { error: postCreateErr } = await supabase
                            .from('profiles')
                            .update({
                                status: false,
                                location: payload.location,
                                assigned_equipment: payload.assigned_equipment,
                            })
                            .eq('id', createdProfile.id);

                        if (postCreateErr) throw postCreateErr;
                        newCount++;

                        // Actualizar cache de usuarios para permitir asignaciones en filas siguientes del mismo archivo.
                        if (payload.email) {
                            const justCreated = await findProfileByEmailWithRetry(payload.email, 2);
                            if (justCreated?.id && justCreated?.email) {
                                allUsers.push({ id: justCreated.id, email: justCreated.email });
                            }
                        }
                    }
                }

                if (shouldProcessInventory) {
                    const payload = this.buildInventoryPayload(row, allUsers, fileName);

                    if (!payload.assigned_to) {
                        const cacheMatch = resolveProfileIdFromCache(allUsers, {
                            email: payload.specs?.assigned_to_email,
                            name: row.assigned_to_name || row.user_display_name || row.name,
                        });
                        if (cacheMatch) {
                            payload.assigned_to = cacheMatch;
                            if (!payload.status || payload.status === 'available') payload.status = 'active';
                        }
                    }

                    // Fallback: asegurar asignación por correo cuando no encontró match en cache.
                    if (!payload.assigned_to && payload.specs?.assigned_to_email) {
                        const resolvedId = await resolveProfileIdByEmail(payload.specs.assigned_to_email);
                        if (resolvedId) {
                            payload.assigned_to = resolvedId;
                            if (!payload.status || payload.status === 'available') {
                                payload.status = 'active';
                            }
                        }
                    }

                    // Segundo fallback: resolver por identidad de la misma fila (email/nombre).
                    if (!payload.assigned_to) {
                        const resolvedByIdentity = await resolveProfileIdByIdentity({
                            email: payload.specs?.assigned_to_email,
                            name: row.assigned_to_name || row.user_display_name || row.name,
                        });
                        if (resolvedByIdentity) {
                            payload.assigned_to = resolvedByIdentity;
                            if (!payload.status || payload.status === 'available') {
                                payload.status = 'active';
                            }
                        }
                    }

                    if (row._action === 'update' && row._existingId) {
                        const { data: existingAsset, error: fetchAssetError } = await supabase
                            .from('assets')
                            .select('id, type, model, status, assigned_to, specs')
                            .eq('id', row._existingId)
                            .maybeSingle();

                        if (fetchAssetError) throw fetchAssetError;

                        const existingSpecs = existingAsset?.specs || {};
                        const incomingSpecs = payload.specs || {};
                        const mergedSerial = getNormalizedSerial(row, {
                            ...existingSpecs,
                            ...incomingSpecs,
                        });
                        const mergedSpecs = {
                            ...existingSpecs,
                            ...incomingSpecs,
                            // Evitar vaciar campos críticos cuando vienen en blanco en el archivo
                            serial_number: mergedSerial,
                            ns: mergedSerial,
                            hostname: incomingSpecs.hostname || existingSpecs.hostname || '',
                        };

                        const updatePayload = {
                            type: payload.type || existingAsset?.type || null,
                            model: payload.model || existingAsset?.model || null,
                            status: payload.status || existingAsset?.status || 'available',
                            assigned_to: payload.assigned_to ?? existingAsset?.assigned_to ?? null,
                            specs: mergedSpecs,
                        };

                        const { error } = await supabase
                            .from('assets')
                            .update(updatePayload)
                            .eq('id', row._existingId);
                        if (error) throw error;
                        updateCount++;
                    } else {
                        inventoryCreates.push(payload);
                    }
                }

                if (type === 'mixed' && row._entityType === 'unknown') {
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
            supabase.from('profiles').select('id, full_name, email, role, status'),
            supabase.from('assets').select('id, type, model, status, assigned_to, specs'),
        ]);

        if (profilesError) throw profilesError;
        if (assetsError) throw assetsError;

        const profileRows = profiles || [];
        const assetRows = assets || [];

        const eligibleRoles = new Set(['user', 'tech', 'operativo', 'operador', 'jefe_mantenimiento']);
        const eligibleUsers = profileRows.filter((u) =>
            u.status === true && eligibleRoles.has(String(u.role || '').toLowerCase())
        );

        const userIdSet = new Set(profileRows.map((u) => u.id));
        const userByEmail = profileRows.reduce((acc, u) => {
            const key = String(u.email || '').trim().toLowerCase();
            if (key && !acc[key]) acc[key] = u.id;
            return acc;
        }, {});
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
                const metaEmail = getAssetMetaEmail(asset.specs || {});
                const matchedUserId = metaEmail ? userByEmail[metaEmail] : null;
                if (matchedUserId) {
                    assignedByUser.set(matchedUserId, (assignedByUser.get(matchedUserId) || 0) + 1);
                } else {
                    availableAssets.push(asset);
                }
            }
        }

        const usersWithoutAssets = eligibleUsers.filter((u) => !assignedByUser.get(u.id));

        const toAssetLabel = (asset) => {
            const specs = asset.specs || {};
            const label = [
                specs.hostname || null,
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
    },

    async clearOrphanAssetsBulk(assetIds = []) {
        const ids = [...new Set((assetIds || []).filter(Boolean).map((id) => String(id)))];
        if (!ids.length) return { cleared: 0 };

        const { error, count } = await supabase
            .from('assets')
            .update({ assigned_to: null, status: 'available' }, { count: 'exact' })
            .in('id', ids);

        if (error) throw error;
        return { cleared: count || ids.length };
    }
};