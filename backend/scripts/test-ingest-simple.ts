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

async function testIngest() {
    try {
        console.log('🔐 Autenticando...');
        const token = await login();
        console.log('✅ Autenticado\n');

        const norm = {
            jurisdiccion: 'NACION',
            fuero: 'CIVIL',
            tipoNorma: 'CODIGO',
            nombre: 'Código Civil y Comercial',
            numeroNorma: 'Ley 26.994',
            articulo: 'Art. 1109',
            textoCompleto: 'Todo el que ejecuta un hecho, que por su culpa o negligencia ocasiona un daño a otro, está obligado a la reparación del perjuicio.',
            fechaVigencia: '2015-08-01',
            estado: 'VIGENTE',
            ambitoAplicacion: 'Nacional',
            sourceType: 'MANUAL'
        };

        console.log('📝 Ingresando norma...');
        const response = await fetch(`${API_URL}/legal/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(norm)
        });

        const responseText = await response.text();
        console.log('\n📊 Response Status:', response.status);
        console.log('📊 Response Body:', responseText);

        if (!response.ok) {
            console.error('\n❌ Error completo:', responseText);
        } else {
            const data = JSON.parse(responseText);
            console.log('\n✅ Resultado:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('\n💥 Error:', error);
    }
}

testIngest();
