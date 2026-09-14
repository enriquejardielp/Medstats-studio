"""
table1.py - Módulo de Tabla 1 de Características Basales (Stata + SPSS + R)
MedStats Studio
"""

from typing import Dict, Any, List, Tuple
import pandas as pd
import numpy as np

from backend.core.base_analysis import BaseAnalysis
from backend.core.results_schema import (
    AnalysisResult,
    AnalysisMetadata,
    ExecutiveSummary,
    MetricItem,
    StatisticalTable,
    TableColumnDef,
    TableFootnote,
    DiagnosticItem,
    DiagnosticStatus,
    AnalysisWarning,
    WarningSeverity,
    TechnicalDetails,
    ReproducibleCode,
    ColumnFormat
)


class Table1Analysis(BaseAnalysis):
    analysis_type = "table1"
    title = "Tabla 1: Características Basales de la Población"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        variables = params.get("variables", [])
        group_var = params.get("group_var")

        if not variables or len(variables) == 0:
            raise ValueError("Debes seleccionar al menos una variable para generar la Tabla 1.")

        required_cols = list(variables)
        if group_var and group_var not in required_cols:
            required_cols.append(group_var)

        missing_cols = [c for c in required_cols if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Variables no encontradas en el dataset: {missing_cols}")

        subset = df[required_cols].copy()
        if len(subset) == 0:
            raise ValueError("El dataset no contiene filas de datos.")

        warnings = []
        # Comprobar si hay valores faltantes en las variables seleccionadas
        missing_counts = subset.isna().sum()
        for col, miss in missing_counts.items():
            if miss > 0:
                pct = (miss / len(subset)) * 100
                warnings.append(
                    AnalysisWarning(
                        code="MISSING_VALUES",
                        severity=WarningSeverity.INFO if pct < 15 else WarningSeverity.WARNING,
                        message=f"La variable '{col}' presenta {miss} valores faltantes ({pct:.1f}%).",
                        action_suggested="Los estadísticos y porcentajes se calcularon sobre los casos válidos para cada variable."
                    )
                )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        variables = params.get("variables", [])
        group_var = params.get("group_var")
        decimals = int(params.get("decimals", 2))

        r_vars = [col_map[v] for v in variables if v in col_map]
        r_group = col_map[group_var] if group_var and group_var in col_map else None

        vars_r_list = ", ".join([f"'{v}'" for v in r_vars])
        group_expr = f"'{r_group}'" if r_group else "NULL"

        return f"""
        library(jsonlite)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        vars_to_analyze <- c({vars_r_list})
        group_col <- {group_expr}
        decimals <- {decimals}

        has_group <- !is.null(group_col) && (group_col %in% colnames(datos)) && (length(unique(na.omit(datos[[group_col]]))) > 1)

        strata_levels <- if (has_group) levels(as.factor(datos[[group_col]])) else character(0)
        n_total <- nrow(datos)
        
        strata_counts <- list()
        if (has_group) {{
            for (lvl in strata_levels) {{
                strata_counts[[lvl]] <- sum(datos[[group_col]] == lvl, na.rm = TRUE)
            }}
        }}

        results_rows <- list()
        row_counter <- 1

        for (v in vars_to_analyze) {{
            if (has_group && v == group_col) next
            
            raw_v <- datos[[v]]
            v_clean <- na.omit(raw_v)
            if (length(v_clean) == 0) next
            
            # Detectar si es numérica o categórica
            is_num <- is.numeric(raw_v) && length(unique(v_clean)) > 5
            
            if (is_num) {{
                # Variable numérica: Media (SD) o Mediana [IQR]
                mean_tot <- mean(v_clean)
                sd_tot <- sd(v_clean)
                med_tot <- median(v_clean)
                q1_tot <- quantile(v_clean, 0.25)
                q3_tot <- quantile(v_clean, 0.75)
                
                # Test de normalidad Shapiro-Wilk (si N <= 5000)
                shapiro_p <- tryCatch({{
                    if (length(v_clean) >= 3 && length(v_clean) <= 5000) {{
                        as.numeric(shapiro.test(v_clean)$p.value)
                    }} else NA_real_
                }}, error = function(e) NA_real_)
                
                is_normal <- !is.na(shapiro_p) && (shapiro_p >= 0.05)
                
                total_val_str <- if (is_normal) {{
                    paste0(sprintf(paste0("%.", decimals, "f"), mean_tot), " ± ", sprintf(paste0("%.", decimals, "f"), sd_tot))
                }} else {{
                    paste0(sprintf(paste0("%.", decimals, "f"), med_tot), " [", sprintf(paste0("%.", decimals, "f"), q1_tot), " - ", sprintf(paste0("%.", decimals, "f"), q3_tot), "]")
                }}
                
                p_val <- NA_real_
                test_used <- "Descriptivo"
                strata_vals <- list()
                
                if (has_group) {{
                    # Comparación bivariada entre grupos
                    grp_factor <- as.factor(datos[[group_col]])
                    for (lvl in strata_levels) {{
                        sub_v <- na.omit(raw_v[datos[[group_col]] == lvl])
                        if (length(sub_v) > 0) {{
                            if (is_normal) {{
                                strata_vals[[lvl]] <- paste0(sprintf(paste0("%.", decimals, "f"), mean(sub_v)), " ± ", sprintf(paste0("%.", decimals, "f"), sd(sub_v)))
                            }} else {{
                                strata_vals[[lvl]] <- paste0(sprintf(paste0("%.", decimals, "f"), median(sub_v)), " [", sprintf(paste0("%.", decimals, "f"), quantile(sub_v, 0.25)), " - ", sprintf(paste0("%.", decimals, "f"), quantile(sub_v, 0.75)), "]")
                            }}
                        }} else {{
                            strata_vals[[lvl]] <- "-"
                        }}
                    }}
                    
                    if (length(strata_levels) == 2) {{
                        if (is_normal) {{
                            tt <- tryCatch(t.test(raw_v ~ grp_factor), error = function(e) NULL)
                            if (!is.null(tt)) {{ p_val <- tt$p.value; test_used <- "t de Student" }}
                        }} else {{
                            wt <- tryCatch(wilcox.test(raw_v ~ grp_factor), error = function(e) NULL)
                            if (!is.null(wt)) {{ p_val <- wt$p.value; test_used <- "Mann-Whitney U" }}
                        }}
                    }} else if (length(strata_levels) > 2) {{
                        if (is_normal) {{
                            av <- tryCatch(summary(aov(raw_v ~ grp_factor))[[1]][["Pr(>F)"]][1], error = function(e) NULL)
                            if (!is.null(av)) {{ p_val <- av; test_used <- "ANOVA" }}
                        }} else {{
                            kw <- tryCatch(kruskal.test(raw_v ~ grp_factor)$p.value, error = function(e) NULL)
                            if (!is.null(kw)) {{ p_val <- kw; test_used <- "Kruskal-Wallis" }}
                        }}
                    }}
                }}
                
                results_rows[[row_counter]] <- list(
                    variable = v,
                    is_header = FALSE,
                    stat_type = if (is_normal) "media_sd" else "mediana_iqr",
                    display_type = if (is_normal) "Media (DE)" else "Mediana [RIC]",
                    total = total_val_str,
                    strata = strata_vals,
                    p_value = if (!is.na(p_val)) as.numeric(p_val) else NULL,
                    test_name = test_used,
                    normality_p = if (!is.na(shapiro_p)) as.numeric(shapiro_p) else NULL,
                    missing_count = as.integer(sum(is.na(raw_v)))
                )
                row_counter <- row_counter + 1
                
            }} else {{
                # Variable Categórica: n (%) para cada nivel
                v_fac <- as.factor(raw_v)
                lvl_names <- levels(v_fac)
                
                # Fila de cabecera de la variable
                results_rows[[row_counter]] <- list(
                    variable = v,
                    is_header = TRUE,
                    stat_type = "categorica_header",
                    display_type = "n (%)",
                    total = "",
                    strata = list(),
                    p_value = NULL,
                    test_name = "",
                    normality_p = NULL,
                    missing_count = as.integer(sum(is.na(raw_v)))
                )
                row_counter <- row_counter + 1
                
                # Test de Chi-Cuadrado / Fisher bivariado para la variable global
                p_cat <- NA_real_
                test_cat <- "Chi-cuadrado"
                if (has_group) {{
                    tbl <- tryCatch(table(raw_v, datos[[group_col]]), error = function(e) NULL)
                    if (!is.null(tbl)) {{
                        chisq_res <- tryCatch(chisq.test(tbl), error = function(e) NULL)
                        if (!is.null(chisq_res)) {{
                            p_cat <- chisq_res$p.value
                        }}
                    }}
                }}
                
                for (lvl in lvl_names) {{
                    n_lvl_tot <- sum(v_fac == lvl, na.rm = TRUE)
                    pct_lvl_tot <- (n_lvl_tot / length(v_clean)) * 100
                    tot_str <- paste0(n_lvl_tot, " (", sprintf("%.1f", pct_lvl_tot), "%)")
                    
                    strata_vals <- list()
                    if (has_group) {{
                        for (grp_lvl in strata_levels) {{
                            sub_v <- na.omit(v_fac[datos[[group_col]] == grp_lvl])
                            if (length(sub_v) > 0) {{
                                n_sub <- sum(sub_v == lvl)
                                pct_sub <- (n_sub / length(sub_v)) * 100
                                strata_vals[[grp_lvl]] <- paste0(n_sub, " (", sprintf("%.1f", pct_sub), "%)")
                            }} else {{
                                strata_vals[[grp_lvl]] <- "0 (0.0%)"
                            }}
                        }}
                    }}
                    
                    results_rows[[row_counter]] <- list(
                        variable = paste0("  ", lvl),
                        is_header = FALSE,
                        stat_type = "categorica_level",
                        display_type = "",
                        total = tot_str,
                        strata = strata_vals,
                        p_value = if (!is.na(p_cat)) as.numeric(p_cat) else NULL,
                        test_name = if (!is.na(p_cat)) test_cat else "",
                        normality_p = NULL,
                        missing_count = 0
                    )
                    row_counter <- row_counter + 1
                    # Solo mostrar p-valor en el primer nivel o cabecera
                    p_cat <- NA_real_
                }}
            }}
        }}

        result <- list(
            total_n = as.integer(n_total),
            has_group = as.logical(has_group),
            group_name = if (has_group) group_col else NULL,
            strata_levels = strata_levels,
            strata_counts = strata_counts,
            rows = results_rows
        )

        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
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
        variables = params.get("variables", [])
        group_var = params.get("group_var")

        total_n = raw_r_output.get("total_n", len(valid_df))
        has_group = raw_r_output.get("has_group", False)
        strata_levels = raw_r_output.get("strata_levels", [])
        strata_counts = raw_r_output.get("strata_counts", {})
        raw_rows = raw_r_output.get("rows", [])

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title="Tabla 1: Características Demográficas y Clínicas Basales",
            description=f"Resumen basal sobre N = {total_n} pacientes" + (f" estratificado por '{group_var}'." if has_group else "."),
            created_at=self._current_iso_time(),
            sample_size=total_n,
            valid_observations=total_n,
            missing_observations=0,
            variables_used=variables + ([group_var] if group_var else [])
        )

        # 2. Resumen Ejecutivo
        if has_group and len(strata_levels) > 0:
            strata_desc = ", ".join([f"{lvl} (n = {strata_counts.get(lvl, 0)})" for lvl in strata_levels])
            headline = f"Tabla 1 Estratificada por '{group_var}' ({strata_desc})"
            interpretation = (
                f"Se resumen {len(variables)} variables basales comparadas entre los estratos de '{group_var}'. "
                f"Las variables continuas con distribución normal se expresan como Media ± DE (t-test / ANOVA); "
                f"las variables no paramétricas como Mediana [RIC] (Mann-Whitney / Kruskal-Wallis); "
                f"y las categóricas como n (%) (Chi-cuadrado de Pearson)."
            )
        else:
            headline = f"Tabla 1 Descriptiva Global (N = {total_n} sujetos)"
            interpretation = f"Resumen univariado de características basales para {len(variables)} variables en la cohorte total de N = {total_n} individuos."

        key_metrics = [
            MetricItem(
                key="sample_size",
                label="Muestra Total (N)",
                value=total_n,
                formatted=f"{total_n}",
                description="Pacientes incluidos en la cohorte basal"
            ),
            MetricItem(
                key="n_vars",
                label="Variables Incluidas",
                value=len(variables),
                formatted=f"{len(variables)}",
                description="Características basales analizadas"
            )
        ]

        if has_group:
            key_metrics.append(
                MetricItem(
                    key="stratification",
                    label="Factor de Estratificación",
                    value=len(strata_levels),
                    formatted=f"{group_var} ({len(strata_levels)} grupos)",
                    description="Variable de comparación entre cohortes"
                )
            )

        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        table_cols = [
            TableColumnDef(key="variable", label="Característica Basal", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="display_type", label="Métrica", align="center", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="total", label=f"Total (N = {total_n})", align="right", format_type=ColumnFormat.TEXT),
        ]

        if has_group:
            for lvl in strata_levels:
                cnt = strata_counts.get(lvl, 0)
                table_cols.append(
                    TableColumnDef(key=f"strata_{lvl}", label=f"{lvl} (n = {cnt})", align="right", format_type=ColumnFormat.TEXT)
                )
            table_cols.append(TableColumnDef(key="p_value_fmt", label="p-valor", align="right", format_type=ColumnFormat.TEXT))
            table_cols.append(TableColumnDef(key="test_name", label="Prueba Estadística", align="left", format_type=ColumnFormat.TEXT))

        table_rows = []
        for r in raw_rows:
            raw_v_name = r.get("variable", "")
            # Traducir nombre de columna sanitizada
            clean_v_name = inv_map.get(raw_v_name.strip(), raw_v_name)
            if raw_v_name.startswith("  "):
                clean_v_name = "    " + raw_v_name.strip()

            p_val = r.get("p_value")
            p_fmt = ""
            if isinstance(p_val, (int, float)):
                p_fmt = "< 0.001" if p_val < 0.001 else f"{p_val:.3f}"

            row_dict = {
                "variable": clean_v_name,
                "display_type": r.get("display_type", ""),
                "total": r.get("total", ""),
                "p_value_fmt": p_fmt,
                "test_name": r.get("test_name", "") if isinstance(r.get("test_name"), str) else ""
            }

            if has_group:
                strata_map = r.get("strata", {}) if isinstance(r.get("strata"), dict) else {}
                for lvl in strata_levels:
                    row_dict[f"strata_{lvl}"] = strata_map.get(lvl, "-")

            table_rows.append(row_dict)

        stat_table = StatisticalTable(
            id="table1_baseline_table",
            title="Tabla 1: Características Demográficas y Clínicas Basales",
            subtitle=f"Valores expresados como Media ± DE, Mediana [RIC] o n (%)" + (f" por estrato de '{group_var}'" if has_group else ""),
            columns=table_cols,
            rows=table_rows,
            footnotes=[
                TableFootnote(symbol="*", text="Variables numéricas normales: Media ± DE (t-test o ANOVA)."),
                TableFootnote(symbol="†", text="Variables numéricas no paramétricas: Mediana [RIC] (Mann-Whitney U o Kruskal-Wallis)."),
                TableFootnote(symbol="‡", text="Variables categóricas: n (%) (Chi-cuadrado de Pearson).")
            ]
        )

        # 4. Diagnósticos
        diagnostics = []
        for r in raw_rows:
            if not r.get("is_header") and isinstance(r.get("normality_p"), (int, float)):
                norm_p = float(r["normality_p"])
                v_name = inv_map.get(r.get("variable", "").strip(), r.get("variable", "").strip())
                diagnostics.append(
                    DiagnosticItem(
                        id=f"normality_{v_name}",
                        name=f"Normalidad de '{v_name}' (Shapiro-Wilk)",
                        status=DiagnosticStatus.PASS if norm_p >= 0.05 else DiagnosticStatus.INFO,
                        p_value=norm_p,
                        threshold="p >= 0.05 (distribución normal)",
                        finding=f"p = {norm_p:.4f} -> {'Distribución Gaussiana (Media ± DE)' if norm_p >= 0.05 else 'Distribución Asimétrica (Mediana [RIC])'}.",
                        recommendation="Métrica seleccionada automáticamente según la prueba de Shapiro-Wilk."
                    )
                )

        # 5. Información Técnica
        technical = TechnicalDetails(
            method="Tabla 1 Epidemiológica con selección automatizada de estadísticos paramétricos/no-paramétricos",
            formula=f"Bivariado contra '{group_var}'" if has_group else "Univariado descriptivo global",
            packages_used=["stats", "jsonlite"]
        )

        # 6. Código R Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["stats", "jsonlite"],
            instructions="Copiar y ejecutar en RStudio para generar y exportar la Tabla 1 reproducible."
        )

        return AnalysisResult(
            metadata=metadata,
            summary=summary,
            tables=[stat_table],
            diagnostics=diagnostics,
            warnings=warnings,
            plots=[],
            technical=technical,
            reproducible_code=reproducible
        )
