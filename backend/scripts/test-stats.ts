import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';

async function login() {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@estudio.com',
            password: 'hash123'
        })
    });

    if (!response.ok) {
        throw new Error('Login failed');
    }

    const data = await response.json();
    return data.access_token;
}

async function testStats() {
    try {
        console.log('🔐 Autenticando...');
        const token = await login();
        console.log('✅ Autenticado\n');

        console.log('📊 Obteniendo estadísticas...');
        const response = await fetch(`${API_URL}/legal/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        console.log('\n✅ Estadísticas:');
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('\n❌ Error:', error);
    }
}

testStats();
