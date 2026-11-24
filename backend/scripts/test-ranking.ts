
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { JurisprudenceSearchService } from '../src/ia/jurisprudence/jurisprudence-search.service';

async function testSearch() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const searchService = app.get(JurisprudenceSearchService);

    console.log('🔍 Probando búsqueda semántica con ranking...');

    const queries = [
        {
            query: "accidente de tránsito daño moral",
            limit: 3
        },
        {
            query: "despido multa ley 24.013",
            limit: 3
        }
    ];

    for (const q of queries) {
        console.log(`\n-----------------------------------`);
        console.log(`🧠 Query: "${q.query}"`);
        const data: any = await searchService.search(q);
        const results = data.results || [];

        results.forEach((r: any, i: number) => {
            console.log(`\n#${i + 1} [Score: ${r.rankingScore}] ${r.caratula} (${r.fecha.toISOString().split('T')[0]})`);
            console.log(`   Tribunal: ${r.tribunal} | Similaridad: ${r.similarity.toFixed(4)}`);
            console.log(`   Resumen: ${r.resumen.substring(0, 100)}...`);
        });
    }

    await app.close();
}

testSearch();
