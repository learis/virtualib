import api from './api';

export interface Book {
    id: string;
    name: string;
    author: string;
    isbn: string;
    publish_year: number;
    publisher: string;
    cover_image_path?: string;
    summary_tr?: string;
    summary_en?: string;
    categories?: {
        category: Category;
    }[];
    loans?: {
        id: string;
        returned_at: string | null;
    }[]; // Added loans for status check
    deleted_at: string | null;
    created_at: string;
}

export interface CreateBookDto {
    name: string;
    author: string;
    isbn: string;
    publish_year: number;
    publisher: string;
    cover_image_path?: string;
    category_ids: string[];
    library_id: string; // Required for Admin/Librarian to specify target library
    summary_tr?: string;
    summary_en?: string;
}

export const generateBookSummary = async (name: string, author: string) => {
    const response = await api.post<{ summary_tr: string; summary_en: string }>('/books/generate-summary', { name, author });
    return response.data;
};

export interface Category {
    id: string;
    name: string;
}

export const getCategories = async (libraryId?: string) => {
    const params = libraryId ? { library_id: libraryId } : {};
    const response = await api.get<Category[]>('/categories', { params });
    return response.data;
};

// Helper to fetch libraries for the dropdown (Admin/Librarian)
export const getLibraries = async () => {
    const response = await api.get<{ id: string; name: string }[]>('/libraries');
    return response.data;
};

export const getBooks = async (libraryId?: string) => {
    const params = libraryId ? { library_id: libraryId } : {};
    const response = await api.get<Book[]>('/books', { params });
    return response.data;
};

export const createBook = async (data: CreateBookDto) => {
    const response = await api.post<Book>('/books', data);
    return response.data;
};

export const updateBook = async (id: string, data: Partial<CreateBookDto>) => {
    const response = await api.put<Book>(`/books/${id}`, data);
    return response.data;
};

export const deleteBook = async (id: string, type: 'soft' | 'hard' = 'soft') => {
    const res = await api.delete(`/books/${id}?type=${type}`);
    return res.data;
};

export const restoreBook = async (id: string) => {
    const res = await api.post(`/books/${id}/restore`);
    return res.data;
};
