import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ExpedienteEstado } from "@prisma/client";
import { CreateParteDto } from "./parte.dto";

export class CreateExpedienteDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  caratula: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroExpediente?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  juzgado: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jurisdiccion?: string = "NACION";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fuero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  secretaria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipoProceso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  materia?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(ExpedienteEstado)
  estado?: ExpedienteEstado;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParteDto)
  partes?: CreateParteDto[];
}
