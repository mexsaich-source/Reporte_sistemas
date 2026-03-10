import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://bksshgibtxnkeeovkujy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrc3NoZ2lidHhua2Vlb3ZrdWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODYzMDcsImV4cCI6MjA4NzQ2MjMwN30.ejKtj4RCr8uze6piE5GkU-NbFIh6xNVgj2yw6MAw2Qg'
);

(async () => {
    // Intentamos iniciar sesión (asume una contraseña débil típica de dev local)
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'joel.itehua17@gmail.com',
        password: 'password123'
    });
    
    // Si falla el logueo, lo intentamos con otra
    if (signInError) {
        console.error('SIGN_IN_ERROR:', signInError.message);
        return;
    }

    console.log('SIGNED IN:', session.user.id);
    console.log('Fetching profile with authenticated session...');

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('FETCH ERROR:', error);
    } else {
        console.log('FETCH SUCCESS:', data);
    }
})();
