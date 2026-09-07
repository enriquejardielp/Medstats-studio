"""
linear_regression.py - Módulo de Regresión Lineal Múltiple OLS
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


class LinearRegressionAnalysis(BaseAnalysis):
    analysis_type = "linear-regression"
    title = "Regresión Lineal Múltiple (MCO)"
    required_packages = ["jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        dep_var = params.get("dep_var")
        indep_vars = params.get("indep_vars", [])

        if not dep_var:
            raise ValueError("Debes especificar la variable dependiente.")
        if not indep_vars:
            raise ValueError("Debes seleccionar al menos una variable independiente / predictora.")

        all_cols = [dep_var] + indep_vars
        missing_cols = [c for c in all_cols if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Variables no encontradas en el dataset: {missing_cols}")

        subset = df[all_cols].dropna()
        n_obs = len(subset)
        k_vars = len(indep_vars)

        if n_obs <= (k_vars + 1):
            raise ValueError(f"Observaciones insuficientes ({n_obs}) para estimar {k_vars} predictores + constante.")

        warnings = []
        n_dropped = len(df) - n_obs
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se eliminaron {n_dropped} observaciones con datos incompletos.",
                    action_suggested=f"Modelo ajustado sobre N = {n_obs} casos completos."
                )
            )

        if n_obs < 30:
            warnings.append(
                AnalysisWarning(
                    code="SMALL_SAMPLE_SIZE",
                    severity=WarningSeverity.WARNING,
                    message=f"Tamaño muestral reducido (N = {n_obs}). Los errores estándar pueden ser sensibles a violaciones de normalidad.",
                    action_suggested="Interpretar con cautela los intervalos de confianza."
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

        formula_model <- as.formula('{r_dep} ~ {formula_rhs}')
        fit <- lm(formula_model, data = datos)
        s <- summary(fit)
        coefs <- coef(s)
        ci <- confint(fit, level = {conf_level})

        resids <- residuals(fit)
        n_resids <- length(resids)

        # 1. Normalidad de residuos (Shapiro-Wilk)
        sw_p <- tryCatch(
            if (n_resids >= 3 && n_resids <= 5000) as.numeric(shapiro.test(resids)$p.value) else NA,
            error = function(e) NA
        )

        # 2. Autocorrelación de residuos (Durbin-Watson en base R)
        dw_val <- tryCatch(
            if (n_resids > 2 && sum(resids^2) > 0) as.numeric(sum(diff(resids)^2) / sum(resids^2)) else NA,
            error = function(e) NA
        )

        # 3. Multicolinealidad (VIF en base R) si k > 1
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

        f_stat <- as.numeric(s$fstatistic[1])
        f_num_df <- as.numeric(s$fstatistic[2])
        f_den_df <- as.numeric(s$fstatistic[3])
        p_val_f <- as.numeric(pf(f_stat, f_num_df, f_den_df, lower.tail = FALSE))

        # Tabla de coeficientes
        coef_rows <- list()
        row_names <- rownames(coefs)
        for (i in 1:nrow(coefs)) {{
            coef_rows[[i]] <- list(
                term = row_names[i],
                estimate = as.numeric(coefs[i, 1]),
                std_error = as.numeric(coefs[i, 2]),
                t_statistic = as.numeric(coefs[i, 3]),
                p_value = as.numeric(coefs[i, 4]),
                ci_lower = as.numeric(ci[i, 1]),
                ci_upper = as.numeric(ci[i, 2])
            )
        }}

        res <- list(
            coefficients = coef_rows,
            r_squared = as.numeric(s$r.squared),
            adj_r_squared = as.numeric(s$adj.r.squared),
            f_statistic = f_stat,
            f_df1 = f_num_df,
            f_df2 = f_den_df,
            f_p_value = p_val_f,
            sigma = as.numeric(s$sigma),
            n = n_resids,
            aic = as.numeric(AIC(fit)),
            bic = as.numeric(BIC(fit)),
            diagnostics = list(
                shapiro_p = sw_p,
                durbin_watson = dw_val,
                vif = vif_list
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
        dep_var = params.get("dep_var")
        indep_vars = params.get("indep_vars", [])
        r2 = raw_r_output.get("r_squared", 0.0)
        adj_r2 = raw_r_output.get("adj_r_squared", 0.0)
        f_stat = raw_r_output.get("f_statistic", 0.0)
        f_df1 = int(raw_r_output.get("f_df1", 0))
        f_df2 = int(raw_r_output.get("f_df2", 0))
        f_p = raw_r_output.get("f_p_value", 1.0)
        n_obs = raw_r_output.get("n", len(valid_df))

        f_p_formatted = "< .001" if f_p < 0.001 else f"{f_p:.4f}"

        # 1. Tabla de Coeficientes
        raw_coefs = raw_r_output.get("coefficients", [])
        coef_rows = []
        for c in raw_coefs:
            term_r = c.get("term", "")
            if term_r == "(Intercept)":
                term_name = "Constante (Intersección)"
            else:
                term_name = inv_map.get(term_r, term_r)

            p_val = c.get("p_value", 1.0)
            star = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else ""

            coef_rows.append({
                "term": term_name,
                "estimate": c.get("estimate"),
                "std_error": c.get("std_error"),
                "t_statistic": c.get("t_statistic"),
                "p_value": p_val,
                "significance": star,
                "ci_lower": c.get("ci_lower"),
                "ci_upper": c.get("ci_upper"),
                "ci_95": f"[{c.get('ci_lower', 0):.2f}, {c.get('ci_upper', 0):.2f}]"
            })

        table_coefs = StatisticalTable(
            id="table_regression_coefficients",
            title="Coeficientes del Modelo",
            subtitle=f"Variable dependiente: {dep_var}",
            columns=[
                TableColumnDef(key="term", label="Variable", align="left", format_type=ColumnFormat.TEXT),
                TableColumnDef(key="estimate", label="Coeficiente (B)", format_type=ColumnFormat.DECIMAL, decimals=3),
                TableColumnDef(key="std_error", label="Error Estándar (EE)", format_type=ColumnFormat.DECIMAL, decimals=3),
                TableColumnDef(key="t_statistic", label="t", format_type=ColumnFormat.DECIMAL, decimals=2),
                TableColumnDef(key="p_value", label="p-valor", format_type=ColumnFormat.P_VALUE, decimals=4),
                TableColumnDef(key="ci_95", label="IC 95%", align="center", format_type=ColumnFormat.TEXT),
            ],
            rows=coef_rows,
            footnotes=[
                TableFootnote(symbol="*", text="p < .05"),
                TableFootnote(symbol="**", text="p < .01"),
                TableFootnote(symbol="***", text="p < .001")
            ]
        )

        # 2. Diagnósticos de Modelo
        diagnostics = []
        diag_raw = raw_r_output.get("diagnostics", {})

        # Shapiro
        shapiro_p = diag_raw.get("shapiro_p")
        if shapiro_p is not None:
            sw_status = DiagnosticStatus.PASS if shapiro_p > 0.05 else DiagnosticStatus.WARNING
            diagnostics.append(
                DiagnosticItem(
                    id="diag_normality_residuals",
                    name="Normalidad de Residuos (Shapiro-Wilk)",
                    status=sw_status,
                    p_value=shapiro_p,
                    threshold="p > 0.05",
                    finding=f"p = {shapiro_p:.4f} ({'Residuos normales' if shapiro_p > 0.05 else 'Desviación de la normalidad'})",
                    recommendation="Evaluar transformaciones en la variable dependiente si N es pequeño." if shapiro_p <= 0.05 else None
                )
            )

        # Durbin-Watson
        dw = diag_raw.get("durbin_watson")
        if dw is not None:
            dw_status = DiagnosticStatus.PASS if (1.5 <= dw <= 2.5) else DiagnosticStatus.WARNING
            diagnostics.append(
                DiagnosticItem(
                    id="diag_autocorrelation",
                    name="Independencia de Residuos (Durbin-Watson)",
                    status=dw_status,
                    statistic_name="DW",
                    statistic_value=dw,
                    threshold="1.5 - 2.5",
                    finding=f"DW = {dw:.2f} ({'Sin autocorrelación' if dw_status == DiagnosticStatus.PASS else 'Posible autocorrelación'})"
                )
            )

        # VIF (Multicolinealidad)
        vif_dict = diag_raw.get("vif", {})
        if vif_dict:
            max_vif = max(vif_dict.values()) if vif_dict else 1.0
            vif_status = DiagnosticStatus.FAIL if max_vif > 10 else DiagnosticStatus.WARNING if max_vif > 5 else DiagnosticStatus.PASS
            vif_findings = ", ".join([f"{inv_map.get(k, k)}={v:.1f}" for k, v in vif_dict.items()])
            diagnostics.append(
                DiagnosticItem(
                    id="diag_multicollinearity",
                    name="Multicolinealidad (VIF)",
                    status=vif_status,
                    statistic_name="Max VIF",
                    statistic_value=max_vif,
                    threshold="VIF < 5",
                    finding=f"VIF máximo = {max_vif:.1f} ({vif_findings})",
                    recommendation="Variables altamente colineales detectadas. Considerar remover o combinar variables." if max_vif > 5 else None
                )
            )

        # Interpretación prudente
        if f_p < 0.05:
            interp = f"El modelo de regresión lineal explica el {r2*100:.1f}% de la varianza en {dep_var} (R² ajustado = {adj_r2:.3f}, F({f_df1}, {f_df2}) = {f_stat:.2f}, p {f_p_formatted})."
        else:
            interp = f"El modelo lineal no alcanzó significación estadística global (F({f_df1}, {f_df2}) = {f_stat:.2f}, p = {f_p:.4f}, R² = {r2:.3f})."

        return AnalysisResult(
            metadata=AnalysisMetadata(
                analysis_id=analysis_id,
                analysis_type=self.analysis_type,
                title=f"{self.title}: {dep_var}",
                description=f"Modelo ajustado con {len(indep_vars)} variable(s) predictora(s)",
                sample_size=n_obs,
                variables_used=[dep_var] + indep_vars,
                valid_observations=n_obs
            ),
            summary=ExecutiveSummary(
                headline=f"R² = {r2:.3f}, R² adj = {adj_r2:.3f}, F({f_df1}, {f_df2}) = {f_stat:.2f}, p {f_p_formatted}",
                key_metrics=[
                    MetricItem(key="r2", label="R² (Coef. Determinación)", value=r2, formatted=f"{r2:.3f}"),
                    MetricItem(key="adj_r2", label="R² Ajustado", value=adj_r2, formatted=f"{adj_r2:.3f}"),
                    MetricItem(key="f_stat", label=f"F({f_df1}, {f_df2})", value=f_stat, formatted=f"{f_stat:.2f}", p_value=f_p),
                    MetricItem(key="f_p", label="p-valor del Modelo", value=f_p, formatted=f_p_formatted),
                    MetricItem(key="n", label="N Observaciones", value=n_obs, formatted=str(n_obs)),
                    MetricItem(key="aic", label="AIC", value=raw_r_output.get("aic"), formatted=f"{raw_r_output.get('aic', 0):.1f}"),
                ],
                interpretation=interp
            ),
            tables=[table_coefs],
            diagnostics=diagnostics,
            warnings=warnings,
            plots=[],
            technical=TechnicalDetails(
                method="Mínimos Cuadrados Ordinarios (OLS)",
                formula=f"{dep_var} ~ {' + '.join(indep_vars)}",
                degrees_of_freedom=[f_df1, f_df2],
                aic=raw_r_output.get("aic"),
                bic=raw_r_output.get("bic"),
                r_version="R Core Team",
                packages_used=self.required_packages
            ),
            reproducible_code=ReproducibleCode(
                language="R",
                script=script_r,
                packages=self.required_packages,
                instructions="Asegurar tener instalados los paquetes 'car' y 'jsonlite' en R."
            )
        )
