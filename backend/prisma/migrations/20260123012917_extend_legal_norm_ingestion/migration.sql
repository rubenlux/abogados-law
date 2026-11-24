/*
  Warnings:

  - A unique constraint covering the columns `[jurisdiccion,numeroNorma,articulo,versionNorma]` on the table `LegalNorm` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LegalNorm" ADD COLUMN     "apartado" TEXT,
ADD COLUMN     "conflictsWith" TEXT[],
ADD COLUMN     "ingestedBy" TEXT,
ADD COLUMN     "parsedAt" TIMESTAMP(3),
ADD COLUMN     "parsedBy" TEXT,
ADD COLUMN     "parsingVersion" TEXT,
ADD COLUMN     "rawContent" TEXT,
ADD COLUMN     "sourceFileHash" TEXT,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "supersededBy" TEXT,
ADD COLUMN     "supersedes" TEXT[],
ADD COLUMN     "temas" TEXT[],
ADD COLUMN     "textoNormalizado" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateIndex
CREATE INDEX "LegalNorm_tipoNorma_numeroNorma_idx" ON "LegalNorm"("tipoNorma", "numeroNorma");

-- CreateIndex
CREATE INDEX "LegalNorm_checksumTexto_idx" ON "LegalNorm"("checksumTexto");

-- CreateIndex
CREATE UNIQUE INDEX "LegalNorm_jurisdiccion_numeroNorma_articulo_versionNorma_key" ON "LegalNorm"("jurisdiccion", "numeroNorma", "articulo", "versionNorma");
