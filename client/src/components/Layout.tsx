import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Logo } from './Logo';
import { LayoutDashboard, Book, Users, MessageSquare, Settings, LogOut, FolderTree, Building, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

export const Layout = () => {
    const { logout, user } = useAuthStore();
    const location = useLocation();
    const isAdmin = user?.role === 'admin';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const navItems = [
        ...(isAdmin ? [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' }] : []),
        { icon: Book, label: 'Books', path: '/books' },
        { icon: FolderTree, label: 'Categories', path: '/categories' },
        ...(isAdmin ? [
            { icon: Building, label: 'Libraries', path: '/libraries' },
            { icon: Users, label: 'Users', path: '/users' }
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
                                className={clsx('nav-item', isActive && 'active')}
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                <Icon size={20} />
                                <span>{item.label}</span>
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
