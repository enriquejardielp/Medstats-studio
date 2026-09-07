"""
base_analysis.py - Clase Base para Módulos Estadísticos
MedStats Studio - Pipeline Estandarizado (Stata + SPSS + R)
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Tuple
import pandas as pd
import tempfile
import os
import re
from datetime import datetime
import uuid

from backend.core.results_schema import (
    AnalysisResult,
    AnalysisWarning,
    WarningSeverity,
)
from backend.core.r_engine import REngine


class BaseAnalysis(ABC):
    """
    Clase abstracta que define el ciclo de vida de todo análisis estadístico:
    1. validate_data: Limpieza, validación de tipos y generación de warnings.
    2. generate_r_script: Construcción del código R reproducible.
    3. execute_r: Ejecución en el motor R optimizado.
    4. parse_to_schema: Mapeo de la salida R al esquema estándar AnalysisResult.
    """

    analysis_type: str = "base"
    title: str = "Análisis Estadístico"
    required_packages: List[str] = ["jsonlite"]

    @staticmethod
    def _generate_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def _current_iso_time() -> str:
        return datetime.utcnow().isoformat() + "Z"

    @staticmethod
    def sanitize_r_name(name: str) -> str:
        """Sanitiza nombres de columnas para que sean válidos en fórmulas R."""
        if not isinstance(name, str) or not name:
            return "_var"
        base = re.sub(r'[^a-zA-Z0-9_.]', '_', name)
        if base and base[0].isdigit():
            base = "X" + base
        return base

    @abstractmethod
    def validate_data(self, df: pd.DataFrame, params: dict) -> Tuple[pd.DataFrame, List[AnalysisWarning]]:
        """
        Valida que el DataFrame contenga las variables necesarias y suficientes observaciones.
        Retorna (dataframe_filtrado, lista_warnings).
        """
        pass

    @abstractmethod
    def generate_r_script(self, data_path: str, params: dict, col_map: Dict[str, str]) -> str:
        """
        Genera el script R que producirá la estructura de datos JSON por stdout.
        """
        pass

    @abstractmethod
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
        """
        Transforma el diccionario crudo retornado por R en el DTO maestro AnalysisResult.
        """
        pass

    def run(self, df: pd.DataFrame, params: dict) -> AnalysisResult:
        """
        Pipeline orquestador principal:
        DATOS -> VALIDACIÓN -> R -> RESULTADO ESTRUCTURADO
        """
        valid_df, warnings = self.validate_data(df, params)

        # Mapeo de nombres originales a nombres seguros en R
        col_map = {col: self.sanitize_r_name(col) for col in valid_df.columns}
        inv_map = {v: k for k, v in col_map.items()}

        r_df = valid_df.rename(columns=col_map)

        temp_csv = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.csv', delete=False, encoding='utf-8-sig'
            ) as f:
                r_df.to_csv(f, index=False)
                temp_csv = f.name

            r_script = self.generate_r_script(temp_csv, params, col_map)
            raw_output, full_script = REngine.execute_script(r_script)

            return self.parse_to_schema(
                raw_r_output=raw_output,
                script_r=full_script,
                valid_df=valid_df,
                params=params,
                warnings=warnings,
                col_map=col_map,
                inv_map=inv_map
            )
        finally:
            if temp_csv and os.path.exists(temp_csv):
                try:
                    os.unlink(temp_csv)
                except Exception:
                    pass
