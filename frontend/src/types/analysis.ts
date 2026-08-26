// ============================================================
// Tipos del Esquema Unificado de Resultados Estadísticos (DTO)
// MedStats Studio (Stata + SPSS + R)
// ============================================================

export type DiagnosticStatus = 'pass' | 'warning' | 'fail' | 'info';
export type WarningSeverity = 'info' | 'warning' | 'critical';
export type ColumnFormat = 'text' | 'number' | 'decimal' | 'p_value' | 'percentage' | 'conf_interval';

export interface MetricItem {
  key: string;
  label: string;
  value: number | string | null;
  formatted: string;
  description?: string;
  p_value?: number;
  significance_star?: string;
}

export interface ExecutiveSummary {
  headline: string;
  key_metrics: MetricItem[];
  interpretation: string;
}

export interface TableColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format_type: ColumnFormat;
  decimals?: number;
  visible?: boolean;
  sortable?: boolean;
  tooltip?: string;
}

export interface TableFootnote {
  symbol: string;
  text: string;
}

export interface StatisticalTable {
  id: string;
  title: string;
  subtitle?: string;
  columns: TableColumnDef[];
  rows: Record<string, any>[];
  footnotes?: TableFootnote[];
  confidence_level?: number;
}

export interface DiagnosticItem {
  id: string;
  name: string;
  status: DiagnosticStatus;
  statistic_name?: string;
  statistic_value?: number;
  p_value?: number;
  threshold?: string;
  finding: string;
  recommendation?: string;
}

export interface AnalysisWarning {
  code: string;
  severity: WarningSeverity;
  message: string;
  variable?: string;
  action_suggested?: string;
}

export interface TechnicalDetails {
  method: string;
  formula?: string;
  r_version?: string;
  packages_used: string[];
  degrees_of_freedom?: number | number[];
  log_likelihood?: number;
  aic?: number;
  bic?: number;
  convergence?: boolean;
  parameters?: Record<string, any>;
}

export interface AnalysisPlot {
  id: string;
  title: string;
  plot_type: string;
  image_base64: string;
  description?: string;
  script_r: string;
}

export interface ReproducibleCode {
  language: string;
  script: string;
  packages: string[];
  instructions?: string;
}

export interface AnalysisMetadata {
  analysis_id: string;
  analysis_type: string;
  title: string;
  description?: string;
  created_at: string;
  dataset_name?: string;
  sample_size: number;
  variables_used: string[];
  missing_observations?: number;
  valid_observations: number;
}

export interface AnalysisResult {
  metadata: AnalysisMetadata;
  summary: ExecutiveSummary;
  tables: StatisticalTable[];
  diagnostics?: DiagnosticItem[];
  warnings?: AnalysisWarning[];
  plots?: AnalysisPlot[];
  technical: TechnicalDetails;
  reproducible_code: ReproducibleCode;
}
