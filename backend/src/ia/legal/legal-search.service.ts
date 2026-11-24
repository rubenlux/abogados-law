
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EmbeddingService } from '../nlu/embedding.service';

export interface LegalSearchQuery {
    query: string;
    jurisdiccion?: string;
    fuero?: string;
    estado?: string;
    limit?: number;
    threshold?: number; // Similarity threshold (0-1)
}

export interface LegalSearchResult {
    id: string;
    nombre: string;
    articulo: string;
    textoCompleto: string;
    jurisdiccion: string;
    fuero: string;
    similarity: number;
    metadata: {
        numeroNorma?: string;
        fechaVigencia: Date;
        estado: string;
        fuenteOficialUrl?: string;
    };
}

@Injectable()
export class LegalSearchService {
    private readonly logger = new Logger(LegalSearchService.name);

    constructor(
        private prisma: PrismaService,
        private embeddingService: EmbeddingService
    ) { }

    /**
     * Búsqueda semántica de normas legales
     */
    async search(searchQuery: LegalSearchQuery): Promise<LegalSearchResult[]> {
        const {
            query,
            jurisdiccion,
            fuero,
            estado = 'VIGENTE',
            limit = 10,
            threshold = 0.5
        } = searchQuery;

        this.logger.log(`Searching: "${query}" (threshold: ${threshold})`);

        // 1. Generate embedding
        const embedding = await this.embeddingService.getEmbedding(query);
        const vectorString = JSON.stringify(embedding);

        // 2. Build filters
        const whereConditions: string[] = ['embedding IS NOT NULL'];
        const params: any[] = [vectorString, threshold, limit];
        // params mapping: $1=vector, $2=threshold, $3=limit

        if (jurisdiccion) {
            params.push(jurisdiccion);
            whereConditions.push(`jurisdiccion = $${params.length}::"LegalNormJurisdiccion"`);
        }
        if (fuero) {
            params.push(fuero);
            whereConditions.push(`fuero = $${params.length}::"LegalNormFuero"`);
        }
        if (estado) {
            params.push(estado);
            whereConditions.push(`estado = $${params.length}::"LegalNormEstado"`);
        }

        const whereClause = whereConditions.join(' AND ');

        // 3. Execute vector search safely
        const results = await this.prisma.$queryRawUnsafe(`
            SELECT 
                id, 
                nombre, 
                articulo, 
                "textoCompleto",
                jurisdiccion,
                fuero,
                "numeroNorma",
                "fechaVigencia",
                estado,
                "fuenteOficialUrl",
                1 - (embedding <=> $1::vector) as similarity
            FROM "LegalNorm"
            WHERE ${whereClause}
            AND 1 - (embedding <=> $1::vector) > $2
            ORDER BY embedding <=> $1::vector ASC
            LIMIT $3;
        `, ...params) as any[];

        return results.map(r => ({
            id: r.id,
            nombre: r.nombre,
            articulo: r.articulo,
            textoCompleto: r.textoCompleto,
            jurisdiccion: r.jurisdiccion,
            fuero: r.fuero,
            similarity: parseFloat(r.similarity),
            metadata: {
                numeroNorma: r.numeroNorma,
                fechaVigencia: r.fechaVigencia,
                estado: r.estado,
                fuenteOficialUrl: r.fuenteOficialUrl
            }
        }));
    }


    /**
     * Búsqueda exacta por artículo
     */
    async findByArticle(numeroNorma: string, articulo: string, jurisdiccion?: string) {
        return this.prisma.legalNorm.findFirst({
            where: {
                numeroNorma,
                articulo,
                jurisdiccion: jurisdiccion as any,
                estado: 'VIGENTE'
            },
            orderBy: { versionNorma: 'desc' }
        });
    }

    /**
     * Obtener historial de versiones de una norma
     */
    async getVersionHistory(numeroNorma: string, articulo: string) {
        return this.prisma.legalNorm.findMany({
            where: {
                numeroNorma,
                articulo
            },
            orderBy: { versionNorma: 'desc' }
        });
    }

    /**
     * Detectar conflictos normativos
     */
    async detectConflicts(normId: string) {
        const norm = await this.prisma.legalNorm.findUnique({ where: { id: normId } });
        if (!norm || !norm.textoNormalizado) return [];

        // Buscar normas muy similares (posibles conflictos)
        const similar = await this.search({
            query: norm.textoNormalizado,
            jurisdiccion: norm.jurisdiccion,
            fuero: norm.fuero,
            threshold: 0.90, // Alta similitud
            limit: 5
        });

        // Filtrar la norma misma
        return similar.filter(s => s.id !== normId);
    }

    /**
     * Estadísticas de la base legal
     */
    async getStats() {
        const [
            total,
            byJurisdiccion,
            byFuero,
            byEstado
        ] = await Promise.all([
            this.prisma.legalNorm.count(),
            this.prisma.legalNorm.groupBy({
                by: ['jurisdiccion'],
                _count: true
            }),
            this.prisma.legalNorm.groupBy({
                by: ['fuero'],
                _count: true
            }),
            this.prisma.legalNorm.groupBy({
                by: ['estado'],
                _count: true
            })
        ]);

        // Count embeddings with raw SQL
        const embeddingResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM "LegalNorm" WHERE embedding IS NOT NULL
        `;
        const withEmbeddings = Number(embeddingResult[0].count);

        return {
            total,
            withEmbeddings,
            embeddingCoverage: total > 0 ? (withEmbeddings / total * 100).toFixed(2) + '%' : '0%',
            byJurisdiccion,
            byFuero,
            byEstado
        };
    }
}
