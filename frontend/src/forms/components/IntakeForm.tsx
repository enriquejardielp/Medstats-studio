import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Clock,
  User,
  Calculator,
  ChevronRight,
  Hash,
  GitBranch,
  ClipboardPaste,
  Check,
  ListOrdered,
} from 'lucide-react';
import type { ClinicalForm, FormField, RecordEntry } from '../types/clinical';
import { calculateFieldValue, checkClinicalAlert } from '../utils/calculator';
import { isConditionMet } from '../utils/conditional';
import { TextExtractorModal } from './TextExtractorModal';

interface IntakeFormProps {
  form: ClinicalForm;
  records: RecordEntry[];
  onSaveRecord: (entry: RecordEntry, andNext: boolean) => void;
  onGoToRecords: () => void;
}

export function IntakeForm({ form, records, onSaveRecord, onGoToRecords }: IntakeFormProps) {
  // Suggest next record code based on current count
  const nextSuggestedCode = useMemo(() => {
    const prefix = form.codePrefix || 'REG-';
    const num = records.length + 1;
    return `${prefix}${String(num).padStart(3, '0')}`;
  }, [form.codePrefix, records.length]);

  const [recordCode, setRecordCode] = useState<string>(nextSuggestedCode);
  const [author, setAuthor] = useState<string>('Clínico / Investigador');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTextExtractorOpen, setIsTextExtractorOpen] = useState(false);
  const [textExtractorSection, setTextExtractorSection] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenTextExtractor = (sectionName: string | null = null) => {
    setTextExtractorSection(sectionName);
    setIsTextExtractorOpen(true);
  };

  const handleApplyExtractedData = (dataToMerge: Record<string, any>) => {
    setFormData((prev) => ({
      ...prev,
      ...dataToMerge,
    }));

    setErrors((prev) => {
      const copy = { ...prev };
      Object.keys(dataToMerge).forEach((k) => delete copy[k]);
      return copy;
    });

    const count = Object.keys(dataToMerge).length;
    setSavedSuccessMsg(`✨ Se han autocompletado ${count} ${count === 1 ? 'variable clínica' : 'variables clínicas'} desde el texto libre.`);
    setTimeout(() => setSavedSuccessMsg(null), 4500);
  };

  // Sync default values when form changes or resets
  useEffect(() => {
    setRecordCode(nextSuggestedCode);
    const initialData: Record<string, any> = {};
    form.fields.forEach((f) => {
      if (f.defaultValue !== undefined) {
        initialData[f.name] = f.defaultValue;
      }
    });
    setFormData(initialData);
    setErrors({});
  }, [form, nextSuggestedCode]);

  // Compute calculated fields in real-time
  const computedValues = useMemo(() => {
    const computed: Record<string, any> = {};
    form.fields.forEach((f) => {
      if (f.type === 'calculated') {
        const val = calculateFieldValue(f, { ...formData, ...computed });
        if (val !== null && val !== undefined) {
          computed[f.name] = val;
        }
      }
    });
    return computed;
  }, [form.fields, formData]);

  // Combined current data with computed values
  const activeFullData = useMemo(() => {
    return { ...formData, ...computedValues };
  }, [formData, computedValues]);

  // Handle value change
  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    if (errors[fieldName]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  // Keyboard shortcut: Ctrl + Enter to save & next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Group fields by sections, filtering out hidden conditional sections and fields
  const groupedSections = useMemo(() => {
    const sections = form.sections && form.sections.length > 0 ? form.sections : ['Datos Clínicos'];
    const map = new Map<string, FormField[]>();

    // 1. Filter out sections whose condition is not satisfied
    const visibleSections = sections.filter((sec) => {
      const rule = form.sectionRules?.[sec];
      if (!rule) return true;
      return isConditionMet(rule, activeFullData);
    });

    visibleSections.forEach((sec) => map.set(sec, []));

    // 2. Filter out fields whose condition is not satisfied
    form.fields.forEach((f) => {
      const sec = f.section && map.has(f.section) ? f.section : visibleSections[0];
      if (!map.has(sec)) return;

      if (isConditionMet(f.conditional, activeFullData)) {
        map.get(sec)!.push(f);
      }
    });

    return Array.from(map.entries()).filter(([_, fields]) => fields.length > 0);
  }, [form, activeFullData]);

  // Keep activeSection valid
  useEffect(() => {
    if (groupedSections.length > 0) {
      if (!activeSection || !groupedSections.some(([title]) => title === activeSection)) {
        setActiveSection(groupedSections[0][0]);
      }
    }
  }, [groupedSections, activeSection]);

  // Determine completed sections (all required or all fields filled)
  const completedSections = useMemo(() => {
    const set = new Set<string>();
    groupedSections.forEach(([secTitle, fields]) => {
      if (fields.length === 0) return;
      const targetFields = fields.filter((f) => f.required && f.type !== 'calculated');
      const fieldsToCheck = targetFields.length > 0 ? targetFields : fields.filter((f) => f.type !== 'calculated');
      if (fieldsToCheck.length === 0) return;

      const isCompleted = fieldsToCheck.every((f) => {
        const val = activeFullData[f.name];
        return val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
      });

      if (isCompleted) {
        set.add(secTitle);
      }
    });
    return set;
  }, [groupedSections, activeFullData]);

  // Mandatory fields progress stats
  const mandatoryStats = useMemo(() => {
    const visibleFields = new Set<string>();
    groupedSections.forEach(([_, fields]) => {
      fields.forEach((f) => visibleFields.add(f.name));
    });

    const requiredFields = form.fields.filter(
      (f) => f.required && f.type !== 'calculated' && visibleFields.has(f.name)
    );

    const filledCount = requiredFields.filter((f) => {
      const val = activeFullData[f.name];
      return val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0);
    }).length;

    return {
      total: requiredFields.length,
      filled: filledCount,
      percentage: requiredFields.length > 0 ? Math.round((filledCount / requiredFields.length) * 100) : 100,
    };
  }, [form.fields, groupedSections, activeFullData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!recordCode.trim()) {
      newErrors._code = 'El identificador de caso es obligatorio.';
    }

    // Identify which fields are currently visible
    const visibleFields = new Set<string>();
    groupedSections.forEach(([_, fields]) => {
      fields.forEach((f) => visibleFields.add(f.name));
    });

    form.fields.forEach((f) => {
      if (f.required && f.type !== 'calculated' && visibleFields.has(f.name)) {
        const val = activeFullData[f.name];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[f.name] = `Campo requerido: ${f.label}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (andNext: boolean) => {
    if (!validateForm()) {
      const firstErrorKey = Object.keys(errors)[0];
      const el = document.getElementById(`field-${firstErrorKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const newEntry: RecordEntry = {
      id: 'rec-' + Date.now(),
      recordCode: recordCode.trim(),
      timestamp: new Date().toISOString(),
      author: author.trim() || undefined,
      data: activeFullData,
    };

    onSaveRecord(newEntry, andNext);

    setSavedSuccessMsg(`Caso ${newEntry.recordCode} guardado exitosamente.`);
    setTimeout(() => {
      setSavedSuccessMsg(null);
    }, 3500);

    if (andNext) {
      // Reset data for next entry
      const initialData: Record<string, any> = {};
      form.fields.forEach((f) => {
        if (f.defaultValue !== undefined) {
          initialData[f.name] = f.defaultValue;
        }
      });
      setFormData(initialData);
      setErrors({});

      // Focus first input
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleReset = () => {
    if (window.confirm('¿Deseas restablecer los campos de este caso?')) {
      setFormData({});
      setErrors({});
    }
  };

  const scrollToSection = (secTitle: string) => {
    setActiveSection(secTitle);
    const el = document.getElementById(`section-card-${secTitle.replace(/\s+/g, '-')}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Last 3 recently entered records for quick review
  const recentRecords = useMemo(() => {
    return records.slice(-3).reverse();
  }, [records]);

  return (
    <div className="ms-form-container">
      {/* Top Banner & Quick Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">{form.title}</h1>
            <span className="ms-badge">
              {form.fields.length} variables
            </span>
            {form.codePrefix && (
              <span className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-deep)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                Prefijo: {form.codePrefix}
              </span>
            )}
          </div>
          {form.description && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-2xl">{form.description}</p>
          )}
        </div>

        {/* Global actions & keyboard tip */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenTextExtractor(null)}
            className="ms-btn ms-btn-secondary ms-btn-sm"
            title="Pegar analítica completa, informe o antecedentes para autocompletar el caso"
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
            <span>Rellenar desde Texto Libre</span>
          </button>

          <div className="hidden xl:flex items-center text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-deep)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5">
            <kbd className="px-1.5 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] font-mono mr-1 shadow-2xs text-[var(--color-text-primary)]">
              Ctrl
            </kbd>
            +
            <kbd className="px-1.5 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[11px] font-mono mx-1 shadow-2xs text-[var(--color-text-primary)]">
              Enter
            </kbd>
            <span className="ml-1">guardar y avanzar</span>
          </div>

          <button
            onClick={() => handleSubmit(true)}
            className="ms-btn ms-btn-primary ms-btn-sm"
          >
            <Save size={15} />
            <span>Guardar y Siguiente</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {savedSuccessMsg && (
        <div className="mb-6 p-3.5 bg-[var(--color-success-soft)] border border-[#C5E3D1] rounded-lg flex items-center justify-between text-[var(--color-ink)] text-sm slide-up">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
            <span className="font-semibold">{savedSuccessMsg}</span>
          </div>
          <button
            onClick={onGoToRecords}
            className="ms-btn ms-btn-sm ms-btn-ghost"
            style={{ color: 'var(--color-success)' }}
          >
            <span>Ver registros ({records.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Mobile Horizontal Quick Navigation */}
      {groupedSections.length > 1 && (
        <div className="lg:hidden mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-2.5 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 flex items-center gap-1.5">
            <ListOrdered className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Secciones del Formulario:</span>
          </div>
          <div className="ms-form-nav-mobile">
            {groupedSections.map(([secTitle]) => {
              const isActive = activeSection === secTitle;
              const isCompleted = completedSections.has(secTitle);

              return (
                <button
                  key={secTitle}
                  type="button"
                  onClick={() => scrollToSection(secTitle)}
                  className={`ms-form-chip ${isActive ? 'is-active' : ''}`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                  ) : (
                    <span className="ms-form-chip-bullet" />
                  )}
                  <span>{secTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Two-Column Structure: Sticky Sidebar (Left) + Form (Center) */}
      <div className="ms-form-layout">
        {/* Left Sticky Sidebar: Section Index + Existing Auxiliary Panels */}
        <aside className="ms-form-sidebar space-y-5">
          {/* Section Index Card */}
          <div className="ms-card p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                Índice de Secciones
              </span>
              <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                {groupedSections.length} {groupedSections.length === 1 ? 'sección' : 'secciones'}
              </span>
            </div>

            <nav className="ms-form-nav" aria-label="Navegación de secciones eCRF">
              {groupedSections.map(([secTitle, fields]) => {
                const isActive = activeSection === secTitle;
                const isCompleted = completedSections.has(secTitle);

                return (
                  <button
                    key={secTitle}
                    type="button"
                    onClick={() => scrollToSection(secTitle)}
                    className={`ms-form-nav-item ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                      ) : (
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-neutral-muted)]'
                          }`}
                        />
                      )}
                      <span className="truncate">{secTitle}</span>
                    </div>
                    <span className="ms-form-nav-badge shrink-0">{fields.length}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Database Summary Card (Existing Auxiliary Widget) */}
          <div className="ms-card p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                Estado de la Base de Datos
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Casos registrados:</span>
                <span className="font-bold text-[var(--color-ink)] font-mono text-sm">{records.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Variables activas:</span>
                <span className="font-semibold text-[var(--color-ink)] font-mono">{form.fields.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Prefijo de caso:</span>
                <span className="font-mono text-[var(--color-accent)] font-semibold">{form.codePrefix || 'REG-'}</span>
              </div>
            </div>

            <button
              onClick={onGoToRecords}
              className="mt-2 w-full ms-btn ms-btn-secondary ms-btn-sm"
            >
              <span>Abrir tabla completa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Real-time Formulas Panel (Existing Auxiliary Widget) */}
          {Object.keys(computedValues).length > 0 && (
            <div className="ms-card p-4 bg-[var(--color-bg-deep)] border-[var(--color-border-strong)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  Cálculos en Tiempo Real
                </span>
              </div>

              <div className="space-y-2">
                {Object.entries(computedValues).map(([key, val]) => {
                  const fieldDef = form.fields.find((f) => f.name === key);
                  return (
                    <div key={key} className="bg-[var(--color-surface)] p-2.5 rounded-md border border-[var(--color-border)]">
                      <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] truncate">
                        {fieldDef?.label || key}
                      </div>
                      <div className="text-base font-bold font-mono text-[var(--color-accent-strong)] flex items-baseline gap-1 mt-0.5">
                        {val}
                        {fieldDef?.unit && (
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{fieldDef.unit}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Records Strip (Existing Auxiliary Widget) */}
          <div className="ms-card p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                Últimos Registros
              </span>
            </div>

            {recentRecords.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] italic py-2 text-center">
                Aún no hay casos guardados.
              </p>
            ) : (
              <div className="space-y-2">
                {recentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="p-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[var(--color-ink)]">{r.recordCode}</span>
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                      {Object.entries(r.data)
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Center Form Area (Max-Width ~760px) */}
        <main className="ms-form-main">
          {/* Metadata Card: Patient / Case Code */}
          <div className="ms-form-section">
            <div className="ms-form-section-header">
              <span className="ms-form-section-title">
                <Hash className="w-4 h-4 text-[var(--color-accent)]" />
                Identificador de Sujeto / Paciente
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)] font-mono">Clave primaria de la fila</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="ms-form-field">
                <div className="ms-form-label-row">
                  <label htmlFor="input-record-code" className="ms-form-label">
                    Código de Registro <span className="ms-form-required">*</span>
                  </label>
                  <span className="ms-form-colname font-mono">_code</span>
                </div>
                <input
                  id="input-record-code"
                  type="text"
                  value={recordCode}
                  onChange={(e) => setRecordCode(e.target.value)}
                  placeholder="Ej. PAC-001 o ID-SUJETO"
                  className={`ms-form-input font-mono font-semibold ${errors._code ? 'has-error' : ''}`}
                />
                {errors._code && (
                  <p className="ms-form-error">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors._code}</span>
                  </p>
                )}
              </div>

              <div className="ms-form-field">
                <div className="ms-form-label-row">
                  <label htmlFor="input-author" className="ms-form-label">
                    Profesional / Investigador
                  </label>
                  <span className="ms-form-colname font-mono">author</span>
                </div>
                <div className="relative">
                  <input
                    id="input-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nombre o firma del clínico"
                    className="ms-form-input pl-9"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grouped Clinical Sections */}
          {groupedSections.map(([sectionTitle, fields], sIdx) => (
            <section
              key={sectionTitle}
              id={`section-card-${sectionTitle.replace(/\s+/g, '-')}`}
              className="ms-form-section"
            >
              <div className="ms-form-section-header">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
                  <h2 className="ms-form-section-title">{sectionTitle}</h2>
                  {form.sectionRules?.[sectionTitle] && (
                    <span className="text-[10px] text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-indigo-600" />
                      Sección Condicional
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTextExtractor(sectionTitle)}
                    className="ms-btn ms-btn-sm ms-btn-secondary"
                    title={`Pegar informe o analítica para autocompletar la sección ${sectionTitle}`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                    <span className="hidden sm:inline">Pegar texto aquí</span>
                    <span className="sm:hidden">Pegar</span>
                  </button>
                  <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                    {fields.length} {fields.length === 1 ? 'var' : 'vars'}
                  </span>
                </div>
              </div>

              {/* Fields Container (Separation ~24px between fields) */}
              <div className="ms-form-section-body">
                <div className="ms-form-field-grid ms-form-field-grid-2">
                  {fields.map((field, fIdx) => {
                    const currentValue = activeFullData[field.name] ?? '';
                    const alertMsg = checkClinicalAlert(field, currentValue);
                    const isCalculated = field.type === 'calculated';
                    const isConditional = !!field.conditional;
                    const hasError = !!errors[field.name];

                    // Full-width fields: textarea, multiselect, description-heavy, or wide single elements
                    const isWide =
                      field.type === 'textarea' ||
                      field.type === 'multiselect' ||
                      (field.options && field.options.length > 4);

                    return (
                      <div
                        key={field.id}
                        id={`field-${field.name}`}
                        className={`ms-form-field ${isWide ? 'ms-form-col-span-2' : ''} ${
                          isConditional ? 'border-l-2 border-l-indigo-400 pl-3 py-1' : ''
                        }`}
                      >
                        {/* Label & Meta Row */}
                        <div className="ms-form-label-row">
                          <label
                            htmlFor={`field-ctrl-${field.name}`}
                            className="ms-form-label"
                          >
                            <span>{field.label}</span>
                            {field.required && !isCalculated && (
                              <span className="ms-form-required" title="Campo obligatorio">
                                *
                              </span>
                            )}
                            {isCalculated && (
                              <span className="ms-form-calculated-badge">
                                <Calculator className="w-2.5 h-2.5" /> Automático
                              </span>
                            )}
                            {isConditional && (
                              <span
                                className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
                                title="Campo dependiente de otra variable"
                              >
                                <GitBranch className="w-2.5 h-2.5 text-indigo-600" /> Condicional
                              </span>
                            )}
                          </label>
                          <span className="ms-form-colname" title="Columna BD">
                            {field.name}
                          </span>
                        </div>

                        {/* Specialized Field Control Inputs */}
                        {isCalculated ? (
                          <div className="ms-form-calculated">
                            <div className="space-y-0.5">
                              <span className="text-xs text-[var(--color-text-secondary)]">Resultado calculado</span>
                              <div className="ms-form-calculated-value">
                                <span>
                                  {currentValue !== '' && currentValue !== null && currentValue !== undefined
                                    ? currentValue
                                    : 'Pendiente de datos'}
                                </span>
                                {field.unit && (
                                  <span className="text-xs font-normal text-[var(--color-text-secondary)]">
                                    {field.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-0.5 rounded border border-[var(--color-accent)]/20">
                              Solo lectura
                            </span>
                          </div>
                        ) : field.type === 'number' ? (
                          <div className="ms-form-input-affix">
                            <input
                              ref={sIdx === 0 && fIdx === 0 ? firstInputRef : undefined}
                              id={`field-ctrl-${field.name}`}
                              type="number"
                              step={field.step || 'any'}
                              min={field.min}
                              max={field.max}
                              value={currentValue}
                              onChange={(e) =>
                                handleInputChange(
                                  field.name,
                                  e.target.value === '' ? '' : Number(e.target.value)
                                )
                              }
                              placeholder={
                                field.placeholder || (field.min !== undefined ? `Mín: ${field.min}` : '0')
                              }
                              className={`ms-form-input font-mono ${hasError ? 'has-error' : ''}`}
                            />
                            {field.unit && <span className="ms-form-unit">{field.unit}</span>}
                          </div>
                        ) : field.type === 'boolean' ? (
                          <div
                            className="ms-form-segmented"
                            role="radiogroup"
                            aria-label={field.label}
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={currentValue === true}
                              onClick={() => handleInputChange(field.name, true)}
                              className={`ms-form-segmented-btn ${currentValue === true ? 'is-active' : ''}`}
                            >
                              <span>Sí / Positivo</span>
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={currentValue === false}
                              onClick={() => handleInputChange(field.name, false)}
                              className={`ms-form-segmented-btn ${currentValue === false ? 'is-active' : ''}`}
                            >
                              <span>No / Negativo</span>
                            </button>
                          </div>
                        ) : field.type === 'radio' ? (
                          <div
                            className="ms-form-chip-grid pt-1"
                            role="radiogroup"
                            aria-label={field.label}
                          >
                            {field.options?.map((opt) => {
                              const isSelected = currentValue === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  onClick={() => handleInputChange(field.name, opt)}
                                  className={`ms-form-chip ${isSelected ? 'is-active' : ''}`}
                                >
                                  {isSelected ? (
                                    <Check className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                                  ) : (
                                    <span className="ms-form-chip-bullet" />
                                  )}
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : field.type === 'multiselect' ? (
                          <div
                            className="ms-form-chip-grid pt-1"
                            role="group"
                            aria-label={field.label}
                          >
                            {field.options?.map((opt) => {
                              const selectedList = Array.isArray(currentValue) ? currentValue : [];
                              const isChecked = selectedList.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="checkbox"
                                  aria-checked={isChecked}
                                  onClick={() => {
                                    if (isChecked) {
                                      handleInputChange(
                                        field.name,
                                        selectedList.filter((item: string) => item !== opt)
                                      );
                                    } else {
                                      handleInputChange(field.name, [...selectedList, opt]);
                                    }
                                  }}
                                  className={`ms-form-chip ${isChecked ? 'is-active' : ''}`}
                                >
                                  {isChecked ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                                  ) : (
                                    <span className="ms-form-chip-bullet" />
                                  )}
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : field.type === 'select' ? (
                          <select
                            id={`field-ctrl-${field.name}`}
                            value={currentValue}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            className={`ms-form-select ${hasError ? 'has-error' : ''}`}
                          >
                            <option value="">-- Seleccionar opción --</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'date' ? (
                          <input
                            id={`field-ctrl-${field.name}`}
                            type="date"
                            value={currentValue}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            className={`ms-form-input font-mono ${hasError ? 'has-error' : ''}`}
                          />
                        ) : field.type === 'textarea' ? (
                          <textarea
                            id={`field-ctrl-${field.name}`}
                            rows={3}
                            value={currentValue}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            placeholder={field.placeholder || 'Observaciones clínicas...'}
                            className={`ms-form-textarea ${hasError ? 'has-error' : ''}`}
                          />
                        ) : (
                          <div className="ms-form-input-affix">
                            <input
                              id={`field-ctrl-${field.name}`}
                              type="text"
                              value={currentValue}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              placeholder={field.placeholder || ''}
                              className={`ms-form-input ${hasError ? 'has-error' : ''}`}
                            />
                            {field.unit && <span className="ms-form-unit">{field.unit}</span>}
                          </div>
                        )}

                        {/* Description or Clinical Explanation */}
                        {field.description && (
                          <p className="ms-form-help">{field.description}</p>
                        )}

                        {/* Error text */}
                        {hasError && (
                          <p className="ms-form-error">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{errors[field.name]}</span>
                          </p>
                        )}

                        {/* Clinical Range Warning Alert */}
                        {alertMsg && (
                          <div className="ms-form-alert">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>{alertMsg}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </main>
      </div>

      {/* Sticky Bottom Action Bar */}
      <footer className="ms-form-actionbar" role="region" aria-label="Acciones de guardado de formulario">
        <div className="ms-form-actionbar-inner">
          {/* Left: Reset button & Mandatory Progress Counter */}
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={handleReset}
              className="ms-btn ms-btn-sm ms-btn-ghost"
              title="Restablecer los valores de este caso"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer campos</span>
            </button>

            {mandatoryStats.total > 0 && (
              <div className="ms-form-progress" title="Progreso de campos obligatorios requeridos">
                <div className="ms-form-progress-bar">
                  <div
                    className="ms-form-progress-fill"
                    style={{ width: `${mandatoryStats.percentage}%` }}
                  />
                </div>
                <span>
                  <strong>{mandatoryStats.filled}</strong> de {mandatoryStats.total} obligatorios
                </span>
              </div>
            )}
          </div>

          {/* Right: Saving Action Controls */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="ms-btn ms-btn-secondary"
            >
              Guardar y Mantener
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="ms-btn ms-btn-primary ms-btn-lg"
              title="Atajo de teclado: Ctrl + Enter"
            >
              <Save className="w-4 h-4" />
              <span>Guardar y Siguiente</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Free-Text Clinical Data Extractor Modal */}
      <TextExtractorModal
        isOpen={isTextExtractorOpen}
        onClose={() => setIsTextExtractorOpen(false)}
        form={form}
        targetSection={textExtractorSection}
        currentFormData={activeFullData}
        onApplyExtractedData={handleApplyExtractedData}
      />
    </div>
  );
}