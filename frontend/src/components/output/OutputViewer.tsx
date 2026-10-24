import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  FolderTree,
  Trash2,
  ChevronRight,
  ChevronLeft,
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
  initialSelectedId?: string | null;
}

export const OutputViewer: React.FC<Props> = ({ results, onDeleteResult, onClearAll, initialSelectedId }) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId || (results.length > 0 ? results[0].metadata.analysis_id : null)
  );

  const getAnalysisIcon = (type: string) => {
    switch (type) {
      case 'descriptive':
      case 'table1':
        return <BarChart3 size={15} color="#9C4C2E" />;
      case 'compare':
      case 'anova':
        return <GitCompare size={15} color="#A65336" />;
      case 'correlation':
        return <TrendingUp size={15} color="#718477" />;
      case 'linear-regression':
      case 'logistic-regression':
        return <FileSpreadsheet size={15} color="#718477" />;
      case 'roc-curve':
      case 'kaplan-meier':
        return <Activity size={15} color="#A65336" />;
      default:
        return <Layers size={15} color="#64748b" />;
    }
  };

  useEffect(() => {
    if (initialSelectedId && results.some(result => result.metadata.analysis_id === initialSelectedId)) {
      setSelectedId(initialSelectedId);
      return;
    }
    setSelectedId(current => results.some(result => result.metadata.analysis_id === current)
      ? current
      : results[0]?.metadata.analysis_id || null);
  }, [initialSelectedId, results]);

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
            backgroundColor: '#F4E5D9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            border: '1px solid #EAD4C4',
          }}
        >
          <Sparkles size={32} color="#9C4C2E" />
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
          Ejecuta un análisis desde los datos para consultar una explicación clara junto con estimaciones, tablas, diagnósticos, gráficos y código reproducible cuando estén disponibles.
        </p>
      </div>
    );
  }

  return (
    <div
      className="analysis-output-viewer"
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
            <FolderTree size={16} color="#9C4C2E" />
            <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#10232e', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Análisis guardados
            </span>
            <span
              style={{
                backgroundColor: '#F4E5D9',
                color: '#713820',
                border: '1px solid #D9B6A0',
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

            return (
              <button
                key={res.metadata.analysis_id}
                onClick={() => setSelectedId(res.metadata.analysis_id)}
                aria-pressed={isSelected}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.8rem',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #D9B6A0' : '1px solid transparent',
                  backgroundColor: isSelected ? '#F4E5D9' : 'transparent',
                  color: isSelected ? '#713820' : '#334155',
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
                      color: isSelected ? '#8A4D31' : '#94a3b8',
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
                          color: '#716860',
                          fontWeight: 600,
                        }}
                      >
                        · {pValMetric.formatted}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight
                  size={14}
                  color={isSelected ? '#9C4C2E' : '#cbd5e1'}
                  style={{ flexShrink: 0 }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Cada resultado ocupa el área de trabajo; se navega entre análisis sin una columna interminable. */}
      <div className="analysis-output-detail">
        {(() => {
          const selectedIndex = results.findIndex(result => result.metadata.analysis_id === selectedId);
          const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
          const result = results[currentIndex];
          return result ? (
            <>
              <nav className="analysis-result-navigation" aria-label="Navegación entre resultados">
                <div>
                  <span className="analysis-result-navigation-kicker">Resultado {currentIndex + 1} de {results.length}</span>
                  <strong>{result.metadata.title}</strong>
                </div>
                <div className="analysis-result-navigation-actions">
                  <button type="button" onClick={() => setSelectedId(results[Math.max(0, currentIndex - 1)].metadata.analysis_id)} disabled={currentIndex === 0}>
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <button type="button" onClick={() => setSelectedId(results[Math.min(results.length - 1, currentIndex + 1)].metadata.analysis_id)} disabled={currentIndex === results.length - 1}>
                    Siguiente <ChevronRight size={16} />
                  </button>
                </div>
              </nav>
              <AnalysisBlock key={result.metadata.analysis_id} result={result} onDelete={onDeleteResult} />
            </>
          ) : null;
        })()}
      </div>
    </div>
  );
};
