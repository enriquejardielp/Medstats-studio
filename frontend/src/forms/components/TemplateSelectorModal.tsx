import { X, Check, Activity, Heart, ShieldAlert, FileText } from 'lucide-react';
import type { ClinicalForm } from '../types/clinical';
import { CLINICAL_TEMPLATES } from '../data/templates';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ClinicalForm) => void;
  activeTemplateId?: string;
}

export function TemplateSelectorModal({
  isOpen,
  onClose,
  onSelectTemplate,
  activeTemplateId,
}: TemplateSelectorModalProps) {
  if (!isOpen) return null;

  const getTemplateIcon = (cat: string) => {
    switch (cat) {
      case 'urgencias':
        return <Activity className="w-5 h-5 text-rose-600" />;
      case 'investigacion':
        return <Heart className="w-5 h-5 text-teal-600" />;
      case 'enfermeria':
        return <ShieldAlert className="w-5 h-5 text-indigo-600" />;
      default:
        return <FileText className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Plantillas Clínicas Preconfiguradas</h3>
            <p className="text-xs text-slate-500">
              Formularios estandarizados para ciencias de la salud listos para recolectar datos y exportar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {CLINICAL_TEMPLATES.map((tmpl) => {
            const isCurrent = tmpl.id === activeTemplateId;
            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  onSelectTemplate(tmpl);
                  onClose();
                }}
                className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isCurrent
                    ? 'border-teal-600 bg-teal-50/40 ring-1 ring-teal-600'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-md border border-slate-200 shadow-2xs mt-0.5">
                    {getTemplateIcon(tmpl.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{tmpl.title}</h4>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {tmpl.codePrefix}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{tmpl.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                      <span>{tmpl.fields.length} variables</span>
                      <span>·</span>
                      <span>{tmpl.sections.length} secciones clínicas</span>
                      <span>·</span>
                      <span className="text-teal-700 font-medium">
                        Cálculos:{' '}
                        {tmpl.fields
                          .filter((f) => f.type === 'calculated')
                          .map((f) => f.label)
                          .join(', ') || 'Ninguno'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-1">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-100/70 px-2.5 py-1 rounded">
                      <Check className="w-3.5 h-3.5" />
                      Activo
                    </span>
                  ) : (
                    <button className="text-xs font-medium text-slate-700 bg-white border border-slate-300 px-3 py-1 rounded hover:bg-slate-100">
                      Cargar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
