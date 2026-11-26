import CryptoJS from 'crypto-js';
import { API_URL } from '../config/api.ts';

export type EventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VIEW_PAGE'
  | 'VIEW_EXPEDIENTE'
  | 'GENERATE_DOC'
  | 'AI_PROMPT'
  | 'EXPORT_DATA'
  | 'ERROR_BOUNDARY';

export interface EventPayload {
  [key: string]: unknown;
}

export interface LegalPixelConfig {
  apiUrl?: string;
  pixelKey?: string;
  dedupeWindowMs?: number;
}

const DEFAULT_DEDUPE_WINDOW_MS = 1000;

function readEnvPixelKey(): string {
  const viteEnv = (
    import.meta as { env?: Record<string, string | undefined> }
  ).env;
  return viteEnv?.VITE_PIXEL_KEY?.trim() || '';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }
  const cookies = document.cookie.split(';');
  for (const raw of cookies) {
    const idx = raw.indexOf('=');
    if (idx === -1) continue;
    const key = raw.slice(0, idx).trim();
    if (key === name) {
      const value = raw.slice(idx + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

class LegalPixelClass {
  private apiUrl: string = API_URL;
  private pixelKey: string = readEnvPixelKey();
  private dedupeWindowMs: number = DEFAULT_DEDUPE_WINDOW_MS;
  private lastEventKey: string | null = null;
  private lastEventAt = 0;

  public configure(config: LegalPixelConfig): void {
    if (config.apiUrl !== undefined) {
      this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    }
    if (config.pixelKey !== undefined) {
      this.pixelKey = config.pixelKey.trim();
    }
    if (config.dedupeWindowMs !== undefined) {
      this.dedupeWindowMs = Math.max(0, config.dedupeWindowMs);
    }
  }

  public resetForTests(): void {
    this.apiUrl = API_URL;
    this.pixelKey = readEnvPixelKey();
    this.dedupeWindowMs = DEFAULT_DEDUPE_WINDOW_MS;
    this.lastEventKey = null;
    this.lastEventAt = 0;
  }

  public track(
    eventType: EventType,
    payload?: EventPayload,
    entityId?: string,
  ): void {
    try {
      // Deduplicar eventos idénticos consecutivos (ej. doble invocación en React StrictMode)
      const dedupeKey = `${eventType}|${entityId ?? ''}|${JSON.stringify(payload ?? null)}`;
      const now = Date.now();
      if (
        this.lastEventKey === dedupeKey &&
        now - this.lastEventAt < this.dedupeWindowMs
      ) {
        return;
      }
      this.lastEventKey = dedupeKey;
      this.lastEventAt = now;

      // Requiere sesión BFF válida (evidencia cliente: cookie anti-CSRF emitida por BffController)
      const csrfToken = readCookie('csrf_token');
      if (!csrfToken) {
        return;
      }

      // Requiere secreto HMAC configurado explícitamente (sin fallback inseguro)
      if (!this.pixelKey) {
        return;
      }

      // Payload conforme al contrato real de POST /events/collect:
      // NO incluye organizationId ni actorId manipulables (se derivan de req.orgContext en el servidor)
      const eventBody: Record<string, unknown> = {
        actorType: 'USER',
        eventType,
        ...(entityId ? { entityId } : {}),
        ...(payload ? { payload } : {}),
        timestamp: new Date().toISOString(),
      };

      void this.send(eventBody, csrfToken);
    } catch {
      // Telemetría auxiliar: nunca debe lanzar excepciones ni bloquear la UI
    }
  }

  private async send(
    eventData: Record<string, unknown>,
    csrfToken: string,
  ): Promise<void> {
    try {
      const timestamp = String(Date.now());
      const nonce =
        Math.random().toString(36).substring(2) + Date.now().toString(36);
      const bodyString = JSON.stringify(eventData);

      // Contrato PixelGuard: HMAC-SHA256(secret, (x-org-id || "") + timestamp + nonce + bodyString)
      // Sin cabecera X-Org-Id para respetar ActiveOrgContextGuard
      const signaturePayload = '' + timestamp + nonce + bodyString;
      const signature = CryptoJS.HmacSHA256(
        signaturePayload,
        this.pixelKey,
      ).toString();

      await fetch(`${this.apiUrl}/events/collect`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          'X-Timestamp': timestamp,
          'X-Nonce': nonce,
          'X-Signature': signature,
        },
        body: bodyString,
        keepalive: true,
      });
    } catch {
      // Falla silenciosa: sin reintentos infinitos y sin contaminar la consola cuando el backend no responde
    }
  }
}

export const LegalPixel = new LegalPixelClass();
