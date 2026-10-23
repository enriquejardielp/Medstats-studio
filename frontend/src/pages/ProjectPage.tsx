import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  BarChart3,
  X,
  History,
  Settings,
  FileText,
  Maximize2,
  Minimize2,
  TrendingUp,
  GitCompare,
  Activity,
  Table2,
  Layers,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import apiClient from '../api/client';
import type { ColumnType } from '../types';
import type { AnalysisResult } from '../types/analysis';
import { OutputViewer } from '../components/output/OutputViewer';

// ============================================================
// Cabecera personalizada con selector de tipo
// ============================================================
class TypeSelectorHeader {
  private eGui!: HTMLDivElement;

  init(params: any) {
    const field = params.column.getColId();
    const displayName = params.displayName || field;
    const currentType = params.columnType || 'text';
    const onTypeChange = params.onTypeChange;

    this.eGui = document.createElement('div');
    this.eGui.style.display = 'flex';
    this.eGui.style.flexDirection = 'column';
    this.eGui.style.alignItems = 'flex-start';
    this.eGui.style.justifyContent = 'center';
    this.eGui.style.width = '100%';
    this.eGui.style.padding = '6px 10px';
    this.eGui.style.gap = '5px';

    const nameSpan = document.createElement('span');
    nameSpan.style.fontSize = '14px';
    nameSpan.style.fontWeight = '700';
    nameSpan.style.color = '#252422';
    nameSpan.style.maxWidth = '100%';
    nameSpan.style.overflow = 'hidden';
    nameSpan.style.textOverflow = 'ellipsis';
    nameSpan.style.whiteSpace = 'nowrap';
    nameSpan.style.lineHeight = '1.3';
    nameSpan.style.letterSpacing = '-0.01em';
    nameSpan.textContent = displayName;
    nameSpan.title = displayName;

    const select = document.createElement('select');
    select.style.fontSize = '12px';
    select.style.fontWeight = '600';
    select.style.padding = '4px 8px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid #CCC5B9';
    select.style.background = '#FFFFFF';
    select.style.color = '#252422';
    select.style.cursor = 'pointer';
    select.style.height = '30px';
    select.style.width = '100%';
    select.style.outline = 'none';
    select.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';

    const typeLabels: Record<string, string> = {
      numeric: '123 Numérica',
      categorical: 'ABC Categórica',
      binary: '0/1 Binaria',
      date: '📅 Fecha',
      id: '🔑 ID',
      text: '📝 Texto',
    };

    const types: ColumnType[] = ['numeric', 'categorical', 'binary', 'date', 'id', 'text'];
    types.forEach(t => {
      const option = document.createElement('option');
      option.value = t;
      option.text = typeLabels[t] || t;
      if (t === currentType) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', (event) => {
      const newType = (event.target as HTMLSelectElement).value as ColumnType;
      if (onTypeChange) onTypeChange(field, newType);
    });

    this.eGui.appendChild(nameSpan);
    this.eGui.appendChild(select);
  }

  getGui() { return this.eGui; }
  refresh(): boolean { return false; }
  destroy() {}
}

// ============================================================
// Componente principal
// ============================================================
type RowData = { [key: string]: any };

interface ProjectInfo {
  id: number;
  name: string;
  filename: string;
  row_count: number;
  columns: string[];
  description?: string;
  column_types?: Record<string, string>;
}

interface AnalysisOption {
  id: string;
  label: string;
  category: string;
  badge?: string;
  icon: React.ReactNode;
  description: string;
  requiredTypes: { numeric: number; categorical: number };
  allowMore: boolean;
}

