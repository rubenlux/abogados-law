import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const LEGAL_AI_PROVIDER = "LEGAL_AI_PROVIDER";

export interface LegalAiProviderStatus {
  available: boolean;
  provider: string;
  model: string;
  reason?: string;
}

export interface LegalAiGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  correlationId: string;
  mode:
    | "GENERATE"
    | "REGENERATE"
    | "IMPROVE"
    | "EXPAND"
    | "SUMMARIZE"
    | "FIX_STRUCTURE"
    | "MISSING_INFO";
}

export interface LegalAiGenerationResponse {
  title?: string;
  content?: Record<string, unknown>;
  missingData: string[];
  warnings: string[];
  citationsUsed: string[];
  model: string;
  provider: string;
}

export interface LegalAiChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LegalAiChatRequest {
  messages: LegalAiChatMessageInput[];
  correlationId: string;
}

export interface LegalAiChatResponse {
  answer: string;
  usedGeneralKnowledge: boolean;
  missingData: string[];
  warnings: string[];
  citedSourceIds: string[];
  model: string;
  provider: string;
}

export interface LegalAiAnalysisProviderRequest {
  analysisType: string;
  systemPrompt: string;
  userPrompt: string;
  correlationId: string;
}

export interface LegalAiAnalysisProviderResponse {
  title?: string;
  executiveSummary: string;
  analysisDevelopment: string;
  relevantFacts: string[];
  allegedFacts: string[];
  documentedFacts: string[];
  disputedIssues: string[];
  contradictions: string[];
  proceduralRisks: string[];
  explicitDeadlines: string[];
  documentaryFindings: string[];
  missingInformation: string[];
  limitations: string[];
  usedGeneralKnowledge: boolean;
  citedSourceIds: string[];
  model: string;
  provider: string;
}

export interface ILegalAiProvider {
  getStatus(): LegalAiProviderStatus;
  generate(req: LegalAiGenerationRequest): Promise<LegalAiGenerationResponse>;
  chat?(req: LegalAiChatRequest): Promise<LegalAiChatResponse>;
  analyze?(
    req: LegalAiAnalysisProviderRequest,
  ): Promise<LegalAiAnalysisProviderResponse>;
}

const PLACEHOLDER_KEYS = new Set([
  "",
  "mock",
  "mock-key",
  "your-openai-api-key-here",
  "changeme",
]);

@Injectable()
export class OpenAiLegalDraftingProvider implements ILegalAiProvider {
  private readonly logger = new Logger(OpenAiLegalDraftingProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = (
      this.configService.get<string>("OPENAI_API_KEY") || ""
    ).trim();
    this.model =
      this.configService.get<string>("LEGAL_AI_MODEL")?.trim() || "gpt-4o-mini";
    const configuredTimeout = Number(
      this.configService.get<string>("LEGAL_AI_TIMEOUT_MS") || 45000,
    );
    this.timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
        ? configuredTimeout
        : 45000;
  }

  getStatus(): LegalAiProviderStatus {
    const lower = this.apiKey.toLowerCase();
    const available = this.apiKey.length >= 16 && !PLACEHOLDER_KEYS.has(lower);

    return {
      available,
      provider: "openai",
      model: this.model,
      ...(available
        ? {}
        : {
            reason:
              "La generación asistida por IA no está disponible porque OPENAI_API_KEY no está configurada en el backend. Puede continuar redactando manualmente con el editor jurídico.",
          }),
    };
  }

