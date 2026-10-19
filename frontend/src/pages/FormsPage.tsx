import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { ClinicalForm, RecordEntry, FavoriteSection, TrashItem } from '../types/clinical';
import {
  getSavedForms,
  saveForms,
  getActiveFormId,
  setActiveFormId,
  getRecordsForForm,
  saveRecordsForForm,
  getFavoriteSections,
  addFavoriteSection,
  deleteFavoriteSection,
  getTrashItems,
  moveFormToTrash,
  restoreFormFromTrash,
  duplicateForm,
} from '../forms/utils/storage';
import {
  projectToClinicalForm,
  syncFormRecordsToProject,
} from '../forms/utils/projectIntegration';
import { Navbar } from '../forms/components/Navbar';
import { IntakeForm } from '../forms/components/IntakeForm';
import { DataTable } from '../forms/components/DataTable';
import { FormBuilder } from '../forms/components/FormBuilder';
import { ExportView } from '../forms/components/ExportView';
import { MergeView } from '../forms/components/MergeView';
import { AnalyticsView } from '../forms/components/AnalyticsView';
import { TemplateSelectorModal } from '../forms/components/TemplateSelectorModal';
import { FormsManagerModal } from '../forms/components/FormsManagerModal';
import { ProjectSyncModal } from '../forms/components/ProjectSyncModal';
import { Sparkles, ArrowLeft, Database, Check } from 'lucide-react';
import apiClient from '../api/client';

