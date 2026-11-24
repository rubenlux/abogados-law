
import { Module } from '@nestjs/common';
import { AdminMasterController } from './admin-master.controller';
import { UsageControlService } from './usage-control.service';
import { PrismaService } from '../prisma.service';

import { AdminApiController } from './admin-api.controller';
import { AdminDataService } from './admin-data.service';

@Module({
    controllers: [AdminMasterController, AdminApiController],
    providers: [UsageControlService, PrismaService, AdminDataService],
    exports: [UsageControlService]
})
export class AdminModule { }
