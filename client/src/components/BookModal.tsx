import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Building } from 'lucide-react';
import { type CreateBookDto, type Book } from '../services/bookService';

interface BookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateBookDto) => Promise<void>;
    initialData?: Book | null;
    isReadOnly?: boolean;
}

export const BookModal = ({ isOpen, onClose, onSubmit, initialData, isReadOnly = false }: BookModalProps) => {
    // ... state declarations
    const [formData, setFormData] = useState<CreateBookDto>({
        name: '',
        author: '',
        isbn: '',
        publish_year: new Date().getFullYear(),
        publisher: '',
        cover_image_path: '',
        category_ids: [],
        library_id: '',
        summary_tr: '',
        summary_en: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [libraries, setLibraries] = useState<any[]>([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { getLibraries } = await import('../services/bookService');
            try {
                const libs = await getLibraries();
                setLibraries(Array.isArray(libs) ? libs : []);

                // If only one library (e.g. standard User or Librarian with 1 library) and it's a new book
                if (libs.length === 1 && !initialData) {
                    setFormData(prev => ({ ...prev, library_id: libs[0].id }));
                }
            } catch (err) {
                console.error('Failed to fetch libraries', err);
            }
        };
        if (isOpen) {
            fetchInitialData();
        }
    }, [initialData, isOpen]);

    // Fetch categories when library_id changes
    useEffect(() => {
        const fetchCategories = async () => {
            if (!formData.library_id) {
                setCategories([]);
                return;
            }
            const { getCategories } = await import('../services/bookService');
            try {
                const data = await getCategories(formData.library_id);
                setCategories(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to categories', err);
            }
        };
        fetchCategories();
    }, [formData.library_id]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                author: initialData.author,
                isbn: initialData.isbn,
                publish_year: initialData.publish_year,
                publisher: initialData.publisher,
                cover_image_path: initialData.cover_image_path || '',
                // Ideally initialData has library_id.
                // If missing in type, we assume it's attached or backend handles it (but for display we need it).
                // Assuming book.library_id exists on the object.
                library_id: (initialData as any).library_id || '',
                category_ids: initialData.categories ? initialData.categories.map(c => c.category.id) : [],
                summary_tr: initialData.summary_tr || '',
                summary_en: initialData.summary_en || ''
            });
        } else {
            // New Book
            setFormData(prev => ({
                name: '',
                author: '',
                isbn: '',
                publish_year: new Date().getFullYear(),
                publisher: '',
                cover_image_path: '',
                category_ids: [],
                library_id: prev.library_id || '', // Keep library_id if auto-selected
                summary_tr: '',
                summary_en: ''
            }));
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        setIsLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error: any) {
            console.error(error);
            const message = error.response?.data?.message || error.message || 'Failed to save book';
            const details = error.response?.data?.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('\n');
            alert(`${message}\n${details || ''}`);
        } finally {
            setIsLoading(false);
        }
    };

    const isBorrowed = initialData?.loans && initialData.loans.length > 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header Image Area */}
                <div className="relative h-48 sm:h-64 bg-gray-100 shrink-0 group">
                    {formData.cover_image_path ? (
                        <>
                            <img
                                src={formData.cover_image_path}
                                alt="Cover"
                                className="w-full h-full object-contain bg-gray-900"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                            <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500 flex-col gap-2">
                                <ImageIcon size={48} className="opacity-50" />
                                <span className="text-xs font-medium">Image not found</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            <ImageIcon size={64} opacity={0.5} />
                        </div>
                    )}

                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <button onClick={onClose} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="absolute bottom-4 left-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold shadow-sm backdrop-blur-md
                                ${isBorrowed
                                ? 'bg-red-500/90 text-white'
                                : 'bg-green-500/90 text-white'
                            }`}>
                            {isBorrowed ? 'Borrowed' : 'On Shelf'}
                        </span>
                    </div>

                    {!isReadOnly && (
                        <div className="absolute bottom-4 right-4 w-full max-w-sm px-4">
                            <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg p-2 flex items-center gap-2">
                                <ImageIcon size={18} className="text-gray-500 shrink-0" />
                                <input
                                    type="url"
                                    placeholder="Enter image URL..."
                                    className="bg-transparent border-none text-sm w-full focus:outline-none text-gray-700 placeholder-gray-400"
                                    value={formData.cover_image_path || ''}
                                    onChange={(e) => setFormData({ ...formData, cover_image_path: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="p-6 space-y-8">

                        {/* Library Selector (Critical for Multi-Tenancy) */}
                        {!isReadOnly && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Library Location</label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <select
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-700"
                                        value={formData.library_id}
                                        onChange={(e) => {
                                            setFormData({ ...formData, library_id: e.target.value, category_ids: [] });
                                        }}
                                        disabled={!!initialData}
                                    >
                                        <option value="">Select a Library</option>
                                        {libraries.map(lib => (
                                            <option key={lib.id} value={lib.id}>{lib.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {initialData && <p className="text-xs text-gray-400 mt-1 ml-1">Library cannot be changed after creation.</p>}
                            </div>
                        )}

                        {/* Title & Author Section ... Same as before */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Book Title</label>
                                <input
                                    type="text"
                                    required
                                    className="text-2xl font-bold w-full border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none placeholder-gray-300 transition-colors bg-transparent"
                                    placeholder="Enter book title"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Author</label>
                                <input
                                    type="text"
                                    required
                                    className="text-lg font-medium w-full border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none placeholder-gray-300 transition-colors bg-transparent text-gray-700"
                                    placeholder="Enter author name"
                                    value={formData.author}
                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Info Grid ... Same as before */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                            {/* ... Inputs ... */}

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">ISBN</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-transparent font-mono text-sm font-medium focus:outline-none"
                                    value={formData.isbn}
                                    onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">Published</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-transparent text-sm font-medium focus:outline-none"
                                    value={formData.publish_year}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d+$/.test(val)) setFormData({ ...formData, publish_year: Number(val) || 0 });
                                    }}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                                <label className="block text-xs font-semibold text-gray-400 mb-1">Publisher</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-transparent text-sm font-medium focus:outline-none"
                                    value={formData.publisher}
                                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Categories */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                Categories {formData.library_id ? '' : '(Select Library First)'}
                            </label>

                            {formData.library_id ? (
                                categories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {(isReadOnly
                                            ? categories.filter(c => formData.category_ids.includes(c.id))
                                            : categories
                                        ).map(category => (
                                            <label key={category.id} className={`
                                                    cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium transition-all select-none
                                                    ${formData.category_ids.includes(category.id)
                                                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-1'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }
                                                `}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={formData.category_ids.includes(category.id)}
                                                    disabled={isReadOnly}
                                                    onChange={(e) => {
                                                        const id = category.id;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            category_ids: e.target.checked
                                                                ? [...prev.category_ids, id]
                                                                : prev.category_ids.filter(cid => cid !== id)
                                                        }));
                                                    }}
                                                />
                                                {category.name}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400 italic">No categories found in this library.</div>
                                )
                            ) : (
                                <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-sm text-gray-400">
                                    Please select a library to view available categories.
                                </div>
                            )}
                        </div>

                        {/* Summaries */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="text-lg font-semibold text-gray-900">Summaries</h3>
                                {!isReadOnly && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!formData.name || !formData.author) {
                                                alert('Please enter Book Name and Author first');
                                                return;
                                            }
                                            try {
                                                setIsLoading(true);
                                                const { generateBookSummary } = await import('../services/bookService');
                                                const summary = await generateBookSummary(formData.name, formData.author);
                                                if (summary && 'error' in summary) throw new Error((summary as any).error || 'Failed');
                                                setFormData(prev => ({ ...prev, summary_tr: summary.summary_tr, summary_en: summary.summary_en }));
                                            } catch (error: any) {
                                                console.error(error);
                                                alert(error.response?.data?.message || 'Failed to generate summary');
                                            } finally {
                                                setIsLoading(false);
                                            }
                                        }}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-bold transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                    >
                                        ✨ Generate Summary AI
                                    </button>
                                )}
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">🇹🇷</span>
                                        <h4 className="font-medium text-gray-900">Türkçe Özet</h4>
                                    </div>
                                    <textarea
                                        className="w-full min-h-[120px] p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 resize-y text-gray-700 leading-relaxed"
                                        placeholder="Kitap özeti buraya gelecek..."
                                        value={formData.summary_tr || ''}
                                        onChange={(e) => setFormData({ ...formData, summary_tr: e.target.value })}
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">🇬🇧</span>
                                        <h4 className="font-medium text-gray-900">English Summary</h4>
                                    </div>
                                    <textarea
                                        className="w-full min-h-[120px] p-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-100 resize-y text-gray-700 leading-relaxed"
                                        placeholder="Book summary will appear here..."
                                        value={formData.summary_en || ''}
                                        onChange={(e) => setFormData({ ...formData, summary_en: e.target.value })}
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {!isReadOnly && (
                    <div className="p-4 border-t bg-gray-50/50 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-lg border border-gray-200 font-medium hover:bg-white hover:border-gray-300 transition-all text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || !formData.library_id}
                            className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