export default function FormsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const linkedProjectId = searchParams.get('projectId')
    ? parseInt(searchParams.get('projectId')!)
    : undefined;

  const [linkedProject, setLinkedProject] = useState<{
    id: number;
    name: string;
    row_count: number;
  } | null>(null);

  const [forms, setForms] = useState<ClinicalForm[]>(() => getSavedForms());
  const [activeFormId, setActiveFormIdState] = useState<string>(() =>
    getActiveFormId(forms)
  );
  const [activeTab, setActiveTab] = useState<
    'intake' | 'records' | 'analytics' | 'builder' | 'export' | 'merge'
  >('intake');
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isFormsManagerOpen, setIsFormsManagerOpen] = useState(false);
  const [isProjectSyncOpen, setIsProjectSyncOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => getTrashItems());
  const [showHelperBanner] = useState(true);
  const [favoriteSections, setFavoriteSections] = useState<FavoriteSection[]>(() =>
    getFavoriteSections()
  );
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [quickSyncSuccess, setQuickSyncSuccess] = useState(false);

  // Cargar información de proyecto si viene vinculado por URL
  useEffect(() => {
    if (linkedProjectId) {
      apiClient
        .get(`/api/projects/${linkedProjectId}`)
        .then(async (res) => {
          const proj = res.data;
          setLinkedProject({
            id: proj.id,
            name: proj.name,
            row_count: proj.row_count,
          });

          // Verificar si ya existe un formulario guardado para este proyecto
          const savedProjFormRaw = localStorage.getItem(`medstats_project_form_${proj.id}`);
          if (savedProjFormRaw) {
            try {
              const parsedForm: ClinicalForm = JSON.parse(savedProjFormRaw);
              if (!forms.some((f) => f.id === parsedForm.id)) {
                const updated = [parsedForm, ...forms];
                setForms(updated);
                saveForms(updated);
              }
              setActiveFormIdState(parsedForm.id);
              return;
            } catch {
              // fallback a generar
            }
          }

          // Cargar datos actuales del proyecto para generar el eCRF
          try {
            const dataRes = await apiClient.get(`/api/projects/${proj.id}/data`);
            const { form: autoForm, records: autoRecords } = projectToClinicalForm({
              id: proj.id,
              name: proj.name,
              description: proj.description,
              columns: dataRes.data.columns || proj.columns || [],
              column_types: dataRes.data.types || proj.column_types || {},
              data: dataRes.data.data || [],
            });

            const exists = forms.find((f) => f.id === autoForm.id);
            if (!exists) {
              const updated = [autoForm, ...forms];
              setForms(updated);
              saveForms(updated);
              saveRecordsForForm(autoForm.id, autoRecords);
            }
            setActiveFormIdState(autoForm.id);
            setRecords(autoRecords);
          } catch (err) {
            console.error('Error generando eCRF de proyecto:', err);
          }
        })
        .catch((err) => {
          console.error('Error cargando proyecto vinculado:', err);
        });
    }
  }, [linkedProjectId]);

  // Formulario activo
  const activeForm = useMemo(() => {
    return forms.find((f) => f.id === activeFormId) || forms[0];
  }, [forms, activeFormId]);

  // Registros del formulario activo
  const [records, setRecords] = useState<RecordEntry[]>(() => {
    const initialForm = forms.find((f) => f.id === activeFormId) || forms[0];
    return getRecordsForForm(initialForm);
  });

  // Al cambiar formulario activo, recargar sus registros
  useEffect(() => {
    if (activeForm) {
      const recs = getRecordsForForm(activeForm);
      setRecords(recs);
      setActiveFormId(activeForm.id);
    }
  }, [activeForm]);

  // Guardar nuevo registro
  const handleSaveRecord = (newEntry: RecordEntry, _andNext: boolean) => {
    const updated = [...records, newEntry];
    setRecords(updated);
    saveRecordsForForm(activeForm.id, updated);
  };

  // Actualizar registro existente
  const handleUpdateRecord = (updatedRec: RecordEntry) => {
    const updated = records.map((r) => (r.id === updatedRec.id ? updatedRec : r));
    setRecords(updated);
    saveRecordsForForm(activeForm.id, updated);
  };

  // Eliminar un registro
  const handleDeleteRecord = (id: string) => {
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    saveRecordsForForm(activeForm.id, updated);
  };

  // Eliminar todos los registros
  const handleDeleteAllRecords = () => {
    setRecords([]);
    saveRecordsForForm(activeForm.id, []);
  };

  // Guardar esquema del formulario
  const handleSaveForm = (updatedForm: ClinicalForm) => {
    const updatedForms = forms.map((f) => (f.id === updatedForm.id ? updatedForm : f));
    setForms(updatedForms);
    saveForms(updatedForms);
    if (linkedProjectId) {
      localStorage.setItem(`medstats_project_form_${linkedProjectId}`, JSON.stringify(updatedForm));
    }
  };

  // Crear nuevo formulario
  const handleCreateNewForm = (title: string, prefix: string) => {
    const newForm: ClinicalForm = {
      id: 'form-' + Date.now(),
      title,
      description: 'Formulario clínico personalizado para captura de datos.',
      category: 'general',
      codePrefix: prefix,
      sections: ['Datos Principales', 'Observaciones'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: [
        {
          id: 'f_' + Date.now(),
          name: 'edad',
          label: 'Edad del Sujeto',
          type: 'number',
          section: 'Datos Principales',
          required: true,
          unit: 'años',
        },
        {
          id: 'f_' + (Date.now() + 1),
          name: 'sexo',
          label: 'Sexo',
          type: 'radio',
          section: 'Datos Principales',
          options: ['Femenino', 'Masculino'],
          required: true,
        },
      ],
    };

    const newFormsList = [newForm, ...forms];
    setForms(newFormsList);
    saveForms(newFormsList);
    setActiveFormIdState(newForm.id);
    setActiveTab('builder');
  };

  // Cargar plantilla clínica
  const handleSelectTemplate = (template: ClinicalForm) => {
    const exists = forms.find((f) => f.id === template.id);
    if (!exists) {
      const updatedForms = [...forms, template];
      setForms(updatedForms);
      saveForms(updatedForms);
    }
    setActiveFormIdState(template.id);
    setActiveTab('intake');
  };

  // Fusión de datos externos
  const handleApplyMerge = (mergedRecords: RecordEntry[], newFields?: string[]) => {
    setRecords(mergedRecords);
    saveRecordsForForm(activeForm.id, mergedRecords);

    if (newFields && newFields.length > 0) {
      const existingNames = new Set(activeForm.fields.map((f) => f.name));
      const fieldsToAdd = newFields.filter((col) => !existingNames.has(col));

      if (fieldsToAdd.length > 0) {
        const appendedFields = fieldsToAdd.map((colName, i) => ({
          id: 'f_ext_' + Date.now() + '_' + i,
          name: colName,
          label: colName.replace(/_/g, ' ').toUpperCase(),
          type: 'text' as const,
          section: activeForm.sections[0] || 'General',
          required: false,
        }));

        const updatedForm: ClinicalForm = {
          ...activeForm,
          fields: [...activeForm.fields, ...appendedFields],
          updatedAt: new Date().toISOString(),
        };

        handleSaveForm(updatedForm);
      }
    }
  };

  // Secciones favoritas
  const handleSaveNewFavoriteSection = (newSec: FavoriteSection) => {
    const updated = addFavoriteSection(newSec);
    setFavoriteSections(updated);
  };

  const handleDeleteFavoriteSection = (id: string) => {
    const updated = deleteFavoriteSection(id);
    setFavoriteSections(updated);
  };

  // Duplicar y papelera
  const handleDuplicateForm = (formId: string, cloneRecords: boolean) => {
    const { newForm, forms: updatedForms } = duplicateForm(formId, cloneRecords);
    setForms(updatedForms);
    setActiveFormIdState(newForm.id);
    const recs = getRecordsForForm(newForm);
    setRecords(recs);
  };

  const handleDeleteForm = (formId: string) => {
    const { remainingForms, trashItems: updatedTrash } = moveFormToTrash(formId);
    setForms(remainingForms);
    setTrashItems(updatedTrash);
    if (remainingForms.length > 0) {
      setActiveFormIdState(remainingForms[0].id);
      setRecords(getRecordsForForm(remainingForms[0]));
    } else {
      setRecords([]);
    }
  };

  const handleRestoreFromTrash = (trashId: string) => {
    const result = restoreFormFromTrash(trashId);
    if (result) {
      setForms(result.forms);
      setTrashItems(getTrashItems());
      setActiveFormIdState(result.restoredForm.id);
      setRecords(getRecordsForForm(result.restoredForm));
    }
  };

  const handleImportBackup = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const incomingForm: ClinicalForm = parsed.form || parsed;
      const incomingRecords: RecordEntry[] = parsed.records || [];

      if (!incomingForm.id || !incomingForm.title || !incomingForm.fields) {
        throw new Error('Estructura no válida de CliniForm.');
      }

      const formId = forms.some((f) => f.id === incomingForm.id)
        ? 'form-' + Date.now()
        : incomingForm.id;

      const importedForm: ClinicalForm = {
        ...incomingForm,
        id: formId,
        title: forms.some((f) => f.title === incomingForm.title)
          ? `${incomingForm.title} (Importado)`
          : incomingForm.title,
        updatedAt: new Date().toISOString(),
      };

      const updatedForms = [importedForm, ...forms];
      setForms(updatedForms);
      saveForms(updatedForms);
      saveRecordsForForm(importedForm.id, incomingRecords);
      setActiveFormIdState(importedForm.id);
      setRecords(incomingRecords);
    } catch (e: any) {
      console.error('Error importando backup:', e);
      throw e;
    }
  };

  // Sincronización rápida con el proyecto vinculado
  const handleQuickSyncWithProject = async () => {
    if (!linkedProjectId) return;
    setIsQuickSyncing(true);
    setQuickSyncSuccess(false);
    try {
      await syncFormRecordsToProject(linkedProjectId, activeForm, records);
      setQuickSyncSuccess(true);
      setTimeout(() => setQuickSyncSuccess(false), 3000);
    } catch (err) {
      console.error('Error en sincronización rápida:', err);
      setIsProjectSyncOpen(true);
    } finally {
      setIsQuickSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900 -m-6 p-0">
      {/* Barra de Proyecto Vinculado */}
      {linkedProject && (
        <div className="bg-blue-900 text-blue-100 text-xs py-2 px-6 border-b border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/projects/${linkedProject.id}`)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-800 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a {linkedProject.name}</span>
            </button>
            <span className="hidden sm:inline text-blue-200">
              Estás editando el Cuaderno de Recogida de Datos (eCRF) vinculado al proyecto.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickSyncWithProject}
              disabled={isQuickSyncing}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {quickSyncSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>¡Datos Sincronizados!</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>{isQuickSyncing ? 'Guardando...' : 'Guardar en Proyecto'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Navegación Principal eCRF */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeForm={activeForm}
        forms={forms}
        onSelectForm={(id) => setActiveFormIdState(id)}
        onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
        onOpenFormsManager={() => setIsFormsManagerOpen(true)}
        recordCount={records.length}
        onOpenProjectSync={() => setIsProjectSyncOpen(true)}
        currentProjectName={linkedProject?.name}
      />

      {/* Banner de Productividad Clínica */}
      {showHelperBanner && activeTab === 'intake' && (
        <div className="bg-teal-900 text-teal-100 text-xs py-2 px-4 border-b border-teal-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-300 shrink-0" />
              <span>
                <strong>Flujo Ágil para Ciencias de la Salud:</strong> Rellena caso por caso con validación clínica y fórmulas automáticas (IMC, PAM, Braden). Presiona{' '}
                <kbd className="px-1 py-0.5 bg-teal-800 border border-teal-700 rounded font-mono text-[10px]">
                  Ctrl + Enter
                </kbd>{' '}
                para guardar el caso y pasar al siguiente.
              </span>
            </div>
            <button
              onClick={() => setIsProjectSyncOpen(true)}
              className="text-xs bg-teal-800 hover:bg-teal-700 text-teal-100 px-2.5 py-0.5 rounded-md font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Database className="w-3 h-3 text-teal-300" />
              <span>Sincronizar con Proyectos</span>
            </button>
          </div>
        </div>
      )}

      {/* Vistas Principales */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'intake' && (
          <IntakeForm
            form={activeForm}
            records={records}
            onSaveRecord={handleSaveRecord}
            onGoToRecords={() => setActiveTab('records')}
          />
        )}

        {activeTab === 'records' && (
          <DataTable
            form={activeForm}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={handleDeleteRecord}
            onDeleteAll={handleDeleteAllRecords}
            onGoToIntake={() => setActiveTab('intake')}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView form={activeForm} records={records} />
        )}

        {activeTab === 'builder' && (
          <FormBuilder
            form={activeForm}
            onSaveForm={handleSaveForm}
            onCreateNewForm={handleCreateNewForm}
            favoriteSections={favoriteSections}
            onSaveNewFavoriteSection={handleSaveNewFavoriteSection}
            onDeleteFavoriteSection={handleDeleteFavoriteSection}
          />
        )}

        {activeTab === 'export' && (
          <ExportView form={activeForm} records={records} />
        )}

        {activeTab === 'merge' && (
          <MergeView
            form={activeForm}
            currentRecords={records}
            onApplyMerge={handleApplyMerge}
            onGoToRecords={() => setActiveTab('records')}
          />
        )}
      </main>

      {/* Modal de Selector de Plantillas Clínicas */}
      <TemplateSelectorModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        activeTemplateId={activeForm.id}
      />

      {/* Modal de Gestión de Formularios */}
      <FormsManagerModal
        isOpen={isFormsManagerOpen}
        onClose={() => setIsFormsManagerOpen(false)}
        forms={forms}
        activeFormId={activeForm.id}
        onSelectForm={(id) => setActiveFormIdState(id)}
        onDuplicateForm={handleDuplicateForm}
        onDeleteForm={handleDeleteForm}
        onRestoreFromTrash={handleRestoreFromTrash}
        onImportBackup={handleImportBackup}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        onCreateNew={() => handleCreateNewForm('Nuevo Formulario', 'PAC-')}
        trashItems={trashItems}
      />

      {/* Modal de Sincronización con Proyectos MedStats */}
      <ProjectSyncModal
        isOpen={isProjectSyncOpen}
        onClose={() => setIsProjectSyncOpen(false)}
        form={activeForm}
        records={records}
        currentProjectId={linkedProjectId}
        onSyncComplete={(count) => {
          if (linkedProject) {
            setLinkedProject({ ...linkedProject, row_count: count });
          }
        }}
      />
    </div>
  );
}
