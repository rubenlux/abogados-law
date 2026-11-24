
import { Controller, Post, Get, Body, Query, UseGuards, Request, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JurisprudenceIngestionService } from './jurisprudence-ingestion.service';
import { JurisprudenceSearchService, JurisprudenceSearchQuery } from './jurisprudence-search.service';
import { JurisprudenceCrawlerService } from './jurisprudence-crawler.service';

@ApiTags('jurisprudence')
@Controller('jurisprudence')
export class JurisprudenceController {
    private readonly logger = new Logger(JurisprudenceController.name);

    constructor(
        private readonly ingestionService: JurisprudenceIngestionService,
        private readonly searchService: JurisprudenceSearchService,
        private readonly crawlerService: JurisprudenceCrawlerService
    ) { }

    @Get('stats')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Estadísticas de la base de jurisprudencia' })
    async getStats() {
        this.logger.log('GET /jurisprudence/stats');
        return this.searchService.getStats();
    }

    @Get('list')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar todos los casos' })
    async listAll(@Query('limit') limit?: string) {
        this.logger.log('GET /jurisprudence/list');
        const limitNum = limit ? parseInt(limit) : 10;
        return this.searchService.listAll(limitNum);
    }

    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Búsqueda semántica' })
    async search(@Query() query: JurisprudenceSearchQuery) {
        this.logger.log(`GET /jurisprudence/search?query=${query.query}`);
        try {
            return await this.searchService.search(query);
        } catch (error) {
            this.logger.error(`Error in search: ${error.message}`);
            // Fallback total
            return this.searchService.listAll(10);
        }
    }

    @Post('import')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Importar fallos en tiempo real desde CSJN o Formosa' })
    async import(@Body('query') query: string, @Body('source') source?: 'CSJN' | 'FORMOSA') {
        this.logger.log(`POST /jurisprudence/import - Source: ${source || 'CSJN'}, Query: ${query}`);
        return this.crawlerService.importFromSource(query, source || 'CSJN');
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener detalle por ID' })
    async findById(@Param('id') id: string) {
        this.logger.log(`GET /jurisprudence/${id}`);
        if (!id || id === 'undefined' || id === 'stats' || id === 'list' || id === 'search') {
            return { error: 'Invalid ID' };
        }
        return this.searchService.findById(id);
    }

    @Post('ingest')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    async ingest(@Body() dto: any, @Request() req) {
        dto.ingestedBy = req.user.userId;
        return this.ingestionService.ingestJurisprudence(dto);
    }
}
