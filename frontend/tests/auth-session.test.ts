import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_SRC_DIR = path.resolve(__dirname, '../src');

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

interface CapturedCall {
  url: string;
  init: RequestInit;
}

describe('TDS — AUTH-LOCAL-DEMO-SESSION-FIX-001 (Frontend BFF Demo Login & 401 Handling)', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

  let calls: CapturedCall[] = [];
  let storageMap: Map<string, string>;
  let currentPathname = '/';
  let lastRedirectHref: string | null = null;
  let redirectCount = 0;

  const setupBrowserGlobals = (pathname = '/', cookie = '') => {
    storageMap = new Map<string, string>();
    currentPathname = pathname;
    lastRedirectHref = null;
    redirectCount = 0;

    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storageMap.set(k, String(v));
      },
      removeItem: (k: string) => {
        storageMap.delete(k);
      },
      clear: () => storageMap.clear(),
    };

    (globalThis as { document?: unknown }).document = {
      cookie,
    };

    const locationObj = {
      get pathname() {
        return currentPathname;
      },
      set pathname(val: string) {
        currentPathname = val;
      },
      get href() {
        return `http://localhost:5173${currentPathname}`;
      },
      set href(val: string) {
        lastRedirectHref = val;
        redirectCount += 1;
        currentPathname = val.startsWith('http') ? new URL(val).pathname : val;
      },
    };

    (globalThis as { window?: unknown }).window = {
      location: locationObj,
      localStorage: (globalThis as { localStorage?: unknown }).localStorage,
    };
  };

  beforeEach(() => {
    calls = [];
    setupBrowserGlobals('/', '');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = originalDocument;
    }
    if (originalLocalStorage === undefined) {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    } else {
      (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
    }
  });

  it('TDS-FE-001: No existe demo-token ni credenciales hardcodeadas de bypass en frontend/src', () => {
    const files = collectSourceFiles(FRONTEND_SRC_DIR);
    assert.ok(files.length > 0);
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(
        text.includes('demo-token'),
        false,
        `Forbidden "demo-token" found in ${file}`,
      );
      assert.equal(
        text.includes('demo-refresh'),
        false,
        `Forbidden "demo-refresh" found in ${file}`,
      );
      assert.equal(
        text.includes('hash123'),
        false,
        `Forbidden dev backdoor "hash123" found in ${file}`,
      );
    }
  });

  it('TDS-FE-002: Login Demo exitoso invoca POST /api/auth/local-demo-login con credentials include y actualiza sesión sin localStorage token', async () => {
    setupBrowserGlobals('/login', '');

    const { apiClient } = await import('../src/core/api/client.ts');
    const { useAuthStore } = await import('../src/core/store/useAuthStore.ts');
    useAuthStore.getState().logout();

    assert.equal(typeof (apiClient.auth as Record<string, unknown>).loginLocalDemo, 'function');

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          status: 'authenticated',
          user: {
            id: 'usr-demo-1',
            email: 'socio.demo@estudio.local',
            fullName: 'Dr. Socio Demo',
            orgRole: 'ORG_ADMIN',
          },
          organization: {
            id: 'org-demo-1',
            name: 'Estudio Jurídico Demo',
            status: 'ACTIVE',
          },
          activeOrganizationId: 'org-demo-1',
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await (apiClient.auth as unknown as {
      loginLocalDemo: () => Promise<{
        status: string;
        user: { id: string; email: string; fullName: string; orgRole: string };
        organization: { id: string; name: string; status: string };
      }>;
    }).loginLocalDemo();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:3000/api/auth/local-demo-login');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[0].init.body, undefined);
    assert.equal(result.status, 'authenticated');

    useAuthStore.getState().setSession(
      {
        id: result.user.id,
        email: result.user.email,
        name: result.user.fullName,
        role: result.user.orgRole,
      },
      result.organization,
    );

    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(storageMap.get('token'), undefined);
    assert.equal(storageMap.get('refreshToken'), undefined);
  });

  it('TDS-FE-003: Login Demo fallido (404/403/red) propaga error, mantiene isAuthenticated=false y no dispara logout recursivo', async () => {
    setupBrowserGlobals('/login', '');

    const { apiClient } = await import('../src/core/api/client.ts');
    const { useAuthStore } = await import('../src/core/store/useAuthStore.ts');
    useAuthStore.getState().logout();

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({ message: 'Local demo login disabled' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await (apiClient.auth as unknown as { loginLocalDemo: () => Promise<unknown> }).loginLocalDemo();
      },
      /Local demo login disabled|Request failed|No disponible/i,
    );

    assert.equal(useAuthStore.getState().isAuthenticated, false);
    assert.equal(redirectCount, 0);
  });

  it('TDS-FE-004: Acceso a Clientes, Expedientes, Documentos, Agenda, Generador de Escritos y Asistente IA funciona sin logout ni Bearer demo-token', async () => {
    setupBrowserGlobals('/', 'csrf_token=1234567890abcdef1234567890abcdef.abcdef1234567890');

    const { apiClient } = await import('../src/core/api/client.ts');
    const { useAuthStore } = await import('../src/core/store/useAuthStore.ts');
    useAuthStore.getState().setSession(
      {
        id: 'usr-demo-1',
        email: 'socio.demo@estudio.local',
        name: 'Dr. Socio Demo',
        role: 'ORG_ADMIN',
      },
      { id: 'org-demo-1', name: 'Estudio Jurídico Demo', status: 'ACTIVE' },
    );

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ items: [], status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await apiClient.clients.findAll();
    await apiClient.expedientes.findAll();
    await apiClient.documents.findAll();
    await apiClient.agendaActividades.findAll();
    await apiClient.legalDrafts.getCatalog();
    await apiClient.legalAi.getStatus();

    assert.equal(calls.length, 6);
    for (const c of calls) {
      assert.equal(c.init.credentials, 'include');
      const headers = (c.init.headers ?? {}) as Record<string, string>;
      assert.equal(headers['Authorization'], undefined);
      assert.ok(headers['X-CSRF-Token']);
    }
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(redirectCount, 0);
  });

  it('TDS-FE-005: 401 de sesión inválida dispara logout controlado y evita ciclos de redirección en /login', async () => {
    setupBrowserGlobals('/ia-legal/asistente', 'csrf_token=tok.sig');

    const { apiClient } = await import('../src/core/api/client.ts');
    const { useAuthStore } = await import('../src/core/store/useAuthStore.ts');
    useAuthStore.getState().setSession(
      {
        id: 'usr-demo-1',
        email: 'socio.demo@estudio.local',
        name: 'Dr. Socio Demo',
        role: 'ORG_ADMIN',
      },
      { id: 'org-demo-1', name: 'Estudio Jurídico Demo', status: 'ACTIVE' },
    );

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await assert.rejects(async () => {
      await apiClient.legalAi.getStatus();
    });

    assert.equal(useAuthStore.getState().isAuthenticated, false);
    assert.equal(lastRedirectHref, '/login');
    assert.equal(redirectCount, 1);

    // Ya estando en /login, un segundo 401 no debe volver a redirigir en ciclo
    await assert.rejects(async () => {
      await apiClient.clients.findAll();
    });
    assert.equal(redirectCount, 1);
  });

  it('TDS-FE-006: 403 Forbidden conserva la sesión sin logout y propaga error de acceso denegado', async () => {
    setupBrowserGlobals('/expedientes', 'csrf_token=tok.sig');

    const { apiClient } = await import('../src/core/api/client.ts');
    const { useAuthStore } = await import('../src/core/store/useAuthStore.ts');
    useAuthStore.getState().setSession(
      {
        id: 'usr-demo-1',
        email: 'socio.demo@estudio.local',
        name: 'Dr. Socio Demo',
        role: 'LAWYER',
      },
      { id: 'org-demo-1', name: 'Estudio Jurídico Demo', status: 'ACTIVE' },
    );

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Acceso denegado: permisos insuficientes' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await assert.rejects(
      async () => {
        await apiClient.expedientes.archive('exp-1');
      },
      /Acceso denegado|permisos insuficientes/i,
    );

    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(redirectCount, 0);
  });

  it('TDS-FE-007: Error de red o timeout conserva la sesión sin ejecutar logout', async () => {
    setupBrowserGlobals('/ia-legal/generador-escritos', 'csrf_token=tok.sig');

    const { apiClient } = await import('../src/core/api/client.ts');
    const { useAuthStore } = await import('../src/core/store/useAuthStore.ts');
    useAuthStore.getState().setSession(
      {
        id: 'usr-demo-1',
        email: 'socio.demo@estudio.local',
        name: 'Dr. Socio Demo',
        role: 'ORG_ADMIN',
      },
      { id: 'org-demo-1', name: 'Estudio Jurídico Demo', status: 'ACTIVE' },
    );

    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    await assert.rejects(async () => {
      await apiClient.legalDrafts.getCatalog();
    }, /Failed to fetch/);

    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(redirectCount, 0);
  });
});
