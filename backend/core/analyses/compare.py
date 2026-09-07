"""
compare.py - Módulo de Comparación de 2 Grupos (T-Test / Mann-Whitney U)
MedStats Studio (Stata + SPSS + R)
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


class CompareTwoGroupsAnalysis(BaseAnalysis):
    analysis_type = "compare"
    title = "Comparación de Dos Grupos"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        num_var = params.get("num_var")
        cat_var = params.get("cat_var")

        if not num_var or not cat_var:
            raise ValueError("Debes especificar la variable numérica y la variable de agrupación.")

        if num_var not in df.columns or cat_var not in df.columns:
            raise ValueError(f"Variables no encontradas en el dataset: {[num_var, cat_var]}")

        subset = df[[num_var, cat_var]].dropna()
        n_obs = len(subset)

        groups = subset[cat_var].unique()
        if len(groups) != 2:
            raise ValueError(
                f"La variable de agrupación '{cat_var}' debe tener exactamente 2 niveles (detectados: {len(groups)})."
            )

        warnings = []
        n_dropped = len(df) - n_obs
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se descartaron {n_dropped} casos con valores ausentes.",
                    action_suggested=f"Análisis realizado sobre N = {n_obs} observaciones completas."
                )
            )

        g1_count = len(subset[subset[cat_var] == groups[0]])
        g2_count = len(subset[subset[cat_var] == groups[1]])
        if min(g1_count, g2_count) < 10:
            warnings.append(
                AnalysisWarning(
                    code="SMALL_GROUP_SIZE",
                    severity=WarningSeverity.WARNING,
                    message=f"Uno de los grupos tiene un tamaño muy reducido (n = {min(g1_count, g2_count)}).",
                    action_suggested="Verificar supuestos de normalidad o emplear el test no paramétrico de Mann-Whitney."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        num_var = params.get("num_var")
        cat_var = params.get("cat_var")
        method = params.get("method", "welch")  # 'welch', 'student', 'mannwhitney'
        paired = bool(params.get("paired", False))
        conf_level = float(params.get("conf_level", 0.95))

        r_num = col_map[num_var]
        r_cat = col_map[cat_var]

        return f"""
        library(jsonlite)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        datos${r_cat} <- as.factor(datos${r_cat})
        niveles <- levels(datos${r_cat})
        g1 <- datos${r_num}[datos${r_cat} == niveles[1]]
        g2 <- datos${r_num}[datos${r_cat} == niveles[2]]

        # Descriptivos por grupo
        m1 <- mean(g1, na.rm = TRUE)
        s1 <- sd(g1, na.rm = TRUE)
        n1 <- length(g1)
        med1 <- median(g1, na.rm = TRUE)
        iqr1 <- IQR(g1, na.rm = TRUE)

        m2 <- mean(g2, na.rm = TRUE)
        s2 <- sd(g2, na.rm = TRUE)
        n2 <- length(g2)
        med2 <- median(g2, na.rm = TRUE)
        iqr2 <- IQR(g2, na.rm = TRUE)

        # 1. Pruebas de normalidad (Shapiro-Wilk)
        sw1_p <- tryCatch(if (n1 >= 3 && n1 <= 5000) as.numeric(shapiro.test(g1)$p.value) else NA, error = function(e) NA)
        sw2_p <- tryCatch(if (n2 >= 3 && n2 <= 5000) as.numeric(shapiro.test(g2)$p.value) else NA, error = function(e) NA)

        # 2. Test de Homogeneidad de Varianzas (F-test o Bartlett)
        var_test_p <- tryCatch(as.numeric(var.test(g1, g2)$p.value), error = function(e) NA)

        # 3. Ejecutar Test Principal
        is_paired <- {'TRUE' if paired else 'FALSE'}
        selected_method <- '{method}'

        stat_val <- 0
        p_val <- 1
        df_val <- NA
        diff_mean <- m1 - m2
        ci_lower <- NA
        ci_upper <- NA
        cohen_d <- NA

        if (selected_method == 'mannwhitney') {{
            mw_res <- wilcox.test(g1, g2, paired = is_paired, conf.int = TRUE, conf.level = {conf_level})
            stat_val <- as.numeric(mw_res$statistic)
            p_val <- as.numeric(mw_res$p.value)
            ci_lower <- tryCatch(as.numeric(mw_res$conf.int[1]), error = function(e) NA)
            ci_upper <- tryCatch(as.numeric(mw_res$conf.int[2]), error = function(e) NA)
            # r de Wilcoxon = Z / sqrt(N)
            z_score <- qnorm(p_val / 2, lower.tail = FALSE)
            cohen_d <- as.numeric(z_score / sqrt(n1 + n2))
        }} else {{
            var_equal <- if (selected_method == 'student') TRUE else FALSE
            t_res <- t.test(g1, g2, paired = is_paired, var.equal = var_equal, conf.level = {conf_level})
            stat_val <- as.numeric(t_res$statistic)
            p_val <- as.numeric(t_res$p.value)
            df_val <- as.numeric(t_res$parameter)
            ci_lower <- as.numeric(t_res$conf.int[1])
            ci_upper <- as.numeric(t_res$conf.int[2])
            # d de Cohen
            s_pooled <- sqrt(((n1 - 1)*s1^2 + (n2 - 1)*s2^2) / (n1 + n2 - 2))
            cohen_d <- as.numeric((m1 - m2) / s_pooled)
        }}

        # Gráfico Boxplot con jitter de observaciones
        img_base64 <- ""
        tryCatch({{
            tmp_img <- tempfile(fileext = ".png")
            png(tmp_img, width = 550, height = 360, res = 110)
            par(mar = c(4, 4, 3, 1))
            boxplot({r_num} ~ {r_cat}, data = datos, col = c("#dbeafe", "#fce7f3"),
                    border = c("#1d4ed8", "#be185d"), names = c(paste0(niveles[1], " (n=", n1, ")"), paste0(niveles[2], " (n=", n2, ")")),
                    main = "Distribución por Grupos", ylab = "{num_var}", xlab = "{cat_var}", outline = FALSE)
            stripchart({r_num} ~ {r_cat}, data = datos, vertical = TRUE, method = "jitter",
                       add = TRUE, pch = 21, bg = "white", col = "gray40", cex = 0.9)
            dev.off()
            img_base64 <- jsonlite::base64_enc(readBin(tmp_img, "raw", n = file.info(tmp_img)$size))
            unlink(tmp_img)
        }}, error = function(e) {{}})

        result <- list(
            group1_name = as.character(niveles[1]),
            group1_n = as.integer(n1),
            group1_mean = as.numeric(m1),
            group1_sd = as.numeric(s1),
            group1_median = as.numeric(med1),
            group1_iqr = as.numeric(iqr1),
            group2_name = as.character(niveles[2]),
            group2_n = as.integer(n2),
            group2_mean = as.numeric(m2),
            group2_sd = as.numeric(s2),
            group2_median = as.numeric(med2),
            group2_iqr = as.numeric(iqr2),
            shapiro_p1 = as.numeric(sw1_p),
            shapiro_p2 = as.numeric(sw2_p),
            var_test_p = as.numeric(var_test_p),
            test_used = selected_method,
            is_paired = is_paired,
            statistic = as.numeric(stat_val),
            p_value = as.numeric(p_val),
            df = as.numeric(df_val),
            diff_mean = as.numeric(diff_mean),
            ci_lower = as.numeric(ci_lower),
            ci_upper = as.numeric(ci_upper),
            effect_size = as.numeric(cohen_d),
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
        num_var = params.get("num_var")
        cat_var = params.get("cat_var")

        g1_name = raw_r_output.get("group1_name", "Grupo 1")
        g2_name = raw_r_output.get("group2_name", "Grupo 2")
        g1_n = raw_r_output.get("group1_n", 0)
        g2_n = raw_r_output.get("group2_n", 0)
        p_val = raw_r_output.get("p_value", 1.0)
        diff_m = raw_r_output.get("diff_mean", 0.0)
        ci_l = raw_r_output.get("ci_lower", 0.0)
        ci_u = raw_r_output.get("ci_upper", 0.0)
        effect_d = raw_r_output.get("effect_size", 0.0)
        test_used = raw_r_output.get("test_used", "welch")

        is_significant = p_val < 0.05
        test_label = "T de Welch (varianzas heterogéneas)" if test_used == "welch" else "T de Student" if test_used == "student" else "Mann-Whitney U"

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title=f"Comparación de '{num_var}' según '{cat_var}'",
            description=f"Evaluación de diferencias entre {g1_name} (n={g1_n}) y {g2_name} (n={g2_n}).",
            created_at=self._current_iso_time(),
            sample_size=len(valid_df),
            valid_observations=g1_n + g2_n,
            missing_observations=len(valid_df) - (g1_n + g2_n),
            variables_used=[num_var, cat_var]
        )

        # 2. Resumen Ejecutivo
        headline = (
            f"Diferencia estadísticamente significativa (p = {p_val:.4f})"
            if is_significant
            else f"No se observan diferencias estadísticamente significativas (p = {p_val:.4f})"
        )
        interpretation = (
            f"Al contrastar los grupos '{g1_name}' y '{g2_name}' mediante el test de {test_label}, "
            f"la diferencia estimada fue de {diff_m:.2f} unidades (IC 95%: [{ci_l:.2f}, {ci_u:.2f}]). "
            f"El tamaño del efecto observado fue d = {effect_d:.2f}."
        )

        key_metrics = [
            MetricItem(
                key="diff_mean",
                label="Diferencia de Medias",
                value=diff_m,
                formatted=f"{diff_m:.2f}",
                description=f"{g1_name} vs {g2_name}"
            ),
            MetricItem(
                key="p_value",
                label="Valor p",
                value=p_val,
                formatted=f"{p_val:.4f}" if p_val >= 0.001 else "< .001",
                significance_star="***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns",
                description="Significación estadística bilateral"
            ),
            MetricItem(
                key="effect_size",
                label="Tamaño del Efecto (d)",
                value=effect_d,
                formatted=f"{effect_d:.2f}",
                description="d de Cohen / efecto estandarizado"
            )
        ]
        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        table_rows = [
            {
                "grupo": g1_name,
                "n": g1_n,
                "media": raw_r_output.get("group1_mean"),
                "desv_est": raw_r_output.get("group1_sd"),
                "mediana": raw_r_output.get("group1_median"),
                "iqr": raw_r_output.get("group1_iqr"),
            },
            {
                "grupo": g2_name,
                "n": g2_n,
                "media": raw_r_output.get("group2_mean"),
                "desv_est": raw_r_output.get("group2_sd"),
                "mediana": raw_r_output.get("group2_median"),
                "iqr": raw_r_output.get("group2_iqr"),
            }
        ]

        table_columns = [
            TableColumnDef(key="grupo", label="Grupo / Nivel", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="n", label="N Válido", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="media", label="Media", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="desv_est", label="Desv. Est. (SD)", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="mediana", label="Mediana", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="iqr", label="Rango Intercuartílico (IQR)", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
        ]

        stat_table = StatisticalTable(
            id="group_comparisons_table",
            title="Estadísticos Descriptivos por Grupo",
            subtitle=f"Variable de estudio: '{num_var}' agrupada por '{cat_var}'",
            columns=table_columns,
            rows=table_rows,
            footnotes=[
                TableFootnote(symbol="*", text="p < 0.05"),
                TableFootnote(symbol="**", text="p < 0.01"),
                TableFootnote(symbol="***", text="p < 0.001"),
            ]
        )

        # 4. Diagnósticos y Supuestos
        diagnostics = []

        # Normalidad G1
        sw1 = raw_r_output.get("shapiro_p1")
        if sw1 is not None and not np.isnan(sw1):
            diagnostics.append(
                DiagnosticItem(
                    id="shapiro_g1",
                    name=f"Normalidad ({g1_name})",
                    status=DiagnosticStatus.PASS if sw1 > 0.05 else DiagnosticStatus.WARNING,
                    statistic_name="Shapiro-Wilk p",
                    statistic_value=sw1,
                    threshold="p > 0.05",
                    finding=f"Distribución normal en {g1_name} (p = {sw1:.4f})" if sw1 > 0.05 else f"Desviación de normalidad en {g1_name} (p = {sw1:.4f})",
                    recommendation="Si ambos grupos no son normales, considerar Mann-Whitney." if sw1 <= 0.05 else None
                )
            )

        # Normalidad G2
        sw2 = raw_r_output.get("shapiro_p2")
        if sw2 is not None and not np.isnan(sw2):
            diagnostics.append(
                DiagnosticItem(
                    id="shapiro_g2",
                    name=f"Normalidad ({g2_name})",
                    status=DiagnosticStatus.PASS if sw2 > 0.05 else DiagnosticStatus.WARNING,
                    statistic_name="Shapiro-Wilk p",
                    statistic_value=sw2,
                    threshold="p > 0.05",
                    finding=f"Distribución normal en {g2_name} (p = {sw2:.4f})" if sw2 > 0.05 else f"Desviación de normalidad en {g2_name} (p = {sw2:.4f})",
                    recommendation="Si ambos grupos no son normales, considerar Mann-Whitney." if sw2 <= 0.05 else None
                )
            )

        # Homogeneidad de Varianzas (F-Test)
        var_p = raw_r_output.get("var_test_p")
        if var_p is not None and not np.isnan(var_p):
            diagnostics.append(
                DiagnosticItem(
                    id="homocedasticity",
                    name="Homogeneidad de Varianzas",
                    status=DiagnosticStatus.PASS if var_p > 0.05 else DiagnosticStatus.WARNING,
                    statistic_name="F-test p",
                    statistic_value=var_p,
                    threshold="p > 0.05",
                    finding=f"Varianzas homogéneas (p = {var_p:.4f})" if var_p > 0.05 else f"Varianzas heterogéneas (p = {var_p:.4f})",
                    recommendation="Se recomienda la corrección de Welch si las varianzas son heterogéneas." if var_p <= 0.05 else None
                )
            )

        # 5. Información Técnica
        technical = TechnicalDetails(
            method=test_label,
            formula=f"{num_var} ~ {cat_var}",
            degrees_of_freedom=raw_r_output.get("df"),
            packages_used=["stats", "jsonlite"]
        )

        # 6. Gráficos
        plots = []
        plot_b64 = raw_r_output.get("plot_base64")
        if plot_b64:
            plots.append(
                AnalysisPlot(
                    id="boxplot_two_groups",
                    title=f"Boxplot de '{num_var}' por Grupo con Dispersión de Puntos",
                    plot_type="boxplot",
                    image_base64=plot_b64,
                    description="Distribución visual, medianas, rango intercuartílico e individualidades por grupo.",
                    script_r="# Generado mediante R base"
                )
            )

        # 7. Código R Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["stats", "jsonlite"],
            instructions="Copiar y pegar en R o RStudio para reproducir este contraste de hipótesis."
        )

        return AnalysisResult(
            metadata=metadata,
            summary=summary,
            tables=[stat_table],
            diagnostics=diagnostics,
            warnings=warnings,
            plots=plots,
            technical=technical,
            reproducible_code=reproducible
        )
