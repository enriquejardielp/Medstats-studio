"""Análisis clínicos adicionales que reutilizan los cálculos ya disponibles en RBridge."""

import json
import math
import base64
from typing import Any, Dict, List, Tuple

import pandas as pd

from backend.core.base_analysis import BaseAnalysis
from backend.core.r_bridge import RBridge
from backend.core.plot_style import R_PLOT_STYLE
from backend.core.results_schema import (
    AnalysisMetadata, AnalysisPlot, AnalysisResult, AnalysisWarning,
    ColumnFormat, ExecutiveSummary, MetricItem, ReproducibleCode,
    StatisticalTable, TableColumnDef, TechnicalDetails, WarningSeverity,
)


class AdvancedBridgeAnalysis(BaseAnalysis):
    """Adaptador de funciones R existentes al contrato común de resultados."""

    SPECS = {
        "cox-regression": ("Regresión de Cox", ["time_var", "event_var", "covariates"], ["survival"]),
        "mcnemar": ("Prueba de McNemar", ["var1", "var2"], ["stats"]),
        "kappa": ("Kappa de Cohen", ["var1", "var2"], ["irr"]),
        "bland-altman": ("Acuerdo: Bland–Altman", ["var1", "var2"], ["stats"]),
        "icc": ("Concordancia: ICC", ["columns"], ["irr"]),
        "ancova": ("ANCOVA ajustada", ["dep_var", "group_var", "covariates"], ["car"]),
        "friedman": ("Prueba de Friedman", ["columns"], ["stats"]),
        "odds-ratio": ("Odds ratio", ["var1", "var2"], ["stats"]),
        "diagnostic-accuracy": ("Exactitud diagnóstica", ["outcome", "predictor"], ["stats"]),
        "sample-size": ("Tamaño muestral y potencia", [], ["pwr"]),
        "count-regression": ("Regresión para recuentos", ["outcome", "covariates"], ["MASS", "stats"]),
        "paired-comparison": ("Comparación de medidas pareadas", ["var1", "var2"], ["stats"]),
    }

    def __init__(self, analysis_type: str):
        if analysis_type not in self.SPECS:
            raise ValueError(f"Análisis avanzado no soportado: {analysis_type}")
        self.analysis_type = analysis_type
        self.title = self.SPECS[analysis_type][0]

    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        if self.analysis_type == "sample-size":
            alpha, power, effect = (params.get(key) for key in ("alpha", "power", "effect"))
            if not all(isinstance(value, (int, float)) for value in (alpha, power, effect)):
                raise ValueError("Indica alfa, potencia y tamaño del efecto como valores numéricos.")
            if not 0 < alpha < 1 or not 0 < power < 1 or effect <= 0:
                raise ValueError("Alfa y potencia deben estar entre 0 y 1, y el tamaño del efecto debe ser mayor que 0.")
            return df.iloc[0:0].copy(), []
        required = self.SPECS[self.analysis_type][1]
        fields = []
        for key in required:
            value = params.get(key)
            if key in {"columns", "covariates"}:
                minimum = 3 if self.analysis_type == "friedman" and key == "columns" else 2 if key == "columns" else 1
                if not isinstance(value, list) or len(value) < minimum:
                    raise ValueError(f"Selecciona al menos {minimum} variables para este análisis.")
                fields.extend(value)
            elif not value:
                raise ValueError(f"Debes seleccionar la variable «{key}».")
            else:
                fields.append(value)

        fields = list(dict.fromkeys(fields))
        missing = [field for field in fields if field not in df.columns]
        if missing:
            raise ValueError(f"No se encuentran estas variables en los datos: {', '.join(missing)}")
        subset = df[fields].copy()
        if self.analysis_type == "cox-regression":
            time = pd.to_numeric(subset[params["time_var"]], errors="coerce")
            event = pd.to_numeric(subset[params["event_var"]], errors="coerce").dropna()
            if time.dropna().empty or (time.dropna() <= 0).any():
                raise ValueError("El tiempo de seguimiento debe ser numérico y mayor que cero.")
            if event.empty or not set(event.unique()).issubset({0, 1}):
                raise ValueError("Codifica el evento como 0 = censurado y 1 = evento.")
            if event.nunique() < 2:
                raise ValueError("Se necesitan casos con y sin evento para estimar Cox.")
        if self.analysis_type == "count-regression":
            values = pd.to_numeric(subset[params["outcome"]], errors="coerce").dropna()
            if values.empty or (values < 0).any() or ((values % 1) != 0).any():
                raise ValueError("El resultado debe ser un recuento entero no negativo.")
        if self.analysis_type == "diagnostic-accuracy":
            outcome = pd.to_numeric(subset[params["outcome"]], errors="coerce").dropna()
            if outcome.empty or not set(outcome.unique()).issubset({0, 1}) or outcome.nunique() < 2:
                raise ValueError("El desenlace de referencia debe codificarse como 0/1 y contener ambas categorías.")
            if pd.to_numeric(subset[params["predictor"]], errors="coerce").notna().sum() < 2:
                raise ValueError("La prueba diagnóstica debe contener valores numéricos.")
        if len(subset.dropna()) < 2:
            raise ValueError("Se necesitan al menos dos observaciones completas.")
        warnings = []
        dropped = len(subset) - len(subset.dropna())
        if dropped:
            warnings.append(AnalysisWarning(
                code="LISTWISE_DELETION", severity=WarningSeverity.INFO,
                message=f"Se excluyeron {dropped} filas incompletas en las variables seleccionadas.",
                action_suggested="El cálculo utiliza casos completos para las variables incluidas.",
            ))
        return subset, warnings

    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        return "# El script reproducible completo lo genera la función RBridge correspondiente."

    def parse_to_schema(self, raw_r_output: Dict[str, Any], script_r: str, valid_df: pd.DataFrame,
                        params: dict, warnings: List[AnalysisWarning], col_map: Dict[str, str],
                        inv_map: Dict[str, str]) -> AnalysisResult:
        raise NotImplementedError("AdvancedBridgeAnalysis ejecuta la función de RBridge directamente")

    def run(self, df: pd.DataFrame, params: dict) -> AnalysisResult:
        valid_df, warnings = self.validate_data(df, params)
        t = self.analysis_type
        plots = []
        if t == "cox-regression":
            result = RBridge.cox_regression(df, params["time_var"], params["event_var"], params["covariates"])
        elif t == "mcnemar":
            result = RBridge.mcnemar_test(df, params["var1"], params["var2"])
        elif t == "kappa":
            result = RBridge.kappa_cohen(df, params["var1"], params["var2"])
        elif t == "bland-altman":
            result = RBridge.bland_altman(df, params["var1"], params["var2"])
            plot_data = df[[params["var1"], params["var2"]]].apply(pd.to_numeric, errors="coerce").dropna()
            plot_data = pd.DataFrame({
                "media": (plot_data.iloc[:, 0] + plot_data.iloc[:, 1]) / 2,
                "diferencia": plot_data.iloc[:, 0] - plot_data.iloc[:, 1],
            })
            path = RBridge._write_temp_csv(plot_data)
            try:
                plot_script = f"""
                library(ggplot2)
                {R_PLOT_STYLE}
                datos <- read.csv('{path}', check.names = FALSE, encoding = 'UTF-8-sig')
                sesgo <- mean(datos$diferencia)
                sd_dif <- stats::sd(datos$diferencia)
                limites <- c(sesgo - 1.96 * sd_dif, sesgo, sesgo + 1.96 * sd_dif)
                grafico <- ggplot(datos, aes(x = media, y = diferencia)) +
                  geom_point(colour = medstats_palette[1], alpha = .68, size = 2.2) +
                  geom_hline(yintercept = limites[1], colour = medstats_palette[2], linetype = 'dashed', linewidth = .8) +
                  geom_hline(yintercept = limites[2], colour = medstats_palette[1], linewidth = .8) +
                  geom_hline(yintercept = limites[3], colour = medstats_palette[2], linetype = 'dashed', linewidth = .8) +
                  labs(title = 'Acuerdo entre métodos', subtitle = 'Línea central: sesgo medio · discontinuas: límites de acuerdo del 95%', x = 'Media de las dos mediciones', y = 'Diferencia entre métodos') +
                  theme_medstats
                save_medstats_plot('plot.png', grafico, width = 8, height = 5.5)
                """
                image_bytes, full_plot_script = RBridge._run_ggplot(path, plot_script)
                plots.append(AnalysisPlot(
                    id="bland-altman-plot", title="Gráfico de acuerdo Bland–Altman",
                    plot_type="scatter", image_base64=base64.b64encode(image_bytes).decode("ascii"),
                    description="Las líneas muestran el sesgo medio y los límites de acuerdo del 95%.",
                    script_r=full_plot_script,
                ))
            finally:
                RBridge._cleanup(path)
        elif t == "icc":
            result = RBridge.icc(df, params["columns"])
        elif t == "ancova":
            result = RBridge.ancova(df, params["dep_var"], params["group_var"], params["covariates"])
        elif t == "friedman":
            result = RBridge.friedman_test(df, params["columns"])
        elif t == "odds-ratio":
            result = RBridge.odds_ratio(df, params["var1"], params["var2"])
        elif t == "diagnostic-accuracy":
            result = RBridge.diagnostic_accuracy(df, params["outcome"], params["predictor"], float(params.get("threshold", 0.5)))
        elif t == "count-regression":
            result = RBridge.count_regression(df, params["outcome"], params["covariates"], params.get("method", "auto"))
        elif t == "paired-comparison":
            result = RBridge.compare_two_groups(
                df[params["var1"]], df[params["var2"]], paired=True,
                method=params.get("method", "welch"), conf_level=float(params.get("conf_level", 0.95)),
            )
        else:
            result = RBridge.sample_size(float(params["alpha"]), float(params["power"]), float(params["effect"]), params.get("test_type", "t-test"))

        ph_p = result.get("zph_global_p")
        if t == "cox-regression" and isinstance(ph_p, (int, float)) and math.isfinite(ph_p) and ph_p < 0.05:
            warnings.append(AnalysisWarning(
                code="COX_PH_ASSUMPTION", severity=WarningSeverity.WARNING,
                message="El test global de Schoenfeld sugiere revisar el supuesto de riesgos proporcionales.",
                action_suggested="Examina los residuos de Schoenfeld y considera efectos dependientes del tiempo o estratificación.",
            ))

        script = result.pop("script_r", "")
        coefficient_key = next((key for key in ("coefficients", "coeficientes", "tabla")
                                if isinstance(result.get(key), list) and result[key]
                                and isinstance(result[key][0], dict)), None)
        rows = [{"resultado": key.replace("_", " "), "valor": self._format_value(value)}
                for key, value in result.items() if key != coefficient_key]
        metrics = []
        for key, value in result.items():
            if isinstance(value, (str, int, float)) and value is not None and not (isinstance(value, float) and not math.isfinite(value)):
                metrics.append(MetricItem(
                    key=key, label=key.replace("_", " ").capitalize(), value=value,
                    formatted=f"{value:.3f}" if isinstance(value, float) else str(value),
                ))
        first = metrics[0].formatted if metrics else "Resultado calculado"
        variables = list(valid_df.columns)
        tables = [StatisticalTable(
            id=f"{t}-results", title="Resultados del análisis",
            columns=[
                TableColumnDef(key="resultado", label="Resultado", align="left", format_type=ColumnFormat.TEXT),
                TableColumnDef(key="valor", label="Estimación", align="left", format_type=ColumnFormat.TEXT),
            ], rows=rows,
        )]
        if coefficient_key:
            coefficient_rows = result[coefficient_key]
            keys = list(dict.fromkeys(key for row in coefficient_rows for key in row.keys()))
            tables.insert(0, StatisticalTable(
                id=f"{t}-coefficients", title="Estimaciones del modelo",
                columns=[TableColumnDef(key=key, label=key.replace("_", " ").capitalize(),
                                        align="left" if isinstance(coefficient_rows[0].get(key), str) else "right",
                                        format_type=ColumnFormat.TEXT if isinstance(coefficient_rows[0].get(key), str) else ColumnFormat.DECIMAL)
                         for key in keys],
                rows=[{key: self._format_value(row.get(key)) for key in keys} for row in coefficient_rows],
            ))

        return AnalysisResult(
            metadata=AnalysisMetadata(
                analysis_id=self._generate_id(), analysis_type=t, title=self.title,
                description="Cálculo teórico configurado por el usuario." if t == "sample-size" else "Estimación calculada con los casos completos disponibles.",
                sample_size=0 if t == "sample-size" else len(df),
                variables_used=[] if t == "sample-size" else variables,
                missing_observations=0 if t == "sample-size" else len(df) - len(valid_df.dropna()),
                valid_observations=0 if t == "sample-size" else len(valid_df.dropna()),
            ),
            summary=ExecutiveSummary(
                headline=f"{self.title}: {first}", key_metrics=metrics[:6],
                interpretation=self._interpretation(t, result),
            ),
            tables=tables,
            plots=plots,
            warnings=warnings,
            technical=TechnicalDetails(
                method=self.title, packages_used=self.SPECS[t][2],
                parameters={key: value for key, value in params.items()},
            ),
            reproducible_code=ReproducibleCode(
                language="R", script=script, packages=self.SPECS[t][2],
                instructions="El script refleja el cálculo realizado con los datos seleccionados.",
            ),
        )

    @staticmethod
    def _format_value(value: Any) -> str:
        if isinstance(value, float):
            return "—" if pd.isna(value) else f"{value:.4g}"
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False, default=str)
        return "—" if value is None else str(value)

    @staticmethod
    def _interpretation(analysis_type: str, result: dict) -> str:
        if analysis_type == "cox-regression":
            return "Los coeficientes se expresan como hazard ratios ajustados. Revisa el diagnóstico de riesgos proporcionales antes de interpretar el modelo."
        if analysis_type == "mcnemar":
            return "La prueba evalúa cambios en proporciones binarias emparejadas; las filas deben representar las mismas personas en ambas mediciones."
        if analysis_type == "kappa":
            return "Kappa resume el acuerdo entre dos evaluadores descontando el acuerdo esperado por azar. La interpretación depende del contexto y la prevalencia."
        if analysis_type == "bland-altman":
            return "El sesgo y los límites de acuerdo describen diferencias entre métodos; la intercambiabilidad requiere criterios clínicos definidos previamente."
        if analysis_type == "icc":
            return "El ICC depende del modelo, tipo de acuerdo y unidad elegidos; interpreta la estimación junto con su intervalo y el diseño de medición."
        if analysis_type == "ancova":
            return "ANCOVA compara el resultado entre grupos ajustando por las covariables incluidas. Revisa linealidad y homogeneidad de pendientes."
        if analysis_type == "friedman":
            return "Prueba no paramétrica para mediciones relacionadas en tres o más condiciones. Requiere que cada fila represente al mismo sujeto."
        if analysis_type == "odds-ratio":
            return "El odds ratio resume la asociación entre dos variables binarias; interpreta la dirección según el orden de sus categorías."
        if analysis_type == "diagnostic-accuracy":
            return "Sensibilidad y especificidad corresponden al umbral elegido; valores predictivos dependen de la prevalencia de la muestra."
        if analysis_type == "sample-size":
            return "Cálculo teórico basado en el tamaño del efecto especificado. Debe corresponder al diseño, desenlace y contraste del estudio."
        if analysis_type == "count-regression":
            return "Las razones de tasas comparan el recuento esperado entre valores de los predictores. El modo automático usa binomial negativa si detecta sobredispersión marcada en el modelo Poisson."
        if analysis_type == "paired-comparison":
            return "Compara las diferencias dentro de cada sujeto. Las dos columnas deben estar emparejadas en la misma fila y en el mismo orden."
        return "Resultado estimado con el método seleccionado."


class CoxRegressionAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("cox-regression")


class McNemarAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("mcnemar")


class KappaAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("kappa")


class BlandAltmanAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("bland-altman")


class ICCAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("icc")


class ANCOVAAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("ancova")


class FriedmanAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("friedman")


class OddsRatioAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("odds-ratio")


class DiagnosticAccuracyAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("diagnostic-accuracy")


class SampleSizeAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("sample-size")


class CountRegressionAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("count-regression")


class PairedComparisonAnalysis(AdvancedBridgeAnalysis):
    def __init__(self): super().__init__("paired-comparison")
