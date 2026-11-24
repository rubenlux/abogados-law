
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AgendaService {
    private readonly logger = new Logger(AgendaService.name);

    constructor(private prisma: PrismaService) { }

    // --- CALENDARIO JUDICIAL (Holidays) ---

    async areDatesHolidays(dates: Date[], jurisdiccion: string) {
        return this.prisma.calendarioJudicial.findMany({
            where: {
                jurisdiccion,
                fecha: { in: dates }
            }
        });
    }

    async getHolidays(jurisdiccion: string, year: number) {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        return this.prisma.calendarioJudicial.findMany({
            where: {
                jurisdiccion,
                fecha: { gte: start, lte: end }
            }
        });
    }

    // --- EVENTOS AGENDA (User Events) ---

    async createEvent(data: any) {
        return this.prisma.eventoAgenda.create({
            data: {
                titulo: data.titulo,
                fechaVencimiento: new Date(data.fechaVencimiento),
                tipoPlazo: data.tipoPlazo || 'ORDINARIO',
                expedienteId: data.expedienteId,
                descripcion: data.descripcion,
                isCritical: data.isCritical || false,
                estado: 'PENDIENTE'
            }
        });
    }

    async findAll(userId: string, query: any) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) return [];

        const where: any = {
            expediente: {
                organizationId: user.organizationId
            }
        };

        if (query.expedienteId) where.expedienteId = query.expedienteId;

        return this.prisma.eventoAgenda.findMany({
            where,
            include: { expediente: { select: { caratula: true, numeroExpediente: true, juzgado: true } } },
            orderBy: { fechaVencimiento: 'asc' }
        });
    }

    @Cron(CronExpression.EVERY_DAY_AT_9AM)
    async handleCron() {
        this.logger.debug('Running deadline checks');
        // Basic Check
        const today = new Date();
        const next3Days = new Date(today);
        next3Days.setDate(today.getDate() + 3);

        const urgentEvents = await this.prisma.eventoAgenda.findMany({
            where: {
                estado: 'PENDIENTE',
                fechaVencimiento: {
                    lte: next3Days,
                    gte: today
                }
            },
            include: { expediente: true }
        });

        if (urgentEvents.length > 0) {
            this.logger.warn(`Found ${urgentEvents.length} urgent deadlines due soon.`);
            // TODO: dispatch email or internal notification
        }
    }
}
