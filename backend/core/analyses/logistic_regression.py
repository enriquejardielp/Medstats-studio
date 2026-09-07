"""
logistic_regression.py - Módulo de Regresión Logística Binaria (Stata + SPSS + R)
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


class LogisticRegressionAnalysis(BaseAnalysis):
    analysis_type = "logistic-regression"
    title = "Regresión Logística Binaria"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        dep_var = params.get("dep_var")
        indep_vars = params.get("indep_vars", [])

        if not dep_var:
            raise ValueError("Debes especificar la variable dependiente / desenlace.")
        if not indep_vars:
            raise ValueError("Debes seleccionar al menos una variable independiente.")

        all_cols = [dep_var] + indep_vars
        missing_cols = [c for c in all_cols if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Variables no encontradas en el dataset: {missing_cols}")

        subset = df[all_cols].dropna()
        n_obs = len(subset)

        target = subset[dep_var].dropna()
        unique_vals = target.unique()
        if len(unique_vals) != 2:
            raise ValueError(
                f"La variable dependiente '{dep_var}' debe tener exactamente 2 categorías para regresión logística binaria (detectadas: {len(unique_vals)})."
            )

        warnings = []
        n_dropped = len(df) - n_obs
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se eliminaron {n_dropped} casos con datos incompletos.",
                    action_suggested=f"Modelo estimado sobre N = {n_obs} observaciones completas."
                )
            )

        # Verificar eventos por variable (EPV)
        event_counts = target.value_counts().min()
        epv = event_counts / len(indep_vars)
        if epv < 10:
            warnings.append(
                AnalysisWarning(
                    code="LOW_EPV",
                    severity=WarningSeverity.WARNING,
                    message=f"Bajo número de eventos por predictor (EPV = {epv:.1f} < 10).",
                    action_suggested="Existe riesgo de sobreajuste (overfitting). Considerar reducir el número de predictores."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        dep_var = params.get("dep_var")
        indep_vars = params.get("indep_vars", [])
        conf_level = float(params.get("conf_level", 0.95))

        r_dep = col_map[dep_var]
        r_indep = [col_map[v] for v in indep_vars]
        formula_rhs = " + ".join(r_indep)
        indep_r_vector = ", ".join([f"'{v}'" for v in r_indep])

        return f"""
        library(jsonlite)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        # Convertir variable dependiente a factor binario (0 y 1)
        datos${r_dep} <- as.factor(datos${r_dep})
        formula_model <- as.formula('{r_dep} ~ {formula_rhs}')

        fit <- glm(formula_model, data = datos, family = binomial(link = "logit"))
        s <- summary(fit)
        coefs <- coef(s)
        ci <- tryCatch(confint(fit, level = {conf_level}), error = function(e) confint.default(fit, level = {conf_level}))

        # Odds Ratios
        ors <- exp(coefs[, 1])
        ci_or <- exp(ci)

        # Métricas de Ajuste y Pseudo-R2
        ll_null  <- fit$null.deviance / -2
        ll_model <- fit$deviance / -2
        n_obs    <- length(fit$residuals)
        cox_r2   <- 1 - exp(2 * (ll_null - ll_model) / n_obs)
        nagelkerke_r2 <- cox_r2 / (1 - exp(2 * ll_null / n_obs))
        mcfadden_r2   <- 1 - (fit$deviance / fit$null.deviance)

        # Test de Bondad de Ajuste de Hosmer-Lemeshow (aprox deciles)
        hl_p <- tryCatch({{
            probs  <- fitted(fit)
            y_num  <- as.numeric(datos${r_dep}) - 1
            grupos <- cut(probs, breaks = quantile(probs, probs = seq(0, 1, by = 0.1)), include.lowest = TRUE)
            obs_e  <- tapply(y_num, grupos, sum)
            exp_e  <- tapply(probs, grupos, sum)
            n_g    <- tapply(y_num, grupos, length)
            exp_0  <- n_g - exp_e
            obs_0  <- n_g - obs_e
            chi_hl <- sum((obs_e - exp_e)^2 / pmax(exp_e, 0.001) + (obs_0 - exp_0)^2 / pmax(exp_0, 0.001), na.rm=TRUE)
            as.numeric(pchisq(chi_hl, df = 8, lower.tail = FALSE))
        }}, error = function(e) NA)

        # Multicolinealidad (VIF en base R)
        vif_list <- list()
        indep_cols <- c({indep_r_vector})
        if (length(indep_cols) > 1) {{
            tryCatch({{
                X <- as.matrix(datos[, indep_cols, drop = FALSE])
                sds <- apply(X, 2, sd, na.rm = TRUE)
                if (all(!is.na(sds) & sds > 0)) {{
                    R_mat <- cor(X, use = "complete.obs")
                    inv_R <- solve(R_mat)
                    vif_vec <- diag(inv_R)
                    names(vif_vec) <- indep_cols
                    vif_list <- as.list(vif_vec)
                }}
            }}, error = function(e) {{}})
        }}

        # Gráfico Forest Plot de Odds Ratios
        img_base64 <- ""
        tryCatch({{
            tmp_img <- tempfile(fileext = ".png")
            png(tmp_img, width = 600, height = 360, res = 110)
            par(mar = c(4, 8, 3, 2))
            terms <- rownames(coefs)[-1]
            if (length(terms) > 0) {{
                or_sub <- ors[-1]
                ci_l <- ci_or[-1, 1]
                ci_u <- ci_or[-1, 2]
                y_pos <- length(terms):1

                plot(or_sub, y_pos, xlim = c(max(0.01, min(ci_l, na.rm=TRUE)*0.8), min(20, max(ci_u, na.rm=TRUE)*1.2)),
                     ylim = c(0.5, length(terms) + 0.5), yaxt = "n", xlab = "Odds Ratio (IC 95%)",
                     ylab = "", pch = 18, col = "#2563eb", cex = 1.8, log = "x", main = "Forest Plot de Predictores (OR)")
                axis(2, at = y_pos, labels = terms, las = 2, cex.axis = 0.85)
                abline(v = 1, col = "darkred", lty = 2, lwd = 1.5)
                segments(ci_l, y_pos, ci_u, y_pos, col = "#2563eb", lwd = 2)
            }}
            dev.off()
            img_base64 <- jsonlite::base64_enc(readBin(tmp_img, "raw", n = file.info(tmp_img)$size))
            unlink(tmp_img)
        }}, error = function(e) {{}})

        # Tabla de Coeficientes y ORs
        coef_rows <- list()
        row_names <- rownames(coefs)
        for (i in 1:nrow(coefs)) {{
            coef_rows[[i]] <- list(
                term = row_names[i],
                estimate = as.numeric(coefs[i, 1]),
                std_error = as.numeric(coefs[i, 2]),
                z_statistic = as.numeric(coefs[i, 3]),
                p_value = as.numeric(coefs[i, 4]),
                odds_ratio = as.numeric(ors[i]),
                ci_lower_or = as.numeric(ci_or[i, 1]),
                ci_upper_or = as.numeric(ci_or[i, 2])
            )
        }}

        result <- list(
            coeficientes = coef_rows,
            n_obs = as.integer(n_obs),
            aic = as.numeric(fit$aic),
            null_deviance = as.numeric(fit$null.deviance),
            residual_deviance = as.numeric(fit$deviance),
            df_null = as.integer(fit$df.null),
            df_residual = as.integer(fit$df.residual),
            nagelkerke_r2 = as.numeric(nagelkerke_r2),
            mcfadden_r2 = as.numeric(mcfadden_r2),
            converged = fit$converged,
            hosmer_lemeshow_p = as.numeric(hl_p),
            vif = vif_list,
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
        indep_vars = params.get("indep_vars", [])

        n_obs = raw_r_output.get("n_obs", len(valid_df))
        aic = raw_r_output.get("aic", 0.0)
        nagelkerke_r2 = raw_r_output.get("nagelkerke_r2", 0.0)
        mcfadden_r2 = raw_r_output.get("mcfadden_r2", 0.0)

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title=f"Regresión Logística Binaria: {dep_var}",
            description=f"Modelado de probabilidad del evento '{dep_var}' en función de {len(indep_vars)} predictor(es).",
            created_at=self._current_iso_time(),
            sample_size=len(valid_df),
            valid_observations=n_obs,
            missing_observations=len(valid_df) - n_obs,
            variables_used=[dep_var] + indep_vars
        )

        # 2. Resumen Ejecutivo
        sig_count = sum(1 for row in raw_r_output.get("coeficientes", []) if row["term"] != "(Intercept)" and row["p_value"] < 0.05)
        headline = f"Regresión Logística con Pseudo-R² (Nagelkerke) = {nagelkerke_r2:.3f} | {sig_count} predictor(es) estadísticamente significativo(s)"
        interpretation = (
            f"El modelo logístico explica un {nagelkerke_r2*100:.1f}% de la varianza del desenlace (Pseudo-R² de Nagelkerke). "
            f"Las razones de probabilidades (Odds Ratios) expresan el cambio relativo en la probabilidad de experimentar el evento por cada unidad de cambio en los predictores, manteniendo las demás variables constantes."
        )

        key_metrics = [
            MetricItem(
                key="nagelkerke_r2",
                label="Pseudo-R² (Nagelkerke)",
                value=nagelkerke_r2,
                formatted=f"{nagelkerke_r2:.3f}",
                description="Capacidad discriminativa del modelo logístico"
            ),
            MetricItem(
                key="mcfadden_r2",
                label="Pseudo-R² (McFadden)",
                value=mcfadden_r2,
                formatted=f"{mcfadden_r2:.3f}",
                description="Ajuste relativo frente al modelo nulo"
            ),
            MetricItem(
                key="aic",
                label="Criterio AIC",
                value=aic,
                formatted=f"{aic:.1f}",
                description="Criterio de información de Akaike"
            )
        ]
        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        table_rows = []
        for r in raw_r_output.get("coeficientes", []):
            orig_term = inv_map.get(r["term"], r["term"])
            p_val = r["p_value"]
            star = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""
            table_rows.append({
                "variable": orig_term,
                "coeficiente": r["estimate"],
                "error_std": r["std_error"],
                "z_stat": r["z_statistic"],
                "odds_ratio": r["odds_ratio"],
                "ci_lower": r["ci_lower_or"],
                "ci_upper": r["ci_upper_or"],
                "p_value": p_val,
                "significance": star
            })

        table_columns = [
            TableColumnDef(key="variable", label="Predictor", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="coeficiente", label="Coeficiente (B)", align="right", format_type=ColumnFormat.DECIMAL, decimals=3),
            TableColumnDef(key="error_std", label="Error Estándar (SE)", align="right", format_type=ColumnFormat.DECIMAL, decimals=3),
            TableColumnDef(key="odds_ratio", label="Odds Ratio (OR)", align="right", format_type=ColumnFormat.DECIMAL, decimals=3),
            TableColumnDef(key="ci_lower", label="IC 95% Inf", align="right", format_type=ColumnFormat.DECIMAL, decimals=3),
            TableColumnDef(key="ci_upper", label="IC 95% Sup", align="right", format_type=ColumnFormat.DECIMAL, decimals=3),
            TableColumnDef(key="p_value", label="Valor p", align="right", format_type=ColumnFormat.P_VALUE, decimals=4),
        ]

        stat_table = StatisticalTable(
            id="logistic_coefficients",
            title="Tabla de Parámetros y Razones de Probabilidad (Odds Ratios)",
            subtitle="Estimación por Máxima Verosimilitud con intervalos de confianza del 95%",
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

        # Hosmer-Lemeshow
        hl_p = raw_r_output.get("hosmer_lemeshow_p")
        if hl_p is not None and not np.isnan(hl_p):
            hl_pass = hl_p > 0.05
            diagnostics.append(
                DiagnosticItem(
                    id="hosmer_lemeshow",
                    name="Test de Hosmer-Lemeshow",
                    status=DiagnosticStatus.PASS if hl_pass else DiagnosticStatus.WARNING,
                    p_value=hl_p,
                    threshold="p > 0.05",
                    finding="Adecuada calibración del modelo" if hl_pass else "Diferencias significativas entre probabilidades observadas y esperadas",
                    recommendation=None if hl_pass else "Considerar interacciones o términos no lineales."
                )
            )

        # VIF
        vif_dict = raw_r_output.get("vif", {})
        if vif_dict:
            max_vif = max([v for v in vif_dict.values() if v is not None] or [1.0])
            vif_status = DiagnosticStatus.PASS if max_vif < 5.0 else DiagnosticStatus.WARNING if max_vif < 10.0 else DiagnosticStatus.FAIL
            diagnostics.append(
                DiagnosticItem(
                    id="vif_collinearity",
                    name="Multicolinealidad (VIF)",
                    status=vif_status,
                    statistic_name="Max VIF",
                    statistic_value=max_vif,
                    threshold="VIF < 5.0",
                    finding=f"VIF máximo = {max_vif:.2f}." if max_vif < 5.0 else f"Alerta de multicolinealidad con VIF = {max_vif:.2f}",
                    recommendation="Evaluar colinealidad entre covariables si VIF > 5." if max_vif >= 5.0 else None
                )
            )

        # 5. Información Técnica
        technical = TechnicalDetails(
            method="Regresión Logística Binaria (GLM - Binomial Logit)",
            formula=f"{dep_var} ~ " + " + ".join(indep_vars),
            degrees_of_freedom=raw_r_output.get("df_residual", n_obs - len(indep_vars) - 1),
            aic=aic,
            log_likelihood=raw_r_output.get("residual_deviance", 0.0) / -2,
            convergence=raw_r_output.get("converged", True),
            packages_used=["stats", "jsonlite"]
        )

        # 6. Gráficos
        plots = []
        plot_b64 = raw_r_output.get("plot_base64")
        if plot_b64:
            plots.append(
                AnalysisPlot(
                    id="forest_plot_or",
                    title="Forest Plot de Odds Ratios e Intervalos de Confianza (95%)",
                    plot_type="forest_plot",
                    image_base64=plot_b64,
                    description="Representación gráfica del tamaño del efecto y precisión de cada predictor.",
                    script_r="# Generado automáticamente mediante R base"
                )
            )

        # 7. Código R Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["stats", "jsonlite"],
            instructions="Copiar y ejecutar en RStudio para replicar exactamente el modelo de regresión logística."
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
