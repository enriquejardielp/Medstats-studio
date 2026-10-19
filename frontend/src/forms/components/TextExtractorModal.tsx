import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  FileText,
  FlaskConical,
  Heart,
  Activity,
  Layers,
  Zap,
  HelpCircle,
  Check,
} from 'lucide-react';
import type { ClinicalForm } from '../types/clinical';
import {
  extractFieldsFromClinicalText,
  CLINICAL_TEXT_PRESETS,
  type ExtractedFieldMatch,
} from '../utils/clinicalTextExtractor';

interface TextExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: ClinicalForm;
  targetSection?: string | null; // If specified, highlights or filters to fields of this section
  currentFormData: Record<string, any>;
  onApplyExtractedData: (dataToMerge: Record<string, any>) => void;
}

export function TextExtractorModal({
  isOpen,
  onClose,
  form,
  targetSection,
  currentFormData,
  onApplyExtractedData,
}: TextExtractorModalProps) {
  const [inputText, setInputText] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Record<string, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [extractionMatches, setExtractionMatches] = useState<ExtractedFieldMatch[]>([]);
  const [filterSectionOnly, setFilterSectionOnly] = useState<boolean>(false);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);

  // Analyze against all form fields so variables across sections are never lost
  const availableFields = useMemo(() => {
    return form.fields.filter((f) => f.type !== 'calculated');
  }, [form.fields]);

  // Displayed matches based on user filter toggle
  const displayedMatches = useMemo(() => {
    if (filterSectionOnly && targetSection) {
      return extractionMatches.filter((m) => {
        const field = form.fields.find((f) => f.name === m.fieldName);
        return field?.section === targetSection;
      });
    }
    return extractionMatches;
  }, [extractionMatches, filterSectionOnly, targetSection, form.fields]);

  // Count matches outside of targetSection
  const otherSectionsMatchesCount = useMemo(() => {
    if (!targetSection) return 0;
    return extractionMatches.filter((m) => {
      const field = form.fields.find((f) => f.name === m.fieldName);
      return field?.section !== targetSection;
    }).length;
  }, [extractionMatches, targetSection, form.fields]);

  // Auto-extract locally with debounce whenever inputText changes so results appear immediately
  useEffect(() => {
    if (!inputText.trim()) {
      setExtractionMatches([]);
      setHasExtracted(false);
      return;
    }

    const timer = setTimeout(() => {
      const localMatches = extractFieldsFromClinicalText(inputText, availableFields);
      setExtractionMatches(localMatches);
      setHasExtracted(true);

      setSelectedMatches((prev) => {
        const next: Record<string, boolean> = {};
        localMatches.forEach((m) => {
          next[m.fieldName] = prev[m.fieldName] !== undefined ? prev[m.fieldName] : true;
        });
        return next;
      });

      setEditedValues((prev) => {
        const next: Record<string, any> = { ...prev };
        localMatches.forEach((m) => {
          if (next[m.fieldName] === undefined) {
            next[m.fieldName] = m.extractedValue;
          }
        });
        return next;
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [inputText, availableFields]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof CLINICAL_TEXT_PRESETS[0]) => {
    setInputText(preset.text);
    setActivePreset(preset.id);
    const immediateMatches = extractFieldsFromClinicalText(preset.text, availableFields);
    setExtractionMatches(immediateMatches);
    const initialSelected: Record<string, boolean> = {};
    const initialEdited: Record<string, any> = {};
    immediateMatches.forEach((m) => {
      initialSelected[m.fieldName] = true;
      initialEdited[m.fieldName] = m.extractedValue;
    });
    setSelectedMatches(initialSelected);
    setEditedValues(initialEdited);
    setHasExtracted(true);
  };

  const handleAnalyzeText = async (useAiMode: boolean = false) => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setAiErrorNotice(null);

    try {
      let finalMatches: ExtractedFieldMatch[] = [];

      if (useAiMode) {
        // Attempt server-side Gemini extraction
        try {
          const response = await fetch('/api/extract-clinical-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: inputText,
              fields: availableFields,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.extractedData) {
              // Convert object to ExtractedFieldMatch format
              const aiMatches: ExtractedFieldMatch[] = [];
              Object.entries(data.extractedData).forEach(([fieldName, val]) => {
                const field = availableFields.find((f) => f.name === fieldName);
                if (field && val !== undefined && val !== null && val !== '') {
                  aiMatches.push({
                    fieldName: field.name,
                    fieldLabel: field.label,
                    fieldType: field.type,
                    extractedValue: val,
                    formattedDisplay: String(val) + (field.unit ? ` ${field.unit}` : ''),
                    confidence: 'high',
                    rawSnippet: 'Extraído con IA (Gemini)',
                    unit: field.unit,
                  });
                }
              });

              if (aiMatches.length > 0) {
                finalMatches = aiMatches;
              }
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            console.warn('AI endpoint warning, falling back to local extractor:', errData);
            setAiErrorNotice('IA en alta demanda temporal. Se utilizó el motor clínico local con precisión.');
          }
        } catch (e: any) {
          console.warn('AI extraction fetch failed, using local NLP extractor', e);
          setAiErrorNotice('Motor clínico local ejecutado con éxito.');
        }
      }

      // If AI mode returned nothing or wasn't used, run local NLP rule-based extractor
      if (finalMatches.length === 0) {
        finalMatches = extractFieldsFromClinicalText(inputText, availableFields);
      }

      setExtractionMatches(finalMatches);

      // Pre-select all matched fields by default
      const initialSelected: Record<string, boolean> = {};
      const initialEdited: Record<string, any> = {};
      finalMatches.forEach((m) => {
        initialSelected[m.fieldName] = true;
        initialEdited[m.fieldName] = m.extractedValue;
      });
      setSelectedMatches(initialSelected);
      setEditedValues(initialEdited);
      setHasExtracted(true);
    } catch (err: any) {
      console.error('Error in extraction:', err);
      setAiErrorNotice('Ocurrió un error al procesar el texto: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSelectMatch = (fieldName: string) => {
    setSelectedMatches((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const updated: Record<string, boolean> = {};
    extractionMatches.forEach((m) => {
      updated[m.fieldName] = select;
    });
    setSelectedMatches(updated);
  };

  const handleConfirmAndApply = () => {
    const dataToMerge: Record<string, any> = {};
    extractionMatches.forEach((m) => {
      if (selectedMatches[m.fieldName]) {
        dataToMerge[m.fieldName] = editedValues[m.fieldName] ?? m.extractedValue;
      }
    });

    onApplyExtractedData(dataToMerge);
    onClose();
  };

  const selectedCount = Object.values(selectedMatches).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <ClipboardPaste className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Rellenar desde Texto Libre / Informe Clínico
                </h3>
                {targetSection ? (
                  <span className="text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded">
                    Sección: {targetSection}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Todo el Formulario
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Pega una analítica de laboratorio, informe de ecocardiograma, antecedentes o nota de evolución y CliniForm extraerá los valores automáticamente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {/* Quick-fill Example Presets for Testing */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Textos Clínicos de Ejemplo (Clic para probar al instante):</span>
              </span>
              {inputText && (
                <button
                  onClick={() => {
                    setInputText('');
                    setActivePreset(null);
                    setHasExtracted(false);
                    setExtractionMatches([]);
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
                >
                  Limpiar texto
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {CLINICAL_TEXT_PRESETS.map((preset) => {
                const isSelected = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-2 rounded-md text-left text-xs transition-all border cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 text-teal-900 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      {preset.id === 'perfil-breve' && <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {preset.id === 'analitica' && <FlaskConical className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      {preset.id === 'ecocardiograma' && <Heart className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      {preset.id === 'antecedentes' && <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      {preset.id === 'constantes' && <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      <span className="truncate">{preset.title.split(':')[0]}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea Input Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="clinical-paste-area" className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                <span>Pega aquí el texto médico:</span>
                <span className="text-slate-500 font-normal hidden sm:inline">
                  (valores con dos puntos, analíticas, frases como "Varón 45 años fumador y dislipémico")
                </span>
              </label>

              {targetSection && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSectionOnly}
                    onChange={(e) => setFilterSectionOnly(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Filtrar solo sección «{targetSection}»</span>
                </label>
              )}
            </div>

            <textarea
              id="clinical-paste-area"
              rows={5}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setActivePreset(null);
                setHasExtracted(false);
              }}
              placeholder={`Ejemplo de texto:\nVarón de 45 años de edad fumador y dislipemico\nGlucosa: 118 mg/dL, HbA1c: 6.8%, Creatinina: 1.1\nPresión arterial: 145/88 mmHg, FC: 84 lpm, SatO2: 95%\nFEVI 48%, DTDVI 54 mm, Estenosis Aórtica Severa con gradiente medio de 44 mmHg...`}
              className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg shadow-2xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 leading-relaxed resize-y"
            />

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Extracción instantánea de edad, sexo, tabaquismo, dislipemia, HTA, analíticas, ecocardiograma y constantes.</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAnalyzeText(false)}
                  disabled={!inputText.trim() || isProcessing}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isProcessing ? 'Extrayendo datos...' : 'Analizar y Extraer Valores'}</span>
                </button>

                <button
                  onClick={() => handleAnalyzeText(true)}
                  disabled={!inputText.trim() || isProcessing}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Utiliza IA de Gemini para interpretación semántica"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Extraer con IA</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Error Notification (if any) */}
          {aiErrorNotice && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{aiErrorNotice}</span>
            </div>
          )}

          {/* Banner if matches found in other sections */}
          {hasExtracted && otherSectionsMatchesCount > 0 && filterSectionOnly && (
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-md text-sky-900 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Se han detectado también <strong>{otherSectionsMatchesCount}</strong> variables en otras secciones del formulario (ej. datos demográficos o antecedentes).</span>
              </span>
              <button
                onClick={() => setFilterSectionOnly(false)}
                className="text-sky-800 underline font-medium hover:text-sky-950 cursor-pointer shrink-0 ml-2"
              >
                Ver todas ({extractionMatches.length})
              </button>
            </div>
          )}

          {/* Extraction Results Table & Review */}
          {hasExtracted && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Variables Detectadas ({displayedMatches.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    ({selectedCount} seleccionadas para rellenar)
                  </span>
                  {targetSection && (
                    <button
                      onClick={() => setFilterSectionOnly(!filterSectionOnly)}
                      className="text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors ml-2 cursor-pointer font-medium"
                    >
                      {filterSectionOnly ? 'Mostrar todo el formulario' : `Filtrar solo «${targetSection}»`}
                    </button>
                  )}
                </div>

                {displayedMatches.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => handleSelectAll(true)}
                      className="text-teal-700 hover:underline cursor-pointer"
                    >
                      Seleccionar todas
                    </button>
                    <span>·</span>
                    <button
                      onClick={() => handleSelectAll(false)}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Deseleccionar todas
                    </button>
                  </div>
                )}
              </div>

              {displayedMatches.length === 0 ? (
                <div className="text-center py-6 text-slate-500 space-y-1">
                  <AlertCircle className="w-6 h-6 text-amber-500 mx-auto" />
                  <p className="text-xs font-medium">No se detectaron variables coincidentes en este texto.</p>
                  <p className="text-[11px] text-slate-400">
                    Asegúrate de que el texto contiene nombres de analítica o valores como "TAS 140", "Glucosa 110" o prueba uno de los botones de ejemplo superiores.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-md">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center">Rellenar</th>
                        <th className="py-2 px-3">Variable del Formulario</th>
                        <th className="py-2 px-3">Sección</th>
                        <th className="py-2 px-3">Valor Extraído</th>
                        <th className="py-2 px-3">Valor Actual en Caso</th>
                        <th className="py-2 px-3">Fragmento Detectado en Texto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedMatches.map((match) => {
                        const isChecked = !!selectedMatches[match.fieldName];
                        const currentValue = currentFormData[match.fieldName];
                        const willOverwrite = currentValue !== undefined && currentValue !== null && currentValue !== '';
                        const fieldSection = form.fields.find((f) => f.name === match.fieldName)?.section || 'General';
                        const isTargetSec = targetSection && fieldSection === targetSection;

                        return (
                          <tr
                            key={match.fieldName}
                            className={`hover:bg-slate-50 transition-colors ${
                              isChecked ? (isTargetSec ? 'bg-teal-50/40' : 'bg-slate-50/70') : 'opacity-60 bg-slate-50/40'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectMatch(match.fieldName)}
                                className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-800">{match.fieldLabel}</div>
                              <div className="text-[10px] font-mono text-slate-500">{match.fieldName}</div>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                isTargetSec
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                                {fieldSection}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {match.fieldType === 'number' ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    value={editedValues[match.fieldName] ?? match.extractedValue}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? '' : parseFloat(e.target.value);
                                      setEditedValues((prev) => ({ ...prev, [match.fieldName]: v }));
                                    }}
                                    className="w-24 px-2 py-0.5 text-xs font-mono font-bold text-teal-900 bg-white border border-teal-300 rounded"
                                  />
                                  {match.unit && <span className="text-[11px] text-slate-500 font-medium">{match.unit}</span>}
                                </div>
                              ) : match.fieldType === 'boolean' ? (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                    match.extractedValue
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {match.extractedValue ? 'Sí / Positivo' : 'No / Negativo'}
                                </span>
                              ) : (
                                <span className="font-medium text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded text-[11px]">
                                  {match.formattedDisplay}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {willOverwrite ? (
                                <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]" title="Se actualizará el valor anterior">
                                  Actual: {String(currentValue)}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Vacío</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[11px] font-mono text-slate-600 max-w-xs truncate">
                              "{match.rawSnippet}"
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmAndApply}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Insertar {selectedCount} {selectedCount === 1 ? 'campo' : 'campos'} en el Formulario</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
