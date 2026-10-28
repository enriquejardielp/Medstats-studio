import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../auth/authContext';
import apiClient from '../../api/client';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import Logo from '../brand/Logo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  gatedReason?: string;
  onSuccess?: () => void;
  pendingProjectData?: {
    name: string;
    csvData: string;
    filename: string;
  } | null;
}

const getPasswordStrength = (pw: string): number => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score);
};

const STRENGTH_LABELS = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  gatedReason,
  onSuccess,
  pendingProjectData,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const { login } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setRegisterSuccess(false);
      // Evitar scroll en el fondo
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePendingProjectSave = async () => {
    if (pendingProjectData) {
      try {
        await apiClient.post('/api/projects/', {
          name: pendingProjectData.name,
          description: 'Proyecto importado desde el modo de prueba interactivo.',
          filename: pendingProjectData.filename || 'sandbox_dataset.csv',
          csv_data: pendingProjectData.csvData,
        });
      } catch (saveErr) {
        console.error('Error al guardar proyecto tras login:', saveErr);
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      await handlePendingProjectSave();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail;
      if (detail) {
        setError(typeof detail === 'string' ? detail : 'Email o contraseña incorrectos');
      } else if (err.message === 'Network Error' || !err.response) {
        setError('No se pudo conectar con el servidor. Verifica tu conexión.');
      } else {
        setError(err.message || 'Email o contraseña incorrectos');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/api/auth/register', { email: email.trim(), password });
      setRegisterSuccess(true);
      // Auto-login tras el registro exitoso
      await login(email.trim(), password);
      await handlePendingProjectSave();
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 900);
    } catch (err: any) {
      console.error('Registration error:', err);
      const detail = err.response?.data?.detail;
      if (detail) {
        setError(typeof detail === 'string' ? detail : 'Error al registrar la cuenta');
      } else {
        setError(err.message || 'Error al crear la cuenta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        backgroundColor: 'rgba(28, 25, 23, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'msFadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Encabezado con marca y botón de cierre */}
        <div
          style={{
            padding: '1.5rem 1.5rem 1.25rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: '#FAF8F5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Logo size={32} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={19} />
          </button>
        </div>

        {/* Motivo contextual de apertura (si viene de una acción bloqueada) */}
        {gatedReason && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              backgroundColor: 'var(--color-teal-50)',
              borderBottom: '1px solid var(--color-teal-200)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <Sparkles size={18} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-accent-strong)', lineHeight: 1.45 }}>
              <strong>Función de investigación:</strong> {gatedReason}
            </div>
          </div>
        )}

        {/* Notificación si hay datos pendientes del sandbox que se guardarán */}
        {pendingProjectData && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#EFF6FF',
              borderBottom: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.78rem',
              color: '#1E40AF',
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Tus datos de prueba se guardarán automáticamente en tu nueva sesión.</span>
          </div>
        )}

        {/* Selector de Pestañas (Iniciar Sesión vs Crear Cuenta) */}
        <div
          style={{
            display: 'flex',
            padding: '0.75rem 1.5rem 0',
            gap: '1rem',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            style={{
              padding: '0.5rem 0.25rem 0.75rem',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'login' ? '2.5px solid var(--color-accent)' : '2.5px solid transparent',
              color: mode === 'login' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
              fontWeight: mode === 'login' ? 700 : 500,
              fontSize: '0.92rem',
              cursor: 'pointer',
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            style={{
              padding: '0.5rem 0.25rem 0.75rem',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'register' ? '2.5px solid var(--color-accent)' : '2.5px solid transparent',
              color: mode === 'register' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
              fontWeight: mode === 'register' ? 700 : 500,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>Crear Cuenta</span>
            <span
              style={{
                fontSize: '0.65rem',
                backgroundColor: 'var(--color-teal-100)',
                color: 'var(--color-accent-strong)',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '6px',
              }}
            >
              Gratis
            </span>
          </button>
        </div>

        {/* Cuerpo del Formulario */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '72vh' }}>
          {registerSuccess ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-soft)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.25rem', margin: 0 }}>
                ¡Cuenta creada con éxito!
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                Accediendo a tu espacio clínico seguro...
              </p>
              <div className="ms-spinner" style={{ marginTop: '0.5rem' }} />
            </div>
          ) : (
            <form onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit} style={{ display: 'grid', gap: '1.15rem' }}>
              <div>
                <h3 className="ms-display" style={{ fontSize: '1.3rem', marginBottom: '0.35rem', color: 'var(--color-ink)' }}>
                  {mode === 'login' ? 'Bienvenido a tu panel clínico' : 'Crea tu cuenta de investigador'}
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {mode === 'login'
                    ? 'Accede a tus proyectos, análisis y cuadernos eCRF.'
                    : 'Disfruta de análisis bioestadísticos rigurosos con almacenamiento cifrado.'}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: 'var(--color-error-soft)',
                    border: '1px solid var(--color-error)',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    fontSize: '0.84rem',
                    color: 'var(--color-error)',
                  }}
                >
                  <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Campo Email */}
              <div>
                <label className="ms-label" htmlFor="modal-email">
                  Correo electrónico profesional
                </label>
                <div className="ms-input-icon">
                  <Mail size={16} aria-hidden="true" />
                  <input
                    id="modal-email"
                    className="ms-input"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="investigador@hospital.es"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="ms-label" htmlFor="modal-password">
                    Contraseña
                  </label>
                  {capsLock && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.7rem',
                        color: 'var(--color-warning)',
                        fontWeight: 600,
                      }}
                    >
                      <ShieldAlert size={12} /> Bloq Mayús activo
                    </span>
                  )}
                </div>
                <div className="ms-input-icon has-reveal">
                  <Lock size={16} aria-hidden="true" />
                  <input
                    id="modal-password"
                    className="ms-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                    placeholder="Mínimo 8 caracteres"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="ms-reveal-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Medidor de fortaleza para el registro */}
                {mode === 'register' && password.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div
                      style={{
                        height: '4px',
                        width: '100%',
                        backgroundColor: '#E5E7EB',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(strength / 4) * 100}%`,
                          backgroundColor:
                            strength <= 1 ? '#EF4444' : strength === 2 ? '#F59E0B' : strength === 3 ? '#3B82F6' : '#10B981',
                          transition: 'width 0.25s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                      <span>Seguridad: {STRENGTH_LABELS[strength]}</span>
                      {strength >= 3 && <span style={{ color: '#10B981', fontWeight: 600 }}>Adecuada para datos clínicos</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={loading}
                className="ms-btn ms-btn-primary ms-btn-lg"
                style={{
                  width: '100%',
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                }}
              >
                {loading ? (
                  <>
                    <div className="ms-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    <span>{mode === 'login' ? 'Iniciando sesión…' : 'Creando cuenta…'}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Entrar a MedStats' : 'Comenzar a Analizar Gratis'}</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Pie con garantías de privacidad y switch */}
        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#FAF8F5',
            borderTop: '1px solid var(--color-border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>🔒 Cifrado de extremo a extremo</span>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};
