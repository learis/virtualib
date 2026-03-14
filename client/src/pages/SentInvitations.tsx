import { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import api from '../services/api';

interface Invitation {
    id: string;
    email: string;
    status: string;
    expires_at: string;
    created_at: string;
    library: { name: string };
    sender: { name: string; surname: string; email: string; id: string };
}

export const SentInvitations = () => {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInvitations = async () => {
        setIsLoading(true);
        try {
            const response = await api.get<Invitation[]>('/users/invitations');
            setInvitations(response.data);
        } catch (error) {
            console.error('Failed to fetch invitations', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvitations();
    }, []);

    const handleResend = async (id: string) => {
        try {
            await api.post(`/users/invitations/${id}/resend`);
            alert('Invitation resent successfully');
            fetchInvitations();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to resend invitation');
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this invitation?')) return;
        try {
            await api.post(`/users/invitations/${id}/cancel`);
            alert('Invitation canceled successfully');
            fetchInvitations();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to cancel invitation');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this invitation permanently?')) return;
        try {
            await api.delete(`/users/invitations/${id}`);
            alert('Invitation deleted successfully');
            fetchInvitations();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to delete invitation');
        }
    };

    const getStatusBadge = (status: string, expiresAt: string) => {
        const isExpired = new Date(expiresAt) < new Date();
        if (status === 'PENDING') {
            if (isExpired) {
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1 w-max"><Clock size={12} />Timeout</span>;
            }
            return <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 w-max"><Mail size={12} />Sent</span>;
        }
        if (status === 'ACCEPTED') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200 flex items-center gap-1 w-max"><CheckCircle size={12} />Accepted</span>;
        }
        if (status === 'REJECTED' || status === 'CANCELED_BY_USER') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200 flex items-center gap-1 w-max"><XCircle size={12} />Rejected</span>;
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-800">{status}</span>;
    };

    return (
        <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Sent Invitations</h1>
                    <p className="text-sm text-gray-500 font-medium">Track and manage invitations sent to new users.</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-10">Loading invitations...</div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Library</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent By</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {invitations.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            No invitations found.
                                        </td>
                                    </tr>
                                ) : (
                                    invitations.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{inv.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">{inv.library?.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">{inv.sender?.name} {inv.sender?.surname}</div>
                                                <div className="text-xs text-gray-500">{inv.sender?.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(inv.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(inv.status, inv.expires_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                {inv.status === 'PENDING' && (
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => handleResend(inv.id)}
                                                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                                            title="Resend invitation email (limited to once per 24 hours)"
                                                        >
                                                            <RefreshCw size={14} /> Resend
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancel(inv.id)}
                                                            className="text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                                                            title="Cancel this invitation"
                                                        >
                                                            <XCircle size={14} /> Cancel
                                                        </button>
                                                    </div>
                                                )}
                                                {(inv.status === 'CANCELED_BY_USER' || inv.status === 'REJECTED') && (
                                                    <div className="flex items-center justify-end gap-3 mt-1">
                                                        <button
                                                            onClick={() => handleDelete(inv.id)}
                                                            className="text-gray-500 hover:text-red-700 font-medium flex items-center gap-1"
                                                            title="Delete this invitation permanently"
                                                        >
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
