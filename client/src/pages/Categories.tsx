import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FolderTree, Search, Tag, Book, Building } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Category {
    id: string;
    name: string;
    library: { id: string; name: string };
    _count?: {
        books: number;
    };
}

export const Categories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [name, setName] = useState('');
    const [libraryId, setLibraryId] = useState('');
    const [libraries, setLibraries] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLibraryFilter, setSelectedLibraryFilter] = useState(''); // For filtering list

    const user = useAuthStore(state => state.user);
    const isAdmin = user?.role === 'admin';

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const response = await api.get<Category[]>('/categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Failed to fetch categories', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLibraries = async () => {
        try {
            const response = await api.get('/libraries');
            setLibraries(response.data);
            if (response.data.length > 0 && !libraryId) {
                setLibraryId(response.data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch libraries', error);
        }
    };

    useEffect(() => {
        fetchCategories();
        if (isAdmin) {
            fetchLibraries();
        }
    }, [isAdmin]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                await api.put(`/categories/${editingCategory.id}`, { name });
            } else {
                await api.post('/categories', { name, library_id: libraryId });
            }
            fetchCategories();
            handleCloseModal();
        } catch (error) {
            alert('Failed to save category');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This might affect books in this category.')) return;
        try {
            await api.delete(`/categories/${id}`);
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            alert('Failed to delete category');
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setName(category.name);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setEditingCategory(null);
        setName('');
    };

    const filteredCategories = categories.filter(category => {
        const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            category.library.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLibrary = selectedLibraryFilter ? category.library && category.library['id'] === selectedLibraryFilter : true;
        // Note: checking library['id'] or matching if library object structure has ID.
        // Interface says library: { name: string }. Need to ensuring fetched category has library ID.
        // Assuming getAllCategories response includes library relation with ID.
        return matchesSearch && matchesLibrary;
    });

    return (
        <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FolderTree className="text-blue-600" />
                        Category Management
                    </h1>
                    <p className="text-gray-500 mt-1">Organize your library collection</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={18} />
                        Add Category
                    </button>
                )}
            </div>

            {/* Search Bar & Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 flex items-center gap-3 w-full border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-100 transition-shadow">
                    <Search size={20} className="text-gray-400 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        className="flex-1 outline-none text-gray-700 bg-transparent min-w-0"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Library Filter */}
                <div className="w-full md:w-64 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2 relative bg-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                    <Building size={16} className="text-gray-400 shrink-0" />
                    <select
                        className="w-full bg-transparent outline-none text-sm text-gray-700 font-medium appearance-none cursor-pointer"
                        value={selectedLibraryFilter} // Needs new state
                        onChange={(e) => setSelectedLibraryFilter(e.target.value)}
                    >
                        <option value="">All Libraries</option>
                        {libraries.map(lib => (
                            <option key={lib.id} value={lib.id}>{lib.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-10">Loading categories...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCategories.map((category) => (
                        <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                        <Tag size={20} />
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(category)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(category.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <h3 className="font-bold text-lg text-gray-900 mb-1 truncate" title={category.name}>{category.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                    <span className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100 truncate max-w-[120px]">{category.library?.name}</span>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md text-xs font-medium">
                                        <Book size={14} className="text-blue-500" />
                                        <span>{category._count?.books || 0} books</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredCategories.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                            No categories found matching "{searchQuery}".
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">
                            {editingCategory ? 'Edit Category' : 'New Category'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Category Name</label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Science Fiction"
                                />
                            </div>

                            {!editingCategory && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Library</label>
                                    <select
                                        required
                                        className="input"
                                        value={libraryId}
                                        onChange={(e) => setLibraryId(e.target.value)}
                                    >
                                        {libraries.map(lib => (
                                            <option key={lib.id} value={lib.id}>{lib.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 border rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow active:scale-95 flex items-center gap-2 whitespace-nowrap"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
