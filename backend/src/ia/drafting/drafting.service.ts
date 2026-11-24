
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { LegalSearchService } from '../legal/legal-search.service';
import { JurisprudenceSearchService } from '../jurisprudence/jurisprudence-search.service';

export interface DraftInputDto {
    userId: string;
    expedienteId?: string;
    draftType: 'DEMANDA' | 'CONTESTACION' | 'RECURSO' | 'MERO_TRAMITE' | 'OTRO';
    jurisdiction: string;
    fuero: string;
    facts: string;
    dataContext?: any; // Additional context like client data, opposing party, etc.
}

@Injectable()
export class DraftingService {
    private readonly logger = new Logger(DraftingService.name);
    private chatModel: ChatOpenAI;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private legalSearchService: LegalSearchService,
        private jurisprudenceSearchService: JurisprudenceSearchService,
    ) {
        const apiKey = this.configService.get('OPENAI_API_KEY');
        this.chatModel = new ChatOpenAI({
            openAIApiKey: apiKey || 'mock-key',
            modelName: 'gpt-4o', // Capable model for legal drafting
            temperature: 0.2, // Low temperature for precision
        });
    }

    async generateDraft(input: DraftInputDto) {
        this.logger.log(`Generating draft ${input.draftType} for User ${input.userId}`);

        // 1. Retrieve RAG Context (Laws)
        let relevantLaws: any[] = [];
        try {
            relevantLaws = await this.legalSearchService.search({
                query: input.facts,
                jurisdiccion: input.jurisdiction,
                fuero: input.fuero,
                limit: 5,
                threshold: 0.6
            });
        } catch (e) {
            this.logger.warn('Error retrieving laws', e);
        }

        // 2. Retrieve RAG Context (Jurisprudence)
        let relevantJurisprudence: any[] = [];
        try {
            const searchResult: any = await this.jurisprudenceSearchService.search({
                query: input.facts,
                jurisdiccion: input.jurisdiction as any,
                fuero: input.fuero as any,
                limit: 3,
                threshold: 0.6
            });
            relevantJurisprudence = searchResult.results || [];
        } catch (e) {
            this.logger.warn('Error retrieving jurisprudence', e);
        }

        // 3. Construct Prompt
        const systemPrompt = `
Eres un abogado experto en Derecho Argentino.
Tu tarea es redactar un borrador de escrito judicial profesional de tipo: ${input.draftType}.
Usa un tono formal, jurídico de la más alta calidad y estilo argentino.

DEBES GENERAR UNA RESPUESTA EN FORMATO JSON ESTRICTO CON LA SIGUIENTE ESTRUCTURA:
{
  "header": "Encabezado completo (Objeto, Destinatario, Personería)",
  "facts": "Relato de los hechos ordenado y persuasivo",
  "law": "Fundamentación jurídica citando leyes y jurisprudencia aplicable. Debes integrar las fuentes provistas.",
  "petition": "Petitorio claro y conciso final"
}

BASE LEGAL (RAG):
${relevantLaws.map(l => `- ${l.nombre} ${l.articulo}: ${l.textoCompleto}`).join('\n')}

JURISPRUDENCIA (RAG):
${relevantJurisprudence.map(j => `- ${j.caratula}: ${j.resumen}`).join('\n')}

IMPORTANTE:
- Si falta información crítica, usa marcadores como [COMPLETAR DATOS].
- Prioriza la claridad y la técnica jurídica.
- Usa los datos extra si son relevantes.
`.trim();

        const userPrompt = `
JURISDICCIÓN: ${input.jurisdiction}
FUERO: ${input.fuero}

HECHOS DEL CASO:
${input.facts}

DATOS EXTRA:
${JSON.stringify(input.dataContext || {})}

Genera el escrito ahora en formato JSON.
`.trim();

        // 4. Call LLM
        let resultJson;
        let rawContent = "";
        try {
            const result = await this.chatModel.call([
                new SystemMessage(systemPrompt),
                new HumanMessage(userPrompt)
            ]);
            rawContent = String(result.content);

            // Clean markdown code blocks if present
            const jsonStr = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
            resultJson = JSON.parse(jsonStr);
        } catch (e) {
            this.logger.error("Failed to parse LLM response or LLM error", e);
            // Fallback object
            resultJson = {
                header: "Hubo un error generando la estructura estructurada.",
                facts: input.facts,
                law: `Error de generación. Raw content: ${rawContent}`,
                petition: "Por favor reintente."
            };
        }

        const fullText = `${resultJson.header}\n\nI. HECHOS\n${resultJson.facts}\n\nII. DERECHO\n${resultJson.law}\n\nIII. PETITORIO\n${resultJson.petition}`;

        // 5. Save to DB
        // Ensure DraftType matches Prisma Enum
        let prismaDraftType = 'OTRO';
        if (['DEMANDA', 'CONTESTACION', 'RECURSO', 'MERO_TRAMITE'].includes(input.draftType)) {
            prismaDraftType = input.draftType;
        }

        const draft = await this.prisma.legalDraft.create({
            data: {
                userId: input.userId,
                expedienteId: input.expedienteId,
                draftType: prismaDraftType as any,
                jurisdiction: input.jurisdiction,
                fuero: input.fuero,
                facts: input.facts,
                dataContext: input.dataContext ?? {},

                header: resultJson.header,
                bodyFacts: resultJson.facts,
                bodyLaw: resultJson.law,
                petitorio: resultJson.petition,
                fullText: fullText,
            }
        });

        return draft;
    }

    async getDrafts(userId: string, expedienteId?: string) {
        return this.prisma.legalDraft.findMany({
            where: {
                userId,
                ...(expedienteId && { expedienteId }),
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getDraft(id: string) {
        return this.prisma.legalDraft.findUnique({
            where: { id }
        });
    }
}
