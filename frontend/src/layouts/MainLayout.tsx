import { Outlet, NavLink } from 'react-router-dom';
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
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Investigador';

  return (
    <div className="ms-shell">
      <style>{`
        .ms-shell { display: flex; height: 100vh; background: var(--color-bg); }
        .ms-sidebar {
          width: 248px; flex-shrink: 0; display: flex; flex-direction: column;
          background: radial-gradient(140% 60% at 0% 0%, #1b3c48 0%, transparent 60%), var(--color-ink);
          color: rgba(255,255,255,0.72);
        }
        .ms-nav-link {
          position: relative; display: flex; align-items: center; gap: 0.75rem;
          padding: 0.65rem 0.85rem; border-radius: 10px;
          font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.62); text-decoration: none;
        }
        .ms-nav-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .ms-nav-link.active { color: #fff; background: rgba(63,193,179,0.14); }
        .ms-nav-link.active::before {
          content: ''; position: absolute; left: -0.75rem; top: 50%; transform: translateY(-50%);
          width: 3px; height: 18px; border-radius: 0 3px 3px 0; background: #3fc1b3;
        }
        .ms-nav-link.active svg { color: #3fc1b3; }
        .ms-new-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          padding: 0.65rem; border-radius: 10px; text-decoration: none;
          font-size: 0.8125rem; font-weight: 700; color: var(--color-ink); background: #3fc1b3;
        }
        .ms-new-btn:hover { background: #63d3c7; }
        .ms-logout { padding: 0.45rem; border-radius: 8px; border: none; background: transparent; cursor: pointer; color: rgba(255,255,255,0.5); display: flex; }
        .ms-logout:hover { background: rgba(255,255,255,0.08); color: #fff; }
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

        <div className="ms-hide-sm" style={{ padding: '0 1.6rem 0.6rem', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
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

        <div style={{ margin: '0.75rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <div style={{
              width: '2.1rem', height: '2.1rem', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #3fc1b3, #0d7c72)', color: 'var(--color-ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem',
            }}>
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="ms-hide-sm" style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</p>
              <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            </div>
            <button onClick={logout} className="ms-logout ms-hide-sm" title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
