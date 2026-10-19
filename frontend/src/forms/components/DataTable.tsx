import { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  Edit3,
  FileSpreadsheet,
  Download,
  Plus,
  X,
  Save,
  FileText,
} from 'lucide-react';
import type { ClinicalForm, RecordEntry } from '../types/clinical';
import { exportToExcel, exportToCSV } from '../utils/exporter';
import { PatientReportModal } from './PatientReportModal';

interface DataTableProps {
  form: ClinicalForm;
  records: RecordEntry[];
  onUpdateRecord: (updated: RecordEntry) => void;
  onDeleteRecord: (id: string) => void;
  onDeleteAll: () => void;
  onGoToIntake: () => void;
}

export function DataTable({
  form,
  records,
  onUpdateRecord,
  onDeleteRecord,
  onDeleteAll,
  onGoToIntake,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState<RecordEntry | null>(null);
  const [selectedRecordForReport, setSelectedRecordForReport] = useState<RecordEntry | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [editCode, setEditCode] = useState('');

  // Filtering records
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();

    return records.filter((rec) => {
      if (rec.recordCode.toLowerCase().includes(term)) return true;
      if (rec.author && rec.author.toLowerCase().includes(term)) return true;

      // search inside data values
      for (const val of Object.values(rec.data)) {
        if (val !== undefined && val !== null && String(val).toLowerCase().includes(term)) {
          return true;
        }
      }
      return false;
    });
  }, [records, searchTerm]);

  const handleOpenEdit = (rec: RecordEntry) => {
    setSelectedRecordForEdit(rec);
    setEditCode(rec.recordCode);
    setEditData({ ...rec.data });
  };

  const handleSaveEdit = () => {
    if (!selectedRecordForEdit) return;
    const updated: RecordEntry = {
      ...selectedRecordForEdit,
      recordCode: editCode.trim() || selectedRecordForEdit.recordCode,
      data: editData,
    };
    onUpdateRecord(updated);
    setSelectedRecordForEdit(null);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Base de Datos de Casos</h1>
            <span className="text-xs text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded">
              {filteredRecords.length} de {records.length} registros
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Vista tabular de todos los datos clínicos recolectados para: <span className="font-medium text-slate-800">{form.title}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onGoToIntake}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-medium hover:bg-teal-700 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Caso</span>
          </button>

          <button
            onClick={() => exportToExcel(form, records)}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-md text-xs font-medium hover:bg-emerald-800 transition-colors shadow-xs disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Descargar Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => exportToCSV(form, records, { csvDelimiter: ';' })}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-md text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV (;)</span>
          </button>

          {records.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('¿Seguro que deseas vaciar todos los registros de este formulario?')) {
                  onDeleteAll();
                }
              }}
              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
              title="Vaciar tabla"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ID de paciente, síntoma, valor..."
            className="w-full text-xs sm:text-sm pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />
        </div>

        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="mt-4 bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">No se encontraron registros en esta base de datos.</p>
            <button
              onClick={onGoToIntake}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-md hover:bg-teal-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar primer caso</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="py-2.5 px-3 font-mono">ID Registro</th>
                  <th className="py-2.5 px-3">Fecha Captura</th>
                  {form.fields.map((f) => (
                    <th key={f.id} className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{f.label}</span>
                        <span className="text-[10px] text-slate-600 font-mono font-normal">
                          {f.name} {f.unit ? `(${f.unit})` : ''}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {rec.recordCode}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {rec.timestamp ? new Date(rec.timestamp).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '-'}
                    </td>
                    {form.fields.map((f) => {
                      const val = rec.data[f.name];
                      let display = '-';
                      if (val !== undefined && val !== null && val !== '') {
                        if (Array.isArray(val)) {
                          display = val.join(', ');
                        } else if (typeof val === 'boolean') {
                          display = val ? 'Sí' : 'No';
                        } else {
                          display = String(val);
                        }
                      }

                      return (
                        <td key={f.id} className="py-2.5 px-3 whitespace-nowrap">
                          {f.type === 'calculated' ? (
                            <span className="font-mono font-semibold text-teal-800">{display}</span>
                          ) : (
                            <span>{display}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedRecordForReport(rec)}
                          className="p-1 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded cursor-pointer"
                          title="Ver e imprimir ficha clínica del paciente"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded cursor-pointer"
                          title="Editar caso"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Eliminar el registro ${rec.recordCode}?`)) {
                              onDeleteRecord(rec.id);
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Edit Record Modal */}
      {selectedRecordForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Editar Caso: <span className="font-mono text-teal-700">{editCode}</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecordForEdit(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código de Registro</label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full text-xs font-mono font-medium border border-slate-300 rounded-md py-1.5 px-2.5 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form.fields.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      {f.label} {f.unit ? `(${f.unit})` : ''}
                    </label>
                    {f.type === 'number' ? (
                      <input
                        type="number"
                        value={editData[f.name] ?? ''}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            [f.name]: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                        className="w-full text-xs border border-slate-300 rounded-md py-1 px-2.5 focus:ring-2 focus:ring-teal-500"
                      />
                    ) : f.type === 'select' ? (
                      <select
                        value={editData[f.name] ?? ''}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, [f.name]: e.target.value }))
                        }
                        className="w-full text-xs border border-slate-300 rounded-md py-1 px-2.5"
                      >
                        <option value="">-- Seleccionar --</option>
                        {f.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'boolean' ? (
                      <select
                        value={editData[f.name] === true ? 'true' : editData[f.name] === false ? 'false' : ''}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            [f.name]: e.target.value === '' ? '' : e.target.value === 'true',
                          }))
                        }
                        className="w-full text-xs border border-slate-300 rounded-md py-1 px-2.5"
                      >
                        <option value="">-- No especificado --</option>
                        <option value="true">Sí / Positivo</option>
                        <option value="false">No / Negativo</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editData[f.name] ?? ''}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, [f.name]: e.target.value }))
                        }
                        className="w-full text-xs border border-slate-300 rounded-md py-1 px-2.5"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedRecordForEdit(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-md hover:bg-teal-700 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Individual Clinical Case Report Modal */}
      <PatientReportModal
        isOpen={!!selectedRecordForReport}
        onClose={() => setSelectedRecordForReport(null)}
        form={form}
        record={selectedRecordForReport}
      />
    </div>
  );
}
