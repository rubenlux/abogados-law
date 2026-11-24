import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para ingestar normas legales argentinas básicas
 * Ejecutar: npx ts-node scripts/ingest-legal-norms.ts
 */

const SAMPLE_NORMS = [
    {
        jurisdiccion: 'NACION',
        fuero: 'CIVIL',
        tipoNorma: 'CODIGO',
        nombre: 'Código Civil y Comercial',
        numeroNorma: 'Ley 26.994',
        articulo: 'Art. 1109',
        textoCompleto: `Todo el que ejecuta un hecho, que por su culpa o negligencia ocasiona un daño a otro, está obligado a la reparación del perjuicio. Esta obligación es regida por las mismas disposiciones relativas a los delitos del derecho civil.`,
        fechaVigencia: new Date('2015-08-01'),
        estado: 'VIGENTE',
        versionNorma: 1,
        keywords: ['responsabilidad civil', 'daños', 'culpa', 'negligencia'],
        conceptosJuridicos: ['responsabilidad extracontractual', 'hecho ilícito']
    },
    {
        jurisdiccion: 'NACION',
        fuero: 'CIVIL',
        tipoNorma: 'CODIGO',
        nombre: 'Código Procesal Civil y Comercial',
        numeroNorma: 'Ley 17.454',
        articulo: 'Art. 356',
        textoCompleto: `En la contestación de la demanda, el demandado deberá: 1) Reconocer o negar categóricamente cada uno de los hechos expuestos en la demanda. 2) Exponer las defensas o excepciones que considere pertinentes. El plazo para contestar la demanda será de QUINCE (15) días hábiles.`,
        fechaVigencia: new Date('1981-01-01'),
        estado: 'VIGENTE',
        versionNorma: 1,
        keywords: ['contestación de demanda', 'plazo', 'días hábiles', 'defensa'],
        conceptosJuridicos: ['proceso ordinario', 'traslado de demanda', 'derecho de defensa']
    },
    {
        jurisdiccion: 'CABA',
        fuero: 'LABORAL',
        tipoNorma: 'LEY',
        nombre: 'Ley de Contrato de Trabajo',
        numeroNorma: 'Ley 20.744',
        articulo: 'Art. 245',
        textoCompleto: `El trabajador, con una antigüedad mínima de un (1) año, tendrá derecho a un período de vacaciones anuales remuneradas de acuerdo con la siguiente escala: a) De catorce (14) días corridos cuando la antigüedad no exceda de cinco (5) años. b) De veintiún (21) días corridos cuando siendo la antigüedad mayor de cinco (5) años, no exceda de diez (10). c) De veintiocho (28) días corridos cuando la antigüedad siendo mayor de diez (10) años, no exceda de veinte (20). d) De treinta y cinco (35) días corridos cuando la antigüedad exceda de veinte (20) años.`,
        fechaVigencia: new Date('1976-05-13'),
        estado: 'VIGENTE',
        versionNorma: 1,
        keywords: ['vacaciones', 'antigüedad', 'días corridos', 'trabajador'],
        conceptosJuridicos: ['derecho laboral', 'descanso anual', 'relación laboral']
    },
    {
        jurisdiccion: 'NACION',
        fuero: 'PENAL',
        tipoNorma: 'CODIGO',
        nombre: 'Código Penal',
        numeroNorma: 'Ley 11.179',
        articulo: 'Art. 79',
        textoCompleto: `Se aplicará reclusión o prisión de ocho (8) a veinticinco (25) años, al que matare a otro, siempre que en este Código no se estableciere otra pena.`,
        fechaVigencia: new Date('1921-09-30'),
        estado: 'VIGENTE',
        versionNorma: 1,
        keywords: ['homicidio', 'pena', 'prisión', 'reclusión'],
        conceptosJuridicos: ['homicidio simple', 'delito contra la vida', 'derecho penal']
    },
    {
        jurisdiccion: 'PBA',
        fuero: 'CIVIL',
        tipoNorma: 'CODIGO',
        nombre: 'Código Procesal Civil y Comercial PBA',
        numeroNorma: 'Ley 7425',
        articulo: 'Art. 192',
        textoCompleto: `El plazo para contestar la demanda será de quince (15) días. Vencido el plazo sin que el demandado haya contestado la demanda, se lo tendrá por rebelde y se proseguirá el juicio en su rebeldía, sin necesidad de notificación alguna.`,
        fechaVigencia: new Date('1968-01-01'),
        estado: 'VIGENTE',
        versionNorma: 1,
        keywords: ['contestación', 'rebeldía', 'plazo', 'provincia buenos aires'],
        conceptosJuridicos: ['proceso civil', 'rebeldía procesal', 'traslado']
    }
];

async function main() {
    console.log('🔄 Iniciando ingesta de normas legales...\n');

    for (const norm of SAMPLE_NORMS) {
        try {
            const created = await prisma.legalNorm.create({
                data: norm as any
            });
            console.log(`✅ Ingresada: ${norm.nombre} - ${norm.articulo}`);
        } catch (error) {
            console.error(`❌ Error ingresando ${norm.articulo}:`, error.message);
        }
    }

    console.log('\n✨ Ingesta completada. Total normas:', SAMPLE_NORMS.length);
    console.log('\n⚠️  NOTA: Los embeddings deben generarse usando el endpoint /ia/ingest');
    console.log('   o ejecutando un script de vectorización separado.\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
