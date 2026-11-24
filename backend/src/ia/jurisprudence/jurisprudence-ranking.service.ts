
import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio de ranking de jurisprudencia
 * Combina jerarquía tribunal, fecha, similitud semántica, citas y jurisdicción
 */
@Injectable()
export class JurisprudenceRankingService {
    private readonly logger = new Logger(JurisprudenceRankingService.name);

    /**
     * Jerarquía de tribunales (mayor = más autoridad)
     */
    private readonly TRIBUNAL_HIERARCHY = {
        CSJN: 100,
        TRIBUNAL_SUPERIOR: 85,
        CAMARA_FEDERAL: 75,
        CAMARA_NACIONAL: 70,
        CAMARA_PROVINCIAL: 60,
        JUZGADO_FEDERAL: 40,
        JUZGADO_NACIONAL: 35,
        JUZGADO_PROVINCIAL: 30
    };

    /**
     * Peso de precedencia (mayor = más vinculante)
     */
    private readonly PRECEDENCIA_WEIGHT = {
        PLENARIO: 100,
        OBLIGATORIO: 90,
        PERSUASIVO: 60,
        REFERENCIAL: 30
    };

    /**
     * Calcula score de ranking combinado
     * 
     * @param similarity - Similitud semántica (0-1)
     * @param tribunal - Tipo de tribunal
     * @param precedencia - Nivel de precedencia
     * @param fecha - Fecha del fallo
     * @param vigencia - Estado de vigencia
     * @param citationCount - Cantidad de veces citado
     * @param matchesJurisdiction - Si coincide con la jurisdicción de búsqueda
     * @returns Score final (0-100) llamado 'precedent_score'
     */
    calculateRankingScore(params: {
        similarity: number;
        tribunal: string;
        precedencia: string;
        fecha: Date;
        vigencia: string;
        citationCount?: number;
        matchesJurisdiction?: boolean;
    }): number {
        const { similarity, tribunal, precedencia, fecha, vigencia, citationCount = 0, matchesJurisdiction = false } = params;

        // A. Semantic Relevance (35%)
        const similarityScore = similarity * 35;

        // B. Static Authority (Tribunal) (20%)
        const tribunalWeight = this.TRIBUNAL_HIERARCHY[tribunal] || 30;
        const tribunalScore = (tribunalWeight / 100) * 20;

        // C. Citation Impact (15%)
        // Logarithmic scale: 0 cites = 0, 10 cites = ~50%, 100 cites = 100%
        // Score = log10(count + 1) * factor
        // log10(100) = 2. We want 2 -> 15 points. So factor ~7.5
        const citationScoreRaw = Math.log10(citationCount + 1) * 7.5;
        const citationScore = Math.min(15, citationScoreRaw); // Cap at 15%

        // D. Temporal Relevance (10%)
        const actualidadScore = this.calculateActualidadScore(fecha) * 10;

        // E. Jurisdiction Alignment (10%)
        const jurisdictionScore = matchesJurisdiction ? 10 : 0;

        // F. Precedence Type (10%)
        const precedenciaWeight = this.PRECEDENCIA_WEIGHT[precedencia] || 30;
        const precedenciaScore = (precedenciaWeight / 100) * 10;

        // Base Score Sum
        let finalScore = similarityScore + tribunalScore + citationScore + actualidadScore + jurisdictionScore + precedenciaScore;

        // Penalties
        if (vigencia === 'MODIFICADO') finalScore *= 0.8;
        if (vigencia === 'SUPERADO') finalScore *= 0.6;
        if (vigencia === 'DEROGADO') finalScore *= 0.1;

        // Validation
        return Math.min(100, Math.max(0, parseFloat(finalScore.toFixed(2))));
    }

    /**
     * Calcula score de actualidad basado en la fecha
     * Decaimiento suave para mantener relevancia histórica
     */
    private calculateActualidadScore(fecha: Date): number {
        const now = new Date();
        const diffYears = (now.getTime() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (diffYears < 0) return 1; // Future dates protection

        // 0-2 years: 1.0
        // 5 years: 0.8
        // 10 years: 0.6
        // 20 years: 0.4
        return Math.exp(-0.05 * diffYears);
    }

    /**
     * Ordena resultados por score de ranking
     */
    rankResults<T extends { rankingScore?: number }>(results: T[]): T[] {
        return results.sort((a, b) => (b.rankingScore || 0) - (a.rankingScore || 0));
    }

    /**
     * Filtra resultados por umbral mínimo de score
     */
    filterByMinScore<T extends { rankingScore?: number }>(
        results: T[],
        minScore: number = 30
    ): T[] {
        return results.filter(r => (r.rankingScore || 0) >= minScore);
    }
}
