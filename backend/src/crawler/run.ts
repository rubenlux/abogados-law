
import { createBrowser } from './core/browser';
import { scrapeCSJN } from './sources/csjn';

async function run() {
    console.log("🚀 Starting CSJN Crawler...");
    const browser = await createBrowser();
    const page = await browser.newPage();

    try {
        const cases = await scrapeCSJN(page, 'daños');

        console.log(`\n✅ Casos encontrados: ${cases.length}\n`);

        if (cases.length > 0) {
            console.log('📋 Primeros 3 resultados:\n');
            cases.slice(0, 3).forEach((c, i) => {
                console.log(`${i + 1}. ${c.title}`);
                console.log(`   Fecha: ${c.date}`);
                console.log(`   Sumario: ${c.summary.substring(0, 100)}...`);
                console.log(`   URL: ${c.url}\n`);
            });

            // Guardar JSON completo
            const fs = require('fs');
            fs.writeFileSync('csjn-results.json', JSON.stringify(cases, null, 2));
            console.log('💾 Resultados guardados en: csjn-results.json');
        } else {
            console.log("⚠️ No se encontraron casos.");
        }
    } catch (error) {
        console.error("❌ Error running scraper:", error);
    } finally {
        await browser.close();
    }
}

run();
