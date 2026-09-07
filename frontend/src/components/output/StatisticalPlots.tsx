import React, { useState } from 'react';
import { Download, ZoomIn, ZoomOut, Image as ImageIcon } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {plots.map(plot => {
        const isZoomed = zoomPlotId === plot.id;

        return (
          <div
            key={plot.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            {/* Cabecera del Gráfico */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 1rem',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ImageIcon size={15} color="#2563eb" />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
                  {plot.title}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setZoomPlotId(isZoomed ? null : plot.id)}
                  title={isZoomed ? 'Reducir tamaño' : 'Ampliar gráfico'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '3px 8px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: '#334155',
                  }}
                >
                  {isZoomed ? <ZoomOut size={13} /> : <ZoomIn size={13} />}
                  <span>{isZoomed ? 'Normal' : 'Zoom'}</span>
                </button>

                <button
                  onClick={() => downloadImage(plot)}
                  title="Descargar imagen PNG en alta resolución"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '3px 8px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: '#334155',
                  }}
                >
                  <Download size={13} />
                  <span>PNG</span>
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
                padding: '1rem',
                backgroundColor: '#ffffff',
              }}
            >
              <img
                src={`data:image/png;base64,${plot.image_base64}`}
                alt={plot.title}
                style={{
                  maxWidth: isZoomed ? '100%' : '520px',
                  width: '100%',
                  height: 'auto',
                  borderRadius: '6px',
                  transition: 'max-width 0.2s ease-in-out',
                }}
              />
            </div>

            {/* Descripción interpretativa del gráfico */}
            {plot.description && (
              <div
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.75rem',
                  color: '#64748b',
                }}
              >
                {plot.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
