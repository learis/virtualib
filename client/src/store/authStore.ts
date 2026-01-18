import { create } from 'zustand';
import api from '../services/api';

export interface User {
    id: string;
    name: string;
    surname?: string;
    email: string;
    role: string;
    library_id: string;
    library_name: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    logout: () => void;
    checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: (() => {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch {
            return null;
        }
    })(),
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: false,

    login: async (credentials) => {
        set({ isLoading: true });
        try {
            const response = await api.post('/auth/login', credentials);
            const { token, user } = response.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
    },

    checkAuth: () => {
        // Decode token or fetch profile if needed
        // For now, reliance on localStorage token presence + 401 interceptor
        const token = localStorage.getItem('token');
        // In a real app we might fetch /me here
        if (token) {
            // We might need to persist user details in localstorage or fetch them
            // Ideally we fetch /auth/me
        }
    }
}));
