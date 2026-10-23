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
import { Sparkles, ArrowLeft, Database, Check, ClipboardList, Plus, FileText, FolderKanban } from 'lucide-react';
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
  const [showHelperBanner, setShowHelperBanner] = useState(true);
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
    if (forms.length === 0) return null;
    return forms.find((f) => f.id === activeFormId) || forms[0] || null;
  }, [forms, activeFormId]);

  // Registros del formulario activo
  const [records, setRecords] = useState<RecordEntry[]>(() => {
    const initialForm = forms.find((f) => f.id === activeFormId) || forms[0];
    return initialForm ? getRecordsForForm(initialForm) : [];
  });

  // Al cambiar formulario activo, recargar sus registros
  useEffect(() => {
    if (activeForm) {
      const recs = getRecordsForForm(activeForm);
      setRecords(recs);
      setActiveFormId(activeForm.id);
    } else {
      setRecords([]);
    }
  }, [activeForm]);

  // Guardar nuevo registro
  const handleSaveRecord = (newEntry: RecordEntry, _andNext: boolean) => {
    if (!activeForm) return;
    const updated = [...records, newEntry];
    setRecords(updated);
    saveRecordsForForm(activeForm.id, updated);
  };

  // Actualizar registro existente
  const handleUpdateRecord = (updatedRec: RecordEntry) => {
    if (!activeForm) return;
    const updated = records.map((r) => (r.id === updatedRec.id ? updatedRec : r));
    setRecords(updated);
    saveRecordsForForm(activeForm.id, updated);
  };

  // Eliminar un registro
  const handleDeleteRecord = (id: string) => {
    if (!activeForm) return;
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    saveRecordsForForm(activeForm.id, updated);
  };

  // Eliminar todos los registros
  const handleDeleteAllRecords = () => {
    if (!activeForm) return;
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
  const handleCreateNewForm = (title: string = 'Nuevo Formulario', prefix: string = 'PAC-') => {
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
    if (!activeForm) return;
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
      setActiveFormIdState('');
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
    if (!linkedProjectId || !activeForm) return;
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100%', background: 'var(--color-bg)' }}>
      {/* Barra de Proyecto Vinculado */}
      {linkedProject && (
        <div style={{
          background: 'var(--color-bg-deep)',
          color: 'var(--color-ink)',
          fontSize: '0.8125rem',
          padding: '0.6rem 1.75rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => navigate(`/projects/${linkedProject.id}`)}
              className="ms-btn ms-btn-sm ms-btn-secondary"
            >
              <ArrowLeft size={14} />
              <span>Volver a {linkedProject.name}</span>
            </button>
            <span style={{ color: 'var(--color-text-secondary)', display: 'none' }} className="sm:inline">
              Estás editando el Cuaderno de Recogida de Datos (eCRF) vinculado al proyecto.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleQuickSyncWithProject}
              disabled={isQuickSyncing}
              className="ms-btn ms-btn-sm ms-btn-primary"
            >
              {quickSyncSuccess ? (
                <>
                  <Check size={14} />
                  <span>¡Datos Sincronizados!</span>
                </>
              ) : (
                <>
                  <Database size={14} />
                  <span>{isQuickSyncing ? 'Guardando...' : 'Guardar en Proyecto'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO INICIAL LIMPIO: Si no hay formularios creados */}
      {forms.length === 0 || !activeForm ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
          <div className="ms-card slide-up" style={{ maxWidth: '580px', width: '100%', padding: '3.25rem 2.25rem', textAlign: 'center' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              background: 'var(--color-accent-soft)',
              border: '1px solid rgba(235, 94, 40, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: 'var(--color-accent-strong)',
            }}>
              <ClipboardList size={30} />
            </div>

            <div className="ms-eyebrow" style={{ marginBottom: '0.4rem' }}>Cuaderno eCRF</div>
            <h2 className="ms-page-title" style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
              Sin formularios clínicos activos
            </h2>

            <p style={{
              color: 'var(--color-text-secondary)',
              fontSize: '0.9375rem',
              lineHeight: 1.6,
              maxWidth: '440px',
              margin: '0 auto 2.25rem',
            }}>
              Crea un cuaderno eCRF con validaciones en tiempo real para tu estudio, o carga una plantilla clínica preconfigurada lista para recolectar datos.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleCreateNewForm('Nuevo Formulario Clínico', 'PAC-')}
                className="ms-btn ms-btn-primary ms-btn-lg"
                style={{ width: '100%', maxWidth: '340px' }}
              >
                <Plus size={18} />
                <span>Crear nuevo formulario</span>
              </button>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsTemplatesModalOpen(true)}
                  className="ms-btn ms-btn-secondary ms-btn-sm"
                >
                  <FileText size={15} />
                  <span>Cargar plantilla clínica</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFormsManagerOpen(true)}
                  className="ms-btn ms-btn-ghost ms-btn-sm"
                >
                  <FolderKanban size={15} />
                  <span>Gestionar / Importar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Navegación Principal eCRF Integrada */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeForm={activeForm}
            forms={forms}
            onSelectForm={(id) => setActiveFormIdState(id)}
            onOpenTemplatesModal={() => setIsTemplatesModalOpen(true)}
            onOpenFormsManager={() => setIsFormsManagerOpen(true)}
            recordCount={records.length}
            onOpenProjectSync={linkedProject ? () => setIsProjectSyncOpen(true) : undefined}
            currentProjectName={linkedProject?.name}
            onCreateNewForm={() => handleCreateNewForm('Nuevo Formulario', 'PAC-')}
          />

          {/* Banner de Productividad Clínica Descartable */}
          {showHelperBanner && activeTab === 'intake' && (
            <div style={{
              background: 'var(--color-bg-subtle, #F7F4EB)',
              borderBottom: '1px solid var(--color-border)',
              padding: '0.65rem 1.75rem',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
            }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                  <span>
                    <strong style={{ color: 'var(--color-text-primary)' }}>Captura Clínica Eficiente:</strong> Rellena caso por caso con validación en tiempo real y cálculo automático. Presiona{' '}
                    <kbd style={{
                      padding: '0.15rem 0.4rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-primary)',
                    }}>
                      Ctrl + Enter
                    </kbd>{' '}
                    para guardar el caso y avanzar.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelperBanner(false)}
                  className="ms-btn ms-btn-ghost ms-btn-sm"
                  style={{ padding: '0.2rem 0.5rem', minHeight: 'unset', color: 'var(--color-text-secondary)' }}
                  title="Cerrar aviso"
                  aria-label="Cerrar aviso de captura clínica"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Vistas Principales del eCRF */}
          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
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
          </div>
        </>
      )}

      {/* Modal de Selector de Plantillas Clínicas */}
      <TemplateSelectorModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        activeTemplateId={activeForm?.id}
      />

      {/* Modal de Gestión de Formularios */}
      <FormsManagerModal
        isOpen={isFormsManagerOpen}
        onClose={() => setIsFormsManagerOpen(false)}
        forms={forms}
        activeFormId={activeForm?.id || ''}
        onSelectForm={(id) => setActiveFormIdState(id)}
        onDuplicateForm={handleDuplicateForm}
        onDeleteForm={handleDeleteForm}
        onRestoreFromTrash={handleRestoreFromTrash}
        onImportBackup={handleImportBackup}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        onCreateNew={() => handleCreateNewForm('Nuevo Formulario Clínico', 'PAC-')}
        trashItems={trashItems}
      />

      {/* Modal de Sincronización con Proyectos MedStats */}
      {activeForm && (
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
      )}
    </div>
  );
}
