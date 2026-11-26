import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { addDays, isWeekend, format, parseISO } from "date-fns";

@Injectable()
export class DeadlineCalculatorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculates the deadline date starting from startDate + days.
   * Handles weekends and holidays for the specific jurisdiction.
   */
  async calculateDeadline(
    startDate: Date | string,
    days: number,
    jurisdiccion: string,
    type: "HABIL" | "CORRIDO" = "HABIL",
  ) {
    let current =
      typeof startDate === "string" ? parseISO(startDate) : startDate;
    let count = 0;
    const holidaysEncountered = [];

    // Optimization: Fetch potential holidays for a reasonable range (e.g. days * 2 + 30 buffer)
    // For simplicity in MVP, we might fetch a broader range or per day.
    // Let's fetch next 365 days for that jurisdiction to be safe and cache in memory for this request.

    const rangeEnd = addDays(current, days * 3 + 20); // Rough estimate

    const holidays = await this.prisma.calendarioJudicial.findMany({
      where: {
        jurisdiccion,
        fecha: { gte: current, lte: rangeEnd },
      },
    });

    // Use Set for O(1) lookup
    // Store as YYYY-MM-DD
    const holidaySet = new Set(
      holidays.map((h) => format(h.fecha, "yyyy-MM-dd")),
    );
    const holidayMap = new Map(
      holidays.map((h) => [format(h.fecha, "yyyy-MM-dd"), h.descripcion]),
    );

    while (count < days) {
      current = addDays(current, 1);

      if (type === "CORRIDO") {
        count++;
        continue;
      }

      // HABIL logic
      if (isWeekend(current)) continue;

      const dateStr = format(current, "yyyy-MM-dd");
      if (holidaySet.has(dateStr)) {
        holidaysEncountered.push({
          date: dateStr,
          reason: holidayMap.get(dateStr),
        });
        continue;
      }

      count++;
    }

    // Final check: If the calculated date lands on a non-working day (even if count reached),
    // usually deadlines extend to the next working day.
    // Wait, the rule "count < days" ensures we stepped 'days' WORKING days.
    // So the final 'current' IS a working day (because the loop increments current then checks validity, if valid increments count).
    // Let's trace:
    // Start Mon. Need 1 day.
    // Loop: Current = Tue. Valid? Yes. Count = 1. Stop. Return Tue. Correct.
    // Start Fri. Need 1 day.
    // Loop: Current = Sat. Valid? No.
    // Loop: Current = Sun. Valid? No.
    // Loop: Current = Mon. Valid? Yes. Count = 1. Stop. Return Mon. Correct.

    return {
      deadline: current,
      holidaysPayload: holidaysEncountered,
      isWeekend: isWeekend(current),
    };
  }
}
