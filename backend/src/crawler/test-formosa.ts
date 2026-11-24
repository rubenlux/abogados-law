
import { createBrowser } from './core/browser';
import { scrapeFormosa } from './sources/formosa';

async function testFormosa() {
    console.log("🚀 Testing Formosa Scraper...");
    const browser = await createBrowser();
    const page = await browser.newPage();

    try {
        const query = 'accidente';
        const cases = await scrapeFormosa(page, query);

        console.log(`\n✅ Casos encontrados: ${cases.length}\n`);

        if (cases.length > 0) {
            cases.slice(0, 5).forEach((c, i) => {
                console.log(`${i + 1}. ${c.title}`);
                console.log(`   Fecha: ${c.date}`);
                console.log(`   Tribunal: ${c.tribunal}`);
                console.log(`   URL: ${c.url}\n`);
            });
        } else {
            console.log("⚠️ No se encontraron casos. Capturando pantalla para debug...");
            await page.screenshot({ path: 'debug-formosa.png' });
        }
    } catch (error) {
        console.error("❌ Error running scraper test:", error);
    } finally {
        await browser.close();
    }
}

testFormosa();
