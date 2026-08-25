"""
r_engine.py - Motor y Pool de Ejecución R Optimizado
MedStats Studio
"""

import subprocess
import tempfile
import os
import json
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)


class REngine:
    """
    Motor de ejecución optimizado para R con aislamiento seguro,
    gestión de bibliotecas y captura estructurada JSON.
    """

    R_LIB_PATH = os.environ.get("R_LIB_PATH", "/usr/local/lib/R/library")
    TIMEOUT_SECONDS = int(os.environ.get("R_TIMEOUT_SECONDS", "60"))

    @classmethod
    def _get_header(cls) -> str:
        header = ""
        if cls.R_LIB_PATH and os.path.exists(cls.R_LIB_PATH):
            header += f'.libPaths(c("{cls.R_LIB_PATH}", .libPaths()))\n'
        header += "options(warn = -1)\n"
        return header

    @classmethod
    def execute_script(cls, script_body: str, work_dir: Optional[str] = None) -> Tuple[Dict[str, Any], str]:
        """
        Ejecuta un script R que escribe su resultado en JSON por stdout.
        Devuelve (resultado_dict, script_completo).
        """
        full_script = cls._get_header() + script_body
        script_file = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.R', delete=False, encoding='utf-8', dir=work_dir
            ) as f:
                f.write(full_script)
                script_file = f.name

            proc = subprocess.run(
                ['Rscript', script_file],
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=cls.TIMEOUT_SECONDS,
                cwd=work_dir or os.path.dirname(script_file)
            )

            if proc.returncode != 0:
                stderr_clean = [
                    line for line in proc.stderr.splitlines()
                    if not line.strip().startswith(("Loading", "Attaching", "The following", "Registered S3"))
                ]
                error_msg = "\n".join(stderr_clean).strip() or proc.stderr
                raise RuntimeError(f"Error en motor R: {error_msg}")

            # Buscar la línea JSON en la salida
            stdout_lines = proc.stdout.strip().splitlines()
            json_str = None
            for line in reversed(stdout_lines):
                line_str = line.strip()
                if (line_str.startswith("{") and line_str.endswith("}")) or (line_str.startswith("[") and line_str.endswith("]")):
                    json_str = line_str
                    break

            if not json_str:
                json_str = proc.stdout.strip()

            try:
                result_data = json.loads(json_str)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"El motor R no devolvió un JSON válido: {proc.stdout[:500]}") from exc

            return result_data, full_script

        except subprocess.TimeoutExpired:
            raise RuntimeError(f"Tiempo de ejecución de R excedido ({cls.TIMEOUT_SECONDS}s).")
        finally:
            if script_file and os.path.exists(script_file):
                try:
                    os.unlink(script_file)
                except Exception:
                    pass
