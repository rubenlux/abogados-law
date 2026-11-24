/**
 * Script para verificar si hay datos de jurisprudencia en la BD
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    console.log('🔍 Verificando datos de jurisprudencia...\n');

    try {
        // Contar casos
        const totalCases = await prisma.jurisprudence.count();
        console.log(`📊 Total de casos: ${totalCases}`);

        if (totalCases === 0) {
            console.log('\n❌ No hay datos en la base de datos!');
            console.log('\n💡 Para agregar datos, ejecutá:');
            console.log('   1. npx ts-node src/crawler/run.ts');
            console.log('   2. npx ts-node src/crawler/pipeline/ingest-to-db.ts');
            return;
        }

        // Mostrar casos por tribunal
        const byTribunal = await prisma.jurisprudence.groupBy({
            by: ['tribunal'],
            _count: true
        });

        console.log('\n📋 Por tribunal:');
        byTribunal.forEach(t => {
            console.log(`   - ${t.tribunal}: ${t._count}`);
        });

        // Verificar embeddings
        const withEmbeddings = await prisma.$queryRaw`
            SELECT COUNT(*) as count 
            FROM "Jurisprudence" 
            WHERE embedding IS NOT NULL
        `;

        console.log(`\n🧠 Casos con embeddings: ${(withEmbeddings as any)[0].count}`);

        // Mostrar algunos casos
        const samples = await prisma.jurisprudence.findMany({
            take: 3,
            select: {
                id: true,
                tribunal: true,
                nroExpediente: true,
                fecha: true,
                tema: true
            }
        });

        console.log('\n📄 Ejemplos de casos:');
        samples.forEach((c, i) => {
            console.log(`\n   ${i + 1}. ${c.tribunal} - ${c.nroExpediente}`);
            console.log(`      Fecha: ${c.fecha.toLocaleDateString('es-AR')}`);
            console.log(`      Temas: ${c.tema.slice(0, 2).join(', ')}...`);
        });

        console.log('\n✅ La base de datos tiene datos!');

    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
