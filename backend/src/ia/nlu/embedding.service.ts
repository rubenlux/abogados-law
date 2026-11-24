
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class EmbeddingService {
    private embeddings: OpenAIEmbeddings;
    private readonly logger = new Logger(EmbeddingService.name);
    private readonly hasApiKey: boolean;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.hasApiKey = !!apiKey;

        if (!this.hasApiKey) {
            this.logger.warn('OPENAI_API_KEY not found. RAG will not work correctly.');
        }

        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: apiKey || 'mock-key', // Fail gracefully if no key for dev
            modelName: 'text-embedding-3-small', // Cost-effective
        });
    }

    async getEmbedding(text: string): Promise<number[]> {
        // Mock if no key provided
        if (!this.hasApiKey) {
            return new Array(1536).fill(0).map(() => Math.random());
        }

        try {
            return await this.embeddings.embedQuery(text);
        } catch (error) {
            this.logger.error('Error generating embedding', error);
            throw error;
        }
    }
}
