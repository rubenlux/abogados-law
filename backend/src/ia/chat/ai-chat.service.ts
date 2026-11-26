import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ChatContextService } from "./chat-context.service";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ScopedPrismaService } from "../../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../../authz/guards/active-org-context.guard";

const GENERAL_WORKSPACE_ID = "general-workspace-user";

@Injectable()
export class AIChatService {
  private readonly logger = new Logger(AIChatService.name);
  private chatModel: ChatOpenAI;

  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly contextService: ChatContextService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get("OPENAI_API_KEY");
    this.chatModel = new ChatOpenAI({
      openAIApiKey: apiKey || "mock-key",
      modelName: "gpt-4o",
      temperature: 0.1,
    });
  }

  private async assertExpedienteOwnership(
    expedienteId: string,
    ctx: ActiveOrgContext,
  ): Promise<void> {
    if (expedienteId === GENERAL_WORKSPACE_ID) {
      return;
    }
    const found = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: { id: true },
      }),
    );
    if (!found) {
      throw new NotFoundException("Expediente not found");
    }
  }

  /**
   * Procesa un mensaje de chat dentro del contexto organizacional activo.
   */
  async chat(expedienteId: string, message: string, ctx: ActiveOrgContext) {
    this.logger.log(
      `Chat request for Expediente ${expedienteId} in Org ${ctx.organizationId}`,
    );

    await this.assertExpedienteOwnership(expedienteId, ctx);

    const { session, recentMessages } = await this.scopedPrisma.runInOrgContext(
      ctx,
      async (tx) => {
        let existing = await tx.aIChatSession.findFirst({
          where: {
            expedienteId,
            userId: ctx.userId,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          existing = await tx.aIChatSession.create({
            data: {
              expedienteId,
              userId: ctx.userId,
              organizationId: ctx.organizationId,
              title: `Chat #${expedienteId.substring(0, 6)}...`,
            },
          });
        }

        await tx.aIChatMessage.create({
          data: {
            sessionId: existing.id,
            organizationId: ctx.organizationId,
            role: "user",
            content: message,
          },
        });

        const msgs = await tx.aIChatMessage.findMany({
          where: {
            sessionId: existing.id,
            organizationId: ctx.organizationId,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        msgs.reverse();

        return { session: existing, recentMessages: msgs };
      },
    );

    const historyText = recentMessages
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join("\n");

    const contextBlock = await this.contextService.buildContext(
      expedienteId,
      message,
      historyText,
      ctx,
    );

    const systemPrompt = `
Eres "Abogado IA", un asistente jurídico senior especializado en Derecho Argentino.
Actúas como copiloto del abogado usuario en el análisis del expediente actual.

DIRECTRICES DE SEGURIDAD Y VERACIDAD (Anti-Alucinación):
1. TU ÚNICA FUENTE DE VERDAD es el bloque "CONTEXTO DEL SISTEMA LEGAL" provisto abajo.
2. Si la respuesta no está en el contexto, DEBES decir: "No encuentro información suficiente en el expediente o bases legales actuales para responder esto con certeza."
3. NO inventes leyes, ni fallos, ni hechos del caso.

${contextBlock}
    `.trim();

    let responseContent = "";
    const openAiKey = this.configService.get<string>("OPENAI_API_KEY") || "";
    const isTestOffline =
      !openAiKey ||
      openAiKey.startsWith("sk-test-") ||
      this.configService.get<string>("NODE_ENV") === "test";
    try {
      if (isTestOffline) {
        responseContent =
          "[MODO SIMULACIÓN] La API Key no está configurada. Respuesta simulada basada en el contexto recuperado.";
      } else {
        const llmResult = await this.chatModel.call([
          new SystemMessage(systemPrompt),
          new HumanMessage(message),
        ]);
        responseContent = String(llmResult.content);
      }
    } catch (error) {
      this.logger.error("Error en OpenAI Chat", error);
      responseContent = "Error temporal conectando con el cerebro de IA Legal.";
    }

    const assistantMsg = await this.scopedPrisma.runInOrgContext(
      ctx,
      async (tx) => {
        const created = await tx.aIChatMessage.create({
          data: {
            sessionId: session.id,
            organizationId: ctx.organizationId,
            role: "assistant",
            content: responseContent,
            modelModel: "gpt-4o",
            isVerified: true,
          },
        });

        await tx.aIChatSession.updateMany({
          where: { id: session.id, organizationId: ctx.organizationId },
          data: { updatedAt: new Date() },
        });

        return created;
      },
    );

    return {
      sessionId: session.id,
      message: assistantMsg.content,
      messageId: assistantMsg.id,
      role: "assistant",
      createdAt: assistantMsg.createdAt,
    };
  }

  /**
   * Recupera el historial completo de la sesión dentro de la organización activa.
   */
  async getSessionHistory(expedienteId: string, ctx: ActiveOrgContext) {
    await this.assertExpedienteOwnership(expedienteId, ctx);

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const session = await tx.aIChatSession.findFirst({
        where: {
          expedienteId,
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        },
        include: {
          messages: {
            where: { organizationId: ctx.organizationId },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!session) return [];
      return session.messages;
    });
  }

  /**
   * Limpia la memoria del chat dentro de la organización activa.
   */
  async clearHistory(expedienteId: string, ctx: ActiveOrgContext) {
    await this.assertExpedienteOwnership(expedienteId, ctx);

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const session = await tx.aIChatSession.findFirst({
        where: {
          expedienteId,
          userId: ctx.userId,
          organizationId: ctx.organizationId,
        },
        select: { id: true },
      });

      if (session) {
        await tx.aIChatMessage.deleteMany({
          where: {
            sessionId: session.id,
            organizationId: ctx.organizationId,
          },
        });
        return { success: true, message: "Historial borrado." };
      }
      return { success: false, message: "No había historial." };
    });
  }
}
