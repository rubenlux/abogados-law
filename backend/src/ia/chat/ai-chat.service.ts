
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ChatContextService } from './chat-context.service';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

@Injectable()
export class AIChatService {
    private readonly logger = new Logger(AIChatService.name);
    private chatModel: ChatOpenAI;

    constructor(
        private prisma: PrismaService,
        private contextService: ChatContextService,
        private configService: ConfigService
    ) {
        const apiKey = this.configService.get('OPENAI_API_KEY');
        this.chatModel = new ChatOpenAI({
            openAIApiKey: apiKey || 'mock-key',
            modelName: 'gpt-4o', // Recomendado para razonamiento complejo
            temperature: 0.1, // Muy bajo para reducir alucinaciones
        });
    }

    /**
     * Procesa un mensaje de chat dentro del contexto de un expediente
     */
    async chat(expedienteId: string, userId: string, message: string) {
        this.logger.log(`Chat request for Expediente ${expedienteId} by User ${userId}`);

        // 1. Obtener o crear sesión persistente
        let session = await this.prisma.aIChatSession.findFirst({
            where: { expedienteId, userId }
        });

        if (!session) {
            session = await this.prisma.aIChatSession.create({
                data: {
                    expedienteId,
                    userId,
                    title: `Chat #${expedienteId.substring(0, 6)}...`,
                }
            });
        }

        // 2. Persistir mensaje del usuario
        await this.prisma.aIChatMessage.create({
            data: {
                sessionId: session.id,
                role: 'user',
                content: message,
            }
        });

        // 3. Recuperar historial reciente para contexto (Short-term memory)
        const recentMessages = await this.prisma.aIChatMessage.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: 'desc' },
            take: 10 // Últimos 5 intercambios
        });
        // Ordenar cronológicamente para el prompt
        recentMessages.reverse();

        // Formatear historial para el contexto
        const historyText = recentMessages
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n');

        // 4. Construir Contexto RAG (Expediente + Leyes + Jurisprudencia + Historial)
        const contextBlock = await this.contextService.buildContext(expedienteId, message, historyText);

        // 5. System Prompt (Ingeniería de Prompt para evitar alucinaciones)
        const systemPrompt = `
Eres "Abogado IA", un asistente jurídico senior especializado en Derecho Argentino.
Actúas como copiloto del abogado usuario en el análisis del expediente actual.

DIRECTRICES DE SEGURIDAD Y VERACIDAD (Anti-Alucinación):
1. TU ÚNICA FUENTE DE VERDAD es el bloque "CONTEXTO DEL SISTEMA LEGAL" provisto abajo.
2. Si la respuesta no está en el contexto, DEBES decir: "No encuentro información suficiente en el expediente o bases legales actuales para responder esto con certeza."
3. NO inventes leyes, ni fallos, ni hechos del caso.
4. CITA SIEMPRE las fuentes (ejs: "Según el Art X de la Ley Y...", "Conforme al fallo Z...").
5. Presta especial atención al [Score] de la jurisprudencia sugerida. Prioriza citar fallos con Score alto (>70) ya que son más relevantes o autoritativos.

FORMATO DE RESPUESTA:
- Profesional, directo y jurídico.
- Usa listas markdown para enumerar puntos.
- Si sugieres una estrategia, justifícala con el contexto.

${contextBlock}
        `.trim();

        // 6. Ejecutar inferencia
        let responseContent = "";
        try {
            if (!this.configService.get('OPENAI_API_KEY')) {
                responseContent = "[MODO SIMULACIÓN] La API Key no está configurada. Respuesta simulada basada en el contexto recuperado.";
            } else {
                const llmResult = await this.chatModel.call([
                    new SystemMessage(systemPrompt),
                    new HumanMessage(message)
                ]);
                responseContent = String(llmResult.content);
            }
        } catch (error) {
            this.logger.error("Error en OpenAI Chat", error);
            responseContent = "Error temporal conectando con el cerebro de IA Legal.";
        }

        // 7. Persistir respuesta del asistente
        const assistantMsg = await this.prisma.aIChatMessage.create({
            data: {
                sessionId: session.id,
                role: 'assistant',
                content: responseContent,
                modelModel: 'gpt-4o',
                isVerified: true
            }
        });

        // 8. Actualizar 'last activity' de la sesión
        await this.prisma.aIChatSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date() }
        });

        return {
            sessionId: session.id,
            message: assistantMsg.content,
            messageId: assistantMsg.id,
            role: 'assistant',
            createdAt: assistantMsg.createdAt
        };
    }

    /**
     * Recupera el historial completo de la sesión
     */
    async getSessionHistory(expedienteId: string, userId: string) {
        const session = await this.prisma.aIChatSession.findFirst({
            where: { expedienteId, userId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!session) return [];
        return session.messages;
    }

    /**
     * Limpia la memoria del chat (inicia nueva sesión lógica)
     */
    async clearHistory(expedienteId: string, userId: string) {
        const session = await this.prisma.aIChatSession.findFirst({
            where: { expedienteId, userId }
        });

        if (session) {
            await this.prisma.aIChatMessage.deleteMany({
                where: { sessionId: session.id }
            });
            return { success: true, message: "Historial borrado." };
        }
        return { success: false, message: "No había historial." };
    }
}
