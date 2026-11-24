
import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Configuración
const BATCH_SIZE = 5; // Tamaño del lote para embeddings (evitar rate limit)
const INPUT_FILE = process.argv[2]; // Archivo pasado por argumento (o - para STDIN)

if (!INPUT_FILE) {
    console.error('❌ Por favor, especifica el archivo JSON a importar o "-" para stdin.');
    console.error('Uso: npx ts-node scripts/import-jurisprudence-batch.ts ./data/fallos.json');
    process.exit(1);
}

async function readInput(): Promise<any[]> {
    if (INPUT_FILE === '-') {
        return new Promise((resolve, reject) => {
            let data = '';
            process.stdin.setEncoding('utf8');
            process.stdin.on('data', chunk => data += chunk);
            process.stdin.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
            process.stdin.on('error', reject);
        });
    } else {
        const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
        return JSON.parse(rawData);
    }
}

async function main() {
    console.log(`📂 Leyendo dataset: ${INPUT_FILE}...`);

    let dataset: any[];
    try {
        dataset = await readInput();
    } catch (error) {
        console.error('❌ Error leyendo el archivo JSON:', error.message);
        return;
    }

    console.log(`📊 Detectados ${dataset.length} registros para procesar.`);

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY no encontrada.');
        return;
    }

    const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small',
    });

    let processed = 0;
    let errors = 0;

    // Procesar en lotes
    for (let i = 0; i < dataset.length; i += BATCH_SIZE) {
        const batch = dataset.slice(i, i + BATCH_SIZE);
        console.log(`\n🔄 Procesando lote ${i + 1} a ${Math.min(i + BATCH_SIZE, dataset.length)}...`);

        await Promise.all(batch.map(async (caso) => {
            try {
                // 1. Validar campos mínimos
                if (!caso.tribunal || !caso.nroExpediente || !caso.textoCompleto) {
                    console.warn(`⚠️ Saltando registro incompleto: ${caso.nroExpediente || 'S/N'}`);
                    return;
                }

                // 2. Generar Embedding
                const fullText = `${caso.resumen || ''} \n ${caso.textoCompleto}`.substring(0, 8000); // Truncar si es muy largo
                const embedding = await embeddings.embedQuery(fullText);
                const vectorString = JSON.stringify(embedding);

                // 3. Insertar en DB
                await prisma.$executeRaw`
                    INSERT INTO "Jurisprudence" (
                        id, tribunal, sala, "nroExpediente", fecha, jurisdiccion, fuero,
                        tema, resumen, "textoCompleto", precedencia, vigencia,
                        "fuenteOficialUrl", caratula, embedding, "createdAt", "updatedAt"
                    ) VALUES (
                        gen_random_uuid(), 
                        ${caso.tribunal}::"JurisprudenceTribunal", 
                        ${caso.sala || null}, 
                        ${caso.nroExpediente}, 
                        ${new Date(caso.fecha)}, 
                        ${caso.jurisdiccion}::"LegalNormJurisdiccion", 
                        ${caso.fuero}::"LegalNormFuero", 
                        ${caso.tema || []}, 
                        ${caso.resumen || ''}, 
                        ${caso.textoCompleto}, 
                        ${(caso.precedencia || 'REFERENCIAL')}::"JurisprudencePrecedencia", 
                        ${(caso.vigencia || 'VIGENTE')}::"JurisprudenceVigencia", 
                        ${caso.fuenteOficialUrl || null}, 
                        ${caso.caratula}, 
                        ${vectorString}::vector,
                        NOW(), NOW()
                    )
                    ON CONFLICT ("tribunal", "nroExpediente", "fecha") DO NOTHING;
                `;

                processed++;
                process.stdout.write('.');
            } catch (err) {
                errors++;
                console.error(`\n❌ Error en caso ${caso.nroExpediente}: ${err.message}`);
            }
        }));

        // Pequeña pausa para rate-limits
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n\n✅ Importación finalizada.');
    console.log(`   Procesados: ${processed}`);
    console.log(`   Errores: ${errors}`);
}

main()
    .finally(() => prisma.$disconnect());
