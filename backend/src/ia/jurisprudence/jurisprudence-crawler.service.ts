import { Injectable, Logger } from "@nestjs/common";
import { chromium } from "playwright";
import { scrapeCSJN } from "../../crawler/sources/csjn";
import { scrapeFormosa } from "../../crawler/sources/formosa";
import { JurisprudenceIngestionService } from "./jurisprudence-ingestion.service";

@Injectable()
export class JurisprudenceCrawlerService {
  private readonly logger = new Logger(JurisprudenceCrawlerService.name);

  constructor(
    private readonly ingestionService: JurisprudenceIngestionService,
  ) {}

  async importFromSource(query: string, source: "CSJN" | "FORMOSA" = "CSJN") {
    this.logger.log(`Starting real-time import from ${source} for: ${query}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 1. Scrape
      let scrapedCases: any[] = [];
      if (source === "FORMOSA") {
        scrapedCases = await scrapeFormosa(page, query);
      } else {
        scrapedCases = await scrapeCSJN(page, query);
      }

      this.logger.log(`Scraped ${scrapedCases.length} cases from ${source}`);

      if (scrapedCases.length === 0) {
        return { success: 0, total: 0, status: "no_results" };
      }

      // 2. Transform to Ingestion DTO
      const casesToIngest = scrapedCases.map((scraped: any) => ({
        tribunal: this.mapTribunal(scraped.tribunal, source),
        sala: scraped.tribunal, // Move the verbatim name to sala to avoid losing it
        nroExpediente:
          this.extractExpediente(scraped.title, scraped.summary) ||
          `${source}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fecha: this.parseDate(scraped.date),
        jurisdiccion: source === "FORMOSA" ? "FORMOSA" : "NACION",
        fuero: "CIVIL", // Valor por defecto
        tema: scraped.title.split(" - ").map((t) => t.trim()),
        resumen: scraped.summary,
        textoCompleto: scraped.fullText || scraped.summary,
        precedencia: "REFERENCIAL",
        vigencia: "VIGENTE",
        fuenteOficialUrl: scraped.url,
        caratula: scraped.partes || scraped.title,
        sourceType: "LIVE_SCRAPER",
      }));

      // 3. Batch Ingest
      const result = await this.ingestionService.ingestBatch(casesToIngest);

      return {
        ...result,
        status: "completed",
        totalFound: scrapedCases.length,
      };
    } catch (error) {
      this.logger.error(`Error during ${source} import: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async importFromCSJN(query: string) {
    return this.importFromSource(query, "CSJN");
  }

  private mapTribunal(tribunal: string, source: string): string {
    const t = (tribunal || "").toUpperCase();
    if (source === "CSJN") return "CSJN";

    if (t.includes("CAMARA") || t.includes("EXCMA")) return "CAMARA_PROVINCIAL";
    if (t.includes("SUPERIOR") || t.includes("STJ")) return "TRIBUNAL_SUPERIOR";
    if (t.includes("JUZGADO")) return "JUZGADO_PROVINCIAL";

    return "JUZGADO_PROVINCIAL"; // Fallback for Formosa
  }

  private extractExpediente(title: string, summary: string): string | null {
    const text = `${title} ${summary}`;
    const patterns = [/(\d{4,}\/\d{2,4})/, /Expte\.\s*N°?\s*(\d+\/\d+)/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1] || match[0];
    }
    return null;
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr || dateStr === "S/F") return new Date();
    const [day, month, year] = dateStr.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
}
