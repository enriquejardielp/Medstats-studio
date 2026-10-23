import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Save,
  Layers,
  X,
  FileCode,
  FolderPlus,
  Star,
  BookmarkPlus,
  CheckCircle2,
  GitBranch,
  Type,
  Hash,
  List,
  CheckSquare,
  ToggleLeft,
  Calendar,
  AlignLeft,
  Calculator,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import type {
  ClinicalForm,
  FormField,
  FieldType,
  FavoriteSection,
  ConditionalRule,
  ConditionOperator,
} from '../types/clinical';
import { normalizeColumnKey } from '../utils/merger';
import { FavoriteSectionsModal } from './FavoriteSectionsModal';
import { getConditionDescription } from '../utils/conditional';

interface FormBuilderProps {
  form: ClinicalForm;
  onSaveForm: (updatedForm: ClinicalForm) => void;
  onCreateNewForm: (title: string, prefix: string) => void;
  favoriteSections: FavoriteSection[];
  onSaveNewFavoriteSection: (newSec: FavoriteSection) => void;
  onDeleteFavoriteSection: (id: string) => void;
}

export function FormBuilder({
  form,
  onSaveForm,
  onCreateNewForm,
  favoriteSections,
  onSaveNewFavoriteSection,
  onDeleteFavoriteSection,
}: FormBuilderProps) {
  const [currentForm, setCurrentForm] = useState<ClinicalForm>(form);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [isNewField, setIsNewField] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [showNewFormModal, setShowNewFormModal] = useState<boolean>(false);
  const [newFormTitle, setNewFormTitle] = useState<string>('');
  const [newFormPrefix, setNewFormPrefix] = useState<string>('PAC-');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Reusable sections modal
  const [isFavModalOpen, setIsFavModalOpen] = useState(false);

  // Section renaming state
  const [renamingSection, setRenamingSection] = useState<{ original: string; current: string } | null>(null);

  // Save section as favorite modal
  const [savingFavSectionModal, setSavingFavSectionModal] = useState<{
    sectionName: string;
    title: string;
    description: string;
    category: FavoriteSection['category'];
  } | null>(null);

  // Section-level condition editing modal
  const [editingSectionCondition, setEditingSectionCondition] = useState<string | null>(null);
  const [sectionRuleDraft, setSectionRuleDraft] = useState<ConditionalRule>({
    parentField: '',
    operator: 'equals',
    value: '',
  });

  // Keep currentForm in sync if parent changes form
  React.useEffect(() => {
    setCurrentForm(form);
  }, [form]);

  const handleUpdateMeta = (key: keyof ClinicalForm, val: any) => {
    setCurrentForm((prev) => ({
      ...prev,
      [key]: val,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSaveAll = () => {
    onSaveForm(currentForm);
    setFeedbackMsg('Estructura del formulario guardada con éxito.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Field Reordering
  const moveField = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentForm.fields.length) return;

    const newFields = [...currentForm.fields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIdx];
    newFields[targetIdx] = temp;

    const updated = {
      ...currentForm,
      fields: newFields,
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
  };

  const removeField = (fieldId: string) => {
    if (window.confirm('¿Seguro que deseas eliminar esta variable del formulario?')) {
      const updated = {
        ...currentForm,
        fields: currentForm.fields.filter((f) => f.id !== fieldId),
        updatedAt: new Date().toISOString(),
      };
      if (editingField?.id === fieldId) {
        setEditingField(null);
      }
      setCurrentForm(updated);
      onSaveForm(updated);
    }
  };

  const startAddField = (presetSection?: string) => {
    const targetSec = presetSection || currentForm.sections[0] || 'General';
    const newField: FormField = {
      id: 'f_' + Date.now(),
      name: 'nueva_variable',
      label: 'Nueva Variable Clínica',
      type: 'text',
      section: targetSec,
      required: false,
    };
    setIsNewField(true);
    setEditingField(newField);
    // Smooth scroll to editor on smaller screens
    setTimeout(() => {
      const el = document.getElementById('field-editor-panel');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const startEditField = (field: FormField) => {
    setIsNewField(false);
    setEditingField({ ...field, options: field.options ? [...field.options] : [] });
    // Smooth scroll to editor on smaller screens
    setTimeout(() => {
      const el = document.getElementById('field-editor-panel');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const saveEditingField = () => {
    if (!editingField) return;

    const cleanName = normalizeColumnKey(editingField.name || editingField.label);

    const finalizedField: FormField = {
      ...editingField,
      name: cleanName || 'variable_' + Date.now(),
      label: editingField.label.trim() || 'Variable',
    };

    let newFields: FormField[];
    if (isNewField) {
      newFields = [...currentForm.fields, finalizedField];
    } else {
      newFields = currentForm.fields.map((f) => (f.id === finalizedField.id ? finalizedField : f));
    }

    const updated = {
      ...currentForm,
      fields: newFields,
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
    setEditingField(null);
  };

  // Section Management
  const addSection = () => {
    if (!newSectionName.trim()) return;
    const cleanSec = newSectionName.trim();
    if (currentForm.sections.includes(cleanSec)) {
      alert('Ya existe una sección con este nombre.');
      return;
    }

    const updated = {
      ...currentForm,
      sections: [...currentForm.sections, cleanSec],
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
    setNewSectionName('');
  };

  const moveSection = (secIndex: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? secIndex - 1 : secIndex + 1;
    if (targetIdx < 0 || targetIdx >= currentForm.sections.length) return;

    const newSections = [...currentForm.sections];
    const temp = newSections[secIndex];
    newSections[secIndex] = newSections[targetIdx];
    newSections[targetIdx] = temp;

    const updated = {
      ...currentForm,
      sections: newSections,
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
  };

  const executeRenameSection = () => {
    if (!renamingSection) return;
    const newName = renamingSection.current.trim();
    if (!newName) return;
    const oldName = renamingSection.original;

    if (newName === oldName) {
      setRenamingSection(null);
      return;
    }

    const updated = {
      ...currentForm,
      sections: currentForm.sections.map((s) => (s === oldName ? newName : s)),
      fields: currentForm.fields.map((f) => (f.section === oldName ? { ...f, section: newName } : f)),
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
    setRenamingSection(null);
  };

  const removeSection = (secName: string) => {
    if (currentForm.sections.length <= 1) {
      alert('El formulario debe tener al menos una sección clínica.');
      return;
    }
    if (
      window.confirm(
        `¿Eliminar la sección "${secName}"? Las variables de esta sección se moverán a la primera sección del formulario.`
      )
    ) {
      const fallbackSec = currentForm.sections.find((s) => s !== secName) || 'General';
      const updated = {
        ...currentForm,
        sections: currentForm.sections.filter((s) => s !== secName),
        fields: currentForm.fields.map((f) => (f.section === secName ? { ...f, section: fallbackSec } : f)),
        updatedAt: new Date().toISOString(),
      };
      setCurrentForm(updated);
      onSaveForm(updated);
    }
  };

  // Section condition handlers
  const handleOpenSectionCondition = (secName: string) => {
    const existingRule = currentForm.sectionRules?.[secName] || {
      parentField: currentForm.fields.find((f) => f.section !== secName)?.name || currentForm.fields[0]?.name || '',
      operator: 'equals',
      value: '',
    };
    setSectionRuleDraft(existingRule);
    setEditingSectionCondition(secName);
  };

  const handleSaveSectionCondition = () => {
    if (!editingSectionCondition) return;
    const rules = { ...(currentForm.sectionRules || {}) };
    if (!sectionRuleDraft.parentField) {
      delete rules[editingSectionCondition];
    } else {
      rules[editingSectionCondition] = sectionRuleDraft;
    }
    const updated = {
      ...currentForm,
      sectionRules: rules,
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
    setEditingSectionCondition(null);
  };

  const handleClearSectionCondition = (secName: string) => {
    const rules = { ...(currentForm.sectionRules || {}) };
    delete rules[secName];
    const updated = {
      ...currentForm,
      sectionRules: rules,
      updatedAt: new Date().toISOString(),
    };
    setCurrentForm(updated);
    onSaveForm(updated);
  };

  // Save current section as reusable favorite
  const handleOpenSaveAsFavorite = (secName: string) => {
    setSavingFavSectionModal({
      sectionName: secName,
      title: secName,
      description: `Módulo clínico de ${secName} reutilizable en cualquier formulario`,
      category: 'cardiovascular',
    });
  };

  const handleConfirmSaveSectionAsFavorite = () => {
    if (!savingFavSectionModal) return;

    const fieldsInSection = currentForm.fields.filter(
      (f) => (f.section || currentForm.sections[0]) === savingFavSectionModal.sectionName
    );

    if (fieldsInSection.length === 0) {
      alert('Esta sección no tiene variables para guardar.');
      return;
    }

    const newFav: FavoriteSection = {
      id: 'fav-user-' + Date.now(),
      title: savingFavSectionModal.title.trim(),
      description: savingFavSectionModal.description.trim(),
      category: savingFavSectionModal.category,
      isDefaultPreset: false,
      fields: fieldsInSection.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        unit: f.unit,
        required: f.required,
        placeholder: f.placeholder,
        description: f.description,
        options: f.options ? [...f.options] : undefined,
        min: f.min,
        max: f.max,
        step: f.step,
        defaultValue: f.defaultValue,
        formula: f.formula,
        formulaPreset: f.formulaPreset,
        range: f.range ? { ...f.range } : undefined,
      })),
    };

    onSaveNewFavoriteSection(newFav);
    setSavingFavSectionModal(null);
    setFeedbackMsg(`Sección "${newFav.title}" guardada en Favoritos (${newFav.fields.length} variables).`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Insert favorite section into current form
  const handleInsertFavoriteSection = (fav: FavoriteSection) => {
    let finalSectionName = fav.title;
    if (currentForm.sections.includes(finalSectionName)) {
      finalSectionName = `${fav.title} (2)`;
    }

    const existingFieldNames = new Set(currentForm.fields.map((f) => f.name));
    const newFieldsToAppend: FormField[] = fav.fields.map((f, i) => {
      let uniqueName = f.name;
      if (existingFieldNames.has(uniqueName)) {
        uniqueName = `${uniqueName}_${Date.now() % 1000}`;
      }
      existingFieldNames.add(uniqueName);

      return {
        ...f,
        id: 'f_' + Date.now() + '_' + i,
        name: uniqueName,
        section: finalSectionName,
      };
    });

    const updated: ClinicalForm = {
      ...currentForm,
      sections: [...currentForm.sections, finalSectionName],
      fields: [...currentForm.fields, ...newFieldsToAppend],
      updatedAt: new Date().toISOString(),
    };

    setCurrentForm(updated);
    onSaveForm(updated);

    setFeedbackMsg(
      `¡Sección favorita "${fav.title}" insertada con ${fav.fields.length} variables clínicas!`
    );
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Fields grouped by section
  const sectionFieldMap = useMemo(() => {
    const map = new Map<string, FormField[]>();
    currentForm.sections.forEach((sec) => map.set(sec, []));

    currentForm.fields.forEach((f) => {
      const targetSec = f.section && map.has(f.section) ? f.section : currentForm.sections[0] || 'General';
      if (!map.has(targetSec)) {
        map.set(targetSec, []);
      }
      map.get(targetSec)!.push(f);
    });

    return map;
  }, [currentForm]);

  // Available real field types for the visual card grid selector
  const availableFieldTypes: Array<{
    type: FieldType;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    { type: 'text', label: 'Texto Corto', description: 'Cadenas breves o identificadores', icon: <Type size={16} /> },
    { type: 'number', label: 'Numérico', description: 'Valores continuos, dosis, escalas', icon: <Hash size={16} /> },
    { type: 'select', label: 'Desplegable', description: 'Selección única de lista larga', icon: <List size={16} /> },
    { type: 'radio', label: 'Opción Única', description: 'Opciones visibles excluyentes', icon: <CheckCircle2 size={16} /> },
    { type: 'multiselect', label: 'Multiselección', description: 'Múltiples opciones marcables', icon: <CheckSquare size={16} /> },
    { type: 'boolean', label: 'Sí / No', description: 'Booleano dicotómico o binario', icon: <ToggleLeft size={16} /> },
    { type: 'date', label: 'Fecha', description: 'Registro temporal o visita', icon: <Calendar size={16} /> },
    { type: 'textarea', label: 'Texto Largo', description: 'Comentarios u observaciones', icon: <AlignLeft size={16} /> },
    { type: 'calculated', label: 'Automático', description: 'Fórmula calculada en tiempo real', icon: <Calculator size={16} /> },
  ];

  return (
    <div className="ms-form-container space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
              Diseñador de Formulario Clínico
            </h1>
            <span className="ms-badge">
              {currentForm.sections.length} secciones · {currentForm.fields.length} variables
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-2xl">
            Estructura tu cuaderno eCRF por secciones clínicas, configura reglas de visibilidad y reutiliza módulos favoritos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsFavModalOpen(true)}
            className="ms-btn ms-btn-sm ms-btn-secondary"
            title="Biblioteca de módulos clínicos reutilizables"
          >
            <Star size={14} style={{ color: 'var(--color-accent)' }} />
            <span>Biblioteca Favoritos ({favoriteSections.length})</span>
          </button>

          <button
            onClick={() => setShowNewFormModal(true)}
            className="ms-btn ms-btn-sm ms-btn-secondary"
          >
            <FolderPlus size={14} />
            <span>Nuevo Formulario</span>
          </button>

          <button
            onClick={handleSaveAll}
            className="ms-btn ms-btn-sm ms-btn-primary"
          >
            <Save size={14} />
            <span>Guardar Estructura</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 bg-[var(--color-success-soft)] border border-[#C5E3D1] text-[var(--color-ink)] text-xs font-semibold rounded-lg flex items-center justify-between slide-up">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            ✕
          </button>
        </div>
      )}

      {/* Meta configuration card */}
      <div className="ms-card p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5">
          <FileCode className="w-4 h-4 text-[var(--color-accent)]" />
          Metadatos Generales del Formulario
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="ms-form-label mb-1">Título del Formulario / Estudio</label>
            <input
              type="text"
              value={currentForm.title}
              onChange={(e) => handleUpdateMeta('title', e.target.value)}
              className="ms-form-input font-bold"
            />
          </div>

          <div>
            <label className="ms-form-label mb-1">Prefijo de ID (Código de Caso)</label>
            <input
              type="text"
              value={currentForm.codePrefix || ''}
              onChange={(e) => handleUpdateMeta('codePrefix', e.target.value)}
              placeholder="Ej. PAC-, SUJ-, OBS-"
              className="ms-form-input font-mono font-semibold"
            />
          </div>

          <div className="md:col-span-3">
            <label className="ms-form-label mb-1">Descripción / Objetivo</label>
            <input
              type="text"
              value={currentForm.description}
              onChange={(e) => handleUpdateMeta('description', e.target.value)}
              className="ms-form-input text-xs"
            />
          </div>
        </div>
      </div>

      {/* Two-Panel Layout on Desktop: Structure (Left) & Field Editor (Right) */}
      <div className="ms-form-builder-layout">
        {/* LEFT PANEL: Sections & Variables Structure Tree */}
        <div className="space-y-5">
          {/* Sections Toolbar & Creation Bar */}
          <div className="ms-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--color-accent)]" />
              <span className="text-xs font-bold text-[var(--color-ink)]">
                Estructura de Secciones ({currentForm.sections.length})
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSection()}
                  placeholder="Nueva sección..."
                  className="ms-form-input py-1 px-2.5 text-xs w-44"
                  style={{ minHeight: '36px' }}
                />
                <button
                  type="button"
                  onClick={addSection}
                  className="ms-btn ms-btn-secondary ms-btn-sm"
                  style={{ minHeight: '36px' }}
                >
                  <Plus size={14} />
                  <span>Añadir</span>
                </button>
              </div>

              <span className="text-[var(--color-border)] hidden sm:inline">|</span>

              <button
                type="button"
                onClick={() => setIsFavModalOpen(true)}
                className="ms-btn ms-btn-secondary ms-btn-sm"
                style={{ minHeight: '36px' }}
              >
                <Star size={13} style={{ color: 'var(--color-accent)' }} />
                <span>+ Favorita</span>
              </button>
            </div>
          </div>

          {/* Structured Sections & Variables List */}
          <div className="space-y-4">
            {currentForm.sections.map((secName, secIdx) => {
              const fieldsInSec = sectionFieldMap.get(secName) || [];

              return (
                <div
                  key={secName}
                  className="ms-card overflow-hidden transition-all"
                >
                  {/* Section Header Bar */}
                  <div className="p-3.5 bg-[var(--color-bg-deep)] border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center text-[var(--color-text-tertiary)]">
                        <button
                          disabled={secIdx === 0}
                          onClick={() => moveSection(secIdx, 'up')}
                          className="p-1 hover:text-[var(--color-text-primary)] disabled:opacity-20 cursor-pointer"
                          title="Mover sección arriba"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          disabled={secIdx === currentForm.sections.length - 1}
                          onClick={() => moveSection(secIdx, 'down')}
                          className="p-1 hover:text-[var(--color-text-primary)] disabled:opacity-20 cursor-pointer"
                          title="Mover sección abajo"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[var(--color-ink)] text-sm tracking-tight">{secName}</h3>
                          <button
                            onClick={() => setRenamingSection({ original: secName, current: secName })}
                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] p-0.5"
                            title="Renombrar sección"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          {/* Section condition badge */}
                          {currentForm.sectionRules?.[secName] && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                              <GitBranch className="w-3 h-3 text-indigo-600" />
                              <span>
                                {getConditionDescription(
                                  currentForm.sectionRules[secName],
                                  currentForm.fields.find(
                                    (f) => f.name === currentForm.sectionRules?.[secName]?.parentField
                                  )?.label
                                )}
                              </span>
                              <button
                                onClick={() => handleClearSectionCondition(secName)}
                                className="text-indigo-400 hover:text-rose-600 ml-0.5"
                                title="Quitar condición"
                              >
                                ×
                              </button>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                          {fieldsInSec.length} {fieldsInSec.length === 1 ? 'variable' : 'variables'}
                        </span>
                      </div>
                    </div>

                    {/* Section Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        onClick={() => handleOpenSectionCondition(secName)}
                        className={`ms-btn ms-btn-sm ${
                          currentForm.sectionRules?.[secName]
                            ? 'text-indigo-900 bg-indigo-50 border-indigo-300 font-semibold'
                            : 'ms-btn-secondary'
                        }`}
                        style={{ minHeight: '30px', padding: '0.25rem 0.6rem' }}
                        title="Configurar regla de visibilidad para esta sección"
                      >
                        <GitBranch className="w-3 h-3 text-indigo-600" />
                        <span className="text-[11px]">
                          {currentForm.sectionRules?.[secName] ? 'Condición' : 'Condicionar'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenSaveAsFavorite(secName)}
                        className="ms-btn ms-btn-secondary ms-btn-sm"
                        style={{ minHeight: '30px', padding: '0.25rem 0.6rem' }}
                        title="Guardar en biblioteca de favoritos"
                      >
                        <BookmarkPlus className="w-3 h-3 text-amber-600" />
                        <span className="text-[11px]">Favorita</span>
                      </button>

                      <button
                        onClick={() => startAddField(secName)}
                        className="ms-btn ms-btn-primary ms-btn-sm"
                        style={{ minHeight: '30px', padding: '0.25rem 0.6rem' }}
                      >
                        <Plus className="w-3 h-3" />
                        <span className="text-[11px]">Añadir Variable</span>
                      </button>

                      {currentForm.sections.length > 1 && (
                        <button
                          onClick={() => removeSection(secName)}
                          className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] rounded"
                          title="Eliminar sección"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Variables Inside this Section */}
                  {fieldsInSec.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
                      Esta sección aún no tiene variables asociadas.{' '}
                      <button
                        onClick={() => startAddField(secName)}
                        className="text-[var(--color-accent)] font-semibold underline cursor-pointer"
                      >
                        + Añadir la primera variable
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)]">
                      {fieldsInSec.map((field) => {
                        const globalIdx = currentForm.fields.findIndex((f) => f.id === field.id);
                        const isCurrentlyEditing = editingField?.id === field.id;

                        return (
                          <div
                            key={field.id}
                            className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                              isCurrentlyEditing
                                ? 'bg-[var(--color-accent-soft)] border-l-4 border-l-[var(--color-accent)]'
                                : 'hover:bg-[var(--color-bg-deep)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex flex-col text-[var(--color-text-tertiary)]">
                                <button
                                  disabled={globalIdx === 0}
                                  onClick={() => moveField(globalIdx, 'up')}
                                  className="hover:text-[var(--color-text-primary)] disabled:opacity-20 cursor-pointer"
                                  title="Subir variable"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  disabled={globalIdx === currentForm.fields.length - 1}
                                  onClick={() => moveField(globalIdx, 'down')}
                                  className="hover:text-[var(--color-text-primary)] disabled:opacity-20 cursor-pointer"
                                  title="Bajar variable"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs text-[var(--color-ink)]">
                                    {field.label}
                                  </span>
                                  <span className="font-mono text-[10px] text-[var(--color-accent-strong)] bg-[var(--color-accent-soft)] px-1.5 py-0.2 rounded border border-[var(--color-accent)]/20">
                                    {field.name}
                                  </span>
                                  <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">
                                    ({field.type})
                                  </span>
                                  {field.unit && (
                                    <span className="text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-bg-deep)] px-1 py-0.2 rounded font-mono border border-[var(--color-border)]">
                                      {field.unit}
                                    </span>
                                  )}
                                  {field.required && (
                                    <span className="text-[9px] text-[var(--color-accent)] font-semibold bg-[var(--color-accent-soft)] px-1 py-0.2 rounded">
                                      Obligatorio
                                    </span>
                                  )}
                                  {field.type === 'calculated' && (
                                    <span className="text-[9px] text-[var(--color-accent-strong)] font-mono bg-[var(--color-accent-soft)] px-1 rounded">
                                      Fórmula: {field.formulaPreset || field.formula || 'Auto'}
                                    </span>
                                  )}
                                  {field.conditional && (
                                    <span className="text-[10px] font-medium text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                                      <GitBranch className="w-2.5 h-2.5 text-indigo-600" />
                                      <span>Condicional</span>
                                    </span>
                                  )}
                                </div>

                                {field.description && (
                                  <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-md mt-0.5">
                                    {field.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => startEditField(field)}
                                className={`ms-btn ms-btn-sm ${
                                  isCurrentlyEditing ? 'ms-btn-primary' : 'ms-btn-secondary'
                                }`}
                                style={{ minHeight: '28px', padding: '0.2rem 0.6rem' }}
                                title="Editar propiedades de la variable"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span className="text-[11px]">Editar</span>
                              </button>
                              <button
                                onClick={() => removeField(field.id)}
                                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] rounded cursor-pointer"
                                title="Eliminar variable"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: Selected Element Editor Panel */}
        <div id="field-editor-panel" className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {editingField ? (
            <div className="ms-form-builder-panel space-y-4 slide-up">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-ink)]">
                    {isNewField ? 'Añadir Nueva Variable Clínica' : 'Configuración de Variable'}
                  </h3>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {isNewField ? 'Define el tipo y reglas para el nuevo campo' : `Editando: ${editingField.label}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] rounded"
                  title="Cerrar editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Basic Fields */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="ms-form-label mb-1">
                    Etiqueta Visible (Para el clínico / investigador)
                  </label>
                  <input
                    type="text"
                    value={editingField.label}
                    onChange={(e) => {
                      const lbl = e.target.value;
                      setEditingField((prev) =>
                        prev
                          ? {
                              ...prev,
                              label: lbl,
                              name: isNewField ? normalizeColumnKey(lbl) : prev.name,
                            }
                          : null
                      );
                    }}
                    placeholder="Ej. Frecuencia Cardíaca, Talla, Escala Glasgow"
                    className="ms-form-input font-medium"
                  />
                </div>

                <div>
                  <label className="ms-form-label mb-1">
                    Nombre de Columna en BD (sin espacios ni acentos)
                  </label>
                  <input
                    type="text"
                    value={editingField.name}
                    onChange={(e) =>
                      setEditingField((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    placeholder="Ej. frec_cardiaca, imc, ta_sistolica"
                    className="ms-form-input font-mono font-semibold bg-[var(--color-bg-deep)]"
                  />
                </div>

                <div>
                  <label className="ms-form-label mb-1">Sección Clínica del Formulario</label>
                  <select
                    value={editingField.section}
                    onChange={(e) =>
                      setEditingField((prev) => (prev ? { ...prev, section: e.target.value } : null))
                    }
                    className="ms-form-select"
                  >
                    {currentForm.sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field Type Selector: Visual Grid of Cards with Icons */}
                <div className="space-y-1.5 pt-1">
                  <label className="ms-form-label">Tipo de Dato Clínico</label>
                  <div className="ms-form-type-grid" role="radiogroup" aria-label="Tipo de dato clínico">
                    {availableFieldTypes.map((item) => {
                      const isSelected = editingField.type === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() =>
                            setEditingField((prev) => (prev ? { ...prev, type: item.type } : null))
                          }
                          className={`ms-form-type-card ${isSelected ? 'is-active' : ''}`}
                        >
                          <div className="flex items-center gap-1.5 text-[var(--color-accent-strong)] font-bold text-xs">
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
                          <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight">
                            {item.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Type-Specific Options: Number */}
                {editingField.type === 'number' && (
                  <div className="grid grid-cols-3 gap-2 p-3 bg-[var(--color-bg-deep)] border border-[var(--color-border)] rounded-lg">
                    <div>
                      <label className="ms-form-label text-[11px] mb-1">Unidad (ej. mmHg, kg)</label>
                      <input
                        type="text"
                        value={editingField.unit || ''}
                        onChange={(e) =>
                          setEditingField((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                        }
                        placeholder="mmHg, bpm..."
                        className="ms-form-input py-1 px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="ms-form-label text-[11px] mb-1">Mínimo</label>
                      <input
                        type="number"
                        value={editingField.min ?? ''}
                        onChange={(e) =>
                          setEditingField((prev) =>
                            prev
                              ? { ...prev, min: e.target.value === '' ? undefined : Number(e.target.value) }
                              : null
                          )
                        }
                        className="ms-form-input py-1 px-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="ms-form-label text-[11px] mb-1">Máximo</label>
                      <input
                        type="number"
                        value={editingField.max ?? ''}
                        onChange={(e) =>
                          setEditingField((prev) =>
                            prev
                              ? { ...prev, max: e.target.value === '' ? undefined : Number(e.target.value) }
                              : null
                          )
                        }
                        className="ms-form-input py-1 px-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Type-Specific Options: Calculated */}
                {editingField.type === 'calculated' && (
                  <div className="p-3 bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 rounded-lg space-y-2.5">
                    <label className="ms-form-label font-bold text-[var(--color-accent-strong)]">
                      Fórmula de Cálculo Automático
                    </label>
                    <select
                      value={editingField.formulaPreset || 'imc'}
                      onChange={(e) =>
                        setEditingField((prev) =>
                          prev ? { ...prev, formulaPreset: e.target.value as any } : null
                        )
                      }
                      className="ms-form-select"
                    >
                      <option value="imc">IMC / BMI (OMS: peso / [talla/100]²)</option>
                      <option value="pam">Presión Arterial Media (PAM = [PAD*2 + PAS]/3)</option>
                      <option value="braden">Puntuación Total Escala Braden</option>
                      <option value="custom">Fórmula matemática personalizada</option>
                    </select>

                    {editingField.formulaPreset === 'custom' && (
                      <div>
                        <label className="ms-form-label text-[11px] mb-1">
                          Expresión matemática (ej. peso * 1.2 + edad):
                        </label>
                        <input
                          type="text"
                          value={editingField.formula || ''}
                          onChange={(e) =>
                            setEditingField((prev) =>
                              prev ? { ...prev, formula: e.target.value } : null
                            )
                          }
                          placeholder="ej. var_a + var_b"
                          className="ms-form-input font-mono text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="ms-form-label text-[11px] mb-1">Unidad del resultado</label>
                      <input
                        type="text"
                        value={editingField.unit || ''}
                        onChange={(e) =>
                          setEditingField((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                        }
                        placeholder="kg/m², mmHg, pts..."
                        className="ms-form-input text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Type-Specific Options: Select, Radio, Multiselect */}
                {['select', 'radio', 'multiselect'].includes(editingField.type) && (
                  <div className="space-y-1.5 p-3 bg-[var(--color-bg-deep)] border border-[var(--color-border)] rounded-lg">
                    <label className="ms-form-label">
                      Opciones de Respuesta (una por línea)
                    </label>
                    <textarea
                      rows={4}
                      value={editingField.options?.join('\n') || ''}
                      onChange={(e) => {
                        const lines = e.target.value.split('\n');
                        setEditingField((prev) => (prev ? { ...prev, options: lines } : null));
                      }}
                      placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                      className="ms-form-textarea text-xs"
                    />
                    <span className="text-[10px] text-[var(--color-text-secondary)]">
                      Escribe cada opción clínica en una línea distinta.
                    </span>
                  </div>
                )}

                <div>
                  <label className="ms-form-label mb-1">
                    Nota o Descripción de ayuda clínica
                  </label>
                  <input
                    type="text"
                    value={editingField.description || ''}
                    onChange={(e) =>
                      setEditingField((prev) =>
                        prev ? { ...prev, description: e.target.value } : null
                      )
                    }
                    placeholder="Ej. Medición en decúbito tras 5 min de reposo"
                    className="ms-form-input text-xs"
                  />
                </div>

                {/* Validation Requirement */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingField.required || false}
                      onChange={(e) =>
                        setEditingField((prev) =>
                          prev ? { ...prev, required: e.target.checked } : null
                        )
                      }
                      className="w-4 h-4 text-[var(--color-accent)] rounded border-[var(--color-border)] focus:ring-[var(--color-accent)]"
                    />
                    <span className="font-semibold text-xs text-[var(--color-ink)]">
                      Campo Obligatorio al rellenar el formulario
                    </span>
                  </label>
                </div>

                {/* Advanced Options Accordion (Conditional Rules) */}
                <details
                  className="ms-form-accordion"
                  open={!!editingField.conditional}
                >
                  <summary className="ms-form-accordion-summary">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Lógica Condicional (Avanzada)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                  </summary>

                  <div className="ms-form-accordion-content space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!editingField.conditional}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const otherField = currentForm.fields.find((f) => f.id !== editingField.id);
                            setEditingField((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    conditional: {
                                      parentField: otherField ? otherField.name : '',
                                      operator: 'contains',
                                      value: '',
                                    },
                                  }
                                : null
                            );
                          } else {
                            setEditingField((prev) => {
                              if (!prev) return null;
                              const copy = { ...prev };
                              delete copy.conditional;
                              return copy;
                            });
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-xs text-[var(--color-ink)]">
                        Habilitar visualización condicional
                      </span>
                    </label>

                    {editingField.conditional && (
                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2.5">
                        <p className="text-[11px] text-indigo-900 leading-tight">
                          Este campo estará oculto en el formulario hasta que se satisfaga la condición indicada.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="ms-form-label text-[11px] mb-1">Variable Disparadora</label>
                            <select
                              value={editingField.conditional.parentField}
                              onChange={(e) => {
                                const pField = e.target.value;
                                const parentDef = currentForm.fields.find((f) => f.name === pField);
                                setEditingField((prev) =>
                                  prev && prev.conditional
                                    ? {
                                        ...prev,
                                        conditional: {
                                          ...prev.conditional,
                                          parentField: pField,
                                          value: parentDef?.options?.[0] || '',
                                        },
                                      }
                                    : null
                                );
                              }}
                              className="ms-form-select text-xs bg-white"
                            >
                              <option value="">-- Seleccionar variable --</option>
                              {currentForm.fields
                                .filter((f) => f.id !== editingField.id)
                                .map((f) => (
                                  <option key={f.id} value={f.name}>
                                    {f.label} ({f.name})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="ms-form-label text-[11px] mb-1">Condición</label>
                            <select
                              value={editingField.conditional.operator}
                              onChange={(e) =>
                                setEditingField((prev) =>
                                  prev && prev.conditional
                                    ? {
                                        ...prev,
                                        conditional: {
                                          ...prev.conditional,
                                          operator: e.target.value as ConditionOperator,
                                        },
                                      }
                                    : null
                                )
                              }
                              className="ms-form-select text-xs bg-white"
                            >
                              <option value="contains">Incluye / Contiene</option>
                              <option value="equals">Es exactamente igual a</option>
                              <option value="is_true">Es Sí / Marcado Positivo</option>
                              <option value="is_false">Es No / Marcado Negativo</option>
                              <option value="is_not_empty">Está rellenado (cualquier valor)</option>
                              <option value="not_equals">Es diferente de</option>
                              <option value="greater_than">Es mayor que (&gt;)</option>
                              <option value="less_than">Es menor que (&lt;)</option>
                            </select>
                          </div>
                        </div>

                        {!['is_true', 'is_false', 'is_not_empty'].includes(
                          editingField.conditional.operator
                        ) && (
                          <div>
                            <label className="ms-form-label text-[11px] mb-1">
                              Valor esperado de la variable disparadora
                            </label>
                            <input
                              type="text"
                              value={editingField.conditional.value ?? ''}
                              onChange={(e) =>
                                setEditingField((prev) =>
                                  prev && prev.conditional
                                    ? {
                                        ...prev,
                                        conditional: {
                                          ...prev.conditional,
                                          value: e.target.value,
                                        },
                                      }
                                    : null
                                )
                              }
                              placeholder="Ej. Estenosis Aórtica Severa"
                              className="ms-form-input text-xs bg-white"
                            />

                            {(() => {
                              const parentDef = currentForm.fields.find(
                                (f) => f.name === editingField.conditional?.parentField
                              );
                              if (parentDef?.options && parentDef.options.length > 0) {
                                return (
                                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                    <span className="text-[10px] text-slate-500">Sugerencias:</span>
                                    {parentDef.options.map((opt) => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() =>
                                          setEditingField((prev) =>
                                            prev && prev.conditional
                                              ? {
                                                  ...prev,
                                                  conditional: {
                                                    ...prev.conditional,
                                                    value: opt,
                                                  },
                                                }
                                              : null
                                          )
                                        }
                                        className="text-xs bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 px-2 py-0.5 rounded transition-colors"
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              </div>

              {/* Editor Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="ms-btn ms-btn-secondary ms-btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveEditingField}
                  className="ms-btn ms-btn-primary ms-btn-sm"
                >
                  <Save size={14} />
                  <span>Guardar Variable</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="ms-form-builder-panel p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[var(--color-bg-deep)] border border-[var(--color-border)] flex items-center justify-center mx-auto text-[var(--color-accent)]">
                <Sliders size={22} />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-ink)]">
                Editor de Variables Clínicas
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-xs mx-auto leading-relaxed">
                Selecciona cualquier variable del panel izquierdo para ajustar su tipo, opciones y reglas condicionales, o añade una nueva.
              </p>
              <button
                type="button"
                onClick={() => startAddField()}
                className="ms-btn ms-btn-secondary ms-btn-sm"
              >
                <Plus size={14} />
                <span>Añadir Variable</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Rename Section */}
      {renamingSection && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ms-card max-w-sm w-full p-5 space-y-4 slide-up">
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Renombrar Sección Clínica</h3>
            <input
              type="text"
              value={renamingSection.current}
              onChange={(e) =>
                setRenamingSection((prev) => (prev ? { ...prev, current: e.target.value } : null))
              }
              onKeyDown={(e) => e.key === 'Enter' && executeRenameSection()}
              className="ms-form-input text-xs"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenamingSection(null)}
                className="ms-btn ms-btn-secondary ms-btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={executeRenameSection}
                className="ms-btn ms-btn-primary ms-btn-sm"
              >
                Renombrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Section as Favorite */}
      {savingFavSectionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ms-card max-w-md w-full p-5 space-y-4 slide-up">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
              <BookmarkPlus className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-bold text-sm text-[var(--color-ink)]">Guardar Sección en Favoritos</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Podrás insertarla con un solo clic en cualquier otro formulario.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="ms-form-label mb-1">Nombre de la Sección Favorita</label>
                <input
                  type="text"
                  value={savingFavSectionModal.title}
                  onChange={(e) =>
                    setSavingFavSectionModal((prev) => (prev ? { ...prev, title: e.target.value } : null))
                  }
                  className="ms-form-input font-semibold"
                />
              </div>

              <div>
                <label className="ms-form-label mb-1">Categoría</label>
                <select
                  value={savingFavSectionModal.category}
                  onChange={(e) =>
                    setSavingFavSectionModal((prev) =>
                      prev ? { ...prev, category: e.target.value as any } : null
                    )
                  }
                  className="ms-form-select"
                >
                  <option value="cardiovascular">Cardiovascular</option>
                  <option value="imagen">Datos de Imagen</option>
                  <option value="antecedentes">Antecedentes</option>
                  <option value="laboratorio">Laboratorio</option>
                  <option value="constantes">Constantes</option>
                  <option value="general">General</option>
                </select>
              </div>

              <div>
                <label className="ms-form-label mb-1">Descripción</label>
                <input
                  type="text"
                  value={savingFavSectionModal.description}
                  onChange={(e) =>
                    setSavingFavSectionModal((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  className="ms-form-input"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900">
                Se guardarán las{' '}
                <strong>
                  {
                    currentForm.fields.filter(
                      (f) => (f.section || currentForm.sections[0]) === savingFavSectionModal.sectionName
                    ).length
                  }{' '}
                  variables
                </strong>{' '}
                de esta sección con todos sus tipos, unidades y validaciones.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button
                onClick={() => setSavingFavSectionModal(null)}
                className="ms-btn ms-btn-secondary ms-btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSaveSectionAsFavorite}
                className="ms-btn ms-btn-primary ms-btn-sm"
              >
                Guardar en Favoritos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Brand New Empty Form */}
      {showNewFormModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ms-card max-w-md w-full p-5 space-y-4 slide-up">
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Crear Nuevo Formulario en Blanco</h3>
            <div>
              <label className="ms-form-label mb-1">Nombre del Formulario</label>
              <input
                type="text"
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="Ej. Estudio de Imagen y Cardiopatía"
                className="ms-form-input text-xs"
                autoFocus
              />
            </div>

            <div>
              <label className="ms-form-label mb-1">Prefijo para Códigos de Caso</label>
              <input
                type="text"
                value={newFormPrefix}
                onChange={(e) => setNewFormPrefix(e.target.value)}
                placeholder="Ej. PAC-, IMG-, CAR-"
                className="ms-form-input font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewFormModal(false)}
                className="ms-btn ms-btn-secondary ms-btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!newFormTitle.trim()) return;
                  onCreateNewForm(newFormTitle.trim(), newFormPrefix.trim() || 'PAC-');
                  setShowNewFormModal(false);
                  setNewFormTitle('');
                }}
                className="ms-btn ms-btn-primary ms-btn-sm"
              >
                Crear Formulario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configure Section Condition */}
      {editingSectionCondition && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="ms-card max-w-md w-full p-5 space-y-4 slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-ink)]">
                    Condicionar Sección: <span className="text-indigo-800">{editingSectionCondition}</span>
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Esta sección completa solo se mostrará si se cumple la condición.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingSectionCondition(null)}
                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="ms-form-label mb-1">Variable Disparadora</label>
                <select
                  value={sectionRuleDraft.parentField}
                  onChange={(e) => {
                    const pField = e.target.value;
                    const pDef = currentForm.fields.find((f) => f.name === pField);
                    setSectionRuleDraft((prev) => ({
                      ...prev,
                      parentField: pField,
                      value: pDef?.options?.[0] || '',
                    }));
                  }}
                  className="ms-form-select text-xs"
                >
                  <option value="">-- Sin condición (Siempre visible) --</option>
                  {currentForm.fields
                    .filter((f) => f.section !== editingSectionCondition)
                    .map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.label} ({f.name})
                      </option>
                    ))}
                </select>
              </div>

              {sectionRuleDraft.parentField && (
                <>
                  <div>
                    <label className="ms-form-label mb-1">Operador / Regla</label>
                    <select
                      value={sectionRuleDraft.operator}
                      onChange={(e) =>
                        setSectionRuleDraft((prev) => ({
                          ...prev,
                          operator: e.target.value as ConditionOperator,
                        }))
                      }
                      className="ms-form-select text-xs"
                    >
                      <option value="contains">Incluye / Contiene</option>
                      <option value="equals">Es exactamente igual a</option>
                      <option value="is_true">Es Sí / Marcado Positivo</option>
                      <option value="is_false">Es No / Marcado Negativo</option>
                      <option value="is_not_empty">Está rellenado (cualquier valor)</option>
                      <option value="not_equals">Es diferente de</option>
                      <option value="greater_than">Es mayor que (&gt;)</option>
                      <option value="less_than">Es menor que (&lt;)</option>
                    </select>
                  </div>

                  {!['is_true', 'is_false', 'is_not_empty'].includes(sectionRuleDraft.operator) && (
                    <div>
                      <label className="ms-form-label mb-1">Valor requerido</label>
                      <input
                        type="text"
                        value={sectionRuleDraft.value ?? ''}
                        onChange={(e) =>
                          setSectionRuleDraft((prev) => ({ ...prev, value: e.target.value }))
                        }
                        placeholder="Ej. Estenosis Aórtica Severa"
                        className="ms-form-input text-xs"
                      />

                      {(() => {
                        const parentDef = currentForm.fields.find(
                          (f) => f.name === sectionRuleDraft.parentField
                        );
                        if (parentDef?.options && parentDef.options.length > 0) {
                          return (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              <span className="text-[10px] text-slate-500">Sugerencias:</span>
                              {parentDef.options.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    setSectionRuleDraft((prev) => ({ ...prev, value: opt }))
                                  }
                                  className="text-xs bg-slate-50 border border-slate-300 hover:bg-slate-100 text-slate-800 px-2 py-0.5 rounded transition-colors"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => {
                  handleClearSectionCondition(editingSectionCondition);
                  setEditingSectionCondition(null);
                }}
                className="text-xs text-[var(--color-error)] hover:underline cursor-pointer"
              >
                Eliminar Condición
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSectionCondition(null)}
                  className="ms-btn ms-btn-secondary ms-btn-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSectionCondition}
                  className="ms-btn ms-btn-primary ms-btn-sm"
                >
                  Aplicar Condición
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Favorite Sections Modal */}
      <FavoriteSectionsModal
        isOpen={isFavModalOpen}
        onClose={() => setIsFavModalOpen(false)}
        favoriteSections={favoriteSections}
        onInsertSection={handleInsertFavoriteSection}
        onSaveNewFavorite={onSaveNewFavoriteSection}
        onDeleteFavorite={onDeleteFavoriteSection}
      />
    </div>
  );
}