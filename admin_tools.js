
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- UTILIDAD: Cargador de .env manual para evitar dependencias extra ---
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        const env = {};
        lines.forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value) {
                env[key.trim()] = value.join('=').trim();
            }
        });
        return env;
    } catch (err) {
        console.error('Error al cargar el archivo .env:', err.message);
        process.exit(1);
    }
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const help = `
Mexsa IT - Herramientas de Administración de Sesiones
---------------------------------------------------
Uso: node admin_tools.js [comando] [argumentos]

Comandos:
  list              Lista todos los usuarios y su estado de sesión.
  kick [email]      Fuerza el cierre de sesión de un usuario inmediatamente.
  allow [email]     Permite que el usuario vuelva a iniciar sesión.
  help              Muestra este mensaje.

⚠ IMPORTANTE: Si usas "kick", el usuario no podrá volver a entrar
hasta que uses "allow" con su correo.

Ejemplos:
  node admin_tools.js list
  node admin_tools.js kick pepito@pruebas.com
  node admin_tools.js allow pepito@pruebas.com
`;

async function listUsers() {
    console.log('\n--- Lista de Usuarios en el Sistema ---');
    const { data, error } = await supabase.from('profiles').select('id, full_name, email, role, force_logout');

    if (error) {
        console.error('Error:', error.message);
        console.error('Si ves error de RLS, asegúrate de haber corrido el SQL que deshabilita RLS.');
        return;
    }

    if (data.length === 0) {
        console.log('No hay perfiles creados aún.');
    } else {
        console.table(data.map(u => ({
            Nombre: u.full_name,
            Email: u.email,
            Rol: u.role,
            '¿Sesión Bloqueada?': u.force_logout ? 'BLOQUEADO (kick)' : 'ACTIVO'
        })));
    }
}

async function updateForceLogout(email, status) {
    if (!email) {
        console.error('Error: Debes proporcionar un email.');
        return;
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({ force_logout: status })
        .eq('email', email)
        .select();

    if (error) {
        console.error('Error:', error.message);
    } else if (!data || data.length === 0) {
        console.error(`Error: No se encontró ningún perfil con el email: ${email}`);
        process.exit(1);
    } else {
        if (status) {
            console.log(`\n🚫 SESIÓN CERRADA PARA: ${email}`);
            console.log('El usuario será expulsado de su navegador inmediatamente.');
            console.log(`Recuerda usar "node admin_tools.js allow ${email}" cuando quieras dejarlo entrar de nuevo.`);
        } else {
            console.log(`\n✅ ACCESO RESTABLECIDO PARA: ${email}`);
            console.log('El usuario ya puede iniciar sesión normalmente.');
        }
    }
}

async function main() {
    const [, , command, arg1] = process.argv;

    switch (command) {
        case 'list':
            await listUsers();
            break;
        case 'kick':
            await updateForceLogout(arg1, true);
            break;
        case 'allow':
            await updateForceLogout(arg1, false);
            break;
        default:
            console.log(help);
            break;
    }
}

main();
