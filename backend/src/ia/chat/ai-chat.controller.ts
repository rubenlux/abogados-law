
import { Controller, Post, Get, Body, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AIChatService } from './ai-chat.service';

@ApiTags('IA Chat')
@Controller('ai/chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIChatController {
    constructor(private chatService: AIChatService) { }

    @Post(':expedienteId')
    @ApiOperation({ summary: 'Enviar mensaje al asistente legal sobre un expediente específico' })
    async chat(
        @Param('expedienteId') expedienteId: string,
        @Body() body: { message: string },
        @Request() req
    ) {
        return this.chatService.chat(expedienteId, req.user.userId, body.message);
    }

    @Get(':expedienteId/history')
    @ApiOperation({ summary: 'Obtener historial de chat del expediente' })
    async getHistory(@Param('expedienteId') expedienteId: string, @Request() req) {
        return this.chatService.getSessionHistory(expedienteId, req.user.userId);
    }

    @Delete(':expedienteId/history')
    @ApiOperation({ summary: 'Borrar memoria del chat' })
    async clearHistory(@Param('expedienteId') expedienteId: string, @Request() req) {
        return this.chatService.clearHistory(expedienteId, req.user.userId);
    }
}
