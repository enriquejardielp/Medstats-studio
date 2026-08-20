import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { Home, FolderOpen, BarChart3, LogOut, User, Database } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/projects', label: 'Proyectos', icon: FolderOpen },
    { to: '/analysis', label: 'Análisis', icon: BarChart3 },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(8px)',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        {/* Logo */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '2rem', height: '2rem', background: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', lineHeight: 1.1 }}>MedStats</h1>
              <p style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Studio</p>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '1rem 0.5rem' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#0f172a' : '#64748b',
                  background: isActive ? '#f1f5f9' : 'transparent',
                  textDecoration: 'none',
                  marginBottom: '0.125rem',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={18} />
                {item.label}
                {isActive && <div style={{ marginLeft: 'auto', width: '4px', height: '20px', background: '#3b82f6', borderRadius: '2px' }}></div>}
              </Link>
            );
          })}
        </nav>

        {/* Perfil */}
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '2rem', height: '2rem', background: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} color="#64748b" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
              <p style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Investigador</p>
            </div>
            <button
              onClick={logout}
              style={{ padding: '0.375rem', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              title="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: '#fafbfc' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
