// Basic Fetch Wrapper
import { API_URL } from '../config/api.ts';
import { useAuthStore } from '../store/useAuthStore.ts';

export interface AnalyzeResponse {
    type: string;
    fecha_notificacion: string;
    plazo_detectado: string;
    vencimiento_sugerido: string;
    explicacion_legal: string;
}

export interface BffSessionResponse {
    status: 'authenticated';
    user: {
        id: string;
        email: string;
        fullName: string;
        orgRole?: string | null;
        role?: string | null;
    };
    organization?: {
        id: string;
        name: string;
        status: string;
    } | null;
    activeOrganizationId: string | null;
    expiresAt: string;
}

const readCsrfCookie = (): string | null => {
    if (typeof document === 'undefined' || !document.cookie) return null;
    for (const part of document.cookie.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === 'csrf_token') {
            try {
                return decodeURIComponent(part.slice(idx + 1).trim());
            } catch {
                return part.slice(idx + 1).trim();
            }
        }
    }
    return null;
};

const getHeaders = () => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const csrf = readCsrfCookie();
    if (csrf) {
        headers['X-CSRF-Token'] = csrf;
    }
    return headers;
};

let isHandlingUnauthorized = false;

const handleUnauthorizedSession = () => {
    useAuthStore.getState().logout();
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/login') return;
    if (isHandlingUnauthorized) return;

    isHandlingUnauthorized = true;
    try {
        window.location.href = '/login';
    } finally {
        isHandlingUnauthorized = false;
    }
};

const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = { ...getHeaders(), ...(options.headers as Record<string, string>) };
    const response = await fetch(url, { credentials: 'include', ...options, headers });

    // Solo un 401 confirmado del backend invalida la sesión (nunca errores de red, timeout ni 403)
    if (response.status === 401) {
        handleUnauthorizedSession();
    }

    return response;
};

