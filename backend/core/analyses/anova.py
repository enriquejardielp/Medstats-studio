"""
anova.py - Módulo de ANOVA de un Factor y Kruskal-Wallis (Stata + SPSS + R)
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
    ColumnFormat,
    AnalysisPlot
)


class AnovaAnalysis(BaseAnalysis):
    analysis_type = "anova"
    title = "ANOVA de un Factor / Kruskal-Wallis"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        dep_var = params.get("dep_var")
        group_var = params.get("group_var")

        if not dep_var or not group_var:
            raise ValueError("Debes especificar la variable dependiente numérica y la variable de agrupación.")

        if dep_var not in df.columns or group_var not in df.columns:
            raise ValueError(f"Variables no encontradas en el dataset: {[dep_var, group_var]}")

        subset = df[[dep_var, group_var]].dropna()
        n_obs = len(subset)

        groups = subset[group_var].unique()
        if len(groups) < 2:
            raise ValueError(
                f"La variable de agrupación '{group_var}' debe tener al menos 2 niveles (detectados: {len(groups)})."
            )

        warnings = []
        n_dropped = len(df) - n_obs
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se eliminaron {n_dropped} casos con valores faltantes.",
                    action_suggested=f"Análisis realizado sobre N = {n_obs} observaciones completas."
                )
            )

        counts = subset[group_var].value_counts()
        if counts.min() < 5:
            warnings.append(
                AnalysisWarning(
                    code="VERY_SMALL_SUBGROUP",
                    severity=WarningSeverity.WARNING,
                    message=f"El grupo '{counts.idxmin()}' contiene solo {counts.min()} observaciones.",
                    action_suggested="Los supuestos de normalidad y potencia estadística pueden verse comprometidos."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        dep_var = params.get("dep_var")
        group_var = params.get("group_var")
        method = params.get("method", "parametric")  # 'parametric' (ANOVA) o 'nonparametric' (Kruskal-Wallis)

        r_dep = col_map[dep_var]
        r_group = col_map[group_var]

        return f"""
        library(jsonlite)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        datos${r_group} <- as.factor(datos${r_group})
        niveles <- levels(datos${r_group})
        k <- length(niveles)

        # 1. Descriptivos por cada nivel del grupo
        group_stats <- list()
        for (i in 1:k) {{
            sub_vals <- datos${r_dep}[datos${r_group} == niveles[i]]
            group_stats[[i]] <- list(
                grupo = niveles[i],
                n = length(sub_vals),
                media = as.numeric(mean(sub_vals, na.rm = TRUE)),
                desv_est = as.numeric(sd(sub_vals, na.rm = TRUE)),
                mediana = as.numeric(median(sub_vals, na.rm = TRUE)),
                iqr = as.numeric(IQR(sub_vals, na.rm = TRUE)),
                shapiro_p = tryCatch(if (length(sub_vals) >= 3 && length(sub_vals) <= 5000) as.numeric(shapiro.test(sub_vals)$p.value) else NA, error = function(e) NA)
            )
        }}

        # 2. ANOVA Paramétrico y Post-hoc Tukey
        fit_aov <- aov({r_dep} ~ {r_group}, data = datos)
        s_aov <- summary(fit_aov)[[1]]

        ss_between <- s_aov["{r_group}", "Sum Sq"]
        ss_total <- sum(s_aov[, "Sum Sq"])
        eta_squared <- ss_between / ss_total

        f_stat <- as.numeric(s_aov["{r_group}", "F value"])
        p_val_aov <- as.numeric(s_aov["{r_group}", "Pr(>F)"])
        df_between <- as.integer(s_aov["{r_group}", "Df"])
        df_within <- as.integer(s_aov["Residuals", "Df"])

        # Test de Bartlett para Homogeneidad de Varianzas en R base
        bartlett_res <- tryCatch(bartlett.test({r_dep} ~ {r_group}, data = datos), error = function(e) NULL)
        bartlett_p <- if (!is.null(bartlett_res)) as.numeric(bartlett_res$p.value) else NA

        # Tukey HSD Post-hoc
        tukey_rows <- list()
        tryCatch({{
            tukey_res <- TukeyHSD(fit_aov)
            comp_mat <- tukey_res[[1]]
            comp_names <- rownames(comp_mat)
            for (j in 1:nrow(comp_mat)) {{
                tukey_rows[[j]] <- list(
                    comparacion = comp_names[j],
                    diferencia = as.numeric(comp_mat[j, "diff"]),
                    ci_lower = as.numeric(comp_mat[j, "lwr"]),
                    ci_upper = as.numeric(comp_mat[j, "upr"]),
                    p_adj = as.numeric(comp_mat[j, "p adj"])
                )
            }}
        }}, error = function(e) {{}})

        # 3. Kruskal-Wallis no paramétrico
        kw_res <- kruskal.test({r_dep} ~ {r_group}, data = datos)
        kw_stat <- as.numeric(kw_res$statistic)
        kw_p <- as.numeric(kw_res$p.value)
        kw_df <- as.integer(kw_res$parameter)

        # Gráfico Boxplot comparativo con paleta moderna
        img_base64 <- ""
        tryCatch({{
            tmp_img <- tempfile(fileext = ".png")
            png(tmp_img, width = 600, height = 380, res = 110)
            par(mar = c(5, 4, 3, 1))
            col_palette <- rainbow(k, s = 0.4, v = 0.95)
            boxplot({r_dep} ~ {r_group}, data = datos, col = col_palette,
                    main = "Distribución de '{dep_var}' por '{group_var}'",
                    xlab = "{group_var}", ylab = "{dep_var}", las = 1)
            stripchart({r_dep} ~ {r_group}, data = datos, vertical = TRUE, method = "jitter",
                       add = TRUE, pch = 19, col = "black", cex = 0.6)
            dev.off()
            img_base64 <- jsonlite::base64_enc(readBin(tmp_img, "raw", n = file.info(tmp_img)$size))
            unlink(tmp_img)
        }}, error = function(e) {{}})

        result <- list(
            group_stats = group_stats,
            method_used = '{method}',
            f_statistic = f_stat,
            p_value_aov = p_val_aov,
            df_between = df_between,
            df_within = df_within,
            eta_squared = as.numeric(eta_squared),
            bartlett_p = bartlett_p,
            tukey_posthoc = tukey_rows,
            kw_statistic = kw_stat,
            kw_p = kw_p,
            kw_df = kw_df,
            plot_base64 = img_base64
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
        dep_var = params.get("dep_var")
        group_var = params.get("group_var")
        method = params.get("method", "parametric")

        is_non_param = method == "nonparametric"
        p_val = raw_r_output.get("kw_p") if is_non_param else raw_r_output.get("p_value_aov", 1.0)
        stat_name = "Chi-cuadrado (Kruskal-Wallis)" if is_non_param else "F de Snedecor"
        stat_val = raw_r_output.get("kw_statistic") if is_non_param else raw_r_output.get("f_statistic", 0.0)
        eta_sq = raw_r_output.get("eta_squared", 0.0)

        is_significant = p_val < 0.05
        total_n = sum(g["n"] for g in raw_r_output.get("group_stats", []))

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title=f"Comparación Múltiple: '{dep_var}' según '{group_var}'",
            description=f"Evaluación de diferencias entre {len(raw_r_output.get('group_stats', []))} grupos independientes.",
            created_at=self._current_iso_time(),
            sample_size=len(valid_df),
            valid_observations=total_n,
            missing_observations=len(valid_df) - total_n,
            variables_used=[dep_var, group_var]
        )

        # 2. Resumen Ejecutivo
        headline = (
            f"Diferencias estadísticamente significativas entre grupos (p = {p_val:.4f})"
            if is_significant
            else f"No se observan diferencias significativas entre grupos (p = {p_val:.4f})"
        )
        interpretation = (
            f"El análisis de la varianza {'no paramétrico (Kruskal-Wallis)' if is_non_param else 'ANOVA de 1 factor'} "
            f"arrojó {stat_name} = {stat_val:.2f} con un valor p = {p_val:.4f}. "
            f"El tamaño del efecto (Eta cuadrado η²) indica que un {eta_sq*100:.1f}% de la varianza total de '{dep_var}' se debe a la pertenencia a los grupos de '{group_var}'."
        )

        key_metrics = [
            MetricItem(
                key="stat_value",
                label=stat_name,
                value=stat_val,
                formatted=f"{stat_val:.2f}",
                description="Estadístico de contraste principal"
            ),
            MetricItem(
                key="p_value",
                label="Valor p",
                value=p_val,
                formatted=f"{p_val:.4f}" if p_val >= 0.001 else "< .001",
                significance_star="***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns",
                description="Significación global del modelo"
            ),
            MetricItem(
                key="eta_squared",
                label="Eta Cuadrado (η²)",
                value=eta_sq,
                formatted=f"{eta_sq:.3f}",
                description="Proporción de varianza explicada"
            )
        ]
        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        # Tabla 1: Descriptivos
        desc_rows = []
        for g in raw_r_output.get("group_stats", []):
            desc_rows.append({
                "grupo": g["grupo"],
                "n": g["n"],
                "media": g["media"],
                "desv_est": g["desv_est"],
                "mediana": g["mediana"],
                "iqr": g["iqr"],
            })

        desc_cols = [
            TableColumnDef(key="grupo", label="Grupo", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="n", label="N", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="media", label="Media", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="desv_est", label="Desv. Est. (SD)", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="mediana", label="Mediana", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="iqr", label="IQR", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
        ]
        table_desc = StatisticalTable(
            id="anova_descriptives",
            title="Estadísticos Descriptivos por Subgrupo",
            columns=desc_cols,
            rows=desc_rows
        )

        tables = [table_desc]

        # Tabla 2: Post-hoc Tukey si hay contrastes disponibles
        tukey_rows = raw_r_output.get("tukey_posthoc", [])
        if tukey_rows:
            formatted_tukey = []
            for t in tukey_rows:
                p_adj = t["p_adj"]
                star = "***" if p_adj < 0.001 else "**" if p_adj < 0.01 else "*" if p_adj < 0.05 else ""
                formatted_tukey.append({
                    "comparacion": t["comparacion"],
                    "diferencia": t["diferencia"],
                    "ci_lower": t["ci_lower"],
                    "ci_upper": t["ci_upper"],
                    "p_adj": p_adj,
                    "significance": star
                })

            tukey_cols = [
                TableColumnDef(key="comparacion", label="Contraste de Pares", align="left", format_type=ColumnFormat.TEXT),
                TableColumnDef(key="diferencia", label="Diferencia de Medias", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
                TableColumnDef(key="ci_lower", label="IC 95% Inf", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
                TableColumnDef(key="ci_upper", label="IC 95% Sup", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
                TableColumnDef(key="p_adj", label="Valor p Ajustado", align="right", format_type=ColumnFormat.P_VALUE, decimals=4),
            ]
            table_tukey = StatisticalTable(
                id="anova_tukey_posthoc",
                title="Comparaciones Múltiples Post-Hoc (Tukey HSD)",
                subtitle="Ajuste de tasas de error familiar para contrastes por pares",
                columns=tukey_cols,
                rows=formatted_tukey,
                footnotes=[
                    TableFootnote(symbol="*", text="p < 0.05"),
                    TableFootnote(symbol="**", text="p < 0.01"),
                    TableFootnote(symbol="***", text="p < 0.001"),
                ]
            )
            tables.append(table_tukey)

        # 4. Diagnósticos
        diagnostics = []

        # Homocedasticidad (Bartlett)
        bart_p = raw_r_output.get("bartlett_p")
        if bart_p is not None and not np.isnan(bart_p):
            diagnostics.append(
                DiagnosticItem(
                    id="homocedasticity_bartlett",
                    name="Homogeneidad de Varianzas (Test de Bartlett)",
                    status=DiagnosticStatus.PASS if bart_p > 0.05 else DiagnosticStatus.WARNING,
                    statistic_name="Bartlett p",
                    statistic_value=bart_p,
                    threshold="p > 0.05",
                    finding=f"Varianzas homogéneas (p = {bart_p:.4f})" if bart_p > 0.05 else f"Heterocedasticidad detectada (p = {bart_p:.4f})",
                    recommendation="Considerar el test de Kruskal-Wallis o ANOVA de Welch si las varianzas difieren sustancialmente." if bart_p <= 0.05 else None
                )
            )

        # 5. Información Técnica
        technical = TechnicalDetails(
            method="ANOVA de un factor (Modelado Lineal F)" if not is_non_param else "Test de Kruskal-Wallis (Rangos)",
            formula=f"{dep_var} ~ {group_var}",
            degrees_of_freedom=[raw_r_output.get("df_between", 1), raw_r_output.get("df_within", total_n - 2)] if not is_non_param else raw_r_output.get("kw_df", 1),
            packages_used=["stats", "jsonlite"]
        )

        # 6. Gráficos
        plots = []
        plot_b64 = raw_r_output.get("plot_base64")
        if plot_b64:
            plots.append(
                AnalysisPlot(
                    id="boxplot_anova_groups",
                    title=f"Boxplot de '{dep_var}' entre Grupos de '{group_var}'",
                    plot_type="boxplot",
                    image_base64=plot_b64,
                    description="Comparación visual de rangos, medianas y valores atípicos.",
                    script_r="# Generado en R base"
                )
            )

        # 7. Código R Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["stats", "jsonlite"],
            instructions="Ejecutar en RStudio para replicar el ANOVA y comparaciones post-hoc."
        )

        return AnalysisResult(
            metadata=metadata,
            summary=summary,
            tables=tables,
            diagnostics=diagnostics,
            warnings=warnings,
            plots=plots,
            technical=technical,
            reproducible_code=reproducible
        )
