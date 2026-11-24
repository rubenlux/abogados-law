-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PARTNER', 'ASSOCIATE', 'PARALEGAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "ExpedienteEstado" AS ENUM ('INICIO', 'PRUEBA', 'ALEGATOS', 'SENTENCIA', 'APELACION', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "DocumentoTipo" AS ENUM ('ESCRITO', 'CEDULA', 'SENTENCIA', 'PRUEBA_DOCUMENTAL', 'OTRO');

-- CreateEnum
CREATE TYPE "PlazoTipo" AS ENUM ('FATAL', 'ORDINARIO', 'MERO_TRAMITE');

-- CreateEnum
CREATE TYPE "EventoEstado" AS ENUM ('PENDIENTE', 'COMPLETADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "LegalNormJurisdiccion" AS ENUM ('NACION', 'CABA', 'PBA', 'CBA', 'SFE');

-- CreateEnum
CREATE TYPE "LegalNormFuero" AS ENUM ('CIVIL', 'COMERCIAL', 'PENAL', 'LABORAL', 'FAMILIA', 'CONTENCIOSO_ADMINISTRATIVO');

-- CreateEnum
CREATE TYPE "LegalNormEstado" AS ENUM ('VIGENTE', 'DEROGADA', 'MODIFICADA', 'ANULADA');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "plan" "OrganizationPlan" NOT NULL DEFAULT 'STARTER',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ASSOCIATE',
    "permissions" JSONB,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expediente" (
    "id" TEXT NOT NULL,
    "caratula" TEXT NOT NULL,
    "numeroExpediente" TEXT NOT NULL,
    "juzgado" TEXT NOT NULL,
    "jurisdiccion" TEXT NOT NULL,
    "estado" "ExpedienteEstado" NOT NULL DEFAULT 'INICIO',
    "tags" TEXT[],
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "tipo" "DocumentoTipo" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockExpiresAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "legalHoldReason" TEXT,
    "ocrContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAgenda" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "tipoPlazo" "PlazoTipo" NOT NULL,
    "estado" "EventoEstado" NOT NULL DEFAULT 'PENDIENTE',
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "alertConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoAgenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarioJudicial" (
    "id" TEXT NOT NULL,
    "jurisdiccion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "esFeriado" BOOLEAN NOT NULL DEFAULT true,
    "esInhabil" BOOLEAN NOT NULL DEFAULT true,
    "afectaPlazos" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarioJudicial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalNorm" (
    "id" TEXT NOT NULL,
    "jurisdiccion" "LegalNormJurisdiccion" NOT NULL,
    "fuero" "LegalNormFuero" NOT NULL,
    "tipoNorma" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numeroNorma" TEXT,
    "articulo" TEXT NOT NULL,
    "inciso" TEXT,
    "textoCompleto" TEXT NOT NULL,
    "versionNorma" INTEGER NOT NULL DEFAULT 1,
    "fechaVigencia" TIMESTAMP(3) NOT NULL,
    "fechaDerogacion" TIMESTAMP(3),
    "estado" "LegalNormEstado" NOT NULL DEFAULT 'VIGENTE',
    "normaModificadoraId" TEXT,
    "ambitoAplicacion" TEXT,
    "estadoActual" TEXT,
    "fuenteOficialUrl" TEXT,
    "checksumTexto" TEXT,
    "keywords" TEXT[],
    "conceptosJuridicos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalNorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "entityTable" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "prevHash" TEXT,
    "currentHash" TEXT,
    "signature" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ExpedienteToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Expediente_organizationId_idx" ON "Expediente"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarioJudicial_jurisdiccion_fecha_key" ON "CalendarioJudicial"("jurisdiccion", "fecha");

-- CreateIndex
CREATE INDEX "LegalNorm_jurisdiccion_fuero_estado_idx" ON "LegalNorm"("jurisdiccion", "fuero", "estado");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "_ExpedienteToUser_AB_unique" ON "_ExpedienteToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_ExpedienteToUser_B_index" ON "_ExpedienteToUser"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expediente" ADD CONSTRAINT "Expediente_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpedienteToUser" ADD CONSTRAINT "_ExpedienteToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Expediente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpedienteToUser" ADD CONSTRAINT "_ExpedienteToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
