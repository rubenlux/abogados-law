
import { Controller, Post, Get, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LegalIngestionService, LegalNormIngestionDto } from './legal-ingestion.service';
import { LegalSearchService, LegalSearchQuery } from './legal-search.service';

@ApiTags('legal')
@Controller('legal')
export class LegalController {
    constructor(
        private ingestionService: LegalIngestionService,
        private searchService: LegalSearchService
    ) { }

    @Post('ingest')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ingestar norma legal (Admin only)' })
    async ingest(@Body() dto: LegalNormIngestionDto, @Request() req) {
        try {
            // TODO: Check if user is ADMIN
            dto.ingestedBy = req.user.userId;
            return await this.ingestionService.ingestNorm(dto);
        } catch (error) {
            console.error('❌ Error in ingest endpoint:', error);
            console.error('Stack:', error.stack);
            throw error;
        }
    }

    @Post('ingest/batch')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ingesta masiva de normas (Admin only)' })
    async ingestBatch(@Body() body: { norms: LegalNormIngestionDto[] }, @Request() req) {
        // TODO: Check if user is ADMIN
        const normsWithUser = body.norms.map(n => ({ ...n, ingestedBy: req.user.userId }));
        return this.ingestionService.ingestBatch(normsWithUser);
    }

    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Búsqueda semántica de normas legales' })
    @ApiQuery({ name: 'query', required: true })
    @ApiQuery({ name: 'jurisdiccion', required: false })
    @ApiQuery({ name: 'fuero', required: false })
    @ApiQuery({ name: 'estado', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'threshold', required: false })
    async search(@Query() query: LegalSearchQuery) {
        return this.searchService.search(query);
    }

    @Get('article/:numeroNorma/:articulo')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Buscar artículo específico' })
    async findArticle(
        @Param('numeroNorma') numeroNorma: string,
        @Param('articulo') articulo: string,
        @Query('jurisdiccion') jurisdiccion?: string
    ) {
        return this.searchService.findByArticle(numeroNorma, articulo, jurisdiccion);
    }

    @Get('versions/:numeroNorma/:articulo')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Historial de versiones de un artículo' })
    async getVersions(
        @Param('numeroNorma') numeroNorma: string,
        @Param('articulo') articulo: string
    ) {
        return this.searchService.getVersionHistory(numeroNorma, articulo);
    }

    @Get('conflicts/:normId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Detectar conflictos normativos' })
    async detectConflicts(@Param('normId') normId: string) {
        return this.searchService.detectConflicts(normId);
    }

    @Get('stats')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Estadísticas de la base legal' })
    async getStats() {
        return this.searchService.getStats();
    }

    @Post('version/:normId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Crear nueva versión de norma (Admin only)' })
    async createVersion(
        @Param('normId') normId: string,
        @Body() updates: Partial<LegalNormIngestionDto>,
        @Request() req
    ) {
        // TODO: Check if user is ADMIN
        return this.ingestionService.createNewVersion(normId, updates, req.user.userId);
    }
}
