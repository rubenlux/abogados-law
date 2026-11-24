
import { Module, Global } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma.service';

@Global() // Global so other modules can inject AnalyticsService easily without importing module
@Module({
    controllers: [AnalyticsController],
    providers: [AnalyticsService, PrismaService],
    exports: [AnalyticsService]
})
export class AnalyticsModule { }
