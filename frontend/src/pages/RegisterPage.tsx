import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Mail, Lock, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import AuthShell from '../components/brand/AuthShell';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await apiClient.post('/api/auth/register', { email, password });
      setSuccess('Registro exitoso. Redirigiendo al inicio de sesión...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Nueva cuenta"
      title="Empieza a analizar"
      subtitle="Crea tu cuenta gratuita de MedStats Studio en segundos."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 700, textDecoration: 'none' }}>
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div>
          <label className="ms-label" htmlFor="register-email">Email</label>
          <div className="ms-input-icon">
            <Mail size={16} />
            <input
              id="register-email"
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
          <label className="ms-label" htmlFor="register-password">Contraseña</label>
          <div className="ms-input-icon">
            <Lock size={16} />
            <input
              id="register-password"
              className="ms-input"
              type="password"
              autoComplete="new-password"
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
        {success && (
          <div className="ms-alert ms-alert-success fade-in" role="status">
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{success}</span>
          </div>
        )}

        <button type="submit" disabled={loading} className="ms-btn ms-btn-primary" style={{ width: '100%', padding: '0.8rem', marginTop: '0.4rem' }}>
          {loading ? 'Creando cuenta…' : (<><UserPlus size={16} /> Crear cuenta</>)}
        </button>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
