
import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { DraftingService, DraftInputDto } from './drafting.service';

@Controller('ai/draft')
export class DraftingController {
    constructor(private readonly draftingService: DraftingService) { }

    @Post()
    async generate(@Body() body: any) {
        // Map payload to DTO
        const input: DraftInputDto = {
            userId: body.userId,
            expedienteId: body.expedienteId,
            draftType: body.type,
            jurisdiction: body.jurisdiction,
            fuero: body.fuero,
            facts: body.facts,
            dataContext: body.dataContext
        };
        return this.draftingService.generateDraft(input);
    }

    @Get('user/:userId')
    async getDrafts(
        @Param('userId') userId: string,
        @Query('expedienteId') expedienteId?: string
    ) {
        return this.draftingService.getDrafts(userId, expedienteId);
    }

    @Get(':id')
    async getDraft(@Param('id') id: string) {
        return this.draftingService.getDraft(id);
    }
}
