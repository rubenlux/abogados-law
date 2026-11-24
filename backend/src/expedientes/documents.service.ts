
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Upload or creates a new document version.
     * Calculates SHA256 logic and manages versions.
     */
    async uploadVersion(
        documentId: string,
        fileData: {
            path: string,
            originalName: string,
            size: number,
            mimetype: string,
            buffer?: Buffer // In real impl, use stream or buffer
        },
        userId: string
    ) {

        const document = await this.prisma.documento.findUnique({
            where: { id: documentId },
            include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
        });

        if (!document) throw new NotFoundException('Document not found');
        if (document.isLocked) throw new BadRequestException('Document is locked (WORM compliant)');

        // 1. Calculate Hash (Mocking calculation if no buffer)
        // In prod: const hash = crypto.createHash('sha256').update(fileData.buffer).digest('hex');
        const hash = crypto.createHash('sha256').update(new Date().toISOString()).digest('hex'); // Mock hash

        // 2. Determine Version Number
        const lastVersion = document.versions[0];
        const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

        // 3. Create Version
        const version = await this.prisma.documentVersion.create({
            data: {
                documentId,
                versionNumber: newVersionNumber,
                storagePath: fileData.path,
                fileName: fileData.originalName,
                mimeType: fileData.mimetype,
                fileSize: fileData.size,
                hashSha256: hash,
                uploadedBy: userId,
                // ocrContent could be triggered asynchronously here
            }
        });

        // 4. Update Main Document metadata to point to "current" (or keep generic)
        // We might want to keep the latest hash on the main doc for quick access
        await this.prisma.documento.update({
            where: { id: documentId },
            data: {
                hashSha256: hash,
                fileName: fileData.originalName,
                fileSize: fileData.size
            }
        });

        // 5. Trigger OCR (Async placeholder)
        this.triggerOCR(version.id);

        return version;
    }


    /**
     * Simulate OCR processing
     */
    async triggerOCR(versionId: string) {
        // This would be a job queue in production
        setTimeout(async () => {
            this.logger.log(`Processing OCR for version ${versionId}...`);
            await this.prisma.documentVersion.update({
                where: { id: versionId },
                data: { ocrContent: "Contenido extraído mediante OCR simulado..." }
            });
        }, 2000);
    }

    /**
     * Toggle Legal Hold (Litigation Hold)
     */
    async setLegalHold(documentId: string, status: boolean, reason?: string) {
        return this.prisma.documento.update({
            where: { id: documentId },
            data: {
                legalHold: status,
                legalHoldReason: status ? reason : null
            }
        });
    }

    /**
     * Compare two versions (Simple Text Diff)
     */
    async compareVersions(v1Id: string, v2Id: string) {
        const v1 = await this.prisma.documentVersion.findUnique({ where: { id: v1Id } });
        const v2 = await this.prisma.documentVersion.findUnique({ where: { id: v2Id } });

        if (!v1 || !v2) throw new NotFoundException('Versions not found');

        // This assumes we have text content (e.g. from OCR or text files)
        // For binaries, we can only compare metadata/hash
        if (v1.ocrContent && v2.ocrContent) {
            // Use a diff library here. For now, returning simple equality.
            return {
                identical: v1.hashSha256 === v2.hashSha256,
                v1Size: v1.fileSize,
                v2Size: v2.fileSize,
                diffSummary: v1.hashSha256 === v2.hashSha256 ? "Identical content" : "Content modified"
            };
        }

        return { message: "OCR content not available for comparison" };
    }
}
