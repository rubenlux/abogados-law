import { Module } from '@nestjs/common';
import { ExpedientesController } from './expedientes.controller';

import { DocumentsController } from './documents.controller';
import { ExpedientesService } from './expedientes.service';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma.service';

@Module({
    controllers: [ExpedientesController, DocumentsController],
    providers: [ExpedientesService, DocumentsService, PrismaService],
})
export class ExpedientesModule { }
