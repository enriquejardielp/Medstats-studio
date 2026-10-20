import {
  PlusCircle,
  Database,
  FileSpreadsheet,
  GitMerge,
  FileText,
  FolderKanban,
  BarChart3,
  Layers,
  Plus,
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
  onCreateNewForm,
}: NavbarProps) {
  return (
    <div style={{
      background: 'var(--color-bg)',
      borderBottom: '1px solid var(--color-border)',
      padding: '1rem 1.75rem 0.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      width: '100%',
    }}>
      {/* Barra de título y acciones del eCRF */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <div className="ms-eyebrow">Cuaderno de Recogida de Datos</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.15rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.02em' }}>
                {activeForm?.title || 'Formulario eCRF'}
              </h1>
              {currentProjectName && (
                <span className="ms-badge" style={{ background: 'var(--color-bg-deep)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  <Layers size={13} style={{ color: 'var(--color-accent)' }} />
                  {currentProjectName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones de gestión y selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {forms.length > 1 && activeForm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label htmlFor="form-select" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Formulario:
              </label>
              <select
                id="form-select"
                value={activeForm.id}
                onChange={(e) => onSelectForm(e.target.value)}
                className="ms-select"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  padding: '0.4rem 0.75rem',
                  minHeight: '2rem',
                  maxWidth: '220px',
                }}
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenFormsManager}
            title="Gestionar mis formularios, duplicar y papelera"
            className="ms-btn ms-btn-sm"
          >
            <FolderKanban size={15} style={{ color: 'var(--color-text-secondary)' }} />
            <span>Mis Formularios</span>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-bg-deep)',
              color: 'var(--color-text-primary)',
              padding: '0.1rem 0.45rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
            }}>
              {forms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenTemplatesModal}
            title="Cargar o cambiar plantilla clínica predefinida"
            className="ms-btn ms-btn-sm"
          >
            <FileText size={15} style={{ color: 'var(--color-text-secondary)' }} />
            <span>Plantillas</span>
          </button>

          {onCreateNewForm && (
            <button
              type="button"
              onClick={onCreateNewForm}
              title="Crear un nuevo formulario desde cero"
              className="ms-btn ms-btn-sm ms-btn-primary"
            >
              <Plus size={15} />
              <span>Nuevo</span>
            </button>
          )}

          {onOpenProjectSync && (
            <button
              type="button"
              onClick={onOpenProjectSync}
              title="Sincronizar y volcar estos registros en un proyecto estadístico"
              className="ms-btn ms-btn-sm ms-btn-secondary"
            >
              <Database size={15} style={{ color: 'var(--color-accent)' }} />
              <span>Vincular Proyecto</span>
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de Navegación del Cuaderno eCRF */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('intake')}
          className="ms-btn ms-btn-sm"
          style={{
            background: activeTab === 'intake' ? 'var(--color-accent)' : 'var(--color-surface)',
            color: activeTab === 'intake' ? '#FFFFFF' : 'var(--color-text-primary)',
            borderColor: activeTab === 'intake' ? 'var(--color-accent)' : 'var(--color-border)',
            boxShadow: activeTab === 'intake' ? '0 2px 8px -1px rgba(235, 94, 40, 0.4)' : 'var(--shadow-xs)',
          }}
        >
          <PlusCircle size={15} />
          <span>Captura de Datos (Intake)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className="ms-btn ms-btn-sm"
          style={{
            background: activeTab === 'records' ? 'var(--color-accent)' : 'var(--color-surface)',
            color: activeTab === 'records' ? '#FFFFFF' : 'var(--color-text-primary)',
            borderColor: activeTab === 'records' ? 'var(--color-accent)' : 'var(--color-border)',
            boxShadow: activeTab === 'records' ? '0 2px 8px -1px rgba(235, 94, 40, 0.4)' : 'var(--shadow-xs)',
          }}
        >
          <Database size={15} />
          <span>Base de Datos</span>
          <span style={{
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            padding: '0.1rem 0.45rem',
            borderRadius: 'var(--radius-pill)',
            background: activeTab === 'records' ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-deep)',
            color: activeTab === 'records' ? '#FFFFFF' : 'var(--color-text-secondary)',
          }}>
            {recordCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className="ms-btn ms-btn-sm"
          style={{
            background: activeTab === 'analytics' ? 'var(--color-accent)' : 'var(--color-surface)',
            color: activeTab === 'analytics' ? '#FFFFFF' : 'var(--color-text-primary)',
            borderColor: activeTab === 'analytics' ? 'var(--color-accent)' : 'var(--color-border)',
            boxShadow: activeTab === 'analytics' ? '0 2px 8px -1px rgba(235, 94, 40, 0.4)' : 'var(--shadow-xs)',
          }}
        >
          <BarChart3 size={15} />
          <span>Analítica</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('builder')}
          className="ms-btn ms-btn-sm"
          style={{
            background: activeTab === 'builder' ? 'var(--color-accent)' : 'var(--color-surface)',
            color: activeTab === 'builder' ? '#FFFFFF' : 'var(--color-text-primary)',
            borderColor: activeTab === 'builder' ? 'var(--color-accent)' : 'var(--color-border)',
            boxShadow: activeTab === 'builder' ? '0 2px 8px -1px rgba(235, 94, 40, 0.4)' : 'var(--shadow-xs)',
          }}
        >
          <FileSpreadsheet size={15} />
          <span>Diseñador</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className="ms-btn ms-btn-sm"
          style={{
            background: activeTab === 'export' ? 'var(--color-accent)' : 'var(--color-surface)',
            color: activeTab === 'export' ? '#FFFFFF' : 'var(--color-text-primary)',
            borderColor: activeTab === 'export' ? 'var(--color-accent)' : 'var(--color-border)',
            boxShadow: activeTab === 'export' ? '0 2px 8px -1px rgba(235, 94, 40, 0.4)' : 'var(--shadow-xs)',
          }}
        >
          <FileText size={15} />
          <span>Exportar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('merge')}
          className="ms-btn ms-btn-sm"
          style={{
            background: activeTab === 'merge' ? 'var(--color-accent)' : 'var(--color-surface)',
            color: activeTab === 'merge' ? '#FFFFFF' : 'var(--color-text-primary)',
            borderColor: activeTab === 'merge' ? 'var(--color-accent)' : 'var(--color-border)',
            boxShadow: activeTab === 'merge' ? '0 2px 8px -1px rgba(235, 94, 40, 0.4)' : 'var(--shadow-xs)',
          }}
        >
          <GitMerge size={15} />
          <span>Fusión de Datos</span>
        </button>
      </div>
    </div>
  );
}
