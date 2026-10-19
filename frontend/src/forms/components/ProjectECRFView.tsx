import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Database,
  BarChart3,
  FileText,
  FileSpreadsheet,
  GitMerge,
  Save,
  Check,
  Maximize2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { ClinicalForm, RecordEntry, FavoriteSection } from '../types/clinical';
import {
  projectToClinicalForm,
  syncFormRecordsToProject,
  recordsToProjectData,
} from '../utils/projectIntegration';
import {
  getFavoriteSections,
  addFavoriteSection,
  deleteFavoriteSection,
} from '../utils/storage';
import { IntakeForm } from './IntakeForm';
import { DataTable } from './DataTable';
import { AnalyticsView } from './AnalyticsView';
import { FormBuilder } from './FormBuilder';
import { ExportView } from './ExportView';
import { MergeView } from './MergeView';
import { TemplateSelectorModal } from './TemplateSelectorModal';
import { useNavigate } from 'react-router-dom';

interface ProjectECRFViewProps {
  projectId: number;
  projectName: string;
  projectDescription?: string;
  projectColumns: string[];
  projectColumnTypes: Record<string, string>;
  projectRows: any[];
  onDataSynced: (newRows: any[], newColumns: string[], newTypes: Record<string, any>) => void;
}

export const ProjectECRFView: React.FC<ProjectECRFViewProps> = ({
  projectId,
  projectName,
  projectDescription,
  projectColumns,
  projectColumnTypes,
  projectRows,
  onDataSynced,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    'intake' | 'records' | 'analytics' | 'builder' | 'export' | 'merge'
  >('intake');

  const [form, setForm] = useState<ClinicalForm>(() => {
    // 1. Intentar cargar formulario guardado específicamente para este proyecto
    const saved = localStorage.getItem(`medstats_project_form_${projectId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parseando formulario de proyecto:', e);
      }
    }
    // 2. Si no existe, autogenerar desde columnas del proyecto
    const { form: autoForm } = projectToClinicalForm({
      id: projectId,
      name: projectName,
      description: projectDescription,
      columns: projectColumns,
      column_types: projectColumnTypes,
      data: projectRows,
    });
    return autoForm;
  });

  const [records, setRecords] = useState<RecordEntry[]>(() => {
    // 1. Intentar cargar registros locales guardados para el formulario
    const localKey = `cliniform_records_${form.id}`;
    const raw = localStorage.getItem(localKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Error cargando registros locales:', e);
      }
    }

    // 2. Si no hay registros locales, convertir las filas existentes del proyecto
    const { records: autoRecords } = projectToClinicalForm({
      id: projectId,
      name: projectName,
      description: projectDescription,
      columns: projectColumns,
      column_types: projectColumnTypes,
      data: projectRows,
    });
    return autoRecords;
  });

  const [favoriteSections, setFavoriteSections] = useState<FavoriteSection[]>(() =>
    getFavoriteSections()
  );
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);

  // Guardar en localStorage cuando cambian registros o formulario
  useEffect(() => {
    localStorage.setItem(`cliniform_records_${form.id}`, JSON.stringify(records));
  }, [form.id, records]);

  useEffect(() => {
    localStorage.setItem(`medstats_project_form_${projectId}`, JSON.stringify(form));
  }, [projectId, form]);

  // Manejadores de registros
  const handleSaveRecord = (newEntry: RecordEntry, _andNext: boolean) => {
    const updated = [...records, newEntry];
    setRecords(updated);
  };

  const handleUpdateRecord = (updatedRec: RecordEntry) => {
    const updated = records.map((r) => (r.id === updatedRec.id ? updatedRec : r));
    setRecords(updated);
  };

  const handleDeleteRecord = (id: string) => {
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
  };

  const handleDeleteAllRecords = () => {
    setRecords([]);
  };

  const handleSaveForm = (updatedForm: ClinicalForm) => {
    setForm(updatedForm);
  };

  const handleSelectTemplate = (template: ClinicalForm) => {
    const adaptedTemplate: ClinicalForm = {
      ...template,
      id: `project-form-${projectId}`,
      title: `${template.title} (${projectName})`,
    };
    setForm(adaptedTemplate);
    setIsTemplatesModalOpen(false);
    setActiveTab('intake');
  };

  const handleApplyMerge = (mergedRecords: RecordEntry[], newFields?: string[]) => {
    setRecords(mergedRecords);
    if (newFields && newFields.length > 0) {
      const existingNames = new Set(form.fields.map((f) => f.name));
      const fieldsToAdd = newFields.filter((col) => !existingNames.has(col));
      if (fieldsToAdd.length > 0) {
        const appended = fieldsToAdd.map((colName, i) => ({
          id: 'f_ext_' + Date.now() + '_' + i,
          name: colName,
          label: colName.replace(/_/g, ' ').toUpperCase(),
          type: 'text' as const,
          section: form.sections[0] || 'Variables',
          required: false,
        }));
        setForm({
          ...form,
          fields: [...form.fields, ...appended],
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  // Sincronización explícita con el dataset del proyecto
  const handleSyncToProject = async () => {
    setIsSyncing(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);

    try {
      const res = await syncFormRecordsToProject(projectId, form, records);
      const { data, types, columns } = recordsToProjectData(form, records);

      onDataSynced(data, columns, types);
      setSyncSuccessMsg(`¡${res.rowCount} casos volcados exitosamente al dataset del proyecto!`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error sincronizando eCRF con proyecto:', err);
      setSyncErrorMsg(
        err.response?.data?.detail || err.message || 'Error al guardar los datos en el proyecto.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Barra Superior del eCRF del Proyecto */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">{form.title}</h2>
              <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                {records.length} casos recogidos
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Rellena y valida pacientes con fórmulas clínicas. Guarda para analizarlos al instante.
            </p>
          </div>
        </div>

        {/* Acciones principales de sincronización */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Plantillas Clínicas</span>
          </button>

          <button
            onClick={() => navigate(`/forms?projectId=${projectId}`)}
            title="Abrir el cuaderno eCRF en vista completa"
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Pantalla Completa</span>
          </button>

          <button
            onClick={handleSyncToProject}
            disabled={isSyncing}
            className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : syncSuccessMsg ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>¡Sincronizado!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Guardar y Volcar al Proyecto</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alertas de Sincronización */}
      {syncSuccessMsg && (
        <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      )}

      {syncErrorMsg && (
        <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2 animate-fade-in">
          <span>{syncErrorMsg}</span>
        </div>
      )}

      {/* Pestañas secundarias de navegación del eCRF */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('intake')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'intake'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Rellenar Caso</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'records'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Casos Recogidos ({records.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Calidad y Estadísticas</span>
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'builder'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Diseñar Formulario ({form.fields.length} campos)</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'export'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Libro de Códigos / Exportar</span>
        </button>

        <button
          onClick={() => setActiveTab('merge')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'merge'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Fusionar Archivo Externo</span>
        </button>
      </div>

      {/* Contenido según pestaña */}
      <div className="flex-1 p-6">
        {activeTab === 'intake' && (
          <IntakeForm
            form={form}
            records={records}
            onSaveRecord={handleSaveRecord}
            onGoToRecords={() => setActiveTab('records')}
          />
        )}

        {activeTab === 'records' && (
          <DataTable
            form={form}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={handleDeleteRecord}
            onDeleteAll={handleDeleteAllRecords}
            onGoToIntake={() => setActiveTab('intake')}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsView form={form} records={records} />}

        {activeTab === 'builder' && (
          <FormBuilder
            form={form}
            onSaveForm={handleSaveForm}
            onCreateNewForm={(title, prefix) => {
              setForm({
                id: `project-form-${projectId}`,
                title,
                description: 'Formulario personalizado para el proyecto.',
                category: 'investigacion',
                codePrefix: prefix,
                sections: ['Variables del Estudio'],
                fields: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }}
            favoriteSections={favoriteSections}
            onSaveNewFavoriteSection={(sec) => setFavoriteSections(addFavoriteSection(sec))}
            onDeleteFavoriteSection={(id) => setFavoriteSections(deleteFavoriteSection(id))}
          />
        )}

        {activeTab === 'export' && <ExportView form={form} records={records} />}

        {activeTab === 'merge' && (
          <MergeView
            form={form}
            currentRecords={records}
            onApplyMerge={handleApplyMerge}
            onGoToRecords={() => setActiveTab('records')}
          />
        )}
      </div>

      {/* Modal de Plantillas */}
      <TemplateSelectorModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};
