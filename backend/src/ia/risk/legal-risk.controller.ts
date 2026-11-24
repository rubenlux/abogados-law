
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { LegalRiskService } from './legal-risk.service';

@Controller('ai/risk-score')
export class LegalRiskController {
    constructor(private readonly riskService: LegalRiskService) { }

    @Post(':expedienteId')
    async analyzeRisk(
        @Param('expedienteId') expedienteId: string,
        @Body('userId') userId: string // Assuming passed in body for now, replace with Auth user in prod
    ) {
        // Fallback for dev if userId not provided
        const finalUserId = userId || 'system-test-user';
        return this.riskService.analyzeRisk(expedienteId, finalUserId);
    }

    @Get(':expedienteId')
    async getRiskHistory(@Param('expedienteId') expedienteId: string) {
        return this.riskService.getHistory(expedienteId);
    }
}
