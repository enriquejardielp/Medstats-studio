import React, { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import AuthShell from '../components/brand/AuthShell';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail;
      if (detail) {
        setError(typeof detail === 'string' ? detail : 'Email o contraseña incorrectos');
      } else if (err.message === 'Network Error' || !err.response) {
        setError(
          'No se pudo conectar con el servidor. Si estaba en reposo, puede tardar unos 40 segundos en arrancar. Reintenta en unos instantes.'
        );
      } else {
        setError(err.message || 'Email o contraseña incorrectos');
      }
    } finally {
      setLoading(false);
    }
  };

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false);
  };

  const errorId = error ? 'login-error' : undefined;

  return (
    <AuthShell
      eyebrow="Acceso investigadores"
      title="Bienvenido de nuevo"
      subtitle="Inicia sesión para continuar con tus proyectos y análisis."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="ms-auth-link">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="ms-auth-form" aria-busy={loading}>
        <div className="ms-auth-field">
          <label className="ms-label" htmlFor="login-email">
            Email
          </label>
          <div className="ms-input-icon">
            <Mail size={16} aria-hidden="true" />
            <input
              id="login-email"
              className="ms-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              required
              readOnly={loading}
              placeholder="medico@hospital.es"
              aria-describedby={errorId}
              aria-invalid={error ? true : undefined}
            />
          </div>
        </div>

        <div className="ms-auth-field">
          <label className="ms-label" htmlFor="login-password">
            Contraseña
          </label>
          <div className="ms-input-icon has-reveal">
            <Lock size={16} aria-hidden="true" />
            <input
              id="login-password"
              className="ms-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={trackCapsLock}
              onKeyUp={trackCapsLock}
              onBlur={() => setCapsLock(false)}
              required
              readOnly={loading}
              placeholder="Tu contraseña"
              aria-describedby={[errorId, capsLock ? 'login-caps' : null].filter(Boolean).join(' ') || undefined}
              aria-invalid={error ? true : undefined}
            />
            <button
              type="button"
              className="ms-auth-reveal"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {capsLock && (
            <p id="login-caps" className="ms-auth-hint is-warning" role="status">
              Bloq Mayús está activado.
            </p>
          )}
        </div>

        {error && (
          <div id="login-error" className="ms-alert ms-alert-error fade-in" role="alert">
            <AlertCircle size={16} className="ms-auth-alert-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="ms-btn ms-btn-primary ms-btn-lg ms-auth-submit">
          {loading ? (
            <>
              <span className="ms-auth-spinner" aria-hidden="true" />
              <span>Iniciando sesión…</span>
            </>
          ) : (
            <>
              <span>Iniciar sesión</span>
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      <aside className="ms-auth-project-notice" role="note" aria-label="Aviso sobre el proyecto">
        <ShieldAlert size={19} aria-hidden="true" />
        <div>
          <strong>Proyecto en construcción</strong>
          <p>La seguridad de esta aplicación no está asegurada. No introduzcas datos personales, clínicos identificables ni ningún otro dato sensible.</p>
        </div>
      </aside>
    </AuthShell>
  );
};

export default LoginPage;
