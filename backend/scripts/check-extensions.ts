
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
        console.log('Extensions:', result);
    } catch (e) {
        console.error('Error checking extensions:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
