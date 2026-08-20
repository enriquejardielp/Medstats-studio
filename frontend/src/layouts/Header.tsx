import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { Search, Bell, ChevronRight } from 'lucide-react';

const Header: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  // Breadcrumbs dinámicos
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, index) => {
    const label = part.charAt(0).toUpperCase() + part.slice(1);
    const href = '/' + pathParts.slice(0, index + 1).join('/');
    return { label, href };
  });

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumbs.length === 0 ? (
          <span className="text-slate-500 font-medium">Dashboard</span>
        ) : (
          breadcrumbs.map((crumb, i) => (
            <div key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-slate-400" />}
              <span className={i === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700 cursor-pointer'}>
                {crumb.label}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Buscador + Notificaciones + Avatar */}
      <div className="flex items-center gap-4">
        {/* Buscador */}
        <div className="relative">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition"
          >
            <Search size={18} />
          </button>
          {searchOpen && (
            <input
              autoFocus
              type="text"
              placeholder="Buscar proyectos..."
              className="absolute right-0 top-10 w-64 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 z-20"
              onBlur={() => setSearchOpen(false)}
            />
          )}
        </div>

        {/* Notificaciones */}
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition relative">
          <Bell size={18} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
