
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const norms = await prisma.legalNorm.count();
    const jurisprudence = await prisma.jurisprudence.count();
    const chunks = await prisma.jurisprudenceChunk.count();

    console.log('--- Data Counts ---');
    console.log(`LegalNorms: ${norms}`);
    console.log(`Jurisprudence Cases: ${jurisprudence}`);
    console.log(`Jurisprudence Chunks: ${chunks}`);

    if (norms > 0) {
        const sampleNorm = await prisma.legalNorm.findFirst();
        console.log(`Sample Norm: ${sampleNorm?.nombre} (${sampleNorm?.numeroNorma})`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
