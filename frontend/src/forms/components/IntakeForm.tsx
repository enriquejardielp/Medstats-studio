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

  // Last 3 recently entered records for quick review
  const recentRecords = useMemo(() => {
    return records.slice(-3).reverse();
  }, [records]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      {/* Top Banner & Quick Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{form.title}</h1>
            <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-mono">
              {form.fields.length} variables
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">{form.description}</p>
        </div>

        {/* Global actions & keyboard tip */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenTextExtractor(null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-teal-800 border border-teal-300 hover:bg-teal-50 rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Pegar analítica completa, informe de ecocardiograma o antecedentes para autocompletar el caso"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Rellenar desde Texto Libre</span>
          </button>

          <div className="hidden lg:flex items-center text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono mr-1 shadow-2xs">
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono mx-1 shadow-2xs">
              Enter
            </kbd>
            <span>guardar y siguiente</span>
          </div>

          <button
            onClick={() => handleSubmit(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-medium text-sm shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar y Siguiente</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {savedSuccessMsg && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{savedSuccessMsg}</span>
          </div>
          <button
            onClick={onGoToRecords}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
          >
            Ver en tabla ({records.length} total)
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Form Content Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Intake Form Column (3/4) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Metadata Card: Patient / Case Code */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-teal-600" />
                Identificador de Sujeto / Paciente
              </span>
              <span className="text-xs text-slate-500">Clave primaria de la fila en la BD</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Código de Registro <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={recordCode}
                    onChange={(e) => setRecordCode(e.target.value)}
                    placeholder="Ej. PAC-001 o ID-SUJETO"
                    className="w-full text-sm font-mono font-semibold text-slate-900 bg-teal-50/50 border border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                {errors._code && <p className="text-xs text-rose-600 mt-1">{errors._code}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Profesional / Investigador</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Nombre o firma del clínico"
                    className="w-full text-sm text-slate-800 bg-white border border-slate-300 rounded-md py-1.5 pl-8 pr-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section Navigation Quick Jump Bar */}
          {groupedSections.length > 1 && (
            <div className="bg-slate-100/80 border border-slate-200 rounded-md p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Secciones:
              </span>
              {groupedSections.map(([secTitle]) => (
                <button
                  key={secTitle}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`section-card-${secTitle.replace(/\s+/g, '-')}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:text-teal-800 hover:bg-teal-50 border border-slate-200 rounded whitespace-nowrap shadow-2xs transition-colors"
                >
                  {secTitle}
                </button>
              ))}
            </div>
          )}

          {/* Grouped Clinical Sections */}
          {groupedSections.map(([sectionTitle, fields], sIdx) => (
            <div
              key={sectionTitle}
              id={`section-card-${sectionTitle.replace(/\s+/g, '-')}`}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs scroll-mt-20"
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    {sectionTitle}
                  </h2>
                  {form.sectionRules?.[sectionTitle] && (
                    <span className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                      <GitBranch className="w-2.5 h-2.5 text-indigo-600" />
                      Sección desplegada por condición
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTextExtractor(sectionTitle)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors shadow-2xs cursor-pointer"
                    title={`Pegar informe o analítica para autocompletar la sección ${sectionTitle}`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-teal-700" />
                    <span>Pegar texto en esta sección</span>
                  </button>
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    {fields.length} {fields.length === 1 ? 'variable' : 'variables'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {fields.map((field, fIdx) => {
                  const currentValue = activeFullData[field.name] ?? '';
                  const alertMsg = checkClinicalAlert(field, currentValue);
                  const isCalculated = field.type === 'calculated';
                  const isConditional = !!field.conditional;
                  const hasError = !!errors[field.name];

                  return (
                    <div
                      key={field.id}
                      id={`field-${field.name}`}
                      className={`space-y-1.5 ${
                        field.type === 'textarea' || field.type === 'multiselect' ? 'sm:col-span-2' : ''
                      } ${isCalculated ? 'bg-teal-50/40 p-3 rounded-md border border-teal-200' : ''} ${
                        isConditional ? 'border-l-2 border-l-indigo-500 pl-2 py-0.5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-800 flex items-center gap-1 flex-wrap">
                          {field.label}
                          {field.required && !isCalculated && <span className="text-rose-500">*</span>}
                          {isCalculated && (
                            <span className="text-[10px] text-teal-700 bg-teal-100/70 font-mono px-1 rounded flex items-center gap-0.5">
                              <Calculator className="w-2.5 h-2.5" /> Automático
                            </span>
                          )}
                          {isConditional && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 font-mono px-1 rounded flex items-center gap-0.5" title="Campo dependiente de otra variable">
                              <GitBranch className="w-2.5 h-2.5 text-indigo-600" /> Condicional
                            </span>
                          )}
                        </label>
                        <span className="text-[11px] font-mono text-slate-600" title="Columna BD">{field.name}</span>
                      </div>

                      {/* Field Inputs according to type */}
                      {isCalculated ? (
                        <div className="flex items-center justify-between bg-white border border-teal-300 rounded-md py-1.5 px-3">
                          <span className="text-sm font-bold font-mono text-teal-900">
                            {currentValue !== '' && currentValue !== null && currentValue !== undefined
                              ? currentValue
                              : 'Pendiente de datos'}
                          </span>
                          {field.unit && <span className="text-xs font-medium text-teal-700">{field.unit}</span>}
                        </div>
                      ) : field.type === 'number' ? (
                        <div className="relative">
                          <input
                            ref={sIdx === 0 && fIdx === 0 ? firstInputRef : undefined}
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
                            placeholder={field.placeholder || (field.min !== undefined ? `Mín: ${field.min}` : '0')}
                            className={`w-full text-sm text-slate-900 bg-white border rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden ${
                              hasError ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'
                            }`}
                          />
                          {field.unit && (
                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-medium text-slate-500 pointer-events-none">
                              {field.unit}
                            </span>
                          )}
                        </div>
                      ) : field.type === 'select' ? (
                        <select
                          value={currentValue}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          className={`w-full text-sm text-slate-900 bg-white border rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden ${
                            hasError ? 'border-rose-400' : 'border-slate-300'
                          }`}
                        >
                          <option value="">-- Seleccionar --</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'radio' ? (
                        <div className="space-y-1.5 pt-1">
                          {field.options?.map((opt) => (
                            <label
                              key={opt}
                              className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                            >
                              <input
                                type="radio"
                                name={`radio-${field.name}`}
                                checked={currentValue === opt}
                                onChange={() => handleInputChange(field.name, opt)}
                                className="w-3.5 h-3.5 text-teal-600 border-slate-300 focus:ring-teal-500"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : field.type === 'boolean' ? (
                        <div className="flex items-center gap-4 py-1">
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`bool-${field.name}`}
                              checked={currentValue === true}
                              onChange={() => handleInputChange(field.name, true)}
                              className="w-3.5 h-3.5 text-teal-600 border-slate-300"
                            />
                            <span>Sí / Positivo</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`bool-${field.name}`}
                              checked={currentValue === false}
                              onChange={() => handleInputChange(field.name, false)}
                              className="w-3.5 h-3.5 text-teal-600 border-slate-300"
                            />
                            <span>No / Negativo</span>
                          </label>
                        </div>
                      ) : field.type === 'multiselect' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                          {field.options?.map((opt) => {
                            const selectedList = Array.isArray(currentValue) ? currentValue : [];
                            const isChecked = selectedList.includes(opt);
                            return (
                              <label
                                key={opt}
                                className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      handleInputChange(field.name, [...selectedList, opt]);
                                    } else {
                                      handleInputChange(
                                        field.name,
                                        selectedList.filter((item) => item !== opt)
                                      );
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : field.type === 'date' ? (
                        <input
                          type="date"
                          value={currentValue}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={currentValue}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder || 'Observaciones clínicas...'}
                          className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-y"
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder || ''}
                          className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                        />
                      )}

                      {/* Description or formula explanation */}
                      {field.description && (
                        <p className="text-[11px] text-slate-500 leading-tight">{field.description}</p>
                      )}

                      {/* Error text */}
                      {hasError && <p className="text-xs text-rose-600 font-medium">{errors[field.name]}</p>}

                      {/* Clinical Range Warning Alert */}
                      {alertMsg && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{alertMsg}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1.5 py-1.5 px-2.5 rounded hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer campos</span>
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors"
              >
                Guardar y Mantener
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="w-full sm:w-auto px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Siguiente Caso</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Clinical Status & Recent Records (1/4) */}
        <div className="space-y-5">
          {/* Summary / Stats Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              Estado de la Base de Datos
            </h3>

            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Casos registrados:</span>
                <span className="font-semibold text-slate-900 font-mono text-sm">{records.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Variables en formulario:</span>
                <span className="font-semibold text-slate-900 font-mono text-sm">{form.fields.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Prefijo automático:</span>
                <span className="font-mono text-teal-700 font-medium">{form.codePrefix || 'REG-'}</span>
              </div>
            </div>

            <button
              onClick={onGoToRecords}
              className="mt-4 w-full py-1.5 px-3 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center gap-1 transition-colors"
            >
              <span>Abrir tabla completa</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Quick Real-Time Formulas Active Panel */}
          {Object.keys(computedValues).length > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-teal-900 uppercase tracking-wider pb-2 border-b border-teal-200/60 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-teal-700" />
                Cálculos en Tiempo Real
              </h3>

              <div className="mt-3 space-y-2">
                {Object.entries(computedValues).map(([key, val]) => {
                  const fieldDef = form.fields.find((f) => f.name === key);
                  return (
                    <div key={key} className="bg-white p-2.5 rounded border border-teal-200/80">
                      <div className="text-[11px] font-medium text-slate-600">{fieldDef?.label || key}</div>
                      <div className="text-base font-bold font-mono text-teal-800 flex items-baseline gap-1 mt-0.5">
                        {val}
                        {fieldDef?.unit && <span className="text-xs font-normal text-teal-600">{fieldDef.unit}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Records Strip */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Últimos Registros
            </h3>

            {recentRecords.length === 0 ? (
              <p className="text-xs text-slate-600 italic py-3 text-center">Aún no hay casos guardados.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {recentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="p-2 rounded bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-slate-900">{r.recordCode}</span>
                      <span className="text-[10px] text-slate-600">
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
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
        </div>
      </div>

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
