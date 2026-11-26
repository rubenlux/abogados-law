import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_SRC = path.resolve(__dirname, '../src');

describe('TDS — AUTH-11 Frontend Análisis IA & Transferencia Controlada AUTH-09', () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = (globalThis as { document?: unknown }).document;
  let calls: Array<{ url: string; init: RequestInit }> = [];

  beforeEach(() => {
    calls = [];
    (globalThis as { document?: unknown }).document = {
      cookie: 'csrf_token=1234567890abcdef1234567890abcdef.abcdef1234567890',
    };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = originalDocument;
    }
  });

  it('TDS-A11-FE-01: apiClient.legalAiAnalyses usa BFF cookies + X-CSRF-Token en todas sus operaciones', async () => {
    const { apiClient } = await import('../src/core/api/client.ts');

    await apiClient.legalAiAnalyses.getStatus();
    await apiClient.legalAiAnalyses.previewSources({ expedienteId: 'exp-1' });
    await apiClient.legalAiAnalyses.create({
      analysisType: 'INTEGRAL_CASE',
      expedienteId: 'exp-1',
    });
    await apiClient.legalAiAnalyses.list({ expedienteId: 'exp-1' });
    await apiClient.legalAiAnalyses.getById('anl-1');
    await apiClient.legalAiAnalyses.update('anl-1', { title: 'Editado' });
    await apiClient.legalAiAnalyses.retry('anl-1');
    await apiClient.legalAiAnalyses.archive('anl-1');

    assert.equal(calls.length, 8);
    for (const c of calls) {
      assert.equal(c.init.credentials, 'include');
      const headers = (c.init.headers ?? {}) as Record<string, string>;
      assert.ok(headers['X-CSRF-Token']);
      assert.equal(headers['Authorization'], undefined);
    }
  });

  it('TDS-A11-FE-02: Análisis IA está habilitado en sidebar y enrutado en App.tsx sin placeholder pendiente', () => {
    const layout = fs.readFileSync(
      path.join(FRONTEND_SRC, 'components/layout/MainLayout.tsx'),
      'utf8',
    );
    const app = fs.readFileSync(path.join(FRONTEND_SRC, 'App.tsx'), 'utf8');

    assert.ok(
      layout.includes("path: '/ia-legal/analisis', pending: false"),
      'Análisis IA must be enabled in MainLayout sidebar',
    );
    assert.ok(
      app.includes('<Route path="/ia-legal/analisis" element={<LegalAiAnalysisPage />} />'),
      'App.tsx must route /ia-legal/analisis to LegalAiAnalysisPage',
    );
  });

  it('TDS-A11-FE-03: Transferencia a AUTH-09 exige confirmación explícita y nunca llama a legalDrafts.create automáticamente', () => {
    const pageSrc = fs.readFileSync(
      path.join(FRONTEND_SRC, 'modules/ia-legal/pages/LegalAiAnalysisPage.tsx'),
      'utf8',
    );
    assert.ok(pageSrc.includes('Usar en Generador de Escritos'));
    assert.ok(pageSrc.includes('Confirmar y abrir Generador'));
    assert.ok(pageSrc.includes("navigate('/ia-legal/generador-escritos'"));
    assert.equal(pageSrc.includes('legalDrafts.create'), false);
    assert.equal(pageSrc.includes('legalDrafts.generateWithAi'), false);
    assert.equal(pageSrc.includes('OPENAI_API_KEY'), false);
    assert.equal(pageSrc.includes('api.openai.com'), false);
  });
});

