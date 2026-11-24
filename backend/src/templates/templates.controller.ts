
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';

@Controller('templates')
export class TemplatesController {
    constructor(private readonly templatesService: TemplatesService) { }

    @Post()
    async create(@Body() body: any) {
        return this.templatesService.create({
            ...body,
            organizationId: body.organizationId || 'default-org-id' // Mock org for now
        });
    }

    @Get()
    async findAll() {
        return this.templatesService.findAll('default-org-id');
    }

    @Post(':id/generate')
    async generate(@Param('id') id: string, @Body() values: Record<string, string>) {
        return this.templatesService.generateDocument(id, values);
    }
}
