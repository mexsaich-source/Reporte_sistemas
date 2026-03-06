
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://bksshgibtxnkeeovkujy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrc3NoZ2lidHhua2Vlb3ZrdWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODYzMDcsImV4cCI6MjA4NzQ2MjMwN30.ejKtj4RCr8uze6piE5GkU-NbFIh6xNVgj2yw6MAw2Qg'
);

async function listProfiles() {
    const { data, error } = await supabase.from('profiles').select('id, full_name, email, role');

    if (error) {
        console.error('FETCH ERROR:', JSON.stringify(error, null, 2));
    } else {
        console.log('DATA:', JSON.stringify(data, null, 2));
    }
}

listProfiles();
