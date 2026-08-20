import React, { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useNavigate, Link } from 'react-router-dom';
import { Database, Mail, Lock, ArrowRight } from 'lucide-react';

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
    <>
      {/* Estilos críticos para el fondo animado */}
      <style>{`
        @keyframes moveGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animated-gradient-bg {
          background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
          background-size: 400% 400%;
          animation: moveGradient 8s ease infinite;
        }
      `}</style>

      <div style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <div className="animated-gradient-bg" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0
        }}></div>

        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '28rem', padding: '0 1rem' }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
          }} className="slide-up">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                backdropFilter: 'blur(4px)'
              }}>
                <Database size={28} color="white" />
              </div>
            </div>

            <h1 style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>MedStats Studio</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Análisis estadístico para clínicos
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                  Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="medico@hospital.es"
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.2)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backdropFilter: 'blur(4px)',
                  marginBottom: '1rem'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  background: loading ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              >
                {loading ? 'Iniciando sesión...' : (
                  <>
                    Iniciar sesión <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: '0.875rem', marginTop: '1.5rem' }}>
              ¿No tienes cuenta?{' '}
              <Link to="/register" style={{ color: 'white', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;