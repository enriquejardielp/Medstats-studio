import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import apiClient from '../api/client';
import type { Project } from '../types';
import { FolderOpen, Rows3, Columns3, ArrowUpRight, Upload, ClipboardList, Sparkles } from 'lucide-react';

const quickActions = [
  { to: '/projects/new', title: 'Importar dataset', text: 'Sube un CSV o Excel y empieza a explorar.', icon: Upload },
  { to: '/forms', title: 'Diseñar un eCRF', text: 'Crea formularios clínicos con validación.', icon: ClipboardList },
  { to: '/projects', title: 'Ejecutar un análisis', text: 'Tabla 1, regresiones, supervivencia y más.', icon: Sparkles },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    apiClient.get<Project[]>('/api/projects/')
      .then(res => setProjects(res.data))
      .catch(() => setProjects([]));
  }, []);

  const name = user?.full_name || user?.email?.split('@')[0];
  const totalRows = projects?.reduce((acc, p) => acc + (p.row_count || 0), 0) ?? 0;
  const totalVars = projects?.reduce((acc, p) => acc + (p.columns?.length || 0), 0) ?? 0;
  const recent = [...(projects || [])]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5);

  const stats = [
    { label: 'Proyectos', value: projects?.length ?? 0, icon: FolderOpen },
    { label: 'Observaciones', value: totalRows.toLocaleString('es-ES'), icon: Rows3 },
    { label: 'Variables', value: totalVars.toLocaleString('es-ES'), icon: Columns3 },
  ];

  return (
    <div className="ms-page" style={{ padding: '0.5rem 0.5rem 3rem' }}>
      <div className="ms-page-header slide-up">
        <div>
          <div className="ms-eyebrow">Panel principal</div>
          <h1 className="ms-page-title">{greeting()}{name ? `, ${name}` : ''}.</h1>
          <p className="ms-page-subtitle">Este es el estado de tu espacio de investigación.</p>
        </div>
        <Link to="/projects/new" className="ms-btn ms-btn-primary">
          <Upload size={16} /> Nuevo proyecto
        </Link>
      </div>

      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="ms-card" style={{ padding: '1.4rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--color-accent-soft)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} />
              </span>
            </div>
            {projects === null ? (
              <div className="ms-skeleton" style={{ height: 40, width: '45%', marginTop: '0.9rem' }} />
            ) : (
              <p className="ms-display" style={{ fontSize: '2.6rem', lineHeight: 1, marginTop: '0.9rem', color: 'var(--color-ink)' }}>{value}</p>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <section className="ms-card slide-up" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 className="ms-display" style={{ fontSize: '1.35rem' }}>Proyectos recientes</h2>
            <Link to="/projects" style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-accent)', textDecoration: 'none' }}>Ver todos</Link>
          </div>
          {projects === null ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {[0, 1, 2].map(i => <div key={i} className="ms-skeleton" style={{ height: 52 }} />)}
            </div>
          ) : recent.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px dashed var(--color-border-strong)', borderRadius: 12 }}>
              <p style={{ fontWeight: 700 }}>Aún no hay proyectos</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.3rem' }}>Importa tu primer dataset para empezar.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', display: 'grid', gap: '0.25rem' }}>
              {recent.map(p => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="ms-recent-row" style={{
                    display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.75rem 0.8rem', borderRadius: 10,
                    textDecoration: 'none', color: 'inherit',
                  }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--color-bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-ink-soft)', flexShrink: 0 }}>
                      <FolderOpen size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      <span className="ms-mono" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        {p.row_count} filas · {p.columns?.length ?? 0} variables
                      </span>
                    </span>
                    <ArrowUpRight size={16} color="var(--color-text-tertiary)" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <style>{`.ms-recent-row:hover { background: var(--color-bg); }`}</style>
        </section>

        <section className="slide-up" style={{ display: 'grid', gap: '0.75rem' }}>
          <h2 className="ms-display" style={{ fontSize: '1.35rem', padding: '0.25rem 0.25rem 0.25rem' }}>Accesos rápidos</h2>
          {quickActions.map(({ to, title, text, icon: Icon }) => (
            <Link key={title} to={to} className="ms-card ms-card-hover" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1.1rem 1.25rem', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--color-ink)', color: '#3fc1b3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{title}</span>
                <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{text}</span>
              </span>
              <ArrowUpRight size={18} color="var(--color-text-tertiary)" />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
