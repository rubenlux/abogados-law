
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class TextNormalizationService {
    private readonly logger = new Logger(TextNormalizationService.name);

    /**
     * Normaliza texto legal para embeddings consistentes
     */
    normalize(rawText: string): string {
        let text = rawText;

        // 1. Remover saltos de línea excesivos
        text = text.replace(/\n{3,}/g, '\n\n');

        // 2. Normalizar espacios
        text = text.replace(/\s+/g, ' ');

        // 3. Remover caracteres de control
        text = text.replace(/[\x00-\x1F\x7F]/g, '');

        // 4. Normalizar comillas
        text = text.replace(/[""]/g, '"');
        text = text.replace(/['']/g, "'");

        // 5. Trim
        text = text.trim();

        return text;
    }

    /**
     * Genera checksum SHA256 del texto
     */
    generateChecksum(text: string): string {
        return createHash('sha256').update(text, 'utf8').digest('hex');
    }

    /**
     * Extrae keywords automáticamente (simple)
     */
    extractKeywords(text: string): string[] {
        const stopWords = new Set([
            'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'por', 'con', 'su', 'para',
            'como', 'está', 'lo', 'del', 'los', 'las', 'al', 'una', 'o', 'este', 'esta'
        ]);

        const words = text
            .toLowerCase()
            .replace(/[^\wáéíóúñü\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));

        // Frecuencia
        const freq = new Map<string, number>();
        words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

        // Top 10
        return Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }

    /**
     * Detecta conceptos jurídicos básicos
     */
    detectLegalConcepts(text: string): string[] {
        const concepts = [];
        const lowerText = text.toLowerCase();

        const patterns = {
            'responsabilidad civil': /responsabilidad\s+(civil|extracontractual)/i,
            'responsabilidad contractual': /responsabilidad\s+contractual/i,
            'daños y perjuicios': /daños?\s+(y\s+)?perjuicios?/i,
            'culpa': /culpa|negligencia/i,
            'dolo': /dolo|intención/i,
            'prescripción': /prescripción/i,
            'caducidad': /caducidad/i,
            'nulidad': /nulidad/i,
            'contrato': /contrato/i,
            'obligación': /obligación|obligaciones/i,
            'derecho real': /derecho\s+real/i,
            'posesión': /posesión/i,
            'propiedad': /propiedad/i,
            'sucesión': /sucesión|herencia/i
        };

        for (const [concept, pattern] of Object.entries(patterns)) {
            if (pattern.test(lowerText)) {
                concepts.push(concept);
            }
        }

        return concepts;
    }
}
