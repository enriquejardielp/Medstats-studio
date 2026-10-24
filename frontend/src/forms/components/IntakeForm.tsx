import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Database,
  X,
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

/* ------------------------------ Utilidades ------------------------------ */

const TECH_KEY = 'ms-intake-show-tech';
const CLEARABLE_TYPES = ['boolean', 'radio', 'multiselect'];
const GROUP_TYPES = ['boolean', 'radio', 'multiselect'];
// Primer control "real" de un campo (ignora el botón "Limpiar")
const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not(.ms-form-clear)';

const isFilled = (v: unknown): boolean =>
  v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0);

const slug = (s: string) => s.replace(/\s+/g, '-');

const scrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';

const formatValue = (v: unknown): string => {
  if (Array.isArray(v)) return v.join(', ');
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  return String(v);
};

const numberPlaceholder = (field: FormField): string => {
  if (field.placeholder) return field.placeholder;
  if (field.min !== undefined && field.max !== undefined) return `${field.min} – ${field.max}`;
  if (field.min !== undefined) return `≥ ${field.min}`;
  if (field.max !== undefined) return `≤ ${field.max}`;
  return '';
};

const getShortcutLabel = (): string =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '')
    ? '⌘ ↵'
    : 'Ctrl ↵';

/* ------------------------------- Componente ------------------------------ */

