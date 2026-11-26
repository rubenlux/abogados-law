import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Scale, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../../core/store/useAuthStore';
import { apiClient } from '../../../core/api/client';

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage = () => {
    const navigate = useNavigate();
    const setSession = useAuthStore((state) => state.setSession);
    const [error, setError] = useState('');
    const [isDemoLoading, setIsDemoLoading] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const handleLocalDemoLogin = async () => {
        setError('');
        setIsDemoLoading(true);
        try {
            const res = await apiClient.auth.loginLocalDemo();
            if (res.status !== 'authenticated' || !res.user) {
                throw new Error('No se pudo confirmar la sesión BFF de desarrollo.');
            }
            setSession(
                {
                    id: res.user.id,
                    email: res.user.email,
                    name: res.user.fullName,
                    role: res.user.orgRole || 'LAWYER',
                },
                res.organization ?? null,
            );
            navigate('/', { replace: true });
        } catch (err) {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : 'No se pudo iniciar sesión Demo. Verifique que el backend local esté activo con LOCAL_DEMO_AUTH_ENABLED=true.';
            setError(message);
        } finally {
            setIsDemoLoading(false);
        }
    };

    const onSubmit = async (data: LoginForm) => {
        setError('');
        try {
            const res = await apiClient.auth.login(data.email, data.password);
            if (!res?.user) {
                throw new Error('Respuesta de autenticación inválida.');
            }
            setSession({
                id: res.user.id,
                email: res.user.email,
                name: res.user.fullName || res.user.name || res.user.email,
                role: res.user.orgRole || res.user.role || 'LAWYER',
            });
            navigate('/', { replace: true });
        } catch (err) {
            const status = (err as Error & { status?: number })?.status;
            if (status === 404) {
                setError(
                    'El inicio de sesión por contraseña local está deshabilitado por política BFF/OIDC. En desarrollo local, utilice "Ingresar como Socio (Demo)".',
                );
            } else {
                setError(
                    err instanceof Error && err.message
                        ? err.message
                        : 'Credenciales incorrectas o servidor no disponible',
                );
            }
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at top right, hsl(222 47% 12%), hsl(222 47% 8%))'
        }}>
            <div className="card glass" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '16px', background: 'hsl(var(--hsl-accent))',
                        color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                    }}>
                        <Scale size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Abogado Virtual</h1>
                    <p className="text-muted">Accede a tu estudio jurídico inteligente</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {error && (
                        <div style={{ padding: '0.75rem', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--hsl-danger))', fontSize: '0.875rem', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Email Profesional</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'hsl(var(--hsl-secondary))' }} />
                            <input
                                {...register('email')}
                                className="input-field"
                                style={{ paddingLeft: '2.5rem' }}
                                placeholder="nombre@estudio.com"
                            />
                        </div>
                        {errors.email && <span style={{ color: 'hsl(var(--hsl-danger))', fontSize: '0.8rem' }}>{errors.email.message}</span>}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'hsl(var(--hsl-secondary))' }} />
                            <input
                                {...register('password')}
                                type="password"
                                className="input-field"
                                style={{ paddingLeft: '2.5rem' }}
                                placeholder="••••••••"
                            />
                        </div>
                        {errors.password && <span style={{ color: 'hsl(var(--hsl-danger))', fontSize: '0.8rem' }}>{errors.password.message}</span>}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                        disabled={isSubmitting || isDemoLoading}
                    >
                        {isSubmitting ? 'Iniciando sesión...' : <>Ingresar <ArrowRight size={18} /></>}
                    </button>

                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleLocalDemoLogin}
                        disabled={isSubmitting || isDemoLoading}
                        style={{ marginTop: '0.5rem', width: '100%' }}
                    >
                        {isDemoLoading ? 'Iniciando sesión Demo...' : 'Ingresar como Socio (Demo)'}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'hsl(var(--hsl-text-muted))' }}>
                    ¿Olvidaste tu contraseña? <a href="#" style={{ color: 'hsl(var(--hsl-primary))', textDecoration: 'none' }}>Recuperar acceso</a>
                </div>

            </div>
        </div>
    );
};
