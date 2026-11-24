
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JudicialScraperService } from './judicial-scraper.service';

@Injectable()
export class JudicialSyncService {
    private readonly logger = new Logger(JudicialSyncService.name);

    constructor(
        private prisma: PrismaService,
        private scraper: JudicialScraperService
    ) { }

    /**
     * Sincroniza un expediente específico bajo demanda
     */
    async syncCase(expedienteId: string) {
        const expediente = await this.prisma.expediente.findUnique({
            where: { id: expedienteId }
        });

        if (!expediente) throw new NotFoundException('Expediente no encontrado');

        try {
            const result = await this.scraper.scrapeMovements(expediente.numeroExpediente, expediente.jurisdiccion);

            if (result.status === 'NEW_MOVEMENTS') {
                this.logger.log(`Nuevos movimientos detectados para ${expediente.caratula}`);

                // Mapear movimientos a eventos o documentos en nuestro sistema
                // Por ahora, creamos un Evento de Agenda para notificar
                for (const mov of result.movements) {
                    await this.prisma.eventoAgenda.create({
                        data: {
                            expedienteId: expediente.id,
                            titulo: `[PJN] Nuevo Movimiento: ${mov.tipo}`,
                            descripcion: mov.descripcion,
                            fechaVencimiento: new Date(), // Hoy
                            tipoPlazo: 'MERO_TRAMITE',
                            estado: 'PENDIENTE',
                            isCritical: false
                        }
                    });
                }
                return { success: true, movementsAdded: result.movements.length };
            }

            return { success: true, message: 'El expediente está actualizado.' };

        } catch (error) {
            this.logger.error(`Error syncing case ${expedienteId}`, error);
            throw error;
        }
    }

    /**
     * Simula una sincronización masiva de todo el sistema
     */
    async syncSystem() {
        this.logger.log('Iniciando sincronización masiva del sistema...');
        // Simular demora
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            message: 'Sincronización completada',
            stats: { processed: 15, updated: 2, errors: 0 }
        };
    }
}
