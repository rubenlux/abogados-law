
import { Module } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { AgendaController } from './agenda.controller';
import { DeadlineCalculatorService } from './deadline-calculator.service';
import { PrismaService } from '../prisma.service';

@Module({
    controllers: [AgendaController],
    providers: [AgendaService, DeadlineCalculatorService, PrismaService],
    exports: [AgendaService, DeadlineCalculatorService],
})
export class AgendaModule { }
