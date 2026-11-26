import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
} from "class-validator";
import { ClientPersonType, ClientStatus } from "@prisma/client";

export class CreateClientDto {
  @IsEnum(ClientPersonType)
  @IsOptional()
  personType?: ClientPersonType;

  @IsString()
  @IsNotEmpty({ message: "El nombre o razón social es obligatorio" })
  @MaxLength(200)
  firstName: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  dniCuit?: string;

  @IsEmail({}, { message: "El formato de email no es válido" })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  province?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsEnum(ClientStatus)
  @IsOptional()
  status?: ClientStatus;
}

