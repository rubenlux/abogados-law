
import { Controller, Post, Patch, Get, Param, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { DocumentsService } from './documents.service';
// import { FileInterceptor } from '@nestjs/platform-express'; // Assuming multer is setup

@Controller('documents')
export class DocumentsController {
    constructor(private readonly docsService: DocumentsService) { }

    @Post(':id/versions')
    // @UseInterceptors(FileInterceptor('file'))
    async uploadVersion(@Param('id') id: string, @Body() body: any) {
        // Mocking file upload handling
        const fileData = {
            path: body.path || '/tmp/mock-file.pdf',
            originalName: body.filename || 'document.pdf',
            size: 1024,
            mimetype: 'application/pdf'
        };
        const userId = body.userId || 'system';
        return this.docsService.uploadVersion(id, fileData, userId);
    }

    @Patch(':id/legal-hold')
    async setLegalHold(
        @Param('id') id: string,
        @Body() body: { status: boolean, reason?: string }
    ) {
        return this.docsService.setLegalHold(id, body.status, body.reason);
    }

    @Get('compare/:v1/:v2')
    async compare(@Param('v1') v1: string, @Param('v2') v2: string) {
        return this.docsService.compareVersions(v1, v2);
    }
}
