import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { LayoutDashboard, FolderOpen, LogOut, ClipboardList, Plus } from 'lucide-react';
import Logo from '../components/brand/Logo';
import Header from './Header';

const navItems = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { to: '/projects', label: 'Proyectos', icon: FolderOpen },
  { to: '/forms', label: 'Formularios eCRF', icon: ClipboardList },
];

const MainLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Investigador';
  const isFullBleed =
    location.pathname === '/forms' ||
    (location.pathname.startsWith('/projects/') &&
      location.pathname !== '/projects' &&
      location.pathname !== '/projects/new');

  return (
    <div className="ms-shell">
      <style>{`
        .ms-shell { display: flex; height: 100vh; background: var(--color-bg); }
        .ms-sidebar {
          width: 248px; flex-shrink: 0; display: flex; flex-direction: column;
          background: var(--color-sidebar-bg);
          border-right: 1px solid var(--color-sidebar-border);
          color: var(--color-sidebar-text);
        }
        .ms-nav-link {
          position: relative; display: flex; align-items: center; gap: 0.75rem;
          padding: 0.7rem 0.9rem; border-radius: var(--radius-md);
          font-size: 0.875rem; font-weight: 600; color: var(--color-sidebar-text); text-decoration: none;
        }
        .ms-nav-link:hover { color: var(--color-ink); background: rgba(88,125,113,0.08); }
        .ms-nav-link.active { color: var(--color-accent-strong); background: rgba(88,125,113,0.12); }
        .ms-nav-link.active::before {
          content: ''; position: absolute; left: -0.75rem; top: 50%; transform: translateY(-50%);
          width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: var(--color-accent);
        }
        .ms-nav-link.active svg { color: var(--color-accent-strong); }
        .ms-new-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem; border-radius: var(--radius-md); text-decoration: none;
          font-size: 0.8125rem; font-weight: 700; color: #FFFFFF; background: var(--color-accent);
          box-shadow: 0 2px 8px -2px rgba(88,125,113,0.25);
        }
        .ms-new-btn:hover { background: var(--color-accent-hover); }
        .ms-logout { padding: 0.45rem; border-radius: 8px; border: none; background: transparent; cursor: pointer; color: var(--color-sidebar-text); display: flex; }
        .ms-logout:hover { background: rgba(88,125,113,0.08); color: var(--color-ink); }
        @media (max-width: 860px) {
          .ms-sidebar { width: 72px; }
          .ms-sidebar .ms-hide-sm { display: none; }
          .ms-nav-link, .ms-new-btn { justify-content: center; }
        }
      `}</style>

      <aside className="ms-sidebar">
        <div style={{ padding: '1.4rem 1.25rem 1.6rem' }}>
          <span className="ms-hide-sm"><Logo variant="light" size={34} /></span>
        </div>

        <div style={{ padding: '0 0.75rem 1.25rem' }}>
          <NavLink to="/projects/new" className="ms-new-btn" title="Nuevo proyecto">
            <Plus size={16} strokeWidth={2.5} />
            <span className="ms-hide-sm">Nuevo proyecto</span>
          </NavLink>
        </div>

        <div className="ms-hide-sm" style={{ padding: '0 1.6rem 0.6rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
          Espacio de trabajo
        </div>
        <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/projects'} className="ms-nav-link" title={label}>
              <Icon size={18} />
              <span className="ms-hide-sm">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ margin: '0.75rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid var(--color-sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <div style={{
              width: '2.1rem', height: '2.1rem', borderRadius: '50%', flexShrink: 0,
              background: 'var(--color-accent)', color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem',
            }}>
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="ms-hide-sm" style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
            <button onClick={logout} className="ms-logout ms-hide-sm" title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: isFullBleed ? 0 : '1.5rem', background: 'var(--color-bg)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
