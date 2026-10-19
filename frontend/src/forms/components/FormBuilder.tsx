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
} from 'lucide-react';
import type { ClinicalForm, FormField, FieldType, FavoriteSection, ConditionalRule, ConditionOperator } from '../types/clinical';
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
  };

  const startEditField = (field: FormField) => {
    setIsNewField(false);
    setEditingField({ ...field, options: field.options ? [...field.options] : [] });
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

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Diseñador de Formulario Clínico</h1>
            <span className="text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-mono">
              Secciones y Variables
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Estructura tu formulario por secciones clínicas y reutiliza módulos favoritos como antecedentes, factores de riesgo o datos de imagen.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Favorite Sections Button */}
          <button
            onClick={() => setIsFavModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-900 bg-teal-100/80 hover:bg-teal-200/80 border border-teal-300 rounded-md shadow-2xs transition-colors"
          >
            <Star className="w-3.5 h-3.5 fill-teal-700 text-teal-700" />
            <span>Biblioteca de Secciones Favoritas ({favoriteSections.length})</span>
          </button>

          <button
            onClick={() => setShowNewFormModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-2xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>Nuevo Formulario</span>
          </button>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-md hover:bg-teal-700 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Estructura</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 text-xs font-medium rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-teal-600 hover:text-teal-800">
            ✕
          </button>
        </div>
      )}

      {/* Meta configuration card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-teal-600" />
          Metadatos Generales del Formulario
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Título del Formulario / Estudio</label>
            <input
              type="text"
              value={currentForm.title}
              onChange={(e) => handleUpdateMeta('title', e.target.value)}
              className="w-full text-sm font-semibold text-slate-900 border border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Prefijo de ID (Código de Caso)
            </label>
            <input
              type="text"
              value={currentForm.codePrefix}
              onChange={(e) => handleUpdateMeta('codePrefix', e.target.value)}
              placeholder="Ej. PAC-, SUJ-, OBS-"
              className="w-full text-sm font-mono font-medium text-slate-900 border border-slate-300 rounded-md py-1.5 px-3 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">Descripción / Objetivo</label>
            <input
              type="text"
              value={currentForm.description}
              onChange={(e) => handleUpdateMeta('description', e.target.value)}
              className="w-full text-xs text-slate-700 border border-slate-300 rounded-md py-1.5 px-3"
            />
          </div>
        </div>
      </div>

      {/* Sections Toolbar & Creation Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-700" />
          <span className="text-xs font-bold text-slate-900">
            Secciones Clínicas Activas ({currentForm.sections.length})
          </span>
          <span className="text-xs text-slate-500">· {currentForm.fields.length} variables en total</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Add blank section inline */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSection()}
              placeholder="Nueva sección (ej. Datos de Imagen)..."
              className="text-xs bg-white border border-slate-300 rounded-md py-1.5 px-2.5 w-48 focus:ring-1 focus:ring-teal-500"
            />
            <button
              onClick={addSection}
              className="px-3 py-1.5 text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md"
            >
              + Añadir Sección
            </button>
          </div>

          <span className="text-slate-300">|</span>

          {/* Direct trigger for Favorite Sections */}
          <button
            onClick={() => setIsFavModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-800 bg-white border border-teal-300 hover:bg-teal-50 rounded-md shadow-2xs"
          >
            <Star className="w-3.5 h-3.5 fill-teal-600 text-teal-600" />
            <span>+ Insertar Sección Favorita</span>
          </button>
        </div>
      </div>

      {/* Structured Sections & Variables List (Cards per section) */}
      <div className="space-y-5">
        {currentForm.sections.map((secName, secIdx) => {
          const fieldsInSec = sectionFieldMap.get(secName) || [];

          return (
            <div
              key={secName}
              className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden"
            >
              {/* Section Header Bar */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center text-slate-400">
                    <button
                      disabled={secIdx === 0}
                      onClick={() => moveSection(secIdx, 'up')}
                      className="p-1 hover:text-slate-700 disabled:opacity-20"
                      title="Mover sección arriba"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={secIdx === currentForm.sections.length - 1}
                      onClick={() => moveSection(secIdx, 'down')}
                      className="p-1 hover:text-slate-700 disabled:opacity-20"
                      title="Mover sección abajo"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm tracking-tight">{secName}</h3>
                      <button
                        onClick={() => setRenamingSection({ original: secName, current: secName })}
                        className="text-slate-400 hover:text-teal-700"
                        title="Renombrar sección"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Section conditional badge */}
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
                            title="Quitar condición de sección"
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {fieldsInSec.length} {fieldsInSec.length === 1 ? 'variable' : 'variables'}
                    </span>
                  </div>
                </div>

                {/* Section Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Condition button for whole section */}
                  <button
                    onClick={() => handleOpenSectionCondition(secName)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded shadow-2xs transition-colors ${
                      currentForm.sectionRules?.[secName]
                        ? 'text-indigo-900 bg-indigo-100/80 border border-indigo-300 font-semibold'
                        : 'text-slate-700 bg-white hover:bg-slate-100 border border-slate-300'
                    }`}
                    title="Configurar regla para que esta sección solo se muestre condicionalmente si se responde otra pregunta"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{currentForm.sectionRules?.[secName] ? 'Condición Activa' : 'Condicionar Sección'}</span>
                  </button>

                  {/* ⭐ Save as Favorite Section Button */}
                  <button
                    onClick={() => handleOpenSaveAsFavorite(secName)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded shadow-2xs transition-colors"
                    title="Guardar esta sección con todas sus variables en la biblioteca de favoritos para usarla en otros formularios"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
                    <span>Guardar como Favorita</span>
                  </button>

                  {/* Add variable specifically to this section */}
                  <button
                    onClick={() => startAddField(secName)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Variable</span>
                  </button>

                  {/* Delete Section */}
                  {currentForm.sections.length > 1 && (
                    <button
                      onClick={() => removeSection(secName)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded ml-1"
                      title="Eliminar sección"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Variables inside this section */}
              {fieldsInSec.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Esta sección aún no tiene variables asociadas. Haz clic en{' '}
                  <button
                    onClick={() => startAddField(secName)}
                    className="text-teal-700 font-semibold underline"
                  >
                    + Añadir Variable
                  </button>{' '}
                  para agregar el primer campo.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {fieldsInSec.map((field) => {
                    const globalIdx = currentForm.fields.findIndex((f) => f.id === field.id);

                    return (
                      <div
                        key={field.id}
                        className="py-2.5 px-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex flex-col text-slate-400">
                            <button
                              disabled={globalIdx === 0}
                              onClick={() => moveField(globalIdx, 'up')}
                              className="hover:text-slate-700 disabled:opacity-20"
                              title="Subir variable"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={globalIdx === currentForm.fields.length - 1}
                              onClick={() => moveField(globalIdx, 'down')}
                              className="hover:text-slate-700 disabled:opacity-20"
                              title="Bajar variable"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900">{field.label}</span>
                              <span className="font-mono text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                {field.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">({field.type})</span>
                              {field.unit && (
                                <span className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded font-mono">
                                  {field.unit}
                                </span>
                              )}
                              {field.required && (
                                <span className="text-[9px] text-rose-600 font-semibold bg-rose-50 px-1 py-0.2 rounded">
                                  Obligatorio
                                </span>
                              )}
                              {field.type === 'calculated' && (
                                <span className="text-[9px] text-teal-800 font-mono bg-teal-100/70 px-1 rounded">
                                  Fórmula: {field.formulaPreset || field.formula || 'Auto'}
                                </span>
                              )}
                              {/* Conditional Field Badge */}
                              {field.conditional && (
                                <span className="text-[10px] font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <GitBranch className="w-2.5 h-2.5 text-indigo-600" />
                                  <span>
                                    {getConditionDescription(
                                      field.conditional,
                                      currentForm.fields.find(
                                        (f) => f.name === field.conditional?.parentField
                                      )?.label
                                    )}
                                  </span>
                                </span>
                              )}
                            </div>

                            {field.description && (
                              <p className="text-[11px] text-slate-500 truncate max-w-lg mt-0.5">
                                {field.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => startEditField(field)}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded"
                            title="Editar variable"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeField(field.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
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

      {/* Field Edit / Add Modal */}
      {editingField && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                {isNewField ? 'Añadir Nueva Variable Clínica' : 'Configurar Variable'}
              </h3>
              <button
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Etiqueta Visible (Para el médico / enfermero)
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
                  className="w-full text-xs font-medium border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre de Columna en BD / Archivo (sin espacios ni acentos)
                </label>
                <input
                  type="text"
                  value={editingField.name}
                  onChange={(e) =>
                    setEditingField((prev) => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  placeholder="Ej. frec_cardiaca, imc, ta_sistolica"
                  className="w-full font-mono text-xs font-medium border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Dato</label>
                  <select
                    value={editingField.type}
                    onChange={(e) =>
                      setEditingField((prev) =>
                        prev ? { ...prev, type: e.target.value as FieldType } : null
                      )
                    }
                    className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5"
                  >
                    <option value="text">Texto corto</option>
                    <option value="number">Número / Numérico</option>
                    <option value="select">Desplegable (Select)</option>
                    <option value="radio">Opción única (Radio)</option>
                    <option value="multiselect">Selección múltiple (Checkboxes)</option>
                    <option value="boolean">Sí / No (Booleano)</option>
                    <option value="date">Fecha</option>
                    <option value="textarea">Texto largo / Observaciones</option>
                    <option value="calculated">Campo Calculado / Fórmula</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sección Clínica</label>
                  <select
                    value={editingField.section}
                    onChange={(e) =>
                      setEditingField((prev) => (prev ? { ...prev, section: e.target.value } : null))
                    }
                    className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5"
                  >
                    {currentForm.sections.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Number specific options */}
              {editingField.type === 'number' && (
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Unidad (ej. mmHg, kg)</label>
                    <input
                      type="text"
                      value={editingField.unit || ''}
                      onChange={(e) =>
                        setEditingField((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                      }
                      placeholder="mmHg, bpm..."
                      className="w-full text-xs border border-slate-300 rounded py-1 px-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Mínimo</label>
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
                      className="w-full text-xs border border-slate-300 rounded py-1 px-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Máximo</label>
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
                      className="w-full text-xs border border-slate-300 rounded py-1 px-2"
                    />
                  </div>
                </div>
              )}

              {/* Calculated formula presets */}
              {editingField.type === 'calculated' && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-md space-y-2">
                  <label className="block font-semibold text-teal-900">
                    Fórmula de Cálculo Automático
                  </label>
                  <select
                    value={editingField.formulaPreset || 'imc'}
                    onChange={(e) =>
                      setEditingField((prev) =>
                        prev ? { ...prev, formulaPreset: e.target.value as any } : null
                      )
                    }
                    className="w-full text-xs border border-teal-300 rounded py-1.5 px-2 bg-white"
                  >
                    <option value="imc">IMC / BMI (OMS: peso / [talla/100]²)</option>
                    <option value="pam">Presión Arterial Media (PAM = [PAD*2 + PAS]/3)</option>
                    <option value="braden">Puntuación Total Escala Braden</option>
                    <option value="custom">Fórmula matemática personalizada</option>
                  </select>

                  {editingField.formulaPreset === 'custom' && (
                    <div>
                      <label className="block text-[11px] text-teal-800 mb-0.5">
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
                        className="w-full text-xs border border-teal-300 rounded py-1 px-2 bg-white font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] text-teal-800 mb-0.5">Unidad del resultado</label>
                    <input
                      type="text"
                      value={editingField.unit || ''}
                      onChange={(e) =>
                        setEditingField((prev) => (prev ? { ...prev, unit: e.target.value } : null))
                      }
                      placeholder="kg/m², mmHg, pts..."
                      className="w-full text-xs border border-teal-300 rounded py-1 px-2 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Options list for select/radio/multiselect */}
              {['select', 'radio', 'multiselect'].includes(editingField.type) && (
                <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                  <label className="block font-semibold text-slate-700">
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
                    className="w-full text-xs border border-slate-300 rounded py-1.5 px-2 bg-white"
                  />
                  <span className="text-[10px] text-slate-500">
                    Escribe cada opción en una línea distinta.
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
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
                  className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5"
                />
              </div>

              {/* Conditional Logic Configuration for this Field */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                      Campo Condicional (Mostrar solo si se cumple una regla)
                    </span>
                  </label>
                </div>

                {editingField.conditional && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-md space-y-2.5 text-xs">
                    <div className="text-[11px] text-indigo-900 font-medium">
                      Este campo estará oculto en el formulario hasta que el clínico marque o seleccione la respuesta indicada.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Variable Disparadora (Padre)
                        </label>
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
                          className="w-full text-xs border border-indigo-300 rounded py-1 px-2 bg-white"
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
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Condición
                        </label>
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
                          className="w-full text-xs border border-indigo-300 rounded py-1 px-2 bg-white"
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
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Valor que debe tener la variable padre
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
                          className="w-full text-xs border border-indigo-300 rounded py-1 px-2 bg-white"
                        />

                        {/* Quick pick options if parent has options */}
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
                                    className="text-[10px] bg-white border border-indigo-200 hover:bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded transition-colors"
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

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingField.required || false}
                    onChange={(e) =>
                      setEditingField((prev) =>
                        prev ? { ...prev, required: e.target.checked } : null
                      )
                    }
                    className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                  />
                  <span className="font-medium text-slate-700">Obligatorio al rellenar el formulario</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setEditingField(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={saveEditingField}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-md hover:bg-teal-700"
              >
                Guardar Variable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rename Section */}
      {renamingSection && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Renombrar Sección Clínica</h3>
            <input
              type="text"
              value={renamingSection.current}
              onChange={(e) =>
                setRenamingSection((prev) => (prev ? { ...prev, current: e.target.value } : null))
              }
              onKeyDown={(e) => e.key === 'Enter' && executeRenameSection()}
              className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRenamingSection(null)}
                className="px-3 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeRenameSection}
                className="px-3 py-1 text-xs font-semibold text-white bg-teal-600 rounded hover:bg-teal-700"
              >
                Renombrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Save Section as Favorite */}
      {savingFavSectionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <BookmarkPlus className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Guardar Sección en Favoritos</h3>
                <p className="text-xs text-slate-500">
                  Podrás insertarla con un solo clic en cualquier otro formulario.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nombre de la Sección Favorita</label>
                <input
                  type="text"
                  value={savingFavSectionModal.title}
                  onChange={(e) =>
                    setSavingFavSectionModal((prev) => (prev ? { ...prev, title: e.target.value } : null))
                  }
                  className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Categoría</label>
                <select
                  value={savingFavSectionModal.category}
                  onChange={(e) =>
                    setSavingFavSectionModal((prev) =>
                      prev ? { ...prev, category: e.target.value as any } : null
                    )
                  }
                  className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5"
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
                <label className="block font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={savingFavSectionModal.description}
                  onChange={(e) =>
                    setSavingFavSectionModal((prev) =>
                      prev ? { ...prev, description: e.target.value } : null
                    )
                  }
                  className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5"
                />
              </div>

              <div className="p-2.5 bg-amber-50/60 rounded border border-amber-200 text-amber-900">
                Se guardarán las{' '}
                <strong>
                  {
                    currentForm.fields.filter(
                      (f) => (f.section || currentForm.sections[0]) === savingFavSectionModal.sectionName
                    ).length
                  }{' '}
                  variables
                </strong>{' '}
                incluidas en esta sección con todos sus tipos, unidades y validaciones.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSavingFavSectionModal(null)}
                className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSaveSectionAsFavorite}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700"
              >
                Guardar en Favoritos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Brand New Empty Form */}
      {showNewFormModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Crear Nuevo Formulario en Blanco</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nombre del Formulario
              </label>
              <input
                type="text"
                value={newFormTitle}
                onChange={(e) => setNewFormTitle(e.target.value)}
                placeholder="Ej. Estudio de Imagen y Cardiopatía"
                className="w-full text-xs border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prefijo para Códigos de Paciente
              </label>
              <input
                type="text"
                value={newFormPrefix}
                onChange={(e) => setNewFormPrefix(e.target.value)}
                placeholder="Ej. PAC-, IMG-, CAR-"
                className="w-full font-mono text-xs border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewFormModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
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
                className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-md hover:bg-teal-700"
              >
                Crear Formulario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configure Section Condition */}
      {editingSectionCondition && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Condicionar Sección: <span className="text-indigo-800">{editingSectionCondition}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Esta sección completa solo se mostrará si se cumple la condición.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingSectionCondition(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Variable Disparadora (Padre)
                </label>
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
                  className="w-full text-xs border border-indigo-300 rounded py-1.5 px-2 bg-white"
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Operador / Regla
                    </label>
                    <select
                      value={sectionRuleDraft.operator}
                      onChange={(e) =>
                        setSectionRuleDraft((prev) => ({
                          ...prev,
                          operator: e.target.value as ConditionOperator,
                        }))
                      }
                      className="w-full text-xs border border-indigo-300 rounded py-1.5 px-2 bg-white"
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
                      <label className="block font-semibold text-slate-700 mb-1">
                        Valor requerido
                      </label>
                      <input
                        type="text"
                        value={sectionRuleDraft.value ?? ''}
                        onChange={(e) =>
                          setSectionRuleDraft((prev) => ({ ...prev, value: e.target.value }))
                        }
                        placeholder="Ej. Estenosis Aórtica Severa"
                        className="w-full text-xs border border-indigo-300 rounded py-1.5 px-2 bg-white"
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
                                  className="text-[10px] bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded transition-colors"
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

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  handleClearSectionCondition(editingSectionCondition);
                  setEditingSectionCondition(null);
                }}
                className="text-xs text-rose-600 hover:text-rose-800"
              >
                Eliminar Condición
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSectionCondition(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSectionCondition}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
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
