import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { OrigenMovimiento, TipoMovimientoProcesal } from "@prisma/client";

export class CreateMovimientoDto {
  @IsUUID()
  expedienteId: string;

  @IsEnum(TipoMovimientoProcesal)
  tipo: TipoMovimientoProcesal;

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsISO8601({ strict: true })
  fechaActuacion: string;

  @IsOptional()
  @IsEnum(OrigenMovimiento)
  origen?: OrigenMovimiento;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referencia?: string;

  @IsOptional()
  @IsObject()
  metadatos?: Record<string, unknown>;
}

export class UpdateMovimientoDto {
  @IsOptional()
  @IsEnum(TipoMovimientoProcesal)
  tipo?: TipoMovimientoProcesal;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaActuacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referencia?: string | null;

  @IsOptional()
  @IsObject()
  metadatos?: Record<string, unknown> | null;
}

export class AnnulMovimientoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class QueryMovimientoDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsEnum(TipoMovimientoProcesal)
  tipo?: TipoMovimientoProcesal;

  @IsOptional()
  @IsIn(["asc", "desc"])
  order?: "asc" | "desc" = "desc";

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeAnulados?: boolean = false;

  @IsOptional()
  @IsString()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

