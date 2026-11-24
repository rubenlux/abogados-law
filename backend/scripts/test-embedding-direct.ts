import { OpenAIEmbeddings } from '@langchain/openai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testEmbedding() {
    try {
        console.log('🔑 API Key presente:', !!process.env.OPENAI_API_KEY);
        console.log('🔑 API Key (primeros 10 chars):', process.env.OPENAI_API_KEY?.substring(0, 10));

        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: 'text-embedding-3-small',
        });

        console.log('\n📝 Generando embedding...');
        const result = await embeddings.embedQuery('Test de embedding');

        console.log('✅ Embedding generado!');
        console.log('📊 Dimensiones:', result.length);
        console.log('📊 Primeros 5 valores:', result.slice(0, 5));

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('Stack:', error.stack);
    }
}

testEmbedding();
