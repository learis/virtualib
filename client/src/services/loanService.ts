import api from './api';
import type { Book } from './bookService';
import type { User } from '../store/authStore';

export interface BookLoan {
    id: string;
    book_id: string;
    user_id: string;
    borrowed_at: string;
    due_at: string;
    returned_at: string | null;
    status: 'active' | 'return_requested' | 'returned' | 'return_rejected';
    book: Book;
    user: User;
}

export const getLoans = async () => {
    const response = await api.get<BookLoan[]>('/loans');
    return response.data;
};

export const createLoan = async (data: { book_id: string; user_id: string; due_date: string }) => {
    const response = await api.post('/loans', data);
    return response.data;
};

export const requestReturn = async (id: string) => {
    const response = await api.post(`/loans/${id}/return-request`);
    return response.data;
};

export const approveReturn = async (id: string) => {
    const response = await api.post(`/loans/${id}/return`);
    return response.data;
};

export const rejectReturn = async (id: string) => {
    const response = await api.post(`/loans/${id}/reject`);
    return response.data;
};

export const cancelReturnRequest = async (id: string) => {
    const response = await api.post(`/loans/${id}/cancel-return`);
    return response.data;
};

// Re-export this if needed elsewhere or remove if not used
export const createRequest = async (bookId: string) => {
    const response = await api.post('/requests', { book_id: bookId });
    return response.data;
};

export interface RequestUser {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone?: string;
}

export interface UnifiedRequest {
    id: string;
    type: 'borrow' | 'return';
    book: Book;
    user: RequestUser;
    status: 'pending' | 'approved' | 'rejected' | 'return_requested' | 'returned' | 'return_rejected';
    date: string; // Unified date field
    requested_at?: string; // Legacy optional
}

export const getRequests = async () => {
    const response = await api.get<UnifiedRequest[]>('/requests');
    return response.data;
};

export const updateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    const response = await api.put(`/requests/${requestId}`, { status });
    return response.data;
};
