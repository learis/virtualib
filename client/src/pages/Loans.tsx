import { useState, useEffect, useMemo } from 'react';
import { BookOpen, User as UserIcon, Clock, AlertCircle, Search, Filter, Calendar, RefreshCcw, XCircle, CheckCircle } from 'lucide-react';
import { getLoans, requestReturn, approveReturn, cancelReturnRequest, type BookLoan } from '../services/loanService';
import { useAuthStore } from '../store/authStore';

export const Loans = () => {
    const [loans, setLoans] = useState<BookLoan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const user = useAuthStore(state => state.user);
    const isAdmin = user?.role === 'admin';

    // Filter & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const fetchLoans = async () => {
        setIsLoading(true);
        try {
            const data = await getLoans();
            setLoans(data);
        } catch (error) {
            console.error('Failed to fetch loans', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLoans();
    }, []);

    const handleRequestReturn = async (id: string) => {
        if (confirm('Are you sure you want to return this book?')) {
            try {
                await requestReturn(id);
                await fetchLoans();
            } catch (error) {
                console.error('Failed to request return', error);
                alert('Failed to request return');
            }
        }
    };

    const handleApproveReturn = async (id: string) => {
        if (confirm('Confirm return of this book?')) {
            try {
                await approveReturn(id);
                await fetchLoans();
            } catch (error) {
                console.error('Failed to approve return', error);
                alert('Failed to approve return');
            }
        }
    };

    const handleCancelReturn = async (id: string) => {
        if (confirm('Cancel this return request?')) {
            try {
                await cancelReturnRequest(id);
                await fetchLoans();
            } catch (error) {
                console.error('Failed to cancel return', error);
                alert('Failed to cancel return request');
            }
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Helper for status styles
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'active': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'return_requested': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'return_rejected': return 'bg-red-50 text-red-800 border-red-200';
            case 'returned': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: string) => {
        if (status === 'return_requested') return 'Return Requested';
        if (status === 'return_rejected') return 'Return Rejected';
        if (status === 'returned') return 'Returned';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    // Derived Filtered List
    const filteredLoans = useMemo(() => {
        return loans.filter(loan => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                loan.book?.name?.toLowerCase().includes(searchLower) ||
                loan.user?.name?.toLowerCase().includes(searchLower) ||
                loan.user?.surname?.toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;

            // Status Filter
            if (filterStatus !== 'all' && loan.status !== filterStatus) return false;

            // Date Filter (Borrowed At)
            if (startDate) {
                if (new Date(loan.borrowed_at) < new Date(startDate)) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (new Date(loan.borrowed_at) > end) return false;
            }

            return true;
        });
    }, [loans, searchTerm, filterStatus, startDate, endDate]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
    const paginatedLoans = filteredLoans.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setStartDate('');
        setEndDate('');
    };

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, startDate, endDate, itemsPerPage]);

    return (
        <div className="min-h-screen">
            <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Loan Management</h1>
                        <p className="text-sm text-gray-500 font-medium">Track active loans and returns</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClearFilters}
                            disabled={!searchTerm && filterStatus === 'all' && !startDate && !endDate}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <XCircle size={16} />
                            Clear Filters
                        </button>
                        <button
                            onClick={fetchLoans}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center">
                    {/* Search */}
                    <div className="relative w-full xl:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search user or book..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-sm"
                        />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center flex-wrap">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-gray-400" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="returned">Returned</option>
                                <option value="return_requested">Return Requested</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>
                </div>

                <div className="mb-4 text-sm text-gray-500 font-medium">
                    Showing {filteredLoans.length} result{filteredLoans.length !== 1 ? 's' : ''}
                </div>

                <div className="grid gap-4">
                    {paginatedLoans.length === 0 && !isLoading && (
                        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-200">
                            No loans found matching your filters.
                        </div>
                    )}

                    {paginatedLoans.map((loan) => (
                        <div
                            key={loan.id}
                            className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-shadow hover:shadow-md group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-12 bg-gray-200 rounded overflow-hidden flex-shrink-0 shadow-sm border border-gray-100">
                                    {loan.book.cover_image_path ? (
                                        <img src={loan.book.cover_image_path} className="w-full h-full object-cover" alt={loan.book.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <BookOpen size={20} />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{loan.book.name}</h3>
                                    {isAdmin && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1">
                                            <UserIcon size={14} className="text-gray-400" />
                                            <span className="font-medium">{loan.user.name} {loan.user.surname}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                                        <span>Borrowed: <span className="font-medium text-gray-900">{formatDate(loan.borrowed_at)}</span></span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                        <span className={new Date(loan.due_at) < new Date() && loan.status === 'active' ? 'text-red-600 font-bold' : ''}>
                                            Due: <span className="font-medium">{formatDate(loan.due_at)}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between w-full md:w-auto gap-4 pl-0 md:pl-4 md:border-l border-gray-100">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize flex items-center gap-1 border whitespace-nowrap
                                    ${getStatusStyle(loan.status)}`}>
                                    {loan.status === 'active' && <Clock size={12} />}
                                    {loan.status === 'return_requested' && <AlertCircle size={12} />}
                                    {loan.status === 'returned' && <CheckCircle size={12} />}
                                    {getStatusLabel(loan.status)}
                                </span>

                                <div className="flex items-center gap-2">
                                    {isAdmin ? (
                                        (loan.status === 'return_requested' || loan.status === 'active') && (
                                            <button
                                                onClick={() => handleApproveReturn(loan.id)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap
                                                    ${loan.status === 'return_requested'
                                                        ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                                    }`}
                                            >
                                                {loan.status === 'return_requested' ? 'Approve Return' : 'Mark Returned'}
                                            </button>
                                        )
                                    ) : (
                                        loan.status === 'active' ? (
                                            <button
                                                onClick={() => handleRequestReturn(loan.id)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md text-xs font-bold transition-colors whitespace-nowrap"
                                            >
                                                Return Book
                                            </button>
                                        ) : loan.status === 'return_requested' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400 italic font-medium">Processing...</span>
                                                <button
                                                    onClick={() => handleCancelReturn(loan.id)}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Cancel Return Request"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

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
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
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
                            <span className="text-sm text-gray-600 font-medium">
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
            </div>
        </div>
    );
};
