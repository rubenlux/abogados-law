
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EmbeddingService } from '../nlu/embedding.service';
import { JurisprudenceRankingService } from './jurisprudence-ranking.service';

export interface JurisprudenceSearchQuery {
    query: string;
    jurisdiccion?: string;
    fuero?: string;
    tribunal?: string;
    precedencia?: string;
    vigencia?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    anio?: string; // Nuevo: Filtro por año específico
    tema?: string;
    limit?: number;
    threshold?: number;
    searchMode?: 'full' | 'chunks';
}

@Injectable()
export class JurisprudenceSearchService {
    private readonly logger = new Logger(JurisprudenceSearchService.name);

    constructor(
        private prisma: PrismaService,
        private embeddingService: EmbeddingService,
        private rankingService: JurisprudenceRankingService
    ) { }

    /**
     * Búsqueda semántica de jurisprudencia con ranking inteligente
     */
    async search(query: JurisprudenceSearchQuery) {
        this.logger.log(`Searching jurisprudence: "${query.query}"`);

        // Convert parameters to numbers to avoid SQL/Prisma errors
        const limit = typeof query.limit === 'string' ? parseInt(query.limit) : (query.limit || 10);
        const threshold = typeof query.threshold === 'string' ? parseFloat(query.threshold) : (query.threshold || 0.2); // Bajado a 0.2 para máxima tolerancia
        const searchMode = query.searchMode || 'full';

        try {
            // 1. Generar embedding de la consulta
            const queryEmbedding = await this.embeddingService.getEmbedding(query.query);
            const vectorString = JSON.stringify(queryEmbedding);

            let results;

            if (searchMode === 'chunks') {
                // Búsqueda a nivel de chunks (más granular)
                results = await this.searchByChunks(vectorString, query, limit, threshold);
            } else {
                // Búsqueda a nivel de fallo completo
                results = await this.searchByFullText(vectorString, query, limit, threshold);
            }

            this.logger.log(`Found ${results.length} results`);
            return {
                results,
                total: results.length,
                query: query.query
            };

        } catch (error) {
            this.logger.error(`Error searching jurisprudence: ${error.message}`);
            this.logger.warn('Falling back to simple list...');

            // Fallback: usar listAll si la búsqueda vectorial falla
            return await this.listAll(limit);
        }
    }

    /**
     * Búsqueda por texto completo del fallo
     */
    private async searchByFullText(
        vectorString: string,
        query: JurisprudenceSearchQuery,
        limit: number,
        threshold: number
    ) {
        // Construir filtros WHERE
        const whereConditions: string[] = ['embedding IS NOT NULL'];
        const params: any[] = [];

        if (query.jurisdiccion) {
            whereConditions.push(`jurisdiccion = $${params.length + 4}::"LegalNormJurisdiccion"`);
            params.push(query.jurisdiccion);
        }

        if (query.fuero) {
            whereConditions.push(`fuero = $${params.length + 4}::"LegalNormFuero"`);
            params.push(query.fuero);
        }

        if (query.tribunal) {
            whereConditions.push(`tribunal = $${params.length + 4}::"JurisprudenceTribunal"`);
            params.push(query.tribunal);
        }

        if (query.precedencia) {
            whereConditions.push(`precedencia = $${params.length + 4}::"JurisprudencePrecedencia"`);
            params.push(query.precedencia);
        }

        if (query.vigencia) {
            whereConditions.push(`vigencia = $${params.length + 4}::"JurisprudenceVigencia"`);
            params.push(query.vigencia);
        }

        if (query.fechaDesde) {
            whereConditions.push(`fecha >= $${params.length + 4}`);
            params.push(new Date(query.fechaDesde));
        }

        if (query.fechaHasta) {
            whereConditions.push(`fecha <= $${params.length + 4}`);
            params.push(new Date(query.fechaHasta));
        }

        if (query.anio) {
            const year = parseInt(query.anio);
            if (!isNaN(year)) {
                whereConditions.push(`fecha >= $${params.length + 4} AND fecha <= $${params.length + 5}`);
                params.push(new Date(year, 0, 1));
                params.push(new Date(year, 11, 31, 23, 59, 59));
            }
        }

        if (query.tema) {
            whereConditions.push(`$${params.length + 4} = ANY(tema)`);
            params.push(query.tema);
        }

        const whereClause = whereConditions.join(' AND ');

        // Query con similitud coseno
        let rawResults = await this.prisma.$queryRawUnsafe(`
            SELECT 
                id, tribunal, sala, "nroExpediente", fecha, jurisdiccion, fuero,
                tema, resumen, "textoCompleto", precedencia, vigencia,
                "fuenteOficialUrl", caratula, magistrados, "citationCount",
                1 - (embedding <=> $1::vector) as similarity
            FROM "Jurisprudence"
            WHERE ${whereClause}
            AND 1 - (embedding <=> $1::vector) > $2
            ORDER BY embedding <=> $1::vector ASC
            LIMIT $3
        `, vectorString, threshold, limit, ...params) as any[];

        // FALLBACK: Si no hay resultados semánticos, buscar por palabras clave (LIKE)
        if (rawResults.length === 0 && query.query.length > 3) {
            this.logger.log(`No semantic results for "${query.query}". Trying keyword fallback...`);
            const keyword = `%${query.query.toLowerCase()}%`;
            rawResults = await this.prisma.$queryRawUnsafe(`
                SELECT 
                    id, tribunal, sala, "nroExpediente", fecha, jurisdiccion, fuero,
                    tema, resumen, "textoCompleto", precedencia, vigencia,
                    "fuenteOficialUrl", caratula, magistrados, "citationCount",
                    0.5 as similarity -- Score medio para resultados de keywords
                FROM "Jurisprudence"
                WHERE (${whereClause})
                AND (
                    LOWER(caratula) LIKE $1 OR 
                    LOWER(resumen) LIKE $1 OR 
                    LOWER("textoCompleto") LIKE $1 OR
                    $2 = ANY(tema)
                )
                ORDER BY fecha DESC
                LIMIT $3
            `, keyword, query.query, limit, ...params);
        }

        // Calcular ranking score para cada resultado
        const rankedResults = rawResults.map(result => {
            const matchesJurisdiction = query.jurisdiccion ? result.jurisdiccion === query.jurisdiccion : false;

            const rankingScore = this.rankingService.calculateRankingScore({
                similarity: parseFloat(result.similarity),
                tribunal: result.tribunal,
                precedencia: result.precedencia,
                fecha: result.fecha,
                vigencia: result.vigencia,
                citationCount: result.citationCount || 0,
                matchesJurisdiction
            });

            return {
                ...result,
                similarity: parseFloat(result.similarity),
                rankingScore,
                precedent_score: rankingScore // Alias for requirement
            };
        });

        // Ordenar por ranking score
        return this.rankingService.rankResults(rankedResults);
    }

