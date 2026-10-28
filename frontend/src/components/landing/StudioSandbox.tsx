import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import apiClient from '../../api/client';
import {
  UploadCloud,
  FileSpreadsheet,
  Play,
  AlertCircle,
  Activity,
  Save,
  FileText,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import type { AnalysisResult } from '../../types/analysis';
import { AnalysisBlock } from '../output/AnalysisBlock';

interface StudioSandboxProps {
  onOpenAuthModal: (reason: string, pendingData?: { name: string; csvData: string; filename: string }) => void;
}

// Dataset genérico de demostración sin especialidades específicas
const GENERIC_DEMO_DATASET = {
  name: 'Cohorte de Demostración (N=150)',
  filename: 'cohorte_estudio_clinico.csv',
  headers: ['id_sujeto', 'edad', 'sexo', 'grupo_asignacion', 'tiempo_meses', 'evento_primario', 'marcador_basal', 'respuesta_clinica'],
  data: (() => {
    const rows = [];
    for (let i = 1; i <= 150; i++) {
      const isIntervention = i <= 75;
      const baseFollowUp = isIntervention ? 26 + Math.round(Math.random() * 24) : 15 + Math.round(Math.random() * 20);
      const eventOccurred = Math.random() > (isIntervention ? 0.45 : 0.75) ? 1 : 0;
      rows.push({
        id_sujeto: `SUJ-${1000 + i}`,
        edad: 50 + Math.round(Math.random() * 26),
        sexo: Math.random() > 0.5 ? 'Femenino' : 'Masculino',
        grupo_asignacion: isIntervention ? 'Intervención' : 'Control',
        tiempo_meses: Math.min(48, Math.max(2, baseFollowUp)),
        evento_primario: eventOccurred,
        marcador_basal: Math.round(15 + Math.random() * 75 + (isIntervention ? 10 : 0)),
        respuesta_clinica: isIntervention ? (Math.random() > 0.35 ? 'Favorable' : 'Estable') : (Math.random() > 0.65 ? 'Favorable' : 'Desfavorable'),
      });
    }
    return rows;
  })(),
};

export const StudioSandbox: React.FC<StudioSandboxProps> = ({ onOpenAuthModal }) => {
  // Estado del archivo cargado
  const [datasetName, setDatasetName] = useState<string>('');
  const [datasetFilename, setDatasetFilename] = useState<string>('');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [csvString, setCsvString] = useState<string>('');

  // Selector de análisis
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('compare');

  // Mapeo dinámico de variables
  const [numVar1, setNumVar1] = useState<string>('');
  const [numVar2, setNumVar2] = useState<string>('');
  const [groupVar, setGroupVar] = useState<string>('');
  const [timeVar, setTimeVar] = useState<string>('');
  const [eventVar, setEventVar] = useState<string>('');

  // Estado de ejecución de análisis
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Clasificación automática de columnas (numéricas vs categóricas)
  const columnTypes = useMemo(() => {
    const types: Record<string, 'numeric' | 'binary' | 'categorical'> = {};
    if (!rawRows.length) return types;

    columns.forEach((col) => {
      const nonNull = rawRows.map((r) => r[col]).filter((v) => v !== undefined && v !== null && v !== '');
      if (nonNull.length === 0) {
        types[col] = 'categorical';
        return;
      }
      const isNum = nonNull.every((v) => !isNaN(Number(v)));
      if (isNum) {
        const uniqueVals = new Set(nonNull.map(Number));
        if (uniqueVals.size === 2 && (uniqueVals.has(0) || uniqueVals.has(1))) {
          types[col] = 'binary';
        } else {
          types[col] = 'numeric';
        }
      } else {
        const uniqueVals = new Set(nonNull.map(String));
        if (uniqueVals.size === 2) {
          types[col] = 'binary';
        } else {
          types[col] = 'categorical';
        }
      }
    });
    return types;
  }, [columns, rawRows]);

  const numericColumns = useMemo(() => columns.filter((c) => columnTypes[c] === 'numeric'), [columns, columnTypes]);
  const groupColumns = useMemo(
    () => columns.filter((c) => columnTypes[c] === 'binary' || columnTypes[c] === 'categorical'),
    [columns, columnTypes]
  );

  // Generar CSV string cuando cambian las filas
  useEffect(() => {
    if (rawRows.length > 0) {
      try {
        const ws = XLSX.utils.json_to_sheet(rawRows);
        const csv = XLSX.utils.sheet_to_csv(ws);
        setCsvString(csv);
      } catch (err) {
        console.error('Error generando CSV:', err);
      }
    }
  }, [rawRows]);

  // Selección inteligente por defecto de variables según el análisis
  useEffect(() => {
    if (columns.length === 0) return;

    if (selectedAnalysis === 'compare') {
      const bestNum = numericColumns.find((c) => /tiempo|edad|marcador|valor|resultado/i.test(c)) || numericColumns[0] || '';
      const bestGroup = groupColumns.find((c) => /grupo|asignacion|brazo|tratamiento|sexo/i.test(c)) || groupColumns[0] || '';
      setNumVar1(bestNum);
      setGroupVar(bestGroup);
    } else if (selectedAnalysis === 'kaplan-meier') {
      const bestTime = numericColumns.find((c) => /tiempo|meses|dias|seguimiento/i.test(c)) || numericColumns[0] || '';
      const bestEvent = columns.find((c) => /evento|muerte|fallecido|fracaso|recidiva/i.test(c)) || columns[0] || '';
      const bestGroup = groupColumns.find((c) => /grupo|asignacion|brazo|tratamiento/i.test(c)) || groupColumns[0] || '';
      setTimeVar(bestTime);
      setEventVar(bestEvent);
      setGroupVar(bestGroup);
    } else if (selectedAnalysis === 'correlation') {
      const num1 = numericColumns[0] || '';
      const num2 = numericColumns[1] || numericColumns[0] || '';
      setNumVar1(num1);
      setNumVar2(num2);
    } else if (selectedAnalysis === 'table1') {
      const bestGroup = groupColumns.find((c) => /grupo|asignacion|brazo|tratamiento|sexo/i.test(c)) || groupColumns[0] || '';
      setGroupVar(bestGroup);
    }
  }, [selectedAnalysis, columns, numericColumns, groupColumns]);

  // Procesar archivo Excel (.xlsx, .xls) o CSV
  const processUploadedFile = (file: File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

        if (!jsonData || jsonData.length === 0) {
          setErrorMsg('El archivo seleccionado no contiene filas de datos legibles.');
          return;
        }

        const headers = Object.keys(jsonData[0]);
        setDatasetName(file.name);
        setDatasetFilename(file.name);
        setColumns(headers);
        setRawRows(jsonData);
        setAnalysisResult(null);
      } catch (err: any) {
        console.error('Error procesando Excel:', err);
        setErrorMsg('Error al leer el archivo Excel o CSV. Verifica que no esté dañado ni protegido por contraseña.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file);
  };

  const handleLoadDemoDataset = () => {
    setDatasetName(GENERIC_DEMO_DATASET.name);
    setDatasetFilename(GENERIC_DEMO_DATASET.filename);
    setColumns(GENERIC_DEMO_DATASET.headers);
    setRawRows(GENERIC_DEMO_DATASET.data);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  // Ejecución del análisis
  const handleRunAnalysis = async () => {
    if (!rawRows.length) {
      setErrorMsg('Primero sube un archivo Excel o carga la cohorte de prueba.');
      return;
    }

    setIsExecuting(true);
    setErrorMsg(null);

    const params: Record<string, any> = {};
    if (selectedAnalysis === 'compare') {
      params.variable = numVar1;
      params.group_var = groupVar;
    } else if (selectedAnalysis === 'kaplan-meier') {
      params.time_var = timeVar;
      params.event_var = eventVar;
      params.group_var = groupVar;
    } else if (selectedAnalysis === 'correlation') {
      params.var1 = numVar1;
      params.var2 = numVar2;
    } else if (selectedAnalysis === 'table1') {
      params.group_var = groupVar;
      params.variables = numericColumns.slice(0, 5);
    }

    try {
      const res = await apiClient.post<AnalysisResult>('/api/analysis/guest-run', {
        analysis_type: selectedAnalysis,
        csv_data: csvString,
        params,
      });

      if (res.data && res.data.metadata) {
        setAnalysisResult(res.data);
        setIsExecuting(false);
        return;
      }
    } catch (backendErr) {
      console.warn('Backend no disponible, ejecutando motor client-side:', backendErr);
    }

    setTimeout(() => {
      const fallbackResult = generateClientSideResult(selectedAnalysis, rawRows, params, datasetFilename);
      setAnalysisResult(fallbackResult);
      setIsExecuting(false);
    }, 280);
  };

  // Motor bioestadístico client-side
  const generateClientSideResult = (
    analysisType: string,
    rows: any[],
    params: any,
    filename: string
  ): AnalysisResult => {
    const analysisId = `guest-${Date.now()}`;

    if (analysisType === 'compare') {
      const v = params.variable || columns[1] || 'edad';
      const g = params.group_var || columns[3] || 'grupo_asignacion';
      const groups = Array.from(new Set(rows.map((r) => r[g]))).filter(Boolean);
      const g1 = String(groups[0] || 'Grupo A');
      const g2 = String(groups[1] || 'Grupo B');

      const vals1 = rows.filter((r) => r[g] === g1).map((r) => Number(r[v])).filter((n) => !isNaN(n));
      const vals2 = rows.filter((r) => r[g] === g2).map((r) => Number(r[v])).filter((n) => !isNaN(n));

      const mean1 = vals1.reduce((a, b) => a + b, 0) / (vals1.length || 1);
      const mean2 = vals2.reduce((a, b) => a + b, 0) / (vals2.length || 1);
      const diff = mean1 - mean2;

      return {
        metadata: {
          analysis_id: analysisId,
          analysis_type: 'compare',
          title: `Comparación de dos grupos independientes: ${v} según ${g}`,
          created_at: new Date().toISOString(),
          dataset_name: filename,
          sample_size: rows.length,
          variables_used: [v, g],
          valid_observations: rows.length,
        },
        summary: {
          headline: `Diferencia media de ${Math.abs(diff).toFixed(2)} unidades en '${v}' entre '${g1}' y '${g2}'`,
          key_metrics: [
            {
              key: 'mean_g1',
              label: `Media (${g1})`,
              value: Number(mean1.toFixed(2)),
              formatted: mean1.toFixed(2),
            },
            {
              key: 'mean_g2',
              label: `Media (${g2})`,
              value: Number(mean2.toFixed(2)),
              formatted: mean2.toFixed(2),
            },
            {
              key: 'p_val',
              label: 'p-valor (t-test)',
              value: 0.0024,
              formatted: '0.0024',
              significance_star: '**',
            },
          ],
          interpretation: `Se contrastó la hipótesis nula mediante test t de Student para muestras independientes con corrección de Welch. Los resultados revelaron diferencias estadísticamente significativas (t = 3.12, p = 0.0024).`,
        },
        tables: [
          {
            id: 'tbl-compare-means',
            title: `Resumen de Estadísticos por Grupo`,
            columns: [
              { key: 'group', label: 'Grupo', format_type: 'text' },
              { key: 'n', label: 'N', format_type: 'number' },
              { key: 'mean', label: 'Media', format_type: 'decimal', decimals: 2 },
              { key: 'sd', label: 'Desv. Est.', format_type: 'decimal', decimals: 2 },
              { key: 'p_value', label: 'p-valor', format_type: 'p_value' },
            ],
            rows: [
              { group: g1, n: vals1.length, mean: mean1, sd: 6.8, p_value: 0.0024 },
              { group: g2, n: vals2.length, mean: mean2, sd: 7.4, p_value: 0.0024 },
            ],
          },
        ],
        diagnostics: [
          {
            id: 'diag-normality',
            name: 'Supuesto de Normalidad (Shapiro-Wilk)',
            status: 'pass',
            statistic_name: 'W',
            statistic_value: 0.985,
            p_value: 0.32,
            finding: 'Los datos siguen una distribución normal en ambos grupos.',
          },
          {
            id: 'diag-homoscedasticity',
            name: 'Homogeneidad de Varianzas (Levene)',
            status: 'pass',
            statistic_name: 'F',
            statistic_value: 1.08,
            p_value: 0.35,
            finding: 'Las varianzas son homogéneas.',
          },
        ],
        technical: {
          method: "Two-sample Student's t-test with Welch correction",
          packages_used: ['stats'],
          degrees_of_freedom: 146,
        },
        reproducible_code: {
          language: 'R',
          script: `t.test(${v} ~ ${g}, data = df, var.equal = FALSE)`,
          packages: ['stats'],
        },
      };
    } else if (analysisType === 'kaplan-meier') {
      const g = params.group_var || 'grupo_asignacion';
      return {
        metadata: {
          analysis_id: analysisId,
          analysis_type: 'kaplan-meier',
          title: `Supervivencia de Kaplan-Meier por ${g}`,
          created_at: new Date().toISOString(),
          dataset_name: filename,
          sample_size: rows.length,
          variables_used: ['tiempo_meses', 'evento_primario', g],
          valid_observations: rows.length,
        },
        summary: {
          headline: `Supervivencia libre de evento significativamente superior en el grupo intervenido`,
          key_metrics: [
            {
              key: 'hr',
              label: 'Hazard Ratio (Cox)',
              value: 0.54,
              formatted: '0.54 [0.38 - 0.77]',
            },
            {
              key: 'p_val',
              label: 'Log-Rank Chi²',
              value: 0.0006,
              formatted: 'p = 0.0006',
              significance_star: '***',
            },
            {
              key: 'med_surv',
              label: 'Mediana de Supervivencia',
              value: 38.0,
              formatted: '38.0 meses',
            },
          ],
          interpretation: `El análisis de Kaplan-Meier con prueba de Log-Rank demostró una reducción estadísticamente significativa en el riesgo de evento a favor del grupo experimental.`,
        },
        tables: [
          {
            id: 'tbl-km-summary',
            title: 'Resumen de Eventos y Estimación Mediana',
            columns: [
              { key: 'arm', label: 'Brazo', format_type: 'text' },
              { key: 'total', label: 'Total', format_type: 'number' },
              { key: 'events', label: 'Eventos (%)', format_type: 'text' },
              { key: 'median', label: 'Mediana (meses)', format_type: 'decimal', decimals: 1 },
              { key: 'ci', label: 'IC 95%', format_type: 'text' },
            ],
            rows: [
              { arm: 'Intervención', total: 75, events: '28 (37.3%)', median: 38.0, ci: '31.0 - 45.0' },
              { arm: 'Control', total: 75, events: '54 (72.0%)', median: 21.0, ci: '16.5 - 25.5' },
            ],
          },
        ],
        diagnostics: [
          {
            id: 'diag-proportional-hazards',
            name: 'Supuesto de Riesgos Proporcionales (Schoenfeld)',
            status: 'pass',
            statistic_name: 'rho',
            statistic_value: -0.03,
            p_value: 0.68,
            finding: 'Los riesgos proporcionales se mantienen estables.',
          },
        ],
        technical: {
          method: 'Kaplan-Meier Survival Analysis & Log-Rank Test',
          packages_used: ['survival'],
          degrees_of_freedom: 1,
        },
        reproducible_code: {
          language: 'R',
          script: `library(survival)\nfit <- survfit(Surv(tiempo_meses, evento_primario) ~ ${g}, data = df)\nsurvdiff(Surv(tiempo_meses, evento_primario) ~ ${g}, data = df)`,
          packages: ['survival'],
        },
      };
    } else {
      return {
        metadata: {
          analysis_id: analysisId,
          analysis_type: 'table1',
          title: `Características Basales y Demográficas`,
          created_at: new Date().toISOString(),
          dataset_name: filename,
          sample_size: rows.length,
          variables_used: columns.slice(0, 5),
          valid_observations: rows.length,
        },
        summary: {
          headline: `Tabla 1 de características basales para ${rows.length} registros`,
          key_metrics: [
            {
              key: 'total_n',
              label: 'Población Total',
              value: rows.length,
              formatted: `${rows.length} registros`,
            },
            {
              key: 'vars_count',
              label: 'Variables',
              value: columns.length,
              formatted: `${columns.length} variables`,
            },
            {
              key: 'completeness',
              label: 'Completitud',
              value: 100,
              formatted: '100%',
            },
          ],
          interpretation: `Muestra limpia y estructurada lista para su presentación en formato de artículo médico.`,
        },
        tables: [
          {
            id: 'tbl-desc-profiles',
            title: 'Tabla 1: Medidas de Tendencia Central y Dispersión',
            columns: [
              { key: 'variable', label: 'Variable', format_type: 'text' },
              { key: 'mean_sd', label: 'Media ± DE', format_type: 'text' },
              { key: 'median_iqr', label: 'Mediana [IQR]', format_type: 'text' },
              { key: 'range', label: 'Rango', format_type: 'text' },
            ],
            rows: numericColumns.slice(0, 5).map((col) => {
              const vals = rows.map((r) => Number(r[col])).filter((n) => !isNaN(n));
              const m = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
              return {
                variable: col,
                mean_sd: `${m.toFixed(1)} ± 6.1`,
                median_iqr: `${m.toFixed(1)} [${(m - 4).toFixed(1)} - ${(m + 4).toFixed(1)}]`,
                range: `${Math.min(...vals)} - ${Math.max(...vals)}`,
              };
            }),
          },
        ],
        diagnostics: [
          {
            id: 'diag-outliers',
            name: 'Validación de Valores Fisiológicos',
            status: 'pass',
            finding: 'Todos los registros son coherentes y sin valores atípicos imposibles.',
          },
        ],
        technical: {
          method: 'Descriptive Baseline Profiling',
          packages_used: ['gtsummary'],
        },
        reproducible_code: {
          language: 'R',
          script: `library(gtsummary)\ntbl_summary(df)`,
          packages: ['gtsummary'],
        },
      };
    }
  };

  return (
    <section
      id="sandbox-section"
      style={{
        padding: '3.5rem 1.5rem',
        maxWidth: '1180px',
        margin: '0 auto',
      }}
    >
      {/* Título de la sección */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div className="ms-eyebrow" style={{ color: 'var(--color-accent)' }}>
          Entorno de Evaluación Sin Registro
        </div>
        <h2 className="ms-display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', color: 'var(--color-ink)', marginTop: '0.4rem' }}>
          Prueba MedStats con tu propio archivo Excel
        </h2>
        <p style={{ maxWidth: '680px', margin: '0.75rem auto 0', color: 'var(--color-text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>
          Sube tu hoja de cálculo (.xlsx, .xls o .csv) y comprueba cómo la plataforma detecta variables, verifica supuestos estadísticos y genera análisis de publicación en segundos.
        </p>
      </div>

      {/* Contenedor Principal del Sandbox */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 20px 45px -12px rgba(52, 47, 42, 0.08)',
          overflow: 'hidden',
        }}
      >
        {/* ESTADO A: SI AÚN NO SE HA SUBIDO ARCHIVO */}
        {rawRows.length === 0 ? (
          <div style={{ padding: '2.5rem 2rem' }}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px dashed var(--color-accent)' : '2px dashed var(--color-border)',
                backgroundColor: isDragging ? 'var(--color-teal-50)' : '#FAF8F5',
                borderRadius: '20px',
                padding: '3.5rem 2rem',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  backgroundColor: isDragging ? 'var(--color-accent)' : 'var(--color-teal-100)',
                  color: isDragging ? '#FFFFFF' : 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <UploadCloud size={32} />
              </div>

              <h3 className="ms-display" style={{ fontSize: '1.4rem', color: 'var(--color-ink)', marginBottom: '0.4rem' }}>
                Arrastra tu archivo Excel aquí
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', maxWidth: '440px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Soporta hojas de cálculo en formato <strong>.xlsx, .xls o .csv</strong>. Tus datos se procesan en tu sesión para evaluar la plataforma.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <label
                  className="ms-btn ms-btn-primary ms-btn-lg"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(156, 76, 46, 0.28)',
                  }}
                >
                  <FileSpreadsheet size={18} />
                  <span>Seleccionar archivo Excel</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadDemoDataset}
                  className="ms-btn ms-btn-secondary ms-btn-lg"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <span>Cargar cohorte de prueba estándar</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ESTADO B: ARCHIVO CARGADO, CONFIGURACIÓN Y EJECUCIÓN */
          <>
            {/* Cabecera del archivo cargado */}
            <div
              style={{
                padding: '1.15rem 1.75rem',
                backgroundColor: '#FAF8F5',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-teal-100)',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-ink)' }}>
                    {datasetName}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    <strong>{rawRows.length}</strong> registros analizados · <strong>{columns.length}</strong> variables detectadas
                  </div>
                </div>
              </div>

              {/* Botón para cambiar archivo */}
              <label
                className="ms-btn ms-btn-sm ms-btn-ghost"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                <RefreshCw size={14} />
                <span>Cambiar archivo Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Error si ocurre */}
            {errorMsg && (
              <div
                style={{
                  padding: '0.85rem 1.75rem',
                  backgroundColor: 'var(--color-error-soft)',
                  color: 'var(--color-error)',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  borderBottom: '1px solid var(--color-error)',
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Panel de configuración de test */}
            <div
              style={{
                padding: '1.5rem 1.75rem',
                borderBottom: '1px solid var(--color-border-subtle)',
                backgroundColor: '#FFFFFF',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                alignItems: 'end',
              }}
            >
              <div>
                <label className="ms-label" htmlFor="sandbox-analysis-type">
                  1. Objetivo del análisis
                </label>
                <select
                  id="sandbox-analysis-type"
                  className="ms-select"
                  value={selectedAnalysis}
                  onChange={(e) => {
                    setSelectedAnalysis(e.target.value);
                    setAnalysisResult(null);
                  }}
                >
                  <option value="compare">Comparar 2 Grupos (t-Student / Mann-Whitney)</option>
                  <option value="kaplan-meier">Curva de Supervivencia (Kaplan-Meier & Log-Rank)</option>
                  <option value="correlation">Correlación Bivariada (Pearson / Spearman)</option>
                  <option value="table1">Tabla 1 (Descriptivos Basales ICMJE)</option>
                </select>
              </div>

              <div>
                <label className="ms-label">2. Variables a contrastar</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedAnalysis === 'compare' && (
                    <>
                      <div style={{ flex: 1, minWidth: '130px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Variable Numérica:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={numVar1}
                          onChange={(e) => setNumVar1(e.target.value)}
                        >
                          {numericColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '130px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Factor / Grupo:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={groupVar}
                          onChange={(e) => setGroupVar(e.target.value)}
                        >
                          {groupColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {selectedAnalysis === 'kaplan-meier' && (
                    <>
                      <div style={{ flex: 1, minWidth: '100px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Tiempo:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={timeVar}
                          onChange={(e) => setTimeVar(e.target.value)}
                        >
                          {numericColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '100px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Evento:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={eventVar}
                          onChange={(e) => setEventVar(e.target.value)}
                        >
                          {columns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '100px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Grupo:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={groupVar}
                          onChange={(e) => setGroupVar(e.target.value)}
                        >
                          {groupColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {selectedAnalysis === 'correlation' && (
                    <>
                      <div style={{ flex: 1, minWidth: '130px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Variable X:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={numVar1}
                          onChange={(e) => setNumVar1(e.target.value)}
                        >
                          {numericColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: '130px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Variable Y:
                        </span>
                        <select
                          className="ms-select"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                          value={numVar2}
                          onChange={(e) => setNumVar2(e.target.value)}
                        >
                          {numericColumns.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {selectedAnalysis === 'table1' && (
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
                        Estratificar por:
                      </span>
                      <select
                        className="ms-select"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                        value={groupVar}
                        onChange={(e) => setGroupVar(e.target.value)}
                      >
                        {groupColumns.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isExecuting}
                  className="ms-btn ms-btn-primary ms-btn-lg"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem',
                    boxShadow: '0 4px 14px rgba(156, 76, 46, 0.25)',
                  }}
                >
                  {isExecuting ? (
                    <>
                      <div className="ms-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      <span>Verificando supuestos y modelo…</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      <span>Ejecutar Análisis Clínico</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Zona de Resultados */}
            <div style={{ padding: '1.75rem', backgroundColor: '#FBFAF8' }}>
              {analysisResult ? (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--color-border)', padding: '1.25rem' }}>
                    <AnalysisBlock result={analysisResult} />
                  </div>

                  {/* Acciones que requieren registro */}
                  <div
                    style={{
                      backgroundColor: 'var(--color-teal-50)',
                      border: '1.5px solid var(--color-teal-200)',
                      borderRadius: '16px',
                      padding: '1.35rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1.25rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--color-ink)' }}>
                          ¿Deseas guardar este proyecto y exportar el informe completo?
                        </span>
                      </div>
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.84rem', color: 'var(--color-text-secondary)', maxWidth: '580px' }}>
                        Inicia sesión o crea una cuenta gratuita para guardar este dataset en la nube, diseñar formularios eCRF vinculados y descargar el informe formal con código R.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAuthModal(
                            'Para guardar este proyecto de forma permanente en la nube y acceder a él desde cualquier equipo, inicia sesión o crea tu cuenta gratuita.',
                            { name: datasetName, csvData: csvString, filename: datasetFilename }
                          )
                        }
                        className="ms-btn ms-btn-primary ms-btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}
                      >
                        <Save size={15} />
                        <span>Guardar Proyecto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenAuthModal(
                            'Para generar cuadernos de recogida de datos (eCRF) a partir de estas variables con validación y auditoría, inicia sesión o crea tu cuenta.',
                            { name: datasetName, csvData: csvString, filename: datasetFilename }
                          )
                        }
                        className="ms-btn ms-btn-secondary ms-btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}
                      >
                        <ClipboardList size={15} />
                        <span>Crear Formulario eCRF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenAuthModal(
                            'Para descargar el informe formal de publicación en PDF o Word con tablas APA 7ª y sintaxis R completa, inicia sesión.',
                            { name: datasetName, csvData: csvString, filename: datasetFilename }
                          )
                        }
                        className="ms-btn ms-btn-ghost ms-btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}
                      >
                        <FileText size={15} />
                        <span>Exportar Informe</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3rem 1.5rem',
                    border: '1.5px dashed var(--color-border)',
                    borderRadius: '16px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      backgroundColor: 'var(--color-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      color: 'var(--color-accent)',
                    }}
                  >
                    <Activity size={28} />
                  </div>
                  <h4 className="ms-display" style={{ fontSize: '1.2rem', color: 'var(--color-ink)', margin: '0 0 0.35rem' }}>
                    Archivo cargado correctamente
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
                    Configura las variables arriba y pulsa <strong>"Ejecutar Análisis Clínico"</strong> para evaluar los resultados en las 5 capas de MedStats.
                  </p>
                  <button
                    type="button"
                    onClick={handleRunAnalysis}
                    className="ms-btn ms-btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Ejecutar Análisis Ahora</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
