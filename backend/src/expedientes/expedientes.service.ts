import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateExpedienteDto } from './dto/create-expediente.dto';

@Injectable()
export class ExpedientesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.expediente.findMany({
            orderBy: { updatedAt: 'desc' }
        });
    }

    async create(createExpedienteDto: CreateExpedienteDto) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Resolve Organization (MVP: Default or Provided)
            let orgId = createExpedienteDto.organizationId;
            if (!orgId) {
                const defaultOrg = await tx.organization.findFirst();
                if (!defaultOrg) throw new InternalServerErrorException("No organization found");
                orgId = defaultOrg.id;
            }

            // 2. Create Expediente
            const newExpediente = await tx.expediente.create({
                data: {
                    caratula: createExpedienteDto.caratula,
                    numeroExpediente: createExpedienteDto.numero,
                    juzgado: createExpedienteDto.juzgado,
                    jurisdiccion: createExpedienteDto.jurisdiccion,
                    organizationId: orgId
                }
            });

            // 3. Create Audit Log (Implicitly "CREATED")
            // In a real system, we'd add an entry to AuditLog here within the transaction.

            return newExpediente;
        });
    }
}
