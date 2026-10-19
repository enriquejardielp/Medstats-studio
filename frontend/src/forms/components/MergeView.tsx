import { useState, useRef } from 'react';
import {
  GitMerge,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  RotateCcw,
} from 'lucide-react';
import type { ClinicalForm, RecordEntry, MergeReport } from '../types/clinical';
import {
  parseClinicalFile,
  type ParsedFileResult,
  mergeDatasets,
  type MergeStrategy,
  normalizeColumnKey,
} from '../utils/merger';

interface MergeViewProps {
  form: ClinicalForm;
  currentRecords: RecordEntry[];
  onApplyMerge: (merged: RecordEntry[], newFields?: string[]) => void;
  onGoToRecords: () => void;
}

export function MergeView({
  form,
  currentRecords,
  onApplyMerge,
  onGoToRecords,
}: MergeViewProps) {
  const [parsedFile, setParsedFile] = useState<ParsedFileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<MergeStrategy>('upsert');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mergeReport, setMergeReport] = useState<MergeReport | null>(null);
  const [addUnmatchedAsFormFields, setAddUnmatchedAsFormFields] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setMergeReport(null);

    try {
      const result = await parseClinicalFile(file);
      if (result.rows.length === 0) {
        throw new Error('El archivo no contiene filas de datos.');
      }

      setParsedFile(result);

      // Auto-match incoming headers to form fields
      const autoMap: Record<string, string> = {};
      const formFieldNames = form.fields.map((f) => f.name);

      result.headers.forEach((header) => {
        const norm = normalizeColumnKey(header);
        // Direct match
        if (formFieldNames.includes(norm)) {
          autoMap[header] = norm;
          return;
        }

        // Fuzzy match: check if form field label or name is contained
        const found = form.fields.find(
          (f) =>
            norm.includes(f.name) ||
            f.name.includes(norm) ||
            normalizeColumnKey(f.label) === norm
        );
        if (found) {
          autoMap[header] = found.name;
        } else {
          autoMap[header] = norm;
        }
      });

      setColumnMapping(autoMap);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al procesar el archivo. Comprueba que sea un Excel (.xlsx) o CSV válido.');
      setParsedFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteMerge = () => {
    if (!parsedFile) return;

    try {
      const { mergedRecords, report, newFormFields } = mergeDatasets(
        currentRecords,
        parsedFile.rows,
        form,
        strategy,
        columnMapping
      );

      onApplyMerge(mergedRecords, addUnmatchedAsFormFields ? newFormFields : undefined);
      setMergeReport(report);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error durante la fusión de datos.');
    }
  };

  const resetMerge = () => {
    setParsedFile(null);
    setMergeReport(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fusión e Integración de Bases de Datos</h1>
            <span className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono">
              Dataset Merger
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Combina bases de datos procedentes de diferentes turnos médicos, enfermeros o centros de estudio en una sola base centralizada.
          </p>
        </div>

        {parsedFile && (
          <button
            onClick={resetMerge}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Cargar otro archivo</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Report Banner */}
      {mergeReport && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <h3 className="font-bold text-emerald-950 text-sm">
                ¡Fusión completada con éxito!
              </h3>
            </div>
            <button
              onClick={onGoToRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded text-xs font-semibold hover:bg-emerald-800"
            >
              <span>Ver Base de Datos Actualizada</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="bg-white p-2.5 rounded border border-emerald-200">
              <div className="text-slate-500">Filas analizadas:</div>
              <div className="font-mono font-bold text-slate-900 text-sm">{mergeReport.totalIncoming}</div>
            </div>
            <div className="bg-white p-2.5 rounded border border-emerald-200">
              <div className="text-emerald-700 font-medium">Nuevos casos añadidos:</div>
              <div className="font-mono font-bold text-emerald-800 text-sm">+{mergeReport.addedCount}</div>
            </div>
            <div className="bg-white p-2.5 rounded border border-emerald-200">
              <div className="text-indigo-700 font-medium">Casos actualizados (ID existente):</div>
              <div className="font-mono font-bold text-indigo-800 text-sm">{mergeReport.updatedCount}</div>
            </div>
            <div className="bg-white p-2.5 rounded border border-emerald-200">
              <div className="text-slate-500">Duplicados omitidos:</div>
              <div className="font-mono font-bold text-slate-700 text-sm">{mergeReport.skippedCount}</div>
            </div>
          </div>

          {mergeReport.newColumns.length > 0 && (
            <p className="text-xs text-emerald-800">
              Se detectaron {mergeReport.newColumns.length} variables adicionales en el archivo importado:{' '}
              <span className="font-mono">{mergeReport.newColumns.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      {/* Upload Zone (if no file loaded yet) */}
      {!parsedFile ? (
        <div className="bg-white border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg p-10 text-center transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
            id="merge-file-input"
          />

          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Selecciona o arrastra el archivo Excel (.xlsx) o CSV
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Compatible con archivos generados por CliniForm, exportaciones de AG Grid o cualquier hoja de cálculo clínica.
              </p>
            </div>

            <label
              htmlFor="merge-file-input"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Explorar Archivos (.xlsx, .csv)</span>
            </label>

            {loading && <p className="text-xs text-teal-600 animate-pulse">Analizando estructura del archivo...</p>}
          </div>
        </div>
      ) : (
        /* File Loaded: Configuration & Column Mapping */
        <div className="space-y-6">
          {/* File Card Info */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{parsedFile.fileName}</div>
                <div className="text-[11px] text-slate-500">
                  {parsedFile.totalRows} filas detectadas · {parsedFile.headers.length} columnas
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 flex items-center gap-2">
              <span>Base actual:</span>
              <span className="font-mono font-bold text-slate-900">{currentRecords.length} registros</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strategy Selection */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5 text-teal-600" />
                1. Regla de Resolución de Duplicados
              </h3>

              <div className="space-y-2 text-xs">
                <label
                  onClick={() => setStrategy('upsert')}
                  className={`flex items-start gap-2.5 p-3 rounded border cursor-pointer ${
                    strategy === 'upsert'
                      ? 'border-teal-600 bg-teal-50/50 text-teal-950 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'upsert'}
                    onChange={() => setStrategy('upsert')}
                    className="mt-0.5 text-teal-600"
                  />
                  <div>
                    <div className="font-bold">Actualizar e integrar (Upsert / Recomendado)</div>
                    <div className="text-[11px] text-slate-500">
                      Si el ID de paciente ya existe, actualiza sus campos con los valores del nuevo archivo. Si no existe, añade el caso.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setStrategy('add_new_only')}
                  className={`flex items-start gap-2.5 p-3 rounded border cursor-pointer ${
                    strategy === 'add_new_only'
                      ? 'border-teal-600 bg-teal-50/50 text-teal-950 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'add_new_only'}
                    onChange={() => setStrategy('add_new_only')}
                    className="mt-0.5 text-teal-600"
                  />
                  <div>
                    <div className="font-bold">Omitir duplicados (Solo IDs nuevos)</div>
                    <div className="text-[11px] text-slate-500">
                      Conserva la versión existente en la base y solo añade los pacientes que no existan previamente.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setStrategy('append_with_new_id')}
                  className={`flex items-start gap-2.5 p-3 rounded border cursor-pointer ${
                    strategy === 'append_with_new_id'
                      ? 'border-teal-600 bg-teal-50/50 text-teal-950 font-medium'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'append_with_new_id'}
                    onChange={() => setStrategy('append_with_new_id')}
                    className="mt-0.5 text-teal-600"
                  />
                  <div>
                    <div className="font-bold">Añadir todos con sufijo de copia</div>
                    <div className="text-[11px] text-slate-500">
                      Si el ID coincide, le asigna un nuevo código (ej. PAC-001_fusion_1) para no sobrescribir nada.
                    </div>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addUnmatchedAsFormFields}
                    onChange={(e) => setAddUnmatchedAsFormFields(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded border-slate-300"
                  />
                  <span>
                    Si el archivo trae nuevas variables clínicas, incorporarlas al formulario
                  </span>
                </label>
              </div>
            </div>

            {/* Column Mapping Preview */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                2. Mapeo Automático de Columnas
              </h3>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                {parsedFile.headers.map((header) => {
                  const mappedTo = columnMapping[header] || '';
                  const existsInForm = form.fields.some((f) => f.name === mappedTo);

                  return (
                    <div key={header} className="pt-2 flex items-center justify-between gap-2 text-xs">
                      <div className="truncate font-mono text-slate-800 font-medium" title={header}>
                        {header}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <select
                          value={mappedTo}
                          onChange={(e) =>
                            setColumnMapping((prev) => ({ ...prev, [header]: e.target.value }))
                          }
                          className="text-xs font-mono py-1 px-2 border border-slate-300 rounded bg-slate-50 max-w-[150px] truncate"
                        >
                          <option value="id_registro">id_registro (Clave)</option>
                          <option value="fecha_registro">fecha_registro (Timestamp)</option>
                          {form.fields.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name} ({f.label})
                            </option>
                          ))}
                          {!existsInForm && mappedTo && (
                            <option value={mappedTo}>+ Nueva: {mappedTo}</option>
                          )}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleExecuteMerge}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-md shadow-xs flex items-center gap-2 transition-colors"
            >
              <GitMerge className="w-4 h-4" />
              <span>Ejecutar Fusión de Datos Ahora</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
