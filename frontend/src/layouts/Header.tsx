import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const labels: Record<string, string> = {
  dashboard: 'Panel',
  projects: 'Proyectos',
  new: 'Nuevo',
  forms: 'Formularios eCRF',
};

const Header: React.FC = () => {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, index) => ({
    label: labels[part] || (/^\d+$/.test(part) ? `Proyecto #${part}` : part.charAt(0).toUpperCase() + part.slice(1)),
    href: '/' + pathParts.slice(0, index + 1).join('/'),
  }));
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <header style={{
      height: '3.75rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.75rem', borderBottom: '1px solid var(--color-border)',
      background: 'rgba(245, 243, 238, 0.85)', backdropFilter: 'blur(10px)', zIndex: 10,
    }}>
      <nav aria-label="Ruta" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}>
        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 600 }}>MedStats</span>
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ChevronRight size={14} color="var(--color-text-tertiary)" />
              {isLast ? (
                <span style={{ color: 'var(--color-ink)', fontWeight: 700 }}>{crumb.label}</span>
              ) : (
                <Link to={crumb.href} style={{ color: 'var(--color-text-secondary)', fontWeight: 600, textDecoration: 'none' }}>{crumb.label}</Link>
              )}
            </span>
          );
        })}
      </nav>
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', fontWeight: 500, textTransform: 'capitalize' }}>{today}</span>
    </header>
  );
};

export default Header;
