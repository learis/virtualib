import { useState, useEffect, useMemo } from 'react';
import { Check, X, Clock, BookOpen, AlertCircle, ArrowLeftRight, Search, Filter, Calendar, RefreshCcw, XCircle } from 'lucide-react';
import { getRequests, updateRequestStatus, approveReturn, rejectReturn, cancelRequest, type UnifiedRequest } from '../services/loanService';
import { useAuthStore } from '../store/authStore';

export const Requests = () => {
    const [requests, setRequests] = useState<UnifiedRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const user = useAuthStore(state => state.user);
    const isManager = user?.role === 'admin' || user?.role === 'librarian';
    const [selectedRequest, setSelectedRequest] = useState<UnifiedRequest | null>(null);

    // Filter & Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const fetchRequests = async () => {
        try {
            const data = await getRequests();
            setRequests(data);
        } catch (error) {
            console.error('Failed to fetch requests', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await updateRequestStatus(id, status);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        } catch (error) {
            alert('Failed to update request');
        }
    };

    const handleReturnApprove = async (id: string) => {
        try {
            await approveReturn(id);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'returned' as any } : r));
            // Note: 'returned' status is visually handled as Approved (Green)
        } catch (error) {
            alert('Failed to approve return');
        }
    };

    const handleReturnReject = async (id: string) => {
        try {
            await rejectReturn(id);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'return_rejected' as any } : r));
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to reject return');
        }
    };

    const handleCancelRequest = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this request?')) return;
        try {
            await cancelRequest(id);
            // Instead of filtering out, update status to 'cancelled'
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' as any } : r));
            setSelectedRequest(null);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to cancel request');
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    // Helper for status styles
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800 border-green-200';
            case 'returned': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'rejected': return 'bg-gray-100 text-gray-600 border-gray-200';
            case 'pending': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'return_requested': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'return_rejected': return 'bg-red-100 text-red-800 border-red-200';
            case 'cancelled': return 'bg-gray-100 text-gray-400 border-gray-200 line-through';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getStatusLabel = (status: string) => {
        if (status === 'return_requested') return 'Return Requested';
        if (status === 'return_rejected') return 'Return Rejected';
        if (status === 'returned') return 'Returned';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Derived Filtered List
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                req.book?.name?.toLowerCase().includes(searchLower) ||
                req.user?.name?.toLowerCase().includes(searchLower) ||
                req.user?.surname?.toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;

            // Type Filter
            if (filterType !== 'all' && req.type !== filterType) return false;

            // Status Filter
            if (filterStatus !== 'all') {
                // Group 'pending' and 'return_requested' as 'pending' for simpler UI if desired, but user asked for specific approval status
                if (filterStatus === 'pending' && req.status !== 'pending' && req.status !== 'return_requested') return false;
                if (filterStatus === 'approved' && req.status !== 'approved') return false;
                if (filterStatus === 'returned' && req.status !== 'returned') return false;
                if (filterStatus === 'rejected' && req.status !== 'rejected') return false;
                if (filterStatus === 'return_rejected' && req.status !== 'return_rejected') return false;
                if (filterStatus === 'cancelled' && req.status !== 'cancelled') return false;
            }

            // Date Filter
            if (startDate) {
                if (new Date(req.date) < new Date(startDate)) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (new Date(req.date) > end) return false;
            }

            return true;
        });
    }, [requests, searchTerm, filterType, filterStatus, startDate, endDate]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const paginatedRequests = filteredRequests.slice(
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
        setFilterType('all');
        setFilterStatus('all');
        setStartDate('');
        setEndDate('');
    };

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, filterStatus, startDate, endDate, itemsPerPage]);

    return (
        <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold">Request Management</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleClearFilters}
                        disabled={!searchTerm && filterType === 'all' && filterStatus === 'all' && !startDate && !endDate}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <XCircle size={16} />
                        Clear Filters
                    </button>
                    <button
                        onClick={fetchRequests}
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
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="all">All Types</option>
                            <option value="borrow">Borrow</option>
                            <option value="return">Return</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="returned">Returned</option>
                            <option value="rejected">Rejected</option>
                            <option value="return_rejected">Return Rejected</option>
                            <option value="cancelled">Cancelled</option>
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
                Showing {filteredRequests.length} result{filteredRequests.length !== 1 ? 's' : ''}
            </div>

            <div className="grid gap-4">
                {paginatedRequests.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-200">
                        No requests found matching your filters.
                    </div>
                )}

                {paginatedRequests.map((req) => (
                    <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow group"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center transition-colors
                                ${req.type === 'borrow' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' : 'bg-orange-50 text-orange-600 group-hover:bg-orange-100'}`}>
                                {req.type === 'borrow' ? <BookOpen size={24} /> : <ArrowLeftRight size={24} />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
                                        ${req.type === 'borrow' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-800'}`}>
                                        {req.type === 'borrow' ? 'Borrow' : 'Return'}
                                    </span>
                                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{req.book?.name || 'Unknown Book'}</h3>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                    <span>{req.user ? `${req.user.name} ${req.user.surname}` : 'Unknown User'}</span>
                                    <span>•</span>
                                    <span>{formatDateTime(req.date)}</span>
                                    {req.status === 'cancelled' && req.decided_at && (
                                        <>
                                            <span>•</span>
                                            <span className="text-red-400">Cancelled: {formatDateTime(req.decided_at)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between w-full md:w-auto gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize flex items-center gap-1 border
                                ${getStatusStyle(req.status)}`}>
                                {req.status === 'pending' && <Clock size={12} />}
                                {req.status === 'return_requested' && <AlertCircle size={12} />}
                                {(req.status === 'approved' || req.status === 'rejected' || req.status === 'returned') && (
                                    (req.status === 'approved' || req.status === 'returned') ? <Check size={12} /> : <X size={12} />
                                )}
                                {getStatusLabel(req.status)}
                            </span>

                            {/* Actions stopPropagation to prevent modal open */}
                            {isManager && (
                                <div className="flex items-center gap-2 ml-4 border-l pl-4" onClick={(e) => e.stopPropagation()}>
                                    {req.type === 'borrow' && req.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusUpdate(req.id, 'approved')}
                                                className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                title="Approve Borrow"
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(req.id, 'rejected')}
                                                className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                title="Reject Borrow"
                                            >
                                                <X size={18} />
                                            </button>
                                        </>
                                    )}
                                    {req.type === 'return' && req.status === 'return_requested' && (
                                        <>
                                            <button
                                                onClick={() => handleReturnReject(req.id)}
                                                className="px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 text-xs font-bold transition-colors border border-red-200"
                                                title="Reject Return"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleReturnApprove(req.id)}
                                                className="px-3 py-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 text-xs font-bold transition-colors border border-green-200"
                                                title="Confirm Return"
                                            >
                                                Approve
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* User Cancel Button */}
                            {!isManager && req.type === 'borrow' && req.status === 'pending' && req.user.id === user?.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelRequest(req.id);
                                    }}
                                    className="ml-4 px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {
                totalPages > 0 && (
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
                )
            }

            {/* Request Detail Modal */}
            {
                selectedRequest && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={() => setSelectedRequest(null)}
                    >
                        <div
                            className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shadow-sm text-white
                                    ${selectedRequest.type === 'borrow' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                        {selectedRequest.type === 'borrow' ? <BookOpen size={20} /> : <ArrowLeftRight size={20} />}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-900 leading-tight">{selectedRequest.book.name}</h2>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{selectedRequest.type === 'borrow' ? 'Borrow Request' : 'Return Request'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* User Info */}
                                <div className={`flex items-start gap-4 p-4 rounded-lg border
                                ${selectedRequest.type === 'borrow' ? 'bg-blue-50/50 border-blue-100' : 'bg-orange-50/50 border-orange-100'}`}>
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0
                                    ${selectedRequest.type === 'borrow' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {selectedRequest?.user?.name?.[0] || '?'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">{selectedRequest.user ? `${selectedRequest.user.name} ${selectedRequest.user.surname}` : 'Unknown User'}</p>
                                        <p className="text-xs text-gray-500 font-medium">{selectedRequest.user?.email || 'No email'}</p>
                                    </div>
                                </div>

                                {/* Request Meta */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-gray-50 rounded border border-gray-100">
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {formatDateTime(selectedRequest.date)}
                                            {selectedRequest.status === 'cancelled' && selectedRequest.decided_at && (
                                                <span className="block text-red-500 text-xs mt-1">
                                                    Cancelled: {formatDateTime(selectedRequest.decided_at)}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded border border-gray-100">
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Status</label>
                                        <div className="mt-1">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusStyle(selectedRequest.status)}`}>
                                                {getStatusLabel(selectedRequest.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {isManager && (
                                    <div className="pt-4 border-t border-gray-100 flex gap-3">
                                        {selectedRequest.type === 'borrow' && selectedRequest.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        handleStatusUpdate(selectedRequest.id, 'rejected');
                                                        setSelectedRequest(null);
                                                    }}
                                                    className="flex-1 py-2.5 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleStatusUpdate(selectedRequest.id, 'approved');
                                                        setSelectedRequest(null);
                                                    }}
                                                    className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                                >
                                                    Approve Loan
                                                </button>
                                            </>
                                        )}
                                        {selectedRequest.type === 'return' && selectedRequest.status === 'return_requested' && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        handleReturnReject(selectedRequest.id);
                                                        setSelectedRequest(null);
                                                    }}
                                                    className="flex-1 py-2.5 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                                                >
                                                    Reject Return
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        handleReturnApprove(selectedRequest.id);
                                                        setSelectedRequest(null);
                                                    }}
                                                    className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                                >
                                                    Confirm Book Return
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {!isManager && selectedRequest.type === 'borrow' && selectedRequest.status === 'pending' && selectedRequest.user.id === user?.id && (
                                    <div className="pt-4 border-t border-gray-100">
                                        <button
                                            onClick={() => handleCancelRequest(selectedRequest.id)}
                                            className="w-full py-2.5 border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            Cancel Request
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
