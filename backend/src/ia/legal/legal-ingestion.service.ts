import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { EmbeddingService } from "../nlu/embedding.service";
import { TextNormalizationService } from "../nlu/text-normalization.service";

export interface LegalNormIngestionDto {
  // Clasificación
  jurisdiccion: string;
  fuero: string;
  tipoNorma: string;

  // Identificación
  nombre: string;
  numeroNorma?: string;
  articulo: string;
  inciso?: string;
  apartado?: string;

  // Contenido
  textoCompleto: string;

  // Versionado
  fechaVigencia: Date | string;
  fechaDerogacion?: Date | string;
  estado?: string;

  // Metadatos
  ambitoAplicacion?: string;
  fuenteOficialUrl?: string;

  // Ingestion
  sourceType?: "PDF" | "HTML" | "API" | "MANUAL";
  sourceUrl?: string;
  sourceFileHash?: string;
  rawContent?: string;

  // Usuario
  ingestedBy?: string;
}

@Injectable()
export class LegalIngestionService {
  private readonly logger = new Logger(LegalIngestionService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private textNormalization: TextNormalizationService,
  ) {}

  /**
   * Ingesta completa de una norma legal con procesamiento automático
   */
  async ingestNorm(dto: LegalNormIngestionDto) {
    try {
      this.logger.log(`Ingesting: ${dto.nombre} - ${dto.articulo}`);

      // 1. Normalizar texto
      this.logger.debug("Step 1: Normalizing text...");
      const textoNormalizado = this.textNormalization.normalize(
        dto.textoCompleto,
      );

      // 2. Generar checksum
      this.logger.debug("Step 2: Generating checksum...");
      const checksumTexto =
        this.textNormalization.generateChecksum(textoNormalizado);

      // 3. Verificar duplicados por checksum
      this.logger.debug("Step 3: Checking for duplicates...");
      const existing = await this.prisma.legalNorm.findFirst({
        where: { checksumTexto },
      });

      if (existing) {
        this.logger.warn(`Duplicate detected (checksum match): ${existing.id}`);
        return { status: "duplicate", existingId: existing.id };
      }

      // 4. Extraer keywords y conceptos
      this.logger.debug("Step 4: Extracting keywords...");
      const keywords = this.textNormalization.extractKeywords(textoNormalizado);
      const conceptosJuridicos =
        this.textNormalization.detectLegalConcepts(textoNormalizado);

      // 5. Generar embedding
      this.logger.debug("Step 5: Generating embedding...");
      const embedding =
        await this.embeddingService.getEmbedding(textoNormalizado);
      this.logger.debug(`Embedding generated: ${embedding.length} dimensions`);

      // 6. Preparar datos
      this.logger.debug("Step 6: Preparing data...");
      const data = {
        jurisdiccion: dto.jurisdiccion as any,
        fuero: dto.fuero as any,
        tipoNorma: dto.tipoNorma,
        nombre: dto.nombre,
        numeroNorma: dto.numeroNorma,
        articulo: dto.articulo,
        inciso: dto.inciso,
        apartado: dto.apartado,
        textoCompleto: dto.textoCompleto,
        textoNormalizado,
        fechaVigencia:
          typeof dto.fechaVigencia === "string"
            ? new Date(dto.fechaVigencia)
            : dto.fechaVigencia,
        fechaDerogacion: dto.fechaDerogacion
          ? typeof dto.fechaDerogacion === "string"
            ? new Date(dto.fechaDerogacion)
            : dto.fechaDerogacion
          : null,
        estado: (dto.estado || "VIGENTE") as any,
        ambitoAplicacion: dto.ambitoAplicacion,
        fuenteOficialUrl: dto.fuenteOficialUrl,
        checksumTexto,
        sourceType: dto.sourceType,
        sourceUrl: dto.sourceUrl,
        sourceFileHash: dto.sourceFileHash,
        rawContent: dto.rawContent,
        parsedAt: new Date(),
        parsedBy: dto.ingestedBy || "system",
        parsingVersion: "1.0.0",
        keywords,
        conceptosJuridicos,
        temas: [], // TODO: clasificación automática
        ingestedBy: dto.ingestedBy,
        versionNorma: 1,
      };

      // 7. Crear en DB
      this.logger.debug("Step 7: Creating in database...");
      const norm = await this.prisma.legalNorm.create({ data });
      this.logger.debug(`Created norm with ID: ${norm.id}`);

      // 8. Actualizar embedding (raw SQL por tipo vector)
      this.logger.debug("Step 8: Updating embedding...");
      const vectorString = JSON.stringify(embedding);
      await this.prisma.$executeRaw`
            UPDATE "LegalNorm"
            SET embedding = ${vectorString}::vector
            WHERE id = ${norm.id}
        `;

      this.logger.log(`✅ Ingested successfully: ${norm.id}`);

      return { status: "success", normId: norm.id, norm };
    } catch (error) {
      this.logger.error(`❌ Error in ingestNorm: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Ingesta masiva desde array
   */
  async ingestBatch(norms: LegalNormIngestionDto[]) {
    const results = {
      success: 0,
      duplicates: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const norm of norms) {
      try {
        const result = await this.ingestNorm(norm);
        if (result.status === "success") {
          results.success++;
        } else if (result.status === "duplicate") {
          results.duplicates++;
        }
        results.details.push(result);
      } catch (error) {
        results.errors++;
        results.details.push({
          status: "error",
          error: error.message,
          norm: norm.articulo,
        });
        this.logger.error(`Error ingesting ${norm.articulo}:`, error);
      }
    }

    return results;
  }

  /**
   * Buscar normas similares (para detectar conflictos)
   */
  async findSimilarNorms(text: string, threshold = 0.85, limit = 5) {
    const embedding = await this.embeddingService.getEmbedding(text);
    const vectorString = JSON.stringify(embedding);

    const results = await this.prisma.$queryRaw`
            SELECT id, nombre, articulo, "textoCompleto",
            1 - (embedding <=> ${vectorString}::vector) as similarity
            FROM "LegalNorm"
            WHERE embedding IS NOT NULL
            AND 1 - (embedding <=> ${vectorString}::vector) > ${threshold}
            ORDER BY embedding <=> ${vectorString}::vector ASC
            LIMIT ${limit};
        `;

    return results as any[];
  }

  /**
   * Actualizar versión de norma (cuando se modifica)
   */
  async createNewVersion(
    normId: string,
    updates: Partial<LegalNormIngestionDto>,
    userId: string,
  ) {
    const original = await this.prisma.legalNorm.findUnique({
      where: { id: normId },
    });
    if (!original) throw new Error("Norm not found");

    // Marcar original como modificada
    await this.prisma.legalNorm.update({
      where: { id: normId },
      data: {
        estado: "MODIFICADA",
        updatedAt: new Date(),
      },
    });

    // Crear nueva versión
    const newVersion = await this.ingestNorm({
      ...original,
      ...updates,
      versionNorma: original.versionNorma + 1,
      ingestedBy: userId,
    } as any);

    // Vincular
    await this.prisma.legalNorm.update({
      where: { id: normId },
      data: { normaModificadoraId: (newVersion as any).normId },
    });

    return newVersion;
  }
}
