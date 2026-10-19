import type { ClinicalForm, RecordEntry, FormField, FieldType } from '../types/clinical';
import apiClient from '../../api/client';

export interface ProjectDataSyncPayload {
  data: Record<string, any>[];
  types: Record<string, string>;
  columns: string[];
  csv: string;
}

/**
 * Transforma los registros de un formulario clínico en filas y columnas estructuradas para un Proyecto de MedStats
 */
export function recordsToProjectData(
  form: ClinicalForm,
  records: RecordEntry[]
): ProjectDataSyncPayload {
  const columns: string[] = ['record_code'];
  const types: Record<string, string> = {
    record_code: 'id',
  };

  // Mapear columnas según los campos definidos en el formulario
  form.fields.forEach((field) => {
    if (!columns.includes(field.name)) {
      columns.push(field.name);
      types[field.name] = mapFieldTypeToColumnType(field.type);
    }
  });

  // Mapear cada registro a una fila
  const data = records.map((entry) => {
    const row: Record<string, any> = {
      record_code: entry.recordCode,
    };

    form.fields.forEach((field) => {
      let val = entry.data[field.name];

      // Normalización según el tipo
      if (val === undefined || val === null || val === '') {
        row[field.name] = null;
      } else if (field.type === 'number' || field.type === 'calculated') {
        const num = Number(val);
        row[field.name] = isNaN(num) ? null : num;
      } else if (field.type === 'boolean') {
        if (typeof val === 'boolean') {
          row[field.name] = val ? 1 : 0;
        } else {
          const s = String(val).toUpperCase();
          row[field.name] = ['SI', 'S', 'TRUE', '1', 'YES'].includes(s) ? 1 : 0;
        }
      } else if (Array.isArray(val)) {
        row[field.name] = val.join(', ');
      } else {
        row[field.name] = String(val);
      }
    });

    return row;
  });

  // Generar CSV
  const headerLine = columns.join(',');
  const rowLines = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );
  const csv = [headerLine, ...rowLines].join('\n');

  return { data, types, columns, csv };
}

/**
 * Mapea el tipo de campo de formulario clínico a tipo de columna estadística de MedStats
 */
export function mapFieldTypeToColumnType(fieldType: FieldType): string {
  switch (fieldType) {
    case 'number':
    case 'calculated':
      return 'numeric';
    case 'boolean':
      return 'binary';
    case 'select':
    case 'radio':
    case 'multiselect':
      return 'categorical';
    case 'date':
      return 'date';
    case 'text':
    case 'textarea':
    case 'time':
    default:
      return 'text';
  }
}

/**
 * Mapea el tipo de columna de MedStats al tipo de campo de formulario
 */
export function mapColumnTypeToFieldType(colType: string): FieldType {
  switch (colType) {
    case 'numeric':
      return 'number';
    case 'binary':
      return 'boolean';
    case 'categorical':
      return 'select';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

/**
 * Genera automáticamente un Formulario Clínico (eCRF) a partir de los datos y columnas de un proyecto existente
 */
export function projectToClinicalForm(project: {
  id: number;
  name: string;
  description?: string;
  columns: string[];
  column_types?: Record<string, string>;
  data?: any[];
}): { form: ClinicalForm; records: RecordEntry[] } {
  const colTypes = project.column_types || {};
  const fields: FormField[] = [];

  project.columns.forEach((colName, index) => {
    // Si la columna ya es record_code o id_paciente, saltar o usar como id
    if (['record_code', 'id', 'id_paciente', 'paciente_id'].includes(colName.toLowerCase())) {
      return;
    }

    const cType = colTypes[colName] || 'numeric';
    const fieldType = mapColumnTypeToFieldType(cType);

    // Extraer opciones si es categórica
    let options: string[] | undefined = undefined;
    if (fieldType === 'select' && project.data && project.data.length > 0) {
      const uniqueVals = Array.from(
        new Set(
          project.data
            .map((r) => r[colName])
            .filter((v) => v !== null && v !== undefined && v !== '')
        )
      ).map(String);
      if (uniqueVals.length > 0 && uniqueVals.length <= 15) {
        options = uniqueVals;
      }
    }

    fields.push({
      id: `f_proj_${index}_${Date.now()}`,
      name: colName,
      label: colName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      type: fieldType,
      section: 'Variables del Estudio',
      required: false,
      options,
    });
  });

  const form: ClinicalForm = {
    id: `project-form-${project.id}`,
    title: `eCRF: ${project.name}`,
    description:
      project.description ||
      `Cuaderno de Recogida de Datos Clínicos asociado al proyecto #${project.id}.`,
    category: 'investigacion',
    codePrefix: 'SUJ-',
    sections: ['Variables del Estudio'],
    fields,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Convertir los datos existentes del proyecto en registros del eCRF
  const records: RecordEntry[] = (project.data || []).map((row, idx) => {
    const code =
      row.record_code ||
      row.id_paciente ||
      row.id ||
      `SUJ-${String(idx + 1).padStart(3, '0')}`;

    const dataObj: Record<string, any> = {};
    fields.forEach((f) => {
      dataObj[f.name] = row[f.name] ?? null;
    });

    return {
      id: `rec_${project.id}_${idx}_${Date.now()}`,
      recordCode: String(code),
      timestamp: new Date().toISOString(),
      author: 'MedStats Import',
      data: dataObj,
    };
  });

  return { form, records };
}

/**
 * Guarda y sincroniza los registros del formulario directamente con el proyecto en el backend
 */
export async function syncFormRecordsToProject(
  projectId: number,
  form: ClinicalForm,
  records: RecordEntry[]
): Promise<{ success: boolean; rowCount: number }> {
  const { data, types } = recordsToProjectData(form, records);

  // Enviar a la API de MedStats
  const response = await apiClient.put(`/api/projects/${projectId}/data`, {
    data,
    types,
  });

  // Guardar copia local del esquema del formulario para este proyecto
  localStorage.setItem(`medstats_project_form_${projectId}`, JSON.stringify(form));

  return {
    success: true,
    rowCount: response.data?.row_count ?? data.length,
  };
}

/**
 * Crea un nuevo proyecto en MedStats a partir de un formulario y sus registros
 */
export async function createProjectFromForm(
  form: ClinicalForm,
  records: RecordEntry[],
  customName?: string
): Promise<any> {
  const { csv, types } = recordsToProjectData(form, records);

  const payload = {
    name: customName || form.title,
    description: form.description || 'Creado desde el Cuaderno de Recogida de Datos (eCRF).',
    filename: `${form.title.toLowerCase().replace(/\s+/g, '_')}_dataset.csv`,
    csv_data: csv,
    column_types: types,
  };

  const response = await apiClient.post('/api/projects', payload);
  return response.data;
}
