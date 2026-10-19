import {
  Activity,
  PlusCircle,
  Database,
  FileSpreadsheet,
  GitMerge,
  FileText,
  FolderKanban,
  BarChart3,
  Layers,
} from 'lucide-react';
import type { ClinicalForm } from '../types/clinical';

interface NavbarProps {
  activeTab: 'intake' | 'records' | 'analytics' | 'builder' | 'export' | 'merge';
  setActiveTab: (tab: 'intake' | 'records' | 'analytics' | 'builder' | 'export' | 'merge') => void;
  activeForm: ClinicalForm;
  forms: ClinicalForm[];
  onSelectForm: (formId: string) => void;
  onOpenTemplatesModal: () => void;
  onOpenFormsManager: () => void;
  recordCount: number;
  onOpenProjectSync?: () => void;
  currentProjectName?: string;
}

export function Navbar({
  activeTab,
  setActiveTab,
  activeForm,
  forms,
  onSelectForm,
  onOpenTemplatesModal,
  onOpenFormsManager,
  recordCount,
  onOpenProjectSync,
  currentProjectName,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      {/* Top utility row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-lg tracking-tight">
                  MedStats <span className="text-teal-600 font-bold">eCRF</span>
                </span>
                <span className="text-xs text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Clinical Forms
                </span>
                {currentProjectName && (
                  <span className="text-xs text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 hidden md:inline-flex items-center gap-1">
                    <Layers className="w-3 h-3 text-blue-600" />
                    {currentProjectName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Cuaderno de recogida de datos clínicos, validación de variables e integración con proyectos
              </p>
            </div>
          </div>

          {/* Active Form Switcher and Management Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-end sm:items-start">
              <label htmlFor="form-select" className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Formulario Activo
              </label>
              <select
                id="form-select"
                value={activeForm.id}
                onChange={(e) => onSelectForm(e.target.value)}
                className="text-sm font-medium text-slate-900 bg-slate-50 border border-slate-300 rounded-md py-1 px-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-hidden hover:bg-slate-100 transition-colors max-w-[170px] sm:max-w-xs truncate"
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenFormsManager}
              title="Gestionar mis formularios, duplicar, copias de seguridad y papelera"
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-teal-900 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5 text-teal-700" />
              <span className="hidden md:inline">Mis Formularios</span>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                {forms.length}
              </span>
            </button>

            <button
              onClick={onOpenTemplatesModal}
              title="Cargar o cambiar plantilla clínica predefinida"
              className="px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Plantillas</span>
            </button>

            {onOpenProjectSync && (
              <button
                onClick={onOpenProjectSync}
                title="Sincronizar y volcar estos registros en un proyecto estadístico de MedStats"
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Integrar con Proyecto</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Segmented clinical controls) */}
        <div className="flex items-center gap-1 border-t border-slate-100 py-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('intake')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'intake'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Rellenar Caso (Intake Rápido)</span>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'records'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Base de Datos</span>
            <span
              className={`text-xs ml-1 px-1.5 py-0.2 rounded-sm ${
                activeTab === 'records' ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {recordCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Estadísticas / Calidad</span>
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'builder'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Diseñar Formulario</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'export'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel / CSV</span>
          </button>

          <button
            onClick={() => setActiveTab('merge')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'merge'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GitMerge className="w-4 h-4" />
            <span>Fusionar Datos (Merger)</span>
          </button>
        </div>
      </div>
    </header>
  );
}
