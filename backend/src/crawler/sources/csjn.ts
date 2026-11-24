import { Page } from 'playwright';

export interface CSJNCase {
    title: string;
    date: string;
    summary: string;
    url: string;
    fullText?: string;
}

export async function scrapeCSJN(page: Page, query: string): Promise<CSJNCase[]> {
    console.log('Navigating to CSJN...');
    try {
        await page.goto('https://sjconsulta.csjn.gov.ar/sjconsulta/consultaSumarios/consulta.html', { waitUntil: 'load', timeout: 60000 });
    } catch (e) {
        console.error('❌ Error loading CSJN search page:', e);
        return [];
    }

    console.log(`Searching for: ${query}`);

    // Fill search form (incluir fecha para evitar "demasiados resultados")
    try {
        await page.waitForSelector('#texto', { state: 'visible', timeout: 30000 });
        await page.fill('#texto', query);

        // Agregar filtro de fecha (últimos 3 años) para asegurar resultados relevantes pero no históricos
        const currentDate = new Date();
        const startYear = currentDate.getFullYear() - 3;
        const dateStr = `01/01/${startYear}`; // Ejemplo: 01/01/2023

        await page.fill('#fechaDesde', dateStr);
        console.log(`Date filter: desde ${dateStr}`);

        await page.click('button.azul');
    } catch (e) {
        console.error('Error filling search form:', e);
        return [];
    }

    console.log('Waiting for results...');

    // Estrategia 1: Esperar a que aparezca el contenedor de resultados
    try {
        await page.waitForSelector('#tbSumarios', { timeout: 15000 });
        console.log('✓ Results container found');
    } catch (e) {
        console.log('❌ Results container #tbSumarios not found');
        return [];
    }

    // Estrategia 2: Esperar un poco más para que se carguen los paneles
    await page.waitForTimeout(2000);

    // Verificar si hay paneles
    const panelCount = await page.$$eval('#tbSumarios .panel.panel-default', panels => panels.length);
    console.log(`Found ${panelCount} panels`);

    if (panelCount === 0) {
        console.log('❌ No result panels found');
        return [];
    }

    // Extracción inicial de la lista
    const cases = await page.evaluate(() => {
        const container = document.querySelector('#tbSumarios');
        if (!container) return [];

        const panels = Array.from(container.querySelectorAll('.panel.panel-default'));

        return panels
            .filter(panel => panel.querySelector('.panel-body'))
            .map(panel => {
                const titleElement = panel.querySelector('b');
                const title = titleElement?.textContent?.trim() || '';

                const summaryElement = panel.querySelector('.cuerpo');
                const summary = summaryElement?.textContent?.trim() || '';

                const fullTextContent = panel.textContent || '';
                const dateMatch = fullTextContent.match(/(\d{2}\/\d{2}\/\d{4})/);
                const date = dateMatch ? dateMatch[0] : 'S/F';

                let url = '';
                let falloButton = panel.querySelector('button[title="Ver Fallo"]');

                if (!falloButton) {
                    const allButtons = Array.from(panel.querySelectorAll('button'));
                    falloButton = allButtons.find(btn =>
                        btn.textContent?.includes('Fallo') ||
                        btn.getAttribute('title')?.includes('Fallo')
                    ) || null;
                }

                if (falloButton) {
                    const onclick = falloButton.getAttribute('onclick');
                    if (onclick) {
                        const pathMatch = onclick.match(/verFallo\(["']([^"']+)["']\)/);
                        if (pathMatch) {
                            let path = pathMatch[1];
                            // CORRECCIÓN CRITICA: El path ya suele traer '/documentos/...'
                            // La URL que funciona es https://sjconsulta.csjn.gov.ar/sjconsulta/documentos/...
                            if (path.startsWith('/documentos')) {
                                path = '/sjconsulta' + path;
                            }
                            url = `https://sjconsulta.csjn.gov.ar${path}`;
                        }
                    }
                }

                return { title, summary, date, url };
            });
    }) as any as CSJNCase[];

    // Filtrar resultados válidos antes de navegar a detalles
    const validCases = cases.filter(c =>
        c.title &&
        c.title.length > 5 &&
        !c.title.toLowerCase().includes('total') &&
        !c.title.match(/^\d+$/) &&
        c.summary &&
        c.summary.length > 20
    );

    console.log(`✓ Found ${validCases.length} valid cases. Fetching detailed content...`);

    // Segunda Fase: Navegar a cada caso para extraer el "Sumario" detallado (HTML)
    const casesToProcess = validCases.slice(0, 5); // Limitamos a 5 para pruebas y velocidad

    for (const c of casesToProcess) {
        if (c.url) {
            console.log(`  Extracting details for: ${c.title.substring(0, 50)}...`);
            console.log(`    URL: ${c.url}`);

            // Usar el mismo contexto para mantener cookies/sesión
            const context = page.context();
            if (!context) {
                console.error('    ❌ No browser context available');
                continue;
            }

            let detailPage;
            try {
                detailPage = await context.newPage();
                // Navegación con retry y timeout aumentado
                try {
                    await detailPage.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                } catch (navErr) {
                    console.log(`    ⚠️ Timeout loading page, trying to proceed anyway...`);
                }

                // Buscar y hacer clic en el botón "Sumarios" en el sidebar usando múltiples estrategias
                // Estrategia 1: Selector por href
                let sumariosBtn = await detailPage.$('a[href="#panelSumarios"]');

                // Estrategia 2: Selector por texto (más robusto)
                if (!sumariosBtn) {
                    const buttons = await detailPage.$$('.btn-link');
                    for (const btn of buttons) {
                        const text = await btn.textContent();
                        if (text && text.includes('Sumarios')) {
                            sumariosBtn = btn;
                            break;
                        }
                    }
                }

                if (sumariosBtn) {
                    await sumariosBtn.click();
                    await detailPage.waitForSelector('.modal-body .panel-body', { timeout: 8000 });

                    const detailedText = await detailPage.evaluate(() => {
                        const panels = Array.from(document.querySelectorAll('.modal-body .panel-body'));
                        return panels.map(p => p.textContent?.trim()).filter(t => t).join('\n\n---\n\n');
                    });

                    if (detailedText && detailedText.length > 50) {
                        c.fullText = detailedText;
                        console.log(`    ✓ Detailed text extracted (${detailedText.length} chars)`);
                    }
                } else {
                    console.log(`    ⚠️ Sumarios link not found, trying Reseña...`);
                    const resenaSelector = 'a[href="#panelResena"], .btn-link:has-text("Reseña")';
                    if (await detailPage.$(resenaSelector)) {
                        await detailPage.click(resenaSelector);
                        await detailPage.waitForTimeout(2000);
                        const resenaText = await detailPage.evaluate(() => {
                            return document.querySelector('.modal-body')?.textContent?.trim();
                        });
                        if (resenaText) {
                            c.fullText = resenaText;
                            console.log(`    ✓ Reseña text extracted`);
                        }
                    }
                }
            } catch (pageErr) {
                console.error(`    ❌ Error loading detail page: ${pageErr.message}`);
            } finally {
                if (detailPage) await detailPage.close();
            }
        }
    }

    console.log(`✓ Processed ${casesToProcess.length} cases with detailed text`);

    return validCases;
}

