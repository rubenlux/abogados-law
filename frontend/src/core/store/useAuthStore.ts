
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'LAWYER';
}

interface AuthState {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string, refreshToken: string) => void;
    logout: () => void;
    setTokens: (token: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            login: (user, token, refreshToken) => {
                // Guardar en el store
                set({ user, token, refreshToken, isAuthenticated: true });
                // También guardar en localStorage para compatibilidad
                localStorage.setItem('token', token);
                localStorage.setItem('refreshToken', refreshToken);
            },
            logout: () => {
                // Limpiar el store
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
                // También limpiar localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
            },
            setTokens: (token, refreshToken) => set({ token, refreshToken }),
        }),
        {
            name: 'auth-storage',
        }
    )
);
