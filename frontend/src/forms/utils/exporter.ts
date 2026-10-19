import * as XLSX from 'xlsx';
import type { ClinicalForm, RecordEntry } from '../types/clinical';

export interface ExportOptions {
  format: 'xlsx' | 'csv' | 'json';
  csvDelimiter: ',' | ';';
  includeMetadata: boolean;
  includeCodebook: boolean;
  customFilename?: string;
  booleanFormat: '1/0' | 'SI/NO' | 'TRUE/FALSE';
}

/**
 * Normalizes field value for tabular output (handling arrays, booleans, etc.)
 */
export function formatValueForExport(val: any, booleanFormat: '1/0' | 'SI/NO' | 'TRUE/FALSE'): any {
  if (val === undefined || val === null || val === '') return '';
  if (Array.isArray(val)) {
    return val.join('; ');
  }
  if (typeof val === 'boolean') {
    if (booleanFormat === '1/0') return val ? 1 : 0;
    if (booleanFormat === 'SI/NO') return val ? 'SÍ' : 'NO';
    return val ? 'TRUE' : 'FALSE';
  }
  return val;
}

/**
 * Builds the data rows for export
 */
export function buildDatasetRows(form: ClinicalForm, records: RecordEntry[], booleanFormat: '1/0' | 'SI/NO' | 'TRUE/FALSE') {
  return records.map((rec) => {
    const row: Record<string, any> = {
      id_registro: rec.recordCode || rec.id,
      fecha_registro: rec.timestamp ? new Date(rec.timestamp).toLocaleString('es-ES') : '',
    };

    for (const field of form.fields) {
      const rawVal = rec.data[field.name];
      row[field.name] = formatValueForExport(rawVal, booleanFormat);
    }

    return row;
  });
}

/**
 * Builds the Codebook / Data Dictionary sheet rows
 */
export function buildCodebookRows(form: ClinicalForm) {
  const rows: Record<string, string>[] = [
    {
      variable: 'id_registro',
      etiqueta: 'Código único identificador del caso / paciente',
      seccion: 'Metadatos del Sistema',
      tipo: 'Texto / Identificador',
      unidad: '-',
      opciones_o_rango: 'Alfanumérico secuencial',
      descripcion: 'Identificador clave primaria para cruce de bases de datos',
    },
    {
      variable: 'fecha_registro',
      etiqueta: 'Fecha y hora de captura del caso',
      seccion: 'Metadatos del Sistema',
      tipo: 'Fecha / Hora',
      unidad: 'Timestamp',
      opciones_o_rango: 'ISO 8601 / DD/MM/YYYY HH:mm',
      descripcion: 'Marca temporal del momento de registro',
    },
  ];

  for (const field of form.fields) {
    let optionsOrRange = '-';
    if (field.options && field.options.length > 0) {
      optionsOrRange = field.options.join(' | ');
    } else if (field.min !== undefined || field.max !== undefined) {
      optionsOrRange = `Mín: ${field.min ?? '-'}, Máx: ${field.max ?? '-'}`;
    }

    const conditionNote = field.conditional
      ? ` [Condicional: Solo aplica si ${field.conditional.parentField} ${field.conditional.operator} ${field.conditional.value ?? ''}]`
      : '';
    const baseDesc = field.description || (field.formula ? `Calculado: ${field.formulaPreset || field.formula}` : '');
    const fullDesc = (baseDesc + conditionNote).trim() || '-';

    rows.push({
      variable: field.name,
      etiqueta: field.label,
      seccion: field.section || 'General',
      tipo: field.type,
      unidad: field.unit || '-',
      opciones_o_rango: optionsOrRange,
      descripcion: fullDesc,
    });
  }

  return rows;
}

/**
 * Exports data to Microsoft Excel (.xlsx) with Data Sheet + Codebook Sheet
 */
