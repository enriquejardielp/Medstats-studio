import React, { useState } from 'react';
import { Download, ZoomIn, ZoomOut } from 'lucide-react';
import type { AnalysisPlot } from '../../types/analysis';

interface Props {
  plots: AnalysisPlot[];
}

export const StatisticalPlots: React.FC<Props> = ({ plots }) => {
  const [zoomPlotId, setZoomPlotId] = useState<string | null>(null);

  if (!plots || plots.length === 0) return null;

  const downloadImage = (plot: AnalysisPlot) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${plot.image_base64}`;
    link.download = `${plot.id || 'grafico_estadistico'}.png`;
    link.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {plots.map((plot, idx) => {
        const isZoomed = zoomPlotId === plot.id;

        return (
          <div
            key={plot.id}
            style={{
              border: '1px solid #e3ded3',
              borderRadius: '10px',
              overflow: 'hidden',
              backgroundColor: 'white',
              boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
            }}
          >
            {/* Cabecera del Gráfico */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.15rem',
                backgroundColor: '#f8f6f1',
                borderBottom: '1px solid #e3ded3',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    backgroundColor: '#e7f4f2',
                    color: '#0a5f58',
                    border: '1px solid #b6ddd8',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  Figura {idx + 1}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#10232e' }}>
                  {plot.title}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setZoomPlotId(isZoomed ? null : plot.id)}
                  title={isZoomed ? 'Reducir tamaño' : 'Ampliar gráfico a ancho completo'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '4px 9px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    color: '#334155',
                    fontWeight: 600,
                  }}
                >
                  {isZoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
                  <span>{isZoomed ? 'Vista Normal' : 'Zoom Completo'}</span>
                </button>

                <button
                  onClick={() => downloadImage(plot)}
                  title="Descargar imagen PNG en alta resolución (300 DPI)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '4px 9px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    color: '#334155',
                    fontWeight: 600,
                  }}
                >
                  <Download size={13} />
                  <span>Descargar PNG</span>
                </button>
              </div>
            </div>

            {/* Imagen del Gráfico */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.25rem',
                backgroundColor: '#ffffff',
              }}
            >
              <img
                src={`data:image/png;base64,${plot.image_base64}`}
                alt={plot.title}
                style={{
                  maxWidth: isZoomed ? '100%' : '560px',
                  width: '100%',
                  height: 'auto',
                  borderRadius: '6px',
                  transition: 'max-width 0.2s ease-in-out',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              />
            </div>

            {/* Descripción interpretativa del gráfico */}
            {plot.description && (
              <div
                style={{
                  padding: '0.65rem 1.15rem',
                  backgroundColor: '#f8f6f1',
                  borderTop: '1px solid #e3ded3',
                  fontSize: '0.78rem',
                  color: '#475569',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: '#10232e' }}>Nota de la figura:</strong> {plot.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
