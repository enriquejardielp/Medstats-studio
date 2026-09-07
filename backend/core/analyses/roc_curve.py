"""
roc_curve.py - Módulo de Curvas ROC y Precisión Diagnóstica (Stata + SPSS + R)
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


class RocCurveAnalysis(BaseAnalysis):
    analysis_type = "roc-curve"
    title = "Curva ROC y Precisión Diagnóstica"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        outcome = params.get("outcome")
        predictor = params.get("predictor")

        if not outcome or not predictor:
            raise ValueError("Debes especificar la variable de desenlace (outcome) y la variable predictora / biomarcador.")

        if outcome not in df.columns or predictor not in df.columns:
            raise ValueError(f"Variables no encontradas en el dataset: {[outcome, predictor]}")

        subset = df[[outcome, predictor]].dropna()
        n_obs = len(subset)

        target = subset[outcome].dropna()
        unique_vals = target.unique()
        if len(unique_vals) != 2:
            raise ValueError(
                f"La variable de desenlace '{outcome}' debe ser binaria (2 estados: enfermo/sano o caso/control). Detectados: {len(unique_vals)}."
            )

        warnings = []
        n_dropped = len(df) - n_obs
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se eliminaron {n_dropped} observaciones con datos incompletos.",
                    action_suggested=f"Curva estimada sobre N = {n_obs} observaciones completas."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        outcome = params.get("outcome")
        predictor = params.get("predictor")
        conf_level = float(params.get("conf_level", 0.95))

        r_out = col_map[outcome]
        r_pred = col_map[predictor]

        return f"""
        library(jsonlite)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        # Asegurar estado binario 0 y 1
        datos${r_out} <- as.factor(datos${r_out})
        niveles <- levels(datos${r_out})
        y <- as.numeric(datos${r_out} == niveles[2])
        x <- as.numeric(datos${r_pred})

        n_cases <- sum(y == 1)
        n_controls <- sum(y == 0)

        # Cálculo manual de ROC sin paquetes externos pesados
        cortes <- sort(unique(x))
        if (length(cortes) > 100) {{
            cortes <- quantile(x, probs = seq(0, 1, length.out = 100))
        }}

        sens_vec <- numeric(length(cortes))
        spec_vec <- numeric(length(cortes))
        youden_vec <- numeric(length(cortes))

        for (i in 1:length(cortes)) {{
            th <- cortes[i]
            pred_pos <- x >= th
            tp <- sum(pred_pos & y == 1)
            fn <- sum(!pred_pos & y == 1)
            tn <- sum(!pred_pos & y == 0)
            fp <- sum(pred_pos & y == 0)

            sens <- if ((tp + fn) > 0) tp / (tp + fn) else 0
            spec <- if ((tn + fp) > 0) tn / (tn + fp) else 0

            sens_vec[i] <- sens
            spec_vec[i] <- spec
            youden_vec[i] <- sens + spec - 1
        }}

        # Ordenar por 1 - especificidad
        fpr <- 1 - spec_vec
        tpr <- sens_vec
        ord <- order(fpr, tpr)
        fpr_s <- c(0, fpr[ord], 1)
        tpr_s <- c(0, tpr[ord], 1)

        # AUC por regla trapezoidal
        auc_val <- sum((fpr_s[-1] - fpr_s[-length(fpr_s)]) * (tpr_s[-1] + tpr_s[-length(tpr_s)]) / 2)
        auc_val <- min(1, max(0.5, auc_val))

        # Error estándar de Hanley-McNeil para AUC
        q1 <- auc_val / (2 - auc_val)
        q2 <- 2 * auc_val^2 / (1 + auc_val)
        se_auc <- sqrt((auc_val * (1 - auc_val) + (n_cases - 1)*(q1 - auc_val^2) + (n_controls - 1)*(q2 - auc_val^2)) / (n_cases * n_controls))
        z_crit <- qnorm(1 - (1 - {conf_level}) / 2)
        auc_ci_lower <- max(0.5, auc_val - z_crit * se_auc)
        auc_ci_upper <- min(1.0, auc_val + z_crit * se_auc)

        # Mejor punto de corte (Índice de Youden)
        best_idx <- which.max(youden_vec)
        opt_cutoff <- as.numeric(cortes[best_idx])
        opt_sens <- as.numeric(sens_vec[best_idx])
        opt_spec <- as.numeric(spec_vec[best_idx])
        opt_youden <- as.numeric(youden_vec[best_idx])

        # Gráfico Curva ROC de alta resolución
        img_base64 <- ""
        tryCatch({{
            tmp_img <- tempfile(fileext = ".png")
            png(tmp_img, width = 550, height = 450, res = 110)
            par(mar = c(4.5, 4.5, 3, 2))
            plot(fpr_s, tpr_s, type = "l", lwd = 3, col = "#2563eb",
                 xlab = "1 - Especificidad (Tasa de Falsos Positivos)",
                 ylab = "Sensibilidad (Tasa de Verdaderos Positivos)",
                 main = paste0("Curva ROC (AUC = ", sprintf("%.3f", auc_val), ")"),
                 xlim = c(0, 1), ylim = c(0, 1))
            abline(0, 1, lty = 2, col = "#94a3b8", lwd = 1.5)
            grid(col = "#e2e8f0")
            points(1 - opt_spec, opt_sens, pch = 19, col = "#dc2626", cex = 1.5)
            text(1 - opt_spec + 0.05, opt_sens - 0.05,
                 labels = paste0("Punto óptimo: ", sprintf("%.2f", opt_cutoff), "\\n(S=", sprintf("%.2f", opt_sens), ", E=", sprintf("%.2f", opt_spec), ")"),
                 adj = 0, cex = 0.85, col = "#991b1b")
            dev.off()
            img_base64 <- jsonlite::base64_enc(readBin(tmp_img, "raw", n = file.info(tmp_img)$size))
            unlink(tmp_img)
        }}, error = function(e) {{}})

        # Tabla de puntos de corte representativos
        rows_table <- list()
        step <- max(1, floor(length(cortes) / 10))
        indices <- seq(1, length(cortes), by = step)
        if (!(best_idx %in% indices)) indices <- sort(c(indices, best_idx))

        for (k in 1:length(indices)) {{
            idx <- indices[k]
            rows_table[[k]] <- list(
                punto_corte = as.numeric(cortes[idx]),
                sensibilidad = as.numeric(sens_vec[idx]),
                especificidad = as.numeric(spec_vec[idx]),
                indice_youden = as.numeric(youden_vec[idx]),
                es_optimo = (idx == best_idx)
            )
        }}

        result <- list(
            auc = as.numeric(auc_val),
            auc_ci_lower = as.numeric(auc_ci_lower),
            auc_ci_upper = as.numeric(auc_ci_upper),
            se_auc = as.numeric(se_auc),
            n_cases = as.integer(n_cases),
            n_controls = as.integer(n_controls),
            opt_cutoff = as.numeric(opt_cutoff),
            opt_sens = as.numeric(opt_sens),
            opt_spec = as.numeric(opt_spec),
            opt_youden = as.numeric(opt_youden),
            table_cutoffs = rows_table,
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
        outcome = params.get("outcome")
        predictor = params.get("predictor")

        auc = raw_r_output.get("auc", 0.5)
        auc_l = raw_r_output.get("auc_ci_lower", 0.5)
        auc_u = raw_r_output.get("auc_ci_upper", 1.0)
        n_cases = raw_r_output.get("n_cases", 0)
        n_controls = raw_r_output.get("n_controls", 0)
        opt_cut = raw_r_output.get("opt_cutoff", 0.0)
        opt_sens = raw_r_output.get("opt_sens", 0.0)
        opt_spec = raw_r_output.get("opt_spec", 0.0)

        # Calidad diagnóstica
        calidad = "Excelente" if auc >= 0.9 else "Buena" if auc >= 0.8 else "Aceptable" if auc >= 0.7 else "Pobre / No informativa"

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title=f"Curva ROC: '{predictor}' para predecir '{outcome}'",
            description=f"Evaluación de capacidad diagnóstica sobre {n_cases} casos y {n_controls} controles.",
            created_at=self._current_iso_time(),
            sample_size=len(valid_df),
            valid_observations=n_cases + n_controls,
            missing_observations=len(valid_df) - (n_cases + n_controls),
            variables_used=[outcome, predictor]
        )

        # 2. Resumen Ejecutivo
        headline = f"Capacidad Discriminativa {calidad} (AUC = {auc:.3f} | IC 95%: [{auc_l:.3f}, {auc_u:.3f}])"
        interpretation = (
            f"El biomarcador / predictor '{predictor}' presenta un Área Bajo la Curva (AUC) de {auc:.3f}. "
            f"El umbral óptimo según el índice de Youden se sitúa en {opt_cut:.2f}, "
            f"alcanzando una Sensibilidad del {opt_sens*100:.1f}% y una Especificidad del {opt_spec*100:.1f}%."
        )

        key_metrics = [
            MetricItem(
                key="auc",
                label="Área Bajo la Curva (AUC)",
                value=auc,
                formatted=f"{auc:.3f}",
                description="Capacidad discriminativa global (0.5 a 1.0)"
            ),
            MetricItem(
                key="opt_sens",
                label="Sensibilidad Óptima",
                value=opt_sens,
                formatted=f"{opt_sens*100:.1f}%",
                description=f"En punto de corte = {opt_cut:.2f}"
            ),
            MetricItem(
                key="opt_spec",
                label="Especificidad Óptima",
                value=opt_spec,
                formatted=f"{opt_spec*100:.1f}%",
                description=f"En punto de corte = {opt_cut:.2f}"
            )
        ]
        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        table_rows = []
        for row in raw_r_output.get("table_cutoffs", []):
            table_rows.append({
                "punto_corte": row["punto_corte"],
                "sensibilidad": row["sensibilidad"] * 100,
                "especificidad": row["especificidad"] * 100,
                "youden": row["indice_youden"],
                "optimo": "★ Óptimo" if row.get("es_optimo") else ""
            })

        table_cols = [
            TableColumnDef(key="punto_corte", label="Punto de Corte", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="sensibilidad", label="Sensibilidad (%)", align="right", format_type=ColumnFormat.PERCENTAGE, decimals=1),
            TableColumnDef(key="especificidad", label="Especificidad (%)", align="right", format_type=ColumnFormat.PERCENTAGE, decimals=1),
            TableColumnDef(key="youden", label="Índice de Youden (J)", align="right", format_type=ColumnFormat.DECIMAL, decimals=3),
            TableColumnDef(key="optimo", label="Criterio", align="center", format_type=ColumnFormat.TEXT),
        ]

        stat_table = StatisticalTable(
            id="roc_cutoffs_table",
            title="Coordenadas de la Curva ROC y Puntos de Corte",
            subtitle=f"Matriz de sensibilidad vs especificidad para '{predictor}'",
            columns=table_cols,
            rows=table_rows
        )

        # 4. Diagnósticos
        diagnostics = [
            DiagnosticItem(
                id="auc_discrimination",
                name="Potencia de Discriminación",
                status=DiagnosticStatus.PASS if auc >= 0.7 else DiagnosticStatus.WARNING,
                statistic_name="AUC",
                statistic_value=auc,
                threshold="AUC >= 0.70",
                finding=f"Capacidad {calidad} (AUC = {auc:.3f}).",
                recommendation="El predictor no discrimina adecuadamente frente al azar si AUC ≈ 0.50." if auc < 0.7 else None
            )
        ]

        # 5. Información Técnica
        technical = TechnicalDetails(
            method="Análisis de Curva ROC no paramétrico con intervalos de confianza de Hanley-McNeil",
            formula=f"{outcome} ~ {predictor}",
            packages_used=["stats", "jsonlite"]
        )

        # 6. Gráficos
        plots = []
        plot_b64 = raw_r_output.get("plot_base64")
        if plot_b64:
            plots.append(
                AnalysisPlot(
                    id="roc_curve_plot",
                    title=f"Curva ROC para '{predictor}'",
                    plot_type="roc_curve",
                    image_base64=plot_b64,
                    description="Sensibilidad frente a 1 - Especificidad con indicación del umbral óptimo de Youden.",
                    script_r="# Generado en R base"
                )
            )

        # 7. Código R Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["stats", "jsonlite"],
            instructions="Copiar y ejecutar en RStudio para graficar la curva ROC y obtener puntos de corte."
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
