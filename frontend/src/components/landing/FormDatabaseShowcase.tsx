import React, { useState } from 'react';
import {
  ClipboardList,
  Table,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Database,
  Check,
  AlertTriangle,
  Play,
} from 'lucide-react';

export const FormDatabaseShowcase: React.FC<{ onOpenAuthModal?: (reason: string) => void }> = ({ onOpenAuthModal }) => {
  const [activeStep, setActiveStep] = useState<'builder' | 'intake' | 'database'>('builder');

  // Estado simulado interactivo para la vista de captura
  const [patientId, setPatientId] = useState('PAC-024');
  const [patientAge, setPatientAge] = useState<string>('67');
  const [patientGroup, setPatientGroup] = useState<string>('Tratamiento Activo');
  const [patientPressure, setPatientPressure] = useState<string>('138');
  const [patientBiomarker, setPatientBiomarker] = useState<string>('42.5');
  const [recordsCount, setRecordsCount] = useState<number>(23);
  const [submittedBanner, setSubmittedBanner] = useState<boolean>(false);

  const isPressureValid = Number(patientPressure) >= 60 && Number(patientPressure) <= 240;

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedBanner(true);
    setRecordsCount((prev) => prev + 1);
    setTimeout(() => {
      setSubmittedBanner(false);
      const nextNum = parseInt(patientId.replace('PAC-', ''), 10) + 1;
      setPatientId(`PAC-0${nextNum}`);
    }, 2500);
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid var(--color-border)',
        boxShadow: '0 20px 45px -12px rgba(52, 47, 42, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Selector de Pasos del Flujo Formulario -> Base de Datos */}
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
          <Database size={17} color="var(--color-accent)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
            Ciclo Integrado de Datos Clínicos
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'builder', label: '1. Diseña el Formulario eCRF', icon: ClipboardList },
            { id: 'intake', label: '2. Recoge Datos con Validación', icon: ShieldCheck },
            { id: 'database', label: '3. Base de Datos Generada', icon: Table },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeStep === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStep(tab.id as any)}
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

      <div style={{ padding: '2rem' }}>
        {/* ============================================================== */}
        {/* VISTA 1: CONSTRUCTOR DE FORMULARIOS CUSTOMIZABLES             */}
        {/* ============================================================== */}
        {activeStep === 'builder' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
            <div>
              <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                Cuaderno eCRF Modular
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.55rem', margin: '0.25rem 0 0.6rem', color: 'var(--color-ink)' }}>
                Diseña formularios a la medida exacta de tu estudio
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Define las variables clínicas que necesitas recolectar sin depender de hojas de cálculo desordenadas. Organiza por secciones temáticas, añade campos numéricos con rangos de plausibilidad fisiológica, menús desplegables y escalas clínicas estandarizadas.
              </p>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
                    <strong>Validación de rangos en vivo:</strong> Evita errores humanos de tipeo (ej. presiones arteriales de 4 dígitos o glucemias imposibles).
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
                    <strong>Múltiples tipos de variables:</strong> Numéricas con unidades, categorías diagnósticas, fechas de seguimiento, escalas y casillas binarias.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
                    <strong>Diccionario de datos automático:</strong> Cada campo creado queda catalogado con su tipo y descripción para el análisis bioestadístico.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveStep('intake')}
                  className="ms-btn ms-btn-primary ms-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <span>Ver cómo se recogen los datos</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Simulación visual del FormBuilder */}
            <div
              style={{
                backgroundColor: '#FAF8F5',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '1.35rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '0.65rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                    Constructor Visual de Variables Clínicas
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-tertiary)' }}>
                    Formulario Activo: Registro Basal y Seguimiento
                  </div>
                </div>
                <span className="ms-badge" style={{ backgroundColor: 'var(--color-teal-100)', color: 'var(--color-accent-strong)' }}>
                  6 campos activos
                </span>
              </div>

              {/* Lista de campos configurados */}
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {[
                  { name: 'Identificador de Paciente', type: 'Texto / Autoincremental', rule: 'Prefijo PAC- (Único)' },
                  { name: 'Edad al ingreso (años)', type: 'Numérico continuo', rule: 'Rango: 18 - 99 años' },
                  { name: 'Grupo de asignación', type: 'Opción única (Radio)', rule: '2 opciones (Intervención / Control)' },
                  { name: 'Tensión Arterial Sistólica', type: 'Numérico [mmHg]', rule: 'Rango fisiológico: 60 - 240 mmHg' },
                  { name: 'Biomarcador Sérico Basal', type: 'Numérico decimal', rule: 'Unidad: pg/mL (>= 0)' },
                ].map((field, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem 0.95rem',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{field.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-tertiary)' }}>{field.rule}</div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        backgroundColor: '#F3F0EA',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {field.type}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.65rem',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  color: 'var(--color-accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: '#FFFFFF',
                }}
              >
                + Añadir nueva variable clínica al cuaderno eCRF
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VISTA 2: ENTRADA DE DATOS DEL PACIENTE CON VALIDACIÓN          */}
        {/* ============================================================== */}
        {activeStep === 'intake' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
            <div>
              <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                Captura Controlada de Datos
              </div>
              <h3 className="ms-display" style={{ fontSize: '1.55rem', margin: '0.25rem 0 0.6rem', color: 'var(--color-ink)' }}>
                Recogida clínica protegida contra errores
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Prueba el formulario interactivo: introduce valores y observa cómo las reglas de validación supervisan la consistencia de los datos en tiempo real antes de incorporarlos a la base de datos de tu cohorte.
              </p>

              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--color-teal-50)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-teal-200)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-accent-strong)', marginBottom: '0.25rem' }}>
                  Auditoría de integridad activa:
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-accent-strong)' }}>
                  Si un colaborador introduce un valor biológicamente imposible o deja un campo obligatorio sin responder, el sistema le alertará de inmediato impidiendo que la base de datos se contamine.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStep('database')}
                className="ms-btn ms-btn-primary ms-btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <span>Ver la base de datos generada ({recordsCount} registros)</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Formulario Interactivo de Demostración */}
            <div
              style={{
                backgroundColor: '#FAF8F5',
                borderRadius: '16px',
                border: '1px solid var(--color-border)',
                padding: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-ink)' }}>
                  Nuevo Registro Clínico
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  ID asignado: <strong style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{patientId}</strong>
                </span>
              </div>

              {submittedBanner && (
                <div
                  style={{
                    backgroundColor: 'var(--color-success-soft)',
                    border: '1px solid var(--color-success)',
                    color: 'var(--color-success)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.8rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Check size={16} />
                  <span>¡Registro añadido exitosamente a la base de datos del estudio!</span>
                </div>
              )}

              <form onSubmit={handleSimulateSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="ms-label" style={{ fontSize: '0.78rem' }}>Edad (años)</label>
                    <input
                      type="number"
                      className="ms-input"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      min="18"
                      max="105"
                      required
                    />
                  </div>
                  <div>
                    <label className="ms-label" style={{ fontSize: '0.78rem' }}>Grupo Asignado</label>
                    <select
                      className="ms-select"
                      value={patientGroup}
                      onChange={(e) => setPatientGroup(e.target.value)}
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                    >
                      <option value="Tratamiento Activo">Tratamiento Activo</option>
                      <option value="Control / Placebo">Control / Placebo</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="ms-label" style={{ fontSize: '0.78rem' }}>
                      Tensión Arterial Sistólica (mmHg)
                    </label>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-tertiary)' }}>Rango: 60 - 240</span>
                  </div>
                  <input
                    type="number"
                    className="ms-input"
                    value={patientPressure}
                    onChange={(e) => setPatientPressure(e.target.value)}
                    style={{
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.85rem',
                      borderColor: !isPressureValid ? 'var(--color-error)' : undefined,
                    }}
                  />
                  {!isPressureValid && (
                    <div style={{ color: 'var(--color-error)', fontSize: '0.72rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <AlertTriangle size={12} /> Valor fuera del rango fisiológico admisible.
                    </div>
                  )}
                </div>

                <div>
                  <label className="ms-label" style={{ fontSize: '0.78rem' }}>
                    Biomarcador Sérico Basal (pg/mL)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    className="ms-input"
                    value={patientBiomarker}
                    onChange={(e) => setPatientBiomarker(e.target.value)}
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isPressureValid}
                  className="ms-btn ms-btn-primary ms-btn-sm"
                  style={{ width: '100%', marginTop: '0.4rem', justifyContent: 'center' }}
                >
                  <span>Guardar e incorporar a la Base de Datos</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VISTA 3: BASE DE DATOS RESULTANTE GENERADA AUTOMÁTICAMENTE    */}
        {/* ============================================================== */}
        {activeStep === 'database' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
                  Estructuración Automática de Cohortes
                </div>
                <h3 className="ms-display" style={{ fontSize: '1.55rem', margin: '0.2rem 0', color: 'var(--color-ink)' }}>
                  Tu base de datos clínica siempre limpia y lista para analizar
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '680px' }}>
                  Cada formulario completado actualiza en tiempo real esta tabla rectangular de datos. Sin celdas fusionadas, sin nombres de columnas ambiguos y con tipos de datos contrastados.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="ms-badge" style={{ backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)', fontSize: '0.78rem' }}>
                  ✓ 100% Calidad de Datos
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAuthModal) {
                      onOpenAuthModal('Para vincular tus formularios clínicos a proyectos permanentes y ejecutar análisis bioestadísticos en la nube, inicia sesión o crea tu cuenta.');
                    }
                  }}
                  className="ms-btn ms-btn-sm ms-btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Play size={13} fill="currentColor" />
                  <span>Lanzar Análisis Bioestadístico sobre esta Base de Datos</span>
                </button>
              </div>
            </div>

            {/* Tabla estructurada generada */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAF8F5', borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>ID Paciente</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>Edad</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--color-accent)' }}>Grupo</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>TAS (mmHg)</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>Biomarcador (pg/mL)</th>
                    <th style={{ padding: '0.65rem 1rem', fontWeight: 700, color: 'var(--color-ink)' }}>Estado eCRF</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'PAC-001', age: 62, group: 'Tratamiento Activo', tas: 135, bio: 38.4, status: 'Completo' },
                    { id: 'PAC-002', age: 71, group: 'Control / Placebo', tas: 142, bio: 54.1, status: 'Completo' },
                    { id: 'PAC-003', age: 58, group: 'Tratamiento Activo', tas: 128, bio: 29.8, status: 'Completo' },
                    { id: 'PAC-004', age: 66, group: 'Control / Placebo', tas: 150, bio: 61.2, status: 'Completo' },
                    { id: 'PAC-005', age: 64, group: 'Tratamiento Activo', tas: 130, bio: 33.6, status: 'Completo' },
                  ].map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAF8F5',
                      }}
                    >
                      <td style={{ padding: '0.6rem 1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-ink)' }}>
                        {row.id}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.age}</td>
                      <td style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: row.group.includes('Activo') ? 'var(--color-accent)' : '#475569' }}>
                        {row.group}
                      </td>
                      <td style={{ padding: '0.6rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.tas}</td>
                      <td style={{ padding: '0.6rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.bio}</td>
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <span style={{ fontSize: '0.72rem', backgroundColor: '#EDF2E9', color: '#3A5A38', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                          ✓ {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              <span>Mostrando los 5 registros más recientes de la cohorte activa ({recordsCount} sujetos en total).</span>
              <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Sincronización bidireccional con análisis estadístico</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
