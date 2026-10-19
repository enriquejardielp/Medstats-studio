import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import type { Project } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileSpreadsheet, Trash2, ArrowRight, AlertCircle, FolderPlus } from 'lucide-react';

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
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

  const filtered = projects.filter(p =>
    [p.name, p.filename, p.description].some(v => v?.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <div className="ms-page" style={{ padding: '0.5rem 0.5rem 3rem' }}>
      <div className="ms-page-header slide-up">
        <div>
          <div className="ms-eyebrow">Datos</div>
          <h1 className="ms-page-title">Mis proyectos</h1>
          <p className="ms-page-subtitle">Cada proyecto agrupa un dataset y todos sus análisis.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="ms-input-icon" style={{ width: 240 }}>
            <Search size={16} />
            <input className="ms-input" placeholder="Buscar proyectos…" value={query} onChange={e => setQuery(e.target.value)} style={{ borderRadius: 999, padding: '0.55rem 0.9rem 0.55rem 2.6rem', fontSize: '0.875rem' }} />
          </div>
          <button onClick={() => navigate('/projects/new')} className="ms-btn ms-btn-primary">
            <Plus size={16} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {[0, 1, 2].map(i => <div key={i} className="ms-skeleton" style={{ height: 168, borderRadius: 14 }} />)}
        </div>
      ) : error ? (
        <div className="ms-alert ms-alert-error" role="alert">
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="ms-card slide-up" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderPlus size={24} />
          </span>
          <h2 className="ms-display" style={{ fontSize: '1.5rem', marginTop: '1.25rem' }}>Todavía no tienes proyectos</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>Importa un CSV o Excel para empezar a analizar.</p>
          <Link to="/projects/new" className="ms-btn ms-btn-primary" style={{ marginTop: '1.5rem' }}>
            <Plus size={16} /> Crear el primero
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', padding: '2rem 0', textAlign: 'center' }}>Ningún proyecto coincide con “{query}”.</p>
      ) : (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filtered.map(p => (
            <article key={p.id} className="ms-card ms-card-hover" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--color-ink)', color: '#3fc1b3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileSpreadsheet size={18} />
                </span>
                <button
                  className="ms-btn ms-btn-ghost ms-btn-danger ms-btn-sm"
                  title="Eliminar proyecto"
                  aria-label={`Eliminar ${p.name}`}
                  onClick={e => { e.stopPropagation(); handleDelete(p.id); }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h3>
                <p className="ms-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.filename}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '0.9rem', marginTop: 'auto' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="ms-badge">{p.row_count} filas</span>
                  <span className="ms-badge" style={{ background: 'var(--color-bg-deep)', color: 'var(--color-ink-soft)' }}>{p.columns?.length ?? 0} vars</span>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
                  {new Date(p.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <ArrowRight size={14} />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
