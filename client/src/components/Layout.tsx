import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Logo } from './Logo';
import { LayoutDashboard, Book, Users, MessageSquare, Settings, LogOut, FolderTree, Building, Menu, X, Mail } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import api from '../services/api';

export const Layout = () => {
    const { logout, user } = useAuthStore();
    const location = useLocation();
    const isAdmin = user?.role === 'admin';
    const isLibrarian = user?.role === 'librarian';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        let isMounted = true;
        const fetchPendingCount = async () => {
            if (!isAdmin && !isLibrarian) return;
            try {
                const res = await api.get('/requests/pending-count');
                if (isMounted) setPendingCount(res.data.count || 0);
            } catch (error) {
                console.error('Failed to fetch pending requests count:', error);
            }
        };

        if (isAdmin || isLibrarian) {
            fetchPendingCount();
            const interval = setInterval(fetchPendingCount, 30000); // refresh every 30 seconds
            return () => {
                isMounted = false;
                clearInterval(interval);
            };
        }
    }, [isAdmin, isLibrarian]);

    const navItems = [
        ...(isAdmin || isLibrarian ? [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }] : []),
        { icon: Book, label: 'Books', path: '/books' },
        { icon: FolderTree, label: 'Categories', path: '/categories' },
        ...(isAdmin || isLibrarian ? [
            { icon: Building, label: 'Libraries', path: '/libraries' },
            { icon: Users, label: 'Users', path: '/users' },
            { icon: Mail, label: 'Invitations', path: '/sent-invitations' }
        ] : []),
        { icon: MessageSquare, label: 'Requests', path: '/requests' },
        { icon: Book, label: 'Loans', path: '/loans' },
        ...(isAdmin ? [
            { icon: Settings, label: 'Settings', path: '/settings' }
        ] : []),
    ];

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="layout">
            {/* Mobile Header */}
            <header className="mobile-header md:hidden">
                <Logo />
                <button onClick={toggleSidebar} className="p-2 text-gray-600">
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Sidebar */}
            <aside className={clsx('sidebar', isSidebarOpen && 'open')}>
                <div className="sidebar-header hidden md:flex">
                    <Logo />
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx('nav-item relative', isActive && 'active')}
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
                                {item.path === '/requests' && pendingCount > 0 && (
                                    <span className="absolute right-4 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className="user-avatar">
                            {user?.name?.[0]}
                        </div>
                        <div className="user-info">
                            <p className="user-name">{user?.name} {user?.surname || ''}</p>
                            <p className="user-role">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="btn-logout"
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="main-content">
                <div className="content-container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
