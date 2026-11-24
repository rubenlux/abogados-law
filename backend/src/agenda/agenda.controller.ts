
import { Controller, Get, Post, Body, Param, UseGuards, Query, Request } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { DeadlineCalculatorService } from './deadline-calculator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agenda')
export class AgendaController {
    constructor(
        private readonly agendaService: AgendaService,
        private readonly deadlineService: DeadlineCalculatorService
    ) { }

    @Get()
    findAll(@Request() req, @Query() query: any) {
        return this.agendaService.findAll(req.user.userId, query);
    }

    @Get('feriados/:jurisdiccion/:year')
    getHolidays(@Param('jurisdiccion') jurisdiccion: string, @Param('year') year: string) {
        return this.agendaService.getHolidays(jurisdiccion, parseInt(year));
    }

    @Post('eventos')
    createEvent(@Body() body: any) {
        return this.agendaService.createEvent(body);
    }

    @Post('simular-vencimiento')
    async simulateDeadline(@Body() body: { start: string, days: number, jurisdiccion: string, type?: 'HABIL' | 'CORRIDO' }) {
        return this.deadlineService.calculateDeadline(body.start, body.days, body.jurisdiccion, body.type);
    }
}
