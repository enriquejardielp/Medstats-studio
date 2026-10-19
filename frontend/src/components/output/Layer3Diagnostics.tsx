import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck } from 'lucide-react';
import type { DiagnosticItem } from '../../types/analysis';

interface Props {
  diagnostics: DiagnosticItem[];
}

export const Layer3Diagnostics: React.FC<Props> = ({ diagnostics }) => {
  if (!diagnostics || diagnostics.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.88rem',
          backgroundColor: '#f8f6f1',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
        }}
      >
        <ShieldCheck size={24} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
        <div>No se requirieron pruebas de supuestos específicas para este procedimiento.</div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pass':
        return {
          label: 'Supuesto Verificado',
          icon: CheckCircle2,
          iconColor: '#10b981',
          badgeBg: '#ecfdf5',
          badgeText: '#065f46',
          badgeBorder: '#a7f3d0',
          cardBorder: '#d1fae5',
          indicatorColor: '#10b981',
        };
      case 'warning':
        return {
          label: 'Precaución / Desviación',
          icon: AlertTriangle,
          iconColor: '#f59e0b',
          badgeBg: '#fffbeb',
          badgeText: '#92400e',
          badgeBorder: '#fde68a',
          cardBorder: '#fef3c7',
          indicatorColor: '#f59e0b',
        };
      case 'fail':
        return {
          label: 'Supuesto Violado',
          icon: XCircle,
          iconColor: '#ef4444',
          badgeBg: '#fef2f2',
          badgeText: '#991b1b',
          badgeBorder: '#fecaca',
          cardBorder: '#fee2e2',
          indicatorColor: '#ef4444',
        };
      default:
        return {
          label: 'Informativo',
          icon: Info,
          iconColor: '#64748b',
          badgeBg: '#f8f6f1',
          badgeText: '#334155',
          badgeBorder: '#e3ded3',
          cardBorder: '#e3ded3',
          indicatorColor: '#64748b',
        };
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {diagnostics.map(diag => {
        const config = getStatusConfig(diag.status);
        const Icon = config.icon;

        return (
          <div
            key={diag.id}
            style={{
              backgroundColor: 'white',
              border: `1px solid ${config.cardBorder}`,
              borderRadius: '10px',
              padding: '1.15rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: '0 2px 6px -2px rgba(15, 23, 42, 0.04)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'box-shadow 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 6px 16px -4px rgba(15, 23, 42, 0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 2px 6px -2px rgba(15, 23, 42, 0.04)';
            }}
          >
            {/* Barra lateral de acento de estado */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '4px',
                backgroundColor: config.indicatorColor,
              }}
            />

            {/* Cabecera del Diagnóstico */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.75rem',
                paddingLeft: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={18} color={config.iconColor} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: '#10232e',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {diag.name}
                </span>
              </div>

              <span
                style={{
                  backgroundColor: config.badgeBg,
                  color: config.badgeText,
                  border: `1px solid ${config.badgeBorder}`,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  flexShrink: 0,
                }}
              >
                {config.label}
              </span>
            </div>

            {/* Chips de Valores Estadísticos si existen */}
            {(diag.statistic_value !== undefined || diag.p_value !== undefined || diag.threshold) && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  paddingLeft: '0.25rem',
                }}
              >
                {diag.statistic_name && diag.statistic_value !== undefined && (
                  <span
                    style={{
                      backgroundColor: '#efebe3',
                      color: '#1e293b',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {diag.statistic_name} = {typeof diag.statistic_value === 'number' ? diag.statistic_value.toFixed(3) : diag.statistic_value}
                  </span>
                )}

                {diag.p_value !== undefined && (
                  <span
                    style={{
                      backgroundColor: '#e7f4f2',
                      color: '#0a5f58',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    p = {diag.p_value < 0.001 ? '< .001' : diag.p_value.toFixed(3)}
                  </span>
                )}

                {diag.threshold && (
                  <span
                    style={{
                      backgroundColor: '#f8f6f1',
                      color: '#64748b',
                      border: '1px solid #e3ded3',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                    }}
                  >
                    Criterio: {diag.threshold}
                  </span>
                )}
              </div>
            )}

            {/* Hallazgo Empírico */}
            <div
              style={{
                fontSize: '0.84rem',
                color: '#334155',
                lineHeight: 1.5,
                paddingLeft: '0.25rem',
              }}
            >
              <strong style={{ color: '#10232e' }}>Evaluación: </strong>
              {diag.finding}
            </div>

            {/* Recomendación Metodológica para el Investigador */}
            {diag.recommendation && (
              <div
                style={{
                  marginTop: '0.25rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: diag.status === 'fail' ? '#fff1f2' : '#f8f6f1',
                  borderLeft: `3px solid ${diag.status === 'fail' ? '#f43f5e' : '#14958a'}`,
                  borderRadius: '0 6px 6px 0',
                  fontSize: '0.78rem',
                  color: diag.status === 'fail' ? '#9f1239' : '#334155',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                  {diag.status === 'fail' ? '⚠️ Acción Recomendada:' : '💡 Sugerencia Metodológica:'}
                </div>
                {diag.recommendation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
