"""
correlation.py - Módulo de Correlación Bivariada y Matrices
MedStats Studio
"""

import pandas as pd
import numpy as np
import uuid
from typing import Dict, Any, List, Tuple

from backend.core.base_analysis import BaseAnalysis
from backend.core.results_schema import (
    AnalysisResult,
    AnalysisMetadata,
    ExecutiveSummary,
    MetricItem,
    StatisticalTable,
    TableColumnDef,
    TableFootnote,
    ColumnFormat,
    DiagnosticItem,
    DiagnosticStatus,
    AnalysisWarning,
    WarningSeverity,
    TechnicalDetails,
    ReproducibleCode,
)


class CorrelationAnalysis(BaseAnalysis):
    analysis_type = "correlation"
    title = "Análisis de Correlación"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        var1 = params.get("var1")
        var2 = params.get("var2")
        columns = params.get("columns", [])

        if not columns and (var1 and var2):
            columns = [var1, var2]

        if len(columns) < 2:
            raise ValueError("Se requieren al menos dos variables numéricas para calcular la correlación.")

        missing_cols = [c for c in columns if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Variables no encontradas en el dataset: {missing_cols}")

        subset = df[columns].dropna()
        if len(subset) < 3:
            raise ValueError("Se requieren al menos 3 observaciones completas para calcular la correlación.")

        warnings = []
        n_dropped = len(df) - len(subset)
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se excluyeron {n_dropped} casos con valores faltantes (eliminación por lista).",
                    action_suggested=f"Análisis realizado sobre N = {len(subset)} observaciones completas."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        method = params.get("method", "pearson").lower()
        conf_level = float(params.get("conf_level", 0.95))
        var1 = params.get("var1")
        var2 = params.get("var2")

        r_v1 = col_map[var1]
        r_v2 = col_map[var2]

        return f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        x <- as.numeric(datos[['{r_v1}']])
        y <- as.numeric(datos[['{r_v2}']])

        ct <- cor.test(x, y, method = '{method}', conf.level = {conf_level})

        r_val <- as.numeric(ct$estimate)
        p_val <- as.numeric(ct$p.value)
        ci_low <- if (!is.null(ct$conf.int)) as.numeric(ct$conf.int[1]) else NA
        ci_high <- if (!is.null(ct$conf.int)) as.numeric(ct$conf.int[2]) else NA
        t_stat <- if (!is.null(ct$statistic)) as.numeric(ct$statistic) else NA
        df_stat <- if (!is.null(ct$parameter)) as.numeric(ct$parameter) else NA

        # Test de normalidad Shapiro-Wilk si n entre 3 y 5000
        n_obs <- length(x)
        sw_x <- if (n_obs >= 3 && n_obs <= 5000) shapiro.test(x)$p.value else NA
        sw_y <- if (n_obs >= 3 && n_obs <= 5000) shapiro.test(y)$p.value else NA

        res <- list(
            coeficiente = r_val,
            p_valor = p_val,
            estadistico = t_stat,
            gl = df_stat,
            ic_inferior = ci_low,
            ic_superior = ci_high,
            n = n_obs,
            metodo = '{method}',
            conf_level = {conf_level},
            diagnosticos = list(
                shapiro_x = as.numeric(sw_x),
                shapiro_y = as.numeric(sw_y)
            )
        )
        cat(toJSON(res, auto_unbox = TRUE, na = "null"))
        """

    def parse_to_schema(
        self,
        raw_r_output: Dict[str, Any],
        script_r: str,
        valid_df: pd.DataFrame,
        params: dict,
        warnings: List[AnalysisWarning],
        col_map: Dict[str, str],
        inv_map: Dict[str, str]
    ) -> AnalysisResult:
        analysis_id = str(uuid.uuid4())
        var1 = params.get("var1")
        var2 = params.get("var2")
        method = raw_r_output.get("metodo", "pearson").capitalize()
        r_val = raw_r_output.get("coeficiente", 0.0)
        p_val = raw_r_output.get("p_valor", 1.0)
        n_obs = raw_r_output.get("n", len(valid_df))
        ci_low = raw_r_output.get("ic_inferior")
        ci_high = raw_r_output.get("ic_superior")

        # Nivel de significación
        stars = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""
        p_formatted = "< .001" if p_val < 0.001 else f"{p_val:.4f}"

        # Diagnósticos de Normalidad
        diagnostics = []
        diag_data = raw_r_output.get("diagnosticos", {})
        sw_x = diag_data.get("shapiro_x")
        sw_y = diag_data.get("shapiro_y")

        if sw_x is not None:
            status_x = DiagnosticStatus.PASS if sw_x > 0.05 else DiagnosticStatus.WARNING
            diagnostics.append(
                DiagnosticItem(
                    id="shapiro_var1",
                    name=f"Normalidad: {var1} (Shapiro-Wilk)",
                    status=status_x,
                    p_value=sw_x,
                    finding=f"p = {sw_x:.4f} ({'Normal' if sw_x > 0.05 else 'Distribución no normal'})",
                    recommendation="Si la normalidad no se cumple, se sugiere considerar correlación de Spearman." if sw_x <= 0.05 else None
                )
            )

        if sw_y is not None:
            status_y = DiagnosticStatus.PASS if sw_y > 0.05 else DiagnosticStatus.WARNING
            diagnostics.append(
                DiagnosticItem(
                    id="shapiro_var2",
                    name=f"Normalidad: {var2} (Shapiro-Wilk)",
                    status=status_y,
                    p_value=sw_y,
                    finding=f"p = {sw_y:.4f} ({'Normal' if sw_y > 0.05 else 'Distribución no normal'})",
                    recommendation="Si la normalidad no se cumple, se sugiere considerar correlación de Spearman." if sw_y <= 0.05 else None
                )
            )

        # Interpretación estadística prudente (sin causalidad)
        direction = "positiva" if r_val > 0 else "negativa"
        strength = "muy fuerte" if abs(r_val) >= 0.8 else "fuerte" if abs(r_val) >= 0.6 else "moderada" if abs(r_val) >= 0.4 else "débil" if abs(r_val) >= 0.2 else "muy débil o nula"
        if p_val < 0.05:
            interp_text = f"Se observa una asociación lineal estadísticamente significativa ({direction}, {strength}) entre {var1} y {var2} (r = {r_val:.3f}, p {p_formatted}). Este hallazgo describe una asociación matemática y no establece una relación de causalidad."
        else:
            interp_text = f"No se encontró evidencia de correlación estadísticamente significativa entre {var1} y {var2} (r = {r_val:.3f}, p = {p_val:.4f})."

        # Tabla de Correlación
        table_rows = [{
            "par": f"{var1} — {var2}",
            "metodo": method,
            "coeficiente": r_val,
            "p_valor": p_val,
            "ic_95": f"[{ci_low:.3f}, {ci_high:.3f}]" if ci_low is not None and ci_high is not None else "N/D",
            "n": n_obs
        }]

        table = StatisticalTable(
            id="table_correlation_summary",
            title=f"Matriz de Correlación ({method})",
            columns=[
                TableColumnDef(key="par", label="Variables", align="left", format_type=ColumnFormat.TEXT),
                TableColumnDef(key="metodo", label="Método", align="center", format_type=ColumnFormat.TEXT),
                TableColumnDef(key="coeficiente", label=f"Coeficiente (r)", format_type=ColumnFormat.DECIMAL, decimals=3),
                TableColumnDef(key="p_valor", label="p-valor", format_type=ColumnFormat.P_VALUE, decimals=4),
                TableColumnDef(key="ic_95", label="IC 95%", align="center", format_type=ColumnFormat.TEXT),
                TableColumnDef(key="n", label="N", format_type=ColumnFormat.NUMBER, decimals=0),
            ],
            rows=table_rows,
            footnotes=[
                TableFootnote(symbol="*", text="p < .05"),
                TableFootnote(symbol="**", text="p < .01"),
                TableFootnote(symbol="***", text="p < .001")
            ]
        )

        return AnalysisResult(
            metadata=AnalysisMetadata(
                analysis_id=analysis_id,
                analysis_type=self.analysis_type,
                title=f"{self.title}: {var1} vs {var2}",
                sample_size=n_obs,
                variables_used=[var1, var2],
                valid_observations=n_obs
            ),
            summary=ExecutiveSummary(
                headline=f"r = {r_val:.3f}{stars}, p = {p_formatted} (N = {n_obs})",
                key_metrics=[
                    MetricItem(key="r", label="Coeficiente (r)", value=r_val, formatted=f"{r_val:.3f}", significance_star=stars),
                    MetricItem(key="p_val", label="p-valor", value=p_val, formatted=p_formatted, p_value=p_val),
                    MetricItem(key="n", label="Muestra (N)", value=n_obs, formatted=str(n_obs)),
                    MetricItem(key="r2", label="Varianza compartida (R²)", value=r_val**2, formatted=f"{(r_val**2)*100:.1f}%"),
                ],
                interpretation=interp_text
            ),
            tables=[table],
            diagnostics=diagnostics,
            warnings=warnings,
            plots=[],
            technical=TechnicalDetails(
                method=f"Correlación de {method}",
                degrees_of_freedom=raw_r_output.get("gl"),
                r_version="R Core Team",
                packages_used=self.required_packages
            ),
            reproducible_code=ReproducibleCode(
                language="R",
                script=script_r,
                packages=self.required_packages,
                instructions="Requiere R base."
            )
        )
