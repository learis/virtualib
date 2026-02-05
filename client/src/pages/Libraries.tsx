import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Building } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Library {
    id: string;
    name: string;
    description?: string;
    owner?: {
        name: string;
        surname: string;
        email: string;
    };
    _count?: {
        users: number;
        books: number;
        categories: number;
    };
}

export const Libraries = () => {
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    const user = useAuthStore(state => state.user);
    const isAdmin = user?.role === 'admin';

    const fetchLibraries = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/libraries');
            setLibraries(response.data);
        } catch (error) {
            console.error('Failed to fetch libraries', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLibraries();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingLibrary) {
                await api.put(`/libraries/${editingLibrary.id}`, formData);
            } else {
                await api.post('/libraries', formData);
            }
            fetchLibraries();
            handleCloseModal();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to save library');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This will affect all users and books in this library.')) return;
        try {
            await api.delete(`/libraries/${id}`);
            setLibraries(libraries.filter(l => l.id !== id));
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to delete library');
        }
    };

    const handleEdit = (library: Library) => {
        setEditingLibrary(library);
        setFormData({ name: library.name, description: library.description || '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingLibrary(null);
        setFormData({ name: '', description: '' });
    };

    const isLibrarian = user?.role === 'librarian';

    if (!isAdmin && !isLibrarian) {
        return <div className="p-8 text-center text-red-600">Access Restricted</div>;
    }

    return (
        <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building className="text-blue-600" />
                        Library Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage library branches</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow active:scale-95 flex items-center gap-2 whitespace-nowrap"
                >
                    <Plus size={18} />
                    Add Library
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-10">Loading libraries...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {libraries.map((library) => (
                        <div key={library.id} className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                                        <Building size={24} />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(library)}
                                            className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(library.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="font-bold text-lg text-gray-900 mb-2 truncate" title={library.name}>{library.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-6">{library.description || 'No description provided.'}</p>

                                {library.owner && (
                                    <div className="mb-4 text-xs text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded inline-block">
                                        Owner: {library.owner.name} {library.owner.surname} ({library.owner.email})
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 py-4 border-t border-gray-50 bg-gray-50/50 rounded-lg">
                                    <div className="text-center px-1">
                                        <div className="text-lg font-bold text-gray-900">{library._count?.users || 0}</div>
                                        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Users</div>
                                    </div>
                                    <div className="text-center px-1 border-l border-gray-200">
                                        <div className="text-lg font-bold text-gray-900">{library._count?.books || 0}</div>
                                        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Books</div>
                                    </div>
                                    <div className="text-center px-1 border-l border-gray-200">
                                        <div className="text-lg font-bold text-gray-900">{library._count?.categories || 0}</div>
                                        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Cats</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {
                        libraries.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-400">
                                No libraries found.
                            </div>
                        )
                    }
                </div >
            )}

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                            <h2 className="text-xl font-bold mb-4">
                                {editingLibrary ? 'Edit Library' : 'New Library'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Library Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <textarea
                                        className="input min-h-[100px]"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

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
                )
            }
        </div >
    );
};
