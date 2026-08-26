import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { AnalysisWarning } from '../../types/analysis';

interface Props {
  warnings: AnalysisWarning[];
}

export const WarningsBanner: React.FC<Props> = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
      {warnings.map((w, idx) => {
        const isCritical = w.severity === 'critical';
        const isWarning = w.severity === 'warning';

        const bg = isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4';
        const border = isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#bbf7d0';
        const textColor = isCritical ? '#991b1b' : isWarning ? '#92400e' : '#166534';
        const iconColor = isCritical ? '#dc2626' : isWarning ? '#d97706' : '#16a34a';

        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: bg,
              border: `1px solid ${border}`,
              color: textColor,
              fontSize: '0.85rem',
            }}
          >
            <div style={{ color: iconColor, marginTop: '2px', flexShrink: 0 }}>
              {isCritical ? <AlertCircle size={18} /> : isWarning ? <AlertTriangle size={18} /> : <Info size={18} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                {w.variable ? `Variable '${w.variable}': ` : ''}{w.message}
              </div>
              {w.action_suggested && (
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  <strong>Nota metodológica:</strong> {w.action_suggested}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
