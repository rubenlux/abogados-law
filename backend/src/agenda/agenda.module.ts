import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { AgendaService } from "./agenda.service";
import { AgendaController } from "./agenda.controller";
import { AgendaEventsService } from "./agenda-events.service";
import { AgendaEventsController } from "./agenda-events.controller";
import { DeadlineCalculatorService } from "./deadline-calculator.service";
import { PrismaService } from "../prisma.service";

@Module({
  imports: [AuthzModule, OrganizationsModule, AuthModule],
  controllers: [AgendaController, AgendaEventsController],
  providers: [
    AgendaService,
    AgendaEventsService,
    DeadlineCalculatorService,
    PrismaService,
  ],
  exports: [AgendaService, AgendaEventsService, DeadlineCalculatorService],
})
export class AgendaModule {}
