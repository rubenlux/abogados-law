/*
  Warnings:

  - Changed the type of `jurisdiccion` on the `Jurisprudence` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "DraftType" AS ENUM ('DEMANDA', 'CONTESTACION', 'RECURSO', 'MERO_TRAMITE', 'OTRO');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'EMPLOYEE', 'CLIENT', 'SYSTEM', 'BOT');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('SECURITY', 'LEGAL', 'IA', 'FINANCIAL', 'HR', 'SYSTEM', 'CLIENT');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "Jurisprudence" ADD COLUMN     "citationCount" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "jurisdiccion",
ADD COLUMN     "jurisdiccion" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "LegalDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expedienteId" TEXT,
    "draftType" "DraftType" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "fuero" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "dataContext" JSONB,
    "header" TEXT,
    "bodyFacts" TEXT,
    "bodyLaw" TEXT,
    "petitorio" TEXT,
    "fullText" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRiskAnalysis" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "jurisprudenceScore" INTEGER,
    "normativeScore" INTEGER,
    "complexityScore" INTEGER,
    "factors" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "userId" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalRiskAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "ocrContent" TEXT,
    "changesSummary" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudicialAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudicialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "maxStorageGb" INTEGER NOT NULL,
    "maxCases" INTEGER NOT NULL,
    "maxAiTokens" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currentUsers" INTEGER NOT NULL DEFAULT 0,
    "currentStorageMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentCases" INTEGER NOT NULL DEFAULT 0,
    "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "requestId" TEXT,
    "parentEventId" TEXT,
    "category" "EventCategory" NOT NULL DEFAULT 'SYSTEM',
    "severity" "EventSeverity" NOT NULL DEFAULT 'INFO',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceFingerprint" TEXT,
    "sessionId" TEXT,
    "prevHash" TEXT,
    "currentHash" TEXT,
    "signature" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "activeTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "ticketsResolved" INTEGER NOT NULL DEFAULT 0,
    "aiPromptsUsed" INTEGER NOT NULL DEFAULT 0,
    "documentsRead" INTEGER NOT NULL DEFAULT 0,
    "productivityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDraft_userId_idx" ON "LegalDraft"("userId");

-- CreateIndex
CREATE INDEX "LegalDraft_expedienteId_idx" ON "LegalDraft"("expedienteId");

-- CreateIndex
CREATE INDEX "LegalRiskAnalysis_expedienteId_idx" ON "LegalRiskAnalysis"("expedienteId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "LegalTemplate_organizationId_idx" ON "LegalTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "JudicialAccount_organizationId_idx" ON "JudicialAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUsage_organizationId_key" ON "TenantUsage"("organizationId");

-- CreateIndex
CREATE INDEX "EventLog_timestamp_idx" ON "EventLog"("timestamp");

-- CreateIndex
CREATE INDEX "EventLog_actorId_idx" ON "EventLog"("actorId");

-- CreateIndex
CREATE INDEX "EventLog_currentHash_idx" ON "EventLog"("currentHash");

-- CreateIndex
CREATE INDEX "EventLog_organizationId_idx" ON "EventLog"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMetric_userId_date_key" ON "EmployeeMetric"("userId", "date");

-- CreateIndex
CREATE INDEX "Jurisprudence_jurisdiccion_fuero_idx" ON "Jurisprudence"("jurisdiccion", "fuero");

-- AddForeignKey
ALTER TABLE "LegalDraft" ADD CONSTRAINT "LegalDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDraft" ADD CONSTRAINT "LegalDraft_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRiskAnalysis" ADD CONSTRAINT "LegalRiskAnalysis_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalTemplate" ADD CONSTRAINT "LegalTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialAccount" ADD CONSTRAINT "JudicialAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUsage" ADD CONSTRAINT "TenantUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
