"""
registry.py - Registro y Fábrica de Módulos Estadísticos
MedStats Studio
"""

from typing import Dict, Type
from backend.core.base_analysis import BaseAnalysis
from backend.core.analyses.descriptive import DescriptiveAnalysis
from backend.core.analyses.correlation import CorrelationAnalysis
from backend.core.analyses.linear_regression import LinearRegressionAnalysis
from backend.core.analyses.logistic_regression import LogisticRegressionAnalysis
from backend.core.analyses.compare import CompareTwoGroupsAnalysis
from backend.core.analyses.anova import AnovaAnalysis
from backend.core.analyses.chi_square import ChiSquareAnalysis
from backend.core.analyses.roc_curve import RocCurveAnalysis


class AnalysisRegistry:
    """
    Registro centralizado de análisis. Permite registrar y despachar cualquier
    módulo que herede de BaseAnalysis.
    """
    _registry: Dict[str, Type[BaseAnalysis]] = {
        "descriptive": DescriptiveAnalysis,
        "correlation": CorrelationAnalysis,
        "linear-regression": LinearRegressionAnalysis,
        "logistic-regression": LogisticRegressionAnalysis,
        "compare": CompareTwoGroupsAnalysis,
        "anova": AnovaAnalysis,
        "chi-square": ChiSquareAnalysis,
        "roc-curve": RocCurveAnalysis,
    }

    @classmethod
    def register(cls, analysis_type: str, analysis_cls: Type[BaseAnalysis]):
        cls._registry[analysis_type] = analysis_cls

    @classmethod
    def get(cls, analysis_type: str) -> BaseAnalysis:
        analysis_cls = cls._registry.get(analysis_type)
        if not analysis_cls:
            raise ValueError(f"Tipo de análisis no soportado: '{analysis_type}'. Disponibles: {list(cls._registry.keys())}")
        return analysis_cls()
