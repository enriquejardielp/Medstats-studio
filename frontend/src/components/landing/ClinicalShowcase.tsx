import React, { useState } from 'react';
import {
  Activity,
  Copy,
  TrendingUp,
  GitCompare,
  BarChart2,
  Check,
} from 'lucide-react';

export const ClinicalShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'km' | 'roc' | 'forest' | 'table1'>('km');

  // Estado para Kaplan-Meier interactivo
  const [kmMonth, setKmMonth] = useState<number>(36);
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);

  // Estado para ROC interactivo
  const [rocThreshold, setRocThreshold] = useState<number>(0.42);

  // Estado para Tabla 1
  const [table1Format, setTable1Format] = useState<'mean' | 'median'>('mean');
  const [copiedTable, setCopiedTable] = useState<boolean>(false);

  // Datos interactivos para Kaplan-Meier según el mes seleccionado
  const getKmData = (m: number) => {
    // Estimación decreciente realista con ventaja para el grupo experimental
    const expSurvival = Math.max(25, Math.round(100 - (m * 1.1) - (m > 24 ? (m - 24) * 0.4 : 0)));
    const ctlSurvival = Math.max(8, Math.round(100 - (m * 1.8) - (m > 24 ? (m - 24) * 0.7 : 0)));
    const expRisk = Math.max(12, Math.round(150 * (expSurvival / 100)));
    const ctlRisk = Math.max(5, Math.round(150 * (ctlSurvival / 100)));
    return { expSurvival, ctlSurvival, expRisk, ctlRisk };
  };

  const kmStats = getKmData(kmMonth);

  // Datos interactivos para la Curva ROC
  const calculateRocMetrics = (thresh: number) => {
    // Sensibilidad disminuye al aumentar el umbral, especificidad aumenta
    const sens = Math.max(15, Math.min(99, Math.round((1 - Math.pow(thresh, 1.6)) * 98)));
    const spec = Math.max(20, Math.min(99, Math.round((1 - Math.pow(1 - thresh, 1.4)) * 96)));
    const youden = Number(((sens + spec - 100) / 100).toFixed(3));
    const tp = Math.round(120 * (sens / 100));
    const fn = 120 - tp;
    const tn = Math.round(130 * (spec / 100));
    const fp = 130 - tn;
    return { sens, spec, youden, tp, fn, tn, fp };
  };

  const rocMetrics = calculateRocMetrics(rocThreshold);

  const handleCopyTable = () => {
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2200);
  };

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 20px 45px -10px rgba(52, 47, 42, 0.08), 0 1px 3px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Barra de pestañas superiores estilo Apple/Linear */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.5rem',
          backgroundColor: '#FAF8F5',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)',
            }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
            Visor Interactivo en Tiempo Real
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'km', label: 'Curva Kaplan-Meier', icon: Activity },
            { id: 'roc', label: 'Curva ROC / Diagnóstico', icon: TrendingUp },
            { id: 'forest', label: 'Forest Plot (Multivariante)', icon: GitCompare },
            { id: 'table1', label: 'Tabla 1 ICMJE', icon: BarChart2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '10px',
                  border: active ? '1px solid var(--color-accent)' : '1px solid transparent',
                  backgroundColor: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--color-text-secondary)',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido dinámico según la pestaña activa */}
      <div style={{ padding: '1.75rem' }}>
        {/* ============================================================== */}
        {/* PESTAÑA 1: KAPLAN-MEIER                                        */}
        {/* ============================================================== */}
        {activeTab === 'km' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem', alignItems: 'center' }}>
            <div>
              <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                Oncología Médica · Ensayo Fase III
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.5rem', margin: '0.25rem 0 0.5rem', color: 'var(--color-ink)' }}>
                Supervivencia Global por Brazo Terapéutico
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                Comparación de Inmunoterapia combinada frente al régimen de Quimioterapia estándar.
                Desliza la barra temporal para inspeccionar la probabilidad acumulada y los pacientes en riesgo a diferentes horizontes clínicos.
              </p>

              {/* Controles interactivos */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1.15rem',
                  backgroundColor: '#F8F6F2',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'grid',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    <span>Seguimiento temporal:</span>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 800 }}>{kmMonth} meses</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="60"
                    step="6"
                    value={kmMonth}
                    onChange={(e) => setKmMonth(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                    <span>6 m</span>
                    <span>12 m</span>
                    <span>24 m</span>
                    <span>36 m</span>
                    <span>48 m</span>
                    <span>60 m</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <input
                      type="checkbox"
                      checked={showConfidenceBands}
                      onChange={(e) => setShowConfidenceBands(e.target.checked)}
                      style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                    />
                    <span>Mostrar bandas de confianza al 95%</span>
                  </label>
                  <span className="ms-badge" style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontSize: '0.72rem' }}>
                    Log-rank p &lt; 0.0001
                  </span>
                </div>
              </div>

              {/* Tarjetas de Métricas a ese mes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginTop: '1.15rem' }}>
                <div style={{ padding: '0.9rem', backgroundColor: '#FDF7F3', borderRadius: '12px', border: '1px solid #F3DAC8' }}>
                  <div style={{ fontSize: '0.72rem', color: '#9C4C2E', fontWeight: 700, textTransform: 'uppercase' }}>
                    Inmunoterapia (n=150)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#713820', marginTop: '2px' }}>
                    {kmStats.expSurvival}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#813D25' }}>
                    En riesgo: <strong>{kmStats.expRisk}</strong> sujetos
                  </div>
                </div>

                <div style={{ padding: '0.9rem', backgroundColor: '#F1F5F9', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>
                    Quimioterapia (n=150)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E293B', marginTop: '2px' }}>
                    {kmStats.ctlSurvival}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                    En riesgo: <strong>{kmStats.ctlRisk}</strong> sujetos
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico SVG de Kaplan-Meier de alta definición */}
            <div
              style={{
                backgroundColor: '#FAF8F5',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '1.25rem',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                <span style={{ fontWeight: 700 }}>Curva de supervivencia acumulada de Kaplan-Meier</span>
                <span>Hazard Ratio: <strong>0.51 (0.38 - 0.69)</strong></span>
              </div>

              <svg viewBox="0 0 460 280" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                {/* Cuadrícula suave */}
                {[0.25, 0.5, 0.75, 1.0].map((val) => {
                  const y = 230 - val * 200;
                  return (
                    <g key={val}>
                      <line x1="45" y1={y} x2="440" y2={y} stroke="#E5E0D8" strokeDasharray="3 3" />
                      <text x="38" y={y + 4} textAnchor="end" fontSize="10" fill="#786F65" fontFamily="var(--font-mono)">
                        {val.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* Ejes */}
                <line x1="45" y1="230" x2="440" y2="230" stroke="#786F65" strokeWidth="1.2" />
                <line x1="45" y1="30" x2="45" y2="230" stroke="#786F65" strokeWidth="1.2" />

                {/* Etiquetas de meses en el eje X */}
                {[0, 12, 24, 36, 48, 60].map((m) => {
                  const x = 45 + (m / 60) * 380;
                  return (
                    <g key={m}>
                      <line x1={x} y1="230" x2={x} y2="235" stroke="#786F65" />
                      <text x={x} y="248" textAnchor="middle" fontSize="10" fill="#786F65" fontFamily="var(--font-mono)">
                        {m}m
                      </text>
                    </g>
                  );
                })}

                {/* Bandas de confianza si están activas */}
                {showConfidenceBands && (
                  <>
                    {/* Banda Inmuno */}
                    <path
                      d="M 45 30 L 121 42 L 197 78 L 273 118 L 349 140 L 425 152 L 425 168 L 349 158 L 273 134 L 197 96 L 121 54 L 45 34 Z"
                      fill="#9C4C2E"
                      opacity="0.14"
                    />
                    {/* Banda Quimio */}
                    <path
                      d="M 45 30 L 121 82 L 197 150 L 273 182 L 349 200 L 425 212 L 425 218 L 349 210 L 273 192 L 197 165 L 121 100 L 45 34 Z"
                      fill="#475569"
                      opacity="0.14"
                    />
                  </>
                )}

                {/* Curva Escalonada Tratamiento Experimental (Inmunoterapia) en terracota */}
                <path
                  d="M 45 30 L 85 30 L 85 45 L 140 45 L 140 65 L 190 65 L 190 85 L 260 85 L 260 110 L 320 110 L 320 130 L 380 130 L 380 145 L 425 145"
                  fill="none"
                  stroke="#9C4C2E"
                  strokeWidth="2.8"
                />

                {/* Curva Escalonada Control (Quimioterapia) en azul pizarra */}
                <path
                  d="M 45 30 L 70 30 L 70 65 L 115 65 L 115 105 L 165 105 L 165 145 L 230 145 L 230 180 L 295 180 L 295 200 L 360 200 L 360 210 L 425 210"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                />

                {/* Línea vertical indicadora del mes seleccionado */}
                {(() => {
                  const activeX = 45 + (kmMonth / 60) * 380;
                  return (
                    <g>
                      <line x1={activeX} y1="30" x2={activeX} y2="230" stroke="var(--color-accent)" strokeWidth="1.6" strokeDasharray="4 2" />
                      <circle cx={activeX} cy={230 - (kmStats.expSurvival / 100) * 200} r="5" fill="#9C4C2E" stroke="#FFFFFF" strokeWidth="2" />
                      <circle cx={activeX} cy={230 - (kmStats.ctlSurvival / 100) * 200} r="5" fill="#475569" stroke="#FFFFFF" strokeWidth="2" />
                    </g>
                  );
                })()}
              </svg>

              {/* Leyenda clínica */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '16px', height: '3px', backgroundColor: '#9C4C2E' }} />
                  <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Inmunoterapia (Anti-PD-1)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '16px', height: '3px', backgroundColor: '#475569', borderTop: '2px dashed #475569' }} />
                  <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Quimioterapia estándar</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 2: CURVA ROC Y BIOMARCADOR                             */}
        {/* ============================================================== */}
        {activeTab === 'roc' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem', alignItems: 'center' }}>
            <div>
              <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                Cardiología Diagnóstica · Biomarcador Sérico
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.5rem', margin: '0.25rem 0 0.5rem', color: 'var(--color-ink)' }}>
                Curva ROC y Punto de Corte Óptimo
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                Evaluación del poder discriminatorio de Troponina T ultrasensible para la detección temprana de isquemia miocárdica frente a angiografía.
                Mueve el umbral para observar el compromiso clínico entre Sensibilidad y Especificidad.
              </p>

              {/* Control de Umbral */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1.15rem',
                  backgroundColor: '#F8F6F2',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  <span>Punto de corte del biomarcador:</span>
                  <span style={{ color: 'var(--color-accent)', fontWeight: 800 }}>{rocThreshold.toFixed(2)} ng/mL</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.85"
                  step="0.01"
                  value={rocThreshold}
                  onChange={(e) => setRocThreshold(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                  <span>0.10 (Máx Sensibilidad)</span>
                  <span>Corte óptimo Youden ≈ 0.42</span>
                  <span>0.85 (Máx Especificidad)</span>
                </div>
              </div>

              {/* Matriz y Rendimiento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem', marginTop: '1rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: '#FDF7F3', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-accent-strong)', fontWeight: 700 }}>SENSIBILIDAD</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-accent)' }}>{rocMetrics.sens}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>VP: {rocMetrics.tp} | FN: {rocMetrics.fn}</div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#F1F5F9', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 700 }}>ESPECIFICIDAD</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1E293B' }}>{rocMetrics.spec}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>VN: {rocMetrics.tn} | FP: {rocMetrics.fp}</div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#EDF2E9', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: '#3A5A38', fontWeight: 700 }}>ÍNDICE YOUDEN</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#274426' }}>{rocMetrics.youden}</div>
                  <div style={{ fontSize: '0.7rem', color: '#3A5A38' }}>AUC = 0.932</div>
                </div>
              </div>
            </div>

            {/* Gráfico ROC en SVG */}
            <div
              style={{
                backgroundColor: '#FAF8F5',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                <span style={{ fontWeight: 700 }}>Curva Receiver Operating Characteristic (ROC)</span>
                <span className="ms-badge" style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent-strong)' }}>
                  AUC: 0.932 (IC 95%: 0.89 - 0.97)
                </span>
              </div>

              <svg viewBox="0 0 400 280" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                {/* Cuadrícula */}
                {[0.25, 0.5, 0.75, 1.0].map((v) => {
                  const y = 230 - v * 190;
                  const x = 50 + v * 320;
                  return (
                    <g key={v}>
                      <line x1="50" y1={y} x2="370" y2={y} stroke="#E5E0D8" strokeDasharray="3 3" />
                      <line x1={x} y1="40" x2={x} y2="230" stroke="#E5E0D8" strokeDasharray="3 3" />
                      <text x="42" y={y + 4} textAnchor="end" fontSize="10" fill="#786F65" fontFamily="var(--font-mono)">
                        {v.toFixed(2)}
                      </text>
                      <text x={x} y="246" textAnchor="middle" fontSize="10" fill="#786F65" fontFamily="var(--font-mono)">
                        {v.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* Ejes */}
                <line x1="50" y1="230" x2="370" y2="230" stroke="#786F65" strokeWidth="1.2" />
                <line x1="50" y1="40" x2="50" y2="230" stroke="#786F65" strokeWidth="1.2" />

                {/* Etiquetas de ejes */}
                <text x="210" y="265" textAnchor="middle" fontSize="11" fill="var(--color-ink)" fontWeight="600">
                  1 - Especificidad (Tasa de Falsos Positivos)
                </text>
                <text transform="translate(18 135) rotate(-90)" textAnchor="middle" fontSize="11" fill="var(--color-ink)" fontWeight="600">
                  Sensibilidad
                </text>

                {/* Diagonal de azar puro (AUC = 0.5) */}
                <line x1="50" y1="230" x2="370" y2="40" stroke="#A8A29E" strokeWidth="1.5" strokeDasharray="4 4" />

                {/* Área bajo la curva rellena suave */}
                <path
                  d="M 50 230 Q 80 80, 200 55 T 370 40 L 370 230 Z"
                  fill="#9C4C2E"
                  opacity="0.10"
                />

                {/* Curva ROC Suave */}
                <path
                  d="M 50 230 Q 80 80, 200 55 T 370 40"
                  fill="none"
                  stroke="#9C4C2E"
                  strokeWidth="3.2"
                />

                {/* Punto de corte activo actual según el umbral */}
                {(() => {
                  const currentFPR = (100 - rocMetrics.spec) / 100;
                  const currentTPR = rocMetrics.sens / 100;
                  const ptX = 50 + currentFPR * 320;
                  const ptY = 230 - currentTPR * 190;
                  return (
                    <g>
                      <circle cx={ptX} cy={ptY} r="7" fill="#9C4C2E" stroke="#FFFFFF" strokeWidth="2.5" />
                      <line x1={ptX} y1={ptY} x2={ptX} y2="230" stroke="#9C4C2E" strokeDasharray="2 2" strokeWidth="1" />
                      <line x1="50" y1={ptY} x2={ptX} y2={ptY} stroke="#9C4C2E" strokeDasharray="2 2" strokeWidth="1" />
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 3: FOREST PLOT                                         */}
        {/* ============================================================== */}
        {activeTab === 'forest' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem', alignItems: 'center' }}>
            <div>
              <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                Medicina Interna · Modelo Multivariante
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.5rem', margin: '0.25rem 0 0.5rem', color: 'var(--color-ink)' }}>
                Forest Plot de Factores de Riesgo
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
                Modelo de regresión logística multivariante para predicción de complicaciones graves a 30 días.
                Genera representaciones gráficas de Odds Ratios con sus intervalos de confianza al 95% listas para publicación en revistas Q1.
              </p>

              <div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.6rem' }}>
                {[
                  { name: 'Fracción eyección < 35%', or: 2.45, ci: '1.72 - 3.49', p: '< 0.001', type: 'risk' },
                  { name: 'Diabetes Mellitus Tipo 2', or: 1.84, ci: '1.29 - 2.63', p: '0.001', type: 'risk' },
                  { name: 'Edad > 70 años', or: 1.62, ci: '1.14 - 2.31', p: '0.007', type: 'risk' },
                  { name: 'Filtrado glomerular < 60', or: 1.58, ci: '1.08 - 2.30', p: '0.018', type: 'risk' },
                  { name: 'Tratamiento iSGLT2', or: 0.58, ci: '0.41 - 0.82', p: '0.002', type: 'protect' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#FAF8F5',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border-subtle)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{item.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: item.type === 'protect' ? '#10B981' : '#9C4C2E', fontWeight: 700 }}>
                        OR {item.or.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-text-tertiary)' }}>[{item.ci}]</span>
                      <span className="ms-badge" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>p = {item.p}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Representación visual Forest Plot en SVG */}
            <div
              style={{
                backgroundColor: '#FAF8F5',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                <span>Variable Analizada</span>
                <span>Odds Ratio (IC 95%)</span>
              </div>

              <svg viewBox="0 0 420 250" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                {/* Línea vertical de no efecto (OR = 1.0) */}
                <line x1="160" y1="20" x2="160" y2="210" stroke="#786F65" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="160" y="226" textAnchor="middle" fontSize="10" fill="#786F65" fontFamily="var(--font-mono)">
                  1.0 (Sin efecto)
                </text>

                {/* Marcadores de escala */}
                <text x="80" y="226" textAnchor="middle" fontSize="10" fill="#10B981" fontFamily="var(--font-mono)">
                  0.5 (Protector)
                </text>
                <text x="240" y="226" textAnchor="middle" fontSize="10" fill="#9C4C2E" fontFamily="var(--font-mono)">
                  2.0 (Riesgo)
                </text>
                <text x="320" y="226" textAnchor="middle" fontSize="10" fill="#9C4C2E" fontFamily="var(--font-mono)">
                  3.5
                </text>

                {/* Variables y líneas horizontales */}
                {[
                  { name: 'FEVI < 35%', center: 275, low: 220, high: 360, y: 40, color: '#9C4C2E' },
                  { name: 'Diabetes M2', center: 227, low: 183, high: 290, y: 75, color: '#9C4C2E' },
                  { name: 'Edad > 70a', center: 210, low: 171, high: 265, y: 110, color: '#9C4C2E' },
                  { name: 'FGe < 60', center: 206, low: 166, high: 264, y: 145, color: '#9C4C2E' },
                  { name: 'iSGLT2', center: 126, low: 112, high: 145, y: 180, color: '#10B981' },
                ].map((row, i) => (
                  <g key={i}>
                    {/* Nombre */}
                    <text x="10" y={row.y + 4} fontSize="11" fill="var(--color-ink)" fontWeight="600">
                      {row.name}
                    </text>
                    {/* Barra de intervalo */}
                    <line x1={row.low} y1={row.y} x2={row.high} y2={row.y} stroke={row.color} strokeWidth="2.2" />
                    <line x1={row.low} y1={row.y - 4} x2={row.low} y2={row.y + 4} stroke={row.color} strokeWidth="2" />
                    <line x1={row.high} y1={row.y - 4} x2={row.high} y2={row.y + 4} stroke={row.color} strokeWidth="2" />
                    {/* Punto estimador */}
                    <rect x={row.center - 4} y={row.y - 4} width="8" height="8" fill={row.color} />
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PESTAÑA 4: TABLA 1 (BASELINE)                                  */}
        {/* ============================================================== */}
        {activeTab === 'table1' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                  Normas ICMJE / STROBE / CONSORT
                </div>
                <h3 className="ms-display" style={{ fontSize: '1.45rem', margin: '0.2rem 0', color: 'var(--color-ink)' }}>
                  Tabla 1: Características Demográficas y Clínicas Basales
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Alineada automáticamente con la distribución estadística de cada variable.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', backgroundColor: '#F1EDE6', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setTable1Format('mean')}
                    style={{
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: table1Format === 'mean' ? 700 : 500,
                      backgroundColor: table1Format === 'mean' ? '#FFFFFF' : 'transparent',
                      color: table1Format === 'mean' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Media (DE)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTable1Format('median')}
                    style={{
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: table1Format === 'median' ? 700 : 500,
                      backgroundColor: table1Format === 'median' ? '#FFFFFF' : 'transparent',
                      color: table1Format === 'median' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Mediana [IQR]
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyTable}
                  className="ms-btn ms-btn-sm ms-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                >
                  {copiedTable ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  <span>{copiedTable ? '¡Copiado!' : 'Copiar para Word'}</span>
                </button>
              </div>
            </div>

            {/* Tabla formateada médica */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF8F5', borderBottom: '2px solid var(--color-ink)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>Variable clínica</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>Total (N = 300)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-accent)' }}>Intervención (n = 150)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#475569' }}>Control (n = 150)</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>p-valor</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-text-tertiary)' }}>Test aplicado</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      v: 'Edad (años)',
                      tot: table1Format === 'mean' ? '64.2 ± 8.6' : '65.0 [58.0 - 71.0]',
                      int: table1Format === 'mean' ? '63.9 ± 8.4' : '64.0 [58.0 - 70.0]',
                      ctl: table1Format === 'mean' ? '64.5 ± 8.8' : '65.0 [58.0 - 71.5]',
                      p: '0.542',
                      test: 't-Student independiente',
                    },
                    {
                      v: 'Sexo femenino, n (%)',
                      tot: '138 (46.0%)',
                      int: '71 (47.3%)',
                      ctl: '67 (44.7%)',
                      p: '0.640',
                      test: 'Chi-cuadrado de Pearson',
                    },
                    {
                      v: 'Índice masa corporal (kg/m²)',
                      tot: table1Format === 'mean' ? '27.4 ± 3.8' : '27.1 [24.8 - 29.6]',
                      int: table1Format === 'mean' ? '27.2 ± 3.6' : '27.0 [24.7 - 29.4]',
                      ctl: table1Format === 'mean' ? '27.6 ± 4.0' : '27.3 [24.9 - 29.8]',
                      p: '0.364',
                      test: 't-Student independiente',
                    },
                    {
                      v: 'Biomarcador sérico basal (pg/mL)',
                      tot: table1Format === 'mean' ? '48.6 ± 32.1' : '38.2 [22.4 - 68.0]',
                      int: table1Format === 'mean' ? '49.1 ± 33.4' : '39.0 [21.8 - 69.4]',
                      ctl: table1Format === 'mean' ? '48.1 ± 30.8' : '37.5 [23.0 - 66.8]',
                      p: '0.791',
                      test: 'U de Mann-Whitney (no normal)',
                    },
                    {
                      v: 'Hipertensión arterial previa, n (%)',
                      tot: '174 (58.0%)',
                      int: '86 (57.3%)',
                      ctl: '88 (58.7%)',
                      p: '0.814',
                      test: 'Chi-cuadrado de Pearson',
                    },
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAF8F5',
                      }}
                    >
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: 'var(--color-ink)' }}>{row.v}</td>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.tot}</td>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                        {row.int}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#475569' }}>
                        {row.ctl}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>{row.p}</td>
                      <td style={{ padding: '0.65rem 1rem', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{row.test}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