    /**
     * Búsqueda por chunks (considerandos, doctrina)
     */
    private async searchByChunks(
        vectorString: string,
        query: JurisprudenceSearchQuery,
        limit: number,
        threshold: number
    ) {
        // Buscar chunks similares
        const chunkResults = await this.prisma.$queryRawUnsafe(`
            SELECT 
                c.id as "chunkId",
                c."jurisprudenceId",
                c."chunkType",
                c."chunkNumber",
                c.texto,
                c.keywords,
                c."conceptosJuridicos",
                j.tribunal,
                j.sala,
                j."nroExpediente",
                j.fecha,
                j.jurisdiccion,
                j.fuero,
                j.tema,
                j.resumen,
                j.precedencia,
                j.vigencia,
                j."fuenteOficialUrl",
                j.caratula,
                j."citationCount",
                1 - (c.embedding <=> $1::vector) as similarity
            FROM "JurisprudenceChunk" c
            INNER JOIN "Jurisprudence" j ON c."jurisprudenceId" = j.id
            WHERE c.embedding IS NOT NULL
            AND 1 - (c.embedding <=> $1::vector) > $2
            ORDER BY c.embedding <=> $1::vector ASC
            LIMIT $3
        `, vectorString, threshold, limit * 2) as any[]; // Buscar más chunks para agrupar

        // Agrupar por jurisprudencia y calcular ranking
        const groupedByCase = new Map<string, any>();

        for (const chunk of chunkResults) {
            const caseId = chunk.jurisprudenceId;

            if (!groupedByCase.has(caseId)) {
                groupedByCase.set(caseId, {
                    id: caseId,
                    tribunal: chunk.tribunal,
                    sala: chunk.sala,
                    nroExpediente: chunk.nroExpediente,
                    fecha: chunk.fecha,
                    jurisdiccion: chunk.jurisdiccion,
                    fuero: chunk.fuero,
                    tema: chunk.tema,
                    resumen: chunk.resumen,
                    precedencia: chunk.precedencia,
                    vigencia: chunk.vigencia,
                    fuenteOficialUrl: chunk.fuenteOficialUrl,
                    caratula: chunk.caratula,
                    citationCount: chunk.citationCount || 0,
                    matchedChunks: [],
                    maxSimilarity: 0
                });
            }

            const caseData = groupedByCase.get(caseId)!;
            caseData.matchedChunks.push({
                chunkId: chunk.chunkId,
                chunkType: chunk.chunkType,
                chunkNumber: chunk.chunkNumber,
                texto: chunk.texto,
                keywords: chunk.keywords,
                conceptosJuridicos: chunk.conceptosJuridicos,
                similarity: parseFloat(chunk.similarity)
            });

            // Actualizar similitud máxima
            if (parseFloat(chunk.similarity) > caseData.maxSimilarity) {
                caseData.maxSimilarity = parseFloat(chunk.similarity);
            }
        }

        // Calcular ranking para cada caso
        const rankedResults = Array.from(groupedByCase.values()).map(caseData => {
            const matchesJurisdiction = query.jurisdiccion ? caseData.jurisdiccion === query.jurisdiccion : false;

            const rankingScore = this.rankingService.calculateRankingScore({
                similarity: caseData.maxSimilarity,
                tribunal: caseData.tribunal,
                precedencia: caseData.precedencia,
                fecha: caseData.fecha,
                vigencia: caseData.vigencia,
                citationCount: caseData.citationCount,
                matchesJurisdiction
            });

            return {
                ...caseData,
                similarity: caseData.maxSimilarity,
                rankingScore,
                precedent_score: rankingScore, // Alias
                chunksMatched: caseData.matchedChunks.length
            };
        });

        // Ordenar y limitar
        return this.rankingService.rankResults(rankedResults).slice(0, limit);
    }

