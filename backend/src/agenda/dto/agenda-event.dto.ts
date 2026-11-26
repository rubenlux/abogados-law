import {
  IsEnum,
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
import { EstadoEventoAgenda, TipoEventoAgenda } from "@prisma/client";

export class CreateAgendaEventDto {
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

  @IsEnum(TipoEventoAgenda)
  tipo: TipoEventoAgenda;

  @IsISO8601({ strict: true })
  fechaInicio: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ubicacion?: string;

  @IsOptional()
  @IsEnum(EstadoEventoAgenda)
  estado?: EstadoEventoAgenda;

  @IsOptional()
  @IsUUID()
  responsableId?: string;
}

export class UpdateAgendaEventDto {
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
  @IsEnum(TipoEventoAgenda)
  tipo?: TipoEventoAgenda;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaInicio?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  fechaFin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  ubicacion?: string | null;

  @IsOptional()
  @IsEnum(EstadoEventoAgenda)
  estado?: EstadoEventoAgenda;

  @IsOptional()
  @IsUUID()
  responsableId?: string | null;
}

export class QueryAgendaEventDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsEnum(TipoEventoAgenda)
  tipo?: TipoEventoAgenda;

  @IsOptional()
  @IsEnum(EstadoEventoAgenda)
  estado?: EstadoEventoAgenda;

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
  limit?: number = 50;
}

