
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { JurisprudenceSearchService } from '../jurisprudence/jurisprudence-search.service';
import { LegalSearchService } from '../legal/legal-search.service';

/**
 * Motor de Scoring de Riesgo Jurídico
 * Analiza expedientes para determinar probabilidad de éxito y complejidad.
 */
@Injectable()
export class LegalRiskService {
    private readonly logger = new Logger(LegalRiskService.name);
    private chatModel: ChatOpenAI;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private jurisprudenceSearch: JurisprudenceSearchService,
        private legalSearch: LegalSearchService
    ) {
        const apiKey = this.configService.get('OPENAI_API_KEY');
        this.chatModel = new ChatOpenAI({
            openAIApiKey: apiKey || 'mock-key',
            modelName: 'gpt-4o', // Alta capacidad de razonamiento
            temperature: 0.1,
        });
    }

    /**
     * Realiza análisis de riesgo completo para un expediente
     */
    async analyzeRisk(expedienteId: string, userId: string) {
        this.logger.log(`Analyzing risk for Expediente ${expedienteId}`);

        // 1. Obtener datos del expediente
        const expediente = await this.prisma.expediente.findUnique({
            where: { id: expedienteId }
        });

        if (!expediente) {
            this.logger.warn(`Expediente ${expedienteId} not found. Returning DEMO/MOCK analysis for testing.`);
            return {
                id: 'mock-analysis-id',
                expedienteId: expedienteId,
                score: 78,
                riskLevel: "ALTO",
                jurisprudenceScore: 85,
                normativeScore: 60,
                complexityScore: 70,
                factors: { demo: true, message: "Generated because case was not found in DB" },
                explanation: "[MODO DEMO] Alta conflictividad jurisprudencial detectada en casos similares. Se recomienda recabar mayor prueba documental antes de iniciar demanda.",
                analyzedAt: new Date(),
                userId: userId
            };
        }

        // 2. Buscar Precedentes (RAG)
        // Buscamos fallos similares a la carátula y etiquetas
        const queryText = `${expediente.caratula} ${expediente.tags.join(' ')}`;
        const searchResult: any = await this.jurisprudenceSearch.search({
            query: queryText,
            jurisdiccion: expediente.jurisdiccion,
            limit: 5,
            threshold: 0.65
        });
        const precedentes = searchResult.results || [];

        // 3. Buscar Marco Normativo (RAG)
        // Buscamos leyes aplicables
        const leyes = await this.legalSearch.search({
            query: queryText,
            jurisdiccion: expediente.jurisdiccion as any, // casting simple
            limit: 3
        });

        // 4. Prompt Engineering para Scoring
        const systemPrompt = `
Eres un Auditor Legal Senior especializado en Análisis de Riesgo de Litigios en Argentina.
Tu tarea es evaluar el riesgo de un expediente judicial basándote en los datos provistos y la jurisprudencia encontrada.

FACTORES A EVALUAR:
1. JURISPRUDENCIA: ¿Hay fallos contradictorios? (Seguridad Jurídica). Si los fallos apoyan la pretensión típica de este caso, el riesgo baja.
2. ANTIGÜEDAD NORMATIVA: Leyes muy viejas o recién modificadas aumentan el riesgo/incertidumbre.
3. JURISDICCIÓN: Evalua la complejidad del fuero local (${expediente.jurisdiccion}).
4. TIPO DE PROCESO: ¿Es ordinario, ejecutivo, amparo?

GENERA UN JSON ESTRICTO CON:
{
  "score": número 0-100 (0=xito seguro/tramite, 100=Pérdida casi segura/Alta complejidad),
  "level": "BAJO", "MEDIO", "ALTO", o "CRITICO",
  "jurisprudenceScore": 0-100 (Impacto negativo de la jurisprudencia),
  "normativeScore": 0-100 (Inestabilidad normativa),
  "complexityScore": 0-100 (Complejidad intrínseca),
  "factors": {
     "contradiction": boolean,
     "old_laws": boolean,
     "jurisdiction_complexity": "LOW"|"HIGH"
  },
  "explanation": "Resumen ejecutivo de 3 oraciones justificando el score."
}

CONTEXTO JURISPRUDENCIAL (RAG):
${precedentes.map(p => `- ${p.caratula} (${p.tribunal}): ${p.resumen.substring(0, 200)}... Score: ${p.rankingScore}`).join('\n')}

CONTEXTO NORMATIVO (RAG):
${leyes.map(l => `- ${l.nombre} (${l.metadata.estado}): ${l.textoCompleto.substring(0, 200)}...`).join('\n')}
`.trim();

        const userPrompt = `
EXPEDIENTE:
Carátula: ${expediente.caratula}
Fuero/Juzgado: ${expediente.jurisdiccion} - ${expediente.juzgado}
Estado: ${expediente.estado}

Analiza y genera el score de riesgo JSON.
`.trim();

        // 5. LLM Inference
        let resultJson;
        try {
            const result = await this.chatModel.call([
                new SystemMessage(systemPrompt),
                new HumanMessage(userPrompt)
            ]);
            const content = String(result.content).replace(/```json/g, '').replace(/```/g, '').trim();
            resultJson = JSON.parse(content);
        } catch (error) {
            this.logger.error("Error en inferencia de riesgo", error);
            // Fallback
            resultJson = {
                score: 50,
                level: "MEDIO",
                jurisprudenceScore: 50,
                normativeScore: 50,
                complexityScore: 50,
                factors: {},
                explanation: "No se pudo calcular el riesgo detallado por error en el servicio de IA."
            };
        }

        // 6. Persistir Análisis
        const analysis = await this.prisma.legalRiskAnalysis.create({
            data: {
                expedienteId: expedienteId,
                userId: userId,
                score: resultJson.score,
                riskLevel: resultJson.level,
                jurisprudenceScore: resultJson.jurisprudenceScore,
                normativeScore: resultJson.normativeScore,
                complexityScore: resultJson.complexityScore,
                factors: resultJson.factors,
                explanation: resultJson.explanation
            }
        });

        return analysis;
    }

    /**
     * Obtener historial de análisis de un expediente
     */
    async getHistory(expedienteId: string) {
        return this.prisma.legalRiskAnalysis.findMany({
            where: { expedienteId },
            orderBy: { analyzedAt: 'desc' }
        });
    }
}