    /**
     * Buscar fallo por ID
     */
    async findById(id: string) {
        return this.prisma.jurisprudence.findUnique({
            where: { id },
            include: {
                chunks: {
                    orderBy: { chunkNumber: 'asc' }
                },
                citedBy: {
                    include: { citingCase: { select: { id: true, caratula: true, fecha: true } } }
                },
                cites: {
                    include: { citedCase: { select: { id: true, caratula: true, fecha: true } } }
                }
            }
        });
    }

    /**
     * Buscar fallo específico por número de expediente
     */
    async findByExpediente(nroExpediente: string, tribunal?: string) {
        const where: any = { nroExpediente };
        if (tribunal) {
            where.tribunal = tribunal;
        }

        return this.prisma.jurisprudence.findFirst({
            where,
            include: {
                chunks: true,
                citedBy: {
                    include: {
                        citingCase: {
                            select: {
                                id: true,
                                nroExpediente: true,
                                tribunal: true,
                                fecha: true,
                                caratula: true
                            }
                        }
                    }
                },
                cites: {
                    include: {
                        citedCase: {
                            select: {
                                id: true,
                                nroExpediente: true,
                                tribunal: true,
                                fecha: true,
                                caratula: true
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Obtener estadísticas de la base de jurisprudencia
     */
    async getStats() {
        const [
            total,
            byTribunal,
            byPrecedencia,
            byVigencia,
            totalChunks
        ] = await Promise.all([
            this.prisma.jurisprudence.count(),
            this.prisma.jurisprudence.groupBy({
                by: ['tribunal'],
                _count: true
            }),
            this.prisma.jurisprudence.groupBy({
                by: ['precedencia'],
                _count: true
            }),
            this.prisma.jurisprudence.groupBy({
                by: ['vigencia'],
                _count: true
            }),
            this.prisma.jurisprudenceChunk.count()
        ]);

        // Count embeddings with raw SQL (Prisma doesn't support filtering by Unsupported types)
        const embeddingResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM "Jurisprudence"
            WHERE embedding IS NOT NULL
        `;
        const withEmbeddings = Number(embeddingResult[0].count);

        return {
            total,
            withEmbeddings,
            embeddingCoverage: total > 0 ? `${((withEmbeddings / total) * 100).toFixed(2)}%` : '0%',
            totalChunks,
            avgChunksPerCase: total > 0 ? (totalChunks / total).toFixed(2) : '0',
            byTribunal,
            byPrecedencia,
            byVigencia
        };
    }

    /**
     * Obtener fallos relacionados (citaciones)
     */
    async getRelatedCases(jurisprudenceId: string) {
        const citations = await this.prisma.jurisprudenceCitation.findMany({
            where: {
                OR: [
                    { citingCaseId: jurisprudenceId },
                    { citedCaseId: jurisprudenceId }
                ]
            },
            include: {
                citingCase: {
                    select: {
                        id: true,
                        nroExpediente: true,
                        tribunal: true,
                        fecha: true,
                        caratula: true,
                        resumen: true
                    }
                },
                citedCase: {
                    select: {
                        id: true,
                        nroExpediente: true,
                        tribunal: true,
                        fecha: true,
                        caratula: true,
                        resumen: true
                    }
                }
            }
        });

        return {
            cites: citations.filter(c => c.citingCaseId === jurisprudenceId),
            citedBy: citations.filter(c => c.citedCaseId === jurisprudenceId)
        };
    }

    /**
     * Listar todos los casos (sin búsqueda semántica)
     * Útil para debugging o cuando OpenAI no está disponible
     */
    async listAll(limit: any = 10) {
        const limitNum = typeof limit === 'string' ? parseInt(limit) : (limit || 10);
        const cases = await this.prisma.jurisprudence.findMany({
            take: limitNum,
            orderBy: {
                fecha: 'desc'
            },
            select: {
                id: true,
                tribunal: true,
                nroExpediente: true,
                fecha: true,
                jurisdiccion: true,
                fuero: true,
                tema: true,
                resumen: true,
                fuenteOficialUrl: true,
                precedencia: true
            }
        });

        return {
            results: cases.map(c => ({
                ...c,
                similarity: 1.0, // No hay búsqueda semántica
                rankingScore: 100 // Score fijo
            })),
            total: cases.length,
            query: 'list-all'
        };
    }
}
