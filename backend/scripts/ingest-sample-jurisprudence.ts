
import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SAMPLE_CASE = {
    caratula: 'Rodríguez, María c/ Transportes Metropolitanos s/ Daños y Perjuicios',
    tribunal: 'CAMARA_NACIONAL', // Enum value
    sala: 'Sala F',
    nroExpediente: 'CNC 12345/2023',
    fecha: new Date('2023-05-15'),
    jurisdiccion: 'NACION',
    fuero: 'CIVIL',
    tema: ['Responsabilidad Civil', 'Transporte Público', 'Daño Moral'],
    resumen: 'La Cámara confirmó la sentencia que condenó a la empresa de transporte por las lesiones sufridas por una pasajera al descender del tren. Se aplicó el deber de seguridad objetivo y se elevó el monto por daño moral.',
    textoCompleto: 'Texto completo simulado del fallo...', // Simplificado para el ejemplo
    precedencia: 'OBLIGATORIO',
    vigencia: 'VIGENTE',
    fuenteOficialUrl: 'https://pjn.gov.ar/fallos/12345',
    chunks: [
        {
            chunkType: 'HECHOS',
            chunkNumber: 1,
            texto: 'La actora relata que al intentar descender de la formación ferroviaria en la estación Constitución, el tren realizó una maniobra brusca que provocó su caída al andén, sufriendo fractura de tobillo.',
            keywords: ['caída', 'tren', 'lesiones', 'pasajera']
        },
        {
            chunkType: 'CONSIDERANDO',
            chunkNumber: 2,
            texto: 'Tratándose de un contrato de transporte, rige el deber de seguridad objetivo (art. 1289 CCyC). La empresa transportista tiene la obligación de garantizar que el pasajero llegue sano y salvo a destino. La prueba de la culpa de la víctima recae sobre la demandada, quien no logró acreditarla en autos.',
            keywords: ['deber de seguridad', 'responsabilidad objetiva', 'carga de la prueba', 'contrato de transporte']
        },
        {
            chunkType: 'RESUELVE',
            chunkNumber: 3,
            texto: 'Se confirma la sentencia de grado en cuanto a la responsabilidad. Se eleva la indemnización por daño moral a la suma de pesos quinientos mil ($500.000) considerando las secuelas estéticas y psicológicas acreditadas.',
            keywords: ['daño moral', 'indemnización', 'sentencia confirmada', 'monto']
        }
    ]
};

async function main() {
    console.log('🔄 Iniciando ingesta de Jurisprudencia de prueba...');

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY no encontrada.');
        return;
    }

    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small',
    });

    try {
        console.log(`📝 Procesando fallo: ${SAMPLE_CASE.caratula}`);

        // 1. Crear Fallo (Cabecera)
        const falloEmbedding = await embeddings.embedQuery(
            `${SAMPLE_CASE.caratula} ${SAMPLE_CASE.resumen} ${SAMPLE_CASE.tema.join(' ')}`
        );

        // Convertir embedding a string para SQL raw (pgvector)
        const vectorString = JSON.stringify(falloEmbedding);

        // Insertar usando queryRaw para manejar el tipo vector
        const falloId = await prisma.$executeRaw`
            INSERT INTO "Jurisprudence" (
                id, tribunal, sala, "nroExpediente", fecha, jurisdiccion, fuero,
                tema, resumen, "textoCompleto", precedencia, vigencia,
                "fuenteOficialUrl", caratula, embedding, "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(), 
                ${SAMPLE_CASE.tribunal}::"JurisprudenceTribunal", 
                ${SAMPLE_CASE.sala}, 
                ${SAMPLE_CASE.nroExpediente}, 
                ${SAMPLE_CASE.fecha}, 
                ${SAMPLE_CASE.jurisdiccion}::"LegalNormJurisdiccion", 
                ${SAMPLE_CASE.fuero}::"LegalNormFuero", 
                ${SAMPLE_CASE.tema}, 
                ${SAMPLE_CASE.resumen}, 
                ${SAMPLE_CASE.textoCompleto}, 
                ${SAMPLE_CASE.precedencia}::"JurisprudencePrecedencia", 
                ${SAMPLE_CASE.vigencia}::"JurisprudenceVigencia", 
                ${SAMPLE_CASE.fuenteOficialUrl}, 
                ${SAMPLE_CASE.caratula}, 
                ${vectorString}::vector,
                NOW(), NOW()
            );
        `;

        console.log('✅ Cabecera del fallo insertada.');

        // Recuperar ID del fallo recién creado para asociar chunks
        const savedFallo = await prisma.jurisprudence.findFirst({
            where: { nroExpediente: SAMPLE_CASE.nroExpediente }
        });

        if (!savedFallo) throw new Error('Error recuperando fallo insertado');

        // 2. Procesar Chunks
        for (const chunk of SAMPLE_CASE.chunks) {
            const chunkEmbedding = await embeddings.embedQuery(chunk.texto);
            const chunkVector = JSON.stringify(chunkEmbedding);

            await prisma.$executeRaw`
                INSERT INTO "JurisprudenceChunk" (
                    id, "jurisprudenceId", "chunkType", "chunkNumber", texto,
                    keywords, embedding, "createdAt"
                ) VALUES (
                    gen_random_uuid(),
                    ${savedFallo.id},
                    ${chunk.chunkType},
                    ${chunk.chunkNumber},
                    ${chunk.texto},
                    ${chunk.keywords},
                    ${chunkVector}::vector,
                    NOW()
                );
            `;
            console.log(`   -> Chunk ${chunk.chunkType} insertado.`);
        }

        console.log('✨ Ingesta de jurisprudencia finalizada con éxito.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
