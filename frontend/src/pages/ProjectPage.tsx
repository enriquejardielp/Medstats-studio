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
  Info,
  Copy,
} from 'lucide-react';
import apiClient from '../api/client';
import type { ColumnType } from '../types';
import { formatCorrelationResult } from '../utils/correlation';

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
    this.eGui.style.alignItems = 'center';
    this.eGui.style.justifyContent = 'center';
    this.eGui.style.width = '100%';
    this.eGui.style.padding = '4px';

    const nameSpan = document.createElement('span');
    nameSpan.style.fontSize = '13px';
    nameSpan.style.fontWeight = '600';
    nameSpan.textContent = displayName;

    const select = document.createElement('select');
    select.style.fontSize = '11px';
    select.style.marginTop = '2px';
    select.style.padding = '1px 4px';
    select.style.borderRadius = '4px';
    select.style.border = '1px solid #cbd5e1';
    select.style.background = '#f8fafc';
    select.style.cursor = 'pointer';

    const types: ColumnType[] = ['numeric', 'categorical', 'binary', 'date', 'id', 'text'];
    types.forEach(t => {
      const option = document.createElement('option');
      option.value = t;
      option.text = t === 'numeric' ? 'Numérica' :
                    t === 'categorical' ? 'Categórica' :
                    t === 'binary' ? 'Binaria' :
                    t === 'date' ? 'Fecha' :
                    t === 'id' ? 'ID' : 'Texto';
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
}

interface AnalysisOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  requiredTypes: { numeric: number; categorical: number };
  allowMore: boolean;
}

