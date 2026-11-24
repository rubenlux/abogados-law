
import { Controller, Post, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { IAService } from './ia.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ia')
@Controller('ia')
export class IAController {
    constructor(private readonly iaService: IAService) { }

    @Post('ask')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Consultar asistente legal (RAG)' })
    async ask(@Body() body: { query: string; context?: string }) {
        return this.iaService.askLegalAssistant(body.query, body.context);
    }

    @Post('analyze')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Analizar documento jurídico' })
    async analyze(@Body() body: { text: string }) {
        return this.iaService.analyzeDocument(body.text);
    }

    @Post('ingest')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ingestar norma legal (Admin only)' })
    async ingest(@Body() body: { titulo: string, texto: string, jurisdiccion: string, fuero: string, tipo: string, articulo: string }) {
        // TODO: check role ADMIN
        return this.iaService.ingestLegalNorm(body);
    }
}
