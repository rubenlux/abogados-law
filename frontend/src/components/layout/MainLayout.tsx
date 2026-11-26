
import React from 'react';
import {
    LayoutDashboard,
    Scale,
    Calendar,
    Clock,
    FileText,
    FolderOpen,
    PenTool,
    Settings,
    Bot,
    LogOut,
    BookOpen,
    Users,
    Sparkles,
    Search,
    Plug,
    FileSearch,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../core/store/useAuthStore';
import { apiClient } from '../../core/api/client';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);

    const navItems = [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Clientes', icon: Users, path: '/clientes' },
        { label: 'Expedientes', icon: Scale, path: '/expedientes' },
        { label: 'Escritos', icon: PenTool, path: '/escritos' },
        { label: 'Plantillas', icon: FileText, path: '/plantillas' },
        { label: 'Documentos', icon: FolderOpen, path: '/documentos' },
        { label: 'Jurisprudencia', icon: BookOpen, path: '/jurisprudencia' },
        { label: 'Agenda Legal', icon: Calendar, path: '/agenda' },
        { label: 'Vencimientos', icon: Clock, path: '/vencimientos' },
        { label: 'Gestión Judicial', icon: Bot, path: '/judicial' },
        { label: 'Portal Clientes', icon: Bot, path: '/portal-admin' },
        { label: 'Admin AI', icon: Settings, path: '/admin' },
        { label: 'Configuración', icon: Settings, path: '/settings' },
    ];

    const iaLegalItems = [
        { label: 'Generador de Escritos', icon: Sparkles, path: '/ia-legal/generador-escritos', pending: false },
        { label: 'Asistente IA', icon: Bot, path: '/ia-legal/asistente', pending: false },
        { label: 'Análisis IA', icon: FileSearch, path: '/ia-legal/analisis', pending: false },
        { label: 'Jurisprudencia IA', icon: Search, path: '/ia-legal/jurisprudencia', pending: true },
        { label: 'Asistentes externos', icon: Plug, path: '/ia-legal/asistentes-externos', pending: true },
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

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
                    {navItems.slice(0, 6).map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
                                    borderRadius: 'var(--radius-md)', textDecoration: 'none', transition: 'all 0.2s',
                                    backgroundColor: isActive ? 'hsl(222 47% 16%)' : 'transparent',
                                    color: isActive ? 'white' : 'hsl(215 20% 65%)',
                                    fontWeight: isActive ? 600 : 400
                                }}
                            >
                                <item.icon size={19} style={{ color: isActive ? 'hsl(var(--hsl-accent))' : 'currentColor' }} />
                                {item.label}
                            </Link>
                        );
                    })}

                    {/* Sección Principal: IA Legal (AUTH-09 Addendum §7) */}
                    <div
                        style={{
                            marginTop: '0.75rem',
                            marginBottom: '0.35rem',
                            padding: '0.45rem 0.75rem 0.25rem',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'hsl(var(--hsl-accent))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                        }}
                    >
                        <Sparkles size={13} />
                        <span>IA Legal</span>
                    </div>

                    {iaLegalItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                                    padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', textDecoration: 'none',
                                    transition: 'all 0.2s',
                                    backgroundColor: isActive ? 'hsl(222 47% 16%)' : 'transparent',
                                    color: isActive ? 'white' : 'hsl(215 20% 65%)',
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: '0.88rem',
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <item.icon size={17} style={{ color: isActive ? 'hsl(var(--hsl-accent))' : 'currentColor' }} />
                                    {item.label}
                                </span>
                                {item.pending && (
                                    <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'hsl(215 20% 60%)' }}>
                                        Próx.
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }} />

                    {navItems.slice(6).map((item) => {
                        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
                                    borderRadius: 'var(--radius-md)', textDecoration: 'none', transition: 'all 0.2s',
                                    backgroundColor: isActive ? 'hsl(222 47% 16%)' : 'transparent',
                                    color: isActive ? 'white' : 'hsl(215 20% 65%)',
                                    fontWeight: isActive ? 600 : 400
                                }}
                            >
                                <item.icon size={19} style={{ color: isActive ? 'hsl(var(--hsl-accent))' : 'currentColor' }} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div
                        onClick={async () => {
                            await apiClient.auth.logout();
                            navigate('/login', { replace: true });
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
