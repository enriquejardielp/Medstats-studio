import {
  PlusCircle, Database, FileSpreadsheet, GitMerge, FileText, FolderKanban,
  BarChart3, Layers, Plus, ChevronDown,
} from 'lucide-react';
import type { ClinicalForm } from '../types/clinical';

interface NavbarProps {
  activeTab: 'intake' | 'records' | 'analytics' | 'builder' | 'export' | 'merge';
  setActiveTab: (tab: 'intake' | 'records' | 'analytics' | 'builder' | 'export' | 'merge') => void;
  activeForm?: ClinicalForm;
  forms: ClinicalForm[];
  onSelectForm: (formId: string) => void;
  onOpenTemplatesModal: () => void;
  onOpenFormsManager: () => void;
  recordCount: number;
  onOpenProjectSync?: () => void;
  currentProjectName?: string;
  onCreateNewForm?: () => void;
}

const tabs = [
  { id: 'intake', label: 'Captura', icon: PlusCircle, description: 'Introducir un caso' },
  { id: 'records', label: 'Registros', icon: Database, description: 'Ver y editar casos' },
  { id: 'analytics', label: 'Analítica', icon: BarChart3, description: 'Calidad y estadísticas' },
  { id: 'builder', label: 'Diseño', icon: FileSpreadsheet, description: 'Editar el formulario' },
  { id: 'export', label: 'Exportar', icon: FileText, description: 'Exportar datos y variables' },
  { id: 'merge', label: 'Fusionar', icon: GitMerge, description: 'Importar y combinar datos' },
] as const;

export function Navbar(props: NavbarProps) {
  const { activeTab, setActiveTab, activeForm, forms, onSelectForm, onOpenTemplatesModal,
    onOpenFormsManager, recordCount, onOpenProjectSync, currentProjectName, onCreateNewForm } = props;

  return (
    <header className="ecrf-header">
      <div className="ecrf-header-main">
        <div className="ecrf-heading">
          <div className="ecrf-mark"><FileSpreadsheet size={19} /></div>
          <div className="ecrf-heading-copy">
            <div className="ecrf-kicker">Cuaderno de recogida de datos</div>
            <div className="ecrf-title-row">
              <h1>{activeForm?.title || 'Formulario eCRF'}</h1>
              {currentProjectName && <span className="ecrf-project"><Layers size={13} />{currentProjectName}</span>}
            </div>
            <div className="ecrf-summary">{recordCount} {recordCount === 1 ? 'caso registrado' : 'casos registrados'} · {activeForm?.fields.length || 0} variables</div>
          </div>
        </div>
        <div className="ecrf-controls">
          {forms.length > 1 && activeForm && <label className="ecrf-form-select">
            <span>Formulario</span>
            <select value={activeForm.id} onChange={(e) => onSelectForm(e.target.value)} className="ms-select" aria-label="Seleccionar formulario">
              {forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </label>}
          {onCreateNewForm && <button type="button" onClick={onCreateNewForm} className="ms-btn ms-btn-primary ecrf-new"><Plus size={16} />Nuevo formulario</button>}
          <details className="ecrf-more">
            <summary className="ms-btn ms-btn-secondary"><span>Opciones</span><ChevronDown size={14} /></summary>
            <div className="ecrf-more-menu">
              <button type="button" onClick={(e) => { onOpenFormsManager(); e.currentTarget.closest('details')?.removeAttribute('open'); }}><FolderKanban size={16} />Mis formularios <span>{forms.length}</span></button>
              <button type="button" onClick={(e) => { onOpenTemplatesModal(); e.currentTarget.closest('details')?.removeAttribute('open'); }}><FileText size={16} />Plantillas clínicas</button>
              {onOpenProjectSync && <button type="button" onClick={(e) => { onOpenProjectSync(); e.currentTarget.closest('details')?.removeAttribute('open'); }}><Database size={16} />Vincular proyecto</button>}
            </div>
          </details>
        </div>
      </div>
      <nav className="ecrf-tabs" aria-label="Secciones del eCRF">
        {tabs.map(({ id, label, icon: Icon, description }) => <button
          key={id} type="button" onClick={() => setActiveTab(id)} title={description}
          aria-current={activeTab === id ? 'page' : undefined}
          className={`ecrf-tab${activeTab === id ? ' is-active' : ''}`}>
          <Icon size={16} /><span>{label}</span>{id === 'records' && <span className="ecrf-tab-count">{recordCount}</span>}
        </button>)}
      </nav>
    </header>
  );
}
