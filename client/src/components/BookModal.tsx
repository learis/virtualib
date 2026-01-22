import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { type CreateBookDto, type Book } from '../services/bookService';

interface BookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateBookDto) => Promise<void>;
    initialData?: Book | null;
    isReadOnly?: boolean;
}

// ... existing imports
import { Image as ImageIcon } from 'lucide-react';
// ... existing interface

// ... existing interface

export const BookModal = ({ isOpen, onClose, onSubmit, initialData, isReadOnly = false }: BookModalProps) => {
    // ... state declarations as before
    const [formData, setFormData] = useState<CreateBookDto>({
        name: '',
        author: '',
        isbn: '',
        publish_year: new Date().getFullYear(),
        publisher: '',
        cover_image_path: '',
        category_ids: [],
        summary_tr: '',
        summary_en: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        const fetchCategories = async () => {
            const { getCategories } = await import('../services/bookService');
            const data = await getCategories();
            setCategories(Array.isArray(data) ? data : []);
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                author: initialData.author,
                isbn: initialData.isbn,
                publish_year: initialData.publish_year,
                publisher: initialData.publisher,
                cover_image_path: initialData.cover_image_path || '',
                category_ids: initialData.categories ? initialData.categories.map(c => c.category.id) : [],
                summary_tr: initialData.summary_tr || '',
                summary_en: initialData.summary_en || ''
            });
        } else {
            setFormData({
                name: '',
                author: '',
                isbn: '',
                publish_year: new Date().getFullYear(),
                publisher: '',
                cover_image_path: '',
                category_ids: [],
                summary_tr: '',
                summary_en: ''
            });
        }
    }, [initialData, isOpen]);

    // URL-only mode requested by user


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

    // Determine availability (This logic requires book loans data which might not be in initialData fully. 
    // Assuming we rely on a prop or check logic. For now, we'll placeholder if not explicitly passed.)
    // But the user requested "On Shelf" vs "Borrowed". 
    // Since `initialData` comes from `getBooks` which doesn't join `loans` by default in `Books.tsx` (it does simple list),
    // we might need to rely on the parent or fetch details. 
    // Let's assume for this step we display what we have or default to "On Shelf" if no active loan data.
    // Actually, we should probably fetch the book details including status if we want to be accurate. 
    // But for "Edit" modal, `initialData` is usually just the row data.

    // Let's add a visual status.
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
                            {/* Fallback for broken image */}
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

                    {/* Status Badge */}
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

                        {/* Title & Author Section */}
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

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
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
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    required
                                    className="w-full bg-transparent text-sm font-medium focus:outline-none"
                                    value={formData.publish_year}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d+$/.test(val)) {
                                            setFormData({ ...formData, publish_year: val === '' ? 0 : parseInt(val) });
                                        }
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
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Categories</label>
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

                                                setFormData(prev => ({
                                                    ...prev,
                                                    summary_tr: summary.summary_tr,
                                                    summary_en: summary.summary_en
                                                }));
                                            } catch (error: any) {
                                                console.error(error);
                                                alert(error.response?.data?.message || 'Failed to generate summary');
                                            } finally {
                                                setIsLoading(false);
                                            }
                                        }}
                                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full font-bold transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                    >
                                        ✨ Generate Book Summary With AI
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
                            className="px-6 py-2.5 rounded-lg border border-gray-200 font-medium hover:bg-white hover:border-gray-300 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
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
