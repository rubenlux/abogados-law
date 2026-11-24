// Basic Fetch Wrapper
const API_URL = 'http://localhost:3000'; // Hardcoded for MVP

export interface AnalyzeResponse {
    type: string;
    fecha_notificacion: string;
    plazo_detectado: string;
    vencimiento_sugerido: string;
    explicacion_legal: string;
}

import { useAuthStore } from '../store/useAuthStore';

const getHeaders = () => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    const { token } = useAuthStore.getState();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    // 1. Initial Request
    let headers = { ...getHeaders(), ...(options.headers as Record<string, string>) };
    let response = await fetch(url, { ...options, headers });

    // 2. Handle 401
    if (response.status === 401) {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();

        if (refreshToken) {
            try {
                // Try to refresh
                const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });

                if (refreshResponse.ok) {
                    const data = await refreshResponse.json();
                    setTokens(data.access_token, data.refresh_token);

                    // Retry original request with NEW token
                    headers = {
                        ...getHeaders(), // gets new token from store
                        ...(options.headers as Record<string, string>)
                    };
                    response = await fetch(url, { ...options, headers });
                } else {
                    logout();
                    window.location.href = '/login';
                }
            } catch (error) {
                logout();
                window.location.href = '/login';
            }
        } else {
            logout();
            window.location.href = '/login';
        }
    }

    return response;
};

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        if (response.status === 401) {
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Request failed');
    }
    return response.json();
};

export const apiClient = {
    auth: {
        login: async (email: string, password: string) => {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            return handleResponse(response);
        },
        logout: async () => {
            // Try to call backend logout
            try {
                await fetchWithAuth(`${API_URL}/auth/logout`, { method: 'POST' });
            } catch (e) { /* ignore */ }
            useAuthStore.getState().logout();
            window.location.href = '/login';
        }
    },
    expedientes: {
        findAll: async () => {
            const response = await fetchWithAuth(`${API_URL}/expedientes`);
            return handleResponse(response);
        },
        create: async (data: any) => {
            const response = await fetchWithAuth(`${API_URL}/expedientes`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return handleResponse(response);
        }
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
        search: async (params: any) => {
            // Filter out undefined/null/empty params
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([_, v]) => v != null && v !== '')
            );
            const query = new URLSearchParams(cleanParams as any).toString();
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
        findAll: async (query?: any) => {
            // Convert query obj to URLSearchParams
            const params = new URLSearchParams(query).toString();
            const response = await fetchWithAuth(`${API_URL}/agenda?${params}`);
            return handleResponse(response);
        },
        createEvent: async (data: any) => {
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
    }
};
