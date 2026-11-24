
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class CreateExpedienteDto {
    @IsNotEmpty()
    @IsString()
    caratula: string;

    @IsNotEmpty()
    @IsString()
    numero: string;

    @IsNotEmpty()
    @IsString()
    juzgado: string;

    @IsOptional()
    @IsString()
    descripcion?: string;

    @IsOptional()
    @IsString()
    jurisdiccion: string = 'NACION';

    // For MVP simplification. Real app gets this from JWT user session
    @IsOptional()
    @IsUUID()
    organizationId?: string;
}
