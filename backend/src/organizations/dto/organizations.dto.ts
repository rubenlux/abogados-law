/**
 * DTOs de Validación de Entradas para AUTH-03 (Organizaciones, Membresías, Roles e Invitaciones).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsInt,
  Min,
  Max,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { OrganizationRole, OrganizationStatus } from "@prisma/client";

@ValidatorConstraint({ name: "isNotBlank", async: false })
class IsNotBlankConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }
  defaultMessage(): string {
    return "Field must not be empty or whitespace only";
  }
}

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @Validate(IsNotBlankConstraint)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cuit?: string;
}

export class UpdateOrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status: OrganizationStatus;
}

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(254)
  invitedEmail: string;

  @IsEnum(OrganizationRole)
  role: OrganizationRole;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @Validate(IsNotBlankConstraint)
  token: string;
}

export class ChangeMemberRoleDto {
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty()
  targetMembershipId: string;
}

export class SetActiveOrganizationDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}