const analysisOptions: AnalysisOption[] = [
  { id: 'descriptive', label: 'Descriptivos', icon: <BarChart3 size={20} />, description: 'Media, mediana, SD, etc.', requiredTypes: { numeric: 1, categorical: 0 }, allowMore: true },
  { id: 'compare', label: 'Comparar grupos', icon: <BarChart3 size={20} />, description: 't-test, Mann-Whitney', requiredTypes: { numeric: 1, categorical: 1 }, allowMore: false },
  { id: 'correlation', label: 'Correlación', icon: <BarChart3 size={20} />, description: 'Pearson, Spearman', requiredTypes: { numeric: 2, categorical: 0 }, allowMore: false },
  { id: 'anova', label: 'ANOVA / Kruskal-Wallis', icon: <BarChart3 size={20} />, description: 'Comparación de múltiples grupos', requiredTypes: { numeric: 1, categorical: 1 }, allowMore: false },
  { id: 'chi-square', label: 'Chi-cuadrado', icon: <BarChart3 size={20} />, description: 'Asociación entre categóricas', requiredTypes: { numeric: 0, categorical: 2 }, allowMore: false },
  { id: 'linear-regression', label: 'Regresión lineal', icon: <BarChart3 size={20} />, description: 'Relación lineal', requiredTypes: { numeric: 2, categorical: 0 }, allowMore: true },
  { id: 'logistic-regression', label: 'Regresión logística', icon: <BarChart3 size={20} />, description: 'Outcome binario', requiredTypes: { numeric: 1, categorical: 1 }, allowMore: true },
  { id: 'roc-curve', label: 'Curva ROC', icon: <BarChart3 size={20} />, description: 'Diagnóstico', requiredTypes: { numeric: 1, categorical: 1 }, allowMore: false },
  { id: 'kaplan-meier', label: 'Kaplan-Meier', icon: <BarChart3 size={20} />, description: 'Supervivencia', requiredTypes: { numeric: 1, categorical: 1 }, allowMore: false },
  { id: 'table1', label: 'Tabla 1', icon: <BarChart3 size={20} />, description: 'Características basales', requiredTypes: { numeric: 1, categorical: 0 }, allowMore: true },
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
  const [editMode, setEditMode] = useState<'edition' | 'analysis'>('edition');
  const [activeTab, setActiveTab] = useState<'config' | 'history'>('config');

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisOption | null>(null);
  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [selectedRoleValues, setSelectedRoleValues] = useState<Record<string, string | string[]>>({});

  const [analysisResult, setAnalysisResult] = useState<any>(null);
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
            cellClassRules: editMode === 'edition'
              ? {
                  'ag-cell-invalid': (params: any) =>
                    isNumeric && params.value !== '' && isNaN(Number(params.value)),
                }
              : undefined,
            headerComponentParams: {
              ...col.headerComponentParams,
              columnType: newType,
            },
          };
        }
        return col;
      })
    );
  }, [editMode]);

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
          minWidth: 120,
          flex: 1,
          editable: editMode === 'edition',
          cellClassRules: editMode === 'edition'
            ? {
                'ag-cell-invalid': (params: any) =>
                  isNumeric && params.value !== '' && isNaN(Number(params.value)),
              }
            : undefined,
        };
      });

      setColumnDefs(cols);
    } catch (err: any) {
      setError('Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  }, [id, editMode, handleTypeChange]);

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
    if (panelOpen) {
      setPanelOpen(false);
      setEditMode('edition');
    } else {
      setPanelOpen(true);
      setEditMode('analysis');
    }
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
      case 'linear-regression':
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

  if (loading) return <div style={{ padding: '2rem', color: '#64748b' }}>Cargando proyecto...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* HEADER */}
      <header
        style={{
          height: '60px',
          background: 'white',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/projects')}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '6px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
            {project?.name || 'Proyecto'}
          </h1>
          <span
            style={{
              background: '#f1f5f9',
              color: '#475569',
              padding: '0.15rem 0.6rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            N = {project?.row_count || 0}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleSave}
            disabled={saving || editMode === 'analysis'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              borderRadius: '8px',
              background: 'white',
              color: editMode === 'analysis' ? '#94a3b8' : '#334155',
              fontSize: '0.85rem',
              cursor: editMode === 'analysis' ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: editMode === 'analysis' ? 0.4 : 1,
              transition: 'all 0.2s',
            }}
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={loadProject}
            disabled={editMode === 'analysis'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              borderRadius: '8px',
              background: 'white',
              color: editMode === 'analysis' ? '#94a3b8' : '#334155',
              fontSize: '0.85rem',
              cursor: editMode === 'analysis' ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: editMode === 'analysis' ? 0.4 : 1,
              transition: 'all 0.2s',
            }}
          >
            <RotateCcw size={16} /> Recargar
          </button>
          <button
            onClick={togglePanel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1.2rem',
              border: panelOpen ? '1px solid rgba(226, 232, 240, 0.8)' : 'none',
              borderRadius: '8px',
              background: panelOpen ? 'white' : '#2563eb',
              color: panelOpen ? '#64748b' : 'white',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {panelOpen ? (
              <>
                <X size={16} /> Cerrar Panel
              </>
            ) : (
              <>
                <BarChart3 size={16} /> Lanzar Análisis Estadístico
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
            borderRadius: '12px',
            background: error ? '#fef2f2' : '#f0fdf4',
            border: error ? '1px solid #fecaca' : '1px solid #bbf7d0',
            color: error ? '#991b1b' : '#166534',
            fontSize: '0.875rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          {error || successMsg}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* TABLA AG GRID */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            transition: 'margin-right 0.3s ease-in-out',
          }}
        >
          <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 100,
                flex: 1,
                editable: editMode === 'edition',
              }}
              pagination={true}
              paginationPageSize={100}
            />
          </div>
        </div>

        {/* PANEL LATERAL */}
        <div
          style={{
            width: panelOpen ? '440px' : '0px',
            height: '100%',
            background: 'white',
            borderLeft: panelOpen ? '1px solid rgba(226, 232, 240, 0.8)' : 'none',
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
                  borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                  Análisis Estadístico
                </h2>
                <button
                  onClick={togglePanel}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '0.25rem',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
                <button
                  onClick={() => setActiveTab('config')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    background: activeTab === 'config' ? '#f1f5f9' : 'transparent',
                    color: activeTab === 'config' ? '#0f172a' : '#64748b',
                    fontWeight: activeTab === 'config' ? 600 : 400,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'config' ? '2px solid #2563eb' : '2px solid transparent',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Settings size={16} /> Análisis
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    border: 'none',
                    background: activeTab === 'history' ? '#f1f5f9' : 'transparent',
                    color: activeTab === 'history' ? '#0f172a' : '#64748b',
                    fontWeight: activeTab === 'history' ? 600 : 400,
                    cursor: 'pointer',
                    borderBottom: activeTab === 'history' ? '2px solid #2563eb' : '2px solid transparent',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <History size={16} /> Historial
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {activeTab === 'config' ? (
                  <div>
                    {!analysisResult ? (
                      <>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                          Selecciona el tipo de análisis que deseas realizar:
                        </p>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {analysisOptions.map(option => (
                            <button
                              key={option.id}
                              onClick={() => openAnalysisModal(option)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s',
                                color: '#0f172a',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            >
                              <div style={{ color: '#2563eb' }}>{option.icon}</div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{option.label}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{option.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div>
                        {/* Vista específica para descriptivos */}
                        {selectedAnalysis?.id === 'descriptive' ? (
                          <div style={{ marginTop: '1rem' }}>
                            {analysisResult.numeric && Object.keys(analysisResult.numeric).length > 0 && (
                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Variables numéricas</h4>
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Variable</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>N</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Media</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Mediana</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>SD</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Min</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Max</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Q1</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Q3</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(analysisResult.numeric).map(([varName, stats]: [string, any]) => (
                                        <tr key={varName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '0.3rem 0.4rem', fontWeight: 500 }}>{varName}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.n}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.mean?.toFixed(2)}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.median?.toFixed(2)}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.sd?.toFixed(2)}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.min?.toFixed(2)}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.max?.toFixed(2)}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.q1?.toFixed(2)}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{stats.q3?.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            {analysisResult.categorical && Object.keys(analysisResult.categorical).length > 0 && (
                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Variables categóricas</h4>
                                {Object.entries(analysisResult.categorical).map(([varName, freqs]: [string, any]) => (
                                  <div key={varName} style={{ marginBottom: '1rem' }}>
                                    <p style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{varName}</p>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ padding: '0.4rem', textAlign: 'left' }}>Valor</th>
                                            <th style={{ padding: '0.4rem', textAlign: 'right' }}>Frecuencia</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Array.isArray(freqs) && freqs.map((row: any, i: number) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '0.3rem 0.4rem' }}>{row.value}</td>
                                              <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.count}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : selectedAnalysis?.id === 'linear-regression' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Regresión lineal</h4>
                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.45rem', textAlign: 'left' }}>Variable</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>Estimación</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>Error std</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>t</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>p-valor</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>IC 95% inf</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>IC 95% sup</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.isArray(analysisResult.coeficientes) && analysisResult.coeficientes.map((row: any, index: number) => (
                                    <tr key={`${row.variable || 'coef'}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '0.4rem 0.45rem', fontWeight: 500 }}>{row.variable || '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.estimacion !== undefined ? Number(row.estimacion).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.error_std !== undefined ? Number(row.error_std).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.t_valor !== undefined ? Number(row.t_valor).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.p_valor !== undefined ? Number(row.p_valor).toFixed(4) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.ic_inferior !== undefined ? Number(row.ic_inferior).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.ic_superior !== undefined ? Number(row.ic_superior).toFixed(3) : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>R²</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.r_cuadrado !== undefined ? Number(analysisResult.r_cuadrado).toFixed(3) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>R² ajustado</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.r_cuadrado_adj !== undefined ? Number(analysisResult.r_cuadrado_adj).toFixed(3) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>F estadístico</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                  {analysisResult.f_estadistico !== undefined ? `${Number(analysisResult.f_estadistico).toFixed(2)}` : '-'}
                                  {analysisResult.p_valor_f !== undefined ? ` (p = ${Number(analysisResult.p_valor_f).toFixed(3)})` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : selectedAnalysis?.id === 'logistic-regression' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Regresión logística</h4>
                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.45rem', textAlign: 'left' }}>Variable</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>OR</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>IC 95% inf</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>IC 95% sup</th>
                                    <th style={{ padding: '0.45rem', textAlign: 'right' }}>p-valor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.isArray(analysisResult.coeficientes) && analysisResult.coeficientes.map((row: any, index: number) => (
                                    <tr key={`${row.variable || 'coef'}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '0.4rem 0.45rem', fontWeight: 500 }}>{row.variable || '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.odds_ratio !== undefined ? Number(row.odds_ratio).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.ic_inferior !== undefined ? Number(row.ic_inferior).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.ic_superior !== undefined ? Number(row.ic_superior).toFixed(3) : '-'}</td>
                                      <td style={{ padding: '0.4rem 0.45rem', textAlign: 'right' }}>{row.p_valor !== undefined ? Number(row.p_valor).toFixed(4) : '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>AIC</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.aic !== undefined ? Number(analysisResult.aic).toFixed(2) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Nagelkerke R²</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.nagelkerke_r2 !== undefined ? Number(analysisResult.nagelkerke_r2).toFixed(3) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Hosmer-Lemeshow</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.hosmer_lemeshow_p !== undefined ? `p = ${Number(analysisResult.hosmer_lemeshow_p).toFixed(3)}` : '-'}</div>
                              </div>
                            </div>
                          </div>
                        ) : selectedAnalysis?.id === 'anova' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>ANOVA</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Método</div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>{analysisResult.metodo || '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>p-valor</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.p_valor !== undefined ? Number(analysisResult.p_valor).toFixed(4) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Estadístico</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.estadistico !== undefined ? Number(analysisResult.estadistico).toFixed(3) : '-'}</div>
                              </div>
                            </div>
                            {analysisResult.effect_size !== undefined && (
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tamaño del efecto</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>{analysisResult.effect_label || 'effect size'}: {Number(analysisResult.effect_size).toFixed(3)}</div>
                              </div>
                            )}
                            {(analysisResult.levene_p !== undefined || analysisResult.shapiro_residuos_p !== undefined) && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                {analysisResult.levene_p !== undefined && (
                                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Levene</div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>p = {Number(analysisResult.levene_p).toFixed(3)}</div>
                                  </div>
                                )}
                                {analysisResult.shapiro_residuos_p !== undefined && (
                                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Shapiro residuos</div>
                                    <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>p = {Number(analysisResult.shapiro_residuos_p).toFixed(3)}</div>
                                  </div>
                                )}
                              </div>
                            )}
                            {Array.isArray(analysisResult.tukey) && analysisResult.tukey.length > 0 && (
                              <div>
                                <h5 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Tukey HSD</h5>
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '0.4rem', textAlign: 'left' }}>Comparación</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>Diff</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>lwr</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>upr</th>
                                        <th style={{ padding: '0.4rem', textAlign: 'right' }}>p adj</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {analysisResult.tukey.map((row: any, idx: number) => (
                                        <tr key={`${row.comparacion || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '0.3rem 0.4rem', fontWeight: 500 }}>{row.comparacion || '-'}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.diff !== undefined ? Number(row.diff).toFixed(3) : '-'}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.lwr !== undefined ? Number(row.lwr).toFixed(3) : '-'}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.upr !== undefined ? Number(row.upr).toFixed(3) : '-'}</td>
                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.p_adj !== undefined ? Number(row.p_adj).toFixed(4) : '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : selectedAnalysis?.id === 'correlation' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            {(() => {
                              const correlationView = formatCorrelationResult(analysisResult);
                              return (
                                <>
                                  <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: '#f1f5f9', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '1rem' }}>
                                    {correlationView.methodBadge}
                                  </div>

                                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', textAlign: 'center', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>
                                      {correlationView.rLabel}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                                      {correlationView.strengthLabel}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '180px', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>p-valor</div>
                                      <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                        {correlationView.pValueLabel}
                                      </div>
                                    </div>
                                    <div style={{ flex: 2, minWidth: '220px', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>IC 95%</div>
                                      <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                        {correlationView.confidenceIntervalLabel}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                    {correlationView.sampleSizeLabel}
                                  </div>
                                  {correlationView.diagnosticsLabel && (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                      {correlationView.diagnosticsLabel}
                                    </div>
                                  )}
                                  {correlationView.autoNote && (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                      {correlationView.autoNote}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : selectedAnalysis?.id === 'chi-square' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Chi-cuadrado</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Método</div>
                                <div style={{ fontSize: '1rem', fontWeight: 600 }}>{analysisResult.metodo || '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Estadístico χ²</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.estadistico !== undefined ? Number(analysisResult.estadistico).toFixed(3) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>gl</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.gl !== undefined ? Number(analysisResult.gl).toFixed(0) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>p-valor</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.p_valor !== undefined ? Number(analysisResult.p_valor).toFixed(4) : '-'}</div>
                              </div>
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>V de Cramér</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{analysisResult.cramer_v !== undefined ? Number(analysisResult.cramer_v).toFixed(3) : '-'}</div>
                              </div>
                            </div>
                            {Array.isArray(analysisResult.tabla) && analysisResult.tabla.length > 0 && (
                              <div>
                                <h5 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Tabla de contingencia</h5>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        {Object.keys(analysisResult.tabla[0]).map((key: string) => (
                                          <th key={key} style={{ padding: '0.4rem', textAlign: 'left' }}>{key}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {analysisResult.tabla.map((row: any, idx: number) => (
                                        <tr key={`${row.var1 || idx}-${row.var2 || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          {Object.entries(row).map(([key, value]: [string, any]) => (
                                            <td key={`${key}-${idx}`} style={{ padding: '0.3rem 0.4rem' }}>{value}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : selectedAnalysis?.id === 'roc-curve' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Curva ROC</h4>
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>AUC</div>
                              <div style={{ fontSize: '1.15rem', fontWeight: 600 }}>{analysisResult.auc !== undefined ? Number(analysisResult.auc).toFixed(3) : '-'} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{analysisResult.auc !== undefined ? (Number(analysisResult.auc) < 0.5 ? 'malo' : Number(analysisResult.auc) < 0.7 ? 'regular' : Number(analysisResult.auc) < 0.8 ? 'bueno' : Number(analysisResult.auc) < 0.9 ? 'muy bueno' : 'excelente') : ''}</span></div>
                            </div>
                            {Array.isArray(analysisResult.coords) && analysisResult.coords.length > 0 && (
                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                      <th style={{ padding: '0.4rem', textAlign: 'left' }}>Umbral</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Sensibilidad</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Especificidad</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>VPP</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>VPN</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {analysisResult.coords.map((row: any, idx: number) => (
                                      <tr key={`${row.umbral || idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.3rem 0.4rem', fontWeight: 500 }}>{row.umbral !== undefined ? Number(row.umbral).toFixed(2) : '-'}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.sensibilidad !== undefined ? Number(row.sensibilidad).toFixed(3) : '-'}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.especificidad !== undefined ? Number(row.especificidad).toFixed(3) : '-'}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.vpp !== undefined ? Number(row.vpp).toFixed(3) : '-'}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{row.vpn !== undefined ? Number(row.vpn).toFixed(3) : '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ) : selectedAnalysis?.id === 'kaplan-meier' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Kaplan-Meier</h4>
                            {analysisResult.logrank_p !== undefined && (
                              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Log-rank p</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{Number(analysisResult.logrank_p).toFixed(4)}</div>
                              </div>
                            )}
                            {analysisResult.strata_nombres && analysisResult.strata_nombres.length > 0 && (
                              <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                                Estratos: {analysisResult.strata_nombres.join(', ')}
                              </div>
                            )}
                            {Array.isArray(analysisResult.tiempos) && analysisResult.tiempos.length > 0 && (
                              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                      <th style={{ padding: '0.4rem', textAlign: 'left' }}>Tiempo</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>Supervivencia</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>N riesgo</th>
                                      <th style={{ padding: '0.4rem', textAlign: 'right' }}>N evento</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {analysisResult.tiempos.map((time: any, idx: number) => (
                                      <tr key={`${time}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.3rem 0.4rem', fontWeight: 500 }}>{time}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{analysisResult.supervivencia?.[idx] !== undefined ? Number(analysisResult.supervivencia[idx]).toFixed(3) : '-'}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{analysisResult.n_riesgo?.[idx] !== undefined ? Number(analysisResult.n_riesgo[idx]).toFixed(0) : '-'}</td>
                                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>{analysisResult.n_evento?.[idx] !== undefined ? Number(analysisResult.n_evento[idx]).toFixed(0) : '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ) : selectedAnalysis?.id === 'table1' ? (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Tabla 1</h4>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                              {Array.isArray(analysisResult.table) && analysisResult.table.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                  <tbody>
                                    {analysisResult.table.map((row: any, idx: number) => (
                                      <tr key={`${Object.keys(row)[0] || idx}`} style={{ borderBottom: idx < analysisResult.table.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                        {Object.entries(row).map(([key, value]: [string, any]) => (
                                          <td key={`${key}-${idx}`} style={{ padding: '0.45rem 0.6rem', borderRight: key === 'Overall' ? 'none' : 'none' }}>
                                            <div style={{ fontWeight: key === 'Overall' ? 600 : 500, color: '#0f172a' }}>{key}</div>
                                            <div style={{ color: '#64748b', marginTop: '0.15rem' }}>{value}</div>
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1, background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tamaño del efecto</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                {analysisResult.effect_size !== undefined ? `${Number(analysisResult.effect_size).toFixed(3)}` : '-'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{analysisResult.effect_label || analysisResult.effect_size_label || ''}</div>
                            </div>
                            <div style={{ flex: 1, background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>IC 95%</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                {analysisResult.ic_inferior !== undefined ? `[${Number(analysisResult.ic_inferior).toFixed(3)}, ${Number(analysisResult.ic_superior).toFixed(3)}]` : '-'}
                              </div>
                            </div>
                            <div style={{ flex: 1, background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                p-valor <span title="Con N grande, variaciones triviales pueden ser estadísticamente significativas. Evalúe siempre el tamaño del efecto."><Info size={12} style={{ cursor: 'help' }} /></span>
                              </div>
                              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                                {analysisResult.p_valor !== undefined ? Number(analysisResult.p_valor).toFixed(4) : '-'}
                              </div>
                            </div>
                          </div>
                        )}

                        {analysisResult.script_r && (
                          <details style={{ marginBottom: '1rem' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#2563eb', fontWeight: 500 }}>📄 Ver script R utilizado</summary>
                            <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', maxHeight: '300px', marginTop: '0.5rem' }}>
                              {analysisResult.script_r}
                            </pre>
                            <button
                              onClick={() => navigator.clipboard.writeText(analysisResult.script_r)}
                              style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#2563eb' }}
                            >
                              <Copy size={14} /> Copiar código
                            </button>
                          </details>
                        )}

                        {analysisResult.graph_base64 && (
                          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                            <img
                              src={`data:image/png;base64,${analysisResult.graph_base64}`}
                              alt="Gráfico del análisis"
                              style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                            />
                          </div>
                        )}

                        {analysisResult.tabla && (
                          <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Tabla de contingencia</h4>
                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    {Array.isArray(analysisResult.tabla) && analysisResult.tabla.length > 0 &&
                                      Object.keys(analysisResult.tabla[0]).map(key => (
                                        <th key={key} style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 600, color: '#334155' }}>{key}</th>
                                      ))
                                    }
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.isArray(analysisResult.tabla) && analysisResult.tabla.map((row: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      {Object.values(row).map((val: any, j: number) => (
                                        <td key={j} style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>{String(val)}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => { setAnalysisResult(null); setAnalysisError(null); }}
                          style={{
                            marginTop: '1rem',
                            width: '100%',
                            padding: '0.6rem',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: '#334155',
                          }}
                        >
                          ← Volver a lista de análisis
                        </button>
                      </div>
                    )}

                    {analysisError && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.875rem' }}>
                        <strong>Error:</strong> {analysisError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {history.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 1rem' }}>
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
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            background: viewingHistoryId === entry.id ? '#f0f9ff' : 'white',
                          }}
                        >
                          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {analysisOptions.find(o => o.id === entry.testName)?.label || entry.testName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {entry.variables.join(', ')} — p = {entry.pValue?.toFixed(4) || 'N/A'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
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
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#334155', fontSize: '0.85rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0f172a', fontWeight: 600 }}>
                  <span style={{ width: '2rem', height: '2rem', borderRadius: '0.75rem', background: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <BarChart3 size={16} />
                  </span>
                  MedStats Analytics
                </span>
                <span style={{ color: '#64748b' }}>/</span>
                <span>{project?.name || 'Proyecto Actual'}</span>
                <span style={{ color: '#64748b' }}>/</span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {project?.filename || 'Dataset activo'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button title="Cerrar modal" onClick={closeModal} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '1.25rem' }}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ width: '65%', padding: '1.5rem', overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>Configuración del análisis estadístico</h2>
                  <p style={{ marginTop: '0.65rem', fontSize: '0.95rem', color: '#475569', lineHeight: 1.7 }}>
                    Selecciona las variables clave e incorpora covariables para ajustar tu modelo. El panel está diseñado para guiar tu flujo como si fuera un tablero de Jira, con pasos claros y recomendaciones inteligentes.
                  </p>
                </div>

                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '1rem', display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#164e63', fontWeight: 700, fontSize: '0.8rem' }}>
                    <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '999px', background: '#0ea5e9' }}></span>
                    Selección de variables para {selectedAnalysis.label}
                  </div>

                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {selectedAnalysis.id === 'linear-regression' && (
                      <>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variable dependiente</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`linear-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variables independientes</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {getAllowedColumnsForRole('indep').map(colName => {
                              const checked = (selectedRoleValues.indep_vars as string[] | undefined)?.includes(colName) || false;
                              return (
                                <label key={`linear-indep-${colName}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
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
                                  <span style={{ color: '#0f172a' }}>{colName}</span>
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variable dependiente (binaria)</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`logistic-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variables independientes</div>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {getAllowedColumnsForRole('indep').map(colName => {
                              const checked = (selectedRoleValues.indep_vars as string[] | undefined)?.includes(colName) || false;
                              return (
                                <label key={`logistic-indep-${colName}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
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
                                  <span style={{ color: '#0f172a' }}>{colName}</span>
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variable dependiente</div>
                          <select
                            value={selectedRoleValues.dep_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, dep_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('dep').map(colName => (
                              <option key={`anova-dep-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variable de grupo</div>
                          <select
                            value={selectedRoleValues.group_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, group_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variable numérica</div>
                          <select
                            value={selectedRoleValues.num_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, num_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('num').map(colName => (
                              <option key={`compare-num-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Variable categórica</div>
                          <select
                            value={selectedRoleValues.cat_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, cat_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>{selectedAnalysis.id === 'correlation' ? 'Variable 1' : 'Variable 1 (categórica)'}</div>
                          <select
                            value={selectedRoleValues.var1 || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, var1: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('var1').map(colName => (
                              <option key={`var1-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>{selectedAnalysis.id === 'correlation' ? 'Variable 2' : 'Variable 2 (categórica)'}</div>
                          <select
                            value={selectedRoleValues.var2 || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, var2: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Resultado / outcome</div>
                          <select
                            value={selectedRoleValues.outcome || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, outcome: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('outcome').map(colName => (
                              <option key={`roc-outcome-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Predictores</div>
                          <select
                            value={selectedRoleValues.predictor || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, predictor: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
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
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Tiempo</div>
                          <select
                            value={selectedRoleValues.time_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, time_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('time').map(colName => (
                              <option key={`km-time-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Evento</div>
                          <select
                            value={selectedRoleValues.event_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, event_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
                          >
                            <option value="">Selecciona una variable</option>
                            {getAllowedColumnsForRole('event').map(colName => (
                              <option key={`km-event-${colName}`} value={colName}>{colName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Grupo (opcional)</div>
                          <select
                            value={selectedRoleValues.group_var || ''}
                            onChange={(e) => setSelectedRoleValues(prev => ({ ...prev, group_var: e.target.value }))}
                            style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', color: '#0f172a' }}
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
                          <label key={colName} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
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
                            <span style={{ color: '#0f172a' }}>{colName}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>{colType === 'numeric' ? 'Numérica' : colType === 'binary' ? 'Binaria' : colType === 'categorical' ? 'Categórica' : colType}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '18px', overflow: 'hidden' }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Variables de ajuste y covariables</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Añade columnas que controlen el efecto de confusión en tus modelos.</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>{Math.min(100, Math.round((covariates.length / 4) * 100))}% procesado</span>
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.75rem', background: '#f8fafc' }}>
                    {covariates.length === 0 ? (
                      <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem 0' }}>No hay variables de ajuste añadidas.</div>
                    ) : covariates.map((cov) => (
                      <div key={cov.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{cov.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{cov.type}</div>
                        </div>
                        <button onClick={() => deleteCovariate(cov.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }} title="Eliminar covariable">×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem 1rem', background: 'white', borderTop: '1px solid #e2e8f0' }}>
                    <select
                      value={newCovariateOption}
                      onChange={(e) => setNewCovariateOption(e.target.value)}
                      style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
                    >
                      <option value="Edad">[Num] Edad</option>
                      <option value="Género">[Cat] Género</option>
                      <option value="PSistólica (Pre)">[Num] PSistólica (Pre)</option>
                      <option value="Estadio Tumor">[Ord] Estadio Tumor</option>
                    </select>
                    <button onClick={addCovariate} style={{ padding: '0.75rem 1rem', borderRadius: '14px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Agregar variable</button>
                  </div>
                </div>

                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>Notas del investigador</div>
                  <textarea
                    value={analysisNotes}
                    onChange={(e) => setAnalysisNotes(e.target.value)}
                    placeholder="Añade observaciones sobre los supuestos estadísticos o limitaciones del análisis..."
                    style={{ width: '100%', minHeight: '120px', resize: 'vertical', borderRadius: '16px', border: '1px solid #cbd5e1', padding: '1rem', fontSize: '0.9rem', color: '#0f172a' }}
                  />
                  <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>Tip: usa este bloque para documentar ajustes clínicos y supuestos de tu prueba.</p>
                </div>
              </div>

              <div style={{ width: '35%', background: '#ffffff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflowY: 'auto' }}>
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>Estado del análisis</div>
                    <button style={{ width: '100%', marginTop: '0.85rem', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid #bae6fd', background: '#ecfeff', color: '#0369a1', fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
                      Listo para ejecutar
                    </button>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', color: '#0f172a', fontWeight: 700 }}>
                      <span style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.75rem', background: '#0ea5e9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><BarChart3 size={16} /></span>
                      <span style={{ fontSize: '0.9rem' }}>Test recomendado</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{getRecommendedTestInfo().title}</div>
                      <p style={{ marginTop: '0.65rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>{getRecommendedTestInfo().explanation}</p>
                    </div>
                    <div style={{ marginTop: '1rem', padding: '0.9rem', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Alternativa no paramétrica</div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>{getRecommendedTestInfo().alternative}</span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={useNonParametric} onChange={() => setUseNonParametric(prev => !prev)} style={{ width: '1rem', height: '1rem' }} />
                          <span style={{ fontSize: '0.75rem', color: '#475569' }}>Activar</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Verificación de supuestos</div>
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
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Sí</span>
                          </label>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155' }}>
                        <span>Nivel de confianza</span>
                        <select
                          value={confLevel}
                          onChange={(e) => setConfLevel(Number(e.target.value))}
                          style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0.35rem 0.7rem', fontSize: '0.8rem', color: '#0f172a', background: 'white' }}
                        >
                          <option value={0.95}>95% (α = 0.05)</option>
                          <option value={0.99}>99% (α = 0.01)</option>
                          <option value={0.90}>90% (α = 0.10)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
                      <span>Creado</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{new Date().toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Actualizado</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>Ahora</span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <button
                    onClick={handleRunAnalysis}
                    disabled={!isSelectionComplete()}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      borderRadius: '18px',
                      border: 'none',
                      background: !isSelectionComplete() ? '#93c5fd' : '#2563eb',
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
          color: #64748b;
          margin-left: 4px;
          font-weight: 400;
        }
        .categorical-header::after {
          content: ' [Abc]';
          font-size: 0.65rem;
          color: #64748b;
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