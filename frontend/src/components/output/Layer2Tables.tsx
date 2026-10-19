import React, { useState } from 'react';
import { Copy, Download, Check, Eye, EyeOff, SlidersHorizontal, Table2 } from 'lucide-react';
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
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.88rem',
          backgroundColor: '#f8f6f1',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
        }}
      >
        <Table2 size={24} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
        <div>No hay tablas estadísticas generadas para este procedimiento.</div>
      </div>
    );
  }

  const formatCellValue = (val: any, formatType: string, customDecimals?: number): string => {
    if (val === null || val === undefined || (isNaN(val) && typeof val === 'number')) {
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
      setTimeout(() => setCopiedTableId(null), 2500);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Barra de Control de Presentación Científica */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#f8f6f1',
          border: '1px solid #e3ded3',
          borderRadius: '8px',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* Selector de Decimales Segmentado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <SlidersHorizontal size={13} color="#64748b" /> Precisión:
            </span>
            <div
              style={{
                display: 'inline-flex',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: 'white',
              }}
            >
              {[2, 3, 4].map(d => (
                <button
                  key={d}
                  onClick={() => setDecimalPrecision(d)}
                  style={{
                    padding: '3px 10px',
                    border: 'none',
                    borderRight: d < 4 ? '1px solid #e3ded3' : 'none',
                    background: decimalPrecision === d ? '#0d7c72' : 'white',
                    color: decimalPrecision === d ? 'white' : '#334155',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d} dec
                </button>
              ))}
            </div>
          </div>

          {/* Toggle de Intervalos de Confianza */}
          <button
            onClick={() => setShowCI(!showCI)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: showCI ? '#e7f4f2' : 'white',
              border: `1px solid ${showCI ? '#b6ddd8' : '#cbd5e1'}`,
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              color: showCI ? '#0a5f58' : '#475569',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            {showCI ? <Eye size={13} color="#0d7c72" /> : <EyeOff size={13} color="#94a3b8" />}
            <span>{showCI ? 'IC 95% Visible' : 'IC 95% Oculto'}</span>
          </button>
        </div>

        <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontStyle: 'italic' }}>
          Formato APA 7 / Revista Biomédica (NEJM, Lancet)
        </span>
      </div>

      {/* Renderizado de Tablas Académicas */}
      {tables.map(table => {
        const visibleCols = table.columns.filter(c => showCI || !c.key.includes('ci_'));
        const isCopied = copiedTableId === table.id;

        return (
          <div
            key={table.id}
            style={{
              border: '1px solid #e3ded3',
              borderRadius: '10px',
              backgroundColor: 'white',
              boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Cabecera de la Tabla y Acciones de Exportación */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '0.9rem 1.25rem',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #efebe3',
              }}
            >
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#10232e',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {table.title}
                </h4>
                {table.subtitle && (
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                    {table.subtitle}
                  </p>
                )}
              </div>

              {/* Botones de Exportación Instantánea (Word/Excel TSV y CSV) */}
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button
                  onClick={() => copyTableToClipboard(table)}
                  title="Copiar tabla en formato TSV (pegar directamente en Word o Excel manteniendo formato)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '4px 10px',
                    backgroundColor: isCopied ? '#ecfdf5' : '#ffffff',
                    border: `1px solid ${isCopied ? '#86efac' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    color: isCopied ? '#166534' : '#334155',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isCopied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                  <span>{isCopied ? '¡Copiada para Excel/Word!' : 'Copiar tabla'}</span>
                </button>

                <button
                  onClick={() => downloadCsv(table)}
                  title="Descargar tabla completa en archivo CSV"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '4px 10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    color: '#334155',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Cuerpo de la Tabla (Estilo Estricto APA / Lancet / NEJM) */}
            <div style={{ overflowX: 'auto', padding: '0.5rem 1.25rem 1rem 1.25rem' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.84rem',
                  fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
                  borderTop: '2.5px solid #10232e',
                  borderBottom: '2.5px solid #10232e',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #334155' }}>
                    {visibleCols.map(col => (
                      <th
                        key={col.key}
                        style={{
                          padding: '0.6rem 0.85rem',
                          textAlign: col.align || 'right',
                          fontWeight: 700,
                          color: '#10232e',
                          whiteSpace: 'nowrap',
                          fontSize: '0.8rem',
                          letterSpacing: '0.01em',
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
                        borderBottom: rowIdx === table.rows.length - 1 ? 'none' : '1px solid #efebe3',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f6f1'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {visibleCols.map(col => {
                        const isLeft = col.align === 'left';
                        const isPVal = col.key === 'p_value';
                        const val = row[col.key];

                        return (
                          <td
                            key={col.key}
                            style={{
                              padding: '0.5rem 0.85rem',
                              textAlign: col.align || 'right',
                              color: isLeft ? '#10232e' : '#1e293b',
                              fontWeight: isLeft ? 600 : 400,
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCellValue(val, col.format_type, col.decimals)}
                            {row.significance && isPVal && (
                              <sup
                                style={{
                                  color: '#0d7c72',
                                  fontWeight: 700,
                                  marginLeft: '3px',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {row.significance}
                              </sup>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notas al pie de la tabla (Criterio Científico / APA) */}
            {table.footnotes && table.footnotes.length > 0 && (
              <div
                style={{
                  padding: '0.65rem 1.25rem',
                  backgroundColor: '#f8f6f1',
                  borderTop: '1px solid #e3ded3',
                  fontSize: '0.74rem',
                  color: '#64748b',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                  lineHeight: 1.4,
                }}
              >
                {table.footnotes.map((fn, idx) => (
                  <span key={idx}>
                    <strong style={{ color: '#10232e', marginRight: '3px' }}>{fn.symbol}</strong>
                    {fn.text}
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
