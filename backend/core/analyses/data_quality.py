"""Perfil de calidad para detectar ausencias, duplicados y variables sin variación."""

from backend.core.base_analysis import BaseAnalysis
from backend.core.results_schema import (
    AnalysisMetadata, AnalysisResult, AnalysisWarning, ColumnFormat,
    ExecutiveSummary, MetricItem, ReproducibleCode, StatisticalTable,
    TableColumnDef, TechnicalDetails, WarningSeverity,
)


class DataQualityAnalysis(BaseAnalysis):
    analysis_type = "data-quality"
    title = "Calidad y completitud de los datos"
    required_packages = []

    def validate_data(self, df, params):
        if df.empty or len(df.columns) == 0:
            raise ValueError("El conjunto de datos no contiene filas o columnas para revisar.")
        return df.copy(), []

    def generate_r_script(self, data_path, params, col_map):
        return "# Este perfil se calcula en Python; no requiere R."

    def parse_to_schema(self, raw_r_output, script_r, valid_df, params, warnings, col_map, inv_map):
        raise NotImplementedError

    def run(self, df, params):
        data, warnings = self.validate_data(df, params)
        rows = []
        for column in data.columns:
            missing = int(data[column].isna().sum())
            distinct = int(data[column].nunique(dropna=True))
            rows.append({
                "variable": str(column),
                "missing_n": missing,
                "missing_percent": round(missing / len(data) * 100, 2),
                "distinct_values": distinct,
                "constant": "Sí" if distinct == 1 else "No",
            })
            if distinct == 0:
                warnings.append(AnalysisWarning(
                    code="EMPTY_VARIABLE", severity=WarningSeverity.WARNING,
                    message=f"La variable «{column}» está completamente vacía.", variable=str(column),
                    action_suggested="Revisa la importación o elimina la columna si no se utilizará.",
                ))
            elif distinct == 1:
                warnings.append(AnalysisWarning(
                    code="CONSTANT_VARIABLE", severity=WarningSeverity.INFO,
                    message=f"La variable «{column}» solo tiene un valor observado.", variable=str(column),
                    action_suggested="No aportará variación para los modelos mientras siga así.",
                ))

        missing_total = int(data.isna().sum().sum())
        duplicate_rows = int(data.duplicated().sum())
        if duplicate_rows:
            warnings.append(AnalysisWarning(
                code="DUPLICATE_ROWS", severity=WarningSeverity.WARNING,
                message=f"Se encontraron {duplicate_rows} filas completamente duplicadas.",
                action_suggested="Comprueba si son registros repetidos antes de excluirlos.",
            ))
        return AnalysisResult(
            metadata=AnalysisMetadata(
                analysis_id=self._generate_id(), analysis_type=self.analysis_type,
                title=self.title, description="Revisión descriptiva del conjunto de datos sin modificarlo.",
                sample_size=len(data), variables_used=[str(column) for column in data.columns],
                missing_observations=missing_total, valid_observations=len(data),
            ),
            summary=ExecutiveSummary(
                headline=f"{len(data):,} filas · {len(data.columns)} variables · {missing_total:,} celdas ausentes",
                key_metrics=[
                    MetricItem(key="rows", label="Filas", value=len(data), formatted=f"{len(data):,}"),
                    MetricItem(key="variables", label="Variables", value=len(data.columns), formatted=str(len(data.columns))),
                    MetricItem(key="missing", label="Celdas ausentes", value=missing_total, formatted=f"{missing_total:,}"),
                    MetricItem(key="duplicates", label="Filas duplicadas", value=duplicate_rows, formatted=f"{duplicate_rows:,}"),
                ],
                interpretation="Este perfil describe completitud y variación observada. Los duplicados se señalan para revisión y no se eliminan automáticamente.",
            ),
            tables=[StatisticalTable(
                id="data-quality-profile", title="Completitud y variación por variable",
                columns=[
                    TableColumnDef(key="variable", label="Variable", align="left", format_type=ColumnFormat.TEXT),
                    TableColumnDef(key="missing_n", label="Ausentes (n)", format_type=ColumnFormat.NUMBER),
                    TableColumnDef(key="missing_percent", label="Ausentes (%)", format_type=ColumnFormat.DECIMAL, decimals=2),
                    TableColumnDef(key="distinct_values", label="Valores distintos", format_type=ColumnFormat.NUMBER),
                    TableColumnDef(key="constant", label="Constante", align="center", format_type=ColumnFormat.TEXT),
                ], rows=rows,
            )],
            warnings=warnings,
            technical=TechnicalDetails(method="Perfil descriptivo de calidad de datos", packages_used=["pandas"]),
            reproducible_code=ReproducibleCode(
                language="Python", script="profile = df.agg(['count', 'nunique']).T\nmissing = df.isna().sum()\nduplicates = df.duplicated().sum()",
                packages=["pandas"], instructions="Cálculo descriptivo sin imputar, corregir ni eliminar datos.",
            ),
        )
