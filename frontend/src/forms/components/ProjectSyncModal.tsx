import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  ArrowRight,
  FolderOpen,
  FileSpreadsheet,
} from 'lucide-react';
import type { ClinicalForm, RecordEntry } from '../types/clinical';
import {
  createProjectFromForm,
  syncFormRecordsToProject,
  recordsToProjectData,
} from '../utils/projectIntegration';
import apiClient from '../../api/client';
import { useNavigate } from 'react-router-dom';

interface ProjectSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: ClinicalForm;
  records: RecordEntry[];
  currentProjectId?: number;
  onSyncComplete?: (updatedCount: number) => void;
}

interface ProjectSummary {
  id: number;
  name: string;
  filename: string;
  row_count: number;
  created_at: string;
}

export const ProjectSyncModal: React.FC<ProjectSyncModalProps> = ({
  isOpen,
  onClose,
  form,
  records,
  currentProjectId,
  onSyncComplete,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'existing' | 'new'>(currentProjectId ? 'existing' : 'new');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    currentProjectId || null
  );
  const [newProjectName, setNewProjectName] = useState(form.title);
  const [newProjectDesc, setNewProjectDesc] = useState(form.description);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    projectId: number;
    projectName: string;
    rowCount: number;
  } | null>(null);

  // Cargar proyectos existentes del usuario
  useEffect(() => {
    if (isOpen) {
      setLoadingProjects(true);
      setErrorMsg(null);
      setSuccessInfo(null);
      apiClient
        .get('/api/projects')
        .then((res) => {
          setProjects(res.data || []);
          if (!selectedProjectId && res.data && res.data.length > 0) {
            setSelectedProjectId(res.data[0].id);
          }
        })
        .catch((err) => {
          console.error('Error cargando proyectos:', err);
          setErrorMsg('No se pudieron cargar los proyectos existentes.');
        })
        .finally(() => {
          setLoadingProjects(false);
        });
    }
  }, [isOpen, selectedProjectId]);

  if (!isOpen) return null;

  const { columns } = recordsToProjectData(form, records);

  const handleSyncToExisting = async () => {
    if (!selectedProjectId) {
      setErrorMsg('Selecciona un proyecto de destino.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const selectedProj = projects.find((p) => p.id === selectedProjectId);
      const res = await syncFormRecordsToProject(selectedProjectId, form, records);
      setSuccessInfo({
        projectId: selectedProjectId,
        projectName: selectedProj?.name || `Proyecto #${selectedProjectId}`,
        rowCount: res.rowCount,
      });
      if (onSyncComplete) onSyncComplete(res.rowCount);
    } catch (err: any) {
      console.error('Error sincronizando con proyecto:', err);
      setErrorMsg(
        err.response?.data?.detail ||
          err.message ||
          'Error al sincronizar los registros con el proyecto.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewProject = async () => {
    if (!newProjectName.trim()) {
      setErrorMsg('Debes especificar un nombre para el nuevo proyecto.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const created = await createProjectFromForm(form, records, newProjectName.trim());
      setSuccessInfo({
        projectId: created.id,
        projectName: created.name,
        rowCount: created.row_count,
      });
      if (onSyncComplete) onSyncComplete(created.row_count);
    } catch (err: any) {
      console.error('Error creando proyecto:', err);
      setErrorMsg(
        err.response?.data?.detail || err.message || 'Error al crear el nuevo proyecto.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Integrar con Proyectos MedStats
              </h3>
              <p className="text-xs text-slate-500">
                Guarda los {records.length} registros del formulario en tu base de datos de proyectos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {successInfo ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">
                    ¡Registros Sincronizados con Éxito!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                    Se han guardado <strong>{successInfo.rowCount} casos</strong> con{' '}
                    <strong>{columns.length} variables</strong> en el proyecto{' '}
                    <strong>"{successInfo.projectName}"</strong>. Ya puedes realizar análisis estadísticos (t-test, ANOVA, regresión, curvas ROC) sobre estos datos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/projects/${successInfo.projectId}`);
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Abrir Proyecto en MedStats Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 bg-white border border-emerald-300 text-emerald-800 font-semibold text-xs rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Resumen del dataset a volcar */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-medium">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Formulario activo: <strong>{form.title}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                    {records.length} casos
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                    {columns.length} variables
                  </span>
                </div>
              </div>

              {/* Selector de modo */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  onClick={() => setMode('new')}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'new'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Crear Nuevo Proyecto</span>
                </button>
                <button
                  onClick={() => setMode('existing')}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'existing'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Actualizar Proyecto Existente</span>
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Configuración según modo */}
              {mode === 'new' ? (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre del Nuevo Proyecto *
                    </label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="p. ej., Estudio Clínico Hipertensión 2026"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Descripción del Estudio (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="Breve resumen del protocolo o cohorte..."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Selecciona el Proyecto de Destino *
                    </label>
                    {loadingProjects ? (
                      <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Cargando proyectos de tu cuenta...</span>
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        No tienes proyectos previos en tu cuenta. Selecciona la pestaña "Crear Nuevo Proyecto".
                      </div>
                    ) : (
                      <select
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                        className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                      >
                        {projects.map((proj) => (
                          <option key={proj.id} value={proj.id}>
                            #{proj.id} - {proj.name} ({proj.row_count} casos actuales)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    💡 Al sincronizar, el dataset del proyecto se actualizará con los registros vigentes de este formulario, manteniendo listos los tipos estadísticos para análisis inmediato.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pie de acciones */}
        {!successInfo && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={mode === 'new' ? handleCreateNewProject : handleSyncToExisting}
              disabled={isSubmitting || records.length === 0}
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando en Proyecto...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>
                    {mode === 'new' ? 'Crear Proyecto y Cargar Datos' : 'Sincronizar Proyecto'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
