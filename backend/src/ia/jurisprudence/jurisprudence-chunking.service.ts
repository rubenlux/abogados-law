import { Injectable, Logger } from "@nestjs/common";

/**
 * Servicio para chunking inteligente de fallos judiciales
 * Divide el texto en considerandos, doctrina y resolutivos
 */
@Injectable()
export class JurisprudenceChunkingService {
  private readonly logger = new Logger(JurisprudenceChunkingService.name);

  /**
   * Divide un fallo en chunks semánticos
   */
  chunkJurisprudence(textoCompleto: string): JurisprudenceChunkData[] {
    const chunks: JurisprudenceChunkData[] = [];

    // 1. Extraer considerandos
    const considerandos = this.extractConsiderandos(textoCompleto);
    considerandos.forEach((texto, index) => {
      chunks.push({
        chunkType: "CONSIDERANDO",
        chunkNumber: index + 1,
        texto,
      });
    });

    // 2. Extraer secciones de doctrina
    const doctrina = this.extractDoctrina(textoCompleto);
    doctrina.forEach((texto, index) => {
      chunks.push({
        chunkType: "DOCTRINA",
        chunkNumber: index + 1,
        texto,
      });
    });

    // 3. Extraer resolutivos
    const resolutivos = this.extractResolutivos(textoCompleto);
    resolutivos.forEach((texto, index) => {
      chunks.push({
        chunkType: "RESOLUTIVO",
        chunkNumber: index + 1,
        texto,
      });
    });

    this.logger.debug(`Extracted ${chunks.length} chunks from jurisprudence`);
    return chunks;
  }

  /**
   * Extrae considerandos del fallo
   * Busca patrones como "CONSIDERANDO:", "I.-", "1.-", etc.
   */
  private extractConsiderandos(texto: string): string[] {
    const considerandos: string[] = [];

    // Patrón 1: "CONSIDERANDO:" seguido de texto
    const pattern1 =
      /CONSIDERANDO:\s*(.+?)(?=CONSIDERANDO:|RESUELVE:|FALLA:|$)/gi;
    let match;
    while ((match = pattern1.exec(texto)) !== null) {
      if (match[1] && match[1].trim().length > 50) {
        considerandos.push(match[1].trim());
      }
    }

    // Patrón 2: Numeración romana "I.-", "II.-", etc.
    if (considerandos.length === 0) {
      const pattern2 = /([IVX]+)\.-\s*(.+?)(?=[IVX]+\.-|RESUELVE:|FALLA:|$)/gi;
      while ((match = pattern2.exec(texto)) !== null) {
        if (match[2] && match[2].trim().length > 50) {
          considerandos.push(`${match[1]}.- ${match[2].trim()}`);
        }
      }
    }

    // Patrón 3: Numeración arábiga "1.-", "2.-", etc.
    if (considerandos.length === 0) {
      const pattern3 = /(\d+)\.-\s*(.+?)(?=\d+\.-|RESUELVE:|FALLA:|$)/gi;
      while ((match = pattern3.exec(texto)) !== null) {
        if (match[2] && match[2].trim().length > 50) {
          considerandos.push(`${match[1]}.- ${match[2].trim()}`);
        }
      }
    }

    // Si no se encontraron considerandos estructurados, dividir por párrafos largos
    if (considerandos.length === 0) {
      const paragraphs = texto.split(/\n\n+/);
      for (const para of paragraphs) {
        if (para.trim().length > 100) {
          considerandos.push(para.trim());
        }
      }
    }

    return considerandos;
  }

  /**
   * Extrae secciones de doctrina (citas de jurisprudencia, doctrina legal)
   */
  private extractDoctrina(texto: string): string[] {
    const doctrina: string[] = [];

    // Buscar citas de jurisprudencia: "Fallos: XXX:YYY" o "CSJN, ..."
    const citaPattern =
      /((?:Fallos|CSJN|Corte Suprema|esta Corte).{20,500}?\.)/gi;
    let match;
    while ((match = citaPattern.exec(texto)) !== null) {
      if (match[1] && match[1].trim().length > 50) {
        doctrina.push(match[1].trim());
      }
    }

    return doctrina;
  }

  /**
   * Extrae la parte resolutiva del fallo
   */
  private extractResolutivos(texto: string): string[] {
    const resolutivos: string[] = [];

    // Buscar sección resolutiva
    const patterns = [
      /(?:RESUELVE|FALLA|SE RESUELVE):\s*(.+?)$/gi,
      /(?:POR ELLO|Por lo expuesto).*?(?:RESUELVE|FALLA):\s*(.+?)$/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(texto)) !== null) {
        if (match[1] && match[1].trim().length > 20) {
          resolutivos.push(match[1].trim());
          break; // Solo tomar el primer resolutivo encontrado
        }
      }
      if (resolutivos.length > 0) break;
    }

    return resolutivos;
  }

  /**
   * Extrae keywords de un chunk
   */
  extractKeywords(texto: string): string[] {
    // Palabras comunes a ignorar
    const stopWords = new Set([
      "el",
      "la",
      "de",
      "que",
      "y",
      "a",
      "en",
      "un",
      "ser",
      "se",
      "no",
      "por",
      "con",
      "su",
      "para",
      "como",
      "está",
      "al",
      "lo",
      "del",
      "las",
      "los",
      "una",
      "este",
      "ese",
      "aquel",
      "fue",
      "ha",
      "sido",
      "puede",
      "debe",
    ]);

    // Extraer palabras significativas (4+ letras, no stopwords)
    const words = texto
      .toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    // Contar frecuencias
    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    // Retornar top 10 más frecuentes
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Detecta conceptos jurídicos en el texto
   */
  detectLegalConcepts(texto: string): string[] {
    const concepts: string[] = [];
    const textoLower = texto.toLowerCase();

    const legalTerms = [
      "responsabilidad civil",
      "daño moral",
      "daño material",
      "nexo causal",
      "culpa",
      "dolo",
      "prescripción",
      "caducidad",
      "cosa juzgada",
      "litispendencia",
      "legitimación activa",
      "legitimación pasiva",
      "medida cautelar",
      "tutela anticipada",
      "debido proceso",
      "defensa en juicio",
      "non bis in idem",
      "in dubio pro reo",
      "carga de la prueba",
      "presunción de inocencia",
      "derecho de defensa",
      "igualdad ante la ley",
      "razonabilidad",
      "proporcionalidad",
    ];

    for (const term of legalTerms) {
      if (textoLower.includes(term)) {
        concepts.push(term);
      }
    }

    return concepts;
  }
}

export interface JurisprudenceChunkData {
  chunkType: "CONSIDERANDO" | "DOCTRINA" | "RESOLUTIVO";
  chunkNumber: number;
  texto: string;
}
