import { create } from 'zustand';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: string;
}

export interface AuthOrganization {
    id: string;
    name: string;
    status: string;
}

interface AuthState {
    user: AuthUser | null;
    organization: AuthOrganization | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    sessionChecked: boolean;
    setSession: (user: AuthUser, organization?: AuthOrganization | null) => void;
    setSessionChecked: (checked: boolean) => void;
    login: (user: AuthUser) => void;
    logout: () => void;
}

const clearLegacyAuthStorage = () => {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('auth-storage');
    } catch {
        // ignore storage access errors
    }
};

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    organization: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    sessionChecked: false,
    setSession: (user, organization = null) => {
        clearLegacyAuthStorage();
        set({
            user,
            organization,
            token: null,
            refreshToken: null,
            isAuthenticated: true,
            sessionChecked: true,
        });
    },
    setSessionChecked: (checked) => set({ sessionChecked: checked }),
    login: (user) => {
        clearLegacyAuthStorage();
        set({
            user,
            token: null,
            refreshToken: null,
            isAuthenticated: true,
            sessionChecked: true,
        });
    },
    logout: () => {
        clearLegacyAuthStorage();
        set({
            user: null,
            organization: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            sessionChecked: true,
        });
    },
}));
