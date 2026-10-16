export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'radio'
  | 'multiselect'
  | 'date'
  | 'time'
  | 'boolean'
  | 'textarea'
  | 'calculated';

export interface ClinicalRange {
  min?: number;
  max?: number;
  warningLow?: string;
  warningHigh?: string;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_true'
  | 'is_false'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than';

export interface ConditionalRule {
  parentField: string; // Parent variable name that triggers the condition
  operator: ConditionOperator;
  value?: any; // Target value to match (for equals, contains, etc.)
}

export interface FormField {
  id: string;
  name: string; // Database column identifier (e.g. "ta_sistolica", "edad")
  label: string; // Human label (e.g. "Tensión Arterial Sistólica")
  type: FieldType;
  section: string; // Grouping section (e.g. "Constantes Vitales")
  unit?: string; // e.g. "mmHg", "kg", "cm", "mg/dL", "lpm"
  required?: boolean;
  placeholder?: string;
  description?: string; // Clinical help text or note
  options?: string[]; // For select, radio, multiselect
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: any;
  formula?: string; // Expression for calculated field, e.g. "peso / ((talla / 100) ** 2)"
  formulaPreset?: 'imc' | 'pam' | 'braden' | 'custom';
  range?: ClinicalRange;
  conditional?: ConditionalRule; // Field only appears if parent condition is met
}

export interface ClinicalForm {
  id: string;
  title: string;
  description: string;
  category: 'triaje' | 'investigacion' | 'enfermeria' | 'urgencias' | 'general';
  codePrefix: string; // e.g. "PAC-" or "SUJ-"
  sections: string[];
  sectionRules?: Record<string, ConditionalRule>; // Conditional rules for entire sections
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}

export interface RecordEntry {
  id: string; // unique entry id
  recordCode: string; // e.g. "PAC-001"
  timestamp: string;
  author?: string;
  data: Record<string, any>;
}

export interface FavoriteSection {
  id: string;
  title: string;
  description: string;
  category: 'cardiovascular' | 'imagen' | 'laboratorio' | 'constantes' | 'antecedentes' | 'general';
  isDefaultPreset?: boolean;
  conditional?: ConditionalRule;
  fields: Array<{
    name: string;
    label: string;
    type: FieldType;
    unit?: string;
    required?: boolean;
    placeholder?: string;
    description?: string;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: any;
    formula?: string;
    formulaPreset?: 'imc' | 'pam' | 'braden' | 'custom';
    range?: ClinicalRange;
    conditional?: ConditionalRule;
  }>;
}

export interface MergeConflict {
  recordCode: string;
  existingData: Record<string, any>;
  incomingData: Record<string, any>;
}

export interface MergeReport {
  totalIncoming: number;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  newColumns: string[];
  timestamp: string;
}

export interface FormBackup {
  id: string;
  form: ClinicalForm;
  records: RecordEntry[];
  timestamp: string;
  reason: string;
}

export interface TrashItem {
  id: string;
  form: ClinicalForm;
  records: RecordEntry[];
  deletedAt: string;
}
