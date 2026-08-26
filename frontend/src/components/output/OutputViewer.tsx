import React, { useState } from 'react';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  FolderTree,
  Trash2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { AnalysisResult } from '../../types/analysis';
import { AnalysisBlock } from './AnalysisBlock';

interface Props {
  results: AnalysisResult[];
  onDeleteResult: (analysisId: string) => void;
  onClearAll: () => void;
}

export const OutputViewer: React.FC<Props> = ({ results, onDeleteResult, onClearAll }) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    results.length > 0 ? results[0].metadata.analysis_id : null
  );

  const getAnalysisIcon = (type: string) => {
    switch (type) {
      case 'descriptive':
        return <BarChart3 size={15} color="#2563eb" />;
      case 'correlation':
        return <TrendingUp size={15} color="#16a34a" />;
      case 'linear-regression':
        return <FileSpreadsheet size={15} color="#9333ea" />;
      default:
        return <BarChart3 size={15} color="#64748b" />;
    }
  };

  const scrollToAnalysis = (analysisId: string) => {
    setSelectedId(analysisId);
    const element = document.getElementById(`analysis-block-${analysisId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!results || results.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '12px',
          color: '#64748b',
        }}
      >
        <Sparkles size={36} color="#94a3b8" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 0.5rem 0' }}>
          Visor de Resultados (Output Viewer)
        </h3>
        <p style={{ maxWidth: '450px', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
          Ejecuta un análisis estadístico (Descriptivos, Correlación o Regresión) para generar un informe estructurado interactivo de 5 capas (Stata + SPSS + R).
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '1.5rem',
        minHeight: '600px',
        alignItems: 'start',
      }}
    >
      {/* 1. Árbol / Índice Lateral (Estilo SPSS Output Navigator) */}
      <div
        style={{
          position: 'sticky',
          top: '1rem',
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Cabecera del Navegador */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b' }}>
            <FolderTree size={16} color="#2563eb" />
            <span>ÍNDICE DE RESULTADOS</span>
          </div>

          <button
            onClick={onClearAll}
            title="Borrar todo el historial de resultados"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Lista de Análisis (Árbol) */}
        <div style={{ maxHeight: '550px', overflowY: 'auto', padding: '0.5rem' }}>
          {results.map((res, index) => {
            const isSelected = selectedId === res.metadata.analysis_id;
            return (
              <button
                key={res.metadata.analysis_id}
                onClick={() => scrollToAnalysis(res.metadata.analysis_id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                  color: isSelected ? '#1d4ed8' : '#334155',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '2px',
                  transition: 'all 0.1s',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '0.8rem',
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  {getAnalysisIcon(res.metadata.analysis_type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {index + 1}. {res.metadata.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: isSelected ? '#3b82f6' : '#94a3b8' }}>
                    {res.metadata.created_at ? new Date(res.metadata.created_at).toLocaleTimeString() : ''}
                  </div>
                </div>

                <ChevronRight size={13} color={isSelected ? '#2563eb' : '#cbd5e1'} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Documento Principal con los Bloques de Resultados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {results.map(res => (
          <AnalysisBlock
            key={res.metadata.analysis_id}
            result={res}
            onDelete={onDeleteResult}
          />
        ))}
      </div>
    </div>
  );
};
