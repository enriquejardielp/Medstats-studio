import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import type { ExecutiveSummary } from '../../types/analysis';

interface Props {
  summary: ExecutiveSummary;
}

export const Layer1Summary: React.FC<Props> = ({ summary }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Titular Principal */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Sparkles size={16} color="#3b82f6" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
            Resumen del Hallazgo
          </span>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
          {summary.headline}
        </div>
      </div>

      {/* Grid de Métricas Clave */}
      {summary.key_metrics && summary.key_metrics.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {summary.key_metrics.map((metric, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                {metric.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                  {metric.formatted}
                </span>
                {metric.significance_star && (
                  <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.9rem' }}>
                    {metric.significance_star}
                  </span>
                )}
              </div>
              {metric.description && (
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {metric.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interpretación Estadística Prudente */}
      {summary.interpretation && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            backgroundColor: '#f8fafc',
            borderLeft: '4px solid #3b82f6',
            borderRadius: '0 8px 8px 0',
            padding: '0.85rem 1rem',
            color: '#334155',
            fontSize: '0.88rem',
            lineHeight: 1.5,
          }}
        >
          <BookOpen size={18} color="#3b82f6" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '2px', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              Interpretación Estadística
            </div>
            {summary.interpretation}
          </div>
        </div>
      )}
    </div>
  );
};
