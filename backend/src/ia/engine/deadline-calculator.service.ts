import { Injectable } from '@nestjs/common';
import { addDays, isWeekend, addBusinessDays, format, isSameDay } from 'date-fns';
import { PrismaService } from '../../prisma.service';

export type Jurisdiction = 'NACION' | 'PBA';
export type ProcessType = 'ORDINARIO' | 'SUMARISIMO' | 'EJECUTIVO';
export type DeadlineType = 'DIAS_HABILES' | 'DIAS_CORRIDOS';

interface DeadlineRequest {
    fechaNotificacion: Date;
    jurisdiction: Jurisdiction;
    processType: ProcessType;
    deadlineDays: number; // e.g., 15 for Traslado Demanda
    deadlineType: DeadlineType;
}

interface DeadlineResult {
    deadlineDate: Date;
    isGracePeriod: boolean; // Cargo de hora next day
    details: string;
}

@Injectable()
export class DeadlineCalculationService {
    constructor(private prisma: PrismaService) { }

    // CACHED HOLIDAYS (In-memory optimization for MVP, 
    // real app should use Redis or Request-Scoped cache)
    private holidaysCache: Date[] = [];

    async preloadHolidays(year: number, jurisdiction: string) {
        // Fetch all holidays for the year to avoid N+1
        const holidays = await this.prisma.calendarioJudicial.findMany({
            where: { jurisdiccion: jurisdiction } // Filter by Year in prod
        });
        this.holidaysCache = holidays.map(h => h.fecha);
    }

    private isHoliday(date: Date): boolean {
        return this.holidaysCache.some(h => isSameDay(h, date));
    }

    async calculateDeadline(req: DeadlineRequest): Promise<DeadlineResult> {
        let cursor = new Date(req.fechaNotificacion);

        // Ensure cache is loaded (basic impl)
        if (this.holidaysCache.length === 0) {
            await this.preloadHolidays(cursor.getFullYear(), req.jurisdiction);
        }

        // Rule: Plazo runs from next day of "Nota" (simplified as next day of notification)
        cursor = addDays(cursor, 1);

        let daysCounted = 0;

        while (daysCounted < req.deadlineDays) {
            const isNonWorking = isWeekend(cursor) || this.isHoliday(cursor);

            if (req.deadlineType === 'DIAS_HABILES') {
                if (!isNonWorking) {
                    daysCounted++;
                }
            } else {
                // DIAS CORRIDOS: Count always, but check expiration later
                daysCounted++;
            }

            if (daysCounted < req.deadlineDays) {
                cursor = addDays(cursor, 1);
            }
        }

        // Final Adjustment: If expiration falls on Non-Working day, move to next working
        while (isWeekend(cursor) || this.isHoliday(cursor)) {
            cursor = addDays(cursor, 1);
        }

        // Grace Period Rule (Cargo de Hora)
        const graceDate = addBusinessDays(cursor, 1); // Simplified business day add
        graceDate.setHours(9, 30, 0, 0);

        return {
            deadlineDate: graceDate,
            isGracePeriod: true,
            details: `Vencimiento calculado para ${format(cursor, 'yyyy-MM-dd')} (Final plazo). Se aplica cargo de hora hasta ${format(graceDate, 'yyyy-MM-dd HH:mm')}`
        };
    }

    guessDeadlineFromText(text: string): Partial<DeadlineRequest> {
        const textUpper = text.toUpperCase();

        if (textUpper.includes('TRASLADO') && textUpper.includes('DEMANDA')) {
            return {
                processType: 'ORDINARIO',
                deadlineDays: 15,
                deadlineType: 'DIAS_HABILES'
            };
        }
        if (textUpper.includes('INTIMACION DE PAGO')) {
            return {
                processType: 'EJECUTIVO',
                deadlineDays: 5,
                deadlineType: 'DIAS_HABILES'
            };
        }

        return {
            deadlineDays: 5,
            deadlineType: 'DIAS_HABILES'
        };
    }
}
