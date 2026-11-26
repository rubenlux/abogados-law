import {
  LegalDraftCategory,
  LegalDraftDocumentType,
  LegalDraftExportFormat,
  LegalDraftStatus,
} from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateLegalDraftDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  sourceTemplateId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title: string;

  @IsOptional()
  @IsEnum(LegalDraftCategory)
  category?: LegalDraftCategory;

  @IsOptional()
  @IsEnum(LegalDraftDocumentType)
  documentType?: LegalDraftDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  courtName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  caseNumber?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

/**
 * Deliberadamente NO incluye `status` ni `organizationId`:
 * los cambios de estado solo pueden ejecutarse por los endpoints de flujo de trabajo.
 */
export class UpdateLegalDraftDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsEnum(LegalDraftDocumentType)
  documentType?: LegalDraftDocumentType;

  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  courtName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  caseNumber?: string | null;
}

export class CreateLegalDraftVersionDto {
  @IsObject()
  @IsNotEmpty()
  content: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}

export class SubmitReviewDto {
  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  comments?: string;
}

export class RequestChangesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comments: string;
}

export class ApproveDraftDto {
  @IsUUID()
  versionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  comments?: string;
}

export class FinalizeDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}

export class ExportFormatOptionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  fontFamily?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(9)
  @Max(16)
  fontSizePt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2.5)
  lineSpacing?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  marginTopCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  marginBottomCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  marginLeftCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  marginRightCm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  headerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  footerText?: string;

  @IsOptional()
  @IsBoolean()
  includePageNumbers?: boolean;
}

export class ExportLegalDraftDto {
  @IsUUID()
  versionId: string;

  @IsEnum(LegalDraftExportFormat)
  format: LegalDraftExportFormat;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExportFormatOptionsDto)
  options?: ExportFormatOptionsDto;
}

export class QueryLegalDraftDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsEnum(LegalDraftDocumentType)
  documentType?: LegalDraftDocumentType;

  @IsOptional()
  @IsEnum(LegalDraftStatus)
  status?: LegalDraftStatus;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AiGenerateLegalDraftDto {
  @IsOptional()
  @IsEnum(LegalDraftCategory)
  category?: LegalDraftCategory;

  @IsEnum(LegalDraftDocumentType)
  documentType: LegalDraftDocumentType;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  sourceTemplateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(6000)
  instructions: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  referenceDocumentIds?: string[];
}

export class AiAssistLegalDraftDto {
  @IsIn([
    "REGENERATE",
    "IMPROVE",
    "EXPAND",
    "SUMMARIZE",
    "FIX_STRUCTURE",
    "MISSING_INFO",
  ])
  mode:
    | "REGENERATE"
    | "IMPROVE"
    | "EXPAND"
    | "SUMMARIZE"
    | "FIX_STRUCTURE"
    | "MISSING_INFO";

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  applyAsNewVersion?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  referenceDocumentIds?: string[];
}
