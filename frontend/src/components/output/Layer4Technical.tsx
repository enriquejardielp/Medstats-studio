import React from 'react';
import { Cpu, Terminal, Package } from 'lucide-react';
import type { TechnicalDetails, AnalysisMetadata } from '../../types/analysis';

interface Props {
  technical: TechnicalDetails;
  metadata: AnalysisMetadata;
}

export const Layer4Technical: React.FC<Props> = ({ technical, metadata }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
      {/* Ficha del Modelo */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', marginBottom: '0.25rem' }}>
          <Cpu size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>Especificación</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
          <strong>Método:</strong> {technical.method}
        </div>
        {technical.formula && (
          <div style={{ fontSize: '0.82rem', color: '#334155' }}>
            <strong>Fórmula:</strong> <code style={{ backgroundColor: '#e2e8f0', padding: '1px 4px', borderRadius: '3px' }}>{technical.formula}</code>
          </div>
        )}
        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
          <strong>Muestra Válida:</strong> N = {metadata.valid_observations}
        </div>
      </div>

      {/* Criterios de Ajuste / Información */}
      {(technical.aic !== undefined || technical.bic !== undefined || technical.degrees_of_freedom !== undefined) && (
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', marginBottom: '0.25rem' }}>
            <Terminal size={16} />
            <span style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>Ajuste y Grados de Libertad</span>
          </div>
          {technical.degrees_of_freedom !== undefined && (
            <div style={{ fontSize: '0.82rem', color: '#334155' }}>
              <strong>Grados de libertad:</strong> {Array.isArray(technical.degrees_of_freedom) ? technical.degrees_of_freedom.join(', ') : technical.degrees_of_freedom}
            </div>
          )}
          {technical.aic !== undefined && technical.aic !== null && (
            <div style={{ fontSize: '0.82rem', color: '#334155' }}>
              <strong>AIC:</strong> {technical.aic.toFixed(2)}
            </div>
          )}
          {technical.bic !== undefined && technical.bic !== null && (
            <div style={{ fontSize: '0.82rem', color: '#334155' }}>
              <strong>BIC:</strong> {technical.bic.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Dependencias y Entorno */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#475569', marginBottom: '0.25rem' }}>
          <Package size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase' }}>Entorno y Paquetes</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
          <strong>Motor Estadístico:</strong> {technical.r_version || 'R 4.3+'}
        </div>
        <div style={{ fontSize: '0.82rem', color: '#334155' }}>
          <strong>Paquetes R:</strong> {technical.packages_used.join(', ')}
        </div>
      </div>
    </div>
  );
};
