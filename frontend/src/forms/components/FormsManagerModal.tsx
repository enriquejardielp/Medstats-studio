import React, { useState, useRef } from 'react';
import {
  FolderKanban,
  X,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  Layers,
  Database,
  ArrowRight,
  RotateCcw,
  FileText,
} from 'lucide-react';
import type { ClinicalForm, TrashItem } from '../types/clinical';
import { getRecordsForForm } from '../utils/storage';

interface FormsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  forms: ClinicalForm[];
  activeFormId: string;
  onSelectForm: (formId: string) => void;
  onDuplicateForm: (formId: string, cloneRecords: boolean) => void;
  onDeleteForm: (formId: string) => void;
  onOpenTemplates: () => void;
  onCreateNew: () => void;
  trashItems: TrashItem[];
  onRestoreFromTrash: (trashId: string) => void;
  onImportBackup: (jsonStr: string) => void;
}

export function FormsManagerModal({
  isOpen,
  onClose,
  forms,
  activeFormId,
  onSelectForm,
  onDuplicateForm,
  onDeleteForm,
  onOpenTemplates,
  onCreateNew,
  trashItems,
  onRestoreFromTrash,
  onImportBackup,
}: FormsManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'forms' | 'trash'>('forms');
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleExportFormJSON = (form: ClinicalForm) => {
    const records = getRecordsForForm(form);
    const payload = {
      cliniform_export_version: '2.5',
      exportedAt: new Date().toISOString(),
      form,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cliniform_${form.title.replace(/\s+/g, '_')}_backup.json`;
    link.click();
    URL.revokeObjectURL(url);

    setFeedback(`Copia de seguridad descargada para "${form.title}"`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        onImportBackup(text);
        setFeedback('¡Formulario y datos importados correctamente!');
        setTimeout(() => setFeedback(null), 3500);
      } catch (err: any) {
        alert('Error al leer el archivo de respaldo: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-2xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Mis Formularios y Bases de Datos Clínicas</h3>
                <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {forms.length} {forms.length === 1 ? 'formulario' : 'formularios'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cambia entre tus estudios, duplícalos, haz copias de seguridad o recupera formularios anteriores.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Tabs */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('forms')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'forms'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Formularios Activos ({forms.length})
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                activeTab === 'trash'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Papelera de Recuperación ({trashItems.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              id="import-backup-file"
            />
            <label
              htmlFor="import-backup-file"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-2xs cursor-pointer transition-colors"
              title="Importar un archivo de respaldo JSON"
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>Importar Respaldo</span>
            </label>

            <button
              onClick={() => {
                onClose();
                onOpenTemplates();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Plantillas</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onCreateNew();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo Formulario</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium rounded-md flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'forms' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forms.map((formItem) => {
                const isActive = formItem.id === activeFormId;
                const recordCount = getRecordsForForm(formItem).length;

                return (
                  <div
                    key={formItem.id}
                    className={`p-4 rounded-lg border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'border-teal-600 bg-teal-50/30 ring-1 ring-teal-600 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top tags */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[10px] text-teal-800 bg-teal-100/70 px-1.5 py-0.2 rounded font-semibold border border-teal-200">
                          {formItem.codePrefix || 'PAC-'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span className="text-[11px] font-semibold text-teal-800 bg-teal-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-teal-600" />
                              En uso
                            </span>
                          )}
                          <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {recordCount} {recordCount === 1 ? 'caso' : 'casos'}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className="font-bold text-slate-900 text-sm tracking-tight mb-1">
                        {formItem.title}
                      </h4>
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                        {formItem.description || 'Formulario clínico sin descripción'}
                      </p>

                      {/* Meta stats */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-4 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {formItem.fields.length} variables
                        </span>
                        <span>·</span>
                        <span>{formItem.sections.length} secciones</span>
                        <span>·</span>
                        <span className="text-slate-400 truncate max-w-[120px]">
                          {formItem.updatedAt
                            ? new Date(formItem.updatedAt).toLocaleDateString('es-ES')
                            : 'Reciente'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onDuplicateForm(formItem.id, false)}
                          className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded text-xs"
                          title="Duplicar estructura del formulario"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleExportFormJSON(formItem)}
                          className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded text-xs"
                          title="Exportar respaldo JSON (formulario + datos)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {forms.length > 1 && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `¿Mover el formulario "${formItem.title}" a la papelera? Podrás recuperarlo con sus datos en cualquier momento.`
                                )
                              ) {
                                onDeleteForm(formItem.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded text-xs"
                            title="Mover a la papelera"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {isActive ? (
                        <button
                          onClick={onClose}
                          className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700"
                        >
                          Continuar Trabajando
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectForm(formItem.id);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-teal-50 text-slate-800 hover:text-teal-900 border border-slate-300 rounded text-xs font-semibold transition-colors"
                        >
                          <span>Abrir Formulario</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Trash Tab */
            <div className="space-y-3">
              {trashItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  La papelera está vacía. Ningún formulario ha sido eliminado.
                </div>
              ) : (
                trashItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-4 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{item.form.title}</h4>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-mono">
                          {item.records?.length || 0} casos preservados
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Eliminado el {new Date(item.deletedAt).toLocaleString('es-ES')} · {item.form.fields.length} variables
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        onRestoreFromTrash(item.id);
                        setFeedback(`Formulario "${item.form.title}" restaurado exitosamente.`);
                        setTimeout(() => setFeedback(null), 3000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-md hover:bg-teal-700 transition-colors shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar Formulario</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Database className="w-3.5 h-3.5 text-teal-600" />
            <span>Tus datos y formularios están almacenados de forma segura en tu navegador.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
