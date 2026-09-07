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


def test_logistic_regression_analysis():
    np.random.seed(42)
    x1 = np.random.normal(0, 1, 60)
    x2 = np.random.normal(0, 1, 60)
    prob = 1 / (1 + np.exp(-(0.5 + 1.2 * x1 - 0.8 * x2)))
    y = np.random.binomial(1, prob)
    df = pd.DataFrame({"evento": y, "x1": x1, "x2": x2})

    analyzer = AnalysisRegistry.get("logistic-regression")
    result = analyzer.run(df, {"dep_var": "evento", "indep_vars": ["x1", "x2"]})

    assert isinstance(result, AnalysisResult)
    assert len(result.tables[0].rows) == 3  # Intercept + x1 + x2
    assert result.metadata.valid_observations == 60
    assert len(result.plots) >= 1  # Forest Plot
    assert result.plots[0].plot_type == "forest_plot"


def test_compare_two_groups_analysis():
    np.random.seed(42)
    g1 = np.random.normal(100, 15, 30)
    g2 = np.random.normal(115, 15, 30)
    df = pd.DataFrame({
        "valor": np.concatenate([g1, g2]),
        "tratamiento": ["Control"] * 30 + ["Fármaco"] * 30
    })

    analyzer = AnalysisRegistry.get("compare")
    result = analyzer.run(df, {"num_var": "valor", "cat_var": "tratamiento", "method": "welch"})

    assert isinstance(result, AnalysisResult)
    assert len(result.tables[0].rows) == 2  # 2 grupos
    assert len(result.diagnostics) >= 2  # Normalidad g1 + g2
    assert len(result.plots) >= 1


def test_anova_analysis():
    np.random.seed(42)
    g1 = np.random.normal(50, 5, 20)
    g2 = np.random.normal(55, 5, 20)
    g3 = np.random.normal(60, 5, 20)
    df = pd.DataFrame({
        "presion": np.concatenate([g1, g2, g3]),
        "dosis": ["Baja"] * 20 + ["Media"] * 20 + ["Alta"] * 20
    })

    analyzer = AnalysisRegistry.get("anova")
    result = analyzer.run(df, {"dep_var": "presion", "group_var": "dosis", "method": "parametric"})

    assert isinstance(result, AnalysisResult)
    assert len(result.tables) >= 2  # Descriptivos + Tukey
    assert len(result.plots) >= 1


def test_chi_square_analysis():
    df = pd.DataFrame({
        "fumador": ["Sí"] * 40 + ["No"] * 60,
        "enfermedad": ["Caso"] * 30 + ["Control"] * 10 + ["Caso"] * 15 + ["Control"] * 45
    })

    analyzer = AnalysisRegistry.get("chi-square")
    result = analyzer.run(df, {"var1": "fumador", "var2": "enfermedad"})

    assert isinstance(result, AnalysisResult)
    assert len(result.tables[0].rows) == 4  # 2x2 celdas
    assert len(result.plots) >= 1


def test_roc_curve_analysis():
    np.random.seed(42)
    y = np.array([1]*30 + [0]*30)
    score = np.concatenate([np.random.normal(70, 10, 30), np.random.normal(50, 10, 30)])
    df = pd.DataFrame({"estado": y, "biomarcador": score})

    analyzer = AnalysisRegistry.get("roc-curve")
    result = analyzer.run(df, {"outcome": "estado", "predictor": "biomarcador"})

    assert isinstance(result, AnalysisResult)
    assert result.summary.key_metrics[0].value > 0.7  # AUC
    assert len(result.plots) >= 1


if __name__ == "__main__":
    test_descriptive_analysis()
    print("✓ Test Descriptivos completado con éxito")
    test_correlation_analysis()
    print("✓ Test Correlación completado con éxito")
    test_linear_regression_analysis()
    print("✓ Test Regresión Lineal completado con éxito")
    test_logistic_regression_analysis()
    print("✓ Test Regresión Logística completado con éxito")
    test_compare_two_groups_analysis()
    print("✓ Test Comparación 2 Grupos completado con éxito")
    test_anova_analysis()
    print("✓ Test ANOVA completado con éxito")
    test_chi_square_analysis()
    print("✓ Test Chi-Cuadrado completado con éxito")
    test_roc_curve_analysis()
    print("✓ Test Curva ROC completado con éxito")
