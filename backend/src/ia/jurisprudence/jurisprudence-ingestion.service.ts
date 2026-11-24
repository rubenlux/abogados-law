
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EmbeddingService } from '../nlu/embedding.service';
import { JurisprudenceChunkingService } from './jurisprudence-chunking.service';

export interface JurisprudenceIngestionDto {
    // Identificación
    tribunal: string;
    sala?: string;
    nroExpediente: string;
    fecha: Date | string;

    // Clasificación
    jurisdiccion: string;
    fuero: string;
    tema: string[];

    // Contenido
    resumen: string;
    textoCompleto: string;

    // Jerarquía
    precedencia?: string;
    vigencia?: string;

    // Metadatos
    fuenteOficialUrl?: string;
    caratula?: string;
    magistrados?: string[];
    votos?: any;

    // Ingestion
    sourceType?: string;
    sourceUrl?: string;
    sourceFileHash?: string;
    ingestedBy?: string;
}

@Injectable()
export class JurisprudenceIngestionService {
    private readonly logger = new Logger(JurisprudenceIngestionService.name);

    constructor(
        private prisma: PrismaService,
        private embeddingService: EmbeddingService,
        private chunkingService: JurisprudenceChunkingService
    ) { }

    /**
     * Ingesta completa de un fallo judicial con chunking y embeddings
     */
    async ingestJurisprudence(dto: JurisprudenceIngestionDto) {
        this.logger.log(`Ingesting: ${dto.tribunal} - ${dto.nroExpediente}`);

        try {
            // 1. Verificar duplicados
            const existing = await this.prisma.jurisprudence.findFirst({
                where: {
                    tribunal: dto.tribunal as any,
                    nroExpediente: dto.nroExpediente,
                    fecha: typeof dto.fecha === 'string' ? new Date(dto.fecha) : dto.fecha
                }
            });

            if (existing) {
                this.logger.warn(`Duplicate detected: ${existing.id}`);
                return { status: 'duplicate', existingId: existing.id };
            }

            // 2. Generar embedding del texto completo
            this.logger.debug('Generating full-text embedding...');
            const fullEmbedding = await this.embeddingService.getEmbedding(
                `${dto.resumen}\n\n${dto.textoCompleto}`
            );

            // 3. Crear el fallo principal
            this.logger.debug('Creating jurisprudence record...');
            const jurisprudence = await this.prisma.jurisprudence.create({
                data: {
                    tribunal: dto.tribunal as any,
                    sala: dto.sala,
                    nroExpediente: dto.nroExpediente,
                    fecha: typeof dto.fecha === 'string' ? new Date(dto.fecha) : dto.fecha,
                    jurisdiccion: dto.jurisdiccion as any,
                    fuero: dto.fuero as any,
                    tema: dto.tema,
                    resumen: dto.resumen,
                    textoCompleto: dto.textoCompleto,
                    precedencia: (dto.precedencia || 'REFERENCIAL') as any,
                    vigencia: (dto.vigencia || 'VIGENTE') as any,
                    fuenteOficialUrl: dto.fuenteOficialUrl,
                    caratula: dto.caratula,
                    magistrados: dto.magistrados || [],
                    votos: dto.votos,
                    sourceType: dto.sourceType,
                    sourceUrl: dto.sourceUrl,
                    sourceFileHash: dto.sourceFileHash,
                    parsedAt: new Date(),
                    parsedBy: dto.ingestedBy || 'system',
                    parsingVersion: '1.0.0',
                    ingestedBy: dto.ingestedBy
                }
            });

            // 4. Actualizar embedding del fallo principal
            this.logger.debug('Updating full-text embedding...');
            const vectorString = JSON.stringify(fullEmbedding);
            await this.prisma.$executeRaw`
                UPDATE "Jurisprudence"
                SET embedding = ${vectorString}::vector
                WHERE id = ${jurisprudence.id}
            `;

            // 5. Chunking del texto
            this.logger.debug('Chunking text...');
            const chunks = this.chunkingService.chunkJurisprudence(dto.textoCompleto);

            // 6. Crear chunks con embeddings
            this.logger.debug(`Creating ${chunks.length} chunks...`);
            for (const chunkData of chunks) {
                // Generar embedding del chunk
                const chunkEmbedding = await this.embeddingService.getEmbedding(chunkData.texto);

                // Extraer keywords y conceptos
                const keywords = this.chunkingService.extractKeywords(chunkData.texto);
                const conceptos = this.chunkingService.detectLegalConcepts(chunkData.texto);

                // Crear chunk
                const chunk = await this.prisma.jurisprudenceChunk.create({
                    data: {
                        jurisprudenceId: jurisprudence.id,
                        chunkType: chunkData.chunkType,
                        chunkNumber: chunkData.chunkNumber,
                        texto: chunkData.texto,
                        keywords,
                        conceptosJuridicos: conceptos
                    }
                });

                // Actualizar embedding del chunk
                const chunkVectorString = JSON.stringify(chunkEmbedding);
                await this.prisma.$executeRaw`
                    UPDATE "JurisprudenceChunk"
                    SET embedding = ${chunkVectorString}::vector
                    WHERE id = ${chunk.id}
                `;
            }

            this.logger.log(`✅ Ingested successfully: ${jurisprudence.id} with ${chunks.length} chunks`);

            return {
                status: 'success',
                jurisprudenceId: jurisprudence.id,
                chunksCreated: chunks.length,
                jurisprudence
            };

        } catch (error) {
            this.logger.error(`Error ingesting jurisprudence: ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw error;
        }
    }

    /**
     * Ingesta masiva
     */
    async ingestBatch(cases: JurisprudenceIngestionDto[]) {
        const results = {
            success: 0,
            duplicates: 0,
            errors: 0,
            details: [] as any[]
        };

        for (const caseData of cases) {
            try {
                const result = await this.ingestJurisprudence(caseData);
                if (result.status === 'success') {
                    results.success++;
                } else if (result.status === 'duplicate') {
                    results.duplicates++;
                }
                results.details.push(result);
            } catch (error) {
                results.errors++;
                results.details.push({
                    status: 'error',
                    error: error.message,
                    case: caseData.nroExpediente
                });
                this.logger.error(`Error ingesting ${caseData.nroExpediente}:`, error);
            }

            // Pausa para no saturar OpenAI API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    /**
     * Registra una citación entre fallos
     */
    async registerCitation(params: {
        citingCaseId: string;
        citedCaseId: string;
        citationType: 'SIGUE' | 'DISTINGUE' | 'CRITICA';
        context?: string;
    }) {
        return this.prisma.jurisprudenceCitation.create({
            data: {
                citingCaseId: params.citingCaseId,
                citedCaseId: params.citedCaseId,
                citationType: params.citationType,
                context: params.context
            }
        });
    }
}
