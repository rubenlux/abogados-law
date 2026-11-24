
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LegalSearchService } from '../legal/legal-search.service';
import { JurisprudenceSearchService } from '../jurisprudence/jurisprudence-search.service';

@Injectable()
export class ChatContextService {
    private readonly logger = new Logger(ChatContextService.name);

    constructor(
        private prisma: PrismaService,
        private legalSearch: LegalSearchService,
        private jurisprudenceSearch: JurisprudenceSearchService
    ) { }

    async buildContext(expedienteId: string, query: string, historySummary: string | null): Promise<string> {
        let expedienteInfo = "";

        // Caso especial: Chat General (sin expediente específico)
        if (expedienteId === 'general-workspace-user') {
            expedienteInfo = `
[CONTEXTO GENERAL]
Este es un chat de asistencia legal general.
No estás analizando un expediente específico en este momento.
El objetivo es responder consultas doctrinarias, análisis de fallos externos o redacción de escritos genéricos.
`.trim();
        } else {
            // Caso normal: Chat dentro de un Expediente
            const expediente = await this.prisma.expediente.findUnique({
                where: { id: expedienteId },
            });

            if (!expediente) {
                // Si no se encuentra, retornamos contexto vacío o error
                // Preferible lanzar error para que el controller lo maneje
                throw new Error(`Expediente ${expedienteId} no encontrado`);
            }

            expedienteInfo = `
[EXPEDIENTE ACTUAL]
Carátula: ${expediente.caratula}
Número: ${expediente.numeroExpediente}
Jurisdicción: ${expediente.jurisdiccion}
Juzgado: ${expediente.juzgado}
Estado: ${expediente.estado}
`.trim();
        }


        // RAG Normativa
        let leyesInfo = "";
        try {
            // Buscamos leyes solo si la query tiene suficiente longitud
            if (query.length > 5) {
                const leyes = await this.legalSearch.search({ query, limit: 2, threshold: 0.70 });
                if (leyes.length > 0) {
                    leyesInfo = `\n[LEYES SUGERIDAS]\n` +
                        leyes.map(l => `- ${l.nombre} Art. ${l.articulo} (${l.metadata.estado}): ${l.textoCompleto.substring(0, 300)}...`).join('\n');
                }
            }
        } catch (error) {
            this.logger.warn(`Error buscando leyes: ${error.message}`);
        }

        // RAG Jurisprudencia
        let jurisprudenceInfo = "";
        try {
            if (query.length > 5) {
                const searchResult: any = await this.jurisprudenceSearch.search({ query, limit: 2, threshold: 0.70 });
                const fallos = searchResult.results || [];

                if (fallos.length > 0) {
                    jurisprudenceInfo = `\n[JURISPRUDENCIA SUGERIDA]\n` +
                        fallos.map((f: any) => {
                            const score = f.precedent_score ? `[Score: ${f.precedent_score}]` : '';
                            return `- ${f.caratula} (${f.tribunal}, ${new Date(f.fecha).getFullYear()}) ${score}: ${f.resumen ? f.resumen.substring(0, 300) : ''}...`
                        }).join('\n');
                }
            }
        } catch (error) {
            this.logger.warn(`Error buscando jurisprudencia: ${error.message}`);
        }

        const memInfo = historySummary ? `\n[RESUMEN CONVERSACIÓN PREVIA]\n${historySummary}` : "";

        return `${expedienteInfo}\n${leyesInfo}\n${jurisprudenceInfo}\n${memInfo}`;
    }
}