  async generate(
    req: LegalAiGenerationRequest,
  ): Promise<LegalAiGenerationResponse> {
    const status = this.getStatus();
    if (!status.available) {
      throw new ServiceUnavailableException(
        status.reason || "Proveedor de IA no configurado",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Llamada exclusivamente backend-to-provider con JSON estricto, sin entrenamiento activado
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: req.systemPrompt },
              { role: "user", content: req.userPrompt },
            ],
          }),
        },
      );

      if (!response.ok) {
        // Nunca loguear API key ni cuerpo jurídico sensible
        this.logger.error(
          `AI provider HTTP error status=${response.status} correlationId=${req.correlationId} mode=${req.mode}`,
        );
        throw new BadGatewayException(
          `Error del proveedor de IA (HTTP ${response.status}). Puede reintentar o utilizar el editor manual.`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = payload?.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== "string") {
        throw new BadGatewayException(
          "El proveedor de IA devolvió una respuesta vacía o malformada",
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawContent) as Record<string, unknown>;
      } catch {
        this.logger.error(
          `AI provider invalid JSON response correlationId=${req.correlationId} mode=${req.mode}`,
        );
        throw new BadGatewayException(
          "El proveedor de IA devolvió JSON inválido",
        );
      }

      return {
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        content:
          parsed.content && typeof parsed.content === "object"
            ? (parsed.content as Record<string, unknown>)
            : undefined,
        missingData: Array.isArray(parsed.missingData)
          ? parsed.missingData.map((x) => String(x)).slice(0, 50)
          : [],
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings.map((x) => String(x)).slice(0, 50)
          : [],
        citationsUsed: Array.isArray(parsed.citationsUsed)
          ? parsed.citationsUsed.map((x) => String(x)).slice(0, 50)
          : [],
        model: this.model,
        provider: "openai",
      };
    } catch (err: unknown) {
      if (
        err instanceof ServiceUnavailableException ||
        err instanceof BadGatewayException ||
        err instanceof GatewayTimeoutException
      ) {
        throw err;
      }
      if (
        err instanceof Error &&
        (err.name === "AbortError" ||
          err.message.toLowerCase().includes("abort"))
      ) {
        this.logger.error(
          `AI provider timeout after ${this.timeoutMs}ms correlationId=${req.correlationId} mode=${req.mode}`,
        );
        throw new GatewayTimeoutException(
          "La generación por IA excedió el tiempo máximo de espera. Reintente o utilice el editor manual.",
        );
      }
      this.logger.error(
        `AI provider network failure correlationId=${req.correlationId} mode=${req.mode}`,
      );
      throw new BadGatewayException(
        "No se pudo conectar con el proveedor de IA. Puede continuar usando el editor manual.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Conversación contextual estructurada (AUTH-10) reutilizando exactamente el mismo
   * cliente, credenciales, modelo, timeout y política de privacidad que AUTH-09.
   */
  async chat(req: LegalAiChatRequest): Promise<LegalAiChatResponse> {
    const status = this.getStatus();
    if (!status.available) {
      throw new ServiceUnavailableException(
        status.reason || "Proveedor de IA no configurado",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: req.messages,
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `AI chat HTTP error status=${response.status} correlationId=${req.correlationId}`,
        );
        throw new BadGatewayException(
          `Error del proveedor de IA (HTTP ${response.status}). Puede reintentar más tarde.`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = payload?.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== "string" || !rawContent.trim()) {
        throw new BadGatewayException(
          "El proveedor de IA devolvió una respuesta vacía",
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawContent) as Record<string, unknown>;
      } catch {
        this.logger.error(
          `AI chat invalid JSON response correlationId=${req.correlationId}`,
        );
        throw new BadGatewayException(
          "El proveedor de IA devolvió un formato de respuesta inválido",
        );
      }

      const answer =
        typeof parsed.answer === "string" ? parsed.answer.trim() : "";
      if (!answer) {
        throw new BadGatewayException(
          "La respuesta del asistente IA no contiene texto válido",
        );
      }

      return {
        answer,
        usedGeneralKnowledge: Boolean(parsed.usedGeneralKnowledge),
        missingData: Array.isArray(parsed.missingData)
          ? parsed.missingData.map((x) => String(x)).slice(0, 30)
          : [],
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings.map((x) => String(x)).slice(0, 30)
          : [],
        citedSourceIds: Array.isArray(parsed.citedSourceIds)
          ? parsed.citedSourceIds.map((x) => String(x)).slice(0, 50)
          : [],
        model: this.model,
        provider: "openai",
      };
    } catch (err: unknown) {
      if (
        err instanceof ServiceUnavailableException ||
        err instanceof BadGatewayException ||
        err instanceof GatewayTimeoutException
      ) {
        throw err;
      }
      if (
        err instanceof Error &&
        (err.name === "AbortError" ||
          err.message.toLowerCase().includes("abort"))
      ) {
        this.logger.error(
          `AI chat timeout after ${this.timeoutMs}ms correlationId=${req.correlationId}`,
        );
        throw new GatewayTimeoutException(
          "El asistente IA excedió el tiempo máximo de respuesta. Su conversación se conserva intacta y puede reintentar.",
        );
      }
      this.logger.error(
        `AI chat network failure correlationId=${req.correlationId}`,
      );
      throw new BadGatewayException(
        "No se pudo conectar con el proveedor de IA. Su conversación fue preservada.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Análisis jurídico estructurado (AUTH-11) reutilizando el mismo cliente OpenAI,
   * configuración, timeout y política de privacidad que AUTH-09 y AUTH-10.
   */
  async analyze(
    req: LegalAiAnalysisProviderRequest,
  ): Promise<LegalAiAnalysisProviderResponse> {
    const status = this.getStatus();
    if (!status.available) {
      throw new ServiceUnavailableException(
        status.reason || "Proveedor de IA no configurado",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.15,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: req.systemPrompt },
              { role: "user", content: req.userPrompt },
            ],
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `AI analysis HTTP error status=${response.status} correlationId=${req.correlationId} type=${req.analysisType}`,
        );
        throw new BadGatewayException(
          `Error del proveedor de IA (HTTP ${response.status}). Puede reintentar más tarde.`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = payload?.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== "string" || !rawContent.trim()) {
        throw new BadGatewayException(
          "El proveedor de IA devolvió una respuesta vacía",
        );
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawContent) as Record<string, unknown>;
      } catch {
        this.logger.error(
          `AI analysis invalid JSON response correlationId=${req.correlationId} type=${req.analysisType}`,
        );
        throw new BadGatewayException(
          "El proveedor de IA devolvió un formato de respuesta inválido",
        );
      }

      const toStringList = (val: unknown, max = 40): string[] =>
        Array.isArray(val)
          ? val
              .map((item) => String(item).trim())
              .filter(Boolean)
              .slice(0, max)
          : [];

      const executiveSummary =
        typeof parsed.executiveSummary === "string"
          ? parsed.executiveSummary.trim()
          : "";
      const analysisDevelopment =
        typeof parsed.analysisDevelopment === "string"
          ? parsed.analysisDevelopment.trim()
          : "";

      if (!executiveSummary || !analysisDevelopment) {
        throw new BadGatewayException(
          "El informe devuelto por IA está incompleto o vacío",
        );
      }

      return {
        title:
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title.trim()
            : undefined,
        executiveSummary,
        analysisDevelopment,
        relevantFacts: toStringList(parsed.relevantFacts),
        allegedFacts: toStringList(parsed.allegedFacts),
        documentedFacts: toStringList(parsed.documentedFacts),
        disputedIssues: toStringList(parsed.disputedIssues),
        contradictions: toStringList(parsed.contradictions),
        proceduralRisks: toStringList(parsed.proceduralRisks),
        explicitDeadlines: toStringList(parsed.explicitDeadlines),
        documentaryFindings: toStringList(parsed.documentaryFindings),
        missingInformation: toStringList(parsed.missingInformation),
        limitations: toStringList(parsed.limitations),
        usedGeneralKnowledge: Boolean(parsed.usedGeneralKnowledge),
        citedSourceIds: toStringList(parsed.citedSourceIds, 60),
        model: this.model,
        provider: "openai",
      };
    } catch (err: unknown) {
      if (
        err instanceof ServiceUnavailableException ||
        err instanceof BadGatewayException ||
        err instanceof GatewayTimeoutException
      ) {
        throw err;
      }
      if (
        err instanceof Error &&
        (err.name === "AbortError" ||
          err.message.toLowerCase().includes("abort"))
      ) {
        this.logger.error(
          `AI analysis timeout after ${this.timeoutMs}ms correlationId=${req.correlationId} type=${req.analysisType}`,
        );
        throw new GatewayTimeoutException(
          "El análisis IA excedió el tiempo máximo de respuesta. Su selección se conserva y puede reintentar.",
        );
      }
      this.logger.error(
        `AI analysis network failure correlationId=${req.correlationId} type=${req.analysisType}`,
      );
      throw new BadGatewayException(
        "No se pudo conectar con el proveedor de IA. Puede reintentar posteriormente.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
