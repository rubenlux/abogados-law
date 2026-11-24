
import React from 'react';
import { LayoutDashboard, Scale, Calendar, FileText, Settings, Bot, LogOut, BookOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../core/store/useAuthStore';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Expedientes', icon: Scale, path: '/expedientes' },
        { label: 'Jurisprudencia', icon: BookOpen, path: '/jurisprudencia' },
        { label: 'Agenda Legal', icon: Calendar, path: '/agenda' },
        { label: 'Automatización', icon: FileText, path: '/templates' },
        { label: 'Redacción AI', icon: FileText, path: '/drafting' },
        { label: 'Gestión Judicial', icon: Bot, path: '/judicial' },
        { label: 'Portal Clientes', icon: Bot, path: '/portal-admin' },
        { label: 'Asistente IA', icon: Bot, path: '/ia' },
        { label: 'Admin AI', icon: Settings, path: '/admin' },
        { label: 'Configuración', icon: Settings, path: '/settings' },
    ];

    return (
        <div className="layout">
            <aside className="sidebar">
                <div style={{ marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
                        <Scale style={{ color: 'hsl(var(--hsl-accent))' }} />
                        <span>Abogado<span style={{ color: 'hsl(var(--hsl-accent))' }}>Virtual</span></span>
                    </h2>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-md)', textDecoration: 'none', transition: 'all 0.2s',
                                    backgroundColor: isActive ? 'hsl(222 47% 16%)' : 'transparent',
                                    color: isActive ? 'white' : 'hsl(215 20% 65%)',
                                    fontWeight: isActive ? 600 : 400
                                }}
                            >
                                <item.icon size={20} style={{ color: isActive ? 'hsl(var(--hsl-accent))' : 'currentColor' }} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div
                        onClick={() => {
                            logout();
                            localStorage.removeItem('token');
                            localStorage.removeItem('refreshToken');
                            navigate('/login');
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: 8, cursor: 'pointer' }}
                    >
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(var(--hsl-accent)), #92400e)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.8rem'
                        }}>{user?.name?.substring(0, 2).toUpperCase() || 'DR'}</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'white' }}>{user?.name || 'Dr. Usuario'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(215 20% 60%)' }}>Cerrar sesión</div>
                        </div>
                        <LogOut size={16} color="hsl(215 20% 50%)" />
                    </div>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
};
