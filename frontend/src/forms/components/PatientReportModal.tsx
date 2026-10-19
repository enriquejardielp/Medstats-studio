import { Printer, X, FileText } from 'lucide-react';
import type { ClinicalForm, RecordEntry } from '../types/clinical';
import { checkClinicalAlert } from '../utils/calculator';

interface PatientReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: ClinicalForm;
  record: RecordEntry | null;
}

export function PatientReportModal({
  isOpen,
  onClose,
  form,
  record,
}: PatientReportModalProps) {
  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Action Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" />
            <h3 className="font-bold text-slate-900 text-sm">
              Ficha Clínica Individual: <span className="font-mono text-teal-800">{record.recordCode}</span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ficha (PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Case Report Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-8 bg-white print:overflow-visible">
          {/* Clinical Report Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Informe Clínico / Registro de Investigación
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {form.title}
              </h2>
              <p className="text-xs text-slate-500 mt-1">{form.description}</p>
            </div>

            <div className="text-right sm:text-right shrink-0 bg-slate-50 p-3 rounded border border-slate-200">
              <div className="text-xs text-slate-500">ID del Paciente / Sujeto</div>
              <div className="font-mono text-lg font-black text-slate-900">{record.recordCode}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {record.timestamp
                  ? new Date(record.timestamp).toLocaleString('es-ES', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Fecha no registrada'}
              </div>
              {record.author && (
                <div className="text-[11px] font-medium text-slate-700 mt-0.5">
                  Facultativo: {record.author}
                </div>
              )}
            </div>
          </div>

          {/* Grouped Clinical Sections */}
          {form.sections.map((sectionTitle) => {
            const fieldsInSec = form.fields.filter(
              (f) => (f.section || form.sections[0]) === sectionTitle
            );
            if (fieldsInSec.length === 0) return null;

            return (
              <div key={sectionTitle} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    {sectionTitle}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {fieldsInSec.map((field) => {
                    const rawVal = record.data[field.name];
                    const alertMsg = checkClinicalAlert(field, rawVal);

                    let display = 'No registrado';
                    if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                      if (Array.isArray(rawVal)) display = rawVal.join(', ');
                      else if (typeof rawVal === 'boolean') display = rawVal ? 'Sí' : 'No';
                      else display = String(rawVal);
                    }

                    return (
                      <div
                        key={field.id}
                        className={`p-2.5 rounded border text-xs ${
                          alertMsg
                            ? 'bg-amber-50/50 border-amber-300'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-medium text-slate-500 truncate">
                          {field.label}
                        </div>
                        <div className="text-sm font-bold font-mono text-slate-900 mt-0.5 flex items-baseline gap-1">
                          <span>{display}</span>
                          {field.unit && rawVal !== undefined && rawVal !== '' && (
                            <span className="text-xs font-normal text-slate-500">{field.unit}</span>
                          )}
                        </div>
                        {alertMsg && (
                          <div className="text-[10px] text-amber-800 font-semibold mt-1">
                            ⚠️ {alertMsg}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Report Footer / Signature */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p>Documento generado electrónicamente por CliniForm.</p>
              <p className="text-[10px]">Confidencial - Uso exclusivo clínico e investigador.</p>
            </div>
            <div className="text-center w-48 border-t border-slate-300 pt-2">
              <p className="text-[11px] font-medium text-slate-700">Firma del Facultativo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
