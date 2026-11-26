import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  EstadoVencimiento,
  PrioridadVencimiento,
  TipoVencimiento,
} from "@prisma/client";

export class CreateVencimientoDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(TipoVencimiento)
  tipo?: TipoVencimiento;

  @IsISO8601({ strict: true })
  fechaLimite: string;

  @IsOptional()
  @IsEnum(PrioridadVencimiento)
  prioridad?: PrioridadVencimiento;

  @IsOptional()
  @IsEnum(EstadoVencimiento)
  estado?: EstadoVencimiento;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class UpdateVencimientoDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsEnum(TipoVencimiento)
  tipo?: TipoVencimiento;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaLimite?: string;

  @IsOptional()
  @IsEnum(PrioridadVencimiento)
  prioridad?: PrioridadVencimiento;

  @IsOptional()
  @IsEnum(EstadoVencimiento)
  estado?: EstadoVencimiento;

  @IsOptional()
  @IsUUID()
  responsableId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}

export class ActionVencimientoDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class QueryVencimientoDto {
  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsEnum(PrioridadVencimiento)
  prioridad?: PrioridadVencimiento;

  @IsOptional()
  @IsEnum(EstadoVencimiento)
  estado?: EstadoVencimiento;

  @IsOptional()
  @IsEnum(TipoVencimiento)
  tipo?: TipoVencimiento;

  @IsOptional()
  @IsIn(["all", "pendientes", "proximos", "vencidos", "cumplidos"])
  scope?: "all" | "pendientes" | "proximos" | "vencidos" | "cumplidos" = "all";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  upcomingDays?: number = 7;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

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

