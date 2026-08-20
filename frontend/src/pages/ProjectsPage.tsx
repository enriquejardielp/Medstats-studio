import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import type { Project } from '../types';
import { useNavigate } from 'react-router-dom';

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<Project[]>('/api/projects/');
      setProjects(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este proyecto?')) return;
    try {
      await apiClient.delete(`/api/projects/${id}`);
      fetchProjects();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  if (loading) return <p style={{ color: '#64748b' }}>Cargando proyectos...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>Mis Proyectos</h2>
        <button
          onClick={() => navigate('/projects/new')}
          style={{
            padding: '0.5rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.875rem'
          }}
        >
          + Nuevo proyecto
        </button>
      </div>
      {projects.length === 0 ? (
        <p style={{ color: '#64748b' }}>No tienes proyectos aún.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Nombre</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Archivo</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Filas</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Creado</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#0f172a' }}>{p.name}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{p.filename}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{p.row_count}</td>
                <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <button
                    onClick={() => navigate(`/projects/${p.id}`)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      marginRight: '0.5rem'
                    }}
                  >
                    📋 Ver Proyecto
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProjectsPage;
