import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { LegalPixel } from '../src/core/analytics/LegalPixel.ts';

interface CapturedFetchCall {
  url: string;
  init: RequestInit;
}

describe('TDS — LegalPixel Frontend Telemetry Remediation (FRONTEND-LEGALPIXEL-CONNECTION-REMEDIATION-001)', () => {
  const TEST_PIXEL_SECRET = 'test-pixel-hmac-secret-minimum-32-chars-long!!';
  const TEST_CSRF_TOKEN = 'valid-csrf-token-from-bff-cookie';
  const originalFetch = globalThis.fetch;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  let fetchCalls: CapturedFetchCall[] = [];
  let consoleErrors: unknown[][] = [];
  let fetchMode: 'ok' | 'network_error' | 'http_503' = 'ok';

  const setMockCookie = (cookieStr: string) => {
    (globalThis as { document?: { cookie: string } }).document = {
      cookie: cookieStr,
    };
  };

  beforeEach(() => {
    fetchCalls = [];
    consoleErrors = [];
    fetchMode = 'ok';

    // Reset singleton state if reset/configure exists
    const lp = LegalPixel as unknown as {
      configure?: (opts: {
        apiUrl?: string;
        pixelKey?: string;
        dedupeWindowMs?: number;
      }) => void;
      resetForTests?: () => void;
    };
    lp.resetForTests?.();
    lp.configure?.({
      apiUrl: 'http://localhost:3000',
      pixelKey: TEST_PIXEL_SECRET,
      dedupeWindowMs: 1000,
    });

    setMockCookie('');

    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };
    console.log = () => {
      // silence
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), init: init ?? {} });
      if (fetchMode === 'network_error') {
        throw new TypeError('Failed to fetch');
      }
      if (fetchMode === 'http_503') {
        return new Response(JSON.stringify({ message: 'Service Unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 201,
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
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  it('TDS-LP-001: No bloquea el renderizado/navegación si el backend está detenido', async () => {
    setMockCookie(`csrf_token=${TEST_CSRF_TOKEN}`);
    fetchMode = 'network_error';

    let threw = false;
    try {
      const result = LegalPixel.track('VIEW_PAGE', { path: '/dashboard' });
      assert.equal(result, undefined);
    } catch {
      threw = true;
    }
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(threw, false);
  });

  it('TDS-LP-002: La falla de fetch (ERR_CONNECTION_REFUSED) no produce errores no controlados ni contamina console.error', async () => {
    setMockCookie(`csrf_token=${TEST_CSRF_TOKEN}`);
    fetchMode = 'network_error';

    LegalPixel.track('VIEW_PAGE', { path: '/clientes' });
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(
      consoleErrors.length,
      0,
      `Expected 0 console.error calls on network failure, got ${consoleErrors.length}`,
    );
  });

  it('TDS-LP-003: No envía eventos protegidos si no existe sesión BFF válida (sin cookie csrf_token)', async () => {
    setMockCookie(''); // Sin cookie BFF csrf_token (ej: login o sesión demo)

    LegalPixel.track('VIEW_PAGE', { path: '/dashboard' });
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(
      fetchCalls.length,
      0,
      `Expected 0 fetch calls without BFF csrf_token cookie, got ${fetchCalls.length}`,
    );
  });

  it('TDS-LP-004: El payload y la firma HMAC cumplen exactamente el contrato de POST /events/collect', async () => {
    setMockCookie(`csrf_token=${TEST_CSRF_TOKEN}`);

    LegalPixel.track('VIEW_EXPEDIENTE', { path: '/expedientes/exp-1' }, 'exp-1');
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(fetchCalls.length, 1);
    const call = fetchCalls[0];
    assert.equal(call.url, 'http://localhost:3000/events/collect');
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.credentials, 'include');

    const headers = call.init.headers as Record<string, string>;
    const bodyString = String(call.init.body);
    const parsedBody = JSON.parse(bodyString);

    assert.equal(parsedBody.eventType, 'VIEW_EXPEDIENTE');
    assert.equal(parsedBody.entityId, 'exp-1');
    assert.deepEqual(parsedBody.payload, { path: '/expedientes/exp-1' });
    assert.equal(parsedBody.actorType, 'USER');

    // Verificar firma HMAC compatible con PixelGuard: (orgId || "") + timestamp + nonce + bodyString
    const ts = headers['X-Timestamp'];
    const nonce = headers['X-Nonce'];
    const sig = headers['X-Signature'];
    assert.ok(ts, 'X-Timestamp header must be present');
    assert.ok(nonce, 'X-Nonce header must be present');
    assert.ok(sig, 'X-Signature header must be present');

    const expectedSig = crypto
      .createHmac('sha256', TEST_PIXEL_SECRET)
      .update('' + ts + nonce + bodyString)
      .digest('hex');
    assert.equal(sig, expectedSig);
  });

  it('TDS-LP-005: No envía organizationId manipulable en el body ni en X-Org-Id', async () => {
    setMockCookie(`csrf_token=${TEST_CSRF_TOKEN}`);

    LegalPixel.track('VIEW_PAGE', { path: '/expedientes' });
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(fetchCalls.length, 1);
    const call = fetchCalls[0];
    const headers = call.init.headers as Record<string, string>;
    const parsedBody = JSON.parse(String(call.init.body));

    assert.equal(
      'organizationId' in parsedBody,
      false,
      'Body must NOT include manipulable organizationId',
    );
    assert.equal(
      headers['X-Org-Id'],
      undefined,
      'Headers must NOT include X-Org-Id',
    );
    assert.equal(
      headers['X-Organization-Id'],
      undefined,
      'Headers must NOT include X-Organization-Id',
    );
  });

  it('TDS-LP-006: Incluye X-CSRF-Token de la cookie BFF y credentials: include', async () => {
    setMockCookie(`other=1; csrf_token=${encodeURIComponent(TEST_CSRF_TOKEN)}; theme=dark`);

    LegalPixel.track('VIEW_PAGE', { path: '/agenda' });
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(fetchCalls.length, 1);
    const call = fetchCalls[0];
    const headers = call.init.headers as Record<string, string>;

    assert.equal(call.init.credentials, 'include');
    assert.equal(headers['X-CSRF-Token'], TEST_CSRF_TOKEN);
  });

  it('TDS-LP-007: Evita envíos duplicados consecutivos en inicialización (React StrictMode)', async () => {
    setMockCookie(`csrf_token=${TEST_CSRF_TOKEN}`);

    // Simula doble invocación de useEffect en React StrictMode para la misma ruta
    LegalPixel.track('VIEW_PAGE', { path: '/dashboard' });
    LegalPixel.track('VIEW_PAGE', { path: '/dashboard' });
    await new Promise((r) => setTimeout(r, 30));

    assert.equal(
      fetchCalls.length,
      1,
      `Expected deduplicated 1 fetch call under StrictMode double-invoke, got ${fetchCalls.length}`,
    );
  });

  it('TDS-LP-009: El frontend continúa operando sin errores ni reintentos infinitos si analytics devuelve 503', async () => {
    setMockCookie(`csrf_token=${TEST_CSRF_TOKEN}`);
    fetchMode = 'http_503';

    LegalPixel.track('VIEW_PAGE', { path: '/clientes' });
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(fetchCalls.length, 1, 'Must not perform infinite retries on 503');
    assert.equal(consoleErrors.length, 0, 'Must fail silently without console.error');
  });
});

