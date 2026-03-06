
async function fetchSchema() {
    const url = 'https://bksshgibtxnkeeovkujy.supabase.co/rest/v1/';
    const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrc3NoZ2lidHhua2Vlb3ZrdWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODYzMDcsImV4cCI6MjA4NzQ2MjMwN30.ejKtj4RCr8uze6piE5GkU-NbFIh6xNVgj2yw6MAw2Qg';

    try {
        const response = await fetch(url, {
            headers: { 'apikey': apikey }
        });
        const data = await response.json();
        console.log(JSON.stringify(data.definitions.profiles, null, 2));
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

fetchSchema();
