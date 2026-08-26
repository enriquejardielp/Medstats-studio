import React, { useState } from 'react';
import { Code, Copy, Check } from 'lucide-react';
import type { ReproducibleCode } from '../../types/analysis';

interface Props {
  code: ReproducibleCode;
}

export const Layer5ReproducibleCode: React.FC<Props> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar código:', err);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Cabecera del Editor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 1rem',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
          <Code size={16} color="#38bdf8" />
          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Script Reproducible en R</span>
          <span style={{ fontSize: '0.7rem', backgroundColor: '#334155', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px' }}>
            RStudio Compatible
          </span>
        </div>

        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '3px 8px',
            backgroundColor: copied ? '#16a34a' : '#334155',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copiado al portapapeles' : 'Copiar Código'}</span>
        </button>
      </div>

      {/* Código R */}
      <pre
        style={{
          margin: 0,
          padding: '1rem',
          color: '#f8fafc',
          fontSize: '0.82rem',
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          overflowX: 'auto',
          maxHeight: '350px',
        }}
      >
        <code>{code.script.trim()}</code>
      </pre>

      {code.instructions && (
        <div
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1e293b',
            borderTop: '1px solid #334155',
            color: '#94a3b8',
            fontSize: '0.75rem',
          }}
        >
          <strong>Instrucciones:</strong> {code.instructions}
        </div>
      )}
    </div>
  );
};
