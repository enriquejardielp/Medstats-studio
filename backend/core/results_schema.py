"""
results_schema.py - Esquema Unificado de Resultados Estadísticos (DTO)
MedStats Studio - Arquitectura Stata + SPSS + R
"""

from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class DiagnosticStatus(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    INFO = "info"


class WarningSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ColumnFormat(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    DECIMAL = "decimal"
    P_VALUE = "p_value"
    PERCENTAGE = "percentage"
    CONF_INTERVAL = "conf_interval"


# =============================================================================
# NIVEL 1: METADATOS Y RESUMEN EJECUTIVO
# =============================================================================

class AnalysisMetadata(BaseModel):
    analysis_id: str
    analysis_type: str
    title: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    dataset_name: Optional[str] = None
    sample_size: int
    variables_used: List[str]
    missing_observations: int = 0
    valid_observations: int


class MetricItem(BaseModel):
    key: str
    label: str
    value: Union[float, int, str, None]
    formatted: str
    description: Optional[str] = None
    p_value: Optional[float] = None
    significance_star: Optional[str] = None  # '*', '**', '***'


class ExecutiveSummary(BaseModel):
    headline: str  # Ej: "R² = 0.428, F(2, 497) = 184.3, p < .001"
    key_metrics: List[MetricItem]
    interpretation: str  # Lenguaje estadísticamente riguroso sin afirmaciones causales


# =============================================================================
# NIVEL 2: TABLAS ESTADÍSTICAS INTERACTIVAS
# =============================================================================

class TableColumnDef(BaseModel):
    key: str
    label: str
    align: str = "right"  # "left", "center", "right"
    format_type: ColumnFormat = ColumnFormat.DECIMAL
    decimals: int = 3
    visible: bool = True
    sortable: bool = True
    tooltip: Optional[str] = None


class TableFootnote(BaseModel):
    symbol: str
    text: str


class StatisticalTable(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    columns: List[TableColumnDef]
    rows: List[Dict[str, Any]]
    footnotes: List[TableFootnote] = Field(default_factory=list)
    confidence_level: Optional[float] = None


# =============================================================================
# NIVEL 3: DIAGNÓSTICOS, SUPUESTOS Y ADVERTENCIAS
# =============================================================================

class DiagnosticItem(BaseModel):
    id: str
    name: str  # Ej: "Normalidad de Residuos (Shapiro-Wilk)"
    status: DiagnosticStatus
    statistic_name: Optional[str] = None  # "W", "DW", "VIF"
    statistic_value: Optional[float] = None
    p_value: Optional[float] = None
    threshold: Optional[str] = None
    finding: str  # "Residuos con distribución normal (p = 0.452)"
    recommendation: Optional[str] = None


class AnalysisWarning(BaseModel):
    code: str
    severity: WarningSeverity
    message: str
    variable: Optional[str] = None
    action_suggested: Optional[str] = None


# =============================================================================
# NIVEL 4 & 5: DETALLES TÉCNICOS, GRÁFICOS Y CÓDIGO REPRODUCIBLE
# =============================================================================

class TechnicalDetails(BaseModel):
    method: str
    formula: Optional[str] = None
    r_version: Optional[str] = None
    packages_used: List[str] = Field(default_factory=list)
    degrees_of_freedom: Optional[Union[int, float, List[Union[int, float]]]] = None
    log_likelihood: Optional[float] = None
    aic: Optional[float] = None
    bic: Optional[float] = None
    convergence: Optional[bool] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)


class AnalysisPlot(BaseModel):
    id: str
    title: str
    plot_type: str  # "coefficients", "residuals", "scatter", "qqplot", "histogram"
    image_base64: str
    description: Optional[str] = None
    script_r: str


class ReproducibleCode(BaseModel):
    language: str = "R"
    script: str
    packages: List[str]
    instructions: Optional[str] = None


# =============================================================================
# OBJETO MAESTRO: AnalysisResult
# =============================================================================

class AnalysisResult(BaseModel):
    metadata: AnalysisMetadata
    summary: ExecutiveSummary
    tables: List[StatisticalTable]
    diagnostics: List[DiagnosticItem] = Field(default_factory=list)
    warnings: List[AnalysisWarning] = Field(default_factory=list)
    plots: List[AnalysisPlot] = Field(default_factory=list)
    technical: TechnicalDetails
    reproducible_code: ReproducibleCode
