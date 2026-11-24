
import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('client-portal')
export class ClientPortalController {
    constructor(private clientService: ClientPortalService) { }

    @Post('login')
    async login(@Body() body: { email: string; cuit: string }) {
        return this.clientService.login(body.email, body.cuit);
    }

    @UseGuards(JwtAuthGuard)
    @Get('cases')
    async getMyCases(@Request() req: any) {
        // Req.user is populated by JwtStrategy
        return this.clientService.getMyCases(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('cases/:id')
    async getCaseDetail(@Request() req: any, @Param('id') id: string) {
        return this.clientService.getCaseDetail(req.user.userId, id);
    }
}
