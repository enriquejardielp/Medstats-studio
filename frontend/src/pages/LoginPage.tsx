import React, { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import AuthShell from '../components/brand/AuthShell';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Acceso investigadores"
      title="Bienvenido de nuevo"
      subtitle="Inicia sesión para continuar con tus proyectos y análisis."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={{ color: 'var(--color-accent)', fontWeight: 700, textDecoration: 'none' }}>
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div>
          <label className="ms-label" htmlFor="login-email">Email</label>
          <div className="ms-input-icon">
            <Mail size={16} />
            <input
              id="login-email"
              className="ms-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="medico@hospital.es"
            />
          </div>
        </div>

        <div>
          <label className="ms-label" htmlFor="login-password">Contraseña</label>
          <div className="ms-input-icon">
            <Lock size={16} />
            <input
              id="login-password"
              className="ms-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="ms-alert ms-alert-error fade-in" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="ms-btn ms-btn-primary" style={{ width: '100%', padding: '0.8rem', marginTop: '0.4rem' }}>
          {loading ? 'Iniciando sesión…' : (<>Iniciar sesión <ArrowRight size={16} /></>)}
        </button>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
