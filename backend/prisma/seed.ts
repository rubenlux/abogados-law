
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // 1. Create Default Organization
    const org = await prisma.organization.upsert({
        where: { id: 'default-org-uuid' }, // En una app real esto sería dinámico
        update: {},
        create: {
            id: 'default-org-uuid',
            name: 'Estudio Jurídico Modelo',
            plan: 'PRO',
        },
    });

    // 2. Create Admin User
    await prisma.user.upsert({
        where: { email: 'admin@estudio.com' },
        update: {},
        create: {
            email: 'admin@estudio.com',
            fullName: 'Socio Principal',
            passwordHash: 'hash123', // TODO: Hash real
            role: 'PARTNER',
            organizationId: org.id
        },
    });

    // 3. Seed Base Legal (Ejemplo mínimo)
    // En fase real, esto cargaría miles de artículos.
    const normas = [
        {
            jurisdiccion: 'NACION',
            fuero: 'CIVIL',
            tipoNorma: 'CODIGO',
            nombre: 'Código Procesal Civil y Comercial de la Nación',
            articulo: '356',
            textoCompleto: 'En la contestación de la demanda el demandado deberá: 1) Reconocer o negar categóricamente cada uno de los hechos expuestos en la demanda...',
            fechaVigencia: new Date('1981-09-21'), // Fecha aprox vigencia to
        }
    ] as const;

    for (const norma of normas) {
        // Check if exists to avoid dupes (rough check)
        // Real implementation needs better UPSERT logic for massive seeding
        const exists = await prisma.legalNorm.findFirst({
            where: { articulo: norma.articulo, nombre: norma.nombre }
        });

        if (!exists) {
            await prisma.legalNorm.create({
                data: {
                    ...norma,
                    // Mock embedding (1536 zeros)
                    // In production, we would use OpenAI to generate this during seeding or lazily
                    // We use db.executeRaw because Prisma unsupported type 'vector' cannot be written directly easily in create() without raw query sometimes
                    // But let's try to leave embedding null for now or use raw.
                }
            });
        }
    }

    // 4. Calendario Judicial Inicial
    await prisma.calendarioJudicial.createMany({
        skipDuplicates: true,
        data: [
            {
                jurisdiccion: 'NACION',
                fecha: new Date('2026-01-01'),
                descripcion: 'Año Nuevo',
                esFeriado: true
            },
            {
                jurisdiccion: 'NACION',
                fecha: new Date('2026-07-09'),
                descripcion: 'Día de la Independencia',
                esFeriado: true
            }
            // ... more holidays
        ]
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
