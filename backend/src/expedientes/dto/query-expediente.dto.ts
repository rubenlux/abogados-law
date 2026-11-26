import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ExpedienteEstado } from "@prisma/client";

export class QueryExpedienteDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ExpedienteEstado)
  estado?: ExpedienteEstado;

  @IsOptional()
  @IsString()
  fuero?: string;

  @IsOptional()
  @IsString()
  jurisdiccion?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

