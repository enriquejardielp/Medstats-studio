"""
chi_square.py - Módulo de Tablas de Contingencia y Chi-cuadrado / Fisher (Stata + SPSS + R)
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


class ChiSquareAnalysis(BaseAnalysis):
    analysis_type = "chi-square"
    title = "Tablas de Contingencia y Chi-cuadrado"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        var1 = params.get("var1")
        var2 = params.get("var2")

        if not var1 or not var2:
            raise ValueError("Debes especificar dos variables categóricas.")

        if var1 not in df.columns or var2 not in df.columns:
            raise ValueError(f"Variables no encontradas en el dataset: {[var1, var2]}")

        subset = df[[var1, var2]].dropna()
        n_obs = len(subset)

        if n_obs < 10:
            raise ValueError(f"Observaciones insuficientes ({n_obs}) para un test de independencia.")

        warnings = []
        n_dropped = len(df) - n_obs
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se eliminaron {n_dropped} casos con valores perdidos.",
                    action_suggested=f"Tabla calculada sobre N = {n_obs} casos completos."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        var1 = params.get("var1")
        var2 = params.get("var2")

        r_v1 = col_map[var1]
        r_v2 = col_map[var2]

        return f"""
        library(jsonlite)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        f1 <- as.factor(datos${r_v1})
        f2 <- as.factor(datos${r_v2})

        tab <- table(f1, f2)
        n_total <- sum(tab)
        r_dim <- nrow(tab)
        c_dim <- ncol(tab)

        # Chi-cuadrado de Pearson
        chi_res <- chisq.test(tab, correct = FALSE)
        chi_stat <- as.numeric(chi_res$statistic)
        p_val_chi <- as.numeric(chi_res$p.value)
        df_chi <- as.integer(chi_res$parameter)

        # Frecuencias esperadas
        exp_mat <- chi_res$expected
        min_expected <- min(exp_mat)
        prop_small_expected <- sum(exp_mat < 5) / length(exp_mat)

        # Test Exacto de Fisher (si es 2x2 o computacionalmente factible)
        fisher_p <- tryCatch({{
            if (r_dim == 2 && c_dim == 2) {{
                as.numeric(fisher.test(tab)$p.value)
            }} else if (n_total < 1000) {{
                as.numeric(fisher.test(tab, simulate.p.value = TRUE)$p.value)
            }} else {{
                NA
            }}
        }}, error = function(e) NA)

        # V de Cramér: sqrt(chi2 / (n * min(r-1, c-1)))
        cramer_v <- sqrt(chi_stat / (n_total * max(1, min(r_dim - 1, c_dim - 1))))

        # Formatear celdas de la tabla de contingencia
        cell_rows <- list()
        row_levels <- rownames(tab)
        col_levels <- colnames(tab)
        idx <- 1
        for (i in 1:r_dim) {{
            for (j in 1:c_dim) {{
                cell_rows[[idx]] <- list(
                    fila = row_levels[i],
                    columna = col_levels[j],
                    observado = as.integer(tab[i, j]),
                    esperado = as.numeric(round(exp_mat[i, j], 2)),
                    porc_fila = as.numeric(round(tab[i, j] / sum(tab[i, ]) * 100, 1)),
                    porc_columna = as.numeric(round(tab[i, j] / sum(tab[, j]) * 100, 1)),
                    porc_total = as.numeric(round(tab[i, j] / n_total * 100, 1))
                )
                idx <- idx + 1
            }}
        }}

        # Gráfico Mosaico / Barras Apiladas
        img_base64 <- ""
        tryCatch({{
            tmp_img <- tempfile(fileext = ".png")
            png(tmp_img, width = 580, height = 360, res = 110)
            par(mar = c(5, 4, 3, 5))
            barplot(t(tab), beside = TRUE, col = rainbow(c_dim, s=0.5, v=0.9),
                    main = "Distribución de Frecuencias Cruzadas",
                    xlab = "{var1}", ylab = "Frecuencia", las = 1)
            legend("topright", inset=c(-0.25, 0), legend = col_levels, fill = rainbow(c_dim, s=0.5, v=0.9), xpd = TRUE, bty = "n")
            dev.off()
            img_base64 <- jsonlite::base64_enc(readBin(tmp_img, "raw", n = file.info(tmp_img)$size))
            unlink(tmp_img)
        }}, error = function(e) {{}})

        result <- list(
            c_dim = c_dim,
            r_dim = r_dim,
            n_total = as.integer(n_total),
            chi_statistic = chi_stat,
            p_value = p_val_chi,
            df = df_chi,
            cramer_v = as.numeric(cramer_v),
            min_expected = as.numeric(min_expected),
            prop_small_expected = as.numeric(prop_small_expected),
            fisher_p = fisher_p,
            cells = cell_rows,
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
        var1 = params.get("var1")
        var2 = params.get("var2")

        n_total = raw_r_output.get("n_total", len(valid_df))
        chi_stat = raw_r_output.get("chi_statistic", 0.0)
        p_val = raw_r_output.get("p_value", 1.0)
        cramer_v = raw_r_output.get("cramer_v", 0.0)
        df_val = raw_r_output.get("df", 1)

        is_significant = p_val < 0.05

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title=f"Tabla de Contingencia: '{var1}' × '{var2}'",
            description=f"Prueba de independencia y asociación categórica sobre N = {n_total}.",
            created_at=self._current_iso_time(),
            sample_size=len(valid_df),
            valid_observations=n_total,
            missing_observations=len(valid_df) - n_total,
            variables_used=[var1, var2]
        )

        # 2. Resumen Ejecutivo
        headline = (
            f"Asociación estadísticamente significativa entre '{var1}' y '{var2}' (p = {p_val:.4f})"
            if is_significant
            else f"Independencia estadística entre '{var1}' y '{var2}' (p = {p_val:.4f})"
        )
        interpretation = (
            f"La prueba de Chi-cuadrado de Pearson arrojó χ²({df_val}) = {chi_stat:.2f} (p = {p_val:.4f}). "
            f"La fuerza de la asociación estimada es de V de Cramér = {cramer_v:.3f} "
            f"({ 'fuerte' if cramer_v >= 0.3 else 'moderada' if cramer_v >= 0.15 else 'débil' })."
        )

        key_metrics = [
            MetricItem(
                key="chi_statistic",
                label="Chi-cuadrado (χ²)",
                value=chi_stat,
                formatted=f"{chi_stat:.2f}",
                description=f"Grados de libertad = {df_val}"
            ),
            MetricItem(
                key="p_value",
                label="Valor p",
                value=p_val,
                formatted=f"{p_val:.4f}" if p_val >= 0.001 else "< .001",
                significance_star="***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns",
                description="Significación del test de independencia"
            ),
            MetricItem(
                key="cramer_v",
                label="V de Cramér",
                value=cramer_v,
                formatted=f"{cramer_v:.3f}",
                description="Magnitud del tamaño del efecto (0 a 1)"
            )
        ]
        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        table_rows = []
        for cell in raw_r_output.get("cells", []):
            table_rows.append({
                "fila": cell["fila"],
                "columna": cell["columna"],
                "observado": cell["observado"],
                "esperado": cell["esperado"],
                "porc_fila": cell["porc_fila"],
                "porc_total": cell["porc_total"],
            })

        table_cols = [
            TableColumnDef(key="fila", label=f"{var1}", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="columna", label=f"{var2}", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="observado", label="Frec. Observada", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="esperado", label="Frec. Esperada", align="right", format_type=ColumnFormat.DECIMAL, decimals=1),
            TableColumnDef(key="porc_fila", label="% Fila", align="right", format_type=ColumnFormat.PERCENTAGE, decimals=1),
            TableColumnDef(key="porc_total", label="% Total", align="right", format_type=ColumnFormat.PERCENTAGE, decimals=1),
        ]

        stat_table = StatisticalTable(
            id="contingency_table",
            title=f"Tabla Cruzada de Contingencia ({var1} × {var2})",
            columns=table_cols,
            rows=table_rows
        )

        # 4. Diagnósticos
        diagnostics = []
        min_exp = raw_r_output.get("min_expected", 10.0)
        prop_small = raw_r_output.get("prop_small_expected", 0.0)
        fisher_p = raw_r_output.get("fisher_p")

        diag_status = DiagnosticStatus.PASS if prop_small <= 0.2 and min_exp >= 1.0 else DiagnosticStatus.WARNING
        diagnostics.append(
            DiagnosticItem(
                id="cochran_criterion",
                name="Criterio de Cochran (Frecuencias Esperadas)",
                status=diag_status,
                statistic_name="Mínima Frecuencia Esperada",
                statistic_value=min_exp,
                threshold="Menos del 20% de celdas con esperado < 5",
                finding=f"Mínimo esperado = {min_exp:.2f}. Celdas < 5: {prop_small*100:.1f}%.",
                recommendation="Emplear el Test Exacto de Fisher si más del 20% de celdas tienen esperado < 5." if diag_status != DiagnosticStatus.PASS else None
            )
        )

        if fisher_p is not None and not np.isnan(fisher_p):
            diagnostics.append(
                DiagnosticItem(
                    id="fisher_exact_test",
                    name="Test Exacto de Fisher",
                    status=DiagnosticStatus.INFO,
                    p_value=fisher_p,
                    threshold="p bilateral",
                    finding=f"Valor p exacto de Fisher = {fisher_p:.4f}."
                )
            )

        # 5. Información Técnica
        technical = TechnicalDetails(
            method="Prueba de Independencia Chi-cuadrado de Pearson",
            formula=f"{var1} × {var2}",
            degrees_of_freedom=df_val,
            packages_used=["stats", "jsonlite"]
        )

        # 6. Gráficos
        plots = []
        plot_b64 = raw_r_output.get("plot_base64")
        if plot_b64:
            plots.append(
                AnalysisPlot(
                    id="barplot_contingency",
                    title="Distribución de Frecuencias Cruzadas",
                    plot_type="barplot",
                    image_base64=plot_b64,
                    description="Comparación gráfica de frecuencias absolutas entre combinaciones de categorías.",
                    script_r="# Generado mediante R base"
                )
            )

        # 7. Código R Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["stats", "jsonlite"],
            instructions="Ejecutar en RStudio para reproducir las tablas cruzadas y pruebas de significación."
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
