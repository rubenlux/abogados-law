import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateExpedienteDto } from './dto/create-expediente.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('expedientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expedientes')
export class ExpedientesController {
    constructor(private readonly expedientesService: ExpedientesService) { }

    @Get()
    @ApiOperation({ summary: 'Listar todos los expedientes' })
    findAll() {
        return this.expedientesService.findAll();
    }

    @Post()
    @ApiOperation({ summary: 'Crear nuevo expediente' })
    create(@Body() createExpedienteDto: CreateExpedienteDto) {
        return this.expedientesService.create(createExpedienteDto);
    }
}
