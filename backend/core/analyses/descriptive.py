"""
descriptive.py - Módulo de Estadísticos Descriptivos
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
    ColumnFormat,
    AnalysisWarning,
    WarningSeverity,
    TechnicalDetails,
    ReproducibleCode,
)


class DescriptiveAnalysis(BaseAnalysis):
    analysis_type = "descriptive"
    title = "Estadísticos Descriptivos"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        columns = params.get("columns", [])
        if not columns:
            raise ValueError("Debes seleccionar al menos una variable para los estadísticos descriptivos.")

        missing_cols = [c for c in columns if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Variables no encontradas en el dataset: {missing_cols}")

        warnings = []
        subset = df[columns].copy()

        for col in columns:
            total = len(subset)
            missing = int(subset[col].isna().sum())
            if missing > 0:
                pct = (missing / total) * 100
                severity = WarningSeverity.WARNING if pct > 20 else WarningSeverity.INFO
                warnings.append(
                    AnalysisWarning(
                        code="MISSING_DATA",
                        severity=severity,
                        message=f"La variable '{col}' contiene {missing} valores faltantes ({pct:.1f}%).",
                        variable=col,
                        action_suggested="Los estadísticos se calcularán sobre los casos válidos (pairwise complete)."
                    )
                )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        columns = params.get("columns", [])
        r_cols = [col_map[c] for c in columns]
        cols_r_vector = ", ".join([f"'{c}'" for c in r_cols])

        return f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        num_results <- list()
        cat_results <- list()

        for (col in c({cols_r_vector})) {{
            val <- datos[[col]]
            clean_val <- val[!is.na(val)]
            n_valid <- length(clean_val)
            n_miss <- sum(is.na(val))

            if (is.numeric(clean_val) && n_valid > 0) {{
                q <- quantile(clean_val, probs = c(0.25, 0.5, 0.75), na.rm = TRUE)
                m <- mean(clean_val)
                s <- if (n_valid > 1) sd(clean_val) else 0
                se <- if (n_valid > 1) s / sqrt(n_valid) else 0

                num_results[[col]] <- list(
                    variable = col,
                    n_valid = n_valid,
                    n_missing = n_miss,
                    mean = as.numeric(m),
                    se_mean = as.numeric(se),
                    median = as.numeric(q[2]),
                    sd = as.numeric(s),
                    min = as.numeric(min(clean_val)),
                    max = as.numeric(max(clean_val)),
                    q1 = as.numeric(q[1]),
                    q3 = as.numeric(q[3]),
                    iqr = as.numeric(q[3] - q[1])
                )
            }} else if (n_valid > 0) {{
                tab <- table(val, useNA = "no")
                freq_df <- data.frame(
                    categoria = names(tab),
                    frecuencia = as.numeric(tab),
                    porcentaje = as.numeric(prop.table(tab) * 100),
                    stringsAsFactors = FALSE
                )
                cat_results[[col]] <- list(
                    variable = col,
                    n_valid = n_valid,
                    n_missing = n_miss,
                    categorias = freq_df
                )
            }}
        }}

        res <- list(
            numeric = num_results,
            categorical = cat_results
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
        columns = params.get("columns", [])
        total_rows = len(valid_df)

        tables: List[StatisticalTable] = []
        metrics: List[MetricItem] = []

        num_data = raw_r_output.get("numeric", {})
        cat_data = raw_r_output.get("categorical", {})

        # Tabla Numérica
        if num_data:
            num_rows = []
            for r_col, stats in num_data.items():
                orig_col = inv_map.get(r_col, r_col)
                num_rows.append({
                    "variable": orig_col,
                    "n_valid": stats.get("n_valid"),
                    "n_missing": stats.get("n_missing"),
                    "mean": stats.get("mean"),
                    "se_mean": stats.get("se_mean"),
                    "sd": stats.get("sd"),
                    "median": stats.get("median"),
                    "q1": stats.get("q1"),
                    "q3": stats.get("q3"),
                    "min": stats.get("min"),
                    "max": stats.get("max"),
                })
                metrics.append(
                    MetricItem(
                        key=f"mean_{orig_col}",
                        label=f"Media ({orig_col})",
                        value=stats.get("mean"),
                        formatted=f"{stats.get('mean'):.2f} (± {stats.get('sd'):.2f})"
                    )
                )

            tables.append(
                StatisticalTable(
                    id="table_numeric_descriptives",
                    title="Estadísticos Descriptivos (Variables Continuas)",
                    subtitle="Medidas de tendencia central, dispersión y posición",
                    columns=[
                        TableColumnDef(key="variable", label="Variable", align="left", format_type=ColumnFormat.TEXT),
                        TableColumnDef(key="n_valid", label="N Válido", format_type=ColumnFormat.NUMBER, decimals=0),
                        TableColumnDef(key="n_missing", label="Faltantes", format_type=ColumnFormat.NUMBER, decimals=0),
                        TableColumnDef(key="mean", label="Media", format_type=ColumnFormat.DECIMAL, decimals=2),
                        TableColumnDef(key="sd", label="DE", format_type=ColumnFormat.DECIMAL, decimals=2),
                        TableColumnDef(key="median", label="Mediana", format_type=ColumnFormat.DECIMAL, decimals=2),
                        TableColumnDef(key="q1", label="Q1 (P25)", format_type=ColumnFormat.DECIMAL, decimals=2),
                        TableColumnDef(key="q3", label="Q3 (P75)", format_type=ColumnFormat.DECIMAL, decimals=2),
                        TableColumnDef(key="min", label="Mínimo", format_type=ColumnFormat.DECIMAL, decimals=2),
                        TableColumnDef(key="max", label="Máximo", format_type=ColumnFormat.DECIMAL, decimals=2),
                    ],
                    rows=num_rows
                )
            )

        # Tablas Categóricas
        if cat_data:
            for r_col, cat_info in cat_data.items():
                orig_col = inv_map.get(r_col, r_col)
                cat_rows = cat_info.get("categorias", [])
                tables.append(
                    StatisticalTable(
                        id=f"table_cat_{orig_col}",
                        title=f"Distribución de Frecuencias: {orig_col}",
                        subtitle=f"N válido = {cat_info.get('n_valid')}, Faltantes = {cat_info.get('n_missing')}",
                        columns=[
                            TableColumnDef(key="categoria", label="Categoría", align="left", format_type=ColumnFormat.TEXT),
                            TableColumnDef(key="frecuencia", label="Frecuencia (n)", format_type=ColumnFormat.NUMBER, decimals=0),
                            TableColumnDef(key="porcentaje", label="Porcentaje (%)", format_type=ColumnFormat.PERCENTAGE, decimals=1),
                        ],
                        rows=cat_rows
                    )
                )

        summary_text = f"Análisis descriptivo completado para {len(columns)} variable(s) sobre una muestra de N = {total_rows} observaciones."

        return AnalysisResult(
            metadata=AnalysisMetadata(
                analysis_id=analysis_id,
                analysis_type=self.analysis_type,
                title=self.title,
                description=f"Resumen exploratorio y distribuciones univariadas de {', '.join(columns)}",
                sample_size=total_rows,
                variables_used=columns,
                valid_observations=total_rows
            ),
            summary=ExecutiveSummary(
                headline=f"N = {total_rows} observaciones ({len(columns)} variables analizadas)",
                key_metrics=metrics[:6],
                interpretation=summary_text
            ),
            tables=tables,
            diagnostics=[],
            warnings=warnings,
            plots=[],
            technical=TechnicalDetails(
                method="Estadística univariada no paramétrica y paramétrica",
                r_version="R Core Team",
                packages_used=self.required_packages
            ),
            reproducible_code=ReproducibleCode(
                language="R",
                script=script_r,
                packages=self.required_packages,
                instructions="Ejecutar en R con los datos cargados en un data.frame."
            )
        )
