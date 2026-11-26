import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ExpedienteEstado } from "@prisma/client";

export class UpdateExpedienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  caratula?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroExpediente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  juzgado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jurisdiccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fuero?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  secretaria?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipoProceso?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  materia?: string | null;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsEnum(ExpedienteEstado)
  estado?: ExpedienteEstado;

  @IsOptional()
  @IsUUID()
  responsableId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

