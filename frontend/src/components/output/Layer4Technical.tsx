import React from 'react';
import { Cpu, Terminal, Package } from 'lucide-react';
import type { TechnicalDetails, AnalysisMetadata } from '../../types/analysis';

interface Props {
  technical: TechnicalDetails;
  metadata: AnalysisMetadata;
}

export const Layer4Technical: React.FC<Props> = ({ technical, metadata }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
      {/* 1. Especificación del Modelo */}
      <div
        style={{
          backgroundColor: '#f8f6f1',
          border: '1px solid #e3ded3',
          borderRadius: '10px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#1e293b', marginBottom: '0.2rem' }}>
          <Cpu size={16} color="#0d7c72" />
          <span style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Especificación del Modelo
          </span>
        </div>

        <div style={{ fontSize: '0.84rem', color: '#334155' }}>
          <strong style={{ color: '#10232e' }}>Método:</strong> {technical.method}
        </div>

        {technical.formula && (
          <div style={{ fontSize: '0.82rem', color: '#334155' }}>
            <strong style={{ color: '#10232e' }}>Fórmula R:</strong>{' '}
            <code
              style={{
                backgroundColor: '#e3ded3',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.78rem',
                fontFamily: 'ui-monospace, monospace',
                color: '#10232e',
              }}
            >
              {technical.formula}
            </code>
          </div>
        )}

        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
          <strong style={{ color: '#10232e' }}>Muestra Válida:</strong> N = {metadata.valid_observations}{' '}
          {metadata.missing_observations ? `(${metadata.missing_observations} valores perdidos omitidos)` : ''}
        </div>
      </div>

      {/* 2. Criterios de Ajuste / Información */}
      {(technical.aic !== undefined || technical.bic !== undefined || technical.degrees_of_freedom !== undefined || technical.log_likelihood !== undefined) && (
        <div
          style={{
            backgroundColor: '#f8f6f1',
            border: '1px solid #e3ded3',
            borderRadius: '10px',
            padding: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#1e293b', marginBottom: '0.2rem' }}>
            <Terminal size={16} color="#7c3aed" />
            <span style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ajuste y Grados de Libertad
            </span>
          </div>

          {technical.degrees_of_freedom !== undefined && (
            <div style={{ fontSize: '0.84rem', color: '#334155' }}>
              <strong style={{ color: '#10232e' }}>Grados de libertad (df):</strong>{' '}
              {Array.isArray(technical.degrees_of_freedom) ? technical.degrees_of_freedom.join(', ') : technical.degrees_of_freedom}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {technical.aic !== undefined && technical.aic !== null && (
              <span
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <strong style={{ color: '#10232e' }}>AIC:</strong> {technical.aic.toFixed(2)}
              </span>
            )}

            {technical.bic !== undefined && technical.bic !== null && (
              <span
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <strong style={{ color: '#10232e' }}>BIC:</strong> {technical.bic.toFixed(2)}
              </span>
            )}

            {technical.log_likelihood !== undefined && technical.log_likelihood !== null && (
              <span
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <strong style={{ color: '#10232e' }}>LogLik:</strong> {technical.log_likelihood.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Dependencias y Entorno R */}
      <div
        style={{
          backgroundColor: '#f8f6f1',
          border: '1px solid #e3ded3',
          borderRadius: '10px',
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#1e293b', marginBottom: '0.2rem' }}>
          <Package size={16} color="#059669" />
          <span style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Entorno y Reproducibilidad
          </span>
        </div>

        <div style={{ fontSize: '0.84rem', color: '#334155' }}>
          <strong style={{ color: '#10232e' }}>Motor Estadístico:</strong> {technical.r_version || 'R 4.3+ Core Engine'}
        </div>

        {technical.packages_used && technical.packages_used.length > 0 && (
          <div style={{ fontSize: '0.82rem', color: '#334155' }}>
            <strong style={{ color: '#10232e' }}>Paquetes de R:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {technical.packages_used.map(pkg => (
                <span
                  key={pkg}
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                  }}
                >
                  {pkg}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
