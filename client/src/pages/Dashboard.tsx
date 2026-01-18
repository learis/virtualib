import { useEffect, useState } from 'react';
import { Book, Users, MessageSquare, BookOpen, Clock, CheckCircle, XCircle, FolderTree } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';

interface DashboardStats {
    totalBooks: number;
    totalUsers: number;
    activeLoans: number;
    pendingRequests: number;
    totalLoans: number;
    acceptedRequests: number;
    rejectedRequests: number;
    totalLibraries: number;
    totalCategories: number;
    recentRequests: Array<{
        user: { name: string; surname: string; email: string };
        book: { name: string; author: string };
        status: string;
        requested_at: string;
    }>;
    popularBooks: Array<{
        id: string;
        name: string;
        author: string;
        cover_image_path: string | null;
        loan_count: number;
    }>;
    booksByCategory: Array<{ name: string; value: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const Dashboard = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/dashboard/stats');
                setStats(res.data);
            } catch (error) {
                console.error('Failed to fetch dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return (
        <div className="flex justify-center py-32 opacity-50">
            <div className="animate-pulse w-8 h-8 bg-gray-200 rounded-full"></div>
        </div>
    );

    const cards = [
        { label: 'Total Books', value: stats?.totalBooks || 0, icon: Book, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Pending Requests', value: stats?.pendingRequests || 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Active Loans', value: stats?.activeLoans || 0, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50' },
        // New stats
        { label: 'Total Loans', value: stats?.totalLoans || 0, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Accepted', value: stats?.acceptedRequests || 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Rejected', value: stats?.rejectedRequests || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Categories', value: stats?.totalCategories || 0, icon: FolderTree, color: 'text-pink-600', bg: 'bg-pink-50' },
    ];

    const requestChartData = [
        { name: 'Total', value: (stats?.acceptedRequests || 0) + (stats?.rejectedRequests || 0) + (stats?.pendingRequests || 0) },
        { name: 'Accepted', value: stats?.acceptedRequests || 0 },
        { name: 'Rejected', value: stats?.rejectedRequests || 0 },
        { name: 'Pending', value: stats?.pendingRequests || 0 },
    ];

    return (
        <div className="max-w-[1920px] mx-auto p-8 lg:p-12">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-8">Dashboard Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md">
                            <div className={`p-4 rounded-xl ${card.bg} ${card.color}`}>
                                <Icon size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                                <h3 className="text-2xl font-bold text-gray-900 leading-none">{card.value}</h3>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Request Statistics Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-6">Request Statistics</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={requestChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                    {requestChartData.map((entry, index) => {
                                        let color = '#4F46E5'; // Default blue for Total
                                        if (entry.name === 'Accepted') color = '#10B981'; // Teal/Emerald
                                        if (entry.name === 'Rejected') color = '#EF4444'; // Red
                                        if (entry.name === 'Pending') color = '#F59E0B'; // Orange
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Categories Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800 mb-6">Books by Category</h2>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        {stats?.booksByCategory && stats.booksByCategory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.booksByCategory}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.booksByCategory.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                                opacity={activeCategories.length === 0 || activeCategories.includes(entry.name) ? 1 : 0.2}
                                                style={{ transition: 'opacity 0.3s ease' }}
                                                className="cursor-pointer"
                                                stroke="none"
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend
                                        layout={isMobile ? 'horizontal' : 'vertical'}
                                        verticalAlign={isMobile ? 'bottom' : 'middle'}
                                        align={isMobile ? 'center' : 'right'}
                                        height={undefined}
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '12px', color: '#6B7280' }}
                                        onClick={(data) => {
                                            const category = data.value as string;
                                            setActiveCategories(prev =>
                                                prev.includes(category)
                                                    ? prev.filter(c => c !== category)
                                                    : [...prev, category]
                                            );
                                        }}
                                        formatter={(value) => (
                                            <span style={{
                                                color: activeCategories.length > 0 && !activeCategories.includes(value) ? '#9CA3AF' : '#374151',
                                                fontWeight: activeCategories.includes(value) ? 600 : 400,
                                                transition: 'all 0.3s ease',
                                                cursor: 'pointer'
                                            }}>
                                                {value}
                                            </span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-gray-400">No category data available</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Requests Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-800">Recent Requests</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {stats?.recentRequests && stats.recentRequests.length > 0 ? (
                            stats.recentRequests.map((req, idx) => (
                                <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {req.user.name[0]}{req.user.surname[0]}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{req.user.name} {req.user.surname}</p>
                                            <p className="text-sm text-gray-500">wants to borrow <span className="text-gray-700 font-medium">{req.book.name}</span></p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                        {new Date(req.requested_at).toLocaleDateString()}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">No recent requests</div>
                        )}
                    </div>
                </div>

                {/* Popular Books Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-lg font-bold text-gray-800">Popular Books</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {stats?.popularBooks && stats.popularBooks.length > 0 ? (
                            stats.popularBooks.map((book) => (
                                <div key={book.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                    <div className="w-12 h-16 bg-gray-200 rounded overflow-hidden flex-shrink-0 shadow-sm border border-gray-200">
                                        {book.cover_image_path ? (
                                            <img
                                                src={book.cover_image_path}
                                                alt={book.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <Book size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-900 line-clamp-1">{book.name}</h3>
                                        <p className="text-sm text-gray-500 line-clamp-1">{book.author}</p>
                                    </div>
                                    <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap">
                                        {book.loan_count} loans
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">No data available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
