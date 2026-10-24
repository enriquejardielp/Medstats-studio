import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Search,
  ChevronRight,
} from 'lucide-react';
import apiClient from '../api/client';
import type { ColumnType } from '../types';
import type { AnalysisResult } from '../types/analysis';
import { OutputViewer } from '../components/output/OutputViewer';
import { generateLocalJSON } from '../utils/localLanguageModel';

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
    this.eGui.className = 'project-grid-column-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'project-grid-column-name';
    nameSpan.textContent = displayName;
    nameSpan.title = displayName;

    const select = document.createElement('select');
    select.className = 'project-grid-type-select';

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

interface LocalAnalysisPlan {
  kind: 'analysis' | 'chart' | 'clarify';
  analysis_type?: string;
  params?: Record<string, unknown>;
  chart_type?: 'histogram' | 'density' | 'scatter' | 'boxplot' | 'barplot';
  x_var?: string;
  y_var?: string;
  fill_var?: string;
  title?: string;
  question?: string;
  explanation?: string;
}

const analysisRoleGuide: Record<string, string> = {
  descriptive: 'columns: array de columnas que se resumen',
  table1: 'columns: array de variables; group_var: columna categórica opcional',
  compare: 'num_var: numérica; cat_var: categórica binaria',
  anova: 'dep_var: numérica; group_var: categórica',
  correlation: 'var1 y var2: numéricas',
  'chi-square': 'var1 y var2: categóricas',
  'linear-regression': 'dep_var: numérica; indep_vars: array de predictoras numéricas/categóricas',
  'logistic-regression': 'dep_var: binaria; indep_vars: array de predictoras numéricas/categóricas',
  'roc-curve': 'outcome: binaria; predictor: numérica',
  'kaplan-meier': 'time_var: numérica; event_var: binaria; group_var: categórica opcional',
  'cox-regression': 'time_var: numérica; event_var: 0/1; covariates: array de predictoras',
  ancova: 'dep_var: numérica; group_var: categórica; covariates: array de variables de ajuste',
  mcnemar: 'var1 y var2: respuestas binarias emparejadas de los mismos sujetos',
  kappa: 'var1 y var2: clasificaciones categóricas de dos evaluadores',
  'bland-altman': 'var1 y var2: métodos numéricos de medición',
  icc: 'columns: al menos dos columnas numéricas de evaluadores/mediciones',
  friedman: 'columns: al menos tres columnas numéricas de mediciones repetidas',
  'odds-ratio': 'var1 y var2: variables binarias',
  'diagnostic-accuracy': 'outcome: desenlace 0/1; predictor: numérico; threshold: umbral numérico',
  'sample-size': 'alpha, power y effect: números; test_type: t-test, proporciones o ANOVA',
  'count-regression': 'outcome: recuento numérico; covariates: array de predictoras; method: auto, poisson o negative-binomial',
  'data-quality': 'sin parámetros ni variables',
  'paired-comparison': 'var1 y var2: medidas numéricas pareadas, una fila por sujeto; method: welch o mannwhitney',
};

const readSavedAnalysisResults = (projectId?: string): AnalysisResult[] => {
  if (!projectId || typeof window === 'undefined') return [];
  try {
    const stored = window.sessionStorage.getItem(`medstats:analysis-results:${projectId}`);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is AnalysisResult => Boolean(item?.metadata?.analysis_id && item?.summary))
      : [];
  } catch {
    return [];
  }
};

