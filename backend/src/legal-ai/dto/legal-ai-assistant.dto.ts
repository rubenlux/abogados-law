import { LegalAiConversationStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string | null;
}

export class QueryConversationsDto {
  @IsOptional()
  @IsEnum(LegalAiConversationStatus)
  status?: LegalAiConversationStatus;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

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

export class SendAssistantMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID("4", { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientMessageId?: string;
}

