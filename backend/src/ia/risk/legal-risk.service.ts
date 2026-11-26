import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { JurisprudenceSearchService } from "../jurisprudence/jurisprudence-search.service";
import { LegalSearchService } from "../legal/legal-search.service";
import { ScopedPrismaService } from "../../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../../authz/guards/active-org-context.guard";

@Injectable()
export class LegalRiskService {
  private readonly logger = new Logger(LegalRiskService.name);
  private chatModel: ChatOpenAI;

  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly configService: ConfigService,
    private readonly jurisprudenceSearch: JurisprudenceSearchService,
    private readonly legalSearch: LegalSearchService,
  ) {
    const apiKey = this.configService.get("OPENAI_API_KEY");
    this.chatModel = new ChatOpenAI({
      openAIApiKey: apiKey || "mock-key",
      modelName: "gpt-4o",
      temperature: 0.1,
    });
  }

  async analyzeRisk(expedienteId: string, ctx: ActiveOrgContext) {
    this.logger.log(
      `Analyzing risk for Expediente ${expedienteId} in Org ${ctx.organizationId}`,
    );

    const expediente = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: {
          id: true,
          caratula: true,
          tags: true,
          jurisdiccion: true,
          juzgado: true,
          estado: true,
        },
      }),
    );

    if (!expediente) {
      throw new NotFoundException("Expediente not found");
    }

    const queryText = `${expediente.caratula} ${(expediente.tags || []).join(" ")}`;
    const searchResult: any = await this.jurisprudenceSearch.search({
      query: queryText,
      jurisdiccion: expediente.jurisdiccion,
      limit: 5,
      threshold: 0.65,
    });
    const precedentes = searchResult?.results || [];

    const leyes = await this.legalSearch.search({
      query: queryText,
      jurisdiccion: expediente.jurisdiccion as any,
      limit: 3,
    });

    let resultJson: any;
    const openAiKey = this.configService.get<string>("OPENAI_API_KEY") || "";
    const isTestOffline =
      !openAiKey ||
      openAiKey.startsWith("sk-test-") ||
      this.configService.get<string>("NODE_ENV") === "test";

    if (isTestOffline) {
      resultJson = {
        score: 45,
        level: "MEDIO",
        jurisprudenceScore: 40,
        normativeScore: 45,
        complexityScore: 50,
        factors: { simulated: true },
        explanation:
          "[MODO SIMULACIÓN] Análisis de riesgo ejecutado en modo offline sin API Key.",
      };
    } else {
      const systemPrompt = `
Eres un Auditor Legal Senior especializado en Análisis de Riesgo de Litigios en Argentina.
Jurisdicción: ${expediente.jurisdiccion}.
Precedentes: ${precedentes.length}. Normas: ${leyes.length}.
Genera JSON estricto: { "score": 0-100, "level": "BAJO"|"MEDIO"|"ALTO"|"CRITICO", "jurisprudenceScore": 0-100, "normativeScore": 0-100, "complexityScore": 0-100, "factors": {}, "explanation": "..." }
      `.trim();

      const userPrompt = `Carátula: ${expediente.caratula}\nJuzgado: ${expediente.juzgado}\nEstado: ${expediente.estado}`;
      try {
        const result = await this.chatModel.call([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ]);
        const content = String(result.content)
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        resultJson = JSON.parse(content);
      } catch (error) {
        this.logger.error("Error en inferencia de riesgo", error);
        resultJson = {
          score: 50,
          level: "MEDIO",
          jurisprudenceScore: 50,
          normativeScore: 50,
          complexityScore: 50,
          factors: {},
          explanation:
            "No se pudo calcular el riesgo detallado por error en el servicio de IA.",
        };
      }
    }

    return this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalRiskAnalysis.create({
        data: {
          expedienteId: expediente.id,
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          score: resultJson.score,
          riskLevel: resultJson.level,
          jurisprudenceScore: resultJson.jurisprudenceScore,
          normativeScore: resultJson.normativeScore,
          complexityScore: resultJson.complexityScore,
          factors: resultJson.factors,
          explanation: resultJson.explanation,
        },
      }),
    );
  }

  async getHistory(expedienteId: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: { id: true },
      });

      if (!expediente) {
        throw new NotFoundException("Expediente not found");
      }

      return tx.legalRiskAnalysis.findMany({
        where: {
          expedienteId: expediente.id,
          organizationId: ctx.organizationId,
        },
        orderBy: { analyzedAt: "desc" },
      });
    });
  }
}
