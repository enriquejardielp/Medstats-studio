import React, { useState } from 'react';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  FolderTree,
  Trash2,
  ChevronRight,
  Sparkles,
  Layers,
  Activity,
  GitCompare,
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
      case 'table1':
        return <BarChart3 size={15} color="#0d7c72" />;
      case 'compare':
      case 'anova':
        return <GitCompare size={15} color="#16a34a" />;
      case 'correlation':
        return <TrendingUp size={15} color="#9333ea" />;
      case 'linear-regression':
      case 'logistic-regression':
        return <FileSpreadsheet size={15} color="#0284c7" />;
      case 'roc-curve':
      case 'kaplan-meier':
        return <Activity size={15} color="#ea580c" />;
      default:
        return <Layers size={15} color="#64748b" />;
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
          padding: '5rem 2rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          border: '1px dashed #cbd5e1',
          borderRadius: '16px',
          color: '#64748b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            backgroundColor: '#e7f4f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            border: '1px solid #d3ece8',
          }}
        >
          <Sparkles size={32} color="#0d7c72" />
        </div>

        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#10232e',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.02em',
          }}
        >
          Visor de Informes Estadísticos
        </h3>

        <p
          style={{
            maxWidth: '520px',
            fontSize: '0.88rem',
            lineHeight: 1.6,
            color: '#64748b',
            margin: '0 0 1.5rem 0',
          }}
        >
          Selecciona una prueba estadística en el panel lateral (Descriptivos, Comparación de Grupos, Correlación, Regresión o Supervivencia) para generar un informe reproducible estructurado de 5 capas.
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#f8f6f1',
            border: '1px solid #e3ded3',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            fontSize: '0.78rem',
            color: '#475569',
          }}
        >
          <span>Estándar editorial: <strong>APA 7ª Edición</strong></span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span>Motor de cálculo: <strong>R 4.3+ Backend</strong></span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '270px 1fr',
        gap: '1.5rem',
        minHeight: '650px',
        alignItems: 'start',
      }}
    >
      {/* 1. Árbol / Índice Lateral (Estilo SPSS Output Navigator) */}
      <div
        style={{
          position: 'sticky',
          top: '1rem',
          backgroundColor: 'white',
          border: '1px solid #e3ded3',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.05)',
        }}
      >
        {/* Cabecera del Navegador */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1rem',
            backgroundColor: '#f8f6f1',
            borderBottom: '1px solid #e3ded3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderTree size={16} color="#0d7c72" />
            <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#10232e', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Índice de Salida
            </span>
            <span
              style={{
                backgroundColor: '#e7f4f2',
                color: '#0a5f58',
                border: '1px solid #b6ddd8',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '999px',
              }}
            >
              {results.length}
            </span>
          </div>

          <button
            onClick={onClearAll}
            title="Borrar todo el historial de resultados"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Lista de Análisis (Árbol) */}
        <div style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', padding: '0.5rem' }}>
          {results.map((res, index) => {
            const isSelected = selectedId === res.metadata.analysis_id;
            const pValMetric = res.summary.key_metrics.find(m => m.p_value !== undefined);
            const isSignificant = pValMetric && pValMetric.p_value !== undefined && pValMetric.p_value < 0.05;

            return (
              <button
                key={res.metadata.analysis_id}
                onClick={() => scrollToAnalysis(res.metadata.analysis_id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.8rem',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #b6ddd8' : '1px solid transparent',
                  backgroundColor: isSelected ? '#e7f4f2' : 'transparent',
                  color: isSelected ? '#0a5f58' : '#334155',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '3px',
                  transition: 'all 0.12s ease',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.82rem',
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f8f6f1';
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
                      lineHeight: 1.3,
                    }}
                  >
                    {index + 1}. {res.metadata.title}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: isSelected ? '#14958a' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '2px',
                    }}
                  >
                    <span>{res.metadata.created_at ? new Date(res.metadata.created_at).toLocaleTimeString() : ''}</span>
                    {pValMetric && (
                      <span
                        style={{
                          color: isSignificant ? '#16a34a' : '#64748b',
                          fontWeight: 700,
                        }}
                      >
                        • {pValMetric.formatted}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight
                  size={14}
                  color={isSelected ? '#0d7c72' : '#cbd5e1'}
                  style={{ flexShrink: 0 }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Documento Principal con los Bloques de Resultados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', minWidth: 0 }}>
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
