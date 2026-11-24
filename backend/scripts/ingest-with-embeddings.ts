import fetch from 'node-fetch';

/**
 * Script para ingestar normas legales usando el endpoint /legal/ingest
 * que genera embeddings automáticamente
 * 
 * Ejecutar: npx ts-node scripts/ingest-with-embeddings.ts
 */

const API_URL = 'http://localhost:3000';

// Primero necesitamos autenticarnos
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

async function ingestNorm(token: string, norm: any) {
    const response = await fetch(`${API_URL}/legal/ingest`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(norm)
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Error ingesting ${norm.articulo}:`, error);
        return null;
    }

    return await response.json();
}

const NORMS = [
    {
        jurisdiccion: 'NACION',
        fuero: 'CIVIL',
        tipoNorma: 'CODIGO',
        nombre: 'Código Civil y Comercial',
        numeroNorma: 'Ley 26.994',
        articulo: 'Art. 1109',
        textoCompleto: 'Todo el que ejecuta un hecho, que por su culpa o negligencia ocasiona un daño a otro, está obligado a la reparación del perjuicio. Esta obligación es regida por las mismas disposiciones relativas a los delitos del derecho civil.',
        fechaVigencia: '2015-08-01',
        estado: 'VIGENTE',
        ambitoAplicacion: 'Nacional',
        sourceType: 'MANUAL'
    },
    {
        jurisdiccion: 'NACION',
        fuero: 'CIVIL',
        tipoNorma: 'CODIGO',
        nombre: 'Código Procesal Civil y Comercial',
        numeroNorma: 'Ley 17.454',
        articulo: 'Art. 356',
        textoCompleto: 'En la contestación de la demanda, el demandado deberá: 1) Reconocer o negar categóricamente cada uno de los hechos expuestos en la demanda. 2) Exponer las defensas o excepciones que considere pertinentes. El plazo para contestar la demanda será de QUINCE (15) días hábiles.',
        fechaVigencia: '1981-01-01',
        estado: 'VIGENTE',
        ambitoAplicacion: 'Nacional',
        sourceType: 'MANUAL'
    },
    {
        jurisdiccion: 'CABA',
        fuero: 'LABORAL',
        tipoNorma: 'LEY',
        nombre: 'Ley de Contrato de Trabajo',
        numeroNorma: 'Ley 20.744',
        articulo: 'Art. 245',
        textoCompleto: 'El trabajador, con una antigüedad mínima de un (1) año, tendrá derecho a un período de vacaciones anuales remuneradas de acuerdo con la siguiente escala: a) De catorce (14) días corridos cuando la antigüedad no exceda de cinco (5) años. b) De veintiún (21) días corridos cuando siendo la antigüedad mayor de cinco (5) años, no exceda de diez (10). c) De veintiocho (28) días corridos cuando la antigüedad siendo mayor de diez (10) años, no exceda de veinte (20). d) De treinta y cinco (35) días corridos cuando la antigüedad exceda de veinte (20) años.',
        fechaVigencia: '1976-05-13',
        estado: 'VIGENTE',
        ambitoAplicacion: 'Nacional',
        sourceType: 'MANUAL'
    }
];

async function main() {
    console.log('🔐 Autenticando...');
    const token = await login();
    console.log('✅ Autenticado\n');

    console.log('🔄 Iniciando ingesta con embeddings...\n');

    for (const norm of NORMS) {
        console.log(`📝 Ingresando: ${norm.nombre} - ${norm.articulo}`);
        const result = await ingestNorm(token, norm);

        if (result) {
            if (result.status === 'success') {
                console.log(`✅ Ingresado exitosamente (ID: ${result.normId})`);
            } else if (result.status === 'duplicate') {
                console.log(`⚠️  Duplicado detectado (ID existente: ${result.existingId})`);
            }
        }

        // Pequeña pausa para no saturar la API de OpenAI
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✨ Ingesta completada!');
    console.log('\n💡 Ahora puedes probar:');
    console.log('   - GET /legal/stats (ver estadísticas)');
    console.log('   - GET /legal/search?query=responsabilidad civil (búsqueda semántica)');
}

main().catch(console.error);
