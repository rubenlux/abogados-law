
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LegalTemplate } from '@prisma/client';

@Injectable()
export class TemplatesService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string; content: string; variables: string[]; category?: string; organizationId: string }) {
        return this.prisma.legalTemplate.create({
            data: {
                name: data.name,
                content: data.content,
                variables: data.variables,
                category: data.category,
                organizationId: data.organizationId
            }
        });
    }

    async findAll(organizationId: string) {
        return this.prisma.legalTemplate.findMany({
            where: { organizationId, isActive: true }
        });
    }

    async findOne(id: string) {
        return this.prisma.legalTemplate.findUnique({ where: { id } });
    }

    /**
     * Renderiza una plantilla reemplazando variables {{key}} con valores
     */
    async generateDocument(id: string, values: Record<string, string>) {
        const template = await this.findOne(id);
        if (!template) throw new NotFoundException('Template not found');

        let content = template.content;

        // Reemplazo simple de variables
        // En prod usar un motor como Handlebars
        Object.keys(values).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            content = content.replace(regex, values[key]);
        });

        // Verificación de variables faltantes
        const missingVars = template.variables
            // @ts-ignore
            .filter((v: string) => !values[v] && content.includes(`{{${v}}}`));

        return {
            content,
            missingVariables: missingVars,
            templateName: template.name
        };
    }
}