export function IntakeForm({ form, records, onSaveRecord, onGoToRecords }: IntakeFormProps) {
  // Código sugerido para el siguiente caso
  const nextSuggestedCode = useMemo(() => {
    const prefix = form.codePrefix || 'REG-';
    const num = records.length + 1;
    return `${prefix}${String(num).padStart(3, '0')}`;
  }, [form.codePrefix, records.length]);

  // Valores por defecto de las variables
  const initialData = useMemo(() => {
    const data: Record<string, any> = {};
    form.fields.forEach((f) => {
      if (f.defaultValue !== undefined) data[f.name] = f.defaultValue;
    });
    return data;
  }, [form.fields]);

  const [recordCode, setRecordCode] = useState<string>(nextSuggestedCode);
  const [author, setAuthor] = useState<string>('Clínico / Investigador');
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ text: string; showLink: boolean } | null>(null);
  const [isTextExtractorOpen, setIsTextExtractorOpen] = useState(false);
  const [textExtractorSection, setTextExtractorSection] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [showTech, setShowTech] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TECH_KEY) === '1';
    } catch {
      return false;
    }
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<number | null>(null);
  const spyLockUntil = useRef(0);
  const lastSuggestedRef = useRef(nextSuggestedCode);
  const forceCodeRef = useRef(false);
  const shortcutLabel = useMemo(getShortcutLabel, []);

  /* ------------------------------ Avisos (toast) ------------------------------ */

  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((text: string, showLink: boolean) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, showLink });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  /* --------------------------------- Efectos --------------------------------- */

  // Al cambiar de formulario se reinician los datos
  useEffect(() => {
    setFormData(initialData);
    setErrors({});
    setIsDirty(false);
  }, [initialData]);

  // El código solo se actualiza solo si el usuario no lo ha personalizado.
  // (Así "Guardar y mantener datos" no vacía el formulario al añadirse el registro.)
  useEffect(() => {
    setRecordCode((prev) =>
      forceCodeRef.current || !prev.trim() || prev === lastSuggestedRef.current
        ? nextSuggestedCode
        : prev
    );
    lastSuggestedRef.current = nextSuggestedCode;
    forceCodeRef.current = false;
  }, [nextSuggestedCode]);

  // Recordar la preferencia de "Nombres técnicos"
  useEffect(() => {
    try {
      localStorage.setItem(TECH_KEY, showTech ? '1' : '0');
    } catch {
      /* almacenamiento no disponible */
    }
  }, [showTech]);

  // Avisar si se intenta cerrar la pestaña con datos sin guardar
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* -------------------------------- Cálculos -------------------------------- */

  const computedValues = useMemo(() => {
    const computed: Record<string, any> = {};
    form.fields.forEach((f) => {
      if (f.type === 'calculated') {
        const val = calculateFieldValue(f, { ...formData, ...computed });
        if (val !== null && val !== undefined) computed[f.name] = val;
      }
    });
    return computed;
  }, [form.fields, formData]);

  const activeFullData = useMemo(() => ({ ...formData, ...computedValues }), [formData, computedValues]);

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setIsDirty(true);
    if (errors[fieldName]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[fieldName];
        return copy;
      });
    }
  };

  const handleApplyExtractedData = (dataToMerge: Record<string, any>) => {
    setFormData((prev) => ({ ...prev, ...dataToMerge }));
    setIsDirty(true);
    setErrors((prev) => {
      const copy = { ...prev };
      Object.keys(dataToMerge).forEach((k) => delete copy[k]);
      return copy;
    });
    const count = Object.keys(dataToMerge).length;
    showToast(
      `Se ${count === 1 ? 'ha autocompletado 1 variable' : `han autocompletado ${count} variables`} desde el texto libre.`,
      false
    );
  };

  const handleOpenTextExtractor = (sectionName: string | null = null) => {
    setTextExtractorSection(sectionName);
    setIsTextExtractorOpen(true);
  };

  /* ------------------------ Secciones visibles y progreso ------------------------ */

  const groupedSections = useMemo(() => {
    const sections = form.sections && form.sections.length > 0 ? form.sections : ['Datos Clínicos'];
    const map = new Map<string, FormField[]>();

    const visibleSections = sections.filter((sec) => {
      const rule = form.sectionRules?.[sec];
      if (!rule) return true;
      return isConditionMet(rule, activeFullData);
    });

    visibleSections.forEach((sec) => map.set(sec, []));

    form.fields.forEach((f) => {
      const sec = f.section && map.has(f.section) ? f.section : visibleSections[0];
      if (!map.has(sec)) return;
      if (isConditionMet(f.conditional, activeFullData)) map.get(sec)!.push(f);
    });

    return Array.from(map.entries()).filter(([_, fields]) => fields.length > 0);
  }, [form, activeFullData]);

  // Orden visual de las variables (para saber cuál es el primer error)
  const orderedFieldNames = useMemo(
    () => groupedSections.flatMap(([_, fields]) => fields.map((f) => f.name)),
    [groupedSections]
  );

  // Mantener una sección activa válida
  useEffect(() => {
    if (groupedSections.length > 0) {
      if (!activeSection || !groupedSections.some(([title]) => title === activeSection)) {
        setActiveSection(groupedSections[0][0]);
      }
    }
  }, [groupedSections, activeSection]);

  // Estado de cada sección: obligatorios completados y si está completa
  const sectionStats = useMemo(() => {
    const map = new Map<
      string,
      { requiredTotal: number; requiredFilled: number; complete: boolean }
    >();
    groupedSections.forEach(([title, fields]) => {
      const editable = fields.filter((f) => f.type !== 'calculated');
      const required = editable.filter((f) => f.required);
      const target = required.length > 0 ? required : editable;
      const filledTarget = target.filter((f) => isFilled(activeFullData[f.name])).length;
      map.set(title, {
        requiredTotal: required.length,
        requiredFilled: required.filter((f) => isFilled(activeFullData[f.name])).length,
        complete: target.length > 0 && filledTarget === target.length,
      });
    });
    return map;
  }, [groupedSections, activeFullData]);

  const mandatoryStats = useMemo(() => {
    const visible = new Set(orderedFieldNames);
    const requiredFields = form.fields.filter(
      (f) => f.required && f.type !== 'calculated' && visible.has(f.name)
    );
    const filled = requiredFields.filter((f) => isFilled(activeFullData[f.name])).length;
    return {
      total: requiredFields.length,
      filled,
      percentage: requiredFields.length > 0 ? Math.round((filled / requiredFields.length) * 100) : 100,
    };
  }, [form.fields, orderedFieldNames, activeFullData]);

  const errorCount = Object.keys(errors).length;

  const errorSections = useMemo(() => {
    const set = new Set<string>();
    groupedSections.forEach(([title, fields]) => {
      if (fields.some((f) => errors[f.name])) set.add(title);
    });
    return set;
  }, [groupedSections, errors]);

  const fieldLabels = useMemo(() => {
    const map = new Map<string, string>();
    form.fields.forEach((f) => map.set(f.name, f.label));
    return map;
  }, [form.fields]);

  /* ------------------------------ Navegación ------------------------------ */

  const focusField = useCallback((key: string) => {
    const wrapper = document.getElementById(`field-${key}`);
    if (!wrapper) return;
    wrapper.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    wrapper.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  }, []);

  const firstErrorKey = (errs: Record<string, string>) =>
    ['_code', ...orderedFieldNames].find((k) => errs[k]);

  const scrollToSection = (secTitle: string) => {
    setActiveSection(secTitle);
    spyLockUntil.current = Date.now() + 900; // evita que el scroll-spy pise el clic
    const el = document.getElementById(`section-card-${slug(secTitle)}`);
    if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  };

  // Scroll-spy: la sección activa sigue al scroll
  const sectionKey = groupedSections.map(([t]) => t).join('\u0000');
  useEffect(() => {
    const titles = sectionKey ? sectionKey.split('\u0000') : [];
    if (titles.length < 2 || typeof IntersectionObserver === 'undefined') return;

    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const title = (e.target as HTMLElement).dataset.section;
          if (!title) return;
          if (e.isIntersecting) inBand.add(title);
          else inBand.delete(title);
        });
        if (Date.now() < spyLockUntil.current) return;
        const current = titles.find((t) => inBand.has(t));
        if (current) setActiveSection(current);
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );

    titles.forEach((t) => {
      const el = document.getElementById(`section-card-${slug(t)}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionKey]);

  /* ------------------------------ Guardado ------------------------------ */

  const validate = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    if (!recordCode.trim()) {
      newErrors._code = 'Introduce un identificador para este caso.';
    }
    const visible = new Set(orderedFieldNames);
    form.fields.forEach((f) => {
      if (f.required && f.type !== 'calculated' && visible.has(f.name)) {
        if (!isFilled(activeFullData[f.name])) {
          newErrors[f.name] = 'Este campo es obligatorio.';
        }
      }
    });
    return newErrors;
  };

  const focusFirstField = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    container
      .querySelector<HTMLElement>('[data-capture-field]')
      ?.querySelector<HTMLElement>(FOCUSABLE)
      ?.focus({ preventScroll: true });
  };

  const handleSubmit = (andNext: boolean) => {
    const newErrors = validate();
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const first = firstErrorKey(newErrors);
      if (first) focusField(first);
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
    showToast(`Caso ${newEntry.recordCode} guardado.`, true);
    setIsDirty(false);

    if (andNext) {
      forceCodeRef.current = true; // el siguiente caso usa el código sugerido
      setFormData(initialData);
      setErrors({});
      window.setTimeout(focusFirstField, 80);
    }
  };

  // Atajo Ctrl/⌘ + Enter (se registra una sola vez y lee siempre la última versión)
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitRef.current(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleReset = () => {
    if (
      !isDirty ||
      window.confirm('¿Restablecer los campos de este caso? Se perderán los datos sin guardar.')
    ) {
      setFormData(initialData);
      setErrors({});
      setIsDirty(false);
    }
  };

  const recentRecords = useMemo(() => records.slice(-3).reverse(), [records]);

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="ms-form-container" ref={containerRef}>
      {/* Aviso de guardado / autocompletado */}
      {toast && (
        <div className="ms-form-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} className="ms-form-toast-icon" />
          <span>{toast.text}</span>
          {toast.showLink && (
            <button type="button" className="ms-form-toast-link" onClick={onGoToRecords}>
              <span>Ver registros ({records.length})</span>
              <ArrowRight size={14} />
            </button>
          )}
          <button
            type="button"
            className="ms-form-toast-close"
            onClick={dismissToast}
            aria-label="Cerrar aviso"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cabecera */}
      <header className="ms-form-header-block">
        <div className="ms-form-header-row">
          <div className="ms-form-header-text">
            <h1 className="ms-form-title">{form.title}</h1>
            <div className="ms-form-meta">
              <span className="ms-form-meta-pill">{form.fields.length} variables</span>
              {form.codePrefix && (
                <span className="ms-form-meta-pill" title="Prefijo de los identificadores de caso">
                  Prefijo {form.codePrefix}
                </span>
              )}
            </div>
            {form.description && <p className="ms-form-desc">{form.description}</p>}
            {mandatoryStats.total > 0 && (
              <p className="ms-form-legend">
                Los campos con <span className="ms-form-required" aria-hidden="true">*</span> son
                obligatorios.
              </p>
            )}
          </div>

          <div className="ms-form-header-actions">
            <button
              type="button"
              onClick={() => handleOpenTextExtractor(null)}
              className="ms-btn ms-btn-secondary ms-btn-sm"
              title="Pega una analítica, informe o antecedentes para autocompletar el caso"
            >
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Rellenar desde texto libre</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={showTech}
              onClick={() => setShowTech((v) => !v)}
              className="ms-form-switch"
              title="Muestra el nombre de columna de cada variable"
            >
              <span className="ms-form-switch-track" aria-hidden="true">
                <span className="ms-form-switch-knob" />
              </span>
              <span>Nombres técnicos</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegación de secciones en móvil / tablet */}
      {groupedSections.length > 1 && (
        <nav className="ms-form-nav-mobile-wrap" aria-label="Ir a una sección">
          <div className="ms-form-nav-mobile">
            {groupedSections.map(([secTitle]) => {
              const isActive = activeSection === secTitle;
              const hasError = errorSections.has(secTitle);
              const isComplete = sectionStats.get(secTitle)?.complete;
              return (
                <button
                  key={secTitle}
                  type="button"
                  onClick={() => scrollToSection(secTitle)}
                  className={`ms-form-chip ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {hasError ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-error)] shrink-0" />
                  ) : isComplete ? (
                    <Check className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                  ) : (
                    <span className="ms-form-chip-bullet" />
                  )}
                  <span>{secTitle}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <div className="ms-form-layout">
        {/* Columna principal */}
        <main className="ms-form-main">
          {/* Identificación del caso */}
          <section className="ms-form-section" aria-labelledby="section-case-title">
            <div className="ms-form-section-header">
              <div className="ms-form-section-heading">
                <h2 id="section-case-title" className="ms-form-section-title">
                  <Hash className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Identificación del caso</span>
                </h2>
              </div>
            </div>

            <div className="ms-form-field-grid ms-form-field-grid-2">
              <div className="ms-form-field" id="field-_code">
                <div className="ms-form-label-row">
                  <label htmlFor="input-record-code" className="ms-form-label">
                    <span>Código de registro</span>
                    <span className="ms-form-required" aria-hidden="true">*</span>
                  </label>
                </div>
                <input
                  id="input-record-code"
                  type="text"
                  value={recordCode}
                  onChange={(e) => {
                    setRecordCode(e.target.value);
                    if (errors._code) {
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy._code;
                        return copy;
                      });
                    }
                  }}
                  placeholder="Ej. PAC-001"
                  autoComplete="off"
                  aria-required="true"
                  aria-invalid={errors._code ? true : undefined}
                  aria-describedby={errors._code ? 'error-_code' : 'help-_code'}
                  className={`ms-form-input font-mono font-semibold ${errors._code ? 'has-error' : ''}`}
                />
                <div className="ms-form-meta-row">
                  {errors._code ? (
                    <p id="error-_code" className="ms-form-error">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors._code}</span>
                    </p>
                  ) : (
                    <span id="help-_code" className="ms-form-help">
                      Identificador único. Se propone automáticamente.
                    </span>
                  )}
                  {showTech && <span className="ms-form-colname">col: _code</span>}
                </div>
              </div>

              <div className="ms-form-field">
                <div className="ms-form-label-row">
                  <label htmlFor="input-author" className="ms-form-label">
                    <span>Profesional / Investigador</span>
                  </label>
                </div>
                <div className="ms-form-input-icon">
                  <User aria-hidden="true" />
                  <input
                    id="input-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nombre o firma"
                    autoComplete="name"
                    aria-describedby="help-author"
                    className="ms-form-input"
                  />
                </div>
                <div className="ms-form-meta-row">
                  <span id="help-author" className="ms-form-help">
                    Quién registra este caso.
                  </span>
                  {showTech && <span className="ms-form-colname">col: author</span>}
                </div>
              </div>
            </div>
          </section>

          {/* Secciones clínicas */}
          {groupedSections.map(([sectionTitle, fields]) => {
            const stats = sectionStats.get(sectionTitle);
            const isActive = groupedSections.length > 1 && activeSection === sectionTitle;
            const headingId = `heading-${slug(sectionTitle)}`;

            return (
              <section
                key={sectionTitle}
                id={`section-card-${slug(sectionTitle)}`}
                data-section={sectionTitle}
                className={`ms-form-section ${isActive ? 'is-active' : ''}`}
                aria-labelledby={headingId}
              >
                <div className="ms-form-section-header">
                  <div className="ms-form-section-heading">
                    {stats?.complete ? (
                      <CheckCircle2 className="ms-form-section-state" aria-hidden="true" />
                    ) : (
                      <span className="ms-form-section-dot" aria-hidden="true" />
                    )}
                    <h2 id={headingId} className="ms-form-section-title">
                      {sectionTitle}
                    </h2>
                    {stats?.complete && <span className="ms-sr-only">Sección completa</span>}
                    {form.sectionRules?.[sectionTitle] && (
                      <span
                        className="ms-form-meta-pill"
                        title="Esta sección aparece según otras respuestas"
                      >
                        <GitBranch className="w-3 h-3" />
                        Condicional
                      </span>
                    )}
                  </div>

                  <div className="ms-form-section-tools">
                    <span className="ms-form-section-count">
                      {stats && stats.requiredTotal > 0
                        ? `${stats.requiredFilled} de ${stats.requiredTotal} obligatorios`
                        : `${fields.length} ${fields.length === 1 ? 'variable' : 'variables'}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenTextExtractor(sectionTitle)}
                      className="ms-btn ms-btn-secondary ms-btn-sm"
                      title={`Pega un informe o analítica para autocompletar «${sectionTitle}»`}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      <span>Pegar texto</span>
                    </button>
                  </div>
                </div>

                <div className="ms-form-section-body">
                  <div className="ms-form-field-grid ms-form-field-grid-2">
                    {fields.map((field) => {
                      const currentValue = activeFullData[field.name] ?? '';
                      const alertMsg = checkClinicalAlert(field, currentValue);
                      const isCalculated = field.type === 'calculated';
                      const isConditional = !!field.conditional;
                      const hasError = !!errors[field.name];
                      const isGroup = GROUP_TYPES.includes(field.type);
                      const canClear = CLEARABLE_TYPES.includes(field.type) && isFilled(currentValue);

                      const ctrlId = `field-ctrl-${field.name}`;
                      const labelId = `field-label-${field.name}`;
                      const helpId = `help-${field.name}`;
                      const errorId = `error-${field.name}`;
                      const alertId = `alert-${field.name}`;
                      const describedBy =
                        [field.description && helpId, hasError && errorId, alertMsg && alertId]
                          .filter(Boolean)
                          .join(' ') || undefined;

                      // Atributos comunes de accesibilidad para controles nativos
                      const a11y = {
                        id: ctrlId,
                        'aria-required': field.required || undefined,
                        'aria-invalid': hasError || undefined,
                        'aria-describedby': describedBy,
                      };

                      // Campos largos u observaciones ocupan todo el ancho
                      const isFullWidth =
                        field.type === 'textarea' ||
                        field.type === 'multiselect' ||
                        isCalculated ||
                        (field.options && field.options.length > 3) ||
                        (field.description && field.description.length > 70);

                      const labelContent = (
                        <>
                          <span>{field.label}</span>
                          {field.required && !isCalculated && (
                            <span className="ms-form-required" aria-hidden="true" title="Obligatorio">
                              *
                            </span>
                          )}
                          {isCalculated && (
                            <span className="ms-form-calculated-badge">
                              <Calculator className="w-2.5 h-2.5" /> Automático
                            </span>
                          )}
                          {isConditional && (
                            <>
                              <span title="Depende de otra variable" className="inline-flex">
                                <GitBranch className="ms-form-cond-icon" aria-hidden="true" />
                              </span>
                              <span className="ms-sr-only">(campo condicional)</span>
                            </>
                          )}
                        </>
                      );

                      return (
                        <div
                          key={field.id}
                          id={`field-${field.name}`}
                          data-capture-field
                          className={`ms-form-field ${isFullWidth ? 'ms-form-col-span-2' : ''} ${
                            isConditional ? 'is-conditional' : ''
                          }`}
                        >
                          <div className="ms-form-label-row">
                            {isGroup || isCalculated ? (
                              <span id={labelId} className="ms-form-label">
                                {labelContent}
                              </span>
                            ) : (
                              <label htmlFor={ctrlId} className="ms-form-label">
                                {labelContent}
                              </label>
                            )}
                            {canClear && (
                              <button
                                type="button"
                                className="ms-form-clear"
                                onClick={() =>
                                  handleInputChange(field.name, field.type === 'multiselect' ? [] : '')
                                }
                                aria-label={`Limpiar ${field.label}`}
                              >
                                Limpiar
                              </button>
                            )}
                          </div>

                          {/* Control */}
                          {isCalculated ? (
                            <div
                              className="ms-form-calculated"
                              role="group"
                              aria-labelledby={labelId}
                              aria-describedby={describedBy}
                            >
                              {isFilled(currentValue) ? (
                                <div className="ms-form-calculated-value">
                                  <span>{currentValue}</span>
                                  {field.unit && (
                                    <span className="ms-form-calculated-unit">{field.unit}</span>
                                  )}
                                </div>
                              ) : (
                                <div className="ms-form-calculated-value is-pending">
                                  <span>Se calcula al completar los datos necesarios</span>
                                </div>
                              )}
                            </div>
                          ) : field.type === 'number' ? (
                            <div className="ms-form-input-affix">
                              <input
                                {...a11y}
                                type="number"
                                inputMode="decimal"
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
                                // Evita cambiar el valor sin querer al hacer scroll sobre el campo
                                onWheel={(e) => e.currentTarget.blur()}
                                placeholder={numberPlaceholder(field)}
                                className={`ms-form-input font-mono ${hasError ? 'has-error' : ''}`}
                              />
                              {field.unit && <span className="ms-form-unit">{field.unit}</span>}
                            </div>
                          ) : field.type === 'boolean' ? (
                            <div className="ms-form-segmented" role="group" aria-labelledby={labelId}>
                              <button
                                type="button"
                                aria-pressed={currentValue === true}
                                onClick={() => handleInputChange(field.name, true)}
                                className={`ms-form-segmented-btn ${currentValue === true ? 'is-active' : ''}`}
                              >
                                <span>Sí / Positivo</span>
                              </button>
                              <button
                                type="button"
                                aria-pressed={currentValue === false}
                                onClick={() => handleInputChange(field.name, false)}
                                className={`ms-form-segmented-btn ${currentValue === false ? 'is-active' : ''}`}
                              >
                                <span>No / Negativo</span>
                              </button>
                            </div>
                          ) : field.type === 'radio' ? (
                            <div className="ms-form-chip-grid" role="group" aria-labelledby={labelId}>
                              {field.options?.map((opt) => {
                                const isSelected = currentValue === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    aria-pressed={isSelected}
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
                            <div className="ms-form-chip-grid" role="group" aria-labelledby={labelId}>
                              {field.options?.map((opt) => {
                                const selectedList = Array.isArray(currentValue) ? currentValue : [];
                                const isChecked = selectedList.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    aria-pressed={isChecked}
                                    onClick={() =>
                                      handleInputChange(
                                        field.name,
                                        isChecked
                                          ? selectedList.filter((item: string) => item !== opt)
                                          : [...selectedList, opt]
                                      )
                                    }
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
                              {...a11y}
                              value={currentValue}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              className={`ms-form-select ${hasError ? 'has-error' : ''}`}
                            >
                              <option value="">Seleccionar…</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'date' ? (
                            <input
                              {...a11y}
                              type="date"
                              value={currentValue}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              className={`ms-form-input font-mono ${hasError ? 'has-error' : ''}`}
                            />
                          ) : field.type === 'textarea' ? (
                            <textarea
                              {...a11y}
                              rows={3}
                              value={currentValue}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              placeholder={field.placeholder || 'Escribe observaciones…'}
                              className={`ms-form-textarea ${hasError ? 'has-error' : ''}`}
                            />
                          ) : (
                            <div className="ms-form-input-affix">
                              <input
                                {...a11y}
                                type="text"
                                value={currentValue}
                                onChange={(e) => handleInputChange(field.name, e.target.value)}
                                placeholder={field.placeholder || ''}
                                className={`ms-form-input ${hasError ? 'has-error' : ''}`}
                              />
                              {field.unit && <span className="ms-form-unit">{field.unit}</span>}
                            </div>
                          )}

                          {/* Ayuda y nombre técnico (opcional) */}
                          {(field.description || showTech) && (
                            <div className="ms-form-meta-row">
                              {field.description ? (
                                <p id={helpId} className="ms-form-help">
                                  {field.description}
                                </p>
                              ) : (
                                <span />
                              )}
                              {showTech && (
                                <span className="ms-form-colname" title={`Variable técnica: ${field.name}`}>
                                  col: {field.name}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Error de validación */}
                          {hasError && (
                            <p id={errorId} className="ms-form-error">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{errors[field.name]}</span>
                            </p>
                          )}

                          {/* Alerta de rango clínico */}
                          {alertMsg && (
                            <div id={alertId} className="ms-form-alert">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>{alertMsg}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </main>

        {/* Panel lateral */}
        <aside className="ms-form-aux" aria-label="Resumen y navegación">
          {/* Índice de secciones */}
          {groupedSections.length > 1 && (
            <div className="ms-form-card">
              <div className="ms-form-card-header">
                <span className="ms-form-card-title">
                  <ListOrdered className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Secciones</span>
                </span>
                <span className="ms-form-card-meta">{groupedSections.length}</span>
              </div>

              <nav className="ms-form-nav" aria-label="Navegación de secciones">
                {groupedSections.map(([secTitle, fields]) => {
                  const isActive = activeSection === secTitle;
                  const stats = sectionStats.get(secTitle);
                  const hasError = errorSections.has(secTitle);
                  const badge =
                    stats && stats.requiredTotal > 0
                      ? `${stats.requiredFilled}/${stats.requiredTotal}`
                      : String(fields.length);
                  const badgeTitle =
                    stats && stats.requiredTotal > 0
                      ? 'Obligatorios completados'
                      : 'Variables en la sección';

                  return (
                    <button
                      key={secTitle}
                      type="button"
                      onClick={() => scrollToSection(secTitle)}
                      className={`ms-form-nav-item ${isActive ? 'is-active' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {hasError ? (
                          <AlertTriangle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
                        ) : stats?.complete ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-neutral-muted)]'
                            }`}
                          />
                        )}
                        <span className="truncate">{secTitle}</span>
                      </div>
                      <span className="ms-form-nav-badge shrink-0" title={badgeTitle}>
                        {badge}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Cálculos en tiempo real */}
          {Object.keys(computedValues).length > 0 && (
            <div className="ms-form-card ms-form-card-calc">
              <div className="ms-form-card-header">
                <span className="ms-form-card-title">
                  <Calculator className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Cálculos automáticos</span>
                </span>
              </div>

              <div className="ms-form-calc-list">
                {Object.entries(computedValues).map(([key, val]) => {
                  const fieldDef = form.fields.find((f) => f.name === key);
                  return (
                    <div key={key} className="ms-form-calc-item">
                      <div className="ms-form-calc-label">{fieldDef?.label || key}</div>
                      <div className="ms-form-calc-value">
                        {val}
                        {fieldDef?.unit && (
                          <span className="ms-form-calculated-unit">{fieldDef.unit}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Registros */}
          <div className="ms-form-card">
            <div className="ms-form-card-header">
              <span className="ms-form-card-title">
                <Database className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Registros</span>
              </span>
            </div>

            <div>
              <div className="ms-form-metric-row">
                <span className="ms-form-metric-label">Casos guardados</span>
                <span className="ms-form-metric-value">{records.length}</span>
              </div>
              <div className="ms-form-metric-row">
                <span className="ms-form-metric-label">Próximo código</span>
                <span className="ms-form-metric-value">{nextSuggestedCode}</span>
              </div>
            </div>

            <h3 className="ms-form-subtitle flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Últimos guardados</span>
            </h3>

            {recentRecords.length === 0 ? (
              <p className="ms-form-empty">Aún no hay casos guardados. El primero aparecerá aquí.</p>
            ) : (
              <div className="ms-form-recent-list">
                {recentRecords.map((r) => (
                  <div key={r.id} className="ms-form-recent-item">
                    <div className="ms-form-recent-top">
                      <span className="ms-form-recent-code">{r.recordCode}</span>
                      <span className="ms-form-recent-time">
                        {r.timestamp
                          ? new Date(r.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                    <div className="ms-form-recent-summary">
                      {Object.entries(r.data)
                        .filter(([, v]) => isFilled(v))
                        .slice(0, 2)
                        .map(([k, v]) => `${fieldLabels.get(k) || k}: ${formatValue(v)}`)
                        .join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onGoToRecords}
              className="w-full ms-btn ms-btn-secondary ms-btn-sm"
              style={{ marginTop: '1rem' }}
            >
              <span>Abrir tabla completa</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>

      {/* Barra de acciones */}
      <footer className="ms-form-actionbar" role="region" aria-label="Acciones del registro clínico">
        <div className="ms-form-actionbar-inner">
          {/* Estado: errores pendientes o progreso de obligatorios */}
          {errorCount > 0 ? (
            <div className="ms-form-bar-status is-error" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {errorCount === 1
                  ? 'Falta 1 campo obligatorio'
                  : `Faltan ${errorCount} campos obligatorios`}
              </span>
              <button
                type="button"
                className="ms-btn ms-btn-ghost ms-btn-sm"
                onClick={() => {
                  const k = firstErrorKey(errors);
                  if (k) focusField(k);
                }}
              >
                Ir al primero
              </button>
            </div>
          ) : mandatoryStats.total > 0 ? (
            <div className="ms-form-progress">
              <div
                className="ms-form-progress-bar"
                role="progressbar"
                aria-label="Campos obligatorios completados"
                aria-valuemin={0}
                aria-valuemax={mandatoryStats.total}
                aria-valuenow={mandatoryStats.filled}
              >
                <div
                  className={`ms-form-progress-fill ${mandatoryStats.percentage === 100 ? 'is-complete' : ''}`}
                  style={{ width: `${mandatoryStats.percentage}%` }}
                />
              </div>
              <span className="ms-form-progress-text">
                <strong className="text-[var(--color-ink)]">{mandatoryStats.filled}</strong> de{' '}
                {mandatoryStats.total} obligatorios
              </span>
            </div>
          ) : (
            <span />
          )}

          <div className="ms-form-actionbar-actions">
            <button
              type="button"
              onClick={handleReset}
              className="ms-btn ms-btn-ghost ms-btn-danger"
              title="Restablecer los valores de este caso"
              aria-label="Restablecer campos"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="ms-form-btn-wide">Restablecer</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="ms-btn ms-btn-secondary"
              title="Guarda el caso y conserva los datos para registrar uno parecido"
            >
              <span>Guardar y mantener datos</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="ms-btn ms-btn-primary"
              title={`Guardar y empezar un caso nuevo (${shortcutLabel.replace(' ↵', ' + Enter')})`}
            >
              <Save className="w-4 h-4" />
              <span>Guardar y siguiente</span>
              <kbd className="ms-form-kbd-tip">{shortcutLabel}</kbd>
            </button>
          </div>
        </div>
      </footer>

      {/* Modal de extracción de texto libre */}
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
