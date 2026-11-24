-- CreateEnum
CREATE TYPE "JurisprudenceTribunal" AS ENUM ('CSJN', 'CAMARA_FEDERAL', 'CAMARA_NACIONAL', 'CAMARA_PROVINCIAL', 'TRIBUNAL_SUPERIOR', 'JUZGADO_FEDERAL', 'JUZGADO_NACIONAL', 'JUZGADO_PROVINCIAL');

-- CreateEnum
CREATE TYPE "JurisprudencePrecedencia" AS ENUM ('PLENARIO', 'OBLIGATORIO', 'PERSUASIVO', 'REFERENCIAL');

-- CreateEnum
CREATE TYPE "JurisprudenceVigencia" AS ENUM ('VIGENTE', 'MODIFICADO', 'SUPERADO', 'DEROGADO');

-- CreateTable
CREATE TABLE "Jurisprudence" (
    "id" TEXT NOT NULL,
    "tribunal" "JurisprudenceTribunal" NOT NULL,
    "sala" TEXT,
    "nroExpediente" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "jurisdiccion" "LegalNormJurisdiccion" NOT NULL,
    "fuero" "LegalNormFuero" NOT NULL,
    "tema" TEXT[],
    "resumen" TEXT NOT NULL,
    "textoCompleto" TEXT NOT NULL,
    "precedencia" "JurisprudencePrecedencia" NOT NULL DEFAULT 'REFERENCIAL',
    "vigencia" "JurisprudenceVigencia" NOT NULL DEFAULT 'VIGENTE',
    "fuenteOficialUrl" TEXT,
    "caratula" TEXT,
    "magistrados" TEXT[],
    "votos" JSONB,
    "embedding" vector(1536),
    "sourceType" TEXT,
    "sourceUrl" TEXT,
    "sourceFileHash" TEXT,
    "parsedAt" TIMESTAMP(3),
    "parsedBy" TEXT,
    "parsingVersion" TEXT,
    "ingestedBy" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisprudence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisprudenceChunk" (
    "id" TEXT NOT NULL,
    "jurisprudenceId" TEXT NOT NULL,
    "chunkType" TEXT NOT NULL,
    "chunkNumber" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "embedding" vector(1536),
    "keywords" TEXT[],
    "conceptosJuridicos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisprudenceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisprudenceCitation" (
    "id" TEXT NOT NULL,
    "citingCaseId" TEXT NOT NULL,
    "citedCaseId" TEXT NOT NULL,
    "citationType" TEXT NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisprudenceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Jurisprudence_tribunal_fecha_idx" ON "Jurisprudence"("tribunal", "fecha");

-- CreateIndex
CREATE INDEX "Jurisprudence_jurisdiccion_fuero_idx" ON "Jurisprudence"("jurisdiccion", "fuero");

-- CreateIndex
CREATE INDEX "Jurisprudence_precedencia_vigencia_idx" ON "Jurisprudence"("precedencia", "vigencia");

-- CreateIndex
CREATE INDEX "Jurisprudence_tema_idx" ON "Jurisprudence"("tema");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisprudence_tribunal_nroExpediente_fecha_key" ON "Jurisprudence"("tribunal", "nroExpediente", "fecha");

-- CreateIndex
CREATE INDEX "JurisprudenceChunk_jurisprudenceId_idx" ON "JurisprudenceChunk"("jurisprudenceId");

-- CreateIndex
CREATE INDEX "JurisprudenceChunk_chunkType_idx" ON "JurisprudenceChunk"("chunkType");

-- CreateIndex
CREATE INDEX "JurisprudenceCitation_citedCaseId_idx" ON "JurisprudenceCitation"("citedCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "JurisprudenceCitation_citingCaseId_citedCaseId_key" ON "JurisprudenceCitation"("citingCaseId", "citedCaseId");

-- AddForeignKey
ALTER TABLE "JurisprudenceChunk" ADD CONSTRAINT "JurisprudenceChunk_jurisprudenceId_fkey" FOREIGN KEY ("jurisprudenceId") REFERENCES "Jurisprudence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisprudenceCitation" ADD CONSTRAINT "JurisprudenceCitation_citingCaseId_fkey" FOREIGN KEY ("citingCaseId") REFERENCES "Jurisprudence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurisprudenceCitation" ADD CONSTRAINT "JurisprudenceCitation_citedCaseId_fkey" FOREIGN KEY ("citedCaseId") REFERENCES "Jurisprudence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
