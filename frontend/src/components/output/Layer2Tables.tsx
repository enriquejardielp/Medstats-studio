import React, { useState } from 'react';
import { Copy, Download, Check, Eye, EyeOff } from 'lucide-react';
import type { StatisticalTable } from '../../types/analysis';

interface Props {
  tables: StatisticalTable[];
}

export const Layer2Tables: React.FC<Props> = ({ tables }) => {
  const [decimalPrecision, setDecimalPrecision] = useState<number>(3);
  const [showCI, setShowCI] = useState<boolean>(true);
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);

  if (!tables || tables.length === 0) {
    return (
      <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
        No hay tablas estadísticas disponibles para este análisis.
      </div>
    );
  }

  const formatCellValue = (val: any, formatType: string, customDecimals?: number): string => {
    if (val === null || val === undefined || isNaN(val) && typeof val === 'number') {
      return '—';
    }
    if (typeof val === 'string') return val;

    const dec = customDecimals !== undefined ? customDecimals : decimalPrecision;

    if (formatType === 'p_value') {
      if (val < 0.001) return '< .001';
      return val.toFixed(Math.max(3, dec));
    }
    if (formatType === 'percentage') {
      return `${val.toFixed(dec)}%`;
    }
    if (formatType === 'number') {
      return val.toLocaleString();
    }
    if (formatType === 'decimal') {
      return val.toFixed(dec);
    }
    return String(val);
  };

  const copyTableToClipboard = async (table: StatisticalTable) => {
    const visibleCols = table.columns.filter(c => showCI || !c.key.includes('ci_'));
    const headerRow = visibleCols.map(c => c.label).join('\t');
    const dataRows = table.rows.map(row =>
      visibleCols.map(col => formatCellValue(row[col.key], col.format_type, col.decimals)).join('\t')
    );
    const fullTsv = [headerRow, ...dataRows].join('\n');

    try {
      await navigator.clipboard.writeText(fullTsv);
      setCopiedTableId(table.id);
      setTimeout(() => setCopiedTableId(null), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const downloadCsv = (table: StatisticalTable) => {
    const visibleCols = table.columns.filter(c => showCI || !c.key.includes('ci_'));
    const headerRow = visibleCols.map(c => `"${c.label}"`).join(',');
    const dataRows = table.rows.map(row =>
      visibleCols.map(col => `"${formatCellValue(row[col.key], col.format_type, col.decimals)}"`).join(',')
    );
    const csvContent = [headerRow, ...dataRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${table.id || 'tabla_estadistica'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Barra de Control de Presentación */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.6rem 0.85rem',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Selector de Decimales */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Decimales:</span>
            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
              {[2, 3, 4].map(d => (
                <button
                  key={d}
                  onClick={() => setDecimalPrecision(d)}
                  style={{
                    padding: '2px 8px',
                    border: 'none',
                    background: decimalPrecision === d ? '#2563eb' : 'white',
                    color: decimalPrecision === d ? 'white' : '#334155',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle de Intervalos de Confianza */}
          <button
            onClick={() => setShowCI(!showCI)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              color: '#334155',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {showCI ? <Eye size={14} color="#2563eb" /> : <EyeOff size={14} color="#94a3b8" />}
            <span>{showCI ? 'Ocultar IC' : 'Mostrar IC'}</span>
          </button>
        </div>

        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
          Separación: Datos estadísticos independientes de la vista
        </span>
      </div>

      {/* Renderizado de Tablas */}
      {tables.map(table => {
        const visibleCols = table.columns.filter(c => showCI || !c.key.includes('ci_'));

        return (
          <div
            key={table.id}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {/* Cabecera de la Tabla */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  {table.title}
                </h4>
                {table.subtitle && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    {table.subtitle}
                  </p>
                )}
              </div>

              {/* Botones de Acción (Copiar / CSV) */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => copyTableToClipboard(table)}
                  title="Copiar tabla en formato compatible con Excel y Word"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '4px 8px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: copiedTableId === table.id ? '#16a34a' : '#334155',
                    fontWeight: 500,
                  }}
                >
                  {copiedTableId === table.id ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedTableId === table.id ? 'Copiada' : 'Copiar'}</span>
                </button>

                <button
                  onClick={() => downloadCsv(table)}
                  title="Descargar tabla como archivo CSV"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '4px 8px',
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: '#334155',
                    fontWeight: 500,
                  }}
                >
                  <Download size={14} />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Cuerpo de la Tabla (Estilo Stata / SPSS Compacto) */}
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.82rem',
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
                    {visibleCols.map(col => (
                      <th
                        key={col.key}
                        style={{
                          padding: '0.5rem 0.75rem',
                          textAlign: col.align || 'right',
                          fontWeight: 600,
                          color: '#1e293b',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: rowIdx % 2 === 0 ? 'white' : '#fcfdfe',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? 'white' : '#fcfdfe'}
                    >
                      {visibleCols.map(col => (
                        <td
                          key={col.key}
                          style={{
                            padding: '0.45rem 0.75rem',
                            textAlign: col.align || 'right',
                            color: col.align === 'left' ? '#0f172a' : '#334155',
                            fontWeight: col.align === 'left' ? 500 : 400,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatCellValue(row[col.key], col.format_type, col.decimals)}
                          {row.significance && col.key === 'p_value' && (
                            <span style={{ color: '#2563eb', fontWeight: 700, marginLeft: '2px' }}>
                              {row.significance}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notas al pie de la tabla */}
            {table.footnotes && table.footnotes.length > 0 && (
              <div
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.72rem',
                  color: '#64748b',
                  display: 'flex',
                  gap: '1.5rem',
                }}
              >
                {table.footnotes.map((fn, idx) => (
                  <span key={idx}>
                    <strong style={{ color: '#334155' }}>{fn.symbol}</strong> {fn.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
