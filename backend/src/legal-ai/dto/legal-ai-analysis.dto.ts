import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { LegalAiAnalysisStatus, LegalAiAnalysisType } from "@prisma/client";

export class PreviewAnalysisSourcesDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsUUID("4", { each: true })
  documentIds?: string[];
}

export class CreateLegalAiAnalysisDto {
  @IsEnum(LegalAiAnalysisType)
  analysisType: LegalAiAnalysisType;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsUUID("4", { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  inputInstructions?: string;
}

export class UpdateLegalAiAnalysisDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  editedContent?: Record<string, unknown>;
}

export class QueryLegalAiAnalysesDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsEnum(LegalAiAnalysisType)
  analysisType?: LegalAiAnalysisType;

  @IsOptional()
  @IsEnum(LegalAiAnalysisStatus)
  status?: LegalAiAnalysisStatus;

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
  @Max(50)
  limit?: number;
}

