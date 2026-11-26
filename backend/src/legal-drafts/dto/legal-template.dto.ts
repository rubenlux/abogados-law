import { LegalDraftCategory, LegalDraftDocumentType } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class CreateLegalTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(LegalDraftCategory)
  category?: LegalDraftCategory;

  @IsOptional()
  @IsEnum(LegalDraftDocumentType)
  documentType?: LegalDraftDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(2500)
  baseInstructions?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  requiredInfo?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fuero?: string;

  @IsObject()
  @IsNotEmpty()
  content: Record<string, unknown>;
}

export class UpdateLegalTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsEnum(LegalDraftCategory)
  category?: LegalDraftCategory;

  @IsOptional()
  @IsEnum(LegalDraftDocumentType)
  documentType?: LegalDraftDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(2500)
  baseInstructions?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  requiredInfo?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jurisdiction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fuero?: string | null;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

export class QueryLegalTemplateDto {
  @IsOptional()
  @IsEnum(LegalDraftCategory)
  category?: LegalDraftCategory;

  @IsOptional()
  @IsEnum(LegalDraftDocumentType)
  documentType?: LegalDraftDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === "true" ? true : value === "false" ? false : value,
  )
  @IsBoolean()
  includeArchived?: boolean;

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
