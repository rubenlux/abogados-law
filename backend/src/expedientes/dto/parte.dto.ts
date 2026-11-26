import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ClientPersonType, RolParteProcesal } from "@prisma/client";

export class CreateParteDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsEnum(ClientPersonType)
  tipoParte?: ClientPersonType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cuitDni?: string;

  @IsEnum(RolParteProcesal)
  rol: RolParteProcesal;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  caracter?: string;

  @IsOptional()
  @IsBoolean()
  esCliente?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class UpdateParteDto {
  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsEnum(ClientPersonType)
  tipoParte?: ClientPersonType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cuitDni?: string | null;

  @IsOptional()
  @IsEnum(RolParteProcesal)
  rol?: RolParteProcesal;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  caracter?: string | null;

  @IsOptional()
  @IsBoolean()
  esCliente?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string | null;
}