const analysisOptions: AnalysisOption[] = [
  {
    id: 'descriptive',
    label: 'Estadística Descriptiva',
    category: '1. Descriptiva y Basal',
    badge: 'Media, DE, Mediana, IQR',
    icon: <BarChart3 size={18} color="#EB5E28" />,
    description: 'Resumen numérico y categórico univariado con test de normalidad.',
    requiredTypes: { numeric: 1, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'table1',
    label: 'Tabla 1 Basal (Lancet / NEJM)',
    category: '1. Descriptiva y Basal',
    badge: 'Características Basales',
    icon: <Table2 size={18} color="#EB5E28" />,
    description: 'Demografía y variables basales estratificadas con comparaciones.',
    requiredTypes: { numeric: 1, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'compare',
    label: 'Comparar 2 Grupos (t / Mann-Whitney)',
    category: '2. Comparación de Grupos',
    badge: 't de Student / Welch / U',
    icon: <GitCompare size={18} color="#EB5E28" />,
    description: 'Diferencia de medias o rangos para muestras independientes o pareadas.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'anova',
    label: 'Comparar 3+ Grupos (ANOVA / Kruskal)',
    category: '2. Comparación de Grupos',
    badge: 'ANOVA / Kruskal-Wallis',
    icon: <Layers size={18} color="#EB5E28" />,
    description: 'Prueba F global, homocedasticidad de Levene y comparaciones post-hoc Tukey.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'correlation',
    label: 'Correlación Bivariada',
    category: '3. Asociación y Contingencia',
    badge: 'Pearson / Spearman',
    icon: <TrendingUp size={18} color="#EB5E28" />,
    description: 'Fuerza y dirección de asociación lineal o monótona con IC 95%.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: false,
  },
  {
    id: 'chi-square',
    label: 'Tablas de Contingencia (Chi² / Fisher)',
    category: '3. Asociación y Contingencia',
    badge: 'Odds Ratio / Riesgo Relativo',
    icon: <Sparkles size={18} color="#EB5E28" />,
    description: 'Asociación entre cualitativas, corrección de Yates y corrección de Haldane.',
    requiredTypes: { numeric: 0, categorical: 2 },
    allowMore: false,
  },
  {
    id: 'linear-regression',
    label: 'Regresión Lineal Múltiple',
    category: '4. Modelos Predictivos',
    badge: 'Ajuste de Covariables',
    icon: <SlidersHorizontal size={18} color="#EB5E28" />,
    description: 'Estimación de coeficientes beta, R² ajustado y diagnóstico de residuos.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'logistic-regression',
    label: 'Regresión Logística Binaria',
    category: '4. Modelos Predictivos',
    badge: 'Odds Ratios Ajustados',
    icon: <Activity size={18} color="#EB5E28" />,
    description: 'Modelado de desenlace clínico binario con Hosmer-Lemeshow y Nagelkerke.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: true,
  },
  {
    id: 'roc-curve',
    label: 'Curva ROC & Biomarcadores',
    category: '5. Medicina Diagnóstica & Supervivencia',
    badge: 'AUC & Índice Youden',
    icon: <Activity size={18} color="#EB5E28" />,
    description: 'Capacidad diagnóstica, sensibilidad, especificidad y punto de corte.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'kaplan-meier',
    label: 'Supervivencia Kaplan-Meier',
    category: '5. Medicina Diagnóstica & Supervivencia',
    badge: 'Curvas & Log-Rank Test',
    icon: <Activity size={18} color="#EB5E28" />,
    description: 'Tiempo hasta el evento, medianas de supervivencia y contraste Log-Rank.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
];

const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [rowData, setRowData] = useState<RowData[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [columnTypes, setColumnTypes] = useState<Record<string, ColumnType>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'history'>('config');
  const [outputResults, setOutputResults] = useState<AnalysisResult[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisOption | null>(null);
  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [selectedRoleValues, setSelectedRoleValues] = useState<Record<string, string | string[]>>({});

  const [_analysisResult, setAnalysisResult] = useState<any>(null);
  const [, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [useNonParametric, setUseNonParametric] = useState(false);
  const [confLevel, setConfLevel] = useState<number>(0.95);
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [newCovariateOption, setNewCovariateOption] = useState('Edad');
  const [covariates, setCovariates] = useState<Array<{id:string; name:string; type:string; status:string}>>([
    { id: 'cov-1', name: 'Edad (Pacientes)', type: 'Numérica', status: 'Verificada' },
    { id: 'cov-2', name: 'Género (Biomarcador)', type: 'Categoría', status: 'Verificada' },
  ]);
  const [history, setHistory] = useState<any[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  const arrayBasedTests = ['shapiro', 'compare', 'correlation', 'chi-square', 'z-test', 'kolmogorov-smirnov'];

  const handleTypeChange = useCallback((field: string, newType: ColumnType) => {
    setColumnTypes(prev => ({ ...prev, [field]: newType }));
    setColumnDefs(prevCols =>
      prevCols.map(col => {
        if (col.field === field) {
          const isNumeric = newType === 'numeric';
          const isCategorical = ['categorical', 'binary'].includes(newType);
          return {
            ...col,
            headerClass: isNumeric ? 'numeric-header' : isCategorical ? 'categorical-header' : '',
            cellDataType: isNumeric ? 'number' : 'text',
            cellClassRules: {
              'ag-cell-invalid': (params: any) =>
                isNumeric && params.value !== '' && isNaN(Number(params.value)),
            },
            headerComponentParams: {
              ...col.headerComponentParams,
              columnType: newType,
            },
          };
        }
        return col;
      })
    );
  }, []);

  const loadProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const projRes = await apiClient.get(`/api/projects/${id}`);
      const proj: ProjectInfo = projRes.data;
      setProject(proj);

      const dataRes = await apiClient.get(`/api/projects/${id}/data`);
      const { columns, types, data } = dataRes.data;
      const initialTypes: Record<string, ColumnType> = {};
      columns.forEach((col: string) => {
        initialTypes[col] = types?.[col] || 'text';
      });
      setColumnTypes(initialTypes);
      setRowData(data);

      const cols: ColDef[] = columns.map((colName: string) => {
        const colType: ColumnType = initialTypes[colName] || 'text';
        const isNumeric = colType === 'numeric';
        const isCategorical = ['categorical', 'binary'].includes(colType);

        return {
          field: colName,
          headerName: colName,
          headerComponent: TypeSelectorHeader,
          headerComponentParams: {
            displayName: colName,
            columnType: colType,
            onTypeChange: handleTypeChange,
          },
          headerTooltip: isNumeric ? 'Numérica' : isCategorical ? 'Categórica' : 'Texto',
          cellDataType: isNumeric ? 'number' : 'text',
          sortable: true,
          filter: true,
          resizable: true,
          minWidth: 160,
          flex: 1,
          editable: true,
          cellClassRules: {
            'ag-cell-invalid': (params: any) =>
              isNumeric && params.value !== '' && isNaN(Number(params.value)),
          },
        };
      });

      setColumnDefs(cols);
    } catch {
      setError('Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  }, [id, handleTypeChange]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleSave = async () => {
    if (!gridRef.current || !id) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const gridApi = gridRef.current.api;
      const allRows: RowData[] = [];
      gridApi.forEachNode((node) => {
        if (node.data) allRows.push(node.data);
      });
      await apiClient.put(`/api/projects/${id}/data`, {
        data: allRows,
        types: columnTypes,
      });
      setSuccessMsg('Datos guardados correctamente');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const togglePanel = () => {
    setPanelOpen(!panelOpen);
  };

  const handleDeleteOutputResult = (analysisId: string) => {
    setOutputResults(prev => prev.filter(r => r.metadata.analysis_id !== analysisId));
  };

  const handleClearAllOutputs = () => {
    setOutputResults([]);
  };

  const resetAnalysisModalState = () => {
    setAnalysisNotes('');
    setUseNonParametric(false);
    setNewCovariateOption('Edad');
    setCovariates([
      { id: 'cov-1', name: 'Edad (Pacientes)', type: 'Numérica', status: 'Verificada' },
      { id: 'cov-2', name: 'Género (Biomarcador)', type: 'Categoría', status: 'Verificada' },
    ]);
  };

  const openAnalysisModal = (analysis: AnalysisOption) => {
    setSelectedAnalysis(analysis);
    setSelectedVars([]);
    setSelectedRoleValues({});
    resetAnalysisModalState();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedAnalysis(null);
    setSelectedVars([]);
    setSelectedRoleValues({});
    resetAnalysisModalState();
  };

  const getCurrentSelectedVars = useCallback(() => {
    if (!selectedAnalysis) return selectedVars;

    switch (selectedAnalysis.id) {
      case 'linear-regression':
      case 'logistic-regression': {
        const depVar = selectedRoleValues.dep_var as string | undefined;
        const indepVars = (selectedRoleValues.indep_vars as string[] | undefined) || [];
        return depVar ? [depVar, ...indepVars] : indepVars;
      }
      case 'anova': {
        const depVar = selectedRoleValues.dep_var as string | undefined;
        const groupVar = selectedRoleValues.group_var as string | undefined;
        return depVar && groupVar ? [depVar, groupVar] : depVar ? [depVar] : [];
      }
      case 'compare': {
        const numVar = selectedRoleValues.num_var as string | undefined;
        const catVar = selectedRoleValues.cat_var as string | undefined;
        return numVar && catVar ? [numVar, catVar] : [];
      }
      case 'correlation': {
        const var1 = selectedRoleValues.var1 as string | undefined;
        const var2 = selectedRoleValues.var2 as string | undefined;
        return var1 && var2 ? [var1, var2] : [];
      }
      case 'chi-square': {
        const var1 = selectedRoleValues.var1 as string | undefined;
        const var2 = selectedRoleValues.var2 as string | undefined;
        return var1 && var2 ? [var1, var2] : [];
      }
      case 'roc-curve': {
        const outcome = selectedRoleValues.outcome as string | undefined;
        const predictor = selectedRoleValues.predictor as string | undefined;
        return outcome && predictor ? [outcome, predictor] : [];
      }
      case 'kaplan-meier': {
        const timeVar = selectedRoleValues.time_var as string | undefined;
        const eventVar = selectedRoleValues.event_var as string | undefined;
        const groupVar = selectedRoleValues.group_var as string | undefined;
        return timeVar && eventVar ? [timeVar, eventVar, ...(groupVar ? [groupVar] : [])] : [];
      }
      default:
        return selectedVars;
    }
  }, [selectedAnalysis, selectedRoleValues, selectedVars]);

  const isSelectionComplete = useCallback(() => {
    if (!selectedAnalysis) return false;
    const currentSelectedVars = getCurrentSelectedVars();

    switch (selectedAnalysis.id) {
      case 'linear-regression':
      case 'logistic-regression':
        return Boolean(selectedRoleValues.dep_var) && ((selectedRoleValues.indep_vars as string[] | undefined)?.length ?? 0) > 0;
      case 'anova':
        return Boolean(selectedRoleValues.dep_var) && Boolean(selectedRoleValues.group_var);
      case 'compare':
        return Boolean(selectedRoleValues.num_var) && Boolean(selectedRoleValues.cat_var);
      case 'correlation':
        return Boolean(selectedRoleValues.var1) && Boolean(selectedRoleValues.var2);
      case 'chi-square':
        return Boolean(selectedRoleValues.var1) && Boolean(selectedRoleValues.var2);
      case 'roc-curve':
        return Boolean(selectedRoleValues.outcome) && Boolean(selectedRoleValues.predictor);
      case 'kaplan-meier':
        return Boolean(selectedRoleValues.time_var) && Boolean(selectedRoleValues.event_var);
      default:
        return currentSelectedVars.length > 0;
    }
  }, [getCurrentSelectedVars, selectedAnalysis, selectedRoleValues]);

  const getAllowedColumnsForRole = useCallback((role: string) => {
    if (!selectedAnalysis || !columnTypes) return [];
    const entries = Object.entries(columnTypes);

    const isNumeric = (colName: string) => columnTypes[colName] === 'numeric';
    const isCategorical = (colName: string) => ['categorical', 'binary'].includes(columnTypes[colName]);

    switch (selectedAnalysis.id) {
      case 'linear-regression':
        return entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
      case 'logistic-regression':
        if (role === 'dep') return entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
        return entries.filter(([colName]) => isNumeric(colName) || isCategorical(colName)).map(([colName]) => colName);
      case 'anova':
        if (role === 'dep') return entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        return entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
      case 'compare':
        if (role === 'num') return entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        return entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
      case 'correlation':
        return entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
      case 'chi-square':
        return entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
      case 'roc-curve':
        if (role === 'outcome') return entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
        return entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
      case 'kaplan-meier':
        if (role === 'time') return entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        return entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
      default:
        return entries.map(([colName]) => colName);
    }
  }, [columnTypes, selectedAnalysis]);

  const addCovariate = () => {
    const name = newCovariateOption;
    const type = name.startsWith('Edad') || name.startsWith('PSistólica') ? 'Numérica' : name.startsWith('Género') ? 'Categoría' : 'Ordinal';

    if (covariates.some(c => c.name.includes(name))) return;

    setCovariates(prev => [
      ...prev,
      {
        id: `cov-${Date.now()}`,
        name: `${name} (Ajuste)`,
        type,
        status: 'Verificada',
      },
    ]);
  };

  const deleteCovariate = (id: string) => {
    setCovariates(prev => prev.filter(c => c.id !== id));
  };

  const getRecommendedTestInfo = useCallback(() => {
    if (!selectedAnalysis) {
      return {
        title: 'Test no seleccionado',
        explanation: 'Selecciona un análisis para recibir sugerencias inteligentes.',
        alternative: 'Seleccione un test',
      };
    }

    const hasCovariates = covariates.length > 0;
    const np = useNonParametric;
    let title = selectedAnalysis.label;
    let explanation = selectedAnalysis.description;
    let alternative = 'Alternativa no paramétrica';

    switch (selectedAnalysis.id) {
      case 'compare':
        title = np ? 'Prueba U de Mann-Whitney' : 'Prueba t de Student para Muestras Independientes';
        explanation = hasCovariates
          ? 'Comparación de medias entre dos grupos ajustando por covariables de confusión.'
          : 'Compara el descenso promedio entre dos grupos independientes.';
        alternative = 'U de Mann-Whitney';
        break;
      case 'anova':
        title = np ? 'Kruskal-Wallis' : 'ANOVA de una vía';
        explanation = hasCovariates
          ? 'Evalúa diferencias entre grupos con ajustes por covariables.'
          : 'Compara las medias de múltiples grupos categóricos.';
        alternative = 'Kruskal-Wallis';
        break;
      case 'correlation':
        title = np ? 'Correlación de Spearman' : 'Correlación de Pearson';
        explanation = 'Mide el grado de asociación entre dos variables numéricas.';
        alternative = 'Spearman';
        break;
      case 'linear-regression':
        title = 'Regresión Lineal Simple / Múltiple';
        explanation = hasCovariates
          ? 'Modelo lineal que controla covariables adicionales.'
          : 'Estima la relación lineal entre la variable dependiente y los predictores.';
        alternative = 'Regresión robusta';
        break;
      case 'logistic-regression':
        title = 'Regresión Logística';
        explanation = 'Modela la probabilidad de un outcome binario en función de predictores.';
        alternative = 'Regresión logística penalizada';
        break;
      case 'chi-square':
        title = 'Chi-cuadrado de Pearson';
        explanation = 'Analiza la asociación entre dos variables categóricas.';
        alternative = 'Test exacto de Fisher';
        break;
      case 'kaplan-meier':
        title = 'Kaplan-Meier';
        explanation = 'Estimación de curvas de supervivencia por grupos.';
        alternative = 'Test de log-rank';
        break;
      case 'roc-curve':
        title = 'Curva ROC';
        explanation = 'Evalúa la capacidad predictiva de una variable continua para un outcome binario.';
        alternative = 'AUC';
        break;
      case 'descriptive':
        title = 'Análisis Descriptivo';
        explanation = 'Resúmenes estadísticos básicos de las variables seleccionadas.';
        alternative = 'Resumen exploratorio de datos';
        break;
      default:
        break;
    }

    return { title, explanation, alternative };
  }, [selectedAnalysis, covariates.length, useNonParametric]);

  const handleRunAnalysis = async () => {
    if (!selectedAnalysis || !isSelectionComplete()) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setModalOpen(false);

    try {
      const test = selectedAnalysis.id;
      const currentSelectedVars = getCurrentSelectedVars();

      // Módulos de la Nueva Arquitectura (Stata + SPSS + R)
      const unifiedTests = [
        'descriptive',
        'correlation',
        'linear-regression',
        'logistic-regression',
        'compare',
        'anova',
        'chi-square',
        'roc-curve',
        'kaplan-meier',
        'table1',
      ];

      if (unifiedTests.includes(test)) {
        let params: any = {};
        if (test === 'descriptive') {
          params = { columns: currentSelectedVars };
        } else if (test === 'correlation') {
          const v1 = (selectedRoleValues.var1 as string) || currentSelectedVars[0];
          const v2 = (selectedRoleValues.var2 as string) || currentSelectedVars[1];
          if (!v1 || !v2) {
            setAnalysisError('Debes seleccionar dos variables para la correlación.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            var1: v1,
            var2: v2,
            method: useNonParametric ? 'spearman' : 'pearson',
            conf_level: confLevel,
          };
        } else if (test === 'linear-regression') {
          const depVar = selectedRoleValues.dep_var as string;
          const indepVars = (selectedRoleValues.indep_vars as string[]) || [];
          if (!depVar || indepVars.length === 0) {
            setAnalysisError('Debes seleccionar una variable dependiente y al menos una independiente.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            dep_var: depVar,
            indep_vars: indepVars,
            conf_level: confLevel,
          };
        } else if (test === 'logistic-regression') {
          const depVar = selectedRoleValues.dep_var as string;
          const indepVars = (selectedRoleValues.indep_vars as string[]) || [];
          if (!depVar || indepVars.length === 0) {
            setAnalysisError('Debes seleccionar la variable dependiente binaria y los predictores.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            dep_var: depVar,
            indep_vars: indepVars,
            conf_level: confLevel,
          };
        } else if (test === 'compare') {
          const numVar = selectedRoleValues.num_var as string;
          const catVar = selectedRoleValues.cat_var as string;
          if (!numVar || !catVar) {
            setAnalysisError('Debes seleccionar una variable numérica y una categórica de 2 grupos.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            num_var: numVar,
            cat_var: catVar,
            method: useNonParametric ? 'mannwhitney' : 'welch',
            paired: isPaired,
            conf_level: confLevel,
          };
        } else if (test === 'anova') {
          const depVar = selectedRoleValues.dep_var as string;
          const groupVar = selectedRoleValues.group_var as string;
          if (!depVar || !groupVar) {
            setAnalysisError('Debes seleccionar una variable dependiente numérica y un factor de agrupación.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            dep_var: depVar,
            group_var: groupVar,
            method: useNonParametric ? 'nonparametric' : 'parametric',
          };
        } else if (test === 'chi-square') {
          const v1 = (selectedRoleValues.var1 as string) || currentSelectedVars[0];
          const v2 = (selectedRoleValues.var2 as string) || currentSelectedVars[1];
          if (!v1 || !v2) {
            setAnalysisError('Debes seleccionar dos variables categóricas para la tabla de contingencia.');
            setAnalysisLoading(false);
            return;
          }
          params = { var1: v1, var2: v2 };
        } else if (test === 'roc-curve') {
          const outcome = selectedRoleValues.outcome as string;
          const predictor = selectedRoleValues.predictor as string;
          if (!outcome || !predictor) {
            setAnalysisError('Debes seleccionar la variable de desenlace (outcome) y el biomarcador.');
            setAnalysisLoading(false);
            return;
          }
          params = { outcome, predictor, conf_level: confLevel };
        } else if (test === 'kaplan-meier') {
          const timeVar = selectedRoleValues.time_var as string;
          const eventVar = selectedRoleValues.event_var as string;
          const groupVar = selectedRoleValues.group_var as string | undefined;
          if (!timeVar || !eventVar) {
            setAnalysisError('Debes seleccionar la variable de tiempo y la de evento.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            time_var: timeVar,
            event_var: eventVar,
            group_var: groupVar || null,
            conf_level: confLevel,
          };
        } else if (test === 'table1') {
          if (currentSelectedVars.length === 0) {
            setAnalysisError('Debes seleccionar al menos una variable para la Tabla 1.');
            setAnalysisLoading(false);
            return;
          }
          const catCol = currentSelectedVars.find(c => columnTypes[c] === 'categorical' || columnTypes[c] === 'binary');
          params = {
            variables: currentSelectedVars,
            group_var: catCol || null,
            decimals: 2,
          };
        }

        const response = await apiClient.post('/api/analysis/run', {
          project_id: parseInt(id!),
          analysis_type: test,
          params,
        });

        const structuredResult: AnalysisResult = response.data;
        setOutputResults(prev => [structuredResult, ...prev]);
        setAnalysisResult(structuredResult);
        setActiveTab('results');
        if (!panelOpen) setPanelOpen(true);

        const entry = {
          id: structuredResult.metadata.analysis_id,
          timestamp: new Date(),
          testName: test,
          variables: currentSelectedVars,
          pValue: structuredResult.summary.key_metrics.find(m => m.p_value !== undefined)?.p_value ?? null,
          result: structuredResult,
        };
        setHistory(prev => [entry, ...prev]);
        setViewingHistoryId(null);
        return;
      }

      let endpoint = `/api/${test}`;
      let payload: any = {};

      if (arrayBasedTests.includes(test)) {
        switch (test) {
          case 'shapiro': {
            const col = selectedVars[0];
            const values = rowData.map(r => Number(r[col])).filter(v => !isNaN(v));
            payload = { values };
            break;
          }
          case 'compare': {
            const numCol = selectedRoleValues.num_var as string | undefined;
            const catCol = selectedRoleValues.cat_var as string | undefined;
            if (!numCol || !catCol) return;
            const groups: Record<string, number[]> = {};
            rowData.forEach(r => {
              const key = String(r[catCol]);
              if (!groups[key]) groups[key] = [];
              const val = Number(r[numCol]);
              if (!isNaN(val)) groups[key].push(val);
            });
            const groupKeys = Object.keys(groups);
            if (groupKeys.length < 2) {
              setAnalysisError('La variable categórica debe tener al menos dos grupos.');
              setAnalysisLoading(false);
              return;
            }
            const selectedMethod = useNonParametric ? 'mannwhitney' : 'welch';
            payload = {
              group1: groups[groupKeys[0]],
              group2: groups[groupKeys[1]],
              paired: isPaired,
              method: selectedMethod,
              conf_level: confLevel
            };
            break;
          }
          case 'correlation': {
            const col1 = selectedRoleValues.var1 as string | undefined;
            const col2 = selectedRoleValues.var2 as string | undefined;
            if (!col1 || !col2) return;
            const s1: number[] = [];
            const s2: number[] = [];
            rowData.forEach(r => {
              const v1 = Number(r[col1]);
              const v2 = Number(r[col2]);
              if (!isNaN(v1) && !isNaN(v2)) { s1.push(v1); s2.push(v2); }
            });
            const selectedMethod = useNonParametric ? 'spearman' : 'pearson';
            payload = {
              series1: s1,
              series2: s2,
              method: selectedMethod,
              conf_level: confLevel
            };
            break;
          }
          case 'chi-square': {
            const col1 = selectedRoleValues.var1 as string | undefined;
            const col2 = selectedRoleValues.var2 as string | undefined;
            if (!col1 || !col2) return;
            payload = {
              var1: rowData.map(r => String(r[col1])),
              var2: rowData.map(r => String(r[col2])),
            };
            break;
          }
          default:
            setAnalysisError(`Test "${test}" aún no está implementado.`);
            setAnalysisLoading(false);
            return;
        }
      } else {
        payload = { project_id: parseInt(id!), conf_level: confLevel };
        switch (test) {
          case 'anova':
            payload.dep_var = selectedRoleValues.dep_var;
            payload.group_var = selectedRoleValues.group_var;
            payload.method = useNonParametric ? 'nonparametric' : 'parametric';
            break;
          case 'linear-regression':
          case 'logistic-regression':
            payload.dep_var = selectedRoleValues.dep_var;
            payload.indep_vars = (selectedRoleValues.indep_vars as string[] | undefined) || [];
            break;
          case 'roc-curve':
            payload.outcome = selectedRoleValues.outcome;
            payload.predictor = selectedRoleValues.predictor;
            break;
          case 'table1':
            payload.variables = currentSelectedVars;
            const catCol = currentSelectedVars.find(c => columnTypes[c] === 'categorical' || columnTypes[c] === 'binary');
            payload.group_var = catCol || null;
            break;
          case 'descriptive':
            payload = { project_id: parseInt(id!), columns: currentSelectedVars };
            break;
          case 'kaplan-meier':
            if (selectedRoleValues.time_var && selectedRoleValues.event_var) {
              payload.time_var = selectedRoleValues.time_var;
              payload.event_var = selectedRoleValues.event_var;
              if (selectedRoleValues.group_var) payload.group_var = selectedRoleValues.group_var;
            }
            break;
          default:
            payload.variables = currentSelectedVars;
        }
      }

      const response = await apiClient.post(endpoint, payload);
      const result = response.data;
      setAnalysisResult(result);

      const entry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        testName: test,
        variables: currentSelectedVars,
        pValue: result.p_valor ?? null,
        result,
      };
      setHistory(prev => [entry, ...prev]);
      setViewingHistoryId(null);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        const messages = detail.map((d: any) => d.msg).join(', ');
        setAnalysisError(messages || 'Error de validación');
      } else {
        setAnalysisError(typeof detail === 'string' ? detail : 'Error al ejecutar el análisis');
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const viewHistoryEntry = (entry: any) => {
    setAnalysisResult(entry.result);
    setViewingHistoryId(entry.id);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', padding: '2rem' }}>
        <div className="ms-spinner" style={{ marginRight: '0.75rem' }} />
        <span>Cargando proyecto...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--color-bg)' }}>
      {/* HEADER DEL PROYECTO */}
      <header
        style={{
          height: '60px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={() => navigate('/projects')}
            title="Volver a lista de proyectos"
            className="ms-btn ms-btn-sm ms-btn-secondary"
            style={{ padding: '0.4rem', minHeight: 'auto' }}
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.02em' }}>
                {project?.name || 'Proyecto'}
              </h1>
              <span
                className="ms-badge"
                style={{
                  background: 'var(--color-bg-deep)',
                  color: 'var(--color-accent-strong)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.72rem',
                }}
              >
                N = {project?.row_count?.toLocaleString() || 0} filas
              </span>
              <span
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                K = {columnDefs.length || 0} variables
              </span>
            </div>
            {project?.filename && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                Archivo: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{project.filename}</span>
              </div>
            )}
          </div>
        </div>

        {/* CONTROLES Y ACCIONES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ms-btn ms-btn-sm ms-btn-secondary"
          >
            <Save size={15} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>

          <button
            onClick={loadProject}
            disabled={saving}
            className="ms-btn ms-btn-sm ms-btn-secondary"
          >
            <RotateCcw size={15} /> Recargar
          </button>

          <button
            onClick={togglePanel}
            className={`ms-btn ms-btn-sm ${panelOpen ? 'ms-btn-secondary' : 'ms-btn-primary'}`}
          >
            {panelOpen ? (
              <>
                <X size={15} /> Cerrar Panel
              </>
            ) : (
              <>
                <Sparkles size={15} /> Lanzar Análisis Estadístico
              </>
            )}
          </button>
        </div>
      </header>

      {/* MENSAJES FLOTANTES */}
      {(error || successMsg) && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 50,
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: error ? 'var(--color-error-soft)' : 'var(--color-success-soft)',
            border: error ? '1px solid #F1CBC6' : '1px solid #C5E3D1',
            color: error ? '#8F2C26' : '#1F6A42',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {error || successMsg}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
          }}
        >
          <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              headerHeight={70}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 160,
                flex: 1,
                editable: true,
              }}
              pagination={true}
              paginationPageSize={100}
            />
          </div>
        </div>

        {/* PANEL LATERAL */}
        <div
          style={{
            width: panelOpen ? (isPanelExpanded ? '920px' : '520px') : '0px',
            height: '100%',
            background: 'var(--color-surface)',
            borderLeft: panelOpen ? '1px solid var(--color-border)' : 'none',
            transition: 'width 0.3s ease-in-out',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {panelOpen && (
            <>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-bg-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>
                    Motor Estadístico & Output
                  </h2>
                  <span style={{ fontSize: '0.68rem', backgroundColor: 'var(--color-bg-deep)', color: 'var(--color-accent-strong)', border: '1px solid var(--color-border)', fontWeight: 600, padding: '1px 6px', borderRadius: '4px' }}>
                    Stata + SPSS + R
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <button
                    onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                    title={isPanelExpanded ? 'Reducir panel' : 'Expandir visor de resultados'}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                      padding: '0.25rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isPanelExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    onClick={togglePanel}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                      padding: '0.25rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                <button
                  onClick={() => setActiveTab('config')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    background: activeTab === 'config' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'config' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                    fontWeight: activeTab === 'config' ? 700 : 500,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'config' ? '2px solid var(--color-accent)' : '2px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <Settings size={15} /> Análisis
                </button>
                <button
                  onClick={() => setActiveTab('results')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    background: activeTab === 'results' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'results' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: activeTab === 'results' ? 700 : 500,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'results' ? '2px solid var(--color-accent)' : '2px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <FileText size={15} /> Resultados
                  {outputResults.length > 0 && (
                    <span
                      style={{
                        backgroundColor: 'var(--color-accent)',
                        color: 'white',
                        borderRadius: '10px',
                        padding: '0px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                      }}
                    >
                      {outputResults.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    background: activeTab === 'history' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'history' ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                    fontWeight: activeTab === 'history' ? 700 : 500,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'history' ? '2px solid var(--color-accent)' : '2px solid transparent',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <History size={15} /> Historial
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', backgroundColor: activeTab === 'results' ? 'var(--color-bg)' : 'var(--color-surface)' }}>
                {activeTab === 'results' ? (
                  <OutputViewer
                    results={outputResults}
                    onDeleteResult={handleDeleteOutputResult}
                    onClearAll={handleClearAllOutputs}
                  />
                ) : activeTab === 'config' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '1rem' }}>
                    {analysisError && (
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '10px',
                          color: '#991b1b',
                          fontSize: '0.84rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <strong>Error en el análisis:</strong> {analysisError}
                      </div>
                    )}

                    <div
                      style={{
                        background: 'linear-gradient(135deg, #FFFCF2 0%, #F5EFE6 100%)',
                        border: '1px solid #CCC5B9',
                        borderRadius: '10px',
                        padding: '1rem 1.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                        <Sparkles size={15} color="#EB5E28" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D84F1B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Catálogo de Procedimientos Estadísticos
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#403D39', lineHeight: 1.45 }}>
                        Selecciona un test estadístico para configurar las variables clínicas, ajustar covariables de confusión y verificar supuestos con el motor R.
                      </p>
                    </div>

                    {/* Agrupaciones por Disciplina / Categoría */}
                    {Array.from(new Set(analysisOptions.map(o => o.category))).map(categoryName => {
                      const optionsInCategory = analysisOptions.filter(o => o.category === categoryName);

                      return (
                        <div key={categoryName} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              color: '#403D39',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              paddingBottom: '0.25rem',
                              borderBottom: '1px solid #F5EFE6',
                            }}
                          >
                            <span>{categoryName}</span>
                            <span style={{ color: '#CCC5B9' }}>({optionsInCategory.length})</span>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isPanelExpanded ? 'repeat(2, 1fr)' : '1fr',
                              gap: '0.65rem',
                            }}
                          >
                            {optionsInCategory.map(option => (
                              <button
                                key={option.id}
                                onClick={() => openAnalysisModal(option)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.85rem',
                                  padding: '0.9rem 1rem',
                                  background: 'white',
                                  border: '1px solid #CCC5B9',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                  color: '#252422',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = 'rgba(235, 94, 40, 0.4)';
                                  e.currentTarget.style.backgroundColor = '#FFFCF2';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.05)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = '#CCC5B9';
                                  e.currentTarget.style.backgroundColor = 'white';
                                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: '#F5EFE6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: '2px',
                                  }}
                                >
                                  {option.icon}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '3px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#252422' }}>
                                      {option.label}
                                    </div>
                                    {option.badge && (
                                      <span
                                        style={{
                                          backgroundColor: '#e7f4f2',
                                          color: '#D84F1B',
                                          border: '1px solid #b6ddd8',
                                          fontSize: '0.66rem',
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {option.badge}
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ fontSize: '0.76rem', color: '#403D39', lineHeight: 1.4 }}>
                                    {option.description}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    {history.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#403D39', padding: '2rem 1rem' }}>
                        <History size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                        <p>No hay análisis previos en esta sesión.</p>
                      </div>
                    ) : (
                      history.map(entry => (
                        <div
                          key={entry.id}
                          onClick={() => viewHistoryEntry(entry)}
                          style={{
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            background: viewingHistoryId === entry.id ? 'var(--color-bg-deep)' : 'var(--color-surface)',
                          }}
                        >
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {analysisOptions.find(o => o.id === entry.testName)?.label || entry.testName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {entry.variables.join(', ')} — p = {entry.pValue?.toFixed(4) || 'N/A'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE SELECCIÓN DE VARIABLES */}
      {modalOpen && selectedAnalysis && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'white',
              width: '100%',
              maxWidth: '1200px',
              height: '85vh',
              borderRadius: '24px',
              boxShadow: '0 40px 90px rgba(15, 23, 42, 0.24)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                background: '#FFFCF2',
                borderBottom: '1px solid #CCC5B9',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#334155', fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#252422', fontWeight: 600 }}>
                  <span style={{ width: '2rem', height: '2rem', borderRadius: '0.75rem', background: '#EB5E28', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <BarChart3 size={16} />
                  </span>
                  MedStats Analytics
                </span>
                <span style={{ color: '#403D39' }}>/</span>
                <span>{project?.name || 'Proyecto Actual'}</span>
                <span style={{ color: '#403D39' }}>/</span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {project?.filename || 'Dataset activo'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button title="Cerrar modal" onClick={closeModal} style={{ border: 'none', background: 'transparent', color: '#403D39', cursor: 'pointer', fontSize: '1.25rem' }}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ width: '65%', padding: '1.5rem', overflowY: 'auto', background: '#FFFCF2', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: '#252422' }}>Configuración del análisis estadístico</h2>
                  <p style={{ marginTop: '0.65rem', fontSize: '0.95rem', color: '#403D39', lineHeight: 1.7 }}>
                    Selecciona las variables clave e incorpora covariables para ajustar tu modelo. El panel está diseñado para guiar tu flujo como si fuera un tablero de Jira, con pasos claros y recomendaciones inteligentes.
                  </p>
                </div>

                <div style={{ background: 'white', border: '1px solid #CCC5B9', borderRadius: '18px', padding: '1rem', display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#164e63', fontWeight: 700, fontSize: '0.8rem' }}>
                    <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '999px', background: '#0ea5e9' }}></span>
                    Selección de variables para {selectedAnalysis.label}
                  </div>

                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {selectedAnalysis.id === 'linear-regression' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variable dependiente</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`linear-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variables independientes</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {getAllowedColumnsForRole('indep').map(colName => {
                              const checked = (selectedRoleValues.indep_vars as string[] | undefined)?.includes(colName) || false;
                              return (
                                <label key={`linear-indep-${colName}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', background: '#FFFCF2' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedRoleValues(prev => {
                                        const current = (prev.indep_vars as string[] | undefined) || [];
                                        const next = checked ? current.filter(v => v !== colName) : [...current, colName];
                                        return { ...prev, indep_vars: next };
                                      });
                                    }}
                                  />
                                  <span style={{ color: '#252422' }}>{colName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'logistic-regression' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variable dependiente (binaria)</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`logistic-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variables independientes</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {getAllowedColumnsForRole('indep').map(colName => {
                              const checked = (selectedRoleValues.indep_vars as string[] | undefined)?.includes(colName) || false;
                              return (
                                <label key={`logistic-indep-${colName}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', background: '#FFFCF2' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setSelectedRoleValues(prev => {
                                        const current = (prev.indep_vars as string[] | undefined) || [];
                                        const next = checked ? current.filter(v => v !== colName) : [...current, colName];
                                        return { ...prev, indep_vars: next };
                                      });
                                    }}
                                  />
                                  <span style={{ color: '#252422' }}>{colName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'anova' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variable dependiente</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`anova-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variable de grupo</div>
                          <select
                            value={selectedRoleValues.group_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, group_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('group').map(colName => (
                              <option key={`anova-group-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'compare' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variable numérica</div>
                          <select
                            value={selectedRoleValues.num_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, num_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('num').map(colName => (
                              <option key={`compare-num-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Variable categórica</div>
                          <select
                            value={selectedRoleValues.cat_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, cat_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('cat').map(colName => (
                              <option key={`compare-cat-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {(['correlation', 'chi-square'].includes(selectedAnalysis.id)) && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>{selectedAnalysis.id === 'correlation' ? 'Variable 1' : 'Variable 1 (categórica)'}</div>
                          <select
                            value={selectedRoleValues.var1 || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, var1: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('var1').map(colName => (
                              <option key={`var1-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>{selectedAnalysis.id === 'correlation' ? 'Variable 2' : 'Variable 2 (categórica)'}</div>
                          <select
                            value={selectedRoleValues.var2 || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, var2: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('var2').map(colName => (
                              <option key={`var2-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'roc-curve' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Resultado / outcome</div>
                          <select
                            value={selectedRoleValues.outcome || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, outcome: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('outcome').map(colName => (
                              <option key={`roc-outcome-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Predictores</div>
                          <select
                            value={selectedRoleValues.predictor || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, predictor: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('predictor').map(colName => (
                              <option key={`roc-predictor-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'kaplan-meier' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Tiempo</div>
                          <select
                            value={selectedRoleValues.time_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, time_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('time').map(colName => (
                              <option key={`km-time-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Evento</div>
                          <select
                            value={selectedRoleValues.event_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, event_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('event').map(colName => (
                              <option key={`km-event-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#252422', marginBottom: '0.5rem' }}>Grupo (opcional)</div>
                          <select
                            value={selectedRoleValues.group_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, group_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem', color: '#252422' }}
                          >
                            <option value="">Ninguno</option>
                            {getAllowedColumnsForRole('group').map(colName => (
                              <option key={`km-group-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'descriptive' && (
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {Object.entries(columnTypes).map(([colName, colType]) => (
                          <label key={colName} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', background: '#FFFCF2' }}>
                            <input
                              type="checkbox"
                              checked={(selectedRoleValues.columns as string[] | undefined)?.includes(colName) || false}
                              onChange={() => {
                                setSelectedRoleValues(prev => {
                                  const current = (prev.columns as string[] | undefined) || [];
                                  const next = current.includes(colName) ? current.filter(v => v !== colName) : [...current, colName];
                                  return { ...prev, columns: next };
                                });
                              }}
                            />
                            <span style={{ color: '#252422' }}>{colName}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#403D39' }}>{colType === 'numeric' ? 'Numérica' : colType === 'binary' ? 'Binaria' : colType === 'categorical' ? 'Categórica' : colType}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: 'white', border: '1px solid #CCC5B9', borderRadius: '18px', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid #CCC5B9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#252422' }}>Variables de ajuste y covariables</div>
                      <div style={{ fontSize: '0.8rem', color: '#403D39', marginTop: '0.25rem' }}>Añade columnas que controlen el efecto de confusión en tus modelos.</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#403D39', fontWeight: 600 }}>{Math.min(100, Math.round((covariates.length / 4) * 100))}% procesado</span>
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.75rem', background: '#FFFCF2' }}>
                    {covariates.length === 0 ? (
                      <div style={{ color: '#403D39', textAlign: 'center', padding: '1.5rem 0' }}>No hay variables de ajuste añadidas.</div>
                    ) : covariates.map((cov) => (
                      <div key={cov.id} style={{ background: 'white', border: '1px solid #CCC5B9', borderRadius: '14px', padding: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#252422' }}>{cov.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#403D39', marginTop: '0.15rem' }}>{cov.type}</div>
                        </div>
                        <button onClick={() => deleteCovariate(cov.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }} title="Eliminar covariable">×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem 1rem', background: 'white', borderTop: '1px solid #CCC5B9' }}>
                    <select
                      value={newCovariateOption}
                      onChange={(e) => setNewCovariateOption(e.target.value)}
                      style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '14px', border: '1px solid #CCC5B9', outline: 'none', fontSize: '0.9rem' }}
                    >
                      <option value="Edad">[Num] Edad</option>
                      <option value="Género">[Cat] Género</option>
                      <option value="PSistólica (Pre)">[Num] PSistólica (Pre)</option>
                      <option value="Estadio Tumor">[Ord] Estadio Tumor</option>
                    </select>
                    <button onClick={addCovariate} style={{ padding: '0.75rem 1rem', borderRadius: '14px', border: 'none', background: '#EB5E28', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Agregar variable</button>
                  </div>
                </div>

                <div style={{ background: 'white', border: '1px solid #CCC5B9', borderRadius: '18px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#252422', marginBottom: '0.75rem' }}>Notas del investigador</div>
                  <textarea
                    value={analysisNotes}
                    onChange={(e) => setAnalysisNotes(e.target.value)}
                    placeholder="Añade observaciones sobre los supuestos estadísticos o limitaciones del análisis..."
                    style={{ width: '100%', minHeight: '120px', resize: 'vertical', borderRadius: '16px', border: '1px solid #CCC5B9', padding: '1rem', fontSize: '0.9rem', color: '#252422' }}
                  />
                  <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#403D39' }}>Tip: usa este bloque para documentar ajustes clínicos y supuestos de tu prueba.</p>
                </div>
              </div>

              <div style={{ width: '35%', background: '#ffffff', borderLeft: '1px solid #CCC5B9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflowY: 'auto' }}>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#403D39' }}>Estado del análisis</div>
                    <button style={{ width: '100%', marginTop: '0.85rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #bae6fd', background: '#ecfeff', color: '#0369a1', fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
                      Listo para ejecutar
                    </button>
                  </div>

                  <div style={{ background: '#FFFCF2', border: '1px solid #CCC5B9', borderRadius: '18px', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', color: '#252422', fontWeight: 700 }}>
                      <span style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.75rem', background: '#0ea5e9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><BarChart3 size={16} /></span>
                      <span style={{ fontSize: '0.9rem' }}>Test recomendado</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#252422', lineHeight: 1.3 }}>{getRecommendedTestInfo().title}</div>
                      <p style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: '#403D39', lineHeight: 1.6 }}>{getRecommendedTestInfo().explanation}</p>
                    </div>
                    <div style={{ marginTop: '1rem', padding: '0.9rem', borderRadius: '16px', background: 'white', border: '1px solid #CCC5B9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#403D39', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Alternativa no paramétrica</div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: '#252422' }}>{getRecommendedTestInfo().alternative}</span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={useNonParametric} onChange={() => setUseNonParametric(prev => !prev)} style={{ width: '1rem', height: '1rem' }} />
                          <span style={{ fontSize: '0.75rem', color: '#403D39' }}>Activar</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #CCC5B9', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#403D39', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Verificación de supuestos</div>
                    <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155' }}>
                        <span>Normalidad (Shapiro-Wilk)</span>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.75rem' }}>Paso</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155' }}>
                        <span>Homocedasticidad (Levene)</span>
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.75rem' }}>Paso</span>
                      </div>
                      {selectedAnalysis?.id === 'compare' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155' }}>
                          <span>Muestras pareadas (Antes / Después)</span>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isPaired}
                              onChange={(e) => setIsPaired(e.target.checked)}
                              style={{ width: '1rem', height: '1rem' }}
                            />
                            <span style={{ fontSize: '0.75rem', color: '#403D39' }}>Sí</span>
                          </label>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155' }}>
                        <span>Nivel de confianza</span>
                        <select
                          value={confLevel}
                          onChange={(e) => setConfLevel(Number(e.target.value))}
                          style={{ borderRadius: '8px', border: '1px solid #CCC5B9', padding: '0.35rem 0.7rem', fontSize: '0.8rem', color: '#252422', background: 'white' }}
                        >
                          <option value={0.95}>95% (α = 0.05)</option>
                          <option value={0.99}>99% (α = 0.01)</option>
                          <option value={0.90}>90% (α = 0.10)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#403D39' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                      <span>Creado</span>
                      <span style={{ fontWeight: 700, color: '#252422' }}>{new Date().toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Actualizado</span>
                      <span style={{ fontWeight: 700, color: '#252422' }}>Ahora</span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid #CCC5B9', background: '#FFFCF2' }}>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={!isSelectionComplete()}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      borderRadius: '18px',
                      border: 'none',
                      background: !isSelectionComplete() ? 'rgba(235, 94, 40, 0.4)' : '#EB5E28',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: !isSelectionComplete() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Ejecutar análisis y ver resultados
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS EMBEBIDOS */}
      <style>{`
        .numeric-header::after {
          content: ' [123]';
          font-size: 0.65rem;
          color: #403D39;
          margin-left: 4px;
          font-weight: 400;
        }
        .categorical-header::after {
          content: ' [Abc]';
          font-size: 0.65rem;
          color: #403D39;
          margin-left: 4px;
          font-weight: 400;
        }
        .ag-cell-invalid {
          background-color: #fef2f2 !important;
          border: 1px solid #fca5a5 !important;
        }
      `}</style>
    </div>
  );
};

export default ProjectPage;