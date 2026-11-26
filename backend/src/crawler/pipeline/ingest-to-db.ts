/**
 * Pipeline de ingesta: Toma los resultados del scraper CSJN y los ingesta en la BD
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { JurisprudenceIngestionService } from "../../ia/jurisprudence/jurisprudence-ingestion.service";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Iniciando pipeline de ingesta CSJN → BD...\n");

  // Crear contexto de NestJS
  const app = await NestFactory.createApplicationContext(AppModule);
  const ingestionService = app.get(JurisprudenceIngestionService);

  // Leer resultados del scraper
  const resultsPath = path.join(__dirname, "../../../csjn-results.json");

  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ No se encontró el archivo: ${resultsPath}`);
    console.log("💡 Ejecutá primero: npx ts-node src/crawler/run.ts");
    process.exit(1);
  }

  const scrapedCases = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  console.log(`📄 Casos encontrados en archivo: ${scrapedCases.length}\n`);

  // Transformar formato del scraper → formato de ingesta
  const casesToIngest = scrapedCases.map((scraped: any) => ({
    // Datos básicos
    tribunal: "CSJN",
    sala: null,
    nroExpediente:
      extractExpediente(scraped.title, scraped.summary) || `CSJN-${Date.now()}`,
    fecha: parseDate(scraped.date),

    // Clasificación
    jurisdiccion: "NACIONAL",
    fuero: "TODOS",
    tema: extractTemas(scraped.title), // Array de temas

    // Contenido
    resumen: scraped.summary,
    textoCompleto: scraped.summary, // Por ahora usamos el sumario

    // Metadatos
    precedencia: "VINCULANTE",
    vigencia: "VIGENTE",
    fuenteOficialUrl: scraped.url,

    // Source tracking
    sourceType: "SCRAPER_CSJN",
    sourceUrl: scraped.url,

    // Usuario
    ingestedBy: "scraper-system",
  }));

  console.log("📊 Iniciando ingesta masiva...\n");

  try {
    // Usar el endpoint de ingesta masiva
    const result = await ingestionService.ingestBatch(casesToIngest);

    console.log("\n✅ Ingesta completada:");
    console.log(`   - Exitosos: ${result.success}`);
    console.log(`   - Duplicados: ${result.duplicates}`);
    console.log(`   - Errores: ${result.errors}`);

    if (result.errors > 0) {
      console.log("\n⚠️ Detalles de errores:");
      result.details
        .filter((d: any) => d.status === "error")
        .forEach((err: any, i: number) => {
          console.log(`   ${i + 1}. ${err.case}: ${err.error}`);
        });
    }

    console.log("\n💾 Datos guardados en PostgreSQL con embeddings OpenAI");
    console.log(
      "🔍 Ahora podés buscarlos desde el frontend en /jurisprudence/search",
    );
  } catch (error: any) {
    console.error("\n❌ Error en ingesta:", error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

/**
 * Extrae temas del título (separados por " - ")
 */
function extractTemas(title: string): string[] {
  return title
    .split(" - ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Intenta extraer el número de expediente del título o sumario
 */
function extractExpediente(title: string, summary: string): string | null {
  const text = `${title} ${summary}`;

  // Buscar patrones comunes
  const patterns = [
    /(\d{4,}\/\d{2,4})/, // Formato: 12345/2024
    /Expte\.\s*N°?\s*(\d+\/\d+)/i,
    /c\/\s*([^s]+)\s*s\//i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1] || match[0];
  }

  return null;
}

/**
 * Parsea fecha DD/MM/YYYY → Date
 */
function parseDate(dateStr: string): Date {
  if (!dateStr || dateStr === "S/F") {
    return new Date(); // Fecha actual como fallback
  }

  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

main();