export function exportToExcel(
  form: ClinicalForm,
  records: RecordEntry[],
  options: Partial<ExportOptions> = {}
) {
  const booleanFormat = options.booleanFormat || 'SI/NO';
  const includeCodebook = options.includeCodebook !== false;

  const datasetRows = buildDatasetRows(form, records, booleanFormat);
  const dataWs = XLSX.utils.json_to_sheet(datasetRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataWs, 'Datos_Clinicos');

  if (includeCodebook) {
    const codebookRows = buildCodebookRows(form);
    const codebookWs = XLSX.utils.json_to_sheet(codebookRows);
    XLSX.utils.book_append_sheet(wb, codebookWs, 'Diccionario_Variables');
  }

  const safeTitle = form.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = options.customFilename || `${safeTitle}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);
}

/**
 * Exports data to CSV with BOM and custom delimiter
 */
export function exportToCSV(
  form: ClinicalForm,
  records: RecordEntry[],
  options: Partial<ExportOptions> = {}
) {
  const delimiter = options.csvDelimiter || ';';
  const booleanFormat = options.booleanFormat || 'SI/NO';

  const rows = buildDatasetRows(form, records, booleanFormat);
  if (rows.length === 0) {
    // Generate empty headers row if no records exist yet
    const headers = ['id_registro', 'fecha_registro', ...form.fields.map((f) => f.name)];
    downloadCSVFile(headers.join(delimiter) + '\n', form, options);
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map((h) => escapeCsvValue(h, delimiter)).join(delimiter),
    ...rows.map((row) =>
      headers
        .map((h) => escapeCsvValue(String(row[h] ?? ''), delimiter))
        .join(delimiter)
    ),
  ];

  const csvContent = '\uFEFF' + csvLines.join('\r\n'); // \uFEFF is UTF-8 BOM
  downloadCSVFile(csvContent, form, options);
}

function escapeCsvValue(val: string, delimiter: string): string {
  if (val.includes(delimiter) || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadCSVFile(content: string, form: ClinicalForm, options: Partial<ExportOptions>) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeTitle = form.title.replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = options.customFilename || `${safeTitle}_${dateStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates sample records for rapid testing
 */
export function generateSampleRecords(form: ClinicalForm, count: number = 5): RecordEntry[] {
  const sampleRecords: RecordEntry[] = [];
  const startNum = 1;

  for (let i = 0; i < count; i++) {
    const num = startNum + i;
    const code = `${form.codePrefix || 'REG-'}${String(num).padStart(3, '0')}`;
    const data: Record<string, any> = {};

    for (const field of form.fields) {
      if (field.type === 'number') {
        const min = field.min ?? 20;
        const max = field.max ?? 100;
        const step = field.step || 1;
        const val = min + Math.floor(Math.random() * ((max - min) / step)) * step;
        data[field.name] = Number(val.toFixed(step < 1 ? 1 : 0));
      } else if (field.type === 'select' || field.type === 'radio') {
        if (field.options && field.options.length > 0) {
          data[field.name] = field.options[Math.floor(Math.random() * field.options.length)];
        }
      } else if (field.type === 'boolean') {
        data[field.name] = Math.random() > 0.5;
      } else if (field.type === 'multiselect') {
        if (field.options && field.options.length > 0) {
          const selected = field.options.filter(() => Math.random() > 0.6);
          data[field.name] = selected.length > 0 ? selected : [field.options[0]];
        }
      } else if (field.type === 'text') {
        data[field.name] = `Dato de prueba ${num}`;
      } else if (field.type === 'textarea') {
        data[field.name] = `Observaciones clínicas de seguimiento para el registro ${code}. Sin incidencias agudas.`;
      }
    }

    // Auto-calculate formulas
    if (data.peso && data.talla) {
      const tMeters = data.talla < 3 ? data.talla : data.talla / 100;
      data.imc = Math.round((data.peso / Math.pow(tMeters, 2)) * 10) / 10;
    }
    if (data.ta_sistolica && data.ta_diastolica) {
      data.presion_arterial_media = Math.round(((data.ta_diastolica * 2 + data.ta_sistolica) / 3) * 10) / 10;
    }

    sampleRecords.push({
      id: 'rec-' + Date.now() + '-' + i,
      recordCode: code,
      timestamp: new Date(Date.now() - (count - i) * 3600000 * 4).toISOString(),
      author: 'Dr(a). García',
      data,
    });
  }

  return sampleRecords;
}
