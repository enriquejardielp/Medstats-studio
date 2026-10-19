import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Table,
  ShieldCheck,
  Info,
  Code2,
  Clock,
  Database,
  Image as ImageIcon,
  Check,
  Copy,
} from 'lucide-react';
import type { AnalysisResult } from '../../types/analysis';
import { WarningsBanner } from './WarningsBanner';
import { Layer1Summary } from './Layer1Summary';
import { Layer2Tables } from './Layer2Tables';
import { Layer3Diagnostics } from './Layer3Diagnostics';
import { Layer4Technical } from './Layer4Technical';
import { Layer5ReproducibleCode } from './Layer5ReproducibleCode';
import { StatisticalPlots } from './StatisticalPlots';

interface Props {
  result: AnalysisResult;
  onDelete?: (analysisId: string) => void;
}

export const AnalysisBlock: React.FC<Props> = ({ result, onDelete }) => {
  const [openPlots, setOpenPlots] = useState(true);
  const [openTables, setOpenTables] = useState(true);
  const [openDiagnostics, setOpenDiagnostics] = useState(true);
  const [openTechnical, setOpenTechnical] = useState(false);
  const [openCode, setOpenCode] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const meta = result.metadata;
  const createdDate = meta.created_at ? new Date(meta.created_at).toLocaleTimeString() : '';

  const handleCopySummary = async () => {
    const textToCopy = `${meta.title}\n${result.summary.headline}\n\n${result.summary.interpretation || ''}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const getAnalysisTypeTheme = (type: string) => {
    switch (type) {
      case 'descriptive':
      case 'table1':
        return { bg: '#e7f4f2', text: '#0a5f58', border: '#b6ddd8' };
      case 'compare':
      case 'anova':
        return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
      case 'correlation':
      case 'linear-regression':
      case 'logistic-regression':
        return { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' };
      case 'roc-curve':
      case 'kaplan-meier':
        return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
      default:
        return { bg: '#efebe3', text: '#334155', border: '#cbd5e1' };
    }
  };

  const typeTheme = getAnalysisTypeTheme(meta.analysis_type);

  return (
    <div
      id={`analysis-block-${meta.analysis_id}`}
      style={{
        backgroundColor: 'white',
        border: '1px solid #e3ded3',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px -4px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1.5rem',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* 1. Cabecera del Bloque de Análisis (Estilo SPSS Output Tree Header) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          borderBottom: '1px solid #efebe3',
          paddingBottom: '1.15rem',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
            <span
              style={{
                backgroundColor: typeTheme.bg,
                color: typeTheme.text,
                border: `1px solid ${typeTheme.border}`,
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {meta.analysis_type}
            </span>

            <span
              style={{
                fontSize: '0.74rem',
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f8f6f1',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #e3ded3',
              }}
            >
              <Clock size={12} color="#94a3b8" /> {createdDate}
            </span>

            <span
              style={{
                fontSize: '0.74rem',
                color: '#0f766e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f0fdfa',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #ccfbf1',
                fontWeight: 600,
              }}
            >
              <Database size={12} /> N = {meta.sample_size} (Válidos: {meta.valid_observations})
            </span>
          </div>

          <h3
            style={{
              margin: '0 0 0.35rem 0',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#10232e',
              letterSpacing: '-0.02em',
              lineHeight: 1.3,
            }}
          >
            {meta.title}
          </h3>

          {meta.description && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
              {meta.description}
            </p>
          )}

          {/* Chips de Variables Seleccionadas */}
          {meta.variables_used && meta.variables_used.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Variables:
              </span>
              {meta.variables_used.map(v => (
                <span
                  key={v}
                  style={{
                    backgroundColor: '#f8f6f1',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Acciones de Cabecera: Copiar Resumen y Eliminar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <button
            onClick={handleCopySummary}
            title="Copiar resumen del análisis al portapapeles"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: copiedSummary ? '#ecfdf5' : '#ffffff',
              border: `1px solid ${copiedSummary ? '#86efac' : '#e3ded3'}`,
              color: copiedSummary ? '#166534' : '#475569',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            {copiedSummary ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
            <span>{copiedSummary ? 'Copiado' : 'Copiar'}</span>
          </button>

          {onDelete && (
            <button
              onClick={() => onDelete(meta.analysis_id)}
              title="Eliminar este bloque de resultados"
              style={{
                background: 'transparent',
                border: '1px solid #e3ded3',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: '6px',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = '#fca5a5';
                e.currentTarget.style.backgroundColor = '#fef2f2';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.borderColor = '#e3ded3';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Advertencias Estadísticas Críticas */}
      {result.warnings && result.warnings.length > 0 && (
        <WarningsBanner warnings={result.warnings} />
      )}

      {/* 3. CAPA 1: Resumen Ejecutivo (Siempre visible) */}
      <Layer1Summary summary={result.summary} />

      {/* 3.1 Gráficos Estadísticos Contextuales */}
      {result.plots && result.plots.length > 0 && (
        <div style={{ border: '1px solid #e3ded3', borderRadius: '10px', overflow: 'hidden' }}>
          <button
            onClick={() => setOpenPlots(!openPlots)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: openPlots ? '#f8f6f1' : 'white',
              border: 'none',
              borderBottom: openPlots ? '1px solid #e3ded3' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
              <ImageIcon size={16} color="#0d7c72" />
              <span>Gráficos Estadísticos Contextuales</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  backgroundColor: '#e7f4f2',
                  color: '#0d7c72',
                  border: '1px solid #b6ddd8',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  fontWeight: 700,
                }}
              >
                {result.plots.length}
              </span>
            </div>
            {openPlots ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
          </button>

          {openPlots && (
            <div style={{ padding: '1.25rem', backgroundColor: 'white' }}>
              <StatisticalPlots plots={result.plots} />
            </div>
          )}
        </div>
      )}

      {/* 4. CAPA 2: Resultados Completos (Tablas Detalladas) */}
      <div style={{ border: '1px solid #e3ded3', borderRadius: '10px', overflow: 'hidden' }}>
        <button
          onClick={() => setOpenTables(!openTables)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: openTables ? '#f8f6f1' : 'white',
            border: 'none',
            borderBottom: openTables ? '1px solid #e3ded3' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.1s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
            <Table size={16} color="#0d7c72" />
            <span>Tablas Estadísticas Detalladas</span>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: '#e7f4f2',
                color: '#0d7c72',
                border: '1px solid #b6ddd8',
                padding: '1px 7px',
                borderRadius: '999px',
                fontWeight: 700,
              }}
            >
              {result.tables.length} tabla{result.tables.length !== 1 ? 's' : ''}
            </span>
          </div>
          {openTables ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
        </button>

        {openTables && (
          <div style={{ padding: '1.25rem', backgroundColor: 'white' }}>
            <Layer2Tables tables={result.tables} />
          </div>
        )}
      </div>

      {/* 5. CAPA 3: Diagnósticos y Supuestos */}
      {result.diagnostics && result.diagnostics.length > 0 && (
        <div style={{ border: '1px solid #e3ded3', borderRadius: '10px', overflow: 'hidden' }}>
          <button
            onClick={() => setOpenDiagnostics(!openDiagnostics)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: openDiagnostics ? '#f8f6f1' : 'white',
              border: 'none',
              borderBottom: openDiagnostics ? '1px solid #e3ded3' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Diagnósticos y Pruebas de Supuestos</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  padding: '1px 7px',
                  borderRadius: '999px',
                  fontWeight: 700,
                }}
              >
                {result.diagnostics.length} prueba{result.diagnostics.length !== 1 ? 's' : ''}
              </span>
            </div>
            {openDiagnostics ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
          </button>

          {openDiagnostics && (
            <div style={{ padding: '1.25rem', backgroundColor: 'white' }}>
              <Layer3Diagnostics diagnostics={result.diagnostics} />
            </div>
          )}
        </div>
      )}

      {/* 6. CAPA 4: Información Técnica y Ajuste */}
      <div style={{ border: '1px solid #e3ded3', borderRadius: '10px', overflow: 'hidden' }}>
        <button
          onClick={() => setOpenTechnical(!openTechnical)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1rem',
            background: openTechnical ? '#f8f6f1' : 'white',
            border: 'none',
            borderBottom: openTechnical ? '1px solid #e3ded3' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.1s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.84rem', color: '#475569' }}>
            <Info size={15} color="#64748b" />
            <span>Ficha Técnica y Parámetros del Modelo</span>
          </div>
          {openTechnical ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
        </button>

        {openTechnical && (
          <div style={{ padding: '1.25rem', backgroundColor: 'white' }}>
            <Layer4Technical technical={result.technical} metadata={meta} />
          </div>
        )}
      </div>

      {/* 7. CAPA 5: Código R Reproducible */}
      {result.reproducible_code && (
        <div style={{ border: '1px solid #e3ded3', borderRadius: '10px', overflow: 'hidden' }}>
          <button
            onClick={() => setOpenCode(!openCode)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1rem',
              background: openCode ? '#f8f6f1' : 'white',
              border: 'none',
              borderBottom: openCode ? '1px solid #e3ded3' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.1s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.84rem', color: '#475569' }}>
              <Code2 size={15} color="#0284c7" />
              <span>Código R Reproducible (RStudio)</span>
            </div>
            {openCode ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
          </button>

          {openCode && (
            <div style={{ padding: '1.25rem', backgroundColor: 'white' }}>
              <Layer5ReproducibleCode code={result.reproducible_code} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
