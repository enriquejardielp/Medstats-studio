import { useAuth } from '../auth/authContext';
import { FolderOpen, Activity, Clock, TrendingUp, TrendingDown } from 'lucide-react';

const stats = [
  { label: 'Proyectos activos', value: 12, change: '+2', trend: 'up', icon: FolderOpen, color: '#3b82f6', bgColor: '#eff6ff' },
  { label: 'Análisis ejecutados', value: 87, change: '+12', trend: 'up', icon: Activity, color: '#10b981', bgColor: '#ecfdf5' },
  { label: 'Horas ahorradas', value: '24h', change: '-3h', trend: 'down', icon: Clock, color: '#8b5cf6', bgColor: '#f5f3ff' },
];

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>
          Bienvenido{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>Resumen de actividad de tu cuenta</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {stats.map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              border: '1px solid #f1f5f9',
              transition: 'box-shadow 0.3s, transform 0.2s',
              cursor: 'default'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '8px', background: stat.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                background: stat.trend === 'up' ? '#ecfdf5' : '#fef3c7',
                color: stat.trend === 'up' ? '#065f46' : '#92400e'
              }}>
                {stat.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {stat.change}
              </span>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0f172a' }}>{stat.value}</p>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #f1f5f9' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Actividad reciente</h3>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>No hay actividad reciente para mostrar</p>
      </div>
    </div>
  );
};

export default DashboardPage;
