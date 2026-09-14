"""
kaplan_meier.py - Módulo de Supervivencia de Kaplan-Meier (Stata + SPSS + R)
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


class KaplanMeierAnalysis(BaseAnalysis):
    analysis_type = "kaplan-meier"
    title = "Análisis de Supervivencia de Kaplan-Meier"
    required_packages = ["survival", "jsonlite"]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        time_var = params.get("time_var")
        event_var = params.get("event_var")
        group_var = params.get("group_var")

        if not time_var or not event_var:
            raise ValueError("Debes especificar la variable de tiempo de seguimiento y la variable de evento (censura/fallecimiento).")

        required_cols = [time_var, event_var]
        if group_var:
            required_cols.append(group_var)

        missing_cols = [c for c in required_cols if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Columnas no encontradas en el dataset: {missing_cols}")

        subset = df[required_cols].dropna()
        n_obs = len(subset)

        if n_obs < 3:
            raise ValueError("Se requieren al menos 3 observaciones válidas para estimar curvas de supervivencia.")

        # Validar tiempo positivo
        subset[time_var] = pd.to_numeric(subset[time_var], errors="coerce")
        if subset[time_var].isna().any():
            raise ValueError(f"La variable de tiempo '{time_var}' contiene valores no numéricos.")

        subset = subset[subset[time_var] >= 0]

        # Validar evento binario
        unique_events = subset[event_var].dropna().unique()
        if len(unique_events) > 2:
            raise ValueError(
                f"La variable de evento '{event_var}' debe ser binaria (ej. 0/1, Caso/Control, Vivo/Muerto). Se detectaron {len(unique_events)} valores."
            )

        warnings = []
        n_dropped = len(df) - len(subset)
        if n_dropped > 0:
            warnings.append(
                AnalysisWarning(
                    code="LISTWISE_DELETION",
                    severity=WarningSeverity.INFO,
                    message=f"Se descartaron {n_dropped} filas con datos incompletos o tiempos negativos.",
                    action_suggested=f"Supervivencia estimada sobre N = {len(subset)} pacientes."
                )
            )

        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        time_var = params.get("time_var")
        event_var = params.get("event_var")
        group_var = params.get("group_var")
        conf_level = float(params.get("conf_level", 0.95))

        r_time = col_map[time_var]
        r_event = col_map[event_var]
        r_group = col_map[group_var] if group_var else None

        group_expr = f"datos[['{r_group}']]" if r_group else "NULL"

        return f"""
        library(jsonlite)
        library(survival)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        time_vec <- as.numeric(datos[['{r_time}']])
        
        # Convertir evento a 0 / 1
        raw_event <- datos[['{r_event}']]
        if (is.factor(raw_event) || is.character(raw_event)) {{
            ev_levels <- unique(na.omit(raw_event))
            # Segundo nivel o nivel que contenga '1', 'muerte', 'evento', 'si', 'fall'
            ev_lower <- tolower(as.character(raw_event))
            event_vec <- as.numeric(ev_lower %in% c("1", "si", "sí", "true", "muerte", "fallecido", "evento", "caso", "dead", "relapse"))
            if (sum(event_vec) == 0 && length(ev_levels) == 2) {{
                event_vec <- as.numeric(raw_event == ev_levels[2])
            }}
        }} else {{
            event_vec <- as.numeric(raw_event > 0)
        }}

        group_vec <- {group_expr}
        has_group <- !is.null(group_vec) && length(unique(na.omit(group_vec))) > 1

        if (!has_group) {{
            fit <- survfit(Surv(time_vec, event_vec) ~ 1, conf.int = {conf_level})
            logrank_p <- NA_real_
            logrank_chisq <- NA_real_
            logrank_df <- NA_integer_
            zph_p <- NA_real_
            strata_names <- c("Global")
        }} else {{
            group_factor <- as.factor(group_vec)
            fit <- survfit(Surv(time_vec, event_vec) ~ group_factor, conf.int = {conf_level})
            strata_names <- levels(group_factor)
            
            # Prueba de Log-Rank
            lr <- survdiff(Surv(time_vec, event_vec) ~ group_factor)
            logrank_df <- length(lr$n) - 1
            logrank_chisq <- as.numeric(lr$chisq)
            logrank_p <- 1 - pchisq(lr$chisq, df = logrank_df)

            # Verificación de riesgos proporcionales con Cox
            zph_p <- tryCatch({{
                cfit <- coxph(Surv(time_vec, event_vec) ~ group_factor)
                z <- cox.zph(cfit)
                as.numeric(z$table[nrow(z$table), "p"])
            }}, error = function(e) NA_real_)
        }}

        # Mediana de supervivencia por estrato
        fit_sum <- summary(fit)$table
        strata_summary <- list()
        
        if (is.matrix(fit_sum)) {{
            for (i in 1:nrow(fit_sum)) {{
                rname <- rownames(fit_sum)[i]
                clean_name <- gsub("^group_factor=", "", rname)
                med_val <- if (!is.na(fit_sum[i, "median"])) as.numeric(fit_sum[i, "median"]) else NA_real_
                l_ci <- if ("0.95LCL" %in% colnames(fit_sum) && !is.na(fit_sum[i, "0.95LCL"])) as.numeric(fit_sum[i, "0.95LCL"]) else NA_real_
                u_ci <- if ("0.95UCL" %in% colnames(fit_sum) && !is.na(fit_sum[i, "0.95UCL"])) as.numeric(fit_sum[i, "0.95UCL"]) else NA_real_
                
                n_total <- as.integer(fit_sum[i, "records"])
                n_events <- as.integer(fit_sum[i, "events"])
                
                strata_summary[[i]] <- list(
                    stratum = clean_name,
                    n_records = n_total,
                    n_events = n_events,
                    n_censored = n_total - n_events,
                    pct_censored = round((n_total - n_events) / n_total * 100, 1),
                    median_survival = med_val,
                    ci_lower = l_ci,
                    ci_upper = u_ci
                )
            }}
        }} else {{
            n_total <- as.integer(fit_sum["records"])
            n_events <- as.integer(fit_sum["events"])
            med_val <- if (!is.na(fit_sum["median"])) as.numeric(fit_sum["median"]) else NA_real_
            l_ci <- if ("0.95LCL" %in% names(fit_sum) && !is.na(fit_sum["0.95LCL"])) as.numeric(fit_sum["0.95LCL"]) else NA_real_
            u_ci <- if ("0.95UCL" %in% names(fit_sum) && !is.na(fit_sum["0.95UCL"])) as.numeric(fit_sum["0.95UCL"]) else NA_real_
            
            strata_summary[[1]] <- list(
                stratum = "Global",
                n_records = n_total,
                n_events = n_events,
                n_censored = n_total - n_events,
                pct_censored = round((n_total - n_events) / n_total * 100, 1),
                median_survival = med_val,
                ci_lower = l_ci,
                ci_upper = u_ci
            )
        }}

        # Tabla de vida en hitos temporales
        s_all <- summary(fit)
        n_times <- length(s_all$time)
        step <- max(1, floor(n_times / 12))
        sel_idx <- seq(1, n_times, by = step)
        if (!(n_times %in% sel_idx)) sel_idx <- c(sel_idx, n_times)

        life_table <- list()
        for (k in 1:length(sel_idx)) {{
            idx <- sel_idx[k]
            str_label <- if (!is.null(s_all$strata)) as.character(s_all$strata[idx]) else "Global"
            str_clean <- gsub("^group_factor=", "", str_label)
            
            life_table[[k]] <- list(
                stratum = str_clean,
                time = as.numeric(s_all$time[idx]),
                n_risk = as.integer(s_all$n.risk[idx]),
                n_event = as.integer(s_all$n.event[idx]),
                surv_prob = as.numeric(s_all$surv[idx]),
                std_err = as.numeric(s_all$std.err[idx]),
                ci_lower = as.numeric(s_all$lower[idx]),
                ci_upper = as.numeric(s_all$upper[idx])
            )
        }}

        # Generar Gráfico Curva Kaplan-Meier
        img_base64 <- ""
        tryCatch({{
            tmp_img <- tempfile(fileext = ".png")
            png(tmp_img, width = 650, height = 480, res = 110)
            par(mar = c(4.5, 4.5, 3, 2))
            
            col_palette <- c("#2563eb", "#dc2626", "#16a34a", "#9333ea", "#d97706")
            plot(fit, col = col_palette[1:max(1, length(strata_names))], lwd = 2.5,
                 xlab = "Tiempo de Seguimiento", ylab = "Probabilidad de Supervivencia Cumulativa",
                 main = "Curva de Supervivencia de Kaplan-Meier", mark.time = TRUE, pch = 3, cex = 0.8)
            grid(col = "#e2e8f0")
            
            if (has_group) {{
                legend("bottomleft", legend = strata_names, col = col_palette[1:length(strata_names)],
                       lwd = 2.5, bty = "o", bg = "white", box.col = "#cbd5e1", cex = 0.85)
            }}
            dev.off()
            img_base64 <- jsonlite::base64_enc(readBin(tmp_img, "raw", n = file.info(tmp_img)$size))
            unlink(tmp_img)
        }}, error = function(e) {{}})

        total_obs <- length(time_vec)
        total_events <- sum(event_vec)
        total_censored <- total_obs - total_events

        result <- list(
            total_n = as.integer(total_obs),
            total_events = as.integer(total_events),
            total_censored = as.integer(total_censored),
            censoring_rate = as.numeric(total_censored / total_obs),
            has_group = as.logical(has_group),
            logrank_p = if (!is.na(logrank_p)) as.numeric(logrank_p) else NULL,
            logrank_chisq = if (!is.na(logrank_chisq)) as.numeric(logrank_chisq) else NULL,
            logrank_df = if (!is.na(logrank_df)) as.integer(logrank_df) else NULL,
            zph_p = if (!is.na(zph_p)) as.numeric(zph_p) else NULL,
            strata_summary = strata_summary,
            life_table = life_table,
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
        time_var = params.get("time_var")
        event_var = params.get("event_var")
        group_var = params.get("group_var")

        total_n = raw_r_output.get("total_n", len(valid_df))
        total_events = raw_r_output.get("total_events", 0)
        total_censored = raw_r_output.get("total_censored", 0)
        censoring_rate = raw_r_output.get("censoring_rate", 0.0)
        has_group = raw_r_output.get("has_group", False)
        logrank_p = raw_r_output.get("logrank_p")
        logrank_chisq = raw_r_output.get("logrank_chisq")
        logrank_df = raw_r_output.get("logrank_df")
        zph_p = raw_r_output.get("zph_p")

        strata_summary_rows = raw_r_output.get("strata_summary", [])

        # 1. Metadatos
        metadata = AnalysisMetadata(
            analysis_id=self._generate_id(),
            analysis_type=self.analysis_type,
            title=f"Análisis de Supervivencia: {time_var} por {event_var}" + (f" (Estratos: {group_var})" if group_var else ""),
            description=f"Curvas de Kaplan-Meier sobre N = {total_n} pacientes con {total_events} eventos observados.",
            created_at=self._current_iso_time(),
            sample_size=len(valid_df),
            valid_observations=total_n,
            missing_observations=0,
            variables_used=[time_var, event_var] + ([group_var] if group_var else [])
        )

        # 2. Resumen Ejecutivo
        if has_group and logrank_p is not None:
            significativo = logrank_p < 0.05
            p_fmt = "< 0.001" if logrank_p < 0.001 else f"{logrank_p:.4f}"
            headline = f"{'Diferencias estadísticamente significativas' if significativo else 'Sin diferencias estadísticamente significativas'} en supervivencia (Log-Rank p = {p_fmt})"
            
            desc_items = []
            for s in strata_summary_rows:
                s_name = s.get('stratum', 'Desconocido')
                med_val = s.get('median_survival')
                m_str = f"{med_val:.1f}" if med_val is not None else "No alcanzada"
                ev_cnt = s.get('n_events', 0)
                desc_items.append(f"Estrato '{s_name}': mediana = {m_str} ({ev_cnt} eventos)")
            strata_desc = ", ".join(desc_items)
            interpretation = (
                f"La comparación de curvas mediante el test de Log-Rank (χ² = {logrank_chisq:.2f}, gl = {logrank_df}) arrojó un p-valor de {p_fmt}. "
                f"{'Se observan diferencias significativas en la supervivencia libre de eventos entre los grupos analizados.' if significativo else 'No se evidencia separación estadísticamente significativa entre las trayectorias de supervivencia.'} "
                f"{strata_desc}."
            )
        else:
            first_s = strata_summary_rows[0] if strata_summary_rows else {}
            med_val = first_s.get("median_survival")
            med_str = f"{med_val:.1f}" if med_val is not None else "No alcanzada"
            headline = f"Supervivencia Global: Mediana = {med_str} ({total_events} eventos / {total_n} pacientes)"
            interpretation = (
                f"Estimación de Kaplan-Meier no estratificada sobre {total_n} individuos. "
                f"Se registraron {total_events} eventos ({100 - censoring_rate*100:.1f}%) y {total_censored} datos censurados ({censoring_rate*100:.1f}%). "
                f"La mediana estimada de supervivencia es {med_str} unidades de tiempo."
            )

        key_metrics = [
            MetricItem(
                key="total_events",
                label="Eventos Observados",
                value=total_events,
                formatted=f"{total_events} / {total_n}",
                description=f"Tasa de eventos: {100 - censoring_rate*100:.1f}%"
            ),
            MetricItem(
                key="censoring_rate",
                label="Tasa de Censura",
                value=censoring_rate,
                formatted=f"{censoring_rate*100:.1f}%",
                description="Porcentaje de observaciones censuradas a la derecha"
            )
        ]

        if logrank_p is not None:
            key_metrics.append(
                MetricItem(
                    key="logrank_p",
                    label="Log-Rank p-valor",
                    value=logrank_p,
                    formatted="< 0.001" if logrank_p < 0.001 else f"{logrank_p:.4f}",
                    p_value=logrank_p,
                    description=f"Chi-cuadrado = {logrank_chisq:.2f} (gl = {logrank_df})"
                )
            )

        summary = ExecutiveSummary(headline=headline, key_metrics=key_metrics, interpretation=interpretation)

        # 3. Tablas Estadísticas
        # Tabla 1: Resumen por Estratos
        strata_table_cols = [
            TableColumnDef(key="stratum", label="Estrato / Grupo", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="n_records", label="N Total", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="n_events", label="Eventos (d)", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="n_censored", label="Censurados", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="pct_censored", label="% Censura", align="right", format_type=ColumnFormat.PERCENTAGE, decimals=1),
            TableColumnDef(key="median_survival_str", label="Mediana Superv.", align="right", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="ci_95_str", label="IC 95% Mediana", align="center", format_type=ColumnFormat.TEXT),
        ]

        strata_rows = []
        for s in strata_summary_rows:
            med = s.get("median_survival")
            l_ci = s.get("ci_lower")
            u_ci = s.get("ci_upper")
            
            med_txt = f"{med:.2f}" if med is not None else "No alcanzada"
            ci_txt = f"[{l_ci:.2f}, {u_ci:.2f}]" if (l_ci is not None and u_ci is not None) else "[- , -]"
            
            strata_rows.append({
                "stratum": s.get("stratum", "Global"),
                "n_records": s.get("n_records"),
                "n_events": s.get("n_events"),
                "n_censored": s.get("n_censored"),
                "pct_censored": s.get("pct_censored"),
                "median_survival_str": med_txt,
                "ci_95_str": ci_txt
            })

        table_strata = StatisticalTable(
            id="km_strata_summary",
            title="Resumen de Supervivencia y Medianas por Grupo",
            subtitle=f"Tiempos de supervivencia estimados por el método de Kaplan-Meier",
            columns=strata_table_cols,
            rows=strata_rows,
            footnotes=[
                TableFootnote(symbol="*", text="Mediana 'No alcanzada' indica que más del 50% de los sujetos seguían libres de evento al final del seguimiento.")
            ]
        )

        # Tabla 2: Tabla de Vida / Probabilidades Cumulativas
        life_cols = [
            TableColumnDef(key="stratum", label="Estrato", align="left", format_type=ColumnFormat.TEXT),
            TableColumnDef(key="time", label="Tiempo (t)", align="right", format_type=ColumnFormat.DECIMAL, decimals=2),
            TableColumnDef(key="n_risk", label="En Riesgo (n)", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="n_event", label="Eventos (d)", align="right", format_type=ColumnFormat.NUMBER),
            TableColumnDef(key="surv_prob_pct", label="Superv. S(t) %", align="right", format_type=ColumnFormat.PERCENTAGE, decimals=1),
            TableColumnDef(key="std_err", label="Error Estd.", align="right", format_type=ColumnFormat.DECIMAL, decimals=4),
            TableColumnDef(key="ci_str", label="IC 95% S(t)", align="center", format_type=ColumnFormat.TEXT),
        ]

        life_rows = []
        for r in raw_r_output.get("life_table", []):
            sp = r.get("surv_prob")
            low = r.get("ci_lower")
            upp = r.get("ci_upper")
            
            sp_pct = (sp * 100) if sp is not None else 0.0
            ci_txt = f"[{low*100:.1f}%, {upp*100:.1f}%]" if (low is not None and upp is not None) else "[- , -]"
            
            life_rows.append({
                "stratum": r.get("stratum", "Global"),
                "time": r.get("time"),
                "n_risk": r.get("n_risk"),
                "n_event": r.get("n_event"),
                "surv_prob_pct": sp_pct,
                "std_err": r.get("std_err"),
                "ci_str": ci_txt
            })

        table_life = StatisticalTable(
            id="km_life_table",
            title="Tabla de Vida y Probabilidad Cumulativa de Supervivencia",
            subtitle="Estimación puntual de S(t) con intervalos calculados por fórmula de Greenwood",
            columns=life_cols,
            rows=life_rows
        )

        # 4. Diagnósticos
        diagnostics = [
            DiagnosticItem(
                id="censoring_level",
                name="Tasa de Censura a la Derecha",
                status=DiagnosticStatus.PASS if censoring_rate < 0.6 else DiagnosticStatus.WARNING,
                statistic_name="Tasa Censura",
                statistic_value=censoring_rate * 100,
                threshold="< 60% eventos censurados",
                finding=f"{censoring_rate*100:.1f}% de las observaciones fueron censuradas.",
                recommendation="Una alta tasa de censura (> 60-70%) reduce la potencia estadística para detectar medianas de supervivencia." if censoring_rate >= 0.6 else None
            )
        ]

        if zph_p is not None:
            diagnostics.append(
                DiagnosticItem(
                    id="ph_assumption",
                    name="Supuesto de Riesgos Proporcionales (Test de Schoenfeld)",
                    status=DiagnosticStatus.PASS if zph_p >= 0.05 else DiagnosticStatus.WARNING,
                    p_value=zph_p,
                    threshold="p >= 0.05",
                    finding=f"Test de residuos de Schoenfeld: p = {zph_p:.4f}.",
                    recommendation="Las curvas de supervivencia se cruzan o los riesgos no son proporcionales en el tiempo. Considere análisis con riesgos competitivos o tiempo-dependientes." if zph_p < 0.05 else None
                )
            )

        # 5. Información Técnica
        technical = TechnicalDetails(
            method="Estimador de Límite de Producto de Kaplan-Meier con Test de Log-Rank (Mantel-Cox)",
            formula=f"Surv({time_var}, {event_var})" + (f" ~ {group_var}" if group_var else " ~ 1"),
            packages_used=["survival (3.7-0)", "stats", "jsonlite"]
        )

        # 6. Gráficos
        plots = []
        plot_b64 = raw_r_output.get("plot_base64")
        if plot_b64:
            plots.append(
                AnalysisPlot(
                    id="km_survival_plot",
                    title=f"Curva de Supervivencia de Kaplan-Meier ({time_var})",
                    plot_type="kaplan_meier",
                    image_base64=plot_b64,
                    description="Función escalonada de supervivencia con marcas de censura en cada tiempo de seguimiento.",
                    script_r="# Generado mediante survival::plot.survfit"
                )
            )

        # 7. Código Reproducible
        reproducible = ReproducibleCode(
            language="R",
            script=script_r,
            packages=["survival", "jsonlite"],
            instructions="Copiar y ejecutar en RStudio para reproducir exactamente las curvas de supervivencia y tablas de vida."
        )

        return AnalysisResult(
            metadata=metadata,
            summary=summary,
            tables=[table_strata, table_life],
            diagnostics=diagnostics,
            warnings=warnings,
            plots=plots,
            technical=technical,
            reproducible_code=reproducible
        )
