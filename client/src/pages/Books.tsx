import { useState, useEffect } from 'react';
import { Plus, Search, Book as BookIcon, LayoutGrid, List as ListIcon, Edit2, Trash2, RefreshCcw, AlertTriangle } from 'lucide-react';
import { getBooks, createBook, updateBook, deleteBook, restoreBook, getCategories, type Book, type CreateBookDto, type Category } from '../services/bookService';
import { createRequest } from '../services/loanService';
import { useAuthStore } from '../store/authStore';
import { BookModal } from '../components/BookModal';

type ViewMode = 'grid' | 'list';

type SortOption = 'name_asc' | 'name_desc' | 'author_asc' | 'author_desc' | 'year_asc' | 'year_desc' | 'created_asc' | 'created_desc';

export const Books = () => {
    const [books, setBooks] = useState<Book[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>('created_desc');
    const [editingBook, setEditingBook] = useState<Book | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [isReadOnlyModal, setIsReadOnlyModal] = useState(false);
    const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
    const [activeBookId, setActiveBookId] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch independently to allow partial success
            getBooks()
                .then(data => setBooks(Array.isArray(data) ? data : []))
                .catch(err => console.error('Failed to fetch books', err));

            getCategories()
                .then(data => setCategories(Array.isArray(data) ? data : []))
                .catch(err => console.error('Failed to fetch categories', err));

        } catch (error) {
            console.error('Failed to init fetch', error);
        } finally {
            // Short timeout to prevent flash if cache is fast
            setTimeout(() => setIsLoading(false), 300);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveBook = async (data: CreateBookDto) => {
        console.log('handleSaveBook CALLED with:', data); // DEBUG LOG
        if (editingBook && !isReadOnlyModal) {
            console.log('Updating book...', editingBook.id); // DEBUG LOG
            await updateBook(editingBook.id, data);
        } else if (!isReadOnlyModal) {
            await createBook(data);
        }
        await fetchData();
        setEditingBook(null);
        setIsReadOnlyModal(false);
    };

    const user = useAuthStore(state => state.user);
    const isAdmin = user?.role === 'admin';

    const handleEditClick = (book: Book) => {
        setEditingBook(book);
        setIsReadOnlyModal(false);
        setIsModalOpen(true);
    };

    const handleViewClick = (book: Book) => {
        setEditingBook(book);
        setIsReadOnlyModal(true);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (book: Book) => {
        setBookToDelete(book);
    };

    const confirmDelete = async (type: 'soft' | 'hard') => {
        if (!bookToDelete) return;
        try {
            await deleteBook(bookToDelete.id, type);
            await fetchData();
            setBookToDelete(null);
        } catch (error) {
            console.error('Failed to delete book', error);
            alert('Failed to delete book');
        }
    };

    const handleRestoreClick = async (book: Book) => {
        if (confirm(`Restore "${book.name}"?`)) {
            try {
                await restoreBook(book.id);
                await fetchData();
            } catch (error) {
                console.error('Failed to restore book', error);
                alert('Failed to restore book');
            }
        }
    };

    const handleBorrowClick = async (book: Book) => {
        if (!user) return;
        if (isAdmin) {
            alert('Admins cannot request books. Please use the Loan Management panel to assign books directly.');
            return;
        }

        if (confirm(`Do you want to request to borrow "${book.name}"?`)) {
            try {
                await createRequest(book.id);
                alert('Borrow request sent successfully!');
            } catch (error: any) {
                alert(error.response?.data?.message || 'Failed to send request');
            }
        }
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(30);

    const filteredBooks = books.filter(book => {
        const matchesSearch = book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
            book.isbn.includes(searchQuery);
        const matchesCategory = selectedCategory ? book.categories?.some(c => c.category.id === selectedCategory) : true;
        return matchesSearch && matchesCategory;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'name_asc': return a.name.localeCompare(b.name);
            case 'name_desc': return b.name.localeCompare(a.name);
            case 'author_asc': return a.author.localeCompare(b.author);
            case 'author_desc': return b.author.localeCompare(a.author);
            case 'year_asc': return a.publish_year - b.publish_year;
            case 'year_desc': return b.publish_year - a.publish_year;
            case 'created_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            case 'created_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            default: return 0;
        }
    });

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory, sortBy]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
    const paginatedBooks = filteredBooks.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Library</h1>
                        <p className="text-sm text-gray-500 font-medium">Manage and curate your collection</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    setEditingBook(null);
                                    setIsReadOnlyModal(false);
                                    setIsModalOpen(true);
                                }}
                                className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow active:scale-95 flex items-center gap-2 whitespace-nowrap"
                            >
                                <Plus size={18} />
                                Add Book
                            </button>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col gap-4 mb-8 w-full">
                    <div className="w-full flex flex-col md:flex-row gap-4">
                        {/* Search Bar - Full width on mobile */}
                        <div className="flex-1 bg-white border border-gray-200 shadow-sm rounded-lg flex items-center transition-shadow hover:shadow-md focus-within:shadow-md focus-within:border-blue-500 overflow-hidden h-12">
                            <div className="pl-4 text-gray-400">
                                <Search size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search books..."
                                className="flex-1 bg-transparent px-4 py-3 outline-none text-gray-900 placeholder-gray-400 text-base min-w-0"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Filters Row on Mobile */}
                        <div className="flex gap-4">
                            {/* Category Filter */}
                            <div className="flex-1 md:w-48 bg-white border border-gray-200 shadow-sm rounded-lg flex items-center h-12 px-3 relative hover:border-gray-300 transition-colors">
                                <select
                                    className="w-full bg-transparent outline-none text-gray-700 font-medium cursor-pointer text-sm appearance-none pr-8 truncate"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {/* Sort Filter */}
                            <div className="flex-1 md:w-56 bg-white border border-gray-200 shadow-sm rounded-lg flex items-center h-12 px-3 relative hover:border-gray-300 transition-colors">
                                <select
                                    className="w-full bg-transparent outline-none text-gray-700 font-medium cursor-pointer text-sm appearance-none pr-8 truncate"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                >
                                    <option value="name_asc">Book: A-Z</option>
                                    <option value="name_desc">Book: Z-A</option>
                                    <option value="author_asc">Author: A-Z</option>
                                    <option value="author_desc">Author: Z-A</option>
                                    <option value="year_desc">Newest (Year)</option>
                                    <option value="year_asc">Oldest (Year)</option>
                                    <option value="created_desc">Latest Added</option>
                                    <option value="created_asc">Earliest Added</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* View Toggle */}
                        <div className="hidden md:flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0 h-12 items-center">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all h-full aspect-square flex items-center justify-center ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={20} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all h-full aspect-square flex items-center justify-center ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                                title="List View"
                            >
                                <ListIcon size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center py-32 opacity-50">
                        <div className="animate-pulse w-8 h-8 bg-gray-200 rounded-full"></div>
                    </div>
                ) : filteredBooks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                        <Search size={48} strokeWidth={1} className="mb-4 opacity-20" />
                        <p className="text-lg font-light">No books found in collection.</p>
                        {isAdmin && (
                            <button
                                onClick={() => {
                                    setEditingBook(null);
                                    setIsReadOnlyModal(false);
                                    setIsModalOpen(true);
                                }}
                                className="mt-4 text-sm font-medium text-gray-900 border-b border-gray-900 pb-0.5 hover:opacity-70 transition-opacity"
                            >
                                Add your first book
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            /* GRID VIEW */
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12">
                                {paginatedBooks.map((book) => {
                                    const isDeleted = !!book.deleted_at;
                                    return (
                                        <div
                                            key={book.id}
                                            className={`group relative cursor-pointer ${isDeleted ? 'opacity-60 grayscale' : ''}`}
                                        >
                                            {/* Book Cover - Rounded Corners */}
                                            <div
                                                onClick={() => setActiveBookId(activeBookId === book.id ? null : book.id)}
                                                className="aspect-[2/3] w-full bg-gray-100 mb-3 md:mb-4 overflow-hidden rounded-xl shadow-sm transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-1 relative"
                                            >
                                                {book.cover_image_path ? (
                                                    <img
                                                        src={book.cover_image_path}
                                                        alt={book.name}
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                                                        <BookIcon size={32} strokeWidth={1} />
                                                    </div>
                                                )}

                                                {/* Status Badge for Deleted */}
                                                {isDeleted && (
                                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">
                                                        DISABLED
                                                    </div>
                                                )}

                                                {/* Overlay Actions */}
                                                <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 ${activeBookId === book.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                    {isDeleted ? (
                                                        isAdmin && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleRestoreClick(book); }} className="px-6 py-2 bg-green-600 text-white text-xs font-bold uppercase hover:bg-green-700">Restore</button>
                                                        )
                                                    ) : (
                                                        <>
                                                            {!isAdmin && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleBorrowClick(book); }}
                                                                    className="px-6 py-2 !bg-white !text-black text-xs font-bold tracking-wider uppercase hover:!bg-gray-200 transition-colors"
                                                                >
                                                                    Request
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleViewClick(book); }}
                                                                className="px-6 py-2 border border-white text-white text-xs font-bold tracking-wider uppercase hover:bg-white hover:text-black transition-colors"
                                                            >
                                                                View
                                                            </button>
                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleEditClick(book); }}
                                                                        className="px-6 py-2 border border-white text-white text-xs font-bold tracking-wider uppercase hover:bg-white hover:text-black transition-colors"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(book); }}
                                                                        className="text-red-400 hover:text-red-500 p-2 bg-white/10 rounded-full transition-colors"
                                                                        title="Delete Book"
                                                                    >
                                                                        <Trash2 size={20} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="space-y-1">
                                                <h3
                                                    onClick={() => handleViewClick(book)}
                                                    className="text-sm md:text-base font-medium text-gray-900 leading-tight line-clamp-1 group-hover:text-blue-600 transition-colors"
                                                >
                                                    {book.name}
                                                </h3>
                                                <p className="text-xs md:text-sm text-gray-500 font-light line-clamp-1">{book.author}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            /* LIST VIEW */
                            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Book</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Author</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {paginatedBooks.map((book) => {
                                            const isDeleted = !!book.deleted_at;
                                            return (
                                                <tr key={book.id} className={`hover:bg-gray-50 transition-colors ${isDeleted ? 'bg-gray-50 opacity-60' : ''}`}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-8 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                                                {book.cover_image_path ? (
                                                                    <img src={book.cover_image_path} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400"><BookIcon size={12} /></div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span
                                                                    onClick={() => handleViewClick(book)}
                                                                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline"
                                                                >
                                                                    {book.name}
                                                                </span>
                                                                {isDeleted && <span className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Disabled</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.author}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {book.categories?.map(c => c.category.name).join(', ') || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{book.publish_year}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-3">
                                                            {isDeleted ? (
                                                                isAdmin && <button onClick={() => handleRestoreClick(book)} className="text-green-600 hover:text-green-800" title="Restore"><RefreshCcw size={18} /></button>
                                                            ) : (
                                                                <>
                                                                    {!isAdmin && (
                                                                        <button
                                                                            onClick={() => handleBorrowClick(book)}
                                                                            className="text-blue-600 hover:text-blue-900 border border-blue-200 px-3 py-1 rounded text-xs"
                                                                        >
                                                                            Request
                                                                        </button>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleEditClick(book)}
                                                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                                title="Edit Book"
                                                                            >
                                                                                <Edit2 size={18} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteClick(book)}
                                                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                                                title="Delete Book"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {totalPages > 0 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 border-t border-gray-100 pt-6">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span>Show:</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={30}>30</option>
                                        <option value={60}>60</option>
                                        <option value={120}>120</option>
                                    </select>
                                    <span>per page</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-50 hover:bg-gray-50 text-sm font-medium hidden sm:block"
                                    >
                                        First
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-50 hover:bg-gray-50 text-sm font-medium"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-50 hover:bg-gray-50 text-sm font-medium"
                                    >
                                        Next
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-50 hover:bg-gray-50 text-sm font-medium hidden sm:block"
                                    >
                                        Last
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <BookModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingBook(null);
                        setIsReadOnlyModal(false);
                    }}
                    onSubmit={handleSaveBook}
                    initialData={editingBook}
                    isReadOnly={isReadOnlyModal}
                />

                {/* Delete Confirmation Modal */}
                {bookToDelete && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Delete "{bookToDelete.name}"?</h3>
                                    <p className="text-sm text-gray-500 mt-2">Choose how you want to remove this book.</p>
                                </div>

                                <div className="grid grid-cols-1 w-full gap-3 mt-4">
                                    <button
                                        onClick={() => confirmDelete('soft')}
                                        className="w-full py-4 px-4 !bg-indigo-200 hover:!bg-indigo-300 text-indigo-900 font-medium rounded-xl transition-all border !border-indigo-300 hover:!border-indigo-400 hover:shadow-md flex flex-col items-center group/soft"
                                    >
                                        <span className="flex items-center gap-2 text-lg"><RefreshCcw size={20} className="group-hover/soft:-rotate-180 transition-transform duration-500" /> Disable Book</span>
                                        <span className="text-sm text-indigo-700 font-normal mt-1">Hide from users (Reversible)</span>
                                    </button>

                                    <button
                                        onClick={() => confirmDelete('hard')}
                                        className="w-full py-4 px-4 !bg-red-200 hover:!bg-red-300 text-red-900 font-medium rounded-xl transition-all border !border-red-300 hover:!border-red-400 hover:shadow-md flex flex-col items-center group/hard"
                                    >
                                        <span className="flex items-center gap-2 text-lg"><Trash2 size={20} className="group-hover/hard:scale-110 transition-transform" /> Delete Permanently</span>
                                        <span className="text-sm text-red-800/80 font-normal mt-1">Remove data forever (Irreversible)</span>
                                    </button>
                                </div>

                                <button
                                    onClick={() => setBookToDelete(null)}
                                    className="mt-2 text-gray-400 hover:text-gray-600 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