const handleResponse = async (
    response: Response,
    options?: { skipUnauthorizedHandling?: boolean }
) => {
    if (!response.ok) {
        if (response.status === 401 && !options?.skipUnauthorizedHandling) {
            handleUnauthorizedSession();
        }
        const errorData = await response.json().catch(() => ({}));
        const rawMessage = Array.isArray(errorData.message)
            ? errorData.message.join(', ')
            : errorData.message;
        const fallback =
            response.status === 403
                ? 'Acceso denegado: no cuenta con permisos suficientes'
                : response.status === 401
                  ? 'Sesión inválida o vencida'
                  : 'Request failed';
        const error = new Error(rawMessage || fallback) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    return response.json();
};

export const apiClient = {
    auth: {
        loginLocalDemo: async (): Promise<BffSessionResponse> => {
            const response = await fetch(`${API_URL}/api/auth/local-demo-login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            return handleResponse(response, { skipUnauthorizedHandling: true });
        },
        getSession: async (): Promise<BffSessionResponse | null> => {
            const response = await fetch(`${API_URL}/api/auth/session`, {
                method: 'GET',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            if (response.status === 401) {
                return null;
            }
            return handleResponse(response, { skipUnauthorizedHandling: true });
        },
        login: async (email: string, password: string) => {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            return handleResponse(response, { skipUnauthorizedHandling: true });
        },
        logout: async () => {
            try {
                await fetch(`${API_URL}/api/auth/logout`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: getHeaders(),
                });
            } catch {
                // ignore network error during logout cleanup
            }
            useAuthStore.getState().logout();
        },
    },
    expedientes: {
        findAll: async (query?: {
            search?: string;
            estado?: string;
            fuero?: string;
            jurisdiccion?: string;
            provincia?: string;
            responsableId?: string;
            clientId?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/expedientes${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        update: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        archive: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
        addParte: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}/partes`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        updateParte: async (id: string, parteId: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}/partes/${parteId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        removeParte: async (id: string, parteId: string) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}/partes/${parteId}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
        assignUser: async (id: string, userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}/users`, {
                method: 'POST',
                body: JSON.stringify({ userId }),
            });
            return handleResponse(response);
        },
        unassignUser: async (id: string, userId: string) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes/${id}/users/${userId}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
    },
    clients: {
        findAll: async (query?: { search?: string; status?: string; personType?: string; page?: number; limit?: number }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/clients${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/clients/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/clients`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        update: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/clients/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        archive: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/clients/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
    },
    ia: {
        analyzeDocument: async (text: string): Promise<AnalyzeResponse> => {
            const response = await fetchWithAuth(`${API_URL}/ia/analyze`, {
                method: 'POST',
                body: JSON.stringify({ text }),
            });
            return handleResponse(response);
        },
        ask: async (query: string, context?: string) => {
            const response = await fetchWithAuth(`${API_URL}/ia/ask`, {
                method: 'POST',
                body: JSON.stringify({ query, context }),
            });
            return handleResponse(response);
        }
    },
    jurisprudence: {
        search: async (params: Record<string, unknown>) => {
            // Filter out undefined/null/empty params
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([, v]) => v != null && v !== '')
            );
            const query = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/jurisprudence/search?${query}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/jurisprudence/${id}`);
            return handleResponse(response);
        },
        getStats: async () => {
            const response = await fetchWithAuth(`${API_URL}/jurisprudence/stats`);
            return handleResponse(response);
        },
        importJurisprudence: async (query: string, source: string = 'CSJN') => {
            const response = await fetchWithAuth(`${API_URL}/jurisprudence/import`, {
                method: 'POST',
                body: JSON.stringify({ query, source })
            });
            return handleResponse(response);
        }
    },
    aiChat: {
        sendMessage: async (expedienteId: string, message: string) => {
            const response = await fetchWithAuth(`${API_URL}/ai/chat/${expedienteId}`, {
                method: 'POST',
                body: JSON.stringify({ message }),
            });
            return handleResponse(response);
        },
        getHistory: async (expedienteId: string) => {
            const response = await fetchWithAuth(`${API_URL}/ai/chat/${expedienteId}/history`);
            return handleResponse(response);
        },
        clearHistory: async (expedienteId: string) => {
            const response = await fetchWithAuth(`${API_URL}/ai/chat/${expedienteId}/history`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        }
    },
    agenda: {
        findAll: async (query?: Record<string, string>) => {
            // Convert query obj to URLSearchParams
            const params = new URLSearchParams(query).toString();
            const response = await fetchWithAuth(`${API_URL}/agenda?${params}`);
            return handleResponse(response);
        },
        createEvent: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/eventos`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return handleResponse(response);
        },
        simulateDeadline: async (data: { start: string, days: number, jurisdiccion: string, type?: string }) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/simular-vencimiento`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return handleResponse(response);
        },
        getHolidays: async (jurisdiccion: string, year: number) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/feriados/${jurisdiccion}/${year}`);
            return handleResponse(response);
        }
    },
    movimientos: {
        findAll: async (query?: {
            expedienteId?: string;
            tipo?: string;
            order?: 'asc' | 'desc';
            includeAnulados?: boolean;
            search?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/movimientos${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/movimientos/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/movimientos`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        update: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/movimientos/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        annul: async (id: string, motivo?: string) => {
            const response = await fetchWithAuth(`${API_URL}/movimientos/${id}`, {
                method: 'DELETE',
                body: JSON.stringify(motivo ? { motivo } : {}),
            });
            return handleResponse(response);
        },
    },
    agendaActividades: {
        findAll: async (query?: {
            from?: string;
            to?: string;
            responsableId?: string;
            expedienteId?: string;
            tipo?: string;
            estado?: string;
            search?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/agenda/actividades${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/actividades/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/actividades`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        update: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/actividades/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        complete: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/actividades/${id}/completar`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            return handleResponse(response);
        },
        cancel: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/agenda/actividades/${id}/cancelar`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            return handleResponse(response);
        },
    },
    vencimientos: {
        findAll: async (query?: {
            expedienteId?: string;
            responsableId?: string;
            prioridad?: string;
            estado?: string;
            tipo?: string;
            scope?: 'all' | 'pendientes' | 'proximos' | 'vencidos' | 'cumplidos';
            upcomingDays?: number;
            from?: string;
            to?: string;
            search?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/vencimientos${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/vencimientos/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/vencimientos`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        update: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/vencimientos/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        complete: async (id: string, observaciones?: string) => {
            const response = await fetchWithAuth(`${API_URL}/vencimientos/${id}/cumplir`, {
                method: 'POST',
                body: JSON.stringify(observaciones ? { observaciones } : {}),
            });
            return handleResponse(response);
        },
        cancel: async (id: string, observaciones?: string) => {
            const response = await fetchWithAuth(`${API_URL}/vencimientos/${id}/cancelar`, {
                method: 'POST',
                body: JSON.stringify(observaciones ? { observaciones } : {}),
            });
            return handleResponse(response);
        },
    },
    documents: {
        findAll: async (query?: {
            expedienteId?: string;
            clientId?: string;
            movimientoProcesalId?: string;
            category?: string;
            status?: string;
            search?: string;
            from?: string;
            to?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/documents${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/documents/${id}`);
            return handleResponse(response);
        },
        create: (formData: FormData, onProgress?: (pct: number) => void): Promise<unknown> => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_URL}/documents`, true);
                xhr.withCredentials = true;
                const csrf = readCsrfCookie();
                if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

                xhr.upload.onprogress = (ev) => {
                    if (onProgress && ev.lengthComputable) {
                        onProgress(Math.round((ev.loaded / ev.total) * 100));
                    }
                };
                xhr.onload = () => {
                    let parsed: Record<string, unknown> = {};
                    try {
                        parsed = JSON.parse(xhr.responseText || '{}');
                    } catch {
                        parsed = {};
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(parsed);
                    } else {
                        if (xhr.status === 401) {
                            handleUnauthorizedSession();
                        }
                        const msg = Array.isArray(parsed.message)
                            ? parsed.message.join(', ')
                            : (typeof parsed.message === 'string' ? parsed.message : 'Error al subir documento');
                        reject(new Error(msg));
                    }
                };
                xhr.onerror = () => reject(new Error('Error de red al subir documento'));
                xhr.send(formData);
            });
        },
        uploadVersion: (id: string, formData: FormData, onProgress?: (pct: number) => void): Promise<unknown> => {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_URL}/documents/${id}/versions`, true);
                xhr.withCredentials = true;
                const csrf = readCsrfCookie();
                if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

                xhr.upload.onprogress = (ev) => {
                    if (onProgress && ev.lengthComputable) {
                        onProgress(Math.round((ev.loaded / ev.total) * 100));
                    }
                };
                xhr.onload = () => {
                    let parsed: Record<string, unknown> = {};
                    try {
                        parsed = JSON.parse(xhr.responseText || '{}');
                    } catch {
                        parsed = {};
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(parsed);
                    } else {
                        if (xhr.status === 401) {
                            handleUnauthorizedSession();
                        }
                        const msg = Array.isArray(parsed.message)
                            ? parsed.message.join(', ')
                            : (typeof parsed.message === 'string' ? parsed.message : 'Error al cargar nueva versión');
                        reject(new Error(msg));
                    }
                };
                xhr.onerror = () => reject(new Error('Error de red al cargar versión'));
                xhr.send(formData);
            });
        },
        updateMetadata: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/documents/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        archive: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/documents/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
        restore: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/documents/${id}/restore`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            return handleResponse(response);
        },
        listVersions: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/documents/${id}/versions`);
            return handleResponse(response);
        },
        download: async (id: string, versionId?: string, fallbackName = 'documento') => {
            const url = versionId
                ? `${API_URL}/documents/${id}/versions/${versionId}/download`
                : `${API_URL}/documents/${id}/download`;
            const response = await fetchWithAuth(url);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'No autorizado o error al descargar documento');
            }
            const blob = await response.blob();
            const cd = response.headers.get('content-disposition') || '';
            const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
            const asciiMatch = cd.match(/filename="([^"]+)"/i);
            const filename = utf8Match
                ? decodeURIComponent(utf8Match[1])
                : asciiMatch
                  ? asciiMatch[1]
                  : fallbackName;

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        },
    },
    legalDrafts: {
        getCatalog: async () => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/catalog`);
            return handleResponse(response);
        },
        getAiStatus: async () => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/ai/status`);
            return handleResponse(response);
        },
        getRecentCases: async (search?: string) => {
            const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/recent-cases${qs}`);
            return handleResponse(response);
        },
        generateWithAi: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/ai/generate`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        assistWithAi: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/ai/assist`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        findAll: async (query?: {
            expedienteId?: string;
            documentType?: string;
            status?: string;
            createdById?: string;
            search?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/legal-drafts${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        updateMetadata: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        archive: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
        listVersions: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/versions`);
            return handleResponse(response);
        },
        createVersion: async (id: string, data: { content: Record<string, unknown>; changeNote?: string }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/versions`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        submitReview: async (id: string, data?: { reviewerId?: string; comments?: string }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/submit-review`, {
                method: 'POST',
                body: JSON.stringify(data || {}),
            });
            return handleResponse(response);
        },
        requestChanges: async (id: string, comments: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/request-changes`, {
                method: 'POST',
                body: JSON.stringify({ comments }),
            });
            return handleResponse(response);
        },
        approve: async (id: string, data: { versionId: string; comments?: string }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/approve`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        finalize: async (id: string, comments?: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/finalize`, {
                method: 'POST',
                body: JSON.stringify(comments ? { comments } : {}),
            });
            return handleResponse(response);
        },
        exportDraft: async (id: string, data: {
            versionId: string;
            format: 'DOCX' | 'PDF';
            idempotencyKey?: string;
            options?: Record<string, unknown>;
        }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/export`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        listExports: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-drafts/${id}/exports`);
            return handleResponse(response);
        },
        downloadExport: async (draftId: string, exportId: string, fallbackName = 'escrito') => {
            const response = await fetchWithAuth(
                `${API_URL}/legal-drafts/${draftId}/exports/${exportId}/download`
            );
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Error al descargar la exportación');
            }
            const blob = await response.blob();
            const cd = response.headers.get('content-disposition') || '';
            const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
            const asciiMatch = cd.match(/filename="([^"]+)"/i);
            const filename = utf8Match
                ? decodeURIComponent(utf8Match[1])
                : asciiMatch
                  ? asciiMatch[1]
                  : fallbackName;

            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        },
    },
    legalTemplates: {
        findAll: async (query?: {
            documentType?: string;
            search?: string;
            includeArchived?: boolean;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/legal-templates${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        findById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-templates/${id}`);
            return handleResponse(response);
        },
        create: async (data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/legal-templates`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        update: async (id: string, data: Record<string, unknown>) => {
            const response = await fetchWithAuth(`${API_URL}/legal-templates/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        duplicate: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-templates/${id}/duplicate`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            return handleResponse(response);
        },
        archive: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-templates/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
    },
    legalAi: {
        getStatus: async () => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/assistant/status`);
            return handleResponse(response);
        },
        listConversations: async (query?: {
            status?: string;
            expedienteId?: string;
            search?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        createConversation: async (data?: { title?: string; expedienteId?: string }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations`, {
                method: 'POST',
                body: JSON.stringify(data || {}),
            });
            return handleResponse(response);
        },
        getConversation: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations/${id}`);
            return handleResponse(response);
        },
        updateConversation: async (id: string, data: { title?: string; expedienteId?: string | null }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        archiveConversation: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
        listMessages: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations/${id}/messages`);
            return handleResponse(response);
        },
        sendMessage: async (
            id: string,
            data: { content: string; documentIds?: string[]; clientMessageId?: string }
        ) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/conversations/${id}/messages`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
    },
    legalAiAnalyses: {
        getStatus: async () => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses/status`);
            return handleResponse(response);
        },
        previewSources: async (data: { expedienteId?: string; documentIds?: string[] }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses/preview-sources`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        create: async (data: {
            analysisType: string;
            expedienteId?: string;
            documentIds?: string[];
            title?: string;
            inputInstructions?: string;
        }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        list: async (query?: {
            expedienteId?: string;
            analysisType?: string;
            status?: string;
            search?: string;
            page?: number;
            limit?: number;
        }) => {
            const cleanParams = Object.fromEntries(
                Object.entries(query || {}).filter(([, v]) => v != null && v !== '')
            );
            const qs = new URLSearchParams(cleanParams as Record<string, string>).toString();
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses${qs ? `?${qs}` : ''}`);
            return handleResponse(response);
        },
        getById: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses/${id}`);
            return handleResponse(response);
        },
        update: async (id: string, data: { title?: string; editedContent?: Record<string, unknown> }) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
            return handleResponse(response);
        },
        archive: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses/${id}`, {
                method: 'DELETE',
            });
            return handleResponse(response);
        },
        retry: async (id: string) => {
            const response = await fetchWithAuth(`${API_URL}/legal-ai/analyses/${id}/retry`, {
                method: 'POST',
                body: JSON.stringify({}),
            });
            return handleResponse(response);
        },
    }
};
