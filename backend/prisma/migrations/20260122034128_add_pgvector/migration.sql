CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "LegalNorm" ADD COLUMN     "embedding" vector(1536);
