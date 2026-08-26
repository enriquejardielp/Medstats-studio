import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { DiagnosticItem } from '../../types/analysis';

interface Props {
  diagnostics: DiagnosticItem[];
}

export const Layer3Diagnostics: React.FC<Props> = ({ diagnostics }) => {
  if (!diagnostics || diagnostics.length === 0) {
    return (
      <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
        No se requirieron pruebas de supuestos específicas para este procedimiento.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
      {diagnostics.map(diag => {
        const isPass = diag.status === 'pass';
        const isWarning = diag.status === 'warning';
        const isFail = diag.status === 'fail';

        const borderColor = isPass ? '#bbf7d0' : isWarning ? '#fde68a' : isFail ? '#fecaca' : '#e2e8f0';
        const badgeBg = isPass ? '#f0fdf4' : isWarning ? '#fffbeb' : isFail ? '#fef2f2' : '#f8fafc';
        const textColor = isPass ? '#166534' : isWarning ? '#92400e' : isFail ? '#991b1b' : '#475569';
        const Icon = isPass ? CheckCircle2 : isWarning ? AlertTriangle : isFail ? XCircle : Info;
        const iconColor = isPass ? '#16a34a' : isWarning ? '#d97706' : isFail ? '#dc2626' : '#64748b';

        return (
          <div
            key={diag.id}
            style={{
              backgroundColor: 'white',
              border: `1px solid ${borderColor}`,
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            {/* Cabecera del Diagnóstico */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon size={16} color={iconColor} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                  {diag.name}
                </span>
              </div>
              <span
                style={{
                  backgroundColor: badgeBg,
                  color: textColor,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  border: `1px solid ${borderColor}`,
                }}
              >
                {diag.status}
              </span>
            </div>

            {/* Resultado y Estadística */}
            <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
              <strong>Hallazgo:</strong> {diag.finding}
            </div>

            {diag.threshold && (
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                <strong>Criterio:</strong> {diag.threshold}
              </div>
            )}

            {/* Recomendación Metodológica */}
            {diag.recommendation && (
              <div
                style={{
                  marginTop: '0.25rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f8fafc',
                  borderLeft: '3px solid #f59e0b',
                  borderRadius: '0 4px 4px 0',
                  fontSize: '0.78rem',
                  color: '#475569',
                }}
              >
                <strong>Sugerencia:</strong> {diag.recommendation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
