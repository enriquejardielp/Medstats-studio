import React, { useState } from 'react';
import { BookOpen, Sparkles, Copy, Check, CheckCircle2 } from 'lucide-react';
import type { ExecutiveSummary, MetricItem } from '../../types/analysis';

interface Props {
  summary: ExecutiveSummary;
}

export const Layer1Summary: React.FC<Props> = ({ summary }) => {
  const [copiedNarrative, setCopiedNarrative] = useState(false);

  const handleCopyNarrative = async () => {
    if (!summary.interpretation) return;
    try {
      await navigator.clipboard.writeText(summary.interpretation);
      setCopiedNarrative(true);
      setTimeout(() => setCopiedNarrative(false), 2000);
    } catch (err) {
      console.error('Error al copiar narrativa:', err);
    }
  };

  const getSignificanceBadge = (metric: MetricItem) => {
    const p = metric.p_value;
    const star = metric.significance_star;

    if (p !== undefined && p !== null) {
      if (p < 0.001) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '2px 7px',
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            <CheckCircle2 size={11} color="#059669" /> p &lt; .001 ***
          </span>
        );
      }
      if (p < 0.01) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#e7f4f2',
              color: '#0a5f58',
              border: '1px solid #b6ddd8',
              padding: '2px 7px',
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            p &lt; .01 **
          </span>
        );
      }
      if (p < 0.05) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#f0fdfa',
              color: '#0f766e',
              border: '1px solid #99f6e4',
              padding: '2px 7px',
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 700,
            }}
          >
            p &lt; .05 *
          </span>
        );
      }
      if (p < 0.10) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              backgroundColor: '#fffbeb',
              color: '#92400e',
              border: '1px solid #fde68a',
              padding: '2px 7px',
              borderRadius: '999px',
              fontSize: '0.68rem',
              fontWeight: 600,
            }}
          >
            p &lt; .10 (tendencia)
          </span>
        );
      }
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#efebe3',
            color: '#64748b',
            border: '1px solid #e3ded3',
            padding: '2px 7px',
            borderRadius: '999px',
            fontSize: '0.68rem',
            fontWeight: 500,
          }}
        >
          p = {p.toFixed(3)} ns
        </span>
      );
    }

    if (star) {
      return (
        <span
          style={{
            backgroundColor: '#e7f4f2',
            color: '#0d7c72',
            border: '1px solid #b6ddd8',
            padding: '2px 6px',
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
        >
          {star}
        </span>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Titular Principal del Hallazgo Clínico */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f6f1 100%)',
          border: '1px solid #e3ded3',
          borderLeft: '4px solid #0d7c72',
          borderRadius: '10px',
          padding: '1.15rem 1.4rem',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#e7f4f2',
              color: '#0a5f58',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            <Sparkles size={13} color="#0d7c72" /> Resumen Ejecutivo
          </span>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Evidencia estadística sintetizada
          </span>
        </div>

        <div
          style={{
            fontSize: '1.18rem',
            fontWeight: 700,
            color: '#10232e',
            lineHeight: 1.4,
            letterSpacing: '-0.02em',
          }}
        >
          {summary.headline}
        </div>
      </div>

      {/* 2. Grid de Métricas Clave (KPIs Estadísticos de Alta Definición) */}
      {summary.key_metrics && summary.key_metrics.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.85rem',
          }}
        >
          {summary.key_metrics.map((metric, idx) => {
            const badge = getSignificanceBadge(metric);

            return (
              <div
                key={idx}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e3ded3',
                  borderRadius: '10px',
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e3ded3';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#64748b',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {metric.label}
                  </span>
                  {badge}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: '1.45rem',
                      fontWeight: 800,
                      color: '#10232e',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.03em',
                      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    }}
                  >
                    {metric.formatted}
                  </span>
                </div>

                {metric.description && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#64748b',
                      lineHeight: 1.35,
                      marginTop: '0.15rem',
                    }}
                  >
                    {metric.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Interpretación Estadística en Formato Publicación (APA / Lancet) */}
      {summary.interpretation && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e3ded3',
            borderLeft: '4px solid #6366f1',
            borderRadius: '10px',
            padding: '1.1rem 1.35rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <BookOpen size={16} color="#6366f1" />
              <span
                style={{
                  fontWeight: 700,
                  color: '#334155',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Narrativa Estadística (Norma APA 7 / Revista Biomédica)
              </span>
            </div>

            <button
              onClick={handleCopyNarrative}
              title="Copiar texto para insertar en tu manuscrito o informe"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: copiedNarrative ? '#ecfdf5' : '#f8f6f1',
                color: copiedNarrative ? '#065f46' : '#475569',
                border: `1px solid ${copiedNarrative ? '#a7f3d0' : '#e3ded3'}`,
                borderRadius: '6px',
                padding: '3px 9px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copiedNarrative ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedNarrative ? 'Copiada' : 'Copiar texto'}</span>
            </button>
          </div>

          <p
            style={{
              margin: 0,
              color: '#1e293b',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              fontStyle: 'normal',
            }}
          >
            {summary.interpretation}
          </p>
        </div>
      )}
    </div>
  );
};
