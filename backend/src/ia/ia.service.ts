
import { Injectable, Logger } from '@nestjs/common';
import { DeadlineCalculationService } from './engine/deadline-calculator.service';
import { EmbeddingService } from './nlu/embedding.service';
import { PrismaService } from '../prisma.service';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IAService {
    private readonly logger = new Logger(IAService.name);
    private chatModel: ChatOpenAI;

    constructor(
        private readonly deadlineService: DeadlineCalculationService,
        private readonly embeddingService: EmbeddingService,
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.chatModel = new ChatOpenAI({
            openAIApiKey: apiKey || 'mock',
            modelName: 'gpt-4-turbo-preview', // High intelligence for legal
            temperature: 0.2
        });
    }

    // --- RAG & KNOWLEDGE BASE ---

    async ingestLegalNorm(data: { titulo: string, texto: string, jurisdiccion: string, fuero: string, tipo: string, articulo: string }) {
        this.logger.log(`Ingesting norm: ${data.titulo} ${data.articulo}`);

        // 1. Generate Embedding
        const contentToEmbed = `${data.titulo} ${data.articulo}: ${data.texto}`;
        const embedding = await this.embeddingService.getEmbedding(contentToEmbed);

        // 2. Save to DB
        // Using Prisma create for metadata + executeRaw for vector update to ensure compatibility
        const norm = await this.prisma.legalNorm.create({
            data: {
                jurisdiccion: data.jurisdiccion as any, // Enum
                fuero: data.fuero as any,             // Enum
                tipoNorma: data.tipo,
                nombre: data.titulo, // "Código Civil y Comercial"
                articulo: data.articulo,
                textoCompleto: data.texto,
                fechaVigencia: new Date(), // Mock default
                versionNorma: 1
            }
        });

        // 3. Update Vector (PostgreSQL pgvector syntax)
        // We need to format the simple array [0.1, 0.2, ...] to a vector string '[0.1,0.2,...]'
        const vectorString = JSON.stringify(embedding);

        await this.prisma.$executeRaw`
            UPDATE "LegalNorm"
            SET embedding = ${vectorString}::vector
            WHERE id = ${norm.id}
        `;

        return norm;
    }

    async searchLegalNorms(query: string, limit = 4) {
        const embedding = await this.embeddingService.getEmbedding(query);
        const vectorString = JSON.stringify(embedding);

        // Cosine distance (<=>)
        const results = await this.prisma.$queryRaw`
            SELECT id, nombre, articulo, "textoCompleto", 
            1 - (embedding <=> ${vectorString}::vector) as similarity
            FROM "LegalNorm"
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${vectorString}::vector ASC
            LIMIT ${limit};
        `;

        return results as any[];
    }

    async askLegalAssistant(query: string, contextId?: string) {
        // 1. Retrieve Context (RAG)
        const relevantDocs = await this.searchLegalNorms(query);

        const contextText = relevantDocs.map(d =>
            `FUENTE: ${d.nombre} (${d.articulo})\nCONTENIDO: ${d.textoCompleto}`
        ).join('\n\n');

        // 2. Build Prompt
        const systemPrompt = `Eres un asistente jurídico experto en derecho argentino. 
        Responde basándote estrictamente en el contexto legal proporcionado.
        Cita siempre la fuente (Artículo y Norma). 
        Si el contexto no tiene la respuesta, indícalo.
        
        CONTEXTO LEGAL:
        ${contextText}`;

        // 3. LLM Generation
        if (!this.configService.get('OPENAI_API_KEY')) {
            // Fallback for demo without key
            return {
                answer: "Modo Simulación (Sin API Key): Según el Art. 356 del CPCC (Contexto simulado), el plazo es de 15 días...",
                sources: relevantDocs.map(d => `${d.nombre} ${d.articulo}`)
            };
        }

        try {
            const response = await this.chatModel.call([
                new SystemMessage(systemPrompt),
                new HumanMessage(query)
            ]);

            return {
                answer: response.content,
                sources: relevantDocs.map(d => `${d.nombre} ${d.articulo}`)
            };
        } catch (e) {
            this.logger.error(e);
            return { answer: "Error consultando el modelo de IA.", error: e.message };
        }
    }

    // --- DOCUMENT ANALYSIS ---

    async analyzeDocument(fileContent: string) {
        // ... (Keep existing logic or enhance with LLM extraction)
        // For now, keep the deterministic/regex mock we had or improve it?
        // Let's keep it but maybe use the LLM if available for better extraction.

        // Quick Regex fallback
        return this.analyzeDocumentRegex(fileContent);
    }

    private async analyzeDocumentRegex(fileContent: string) {
        console.log("Analyzing text:", fileContent.substring(0, 50) + "...");
        const rules = this.deadlineService.guessDeadlineFromText(fileContent);
        const notificationDate = new Date(); // Mock

        const result = await this.deadlineService.calculateDeadline({
            fechaNotificacion: notificationDate,
            jurisdiction: 'NACION',
            processType: rules.processType || 'ORDINARIO',
            deadlineDays: rules.deadlineDays || 5,
            deadlineType: rules.deadlineType || 'DIAS_HABILES'
        });

        return {
            type: "CEDULA_NOTIFICACION",
            fecha_notificacion: notificationDate.toISOString().split('T')[0],
            plazo_detectado: `${rules.deadlineDays} ${rules.deadlineType}`,
            vencimiento_sugerido: result.deadlineDate.toISOString(),
            explicacion_legal: result.details
        };
    }
}
