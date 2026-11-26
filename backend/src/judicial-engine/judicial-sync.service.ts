import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JudicialScraperService } from "./judicial-scraper.service";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";

@Injectable()
export class JudicialSyncService {
  private readonly logger = new Logger(JudicialSyncService.name);

  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly scraper: JudicialScraperService,
  ) {}

  /**
   * Sincroniza un expediente específico validando pertenencia a la organización activa
   * y propagando organizationId a cada EventoAgenda generado.
   */
  async syncCase(expedienteId: string, ctx: ActiveOrgContext) {
    const expediente = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: {
          id: true,
          caratula: true,
          numeroExpediente: true,
          jurisdiccion: true,
        },
      }),
    );

    if (!expediente) {
      throw new NotFoundException("Expediente no encontrado");
    }

    try {
      const result = await this.scraper.scrapeMovements(
        expediente.numeroExpediente,
        expediente.jurisdiccion,
      );

      if (result.status === "NEW_MOVEMENTS") {
        this.logger.log(
          `Nuevos movimientos detectados para ${expediente.caratula}`,
        );

        await this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
          for (const mov of result.movements) {
            await tx.eventoAgenda.create({
              data: {
                expedienteId: expediente.id,
                organizationId: ctx.organizationId,
                titulo: `[PJN] Nuevo Movimiento: ${mov.tipo}`,
                descripcion: mov.descripcion,
                fechaVencimiento: new Date(),
                tipoPlazo: "MERO_TRAMITE",
                estado: "PENDIENTE",
                isCritical: false,
              },
            });
          }
        });

        return { success: true, movementsAdded: result.movements.length };
      }

      return { success: true, message: "El expediente está actualizado." };
    } catch (error) {
      this.logger.error(`Error syncing case ${expedienteId}`, error);
      throw error;
    }
  }

  /**
   * Reservado a plataforma/cron iterado por organización; bloqueado en endpoint HTTP para tenants.
   */
  async syncSystem() {
    this.logger.log("Iniciando sincronización masiva del sistema...");
    return {
      success: true,
      message: "Sincronización completada",
      stats: { processed: 0, updated: 0, errors: 0 },
    };
  }
}
