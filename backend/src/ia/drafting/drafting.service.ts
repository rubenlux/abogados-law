import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { LegalSearchService } from "../legal/legal-search.service";
import { JurisprudenceSearchService } from "../jurisprudence/jurisprudence-search.service";
import { ScopedPrismaService } from "../../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../../authz/guards/active-org-context.guard";

export interface DraftInputDto {
  expedienteId?: string;
  draftType: "DEMANDA" | "CONTESTACION" | "RECURSO" | "MERO_TRAMITE" | "OTRO";
  jurisdiction: string;
  fuero: string;
  facts: string;
  dataContext?: any;
}

@Injectable()
export class DraftingService {
  private readonly logger = new Logger(DraftingService.name);
  private chatModel: ChatOpenAI;

  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly configService: ConfigService,
    private readonly legalSearchService: LegalSearchService,
    private readonly jurisprudenceSearchService: JurisprudenceSearchService,
  ) {
    const apiKey = this.configService.get("OPENAI_API_KEY");
    this.chatModel = new ChatOpenAI({
      openAIApiKey: apiKey || "mock-key",
      modelName: "gpt-4o",
      temperature: 0.2,
    });
  }

  async generateDraft(input: DraftInputDto, ctx: ActiveOrgContext) {
    this.logger.log(
      `Generating draft ${input.draftType} for User ${ctx.userId} in Org ${ctx.organizationId}`,
    );

    if (input.expedienteId) {
      const exp = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
        tx.expediente.findFirst({
          where: { id: input.expedienteId, organizationId: ctx.organizationId },
          select: { id: true },
        }),
      );
      if (!exp) {
        throw new NotFoundException("Expediente not found");
      }
    }

    let relevantLaws: any[] = [];
    try {
      relevantLaws = await this.legalSearchService.search({
        query: input.facts,
        jurisdiccion: input.jurisdiction,
        fuero: input.fuero,
        limit: 5,
        threshold: 0.6,
      });
    } catch (e) {
      this.logger.warn("Error retrieving laws", e);
    }

    let relevantJurisprudence: any[] = [];
    try {
      const searchResult: any = await this.jurisprudenceSearchService.search({
        query: input.facts,
        jurisdiccion: input.jurisdiction as any,
        fuero: input.fuero as any,
        limit: 3,
        threshold: 0.6,
      });
      relevantJurisprudence = searchResult.results || [];
    } catch (e) {
      this.logger.warn("Error retrieving jurisprudence", e);
    }

    let resultJson: {
      header: string;
      facts: string;
      law: string;
      petition: string;
    };

    const openAiKey = this.configService.get<string>("OPENAI_API_KEY") || "";
    const isTestOffline =
      !openAiKey ||
      openAiKey.startsWith("sk-test-") ||
      this.configService.get<string>("NODE_ENV") === "test";

    if (isTestOffline) {
      resultJson = {
        header: `[BORRADOR ${input.draftType}] ${input.jurisdiction} - ${input.fuero}`,
        facts: input.facts,
        law: "Fundamentación generada en modo simulación sin API Key.",
        petition: "Téngase presente.",
      };
    } else {
      const systemPrompt = `
Eres un abogado experto en Derecho Argentino.
Redacta un borrador de escrito judicial tipo: ${input.draftType}.
BASE LEGAL: ${relevantLaws.map((l) => `${l.nombre} ${l.articulo}`).join(", ")}
JURISPRUDENCIA: ${relevantJurisprudence.map((j) => j.caratula).join(", ")}
Responde JSON: { "header": "...", "facts": "...", "law": "...", "petition": "..." }
      `.trim();

      const userPrompt = `JURISDICCIÓN: ${input.jurisdiction}\nFUERO: ${input.fuero}\nHECHOS:\n${input.facts}`;
      let rawContent = "";
      try {
        const result = await this.chatModel.call([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ]);
        rawContent = String(result.content);
        const jsonStr = rawContent
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        resultJson = JSON.parse(jsonStr);
      } catch (e) {
        this.logger.error("Failed to parse LLM response or LLM error", e);
        resultJson = {
          header: "Hubo un error generando la estructura.",
          facts: input.facts,
          law: `Error de generación. Raw content: ${rawContent}`,
          petition: "Por favor reintente.",
        };
      }
    }

    const fullText = `${resultJson.header}\n\nI. HECHOS\n${resultJson.facts}\n\nII. DERECHO\n${resultJson.law}\n\nIII. PETITORIO\n${resultJson.petition}`;

    let prismaDraftType = "OTRO";
    if (
      ["DEMANDA", "CONTESTACION", "RECURSO", "MERO_TRAMITE"].includes(
        input.draftType,
      )
    ) {
      prismaDraftType = input.draftType;
    }

    return this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalDraft.create({
        data: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          expedienteId: input.expedienteId ?? null,
          draftType: prismaDraftType as any,
          jurisdiction: input.jurisdiction,
          fuero: input.fuero,
          facts: input.facts,
          dataContext: input.dataContext ?? {},
          header: resultJson.header,
          bodyFacts: resultJson.facts,
          bodyLaw: resultJson.law,
          petitorio: resultJson.petition,
          fullText,
        },
      }),
    );
  }

  async getDrafts(ctx: ActiveOrgContext, expedienteId?: string) {
    return this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalDraft.findMany({
        where: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          ...(expedienteId ? { expedienteId } : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async getDraft(id: string, ctx: ActiveOrgContext) {
    const draft = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalDraft.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
        },
      }),
    );

    if (!draft) {
      throw new NotFoundException("Draft not found");
    }
    return draft;
  }
}
