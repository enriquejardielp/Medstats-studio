import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
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
        backgroundColor: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* Cabecera del Editor */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1rem',
          backgroundColor: '#10232e',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <Terminal size={15} color="#38bdf8" />
          <span style={{ fontWeight: 700, color: '#efebe3', letterSpacing: '-0.01em' }}>Script Reproducible en R</span>
          <span
            style={{
              fontSize: '0.68rem',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              padding: '1px 6px',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            RStudio Compatible
          </span>
        </div>

        <button
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '3px 9px',
            backgroundColor: copied ? '#059669' : '#1e293b',
            color: 'white',
            border: `1px solid ${copied ? '#10b981' : '#334155'}`,
            borderRadius: '6px',
            fontSize: '0.74rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontWeight: 600,
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? '¡Copiado!' : 'Copiar script'}</span>
        </button>
      </div>

      {/* Código R */}
      <pre
        style={{
          margin: 0,
          padding: '1.25rem',
          color: '#e3ded3',
          fontSize: '0.82rem',
          lineHeight: 1.6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          overflowX: 'auto',
          maxHeight: '380px',
        }}
      >
        <code>{code.script.trim()}</code>
      </pre>

      {code.instructions && (
        <div
          style={{
            padding: '0.6rem 1rem',
            backgroundColor: '#0c1222',
            borderTop: '1px solid #1e293b',
            color: '#94a3b8',
            fontSize: '0.74rem',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: '#cbd5e1' }}>Instrucciones de reproducción:</strong> {code.instructions}
        </div>
      )}
    </div>
  );
};