const analysisOptions: AnalysisOption[] = [
  {
    id: 'descriptive',
    label: 'Describir la muestra',
    category: 'Describir datos',
    badge: 'Variables numéricas y categóricas',
    icon: <BarChart3 size={18} color="#9C4C2E" />,
    description: 'Resume cada variable, sus valores ausentes y su distribución para conocer los datos antes de analizarlos.',
    requiredTypes: { numeric: 1, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'table1',
    label: 'Tabla basal de participantes',
    category: 'Describir datos',
    badge: 'Formato de publicación',
    icon: <Table2 size={18} color="#9C4C2E" />,
    description: 'Presenta características clínicas y demográficas, globales o separadas por grupos.',
    requiredTypes: { numeric: 1, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'compare',
    label: 'Comparar dos grupos',
    category: 'Comparar grupos',
    badge: 'Welch · Mann–Whitney',
    icon: <GitCompare size={18} color="#9C4C2E" />,
    description: 'Compara una medida numérica entre dos grupos independientes. Elige el contraste paramétrico o por rangos.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'anova',
    label: 'Comparar tres o más grupos',
    category: 'Comparar grupos',
    badge: 'ANOVA · Kruskal–Wallis',
    icon: <Layers size={18} color="#9C4C2E" />,
    description: 'Evalúa si una medida numérica difiere entre varios grupos e incluye comparaciones posteriores cuando corresponda.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'correlation',
    label: 'Relacionar dos medidas',
    category: 'Explorar asociaciones',
    badge: 'Pearson · Spearman',
    icon: <TrendingUp size={18} color="#9C4C2E" />,
    description: 'Cuantifica dirección y fuerza de la asociación entre dos variables numéricas.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: false,
  },
  {
    id: 'chi-square',
    label: 'Asociación entre categorías',
    category: 'Explorar asociaciones',
    badge: 'Chi-cuadrado · Fisher',
    icon: <Sparkles size={18} color="#9C4C2E" />,
    description: 'Muestra los recuentos y evalúa si dos variables categóricas están asociadas.',
    requiredTypes: { numeric: 0, categorical: 2 },
    allowMore: false,
  },
  {
    id: 'linear-regression',
    label: 'Explicar una medida numérica',
    category: 'Modelar resultados',
    badge: 'Regresión lineal',
    icon: <SlidersHorizontal size={18} color="#9C4C2E" />,
    description: 'Estima la relación de una medida continua con uno o varios predictores.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'logistic-regression',
    label: 'Modelar un resultado sí / no',
    category: 'Modelar resultados',
    badge: 'Regresión logística',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Relaciona un desenlace con dos categorías con uno o varios predictores.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: true,
  },
  {
    id: 'roc-curve',
    label: 'Evaluar un marcador diagnóstico',
    category: 'Diagnóstico y supervivencia',
    badge: 'Curva ROC · AUC',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Evalúa cómo discrimina un marcador entre dos estados y explora posibles puntos de corte.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'kaplan-meier',
    label: 'Analizar tiempo hasta un evento',
    category: 'Diagnóstico y supervivencia',
    badge: 'Kaplan–Meier · Log-rank',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Estima la probabilidad de permanecer sin el evento a lo largo del seguimiento.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'cox-regression',
    label: 'Ajustar supervivencia con covariables',
    category: 'Diagnóstico y supervivencia',
    badge: 'Regresión de Cox · HR',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Estima hazard ratios ajustados y revisa el supuesto de riesgos proporcionales.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: true,
  },
  {
    id: 'ancova',
    label: 'Comparar grupos ajustando por covariables',
    category: 'Comparar grupos',
    badge: 'ANCOVA',
    icon: <SlidersHorizontal size={18} color="#9C4C2E" />,
    description: 'Compara una medida numérica entre grupos teniendo en cuenta otras variables.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: true,
  },
  {
    id: 'mcnemar',
    label: 'Comparar respuestas binarias emparejadas',
    category: 'Comparar grupos',
    badge: 'McNemar',
    icon: <GitCompare size={18} color="#9C4C2E" />,
    description: 'Compara dos mediciones sí/no de las mismas personas, por ejemplo antes y después.',
    requiredTypes: { numeric: 0, categorical: 2 },
    allowMore: false,
  },
  {
    id: 'kappa',
    label: 'Medir acuerdo entre evaluadores',
    category: 'Explorar asociaciones',
    badge: 'Kappa de Cohen',
    icon: <GitCompare size={18} color="#9C4C2E" />,
    description: 'Cuantifica el acuerdo entre dos clasificaciones, descontando el esperado por azar.',
    requiredTypes: { numeric: 0, categorical: 2 },
    allowMore: false,
  },
  {
    id: 'bland-altman',
    label: 'Comparar dos métodos de medición',
    category: 'Explorar asociaciones',
    badge: 'Bland–Altman',
    icon: <TrendingUp size={18} color="#9C4C2E" />,
    description: 'Estima el sesgo y los límites de acuerdo entre dos medidas continuas.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: false,
  },
  {
    id: 'icc',
    label: 'Medir fiabilidad de varias mediciones',
    category: 'Explorar asociaciones',
    badge: 'ICC',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Resume la concordancia entre mediciones continuas de dos o más evaluadores.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'friedman',
    label: 'Comparar tres o más mediciones relacionadas',
    category: 'Comparar grupos',
    badge: 'Friedman',
    icon: <Layers size={18} color="#9C4C2E" />,
    description: 'Alternativa por rangos para comparar tres o más medidas de los mismos sujetos.',
    requiredTypes: { numeric: 3, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'odds-ratio',
    label: 'Cuantificar asociación entre dos variables sí/no',
    category: 'Explorar asociaciones',
    badge: 'Odds ratio',
    icon: <GitCompare size={18} color="#9C4C2E" />,
    description: 'Estima el odds ratio y su intervalo en una tabla 2 × 2.',
    requiredTypes: { numeric: 0, categorical: 2 },
    allowMore: false,
  },
  {
    id: 'diagnostic-accuracy',
    label: 'Calcular sensibilidad y especificidad',
    category: 'Diagnóstico y supervivencia',
    badge: 'Rendimiento diagnóstico',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Calcula sensibilidad, especificidad y valores predictivos para un umbral definido.',
    requiredTypes: { numeric: 1, categorical: 1 },
    allowMore: false,
  },
  {
    id: 'sample-size',
    label: 'Estimar tamaño muestral',
    category: 'Planificar estudios',
    badge: 'Potencia · alfa',
    icon: <BarChart3 size={18} color="#9C4C2E" />,
    description: 'Calcula participantes necesarios para una prueba t, comparación de proporciones o ANOVA.',
    requiredTypes: { numeric: 0, categorical: 0 },
    allowMore: false,
  },
  {
    id: 'count-regression',
    label: 'Modelar número de eventos o episodios',
    category: 'Modelar resultados',
    badge: 'Poisson · Binomial negativa',
    icon: <Activity size={18} color="#9C4C2E" />,
    description: 'Modela recuentos enteros y elige binomial negativa si hay sobredispersión.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: true,
  },
  {
    id: 'data-quality',
    label: 'Revisar calidad y datos ausentes',
    category: 'Describir datos',
    badge: 'Completitud · duplicados',
    icon: <Search size={18} color="#9C4C2E" />,
    description: 'Detecta valores ausentes, columnas sin variación y filas duplicadas sin modificar los datos.',
    requiredTypes: { numeric: 0, categorical: 0 },
    allowMore: false,
  },
  {
    id: 'paired-comparison',
    label: 'Comparar dos medidas de los mismos sujetos',
    category: 'Comparar grupos',
    badge: 't pareada · Wilcoxon',
    icon: <GitCompare size={18} color="#9C4C2E" />,
    description: 'Compara dos columnas emparejadas fila por fila, con test t pareado o Wilcoxon signed-rank.',
    requiredTypes: { numeric: 2, categorical: 0 },
    allowMore: false,
  },
];

const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isResultsWorkspace = searchParams.get('view') === 'results';
  const gridRef = useRef<AgGridReact>(null);

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [rowData, setRowData] = useState<RowData[]>([]);
  const [gridSearch, setGridSearch] = useState('');
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [columnTypes, setColumnTypes] = useState<Record<string, ColumnType>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'history'>('config');
  const [resultsForProject, setResultsForProject] = useState(() => ({
    projectId: id || '',
    items: readSavedAnalysisResults(id),
  }));
  const outputResults = resultsForProject.projectId === (id || '') ? resultsForProject.items : [];

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisOption | null>(null);
  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [selectedRoleValues, setSelectedRoleValues] = useState<Record<string, string | string[]>>({});
  const [analysisSearch, setAnalysisSearch] = useState('');
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false);
  const [naturalRequest, setNaturalRequest] = useState('');
  const [naturalPlan, setNaturalPlan] = useState<LocalAnalysisPlan | null>(null);
  const [naturalProgress, setNaturalProgress] = useState<string | null>(null);
  const [naturalError, setNaturalError] = useState<string | null>(null);
  const [naturalLoading, setNaturalLoading] = useState(false);

  const [_analysisResult, setAnalysisResult] = useState<any>(null);
  const [, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [useNonParametric, setUseNonParametric] = useState(false);
  const [confLevel, setConfLevel] = useState<number>(0.95);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  const updateOutputResults = useCallback((update: (current: AnalysisResult[]) => AnalysisResult[]) => {
    if (!id) return;
    setResultsForProject(previous => {
      const current = previous.projectId === id ? previous.items : readSavedAnalysisResults(id);
      return { projectId: id, items: update(current) };
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (resultsForProject.projectId !== id) {
      setResultsForProject({ projectId: id, items: readSavedAnalysisResults(id) });
      return;
    }
    try {
      window.sessionStorage.setItem(`medstats:analysis-results:${id}`, JSON.stringify(resultsForProject.items));
    } catch {
      // La vista sigue funcionando aunque el navegador no permita almacenamiento de sesión.
    }
  }, [id, resultsForProject]);

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
    if (!panelOpen) setActiveTab('config');
    setPanelOpen(!panelOpen);
  };

  const handleDeleteOutputResult = (analysisId: string) => {
    updateOutputResults(prev => prev.filter(r => r.metadata.analysis_id !== analysisId));
    if (viewingHistoryId === analysisId) setViewingHistoryId(null);
  };

  const handleClearAllOutputs = () => {
    updateOutputResults(() => []);
    setViewingHistoryId(null);
  };

  const returnToProjectData = () => setSearchParams({}, { replace: true });

  const openNewAnalysis = () => {
    setPanelOpen(true);
    setActiveTab('config');
    returnToProjectData();
  };

  const resetAnalysisModalState = () => {
    setUseNonParametric(false);
    setConfLevel(0.95);
    setAdvancedOptionsOpen(false);
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
      case 'descriptive':
        return (selectedRoleValues.columns as string[] | undefined) || [];
      case 'table1': {
        const columns = (selectedRoleValues.columns as string[] | undefined) || [];
        const group = selectedRoleValues.group_var as string | undefined;
        return group && !columns.includes(group) ? [...columns, group] : columns;
      }
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
      case 'cox-regression': {
        const timeVar = selectedRoleValues.time_var as string | undefined;
        const eventVar = selectedRoleValues.event_var as string | undefined;
        const covariates = (selectedRoleValues.covariates as string[] | undefined) || [];
        return [...(timeVar ? [timeVar] : []), ...(eventVar ? [eventVar] : []), ...covariates];
      }
      case 'ancova': {
        const depVar = selectedRoleValues.dep_var as string | undefined;
        const groupVar = selectedRoleValues.group_var as string | undefined;
        const covariates = (selectedRoleValues.covariates as string[] | undefined) || [];
        return [...(depVar ? [depVar] : []), ...(groupVar ? [groupVar] : []), ...covariates];
      }
      case 'mcnemar':
      case 'kappa':
      case 'bland-altman': {
        const var1 = selectedRoleValues.var1 as string | undefined;
        const var2 = selectedRoleValues.var2 as string | undefined;
        return var1 && var2 ? [var1, var2] : [];
      }
      case 'icc':
        return (selectedRoleValues.columns as string[] | undefined) || [];
      case 'friedman':
        return (selectedRoleValues.columns as string[] | undefined) || [];
      case 'odds-ratio': {
        const var1 = selectedRoleValues.var1 as string | undefined;
        const var2 = selectedRoleValues.var2 as string | undefined;
        return var1 && var2 ? [var1, var2] : [];
      }
      case 'diagnostic-accuracy': {
        const outcome = selectedRoleValues.outcome as string | undefined;
        const predictor = selectedRoleValues.predictor as string | undefined;
        return outcome && predictor ? [outcome, predictor] : [];
      }
      case 'sample-size':
        return [];
      case 'count-regression': {
        const outcome = selectedRoleValues.outcome as string | undefined;
        const covariates = (selectedRoleValues.covariates as string[] | undefined) || [];
        return [...(outcome ? [outcome] : []), ...covariates];
      }
      case 'data-quality':
        return [];
      case 'paired-comparison': {
        const var1 = selectedRoleValues.var1 as string | undefined;
        const var2 = selectedRoleValues.var2 as string | undefined;
        return var1 && var2 ? [var1, var2] : [];
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
      case 'cox-regression':
        return Boolean(selectedRoleValues.time_var) && Boolean(selectedRoleValues.event_var) && ((selectedRoleValues.covariates as string[] | undefined)?.length ?? 0) > 0;
      case 'ancova':
        return Boolean(selectedRoleValues.dep_var) && Boolean(selectedRoleValues.group_var) && ((selectedRoleValues.covariates as string[] | undefined)?.length ?? 0) > 0;
      case 'mcnemar':
      case 'kappa':
      case 'bland-altman':
        return Boolean(selectedRoleValues.var1) && Boolean(selectedRoleValues.var2);
      case 'icc':
        return ((selectedRoleValues.columns as string[] | undefined)?.length ?? 0) >= 2;
      case 'friedman':
        return ((selectedRoleValues.columns as string[] | undefined)?.length ?? 0) >= 3;
      case 'odds-ratio':
        return Boolean(selectedRoleValues.var1) && Boolean(selectedRoleValues.var2);
      case 'diagnostic-accuracy':
        return Boolean(selectedRoleValues.outcome) && Boolean(selectedRoleValues.predictor) && selectedRoleValues.threshold !== undefined && selectedRoleValues.threshold !== '';
      case 'sample-size':
        return Boolean(selectedRoleValues.alpha) && Boolean(selectedRoleValues.power) && Boolean(selectedRoleValues.effect);
      case 'count-regression':
        return Boolean(selectedRoleValues.outcome) && ((selectedRoleValues.covariates as string[] | undefined)?.length ?? 0) > 0;
      case 'data-quality':
        return true;
      case 'paired-comparison':
        return Boolean(selectedRoleValues.var1) && Boolean(selectedRoleValues.var2);
      case 'table1': {
        const group = selectedRoleValues.group_var as string | undefined;
        return currentSelectedVars.some(variable => variable !== group);
      }
      default:
        return currentSelectedVars.length > 0;
    }
  }, [getCurrentSelectedVars, selectedAnalysis, selectedRoleValues]);

  const getAllowedColumnsForRole = useCallback((role: string) => {
    if (!selectedAnalysis || !columnTypes) return [];
    const entries = Object.entries(columnTypes);

    const isNumeric = (colName: string) => columnTypes[colName] === 'numeric';
    const isCategorical = (colName: string) => ['categorical', 'binary'].includes(columnTypes[colName]);
    const levelCount = (colName: string) => new Set(rowData
      .map(row => row[colName])
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      .map(value => String(value))).size;
    const isBinary = (colName: string) => isCategorical(colName) && levelCount(colName) === 2;

    let allowed: string[];
    switch (selectedAnalysis.id) {
      case 'linear-regression':
        allowed = role === 'dep'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isNumeric(colName) || isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'logistic-regression':
        allowed = role === 'dep'
          ? entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isNumeric(colName) || isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'anova':
        allowed = role === 'dep'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'compare':
        allowed = role === 'num'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName);
        break;
      case 'correlation':
        allowed = entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        break;
      case 'chi-square':
        allowed = entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'roc-curve':
        allowed = role === 'outcome'
          ? entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        break;
      case 'kaplan-meier':
        allowed = role === 'time'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : role === 'event'
            ? entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName)
            : entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'cox-regression':
        allowed = role === 'time'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : role === 'event'
            ? entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName)
            : entries.filter(([colName]) => isNumeric(colName) || isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'ancova':
        allowed = role === 'dep'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : role === 'group'
            ? entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName)
            : entries.filter(([colName]) => isNumeric(colName) || isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'mcnemar':
        allowed = entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName);
        break;
      case 'kappa':
        allowed = entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'bland-altman':
      case 'icc':
      case 'friedman':
      case 'paired-comparison':
        allowed = entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        break;
      case 'count-regression':
        allowed = role === 'outcome'
          ? entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isNumeric(colName) || isCategorical(colName)).map(([colName]) => colName);
        break;
      case 'odds-ratio':
        allowed = entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName);
        break;
      case 'diagnostic-accuracy':
        allowed = role === 'outcome'
          ? entries.filter(([colName]) => isBinary(colName)).map(([colName]) => colName)
          : entries.filter(([colName]) => isNumeric(colName)).map(([colName]) => colName);
        break;
      case 'table1':
        allowed = role === 'group'
          ? entries.filter(([colName]) => isCategorical(colName)).map(([colName]) => colName)
          : entries.map(([colName]) => colName);
        break;
      default:
        allowed = entries.map(([colName]) => colName);
    }

    const excluded = new Set<string>();
    if (role === 'indep' && selectedRoleValues.dep_var) excluded.add(selectedRoleValues.dep_var as string);
    if (role === 'var1' && selectedRoleValues.var2) excluded.add(selectedRoleValues.var2 as string);
    if (role === 'var2' && selectedRoleValues.var1) excluded.add(selectedRoleValues.var1 as string);
    if (role === 'covariates') {
      if (selectedRoleValues.dep_var) excluded.add(selectedRoleValues.dep_var as string);
      if (selectedRoleValues.outcome) excluded.add(selectedRoleValues.outcome as string);
      if (selectedRoleValues.group_var) excluded.add(selectedRoleValues.group_var as string);
      if (selectedRoleValues.time_var) excluded.add(selectedRoleValues.time_var as string);
      if (selectedRoleValues.event_var) excluded.add(selectedRoleValues.event_var as string);
    }
    if (role === 'group' && selectedAnalysis.id === 'kaplan-meier' && selectedRoleValues.event_var) {
      excluded.add(selectedRoleValues.event_var as string);
    }
    return allowed.filter(colName => !excluded.has(colName));
  }, [columnTypes, rowData, selectedAnalysis, selectedRoleValues]);

  const getRecommendedTestInfo = useCallback(() => {
    if (!selectedAnalysis) {
      return {
        title: 'Test no seleccionado',
        explanation: 'Selecciona un análisis para recibir sugerencias inteligentes.',
        alternative: 'Seleccione un test',
      };
    }

    const np = useNonParametric;
    let title = selectedAnalysis.label;
    let explanation = selectedAnalysis.description;
    let alternative = 'Alternativa no paramétrica';

    switch (selectedAnalysis.id) {
      case 'compare':
        title = np ? 'Prueba U de Mann–Whitney' : 'Prueba t de Welch';
        explanation = np
          ? 'Compara los rangos de una medida numérica entre dos grupos.'
          : 'Compara las medias entre dos grupos sin asumir varianzas iguales.';
        alternative = 'U de Mann-Whitney';
        break;
      case 'anova':
        title = np ? 'Kruskal-Wallis' : 'ANOVA de una vía';
        explanation = np
          ? 'Compara los rangos entre varios grupos.'
          : 'Compara las medias de varios grupos.';
        alternative = 'Kruskal-Wallis';
        break;
      case 'correlation':
        title = np ? 'Correlación de Spearman' : 'Correlación de Pearson';
        explanation = 'Mide el grado de asociación entre dos variables numéricas.';
        alternative = 'Spearman';
        break;
      case 'linear-regression':
        title = 'Regresión Lineal Simple / Múltiple';
        explanation = 'Estima la relación lineal entre una medida numérica y los predictores seleccionados.';
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
  }, [selectedAnalysis, useNonParametric]);

  const handleNaturalRequest = async () => {
    if (!naturalRequest.trim() || naturalLoading) return;
    setNaturalLoading(true);
    setNaturalError(null);
    setNaturalProgress('Cargando modelo local…');
    setNaturalPlan(null);
    try {
      const catalog = analysisOptions.map(option => ({
        id: option.id,
        objective: option.label,
        description: option.description,
        variables: analysisRoleGuide[option.id],
      }));
      const columns = Object.entries(columnTypes).map(([name, type]) => ({ name, type }));
      const followUp = naturalPlan?.kind === 'clarify' ? naturalPlan.question : undefined;
      const plan = await generateLocalJSON<LocalAnalysisPlan>(
        'Eres el selector de análisis de MedStats Studio. Traduces peticiones a planes JSON estrictos. No calculas estadísticas, no escribes código y no inventas nombres de columnas.',
        JSON.stringify({
          request: naturalRequest.slice(0, 3000),
          clarificationFromPreviousTurn: followUp,
          availableAnalyses: catalog,
          availableColumns: columns,
          supportedCharts: [
            { type: 'histogram', description: 'una variable numérica' },
            { type: 'density', description: 'una variable numérica y opcionalmente un grupo categórico' },
            { type: 'scatter', description: 'dos variables numéricas x e y' },
            { type: 'boxplot', description: 'variable categórica x y numérica y' },
            { type: 'barplot', description: 'una variable categórica; recuentos por defecto' },
          ],
          outputContracts: [
            { kind: 'analysis', analysis_type: 'exact catalog id', params: 'role keys described in catalog; variable values must exactly match available column names', explanation: 'brief Spanish confirmation' },
            { kind: 'chart', chart_type: 'one supported chart type', x_var: 'exact column', y_var: 'exact column when required', fill_var: 'exact optional column', title: 'short Spanish title', explanation: 'brief Spanish confirmation' },
            { kind: 'clarify', question: 'one short Spanish question if more than one valid interpretation exists or required columns are unclear' },
          ],
          rules: [
            'Return exactly one JSON object and no markdown.',
            'Never invent or rename a column. Use exact column names.',
            'For an analysis choose only one id from availableAnalyses and fill its role keys.',
            'Prefer a clarification if the user goal, group, outcome, or chart axes are ambiguous.',
            'Choose kind chart only when the user explicitly asks for a graph or visualization.',
            'Do not include patient data. You only receive column names and types.',
          ],
        }),
        progress => {
          if (['progress', 'progress_total'].includes(progress.status || '') && typeof progress.progress === 'number') {
            setNaturalProgress(`Descargando modelo local · ${Math.round(progress.progress)}%`);
          } else if (progress.status === 'fallback') {
            setNaturalProgress('Activando modo compatible…');
          } else if (progress.status) {
            setNaturalProgress('Cargando modelo local…');
          }
        },
      );

      if (plan.kind === 'clarify') {
        setNaturalPlan({ kind: 'clarify', question: plan.question || '¿Qué resultado o variables quieres analizar?' });
        return;
      }

      if (plan.kind === 'chart') {
        const supported = ['histogram', 'density', 'scatter', 'boxplot', 'barplot'];
        if (!plan.chart_type || !supported.includes(plan.chart_type)) throw new Error('No se reconoció un tipo de gráfico disponible.');
        const xType = columnTypes[plan.x_var || ''];
        const yType = columnTypes[plan.y_var || ''];
        const isCategoricalColumn = (name: string) => ['categorical', 'binary'].includes(columnTypes[name]);
        if (!plan.x_var || !xType) throw new Error('El gráfico propuesto no contiene una variable X válida.');
        if (plan.chart_type === 'histogram' || plan.chart_type === 'density') {
          if (xType !== 'numeric') throw new Error('El histograma o la densidad necesitan una variable numérica.');
        }
        if (plan.chart_type === 'scatter' && (xType !== 'numeric' || yType !== 'numeric')) throw new Error('El gráfico de dispersión necesita dos variables numéricas.');
        if (plan.chart_type === 'boxplot' && (yType !== 'numeric' || !isCategoricalColumn(plan.x_var))) throw new Error('El diagrama de cajas necesita una categoría en X y una variable numérica en Y.');
        if (plan.chart_type === 'barplot' && (!isCategoricalColumn(plan.x_var) || (plan.y_var && yType !== 'numeric'))) throw new Error('El gráfico de barras necesita una variable categórica en X y, si se indica, una numérica en Y.');
        if (plan.fill_var && !isCategoricalColumn(plan.fill_var)) throw new Error('La variable de agrupación debe ser categórica.');
        setNaturalPlan(plan);
        return;
      }

      if (plan.kind !== 'analysis' || !plan.analysis_type) throw new Error('No he podido identificar un análisis disponible.');
      const option = analysisOptions.find(candidate => candidate.id === plan.analysis_type);
      if (!option) throw new Error('El análisis propuesto no está disponible en la aplicación.');
      const params = plan.params || {};
      const numeric = (key: string, optional = false) => {
        const value = params[key];
        if (value === undefined && optional) return;
        if (typeof value !== 'string' || columnTypes[value] !== 'numeric') throw new Error(`Selecciona una columna numérica válida para «${key}».`);
      };
      const isBinaryColumn = (name: string) => {
        if (!['categorical', 'binary'].includes(columnTypes[name])) return false;
        const levels = new Set(rowData
          .map(row => row[name])
          .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
          .map(value => String(value)));
        return levels.size === 2;
      };
      const isCountColumn = (name: string) => {
        if (columnTypes[name] !== 'numeric') return false;
        const observed = rowData
          .map(row => row[name])
          .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
          .map(Number);
        return observed.length > 0 && observed.every(value => Number.isFinite(value) && value >= 0 && Number.isInteger(value));
      };
      const categorical = (key: string, binary = false, optional = false) => {
        const value = params[key];
        if ((value === undefined || value === null || value === '') && optional) return;
        if (typeof value !== 'string' || !['categorical', 'binary'].includes(columnTypes[value]) || (binary && !isBinaryColumn(value))) throw new Error(`Selecciona una columna ${binary ? 'binaria' : 'categórica'} válida para «${key}».`);
      };
      const numericList = (key: string, min = 1) => {
        const values = params[key];
        if (!Array.isArray(values) || values.length < min || values.some(value => typeof value !== 'string' || columnTypes[value] !== 'numeric')) throw new Error(`Selecciona al menos ${min} columnas numéricas válidas para «${key}».`);
      };
      const predictorList = (key: string, min = 1) => {
        const values = params[key];
        if (!Array.isArray(values) || values.length < min || values.some(value => typeof value !== 'string' || !columnTypes[value] || !['numeric', 'categorical', 'binary'].includes(columnTypes[value]))) throw new Error(`Selecciona al menos ${min} predictoras válidas para «${key}».`);
      };
      const categoryPair = (binary = false) => { categorical('var1', binary); categorical('var2', binary); };
      const numericPair = () => { numeric('var1'); numeric('var2'); };
      switch (plan.analysis_type) {
        case 'descriptive':
          if (!Array.isArray(params.columns) || !params.columns.length || params.columns.some(value => typeof value !== 'string' || !columnTypes[value])) throw new Error('Selecciona las columnas que quieres describir.');
          break;
        case 'table1':
          if (!Array.isArray(params.columns) || !params.columns.length || params.columns.some(value => typeof value !== 'string' || !columnTypes[value])) throw new Error('Selecciona las variables para la tabla basal.');
          categorical('group_var', false, true);
          break;
        case 'compare': numeric('num_var'); categorical('cat_var', true); break;
        case 'anova': numeric('dep_var'); categorical('group_var'); break;
        case 'correlation': numericPair(); break;
        case 'chi-square': categoryPair(); break;
        case 'linear-regression': numeric('dep_var'); predictorList('indep_vars'); break;
        case 'logistic-regression': categorical('dep_var', true); predictorList('indep_vars'); break;
        case 'roc-curve': categorical('outcome', true); numeric('predictor'); break;
        case 'kaplan-meier': numeric('time_var'); categorical('event_var', true); categorical('group_var', false, true); break;
        case 'cox-regression': numeric('time_var'); categorical('event_var', true); predictorList('covariates'); break;
        case 'ancova': numeric('dep_var'); categorical('group_var'); predictorList('covariates'); break;
        case 'mcnemar': categoryPair(true); break;
        case 'kappa': categoryPair(); break;
        case 'bland-altman': numericPair(); break;
        case 'paired-comparison':
          numericPair();
          if (!['welch', 'mannwhitney'].includes(String(params.method || 'welch'))) throw new Error('Elige un método disponible para la comparación emparejada.');
          break;
        case 'icc': numericList('columns', 2); break;
        case 'friedman': numericList('columns', 3); break;
        case 'odds-ratio': categoryPair(true); break;
        case 'diagnostic-accuracy':
          categorical('outcome', true); numeric('predictor');
          if (typeof params.threshold !== 'number' || !Number.isFinite(params.threshold)) throw new Error('Indica un umbral numérico para el análisis diagnóstico.');
          break;
        case 'sample-size':
          for (const key of ['alpha', 'power', 'effect']) if (typeof params[key] !== 'number' || !Number.isFinite(params[key])) throw new Error('La potencia estadística necesita alfa, potencia y tamaño del efecto numéricos.');
          if (!['t-test', 'proporciones', 'ANOVA'].includes(String(params.test_type || 't-test'))) throw new Error('Elige un tipo de contraste disponible para el cálculo de tamaño muestral.');
          break;
        case 'count-regression':
          if (typeof params.outcome !== 'string' || !isCountColumn(params.outcome)) throw new Error('El desenlace elegido debe ser un recuento entero no negativo.');
          predictorList('covariates');
          if (!['auto', 'poisson', 'negative-binomial'].includes(String(params.method || 'auto'))) throw new Error('Elige una distribución disponible para el modelo de recuentos.');
          break;
        case 'data-quality': break;
        default: throw new Error('Ese análisis aún no tiene configuración por lenguaje natural.');
      }
      const variableParamKeys = new Set([
        'columns', 'variables', 'num_var', 'cat_var', 'dep_var', 'group_var', 'var1', 'var2',
        'outcome', 'predictor', 'time_var', 'event_var', 'indep_vars', 'covariates',
      ]);
      const plannedVariables = Object.entries(params)
        .filter(([key]) => variableParamKeys.has(key))
        .flatMap(([, value]) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === 'string');
      if (new Set(plannedVariables).size !== plannedVariables.length) throw new Error('La configuración asigna una misma columna a más de un papel. Corrige la petición.');
      if (plan.analysis_type === 'sample-size') {
        if (Number(params.alpha) <= 0 || Number(params.alpha) >= 1 || Number(params.power) <= 0 || Number(params.power) >= 1 || Number(params.effect) <= 0) throw new Error('Alfa y potencia deben estar entre 0 y 1 y el tamaño del efecto debe ser positivo.');
      }

      setSelectedAnalysis(option);
      setSelectedVars([]);
      setSelectedRoleValues(params as Record<string, string | string[]>);
      resetAnalysisModalState();
      if (['spearman', 'mannwhitney', 'nonparametric'].includes(String(params.method))) setUseNonParametric(true);
      setModalOpen(true);
    } catch (error) {
      setNaturalError(error instanceof Error ? error.message : 'No se pudo interpretar la petición con la IA local.');
    } finally {
      setNaturalLoading(false);
      setNaturalProgress(null);
    }
  };

  const handleCreateNaturalChart = async () => {
    if (!naturalPlan?.chart_type || !naturalPlan.x_var || !id) return;
    setNaturalLoading(true);
    setNaturalError(null);
    try {
      const chartTitle = naturalPlan.title || `Gráfico ${naturalPlan.chart_type} · ${naturalPlan.x_var}`;
      const response = await apiClient.post('/api/graph', {
        project_id: parseInt(id, 10),
        graph_type: naturalPlan.chart_type,
        x_var: naturalPlan.x_var,
        y_var: naturalPlan.y_var || null,
        fill_var: naturalPlan.fill_var || null,
        color_var: naturalPlan.fill_var || null,
        title: chartTitle,
        xlab: naturalPlan.x_var,
        ylab: naturalPlan.y_var || (naturalPlan.chart_type === 'histogram' ? 'Frecuencia' : ''),
        palette: 'Set2',
        theme: 'minimal',
        width: 8,
        height: 5.5,
        dpi: 300,
        bins: 30,
      });
      const usedVariables = [naturalPlan.x_var, naturalPlan.y_var, naturalPlan.fill_var].filter((value): value is string => Boolean(value));
      const now = new Date().toISOString();
      const chartResult: AnalysisResult = {
        metadata: {
          analysis_id: crypto.randomUUID(),
          analysis_type: 'ai-chart',
          title: chartTitle,
          description: naturalPlan.explanation || 'Gráfico generado a partir de una petición en lenguaje natural.',
          created_at: now,
          dataset_name: project?.filename,
          sample_size: rowData.length,
          variables_used: usedVariables,
          missing_observations: 0,
          valid_observations: rowData.length,
        },
        summary: {
          headline: chartTitle,
          key_metrics: [],
          interpretation: 'El gráfico se generó con el motor de visualización de la aplicación. Comprueba que las variables y las categorías reflejan la pregunta de investigación.',
        },
        tables: [],
        warnings: [],
        plots: [{
          id: `ai-chart-${Date.now()}`,
          title: chartTitle,
          plot_type: naturalPlan.chart_type,
          image_base64: response.data.image_base64,
          description: naturalPlan.explanation,
          script_r: response.data.script_r,
        }],
        technical: { method: `Gráfico ${naturalPlan.chart_type}`, packages_used: ['ggplot2'], parameters: { x_var: naturalPlan.x_var, y_var: naturalPlan.y_var, fill_var: naturalPlan.fill_var } },
        reproducible_code: { language: 'R', script: response.data.script_r, packages: ['ggplot2'], instructions: 'Código generado por el motor de gráficos de MedStats Studio.' },
      };
      updateOutputResults(previous => [chartResult, ...previous]);
      setAnalysisResult(chartResult);
      setActiveTab('results');
      setPanelOpen(false);
      setIsPanelExpanded(false);
      setViewingHistoryId(null);
      setSearchParams({ view: 'results' });
      setNaturalPlan(null);
    } catch (error: any) {
      setNaturalError(error.response?.data?.detail || 'No se pudo generar el gráfico. Comprueba las variables seleccionadas.');
    } finally {
      setNaturalLoading(false);
    }
  };

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
        'cox-regression',
        'mcnemar',
        'kappa',
        'bland-altman',
        'icc',
        'ancova',
        'friedman',
        'odds-ratio',
        'diagnostic-accuracy',
        'sample-size',
        'count-regression',
        'data-quality',
        'paired-comparison',
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
          const groupVar = selectedRoleValues.group_var as string | undefined;
          const tableVariables = currentSelectedVars.filter(variable => variable !== groupVar);
          if (tableVariables.length === 0) {
            setAnalysisError('Debes seleccionar al menos una variable para la Tabla 1.');
            setAnalysisLoading(false);
            return;
          }
          params = {
            variables: tableVariables,
            group_var: groupVar || null,
            decimals: 2,
          };
        } else if (test === 'cox-regression') {
          params = {
            time_var: selectedRoleValues.time_var,
            event_var: selectedRoleValues.event_var,
            covariates: selectedRoleValues.covariates || [],
          };
        } else if (test === 'ancova') {
          params = {
            dep_var: selectedRoleValues.dep_var,
            group_var: selectedRoleValues.group_var,
            covariates: selectedRoleValues.covariates || [],
          };
        } else if (['mcnemar', 'kappa', 'bland-altman'].includes(test)) {
          params = { var1: selectedRoleValues.var1, var2: selectedRoleValues.var2 };
        } else if (test === 'paired-comparison') {
          params = {
            var1: selectedRoleValues.var1,
            var2: selectedRoleValues.var2,
            method: selectedRoleValues.method || 'welch',
            conf_level: confLevel,
          };
        } else if (test === 'icc') {
          params = { columns: selectedRoleValues.columns || [] };
        } else if (test === 'friedman') {
          params = { columns: selectedRoleValues.columns || [] };
        } else if (test === 'odds-ratio') {
          params = { var1: selectedRoleValues.var1, var2: selectedRoleValues.var2 };
        } else if (test === 'diagnostic-accuracy') {
          params = {
            outcome: selectedRoleValues.outcome,
            predictor: selectedRoleValues.predictor,
            threshold: Number(selectedRoleValues.threshold),
          };
        } else if (test === 'sample-size') {
          params = {
            alpha: Number(selectedRoleValues.alpha),
            power: Number(selectedRoleValues.power),
            effect: Number(selectedRoleValues.effect),
            test_type: selectedRoleValues.test_type || 't-test',
          };
        } else if (test === 'count-regression') {
          params = {
            outcome: selectedRoleValues.outcome,
            covariates: selectedRoleValues.covariates || [],
            method: selectedRoleValues.method || 'auto',
          };
        }

        const response = await apiClient.post('/api/analysis/run', {
          project_id: parseInt(id!),
          analysis_type: test,
          params,
        });

        const structuredResult: AnalysisResult = response.data;
        updateOutputResults(prev => [structuredResult, ...prev]);
        setAnalysisResult(structuredResult);
        setActiveTab('results');
        setPanelOpen(false);
        setIsPanelExpanded(false);
        setViewingHistoryId(null);
        setSearchParams({ view: 'results' });
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
            payload.variables = currentSelectedVars.filter(variable => variable !== selectedRoleValues.group_var);
            payload.group_var = selectedRoleValues.group_var || null;
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
    setActiveTab('results');
    setPanelOpen(false);
    setSearchParams({ view: 'results' });
  };

  const resultHistory = outputResults.map(result => ({
    id: result.metadata.analysis_id,
    timestamp: result.metadata.created_at,
    testName: result.metadata.analysis_type,
    variables: result.metadata.variables_used || [],
    pValue: result.summary.key_metrics.find(metric => metric.p_value !== undefined)?.p_value ?? null,
    result,
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', padding: '2rem' }}>
        <div className="ms-spinner" style={{ marginRight: '0.75rem' }} />
        <span>Cargando proyecto...</span>
      </div>
    );
  }

  return (
    <div className="project-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--color-bg)' }}>
      {/* HEADER DEL PROYECTO */}
      <header
        className="project-topbar"
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
          {outputResults.length > 0 && (
            <button
              onClick={() => setSearchParams({ view: 'results' })}
              className="ms-btn ms-btn-sm ms-btn-secondary project-open-results"
            >
              <FileText size={15} /> Resultados <span>{outputResults.length}</span>
            </button>
          )}
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
      <div className="project-workspace" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          className="project-grid-pane"
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
          }}
        >
          <div className="project-grid-toolbar">
            <div className="project-grid-intro">
              <span className="project-grid-kicker">Datos del estudio</span>
              <strong>{rowData.length.toLocaleString()} registros <span>·</span> {columnDefs.length} variables</strong>
            </div>
            <label className="project-grid-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={gridSearch}
                onChange={(event) => setGridSearch(event.target.value)}
                placeholder="Buscar en los datos…"
                aria-label="Buscar en las filas del proyecto"
              />
              {gridSearch && <button type="button" onClick={() => setGridSearch('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </label>
            <span className="project-grid-hint">Edita celdas y cambia el tipo desde cada columna</span>
          </div>
          <div className="ag-theme-alpine project-data-grid">
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              quickFilterText={gridSearch}
              columnDefs={columnDefs}
              headerHeight={82}
              rowHeight={48}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 160,
                flex: 1,
                editable: true,
                wrapHeaderText: true,
                autoHeaderHeight: true,
              }}
              pagination={true}
              paginationPageSize={50}
              animateRows={true}
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

                    <section className="analysis-ai-assistant" aria-label="Análisis con lenguaje natural">
                      <div className="analysis-ai-heading">
                        <span className="analysis-ai-icon"><Sparkles size={17} /></span>
                        <div>
                          <strong>¿Qué quieres analizar o graficar?</strong>
                          <p>Descríbelo con tus palabras y te prepararé una configuración usando los análisis disponibles.</p>
                        </div>
                      </div>
                      <textarea
                        value={naturalRequest}
                        onChange={event => { setNaturalRequest(event.target.value); setNaturalError(null); setNaturalPlan(previous => previous?.kind === 'clarify' ? previous : null); }}
                        placeholder="Ej.: Compara la edad entre los grupos de tratamiento; o haz un gráfico de dispersión de edad y presión sistólica."
                        aria-label="Describe el análisis o gráfico que necesitas"
                        rows={3}
                        disabled={naturalLoading}
                      />
                      <div className="analysis-ai-footer">
                        <span>Modelo local Qwen3 · sin cuenta ni API key · el texto no sale de este navegador</span>
                        <button type="button" onClick={handleNaturalRequest} disabled={!naturalRequest.trim() || naturalLoading}>
                          <Sparkles size={15} /> {naturalLoading ? (naturalProgress || 'Interpretando…') : 'Interpretar petición'}
                        </button>
                      </div>
                      <p className="analysis-ai-download-note">La primera vez descarga el modelo (aprox. 600 MB). Necesita internet para esa descarga; luego se reutiliza desde la caché del navegador. En equipos sin WebGPU puede funcionar más despacio. MedStats Studio sigue en construcción: no introduzcas información personal o sensible.</p>
                      {naturalError && <div className="analysis-ai-message is-error" role="alert">{naturalError}</div>}
                      {naturalPlan?.kind === 'clarify' && (
                        <div className="analysis-ai-message" role="status">{naturalPlan.question}</div>
                      )}
                      {naturalPlan?.kind === 'chart' && (
                        <div className="analysis-ai-plan" role="status">
                          <div><strong>{naturalPlan.title || `Gráfico ${naturalPlan.chart_type}`}</strong><span>{naturalPlan.explanation || `${naturalPlan.x_var}${naturalPlan.y_var ? ` frente a ${naturalPlan.y_var}` : ''}`}</span></div>
                          <button type="button" onClick={handleCreateNaturalChart} disabled={naturalLoading}>
                            {naturalLoading ? 'Generando…' : 'Crear gráfico'}
                          </button>
                        </div>
                      )}
                    </section>

                    <div
                      style={{
                        background: 'linear-gradient(135deg, #F5F7F5 0%, #EDF1EE 100%)',
                        border: '1px solid #DCE4DF',
                        borderRadius: '10px',
                        padding: '1rem 1.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                        <Sparkles size={15} color="#9C4C2E" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#813D25', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Elige qué quieres averiguar
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#53615A', lineHeight: 1.45 }}>
                        Puedes elegir por el objetivo del análisis; cada opción explica qué responde y qué columnas necesitas. Los detalles técnicos siguen disponibles en el informe.
                      </p>
                    </div>

                    <label className="analysis-catalog-search">
                      <Search size={17} aria-hidden="true" />
                      <input
                        type="search"
                        value={analysisSearch}
                        onChange={event => setAnalysisSearch(event.target.value)}
                        placeholder="Buscar por objetivo o nombre del análisis…"
                        aria-label="Buscar análisis estadístico"
                      />
                      {analysisSearch && <button type="button" onClick={() => setAnalysisSearch('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}
                    </label>

                    {/* Agrupaciones por Disciplina / Categoría */}
                    {Array.from(new Set(analysisOptions
                      .filter(option => `${option.label} ${option.badge || ''} ${option.description} ${option.category}`.toLowerCase().includes(analysisSearch.trim().toLowerCase()))
                      .map(option => option.category))).map(categoryName => {
                      const optionsInCategory = analysisOptions.filter(option =>
                        option.category === categoryName && `${option.label} ${option.badge || ''} ${option.description}`.toLowerCase().includes(analysisSearch.trim().toLowerCase())
                      );

                      return (
                        <div key={categoryName} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              color: '#53615A',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              paddingBottom: '0.25rem',
                              borderBottom: '1px solid #EDF1EE',
                            }}
                          >
                            <span>{categoryName}</span>
                            <span style={{ color: '#DCE4DF' }}>({optionsInCategory.length})</span>
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
                                  border: '1px solid #DCE4DF',
                                  borderRadius: '10px',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 0.15s ease',
                                  color: '#29342E',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = 'rgba(156, 76, 46, 0.48)';
                                  e.currentTarget.style.backgroundColor = '#F5F7F5';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.05)';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = '#DCE4DF';
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
                                    backgroundColor: '#EDF1EE',
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
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#29342E' }}>
                                      {option.label}
                                    </div>
                                    {option.badge && (
                                      <span
                                        style={{
                                          backgroundColor: '#FBF4EE',
                                          color: '#813D25',
                                          border: '1px solid #E9C8B3',
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

                                  <div style={{ fontSize: '0.76rem', color: '#53615A', lineHeight: 1.4 }}>
                                    {option.description}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {analysisOptions.every(option => !`${option.label} ${option.badge || ''} ${option.description} ${option.category}`.toLowerCase().includes(analysisSearch.trim().toLowerCase())) && (
                      <div className="analysis-catalog-empty">No encontramos un análisis con “{analysisSearch}”. Prueba con “comparar”, “relación” o “supervivencia”.</div>
                    )}
                  </div>
                ) : (
                  <div>
                    {resultHistory.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#53615A', padding: '2rem 1rem' }}>
                        <History size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                        <p>No hay análisis previos en esta sesión.</p>
                      </div>
                    ) : (
                      resultHistory.map(entry => (
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
          className="project-analysis-backdrop"
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
            className="project-analysis-modal"
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
                background: '#F5F7F5',
                borderBottom: '1px solid #DCE4DF',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#53615A', fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#29342E', fontWeight: 600 }}>
                  <span style={{ width: '2rem', height: '2rem', borderRadius: '0.75rem', background: '#9C4C2E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <BarChart3 size={16} />
                  </span>
                  MedStats Analytics
                </span>
                <span style={{ color: '#53615A' }}>/</span>
                <span>{project?.name || 'Proyecto Actual'}</span>
                <span style={{ color: '#53615A' }}>/</span>
                <span style={{ background: '#F4E5D9', color: '#713820', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {project?.filename || 'Dataset activo'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button title="Cerrar modal" onClick={closeModal} style={{ border: 'none', background: 'transparent', color: '#53615A', cursor: 'pointer', fontSize: '1.25rem' }}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="project-analysis-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div className="project-analysis-options" style={{ width: '65%', padding: '1.5rem', overflowY: 'auto', background: '#F5F7F5', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: '#29342E' }}>Configura el análisis</h2>
                  <p style={{ marginTop: '0.65rem', fontSize: '0.95rem', color: '#53615A', lineHeight: 1.7 }}>
                    Elige qué columna representa cada papel. Puedes dejar los ajustes avanzados como están si no necesitas modificarlos.
                  </p>
                </div>

                <div style={{ background: 'white', border: '1px solid #DCE4DF', borderRadius: '18px', padding: '1rem', display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#713820', fontWeight: 700, fontSize: '0.8rem' }}>
                    <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '999px', background: '#AE6441' }}></span>
                    Selección de variables para {selectedAnalysis.label}
                  </div>

                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {selectedAnalysis.id === 'linear-regression' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variable dependiente</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`linear-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variables independientes</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {getAllowedColumnsForRole('indep').map(colName => {
                              const checked = (selectedRoleValues.indep_vars as string[] | undefined)?.includes(colName) || false;
                              return (
                                <label key={`linear-indep-${colName}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', background: '#F5F7F5' }}>
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
                                  <span style={{ color: '#29342E' }}>{colName}</span>
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variable dependiente (binaria)</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`logistic-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variables independientes</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {getAllowedColumnsForRole('indep').map(colName => {
                              const checked = (selectedRoleValues.indep_vars as string[] | undefined)?.includes(colName) || false;
                              return (
                                <label key={`logistic-indep-${colName}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', background: '#F5F7F5' }}>
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
                                  <span style={{ color: '#29342E' }}>{colName}</span>
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variable dependiente</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`anova-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variable de grupo</div>
                          <select
                            value={selectedRoleValues.group_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, group_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variable numérica</div>
                          <select
                            value={selectedRoleValues.num_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, num_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('num').map(colName => (
                              <option key={`compare-num-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Variable categórica</div>
                          <select
                            value={selectedRoleValues.cat_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, cat_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>{selectedAnalysis.id === 'correlation' ? 'Variable 1' : 'Variable 1 (categórica)'}</div>
                          <select
                            value={selectedRoleValues.var1 || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, var1: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('var1').map(colName => (
                              <option key={`var1-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>{selectedAnalysis.id === 'correlation' ? 'Variable 2' : 'Variable 2 (categórica)'}</div>
                          <select
                            value={selectedRoleValues.var2 || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, var2: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Resultado / outcome</div>
                          <select
                            value={selectedRoleValues.outcome || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, outcome: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('outcome').map(colName => (
                              <option key={`roc-outcome-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Predictores</div>
                          <select
                            value={selectedRoleValues.predictor || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, predictor: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Tiempo</div>
                          <select
                            value={selectedRoleValues.time_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, time_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('time').map(colName => (
                              <option key={`km-time-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Evento</div>
                          <select
                            value={selectedRoleValues.event_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, event_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('event').map(colName => (
                              <option key={`km-event-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#29342E', marginBottom: '0.5rem' }}>Grupo (opcional)</div>
                          <select
                            value={selectedRoleValues.group_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, group_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', outline: 'none', fontSize: '0.9rem', color: '#29342E' }}
                          >
                            <option value="">Ninguno</option>
                            {getAllowedColumnsForRole('group').map(colName => (
                              <option key={`km-group-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'cox-regression' && (
                      <>
                        {([
                          ['time_var', 'Tiempo hasta el evento', 'time'],
                          ['event_var', 'Evento (0 = censura, 1 = evento)', 'event'],
                        ] as const).map(([key, label, role]) => (
                          <label className="analysis-role-field" key={key}>
                            <span>{label}</span>
                            <select value={selectedRoleValues[key] || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, [key]: event.target.value }))}>
                              <option value="">Selecciona una variable</option>
                              {getAllowedColumnsForRole(role).map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </label>
                        ))}
                        <div>
                          <div className="analysis-role-field"><span>Covariables para ajustar</span></div>
                          <div style={{ display: 'grid', gap: '.5rem' }}>
                            {getAllowedColumnsForRole('covariates').map(name => {
                              const checked = ((selectedRoleValues.covariates as string[] | undefined) || []).includes(name);
                              return <label key={name} className="analysis-variable-choice"><input type="checkbox" checked={checked} onChange={() => setSelectedRoleValues(prev => { const current = (prev.covariates as string[] | undefined) || []; return { ...prev, covariates: checked ? current.filter(value => value !== name) : [...current, name] }; })} /><span>{name}</span></label>;
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedAnalysis.id === 'ancova' && (
                      <>
                        {([
                          ['dep_var', 'Resultado numérico', 'dep'],
                          ['group_var', 'Grupo a comparar', 'group'],
                        ] as const).map(([key, label, role]) => (
                          <label className="analysis-role-field" key={key}>
                            <span>{label}</span>
                            <select value={selectedRoleValues[key] || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, [key]: event.target.value }))}>
                              <option value="">Selecciona una variable</option>
                              {getAllowedColumnsForRole(role).map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </label>
                        ))}
                        <div>
                          <div className="analysis-role-field"><span>Covariables de ajuste</span></div>
                          <div style={{ display: 'grid', gap: '.5rem' }}>
                            {getAllowedColumnsForRole('covariates').map(name => {
                              const checked = ((selectedRoleValues.covariates as string[] | undefined) || []).includes(name);
                              return <label key={name} className="analysis-variable-choice"><input type="checkbox" checked={checked} onChange={() => setSelectedRoleValues(prev => { const current = (prev.covariates as string[] | undefined) || []; return { ...prev, covariates: checked ? current.filter(value => value !== name) : [...current, name] }; })} /><span>{name}</span></label>;
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {['mcnemar', 'kappa', 'bland-altman', 'odds-ratio', 'paired-comparison'].includes(selectedAnalysis.id) && (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {(['var1', 'var2'] as const).map((key, index) => (
                          <label className="analysis-role-field" key={key}>
                            <span>{index === 0 ? 'Primera variable' : 'Segunda variable'}</span>
                            <select value={selectedRoleValues[key] || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, [key]: event.target.value }))}>
                              <option value="">Selecciona una variable</option>
                              {getAllowedColumnsForRole(key).map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </label>
                        ))}
                        {selectedAnalysis.id === 'paired-comparison' && (
                          <>
                            <p style={{ margin: 0, color: '#665D54', fontSize: '.8rem', lineHeight: 1.5 }}>Cada fila debe corresponder a la misma persona en las dos mediciones.</p>
                            <label className="analysis-role-field">
                              <span>Método</span>
                              <select value={selectedRoleValues.method || 'welch'} onChange={event => setSelectedRoleValues(prev => ({ ...prev, method: event.target.value }))}>
                                <option value="welch">t pareada</option>
                                <option value="mannwhitney">Wilcoxon signed-rank</option>
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                    )}

                    {selectedAnalysis.id === 'icc' && (
                      <div style={{ display: 'grid', gap: '.5rem' }}>
                        <p style={{ margin: '0 0 .25rem', color: '#63716b', fontSize: '.88rem' }}>Selecciona al menos dos columnas con mediciones comparables de los mismos sujetos.</p>
                        {getAllowedColumnsForRole('columns').map(name => {
                          const checked = ((selectedRoleValues.columns as string[] | undefined) || []).includes(name);
                          return <label key={name} className="analysis-variable-choice"><input type="checkbox" checked={checked} onChange={() => setSelectedRoleValues(prev => { const current = (prev.columns as string[] | undefined) || []; return { ...prev, columns: checked ? current.filter(value => value !== name) : [...current, name] }; })} /><span>{name}</span></label>;
                        })}
                      </div>
                    )}

                    {selectedAnalysis.id === 'friedman' && (
                      <div style={{ display: 'grid', gap: '.5rem' }}>
                        <p style={{ margin: '0 0 .25rem', color: '#63716b', fontSize: '.88rem' }}>Selecciona al menos tres columnas con mediciones de los mismos sujetos.</p>
                        {getAllowedColumnsForRole('columns').map(name => {
                          const checked = ((selectedRoleValues.columns as string[] | undefined) || []).includes(name);
                          return <label key={name} className="analysis-variable-choice"><input type="checkbox" checked={checked} onChange={() => setSelectedRoleValues(prev => { const current = (prev.columns as string[] | undefined) || []; return { ...prev, columns: checked ? current.filter(value => value !== name) : [...current, name] }; })} /><span>{name}</span></label>;
                        })}
                      </div>
                    )}

                    {selectedAnalysis.id === 'diagnostic-accuracy' && (
                      <>
                        {([
                          ['outcome', 'Desenlace de referencia (0/1)', 'outcome'],
                          ['predictor', 'Prueba o marcador numérico', 'predictor'],
                        ] as const).map(([key, label, role]) => (
                          <label className="analysis-role-field" key={key}>
                            <span>{label}</span>
                            <select value={selectedRoleValues[key] || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, [key]: event.target.value }))}>
                              <option value="">Selecciona una variable</option>
                              {getAllowedColumnsForRole(role).map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </label>
                        ))}
                        <label className="analysis-role-field">
                          <span>Umbral de positividad</span>
                          <input type="number" step="any" value={selectedRoleValues.threshold || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, threshold: event.target.value }))} placeholder="p. ej. 0,5" />
                        </label>
                      </>
                    )}

                    {selectedAnalysis.id === 'sample-size' && (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <label className="analysis-role-field">
                          <span>Tipo de contraste</span>
                          <select value={selectedRoleValues.test_type || 't-test'} onChange={event => setSelectedRoleValues(prev => ({ ...prev, test_type: event.target.value }))}>
                            <option value="t-test">Dos medias (d de Cohen)</option>
                            <option value="proporciones">Dos proporciones (h de Cohen)</option>
                            <option value="ANOVA">ANOVA de tres grupos (f de Cohen)</option>
                          </select>
                        </label>
                        {([
                          ['alpha', 'Alfa', '0.05'],
                          ['power', 'Potencia deseada', '0.80'],
                          ['effect', 'Tamaño del efecto (d, h o f)', '0.5'],
                        ] as const).map(([key, label, placeholder]) => (
                          <label className="analysis-role-field" key={key}>
                            <span>{label}</span>
                            <input type="number" min="0" step="any" value={selectedRoleValues[key] || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, [key]: event.target.value }))} placeholder={placeholder} />
                          </label>
                        ))}
                        <p style={{ margin: 0, color: '#665D54', fontSize: '.8rem', lineHeight: 1.5 }}>Se calcula a partir del tamaño del efecto esperado; no se usan filas del conjunto de datos.</p>
                      </div>
                    )}

                    {selectedAnalysis.id === 'count-regression' && (
                      <>
                        <label className="analysis-role-field">
                          <span>Desenlace: recuento entero no negativo</span>
                          <select value={selectedRoleValues.outcome || ''} onChange={event => setSelectedRoleValues(prev => ({ ...prev, outcome: event.target.value }))}>
                            <option value="">Selecciona una variable numérica</option>
                            {getAllowedColumnsForRole('outcome').map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </label>
                        <label className="analysis-role-field">
                          <span>Distribución</span>
                          <select value={selectedRoleValues.method || 'auto'} onChange={event => setSelectedRoleValues(prev => ({ ...prev, method: event.target.value }))}>
                            <option value="auto">Automática según sobredispersión</option>
                            <option value="poisson">Poisson</option>
                            <option value="negative-binomial">Binomial negativa</option>
                          </select>
                        </label>
                        <div>
                          <div className="analysis-role-field"><span>Predictores</span></div>
                          <div style={{ display: 'grid', gap: '.5rem' }}>
                            {getAllowedColumnsForRole('covariates').map(name => {
                              const checked = ((selectedRoleValues.covariates as string[] | undefined) || []).includes(name);
                              return <label key={name} className="analysis-variable-choice"><input type="checkbox" checked={checked} onChange={() => setSelectedRoleValues(prev => { const current = (prev.covariates as string[] | undefined) || []; return { ...prev, covariates: checked ? current.filter(value => value !== name) : [...current, name] }; })} /><span>{name}</span></label>;
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {['descriptive', 'table1'].includes(selectedAnalysis.id) && (
                      <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <p style={{ margin: '0 0 .25rem', color: '#63716b', fontSize: '.88rem' }}>
                          {selectedAnalysis.id === 'table1'
                            ? 'Elige las variables que aparecerán en la tabla basal.'
                            : 'Elige las variables que quieres resumir.'}
                        </p>
                        {selectedAnalysis.id === 'table1' && (
                          <label className="analysis-role-field">
                            <span>Separar la tabla por grupos <small>Opcional</small></span>
                            <select
                              value={selectedRoleValues.group_var || ''}
                              onChange={event => setSelectedRoleValues(prev => ({ ...prev, group_var: event.target.value }))}
                            >
                              <option value="">Mostrar la muestra completa</option>
                              {getAllowedColumnsForRole('group').map(colName => (
                                <option key={`table1-group-${colName}`} value={colName}>{colName}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {Object.entries(columnTypes).map(([colName, colType]) => (
                          <label key={colName} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #DCE4DF', background: '#F5F7F5' }}>
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
                            <span style={{ color: '#29342E' }}>{colName}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#53615A' }}>{colType === 'numeric' ? 'Numérica' : colType === 'binary' ? 'Binaria' : colType === 'categorical' ? 'Categórica' : colType}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="project-analysis-summary">
                <div className="project-analysis-summary-content">
                  <div className="analysis-summary-heading">
                    <span className="analysis-summary-kicker">Configuración</span>
                    <h3>{selectedAnalysis.label}</h3>
                    <p>{selectedAnalysis.description}</p>
                  </div>

                  <section className="analysis-selection-summary" aria-live="polite">
                    <div className="analysis-summary-kicker">Variables seleccionadas</div>
                    {getCurrentSelectedVars().length ? (
                      <div className="analysis-variable-chips">
                        {getCurrentSelectedVars().map(variable => (
                          <span className="analysis-variable-chip" key={variable}>
                            <span>{variable}</span>
                            <small>{columnTypes[variable] === 'numeric' ? 'Numérica' : columnTypes[variable] === 'binary' ? 'Binaria' : columnTypes[variable] === 'categorical' ? 'Categórica' : columnTypes[variable] || 'Variable'}</small>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="analysis-summary-empty">Aún no hay variables seleccionadas. Elige las columnas que pide este análisis.</p>
                    )}
                  </section>

                  {['compare', 'anova', 'correlation'].includes(selectedAnalysis.id) && (
                    <section className="analysis-method-card">
                      <span className="analysis-summary-kicker">Método</span>
                      <strong>{getRecommendedTestInfo().title}</strong>
                      <p>{getRecommendedTestInfo().explanation}</p>
                      <label className="analysis-method-toggle">
                        <input type="checkbox" checked={useNonParametric} onChange={() => setUseNonParametric(value => !value)} />
                        <span>Usar alternativa basada en rangos ({getRecommendedTestInfo().alternative})</span>
                      </label>
                    </section>
                  )}

                  {['compare', 'correlation', 'linear-regression', 'logistic-regression', 'roc-curve', 'kaplan-meier'].includes(selectedAnalysis.id) && <section className="analysis-advanced-section">
                    <button type="button" className="analysis-advanced-toggle" onClick={() => setAdvancedOptionsOpen(value => !value)} aria-expanded={advancedOptionsOpen}>
                      <span>Opciones del análisis</span>
                      <span>{advancedOptionsOpen ? '−' : '+'}</span>
                    </button>
                    {advancedOptionsOpen && (
                      <label className="analysis-confidence-field">
                        <span>Nivel de confianza del intervalo</span>
                        <select value={confLevel} onChange={event => setConfLevel(Number(event.target.value))}>
                          <option value={0.95}>95 %</option>
                          <option value={0.99}>99 %</option>
                          <option value={0.90}>90 %</option>
                        </select>
                      </label>
                    )}
                  </section>}

                  <p className="analysis-guidance-note">Los supuestos y avisos disponibles se mostrarán después de ejecutar el análisis. No se marcarán como verificados antes de calcularlos.</p>
                </div>

                <div className="analysis-run-footer">
                  <button
                    onClick={handleRunAnalysis}
                    disabled={!isSelectionComplete()}
                    className="ms-btn ms-btn-primary"
                  >
                    Ejecutar análisis
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isResultsWorkspace && (
        <main className="project-results-workspace" aria-label="Resultados del proyecto">
          <header className="project-results-header">
            <div className="project-results-heading">
              <button type="button" className="ms-btn ms-btn-secondary project-results-back" onClick={returnToProjectData}>
                <ArrowLeft size={16} /> Volver a los datos
              </button>
              <div>
                <div className="project-results-breadcrumb">{project?.name || 'Proyecto'} <ChevronRight size={14} /> Resultados</div>
                <h1>Resultados estadísticos</h1>
                <p>{outputResults.length} {outputResults.length === 1 ? 'análisis guardado' : 'análisis guardados'} en esta sesión</p>
              </div>
            </div>
            <div className="project-results-actions">
              <button type="button" className="ms-btn ms-btn-primary" onClick={openNewAnalysis}>
                <Sparkles size={16} /> Nuevo análisis
              </button>
            </div>
          </header>
          <div className="project-results-content">
            {outputResults.length > 0 ? (
              <OutputViewer
                results={outputResults}
                onDeleteResult={handleDeleteOutputResult}
                onClearAll={handleClearAllOutputs}
                initialSelectedId={viewingHistoryId}
              />
            ) : (
              <div className="project-results-empty">
                <div className="project-results-empty-icon"><BarChart3 size={26} /></div>
                <h2>Aún no hay resultados</h2>
                <p>Ejecuta un análisis desde la base de datos y aparecerá aquí para que puedas consultarlo después.</p>
                <button type="button" className="ms-btn ms-btn-primary" onClick={openNewAnalysis}>
                  <Sparkles size={16} /> Lanzar un análisis
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ESTILOS EMBEBIDOS */}
      <style>{`
        .numeric-header::after {
          content: ' [123]';
          font-size: 0.65rem;
          color: #53615A;
          margin-left: 4px;
          font-weight: 400;
        }
        .categorical-header::after {
          content: ' [Abc]';
          font-size: 0.65rem;
          color: #53615A;
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
