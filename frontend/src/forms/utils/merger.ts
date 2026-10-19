import * as XLSX from 'xlsx';
import type { ClinicalForm, RecordEntry, MergeReport } from '../types/clinical';

export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  totalRows: number;
}

export type MergeStrategy = 'add_new_only' | 'upsert' | 'append_with_new_id';

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file in the browser
 */
export async function parseClinicalFile(file: File): Promise<ParsedFileResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Look for first sheet or sheet named 'Datos_Clinicos' if created by our app
  const sheetName = workbook.SheetNames.includes('Datos_Clinicos')
    ? 'Datos_Clinicos'
    : workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('El archivo no contiene hojas legibles.');
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (rawRows.length === 0) {
    return {
      headers: [],
      rows: [],
      fileName: file.name,
      totalRows: 0,
    };
  }

  const headers = Object.keys(rawRows[0]);
  return {
    headers,
    rows: rawRows,
    fileName: file.name,
    totalRows: rawRows.length,
  };
}

/**
 * Normalizes column keys to standard field name
 */
export function normalizeColumnKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Executes dataset merge with selected strategy
 */
export function mergeDatasets(
  currentRecords: RecordEntry[],
  incomingRows: Record<string, any>[],
  form: ClinicalForm,
  strategy: MergeStrategy,
  columnMapping: Record<string, string> // maps incomingHeader -> formFieldName
): {
  mergedRecords: RecordEntry[];
  report: MergeReport;
  newFormFields?: string[];
} {
  const existingMap = new Map<string, RecordEntry>();
  currentRecords.forEach((r) => {
    const key = (r.recordCode || r.id).trim().toUpperCase();
    existingMap.set(key, { ...r, data: { ...r.data } });
  });

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const newColumnsFound = new Set<string>();

  const resultRecords: RecordEntry[] = [...currentRecords.map((r) => ({ ...r, data: { ...r.data } }))];

  incomingRows.forEach((row, idx) => {
    // Determine Record Code
    const idKey =
      Object.keys(row).find((k) =>
        ['id_registro', 'id_paciente', 'codigo_sujeto', 'codigo', 'id', 'paciente'].includes(
          normalizeColumnKey(k)
        )
      ) || 'id_registro';

    let incomingCode = row[idKey] ? String(row[idKey]).trim() : '';
    if (!incomingCode) {
      incomingCode = `${form.codePrefix || 'IMP-'}${String(currentRecords.length + addedCount + 1).padStart(3, '0')}`;
    }

    const upperKey = incomingCode.toUpperCase();
    const existingIndex = resultRecords.findIndex(
      (r) => (r.recordCode || r.id).trim().toUpperCase() === upperKey
    );

    // Build normalized data object
    const rowData: Record<string, any> = {};
    for (const [inHeader, rawVal] of Object.entries(row)) {
      if (inHeader === idKey || normalizeColumnKey(inHeader) === 'fecha_registro') {
        continue;
      }
      const mappedField = columnMapping[inHeader] || normalizeColumnKey(inHeader);
      rowData[mappedField] = rawVal;

      // Check if this column is not in current form
      if (!form.fields.some((f) => f.name === mappedField)) {
        newColumnsFound.add(mappedField);
      }
    }

    // Process according to strategy
    if (existingIndex >= 0) {
      if (strategy === 'upsert') {
        // Merge data, incoming values override
        resultRecords[existingIndex] = {
          ...resultRecords[existingIndex],
          data: {
            ...resultRecords[existingIndex].data,
            ...rowData,
          },
        };
        updatedCount++;
      } else if (strategy === 'add_new_only') {
        skippedCount++;
      } else if (strategy === 'append_with_new_id') {
        // Create duplicate with suffix
        const newCode = `${incomingCode}_fusion_${idx + 1}`;
        resultRecords.push({
          id: 'rec-' + Date.now() + '-' + idx,
          recordCode: newCode,
          timestamp: new Date().toISOString(),
          author: 'Fusión Externa',
          data: rowData,
        });
        addedCount++;
      }
    } else {
      // New record
      resultRecords.push({
        id: 'rec-' + Date.now() + '-' + idx,
        recordCode: incomingCode,
        timestamp: row.fecha_registro ? String(row.fecha_registro) : new Date().toISOString(),
        author: 'Importado',
        data: rowData,
      });
      addedCount++;
    }
  });

  return {
    mergedRecords: resultRecords,
    report: {
      totalIncoming: incomingRows.length,
      addedCount,
      updatedCount,
      skippedCount,
      newColumns: Array.from(newColumnsFound),
      timestamp: new Date().toISOString(),
    },
    newFormFields: Array.from(newColumnsFound),
  };
}
