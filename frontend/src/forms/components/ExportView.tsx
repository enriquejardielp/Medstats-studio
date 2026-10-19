import { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  BookOpen,
  Code2,
  Copy,
  Check,
  CheckCircle,
  FileJson,
  Layers,
  Database,
} from 'lucide-react';
import type { ClinicalForm, RecordEntry } from '../types/clinical';
import { exportToExcel, exportToCSV, buildDatasetRows, buildCodebookRows } from '../utils/exporter';
import { ProjectSyncModal } from './ProjectSyncModal';

interface ExportViewProps {
  form: ClinicalForm;
  records: RecordEntry[];
}

export function ExportView({ form, records }: ExportViewProps) {
  const [isProjectSyncOpen, setIsProjectSyncOpen] = useState(false);
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'json'>('xlsx');
  const [csvDelimiter, setCsvDelimiter] = useState<',' | ';'>(';');
  const [booleanFormat, setBooleanFormat] = useState<'1/0' | 'SI/NO' | 'TRUE/FALSE'>('SI/NO');
  const [includeCodebook, setIncludeCodebook] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'data' | 'codebook'>('data');

  const previewRows = buildDatasetRows(form, records.slice(0, 10), booleanFormat);
  const codebookRows = buildCodebookRows(form);

  const handleExport = () => {
    if (format === 'xlsx') {
      exportToExcel(form, records, {
        booleanFormat,
        includeCodebook,
      });
    } else if (format === 'csv') {
      exportToCSV(form, records, {
        csvDelimiter,
        booleanFormat,
      });
    } else if (format === 'json') {
      const backup = {
        formDefinition: form,
        records: records,
        exportedAt: new Date().toISOString(),
        version: '2.4',
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${form.title.replace(/\s+/g, '_')}_backup.json`;
      link.click();
    }
  };

  const agGridSnippet = `// Ejemplo de integración directa en tu app con AG-Grid:
import { createGrid } from 'ag-grid-community';

// Definición de columnas basada en ${form.title}:
const columnDefs = [
  { field: 'id_registro', headerName: 'ID Registro', pinned: 'left', width: 140 },
  { field: 'fecha_registro', headerName: 'Fecha Captura', width: 160 },
${form.fields
  .map(
    (f) =>
      `  { field: '${f.name}', headerName: '${f.label}'${
        f.type === 'number' || f.type === 'calculated' ? ", type: 'numericColumn'" : ''
      }${f.unit ? `, valueFormatter: p => p.value != null ? \`\${p.value} ${f.unit}\` : ''` : ''} }`
  )
  .join(',\n')}
];

// Opciones de AG Grid:
const gridOptions = {
  columnDefs: columnDefs,
  rowData: /* Cargar desde el archivo Excel/CSV o API */,
  pagination: true,
  paginationPageSize: 25,
  defaultColDef: {
    sortable: true,
    filter: true,
    resizable: true,
  }
};`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(agGridSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Title */}
      <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Exportar e Integrar Datos</h1>
            <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono">
              Excel / CSV / AG Grid
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Descarga la base de datos limpia con nombres de columnas estandarizados para análisis estadístico o tu app con AG-Grid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsProjectSyncOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-md hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
            <span>Volcar a Proyecto MedStats</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 text-white font-semibold text-sm rounded-md hover:bg-emerald-800 shadow-xs transition-colors cursor-pointer"
          >
            {format === 'xlsx' ? (
              <FileSpreadsheet className="w-4 h-4" />
            ) : format === 'csv' ? (
              <Download className="w-4 h-4" />
            ) : (
              <FileJson className="w-4 h-4" />
            )}
            <span>
              Descargar {records.length} {records.length === 1 ? 'registro' : 'registros'} ({format.toUpperCase()})
            </span>
          </button>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Format Selector Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            1. Formato de Archivo
          </h2>

          <div className="space-y-2">
            <label
              onClick={() => setFormat('xlsx')}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                format === 'xlsx'
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">Microsoft Excel (.xlsx)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Incluye hoja de datos + hoja de Diccionario de Variables para análisis.
                </div>
              </div>
            </label>

            <label
              onClick={() => setFormat('csv')}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                format === 'csv'
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Download className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">Texto Delimitado CSV (.csv)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Estándar universal con UTF-8 BOM para acentos en español y símbolos clínicos.
                </div>
              </div>
            </label>

            <label
              onClick={() => setFormat('json')}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                format === 'json'
                  ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileJson className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">Copia de Seguridad JSON (.json)</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Estructura completa de formulario + registros para respaldo y migración.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Encoding & Options Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            2. Opciones de Formato
          </h2>

          {format === 'csv' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Delimitador CSV</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCsvDelimiter(';')}
                  className={`py-1.5 px-3 text-xs font-mono font-medium rounded border ${
                    csvDelimiter === ';'
                      ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  Punto y coma (;) · Excel ES
                </button>
                <button
                  type="button"
                  onClick={() => setCsvDelimiter(',')}
                  className={`py-1.5 px-3 text-xs font-mono font-medium rounded border ${
                    csvDelimiter === ','
                      ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  Coma (,) · Estándar Int.
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                El delimitador punto y coma (;) abre automáticamente en columnas en el Excel español sin pasos adicionales.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Representación de Booleanos (Sí/No)</label>
            <div className="grid grid-cols-3 gap-2">
              {(['SI/NO', '1/0', 'TRUE/FALSE'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setBooleanFormat(fmt)}
                  className={`py-1.5 px-2 text-xs font-mono font-medium rounded border ${
                    booleanFormat === fmt
                      ? 'border-teal-600 bg-teal-50 text-teal-900 font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Para modelos estadísticos y AG-Grid, 1/0 es óptimo. Para clínicos, SÍ/NO.
            </p>
          </div>

          {format === 'xlsx' && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCodebook}
                  onChange={(e) => setIncludeCodebook(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-slate-700">
                  Incluir hoja con Diccionario de Datos / Codebook
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
            Resumen de Exportación
          </h2>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Total de filas a exportar:</span>
              <span className="font-mono font-bold text-slate-900">{records.length} registros</span>
            </div>
            <div className="flex justify-between">
              <span>Total columnas de variables:</span>
              <span className="font-mono font-bold text-slate-900">{form.fields.length + 2} columnas</span>
            </div>
            <div className="flex justify-between">
              <span>Codificación de texto:</span>
              <span className="font-mono font-bold text-slate-900">UTF-8 con BOM</span>
            </div>
            <div className="flex justify-between">
              <span>Variables calculadas:</span>
              <span className="font-mono text-teal-700">
                {form.fields.filter((f) => f.type === 'calculated').length} automáticas
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <button
              onClick={handleExport}
              className="w-full py-2 bg-emerald-700 text-white text-xs font-semibold rounded-md hover:bg-emerald-800 shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Generar y Descargar Archivo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dataset / Codebook Preview */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePreviewTab('data')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activePreviewTab === 'data'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vista Previa de Filas (Primeras {previewRows.length})</span>
            </button>

            <button
              onClick={() => setActivePreviewTab('codebook')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activePreviewTab === 'codebook'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Diccionario de Datos ({codebookRows.length} variables)</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 hidden sm:block">
            {activePreviewTab === 'data' ? 'Columnas idénticas al archivo final' : 'Metadatos para SPSS / R / Python'}
          </span>
        </div>

        {activePreviewTab === 'data' ? (
          <div className="overflow-x-auto max-h-72">
            {previewRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aún no hay registros en la base de datos. Completa al menos un caso para previsualizar.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    {Object.keys(previewRows[0]).map((h) => (
                      <th key={h} className="py-2 px-3 font-mono text-[11px] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {Object.values(r).map((val, vi) => (
                        <td key={vi} className="py-2 px-3 whitespace-nowrap text-slate-800 text-xs">
                          {String(val ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2 px-3 font-mono text-[11px]">Variable (Columna)</th>
                  <th className="py-2 px-3">Etiqueta Clínica</th>
                  <th className="py-2 px-3">Sección</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Unidad</th>
                  <th className="py-2 px-3">Valores / Opciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codebookRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-semibold text-teal-800">{row.variable}</td>
                    <td className="py-2 px-3 text-slate-900 font-medium">{row.etiqueta}</td>
                    <td className="py-2 px-3 text-slate-600">{row.seccion}</td>
                    <td className="py-2 px-3 text-slate-600">{row.tipo}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{row.unidad}</td>
                    <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-xs">
                      {row.opciones_o_rango}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AG Grid / App Integration Snippet */}
      <div className="bg-slate-900 text-slate-100 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-teal-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
              Integración con tu app de AG Grid (JavaScript / TypeScript)
            </h3>
          </div>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copiado al portapapeles' : 'Copiar código'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-2">
          Copia estas definiciones de columnas (columnDefs) directamente en tu app para que coincidan al 100% con los datos exportados:
        </p>

        <pre className="mt-3 p-3 bg-slate-950/80 rounded border border-slate-800 text-[11px] font-mono text-teal-300 overflow-x-auto leading-relaxed max-h-56">
          {agGridSnippet}
        </pre>
      </div>

      <ProjectSyncModal
        isOpen={isProjectSyncOpen}
        onClose={() => setIsProjectSyncOpen(false)}
        form={form}
        records={records}
      />
    </div>
  );
}
