
import { Module } from '@nestjs/common';
import { IAService } from './ia.service';
import { IAController } from './ia.controller';
import { DeadlineCalculationService } from './engine/deadline-calculator.service';
import { EmbeddingService } from './nlu/embedding.service';
import { TextNormalizationService } from './nlu/text-normalization.service';
import { LegalIngestionService } from './legal/legal-ingestion.service';
import { LegalSearchService } from './legal/legal-search.service';
import { LegalController } from './legal/legal.controller';
import { JurisprudenceChunkingService } from './jurisprudence/jurisprudence-chunking.service';
import { JurisprudenceRankingService } from './jurisprudence/jurisprudence-ranking.service';
import { JurisprudenceIngestionService } from './jurisprudence/jurisprudence-ingestion.service';
import { JurisprudenceSearchService } from './jurisprudence/jurisprudence-search.service';
import { JurisprudenceCrawlerService } from './jurisprudence/jurisprudence-crawler.service';
import { JurisprudenceController } from './jurisprudence/jurisprudence.controller';
import { AIChatController } from './chat/ai-chat.controller';
import { AIChatService } from './chat/ai-chat.service';
import { ChatContextService } from './chat/chat-context.service';
import { DraftingController } from './drafting/drafting.controller';
import { DraftingService } from './drafting/drafting.service';
import { LegalRiskController } from './risk/legal-risk.controller';
import { LegalRiskService } from './risk/legal-risk.service';
import { PrismaService } from '../prisma.service';

@Module({
    controllers: [
        IAController,
        LegalController,
        JurisprudenceController,
        AIChatController,
        DraftingController,
        LegalRiskController
    ],
    providers: [
        IAService,
        DeadlineCalculationService,
        EmbeddingService,
        TextNormalizationService,
        LegalIngestionService,
        LegalSearchService,
        JurisprudenceChunkingService,
        JurisprudenceRankingService,
        JurisprudenceIngestionService,
        JurisprudenceSearchService,
        AIChatService,
        ChatContextService,
        DraftingService,
        LegalRiskService,
        JurisprudenceCrawlerService,
        PrismaService
    ],
    exports: [
        IAService,
        LegalSearchService,
        JurisprudenceSearchService,
        AIChatService
    ]
})
export class IAModule { }
