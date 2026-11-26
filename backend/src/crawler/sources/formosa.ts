import { Page } from "playwright";

export interface FormosaCase {
  title: string;
  date: string;
  summary: string;
  url: string;
  tribunal: string;
  partes: string;
}

export async function scrapeFormosa(
  page: Page,
  query: string,
): Promise<FormosaCase[]> {
  const url = "https://jusformosa.gob.ar/decisiones-judiciales/jurisprudencia";
  console.log(`Navigating to Formosa Jurisprudence: ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    console.log("Searching for search iframe...");
    // Dar tiempo para que carguen los iframes
    await page.waitForTimeout(5000);

    const frames = page.frames();
    let searchFrame = frames.find(
      (f) => f.url().includes("buscador.php") || f.name().includes("search"),
    );

    if (!searchFrame) {
      console.log(
        "No explicit search frame found by URL, checking all frames for inputs...",
      );
      for (const frame of frames) {
        const input = await frame.$(
          'input[type="text"], input[name*="buscar"]',
        );
        if (input) {
          searchFrame = frame;
          console.log(`Frame found by input presence: ${frame.url()}`);
          break;
        }
      }
    }

    if (searchFrame) {
      console.log("Iframe found, filling search field...");
      await searchFrame.waitForSelector("input", { state: "visible" });
      await searchFrame.fill("input", query);
      await searchFrame.press("input", "Enter");
    } else {
      console.log("No search iframe found, trying top level...");
      const topInput = await page.$("input");
      if (topInput) {
        await topInput.fill(query);
        await topInput.press("Enter");
      } else {
        console.log("Wait, searching link for system entry...");
        const systemLink = await page.$('a:has-text("Ingresar al sistema")');
        if (systemLink) {
          await systemLink.click();
          await page.waitForTimeout(3000);
          // Re-check frames
          const newFrames = page.frames();
          searchFrame = newFrames.find((f) => f.url().includes("buscador.php"));
          if (searchFrame) {
            await searchFrame.fill("input", query);
            await searchFrame.press("input", "Enter");
          }
        }
      }
    }

    console.log("Waiting for results (loading delay)...");
    await page.waitForTimeout(7000);

    const extractFromContext = async (context: any) => {
      return await context.evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll(".result-card, .summary-card"),
        );
        if (cards.length === 0) return [];

        return cards.map((card) => {
          const getField = (labelStr: string) => {
            const fields = Array.from(card.querySelectorAll(".result-field"));
            const found = fields.find((f) =>
              f.querySelector(".label")?.textContent?.includes(labelStr),
            );
            return found?.querySelector(".value")?.textContent?.trim() || "";
          };

          const theme = getField("Tema");
          const summary = getField("Texto");
          const partes = getField("Partes");

          const meta = card.querySelector(".result-meta")?.textContent || "";
          const dateMatch = meta.match(/(\d{2}\/\d{2}\/\d{4})/);
          const tribunalMatch = meta.match(/Tribunal:\s*(.*)/i);

          const link =
            card.querySelector(".result-links a")?.getAttribute("href") || "";
          const fullUrl = link
            ? link.startsWith("http")
              ? link
              : `https://jusformosa.gob.ar/decisiones-judiciales/${link}`
            : "";

          return {
            title: theme || "Sin título",
            summary: summary || "Sin resumen",
            partes: partes || "Sin partes",
            date: dateMatch ? dateMatch[1] : "S/F",
            tribunal: tribunalMatch
              ? tribunalMatch[1].trim()
              : "Poder Judicial Formosa",
            url: fullUrl,
          };
        });
      });
    };

    // Intentar extraer del frame si existe, si no del top level
    let results: FormosaCase[] = [];
    if (searchFrame) {
      console.log("Extracting from iframe...");
      results = await extractFromContext(searchFrame);
    }

    if (results.length === 0) {
      console.log(
        "No results in iframe (or no iframe), trying top level extraction...",
      );
      results = await extractFromContext(page);
    }

    console.log(`Extraction finished. Found ${results.length} cases.`);
    return results;
  } catch (error) {
    console.error("Error scraping Formosa:", error);
    return [];
  }
}
