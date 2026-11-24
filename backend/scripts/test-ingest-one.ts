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

    const data = await response.json();
    return data.access_token;
}

async function ingestOne() {
    const token = await login();

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

    console.log(`Status: ${response.status}`);

    const text = await response.text();
    console.log(`Response:`, text);

    if (response.ok) {
        const data = JSON.parse(text);
        console.log('\n✅ Éxito!');
        console.log(`ID: ${data.normId}`);
        console.log(`Status: ${data.status}`);
    }
}

ingestOne().catch(console.error);
