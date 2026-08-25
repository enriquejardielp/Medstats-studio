"""
test_unified_architecture.py - Test integral de la Fase 2 (Motor y Esquema de Resultados)
"""

import pandas as pd
import numpy as np

from backend.core.analyses.registry import AnalysisRegistry
from backend.core.results_schema import AnalysisResult, DiagnosticStatus, ColumnFormat


def test_descriptive_analysis():
    df = pd.DataFrame({
        "edad": [25, 30, 35, 40, 45, 50, 55, 60, np.nan],
        "sexo": ["M", "F", "M", "F", "M", "F", "M", "F", "M"],
        "presion": [120, 130, 125, 140, 135, 150, 145, 160, 155]
    })
    
    analyzer = AnalysisRegistry.get("descriptive")
    result = analyzer.run(df, {"columns": ["edad", "sexo", "presion"]})
    
    assert isinstance(result, AnalysisResult)
    assert result.metadata.sample_size == 9
    assert len(result.tables) >= 2  # Numérica + Categórica
    assert len(result.warnings) == 1  # Warning por valor faltante en edad
    assert result.reproducible_code.language == "R"
    assert "mean" in result.tables[0].columns[3].key


def test_correlation_analysis():
    np.random.seed(42)
    x = np.linspace(10, 50, 30)
    y = 2.5 * x + np.random.normal(0, 5, 30)
    df = pd.DataFrame({"dosis": x, "respuesta": y})
    
    analyzer = AnalysisRegistry.get("correlation")
    result = analyzer.run(df, {"var1": "dosis", "var2": "respuesta", "method": "pearson"})
    
    assert isinstance(result, AnalysisResult)
    assert len(result.summary.key_metrics) >= 3
    assert len(result.diagnostics) == 2  # Shapiro para ambas variables
    assert result.tables[0].rows[0]["coeficiente"] > 0.8
    assert "No establece una relación de causalidad" in result.summary.interpretation or "asociación" in result.summary.interpretation


def test_linear_regression_analysis():
    np.random.seed(42)
    x1 = np.random.normal(50, 10, 40)
    x2 = np.random.normal(100, 15, 40)
    y = 10 + 0.5 * x1 + 0.3 * x2 + np.random.normal(0, 2, 40)
    df = pd.DataFrame({"y": y, "x1": x1, "x2": x2})
    
    analyzer = AnalysisRegistry.get("linear-regression")
    result = analyzer.run(df, {"dep_var": "y", "indep_vars": ["x1", "x2"]})
    
    assert isinstance(result, AnalysisResult)
    assert len(result.tables[0].rows) == 3  # Intercept + x1 + x2
    assert len(result.diagnostics) >= 2  # Shapiro + DW + VIF
    assert result.technical.method == "Mínimos Cuadrados Ordinarios (OLS)"
    assert "lm(" in result.reproducible_code.script


if __name__ == "__main__":
    test_descriptive_analysis()
    print("✓ Test Descriptivos completado con éxito")
    test_correlation_analysis()
    print("✓ Test Correlación completado con éxito")
    test_linear_regression_analysis()
    print("✓ Test Regresión Lineal completado con éxito")
