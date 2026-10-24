import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Mail, Lock, UserPlus, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowRight } from 'lucide-react';
import AuthShell from '../components/brand/AuthShell';

const REDIRECT_DELAY_MS = 2000;

/* Indicador orientativo: no bloquea el registro, solo guía al usuario. */
const STRENGTH_LABELS = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

const getStrength = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score);
};

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const redirectTimer = useRef<number | null>(null);

  const strength = useMemo(() => getStrength(password), [password]);

  // Si el usuario sale de la página antes de la redirección, se cancela el temporizador
  useEffect(() => {
    return () => {
      if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/api/auth/register', { email: email.trim(), password });
      setSuccess(true);
      redirectTimer.current = window.setTimeout(() => navigate('/login'), REDIRECT_DELAY_MS);
    } catch (err: any) {
      console.error('Registration error:', err);
      const detail = err.response?.data?.detail;
      if (detail) {
        setError(typeof detail === 'string' ? detail : 'Error al registrarse');
      } else if (err.message === 'Network Error' || !err.response) {
        setError(
          'No se pudo conectar con el servidor. Si estaba en reposo, puede tardar unos 40 segundos en arrancar. Reintenta en unos instantes.'
        );
      } else {
        setError(err.message || 'Error al registrarse');
      }
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
    navigate('/login');
  };

  const errorId = error ? 'register-error' : undefined;

  return (
    <AuthShell
      eyebrow={success ? 'Todo listo' : 'Nueva cuenta'}
      title={success ? 'Cuenta creada' : 'Empieza a analizar'}
      subtitle={
        success
          ? 'Ya puedes iniciar sesión con tu email y tu contraseña.'
          : 'Crea tu cuenta gratuita de MedStats Studio en segundos.'
      }
      footer={
        success ? undefined : (
          <>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="ms-auth-link">
              Inicia sesión
            </Link>
          </>
        )
      }
    >
      {success ? (
        <div className="ms-auth-success fade-in" role="status">
          <span className="ms-auth-success-icon" aria-hidden="true">
            <CheckCircle2 size={28} />
          </span>
          <p className="ms-auth-success-text">
            Registro exitoso. Te estamos llevando al inicio de sesión…
          </p>
          <button type="button" className="ms-btn ms-btn-primary ms-btn-lg ms-auth-submit" onClick={goToLogin}>
            <span>Ir a iniciar sesión</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="ms-auth-form" aria-busy={loading}>
          <div className="ms-auth-field">
            <label className="ms-label" htmlFor="register-email">
              Email
            </label>
            <div className="ms-input-icon">
              <Mail size={16} aria-hidden="true" />
              <input
                id="register-email"
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
            <label className="ms-label" htmlFor="register-password">
              Contraseña
            </label>
            <div className="ms-input-icon has-reveal">
              <Lock size={16} aria-hidden="true" />
              <input
                id="register-password"
                className="ms-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                required
                readOnly={loading}
                placeholder="Crea una contraseña segura"
                aria-describedby={['register-password-hint', errorId].filter(Boolean).join(' ')}
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

            <div className="ms-auth-strength" data-level={strength}>
              <div className="ms-auth-strength-bars" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={`ms-auth-strength-bar ${n <= strength ? 'is-on' : ''}`} />
                ))}
              </div>
              <span className="ms-auth-strength-label" aria-live="polite">
                {strength > 0 ? STRENGTH_LABELS[strength] : ''}
              </span>
            </div>
            <p id="register-password-hint" className="ms-auth-hint">
              Recomendado: 8 o más caracteres, combinando mayúsculas, números y símbolos.
            </p>
          </div>

          {error && (
            <div id="register-error" className="ms-alert ms-alert-error fade-in" role="alert">
              <AlertCircle size={16} className="ms-auth-alert-icon" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="ms-btn ms-btn-primary ms-btn-lg ms-auth-submit">
            {loading ? (
              <>
                <span className="ms-auth-spinner" aria-hidden="true" />
                <span>Creando cuenta…</span>
              </>
            ) : (
              <>
                <UserPlus size={16} aria-hidden="true" />
                <span>Crear cuenta</span>
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default RegisterPage;
