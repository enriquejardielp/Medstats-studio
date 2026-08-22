# =============================================================================
# r_bridge.py  —  MedStats Studio (v3.4)
# Puente Python → R para análisis estadístico clínico y gráficos ggplot2
# =============================================================================

import subprocess
import tempfile
import os
import pandas as pd
import json
import re
import numpy as np


class RBridge:

    R_LIB_PATH = os.environ.get("R_LIB_PATH", "/usr/local/lib/R/library")

    @staticmethod
    def _get_libpaths_header() -> str:
        if RBridge.R_LIB_PATH and os.path.exists(RBridge.R_LIB_PATH):
            return f'.libPaths(c("{RBridge.R_LIB_PATH}", .libPaths()))\n'
        return ""

    # Listas cerradas para parámetros que se insertan en el script R fuera de
    # comillas (theme) o dentro de comillas sin escapar (palette).
    VALID_THEMES = {
        "gray", "grey", "bw", "linedraw", "light", "dark",
        "minimal", "classic", "void", "test"
    }
    VALID_PALETTES = {
        "Accent", "Dark2", "Paired", "Pastel1", "Pastel2", "Set1", "Set2", "Set3",
        "Blues", "BuGn", "BuPu", "GnBu", "Greens", "Greys", "Oranges", "OrRd",
        "PuBu", "PuBuGn", "PuRd", "Purples", "RdPu", "Reds", "YlGn", "YlGnBu",
        "YlOrBr", "YlOrRd",
        "BrBG", "PiYG", "PRGn", "PuOr", "RdBu", "RdGy", "RdYlBu", "RdYlGn", "Spectral",
    }

    # =========================================================================
    # AUXILIARES PRIVADOS
    # =========================================================================

    @staticmethod
    def _sanitize(name: str, existing_names=None) -> str:
        if not isinstance(name, str) or not name:
            return "_col"
        base = re.sub(r'[^a-zA-Z0-9_.]', '_', name)
        if base and base[0].isdigit():
            base = "X" + base
        if existing_names is None:
            return base
        if base not in existing_names:
            return base
        counter = 1
        while f"{base}_{counter}" in existing_names:
            counter += 1
        return f"{base}_{counter}"

    @staticmethod
    def _escape_r_string(s: str) -> str:
        if not isinstance(s, str):
            s = str(s)
        return s.replace("\\", "\\\\").replace('"', '\\"')

    @staticmethod
    def _validate_numeric(value, name: str):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(
                f"'{name}' debe ser numérico (recibido: {type(value).__name__})"
            )
        return value

    @staticmethod
    def _validate_theme(theme: str) -> str:
        if theme not in RBridge.VALID_THEMES:
            raise ValueError(
                f"theme='{theme}' no está en la lista permitida: "
                f"{sorted(RBridge.VALID_THEMES)}"
            )
        return theme

    @staticmethod
    def _validate_palette(palette: str) -> str:
        if palette not in RBridge.VALID_PALETTES:
            raise ValueError(
                f"palette='{palette}' no está en la lista permitida de RColorBrewer."
            )
        return palette

    @staticmethod
    def _run_script(script_content: str) -> dict:
        full_script = (
            f"{RBridge._get_libpaths_header()}"
            f"options(warn = -1)\n"
            f"{script_content}"
        )
        script_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.R', delete=False, encoding='utf-8'
            ) as f:
                f.write(full_script)
                script_path = f.name

            result = subprocess.run(
                ['Rscript', script_path],
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=120,
            )

            if result.returncode != 0:
                stderr_lines = [
                    l for l in result.stderr.splitlines()
                    if not l.strip().startswith(("Loading", "Attaching", "The following"))
                ]
                raise RuntimeError("Error en R:\n" + "\n".join(stderr_lines))

            lines = result.stdout.strip().splitlines()
            json_line = None
            for line in reversed(lines):
                line = line.strip()
                if line.startswith('{') or line.startswith('['):
                    try:
                        json.loads(line)
                        json_line = line
                        break
                    except json.JSONDecodeError:
                        continue

            if not json_line:
                raise RuntimeError(
                    f"No se recibió salida JSON de R.\nSTDOUT:\n{result.stdout}"
                )

            return {
                "result": json.loads(json_line),
                "script": full_script
            }

        except subprocess.TimeoutExpired:
            raise RuntimeError("El proceso R superó el tiempo límite (120 s).")
        finally:
            if script_path and os.path.exists(script_path):
                os.unlink(script_path)

    @staticmethod
    def _write_temp_csv(data) -> str:
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.csv', delete=False, encoding='utf-8'
            ) as f:
                temp_path = f.name

            if isinstance(data, pd.Series):
                data.dropna().to_csv(temp_path, index=False, header=False)
            else:
                data.to_csv(temp_path, index=False)

            return temp_path

        except Exception:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            raise

    @staticmethod
    def _validate_series(s, name: str, min_n: int = 3) -> pd.Series:
        if not isinstance(s, pd.Series):
            raise TypeError(f"'{name}' debe ser un pd.Series")
        clean = s.dropna()
        if len(clean) < min_n:
            raise ValueError(
                f"'{name}' necesita al menos {min_n} observaciones válidas "
                f"(tiene {len(clean)})"
            )
        return clean

    @staticmethod
    def _validate_paired(g1: pd.Series, g2: pd.Series) -> None:
        n1 = g1.dropna().shape[0]
        n2 = g2.dropna().shape[0]
        if n1 != n2:
            raise ValueError(
                f"Para muestras pareadas ambos grupos deben tener el mismo "
                f"número de observaciones (group1={n1}, group2={n2})"
            )

    @staticmethod
    def _cleanup(*paths) -> None:
        for p in paths:
            if p and os.path.exists(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass

    @staticmethod
    def _to_native(obj):
        """Convierte recursivamente numpy int/float y DataFrames a tipos nativos Python."""
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, pd.DataFrame):
            # Convertir DataFrame a lista de diccionarios con tipos nativos
            return [RBridge._to_native(dict(row)) for _, row in obj.iterrows()]
        elif isinstance(obj, pd.Series):
            return RBridge._to_native(obj.to_list())
        elif isinstance(obj, (list, tuple)):
            return [RBridge._to_native(v) for v in obj]
        elif isinstance(obj, dict):
            return {k: RBridge._to_native(v) for k, v in obj.items()}
        return obj

    # =========================================================================
    # ESTADÍSTICA DESCRIPTIVA
    # =========================================================================

    @staticmethod
    def shapiro_test(series: pd.Series) -> dict:
        RBridge._validate_series(series, 'series', min_n=3)
        n = series.dropna().shape[0]
        if n > 5000:
            raise ValueError(
                f"Shapiro-Wilk no es aplicable con n={n} (máximo 5000). "
                "Usa inspección visual (Q-Q plot) o el test de Kolmogorov-Smirnov."
            )
        data_path = RBridge._write_temp_csv(series)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', header=FALSE, check.names=FALSE)$V1
        res   <- shapiro.test(datos)
        result <- list(
            estadistico       = as.numeric(res$statistic),
            p_valor         = as.numeric(res$p.value),
            normal          = res$p.value > 0.05,
            n               = as.integer(length(datos)),
            interpretacion  = if (length(datos) > 50)
                "Con n > 50, p significativa puede reflejar desviaciones triviales. Ver Q-Q plot."
                else if (length(datos) < 10)
                "Con n < 10, el test tiene bajo poder para detectar no-normalidad."
                else "Rango óptimo para Shapiro-Wilk."
        )
        cat(toJSON(result, auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def ks_one_sample(series: pd.Series, dist: str = "pnorm", mean=None, sd=None) -> dict:
        RBridge._validate_series(series, 'series', min_n=3)
        data_path = RBridge._write_temp_csv(series)

        if mean is not None:
            RBridge._validate_numeric(mean, 'mean')
        if sd is not None:
            RBridge._validate_numeric(sd, 'sd')
        mean_str = "NULL" if mean is None else mean
        sd_str = "NULL" if sd is None else sd

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', header=FALSE, check.names=FALSE)$V1
        n <- length(datos)
        if (is.null({mean_str})) {{
            mu <- mean(datos)
        }} else {{
            mu <- {mean_str}
        }}
        if (is.null({sd_str})) {{
            sigma <- sd(datos)
        }} else {{
            sigma <- {sd_str}
        }}
        test <- ks.test(datos, "pnorm", mean = mu, sd = sigma)
        result <- list(
            estadistico = as.numeric(test$statistic),
            p_valor     = as.numeric(test$p.value),
            distribucion = "Normal",
            media_estimada = mu,
            sd_estimada    = sigma,
            n              = n
        )
        cat(toJSON(result, auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def levene_test(df: pd.DataFrame, dep_var: str, group_var: str) -> dict:
        safe_dep   = RBridge._sanitize(dep_var)
        safe_group = RBridge._sanitize(group_var)
        subset = df[[dep_var, group_var]].rename(
            columns={dep_var: safe_dep, group_var: safe_group}
        )
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        library(car)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        dep   <- datos[['{safe_dep}']]
        group <- as.factor(datos[['{safe_group}']])
        valid <- complete.cases(dep, group)
        dep   <- dep[valid]
        group <- group[valid]
        lt    <- leveneTest(dep ~ group)
        result <- list(
            estadistico = as.numeric(lt$"F value"[1]),
            p_valor     = as.numeric(lt$"Pr(>F)"[1]),
            gl_numerador = as.integer(lt$Df[1]),
            gl_denominador = as.integer(lt$Df[2])
        )
        cat(toJSON(result, auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def chisq_goodness_of_fit(df: pd.DataFrame, var: str, p_null: list = None) -> dict:
        safe_var = RBridge._sanitize(var)
        subset = df[[var]].rename(columns={var: safe_var})
        data_path = RBridge._write_temp_csv(subset)

        p_str = "NULL"
        if p_null is not None:
            if not all(isinstance(x, (int, float)) for x in p_null):
                raise ValueError("p_null debe ser una lista de números.")
            if abs(sum(p_null) - 1.0) > 1e-6:
                raise ValueError("Los elementos de p_null deben sumar 1.")
            p_str = f"c({', '.join(map(str, p_null))})"

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        x     <- as.factor(datos[['{safe_var}']])
        x     <- x[complete.cases(x)]
        if (is.null({p_str})) {{
            p_expected <- rep(1/length(levels(x)), length(levels(x)))
        }} else {{
            p_expected <- {p_str}
            if (length(p_expected) != length(levels(x))) {{
                stop("La longitud de p_null debe coincidir con el número de categorías.")
            }}
        }}
        test <- chisq.test(table(x), p = p_expected)
        result <- list(
            estadistico = as.numeric(test$statistic),
            p_valor     = as.numeric(test$p.value),
            gl          = as.integer(test$parameter),
            metodo      = test$method
        )
        cat(toJSON(result, auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def binomial_test(successes: int, trials: int, p_null: float = 0.5, alternative: str = "two.sided") -> dict:
        if not isinstance(successes, int) or not isinstance(trials, int):
            raise TypeError("successes y trials deben ser enteros.")
        if successes < 0 or trials <= 0 or successes > trials:
            raise ValueError("successes debe estar entre 0 y trials.")
        if alternative not in ("two.sided", "less", "greater"):
            raise ValueError("alternative debe ser 'two.sided', 'less' o 'greater'.")
        RBridge._validate_numeric(p_null, 'p_null')
        if not (0 <= p_null <= 1):
            raise ValueError("p_null debe estar entre 0 y 1.")

        script = f"""
        library(jsonlite)
        test <- binom.test({successes}, {trials}, p = {p_null}, alternative = "{alternative}")
        result <- list(
            estadistico = as.integer(successes),
            p_valor     = as.numeric(test$p.value),
            proporcion_estimada = as.numeric(test$estimate),
            ic_inferior = as.numeric(test$conf.int[1]),
            ic_superior = as.numeric(test$conf.int[2]),
            metodo      = test$method
        )
        cat(toJSON(result, auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        except Exception as e:
            raise RuntimeError(f"Error en test binomial: {e}")

    @staticmethod
    def table1(df: pd.DataFrame, variables: list, group_var: str = None, decimals: int = 2) -> dict:
        safe_vars = [RBridge._sanitize(v) for v in variables]
        rename_map = {orig: safe for orig, safe in zip(variables, safe_vars)}
        if group_var:
            safe_group = RBridge._sanitize(group_var)
            rename_map[group_var] = safe_group
        subset = df[variables + ([group_var] if group_var else [])].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        group_code = f", strata = {safe_group}" if group_var else ""
        script = f"""
        library(table1)
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        vars <- c({','.join([f"'{v}'" for v in safe_vars])})
        if ({'TRUE' if group_var else 'FALSE'}) {{
            tabla <- table1(~ . | get('{safe_group}'), data = datos, overall = TRUE)
        }} else {{
            tabla <- table1(~ ., data = datos)
        }}
        tabla_df <- as.data.frame(tabla)
        cat(toJSON(list(table = tabla_df), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            table_df = pd.DataFrame(res["result"]["table"])
            return {
                "table": table_df,
                "script_r": res["script"]
            }
        except Exception as e:
            raise RuntimeError(f"Error en Table 1: {e}")
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # DESCRIPTIVOS
    # =========================================================================

    @staticmethod
    def descriptive_stats(df: pd.DataFrame, columns: list) -> dict:
        # Validar que todas las columnas existen
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise ValueError(f"Columnas no encontradas en el dataset: {', '.join(missing)}")
        
        safe_cols = [RBridge._sanitize(c) for c in columns]
        rename_map = {orig: safe for orig, safe in zip(columns, safe_cols)}
        subset = df[columns].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE)
        num_cols <- names(datos)[sapply(datos, is.numeric)]
        cat_cols <- names(datos)[sapply(datos, function(x) is.factor(x) || is.character(x))]

        num_summary <- list()
        if (length(num_cols) > 0) {{
            for (col in num_cols) {{
                x <- datos[[col]]
                num_summary[[col]] <- list(
                    n = length(x),
                    mean = mean(x, na.rm = TRUE),
                    median = median(x, na.rm = TRUE),
                    sd = sd(x, na.rm = TRUE),
                    min = min(x, na.rm = TRUE),
                    max = max(x, na.rm = TRUE),
                    q1 = as.numeric(quantile(x, 0.25, na.rm = TRUE)),
                    q3 = as.numeric(quantile(x, 0.75, na.rm = TRUE))
                )
            }}
        }}

        cat_summary <- list()
        if (length(cat_cols) > 0) {{
            for (col in cat_cols) {{
                freq_table <- as.data.frame(table(datos[[col]]))
                names(freq_table) <- c("value", "count")
                cat_summary[[col]] <- freq_table
            }}
        }}

        result <- list(
            numeric = num_summary,
            categorical = cat_summary
        )
        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # COMPARACIÓN DE DOS GRUPOS
    # =========================================================================

    @staticmethod
    def compare_two_groups(
        group1: pd.Series,
        group2: pd.Series,
        paired: bool = False,
        method: str = "welch",
        conf_level: float = 0.95
    ) -> dict:
        RBridge._validate_series(group1, 'group1')
        RBridge._validate_series(group2, 'group2')
        if paired:
            RBridge._validate_paired(group1, group2)

        if method not in ("welch", "mannwhitney", "auto"):
            raise ValueError(
                f"method='{method}' no válido. Usa 'welch', 'mannwhitney' o 'auto'."
            )

        path1 = RBridge._write_temp_csv(group1)
        path2 = RBridge._write_temp_csv(group2)
        r_paired = 'TRUE' if paired else 'FALSE'
        r_method = method
        r_conf   = conf_level

        script = f"""
        library(jsonlite)

        g1     <- read.csv('{path1}', header=FALSE, check.names=FALSE)$V1
        g2     <- read.csv('{path2}', header=FALSE, check.names=FALSE)$V1
        n1     <- length(g1)
        n2     <- length(g2)
        paired <- {r_paired}
        method <- "{r_method}"
        conf_l <- {r_conf}

        sw_p1 <- tryCatch(
            if (n1 >= 3 && n1 <= 5000) shapiro.test(g1)$p.value else NA_real_,
            error = function(e) NA_real_
        )
        sw_p2 <- tryCatch(
            if (n2 >= 3 && n2 <= 5000) shapiro.test(g2)$p.value else NA_real_,
            error = function(e) NA_real_
        )
        ratio_var <- if (var(g2) > 0) var(g1) / var(g2) else NA_real_

        aviso_shapiro <- ""
        if (!is.na(sw_p1) && (n1 > 50 || n2 > 50)) {{
            aviso_shapiro <- "Con n > 50, Shapiro-Wilk puede ser engañoso. Ver Q-Q plot."
        }}

        if (method == "auto") {{
            if (paired) {{
                diffs  <- g1 - g2
                normal <- if (length(diffs) > 30) TRUE else
                          tryCatch(shapiro.test(diffs)$p.value > 0.05, error = function(e) TRUE)
            }} else {{
                normal <- if (n1 > 30 && n2 > 30) TRUE else
                          tryCatch(
                              (shapiro.test(g1)$p.value > 0.05 && shapiro.test(g2)$p.value > 0.05),
                              error = function(e) TRUE
                          )
            }}
            usar_parametrico <- normal
            aviso_auto <- paste(
                "Modo 'auto': test elegido por Shapiro-Wilk / regla n>30.",
                "Se recomienda que el usuario elija el test explícitamente."
            )
        }} else {{
            usar_parametrico <- (method == "welch")
            aviso_auto       <- ""
        }}

        if (usar_parametrico) {{
            test   <- t.test(g1, g2, var.equal = FALSE, paired = paired, conf.level = conf_l)
            metodo <- if (paired) "t-test pareado" else "t-test de Welch"
            if (paired) {{
                diffs   <- g1 - g2
                cohen_d <- mean(diffs) / sd(diffs)
            }} else {{
                pooled_sd <- sqrt(((n1-1)*var(g1) + (n2-1)*var(g2)) / (n1+n2-2))
                cohen_d   <- if (pooled_sd > 0) (mean(g1)-mean(g2)) / pooled_sd else NA_real_
            }}
            effect_size       <- cohen_d
            effect_size_label <- "Cohen's d"
            conf_int          <- as.vector(test$conf.int)

        }} else {{
            test   <- tryCatch(
                wilcox.test(g1, g2, paired = paired, exact = FALSE, conf.int = TRUE, conf.level = conf_l),
                error = function(e) wilcox.test(g1, g2, paired = paired, exact = FALSE)
            )
            metodo <- if (paired) "Wilcoxon signed-rank" else "Mann-Whitney U"
            if (!paired) {{
                U     <- as.numeric(test$statistic)
                r_val <- 1 - (2 * U) / (n1 * n2)
            }} else {{
                Z_approx <- qnorm(test$p.value / 2)
                r_val    <- abs(Z_approx) / sqrt(n1)
            }}
            effect_size       <- r_val
            effect_size_label <- "r (rank-biserial)"
            conf_int          <- if (!is.null(test$conf.int)) as.vector(test$conf.int) else NA
        }}

        sens_p <- tryCatch({{
            if (usar_parametrico) {{
                wilcox.test(g1, g2, paired = paired, exact = FALSE)$p.value
            }} else {{
                t.test(g1, g2, var.equal = FALSE, paired = paired)$p.value
            }}
        }}, error = function(e) NA_real_)

        coinciden <- if (!is.na(sens_p)) {{
            (test$p.value < 0.05) == (sens_p < 0.05)
        }} else NA

        nota_consistencia <- if (is.na(coinciden)) {{
            "No se pudo calcular el test alternativo."
        }} else if (coinciden) {{
            "Ambos tests coinciden en la conclusión. Resultado robusto."
        }} else {{
            "Atención: los tests paramétrico y no paramétrico difieren en significación. Revisar distribución y outliers."
        }}

        result <- list(
            metodo            = metodo,
            estadistico       = as.numeric(test$statistic),
            p_valor           = as.numeric(test$p.value),
            media_g1          = as.numeric(mean(g1)),
            media_g2          = as.numeric(mean(g2)),
            n_g1              = as.integer(n1),
            n_g2              = as.integer(n2),
            effect_size       = as.numeric(effect_size),
            effect_size_label = effect_size_label,
            diagnosticos = list(
                shapiro_p_g1      = ifelse(is.na(sw_p1), NA, as.numeric(sw_p1)),
                shapiro_p_g2      = ifelse(is.na(sw_p2), NA, as.numeric(sw_p2)),
                ratio_varianzas   = ifelse(is.na(ratio_var), NA, as.numeric(ratio_var)),
                aviso_shapiro     = aviso_shapiro,
                aviso_auto        = aviso_auto,
                sens_p_alternativo = ifelse(is.na(sens_p), NA, as.numeric(sens_p)),
                nota_consistencia = nota_consistencia
            )
        )

        if (!all(is.na(conf_int))) {{
            result$ic_inferior <- conf_int[1]
            result$ic_superior <- conf_int[2]
        }}

        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """

        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(path1, path2)

    # =========================================================================
    # ANOVA / KRUSKAL-WALLIS / FRIEDMAN
    # =========================================================================

    @staticmethod
    def anova(
        df: pd.DataFrame,
        dep_var: str,
        group_var: str,
        subject_var: str = None,
        repeated: bool = False,
        method: str = "auto"
    ) -> dict:
        safe_dep     = RBridge._sanitize(dep_var)
        safe_group   = RBridge._sanitize(group_var)
        safe_subject = None if subject_var is None else RBridge._sanitize(subject_var)

        if repeated and subject_var is None:
            raise ValueError("Para medidas repetidas debes indicar 'subject_var'.")
        if method not in ("parametric", "nonparametric", "auto"):
            raise ValueError(
                f"method='{method}' no válido. Usa 'parametric', 'nonparametric' o 'auto'."
            )

        cols       = [dep_var, group_var]
        rename_map = {dep_var: safe_dep, group_var: safe_group}
        if subject_var:
            cols.append(subject_var)
            rename_map[subject_var] = safe_subject

        subset    = df[cols].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        r_subject = f"'{safe_subject}'" if safe_subject else 'NULL'
        r_method  = method

        script = f"""
        library(jsonlite)
        library(car)

        datos    <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        dep      <- datos[['{safe_dep}']]
        group    <- datos[['{safe_group}']]
        subject  <- if (!is.null({r_subject})) datos[[{r_subject}]] else NULL
        repeated <- {'TRUE' if repeated else 'FALSE'}
        method   <- "{r_method}"

        valid   <- complete.cases(dep, group)
        dep     <- dep[valid]
        group   <- as.factor(group[valid])
        if (!is.null(subject)) subject <- as.factor(subject[valid])
        n_total <- length(dep)

        if (length(levels(group)) < 2) stop("La variable grupo necesita ≥ 2 niveles.")

        resid_lm  <- tryCatch(residuals(lm(dep ~ group)), error = function(e) NULL)
        shapiro_p <- if (!is.null(resid_lm) && length(resid_lm) >= 3 && length(resid_lm) <= 5000) tryCatch(shapiro.test(resid_lm)$p.value, error = function(e) NA_real_) else NA_real_

        if (repeated) {{

            if (method == "nonparametric") {{
                mat  <- matrix(dep, ncol = length(levels(group)), byrow = TRUE)
                test <- friedman.test(mat)
                p_val     <- test$p.value
                statistic <- test$statistic
                metodo    <- "Friedman (no paramétrico)"
                k  <- length(levels(group))
                n  <- nrow(mat)
                W  <- statistic / (k * (n - 1))
                result <- list(
                    p_valor    = as.numeric(p_val),
                    estadistico = as.numeric(statistic),
                    metodo     = metodo,
                    effect_size = as.numeric(W),
                    effect_label = "W de Kendall",
                    shapiro_residuos_p = ifelse(is.na(shapiro_p), NA, as.numeric(shapiro_p)),
                    posthoc_nota = if (p_val < 0.05) "Dunn post-hoc para Friedman (paquete 'rstatix')" else NA
                )

            }} else {{
                datos_rm <- data.frame(dep = dep, group = group, subject = subject)
                fit_rm   <- aov(dep ~ group + Error(subject/group), data = datos_rm)
                s        <- summary(fit_rm)
                inner    <- s[["Error: subject:group"]][[1]]
                p_val     <- inner["Pr(>F)"][[1]][1]
                f_val     <- inner["F value"][[1]][1]

                mauchly_p  <- NA_real_
                correction <- "ninguna"
                if (length(levels(group)) > 2) {{
                    tryCatch({{
                        ml <- mauchly.test(lm(dep ~ group + subject), X = ~1)
                        mauchly_p <- ml$p.value
                        if (!is.na(mauchly_p) && mauchly_p < 0.05) {{
                            correction <- "Greenhouse-Geisser aplicado"
                        }}
                    }}, error = function(e) NULL)
                }}

                result <- list(
                    p_valor     = as.numeric(p_val),
                    estadistico = as.numeric(f_val),
                    metodo      = "ANOVA de medidas repetidas",
                    mauchly_p   = ifelse(is.na(mauchly_p), NA, as.numeric(mauchly_p)),
                    correccion_esfericidad = correction,
                    shapiro_residuos_p = ifelse(is.na(shapiro_p), NA, as.numeric(shapiro_p)),
                    posthoc_nota = if (p_val < 0.05) "Bonferroni o Holm recomendado para comparaciones post-hoc pareadas" else NA
                )
            }}

        }} else {{

            usar_parametrico <- ifelse(method == "nonparametric", FALSE,
                                       ifelse(method == "parametric", TRUE,
                                              ifelse(!is.na(shapiro_p) && shapiro_p < 0.05, FALSE, TRUE)))

            aviso_auto <- ifelse(method == "auto",
                                 "Modo 'auto': test elegido por Shapiro-Wilk de residuos. Considera elegir explícitamente.",
                                 "")

            if (!usar_parametrico) {{
                ktest     <- kruskal.test(dep ~ group)
                p_val     <- ktest$p.value
                statistic <- ktest$statistic
                k    <- length(levels(group))
                eps2 <- (statistic - k + 1) / (n_total - k)
                eps2 <- max(0, eps2)

                dunn_nota <- "paquete 'dunn.test' o 'FSA' recomendado para post-hoc de Kruskal"
                dunn_df   <- NULL
                tryCatch({{
                    if (requireNamespace("dunn.test", quietly=TRUE)) {{
                        library(dunn.test)
                        dt  <- dunn.test(dep, group, method="holm", alpha=0.05, label=FALSE)
                        dunn_df <- data.frame(
                            comparacion = dt$comparisons,
                            Z           = dt$Z,
                            p_ajustado  = dt$P.adjusted
                        )
                        dunn_nota <- "Post-hoc Dunn con corrección Holm calculado."
                    }}
                }}, error = function(e) NULL)

                result <- list(
                    p_valor      = as.numeric(p_val),
                    estadistico  = as.numeric(statistic),
                    metodo       = "Kruskal-Wallis",
                    effect_size  = as.numeric(eps2),
                    effect_label = "epsilon² (Kruskal-Wallis)",
                    shapiro_residuos_p = ifelse(is.na(shapiro_p), NA, as.numeric(shapiro_p)),
                    aviso_auto   = aviso_auto,
                    posthoc_nota = dunn_nota
                )
                if (!is.null(dunn_df)) result$dunn <- dunn_df

            }} else {{

                levene_p  <- tryCatch(
                    leveneTest(dep ~ group)$"Pr(>F)"[1],
                    error = function(e) NA_real_
                )
                heteroced <- !is.na(levene_p) && levene_p < 0.05

                if (heteroced) {{
                    wfit      <- oneway.test(dep ~ group, var.equal = FALSE)
                    p_val     <- wfit$p.value
                    statistic <- wfit$statistic
                    metodo    <- "Welch ANOVA (varianzas desiguales)"
                    k      <- length(levels(group))
                    eta2   <- (statistic * (k-1)) / (statistic * (k-1) + (n_total - k))
                    posthoc_nota <- "Games-Howell recomendado (varianzas desiguales)"
                    tukey_df <- NULL
                }} else {{
                    fit     <- aov(dep ~ group)
                    s_fit   <- summary(fit)
                    p_val   <- s_fit[[1]]["Pr(>F)"][[1]][1]
                    statistic <- s_fit[[1]]["F value"][[1]][1]
                    metodo  <- "ANOVA de un factor"
                    k       <- length(levels(group))
                    eta2    <- (statistic * (k-1)) / (statistic * (k-1) + (n_total - k))
                    posthoc_nota <- if (p_val < 0.05) "Tukey HSD calculado" else NA

                    tukey_df <- NULL
                    if (!is.na(p_val) && p_val < 0.05) {{
                        tukey    <- TukeyHSD(fit)
                        tukey_df <- as.data.frame(tukey$group)
                        tukey_df$comparacion <- rownames(tukey_df)
                    }}
                }}

                result <- list(
                    p_valor     = ifelse(is.na(p_val),    NA, as.numeric(p_val)),
                    estadistico = ifelse(is.na(statistic), NA, as.numeric(statistic)),
                    metodo      = metodo,
                    effect_size  = ifelse(is.na(eta2), NA, as.numeric(eta2)),
                    effect_label = "eta²",
                    shapiro_residuos_p = ifelse(is.na(shapiro_p), NA, as.numeric(shapiro_p)),
                    levene_p    = ifelse(is.na(levene_p), NA, as.numeric(levene_p)),
                    heterocedasticidad = heteroced,
                    aviso_auto  = aviso_auto,
                    posthoc_nota = posthoc_nota
                )
                if (!is.null(tukey_df)) result$tukey <- tukey_df
            }}
        }}

        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """

        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            if ret.get("tukey") is not None:
                ret["tukey"] = pd.DataFrame(ret["tukey"])
            if ret.get("dunn") is not None:
                ret["dunn"] = pd.DataFrame(ret["dunn"])
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # CORRELACIÓN
    # =========================================================================

    @staticmethod
    def correlation(
        series1: pd.Series,
        series2: pd.Series,
        method: str = "auto",
        conf_level: float = 0.95
    ) -> dict:
        RBridge._validate_series(series1, 'series1')
        RBridge._validate_series(series2, 'series2')
        if method not in ("pearson", "spearman", "auto"):
            raise ValueError(
                f"method='{method}' no válido. Usa 'pearson', 'spearman' o 'auto'."
            )

        path1 = RBridge._write_temp_csv(series1)
        path2 = RBridge._write_temp_csv(series2)
        r_conf = conf_level

        script = f"""
        library(jsonlite)

        s1 <- read.csv('{path1}', header=FALSE, check.names=FALSE)$V1
        s2 <- read.csv('{path2}', header=FALSE, check.names=FALSE)$V1

        n_min  <- min(length(s1), length(s2))
        s1     <- s1[1:n_min]
        s2     <- s2[1:n_min]
        valid  <- complete.cases(s1, s2)
        s1     <- s1[valid]
        s2     <- s2[valid]
        n      <- length(s1)
        method <- "{method}"
        conf_l <- {r_conf}

        sw_p1 <- tryCatch(if (n>=3 && n<=5000) shapiro.test(s1)$p.value else NA, error=function(e) NA)
        sw_p2 <- tryCatch(if (n>=3 && n<=5000) shapiro.test(s2)$p.value else NA, error=function(e) NA)

        usar_pearson <- if (method == "pearson") {{
            TRUE
        }} else if (method == "spearman") {{
            FALSE
        }} else {{
            if (n > 30) TRUE else (!is.na(sw_p1) && sw_p1 > 0.05 && !is.na(sw_p2) && sw_p2 > 0.05)
        }}

        aviso_auto <- if (method == "auto") "Modo 'auto': método elegido por Shapiro-Wilk. Considera elegir explícitamente." else ""

        if (usar_pearson) {{
            test   <- cor.test(s1, s2, method = "pearson", conf.level = conf_l)
            metodo <- "Pearson"
            ci     <- as.vector(test$conf.int)
        }} else {{
            test   <- cor.test(s1, s2, method = "spearman", exact = FALSE)
            metodo <- "Spearman"
            r      <- as.numeric(test$estimate)
            z      <- 0.5 * log((1 + r) / (1 - r))
            se     <- 1 / sqrt(n - 3)
            z_crit <- qnorm((1 + conf_l) / 2)
            ci     <- tanh(c(z - z_crit * se, z + z_crit * se))
        }}

        result <- list(
            metodo     = metodo,
            r          = as.numeric(test$estimate),
            p_valor    = as.numeric(test$p.value),
            n          = as.integer(n),
            ic_inferior = as.numeric(ci[1]),
            ic_superior = as.numeric(ci[2]),
            diagnosticos = list(
                shapiro_p_s1 = ifelse(is.na(sw_p1), NA, as.numeric(sw_p1)),
                shapiro_p_s2 = ifelse(is.na(sw_p2), NA, as.numeric(sw_p2)),
                aviso_auto   = aviso_auto
            )
        )

        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """

        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(path1, path2)

    # =========================================================================
    # REGRESIÓN LINEAL
    # =========================================================================

    @staticmethod
    def linear_regression(df: pd.DataFrame, dep_var: str, indep_vars: list) -> dict:
        safe_dep   = RBridge._sanitize(dep_var)
        safe_indep = [RBridge._sanitize(v) for v in indep_vars]
        rename_map = {dep_var: safe_dep}
        for orig, safe in zip(indep_vars, safe_indep):
            rename_map[orig] = safe
        subset    = df[[dep_var] + indep_vars].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        indep_r   = ', '.join([f"'{v}'" for v in safe_indep])

        script = f"""
        library(jsonlite)
        library(car)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        formula_reg <- as.formula(paste0('{safe_dep} ~ .'))
        fit   <- lm(formula_reg, data = datos)
        s     <- summary(fit)
        coef  <- coef(s)
        ci    <- confint(fit)

        resids    <- residuals(fit)
        n_resids  <- length(resids)
        sw_p      <- tryCatch(
            if (n_resids >= 3 && n_resids <= 5000) shapiro.test(resids)$p.value else NA,
            error = function(e) NA
        )
        dw        <- tryCatch(as.numeric(durbinWatsonTest(fit)$dw), error = function(e) NA)
        vif_vals  <- if (length(c({indep_r})) > 1) tryCatch(vif(fit), error = function(e) NULL) else NULL

        result <- list(
            coeficientes = data.frame(
                variable   = rownames(coef),
                estimacion = coef[,1],
                error_std  = coef[,2],
                t_valor    = coef[,3],
                p_valor    = coef[,4],
                ic_inferior = ci[,1],
                ic_superior = ci[,2]
            ),
            r_cuadrado     = as.numeric(s$r.squared),
            r_cuadrado_adj = as.numeric(s$adj.r.squared),
            f_estadistico  = as.numeric(s$fstatistic[1]),
            p_valor_f      = as.numeric(pf(s$fstatistic[1], s$fstatistic[2], s$fstatistic[3], lower.tail=FALSE)),
            diagnosticos = list(
                shapiro_residuos_p = ifelse(is.na(sw_p), NA, as.numeric(sw_p)),
                durbin_watson      = ifelse(is.na(dw), NA, as.numeric(dw)),
                vif = if (!is.null(vif_vals)) as.list(vif_vals) else NA
            )
        )

        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # REGRESIÓN LOGÍSTICA
    # =========================================================================

    @staticmethod
    def logistic_regression(df: pd.DataFrame, dep_var: str, indep_vars: list) -> dict:
        if dep_var not in df.columns:
            raise ValueError(f"La variable dependiente '{dep_var}' no existe en el DataFrame.")
        if not indep_vars:
            raise ValueError("Se requieren variables independientes para la regresión logística.")
        missing = [v for v in indep_vars if v not in df.columns]
        if missing:
            raise ValueError(f"Variables independientes faltantes: {missing}")

        target = df[dep_var].dropna()
        if target.empty:
            raise ValueError("La variable dependiente no tiene valores válidos.")

        unique_values = sorted(set(target.astype(str).str.strip().unique()))
        if len(unique_values) != 2:
            raise ValueError(
                "La variable dependiente debe ser binaria (exactamente 2 categorías) para regresión logística."
            )

        safe_dep   = RBridge._sanitize(dep_var)
        safe_indep = [RBridge._sanitize(v) for v in indep_vars]
        rename_map = {dep_var: safe_dep}
        for orig, safe in zip(indep_vars, safe_indep):
            rename_map[orig] = safe
        subset    = df[[dep_var] + indep_vars].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        indep_r   = ', '.join([f"'{v}'" for v in safe_indep])

        script = f"""
        library(jsonlite)
        library(car)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        formula_reg <- as.formula(paste0('{safe_dep} ~ .'))
        fit   <- glm(formula_reg, data = datos, family = binomial)
        s     <- summary(fit)
        coef  <- coef(s)
        ci    <- confint(fit)
        or    <- exp(coef[,1])

        ll_null  <- fit$null.deviance / -2
        ll_model <- fit$deviance / -2
        n        <- nobs(fit)
        cox_r2   <- 1 - exp(2 * (ll_null - ll_model) / n)
        nagelkerke_r2 <- cox_r2 / (1 - exp(2 * ll_null / n))

        hl_p <- tryCatch({{
            probs  <- fitted(fit)
            obs    <- dep[complete.cases(dep)]
            grupos <- cut(probs, breaks = quantile(probs, probs = seq(0, 1, by = 0.1)), include.lowest = TRUE)
            obs_e  <- tapply(obs, grupos, sum)
            exp_e  <- tapply(probs, grupos, sum)
            chi_hl <- sum((obs_e - exp_e)^2 / exp_e)
            pchisq(chi_hl, df = 8, lower.tail = FALSE)
        }}, error = function(e) NA_real_)

        vif_vals <- if (length(c({indep_r})) > 1) tryCatch(vif(fit), error=function(e) NULL) else NULL

        result <- list(
            coeficientes = data.frame(
                variable    = rownames(coef),
                estimacion  = coef[,1],
                error_std   = coef[,2],
                z_valor     = coef[,3],
                p_valor     = coef[,4],
                odds_ratio  = or,
                ic_inferior = exp(ci[,1]),
                ic_superior = exp(ci[,2])
            ),
            aic                = as.numeric(AIC(fit)),
            nagelkerke_r2      = as.numeric(nagelkerke_r2),
            devianza_nula      = as.numeric(fit$null.deviance),
            devianza_residual  = as.numeric(fit$deviance),
            convergencia       = fit$converged,
            hosmer_lemeshow_p  = ifelse(is.na(hl_p), NA, as.numeric(hl_p)),
            vif = if (!is.null(vif_vals)) as.list(vif_vals) else NA
        )

        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # TEST Z (UNA MEDIA)
    # =========================================================================

    @staticmethod
    def z_test(series: pd.Series, mu: float = 0) -> dict:
        RBridge._validate_series(series, 'series')
        if not isinstance(mu, (int, float)):
            raise TypeError("'mu' debe ser numérico.")
        data_path = RBridge._write_temp_csv(series)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', header=FALSE, check.names=FALSE)$V1
        n     <- length(datos)
        media <- mean(datos)
        dt    <- sd(datos)
        z     <- (media - {mu}) / (dt / sqrt(n))
        p     <- 2 * (1 - pnorm(abs(z)))
        cat(toJSON(list(
            z_estadistico = as.numeric(z),
            p_valor       = as.numeric(p),
            media         = as.numeric(media),
            dt            = as.numeric(dt),
            n             = as.integer(n),
            mu_hipotetico = as.numeric({mu})
        ), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # FRIEDMAN TEST
    # =========================================================================

    @staticmethod
    def friedman_test(df: pd.DataFrame, columns: list) -> dict:
        safe_cols  = [RBridge._sanitize(c) for c in columns]
        rename_map = {orig: safe for orig, safe in zip(columns, safe_cols)}
        subset     = df[columns].rename(columns=rename_map)
        data_path  = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        resp  <- as.matrix(datos)
        test  <- friedman.test(resp)
        k     <- ncol(resp)
        n     <- nrow(resp)
        W     <- test$statistic / (k * (n - 1))
        cat(toJSON(list(
            estadistico  = as.numeric(test$statistic),
            p_valor      = as.numeric(test$p.value),
            gl           = as.numeric(test$parameter),
            w_kendall    = as.numeric(W),
            posthoc_nota = if (test$p.value < 0.05) "Considerar post-hoc de Nemenyi (paquete 'PMCMRplus')" else NA
        ), auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # KOLMOGOROV-SMIRNOV (DOS MUESTRAS)
    # =========================================================================

    @staticmethod
    def kolmogorov_smirnov(series1: pd.Series, series2: pd.Series) -> dict:
        RBridge._validate_series(series1, 'series1')
        RBridge._validate_series(series2, 'series2')

        path1 = RBridge._write_temp_csv(series1)
        path2 = RBridge._write_temp_csv(series2)

        script = f"""
        library(jsonlite)
        s1   <- read.csv('{path1}', header=FALSE, check.names=FALSE)$V1
        s2   <- read.csv('{path2}', header=FALSE, check.names=FALSE)$V1
        test <- ks.test(s1, s2)
        cat(toJSON(list(
            estadistico = as.numeric(test$statistic),
            p_valor     = as.numeric(test$p.value)
        ), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(path1, path2)

    # =========================================================================
    # CHI-CUADRADO (CORREGIDO)
    # =========================================================================

    @staticmethod
    def chi_square(df: pd.DataFrame, var1: str, var2: str) -> dict:
        safe1     = RBridge._sanitize(var1)
        safe2     = RBridge._sanitize(var2)
        subset    = df[[var1, var2]].rename(columns={var1: safe1, var2: safe2})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        v1    <- as.factor(datos[['{safe1}']])
        v2    <- as.factor(datos[['{safe2}']])
        valid <- complete.cases(v1, v2)
        v1    <- v1[valid]
        v2    <- v2[valid]

        if (length(levels(v1)) < 2 || length(levels(v2)) < 2) {{
            stop("La tabla necesita al menos 2 categorías en cada variable.")
        }}

        tabla      <- table(v1, v2)
        esperadas  <- chisq.test(tabla)$expected
        celdas_bajas <- any(esperadas < 5)

        if (all(dim(tabla) == c(2, 2))) {{
            test   <- fisher.test(tabla)
            metodo <- "Fisher (tabla 2×2)"
        }} else if (celdas_bajas) {{
            test   <- chisq.test(tabla, simulate.p.value = TRUE, B = 2000)
            metodo <- "Chi-cuadrado (Monte Carlo, celdas esperadas < 5)"
        }} else {{
            test   <- chisq.test(tabla)
            metodo <- "Chi-cuadrado de Pearson"
        }}

        n  <- sum(tabla)
        k  <- min(nrow(tabla), ncol(tabla))
        r  <- nrow(tabla)
        c_ <- ncol(tabla)

        chi2 <- ifelse(is.null(test$statistic), NA_real_, as.numeric(test$statistic))

        cramer <- if (!is.na(chi2) && n > 0 && k > 1) {{
            phi2   <- chi2 / n
            phi2c  <- max(0, phi2 - ((r-1)*(c_-1))/(n-1))
            rc     <- r - (r-1)^2/(n-1)
            cc     <- c_ - (c_-1)^2/(n-1)
            sqrt(phi2c / min(rc - 1, cc - 1))
        }} else NA_real_

        tabla_df <- as.data.frame(tabla)
        names(tabla_df) <- c("{safe1}", "{safe2}", "frecuencia")

        resid <- tryCatch(
            as.data.frame(round(test$stdres, 3)),
            error = function(e) NULL
        )

        cat(toJSON(list(
            p_valor      = as.numeric(test$p.value),
            estadistico  = ifelse(is.null(test$statistic), NA, as.numeric(test$statistic)),
            gl           = ifelse(is.null(test$parameter), NA, as.numeric(test$parameter)),
            metodo       = metodo,
            cramer_v     = ifelse(is.na(cramer), NA, as.numeric(cramer)),
            tabla        = tabla_df,
            residuos_std = resid
        ), auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            raw = res["result"]
            tabla = raw.get('tabla')
            residuos_std = raw.get('residuos_std')
            return {
                'p_valor':       float(raw['p_valor']) if raw.get('p_valor') is not None else None,
                'estadistico':   float(raw['estadistico']) if raw.get('estadistico') is not None else None,
                'gl':            int(raw['gl']) if raw.get('gl') is not None else None,
                'metodo':        str(raw.get('metodo', 'Chi-cuadrado')),
                'cramer_v':      float(raw.get('cramer_v')) if raw.get('cramer_v') is not None else None,
                'tabla':         RBridge._to_native(tabla) if tabla is not None else None,
                'residuos_std':  RBridge._to_native(residuos_std) if residuos_std else None,
                'script_r':      res["script"]
            }
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # MCNEMAR TEST
    # =========================================================================

    @staticmethod
    def mcnemar_test(df: pd.DataFrame, var1: str, var2: str) -> dict:
        safe1     = RBridge._sanitize(var1)
        safe2     = RBridge._sanitize(var2)
        subset    = df[[var1, var2]].rename(columns={var1: safe1, var2: safe2})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        v1    <- as.factor(datos[['{safe1}']])
        v2    <- as.factor(datos[['{safe2}']])
        valid <- complete.cases(v1, v2)
        v1    <- v1[valid]; v2 <- v2[valid]
        tabla <- table(v1, v2)
        test  <- mcnemar.test(tabla)

        b     <- tabla[1,2]; c_ <- tabla[2,1]
        or_mc <- if (c_ > 0) b / c_ else NA_real_

        cat(toJSON(list(
            estadistico  = as.numeric(test$statistic),
            p_valor      = as.numeric(test$p.value),
            gl           = as.numeric(test$parameter),
            or_mcnemar   = ifelse(is.na(or_mc), NA, as.numeric(or_mc))
        ), auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # ODDS RATIO
    # =========================================================================

    @staticmethod
    def odds_ratio(df: pd.DataFrame, var1: str, var2: str) -> dict:
        safe1     = RBridge._sanitize(var1)
        safe2     = RBridge._sanitize(var2)
        subset    = df[[var1, var2]].rename(columns={var1: safe1, var2: safe2})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        v1    <- as.factor(datos[['{safe1}']])
        v2    <- as.factor(datos[['{safe2}']])
        valid <- complete.cases(v1, v2)
        v1    <- v1[valid]; v2 <- v2[valid]
        tabla <- table(v1, v2)

        or       <- (tabla[1,1] * tabla[2,2]) / (tabla[1,2] * tabla[2,1])
        log_or   <- log(or)
        se_log   <- sqrt(1/tabla[1,1] + 1/tabla[1,2] + 1/tabla[2,1] + 1/tabla[2,2])
        test     <- fisher.test(tabla)

        cat(toJSON(list(
            odds_ratio  = as.numeric(or),
            ic_inferior = as.numeric(exp(log_or - 1.96 * se_log)),
            ic_superior = as.numeric(exp(log_or + 1.96 * se_log)),
            p_valor     = as.numeric(test$p.value)
        ), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # KAPPA DE COHEN
    # =========================================================================

    @staticmethod
    def kappa_cohen(df: pd.DataFrame, var1: str, var2: str) -> dict:
        safe1     = RBridge._sanitize(var1)
        safe2     = RBridge._sanitize(var2)
        subset    = df[[var1, var2]].rename(columns={var1: safe1, var2: safe2})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        library(irr)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        v1    <- as.factor(datos[['{safe1}']])
        v2    <- as.factor(datos[['{safe2}']])
        valid <- complete.cases(v1, v2)
        v1    <- v1[valid]; v2 <- v2[valid]
        test  <- kappa2(data.frame(v1, v2), weight = "unweighted")

        k     <- as.numeric(test$value)
        interp <- if (k < 0)       "pobre"
                  else if (k < 0.2) "leve"
                  else if (k < 0.4) "aceptable"
                  else if (k < 0.6) "moderado"
                  else if (k < 0.8) "considerable"
                  else               "casi perfecto"

        cat(toJSON(list(
            kappa                = k,
            p_valor              = as.numeric(test$p.value),
            acuerdo_observado    = as.numeric(sum(diag(table(v1, v2))) / length(v1)),
            interpretacion_landis = interp
        ), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # CURVA ROC
    # =========================================================================

    @staticmethod
    def roc_curve(df: pd.DataFrame, outcome: str, predictor: str) -> dict:
        safe_out  = RBridge._sanitize(outcome)
        safe_pred = RBridge._sanitize(predictor)
        subset    = df[[outcome, predictor]].rename(columns={outcome: safe_out, predictor: safe_pred})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        library(pROC)
        datos   <- read.csv('{data_path}', check.names = FALSE), encoding = 'UTF-8-sig')
        roc_obj <- roc(datos[['{safe_out}']], datos[['{safe_pred}']], quiet = TRUE)
        coords  <- coords(roc_obj, "all",
                          ret = c("threshold","sensitivity","specificity","ppv","npv"))
        result  <- list(
            auc    = as.numeric(auc(roc_obj)),
            coords = data.frame(
                umbral       = coords[,1],
                sensibilidad = coords[,2],
                especificidad = coords[,3],
                vpn          = coords[,4],
                vpp          = coords[,5]
            )
        )
        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # DIAGNOSTIC ACCURACY
    # =========================================================================

    @staticmethod
    def diagnostic_accuracy(
        df: pd.DataFrame, outcome: str, predictor: str, threshold: float
    ) -> dict:
        RBridge._validate_numeric(threshold, 'threshold')
        safe_out  = RBridge._sanitize(outcome)
        safe_pred = RBridge._sanitize(predictor)
        subset    = df[[outcome, predictor]].rename(columns={outcome: safe_out, predictor: safe_pred})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos     <- read.csv('{data_path}', check.names = FALSE), encoding = 'UTF-8-sig')
        outcome   <- datos[['{safe_out}']]
        predictor <- datos[['{safe_pred}']]
        valid     <- complete.cases(outcome, predictor)
        outcome   <- outcome[valid]; predictor <- predictor[valid]

        pred_bin <- ifelse(predictor > {threshold}, 1, 0)
        tp <- sum(pred_bin == 1 & outcome == 1)
        tn <- sum(pred_bin == 0 & outcome == 0)
        fp <- sum(pred_bin == 1 & outcome == 0)
        fn <- sum(pred_bin == 0 & outcome == 1)

        sens   <- tp / (tp + fn)
        espec  <- tn / (tn + fp)
        vpp    <- tp / (tp + fp)
        vpn    <- tn / (tn + fn)
        lr_pos <- sens / (1 - espec)
        lr_neg <- (1 - sens) / espec

        cat(toJSON(list(
            sensibilidad  = as.numeric(sens),
            especificidad = as.numeric(espec),
            vpp           = as.numeric(vpp),
            vpn           = as.numeric(vpn),
            lr_positivo   = as.numeric(lr_pos),
            lr_negativo   = as.numeric(lr_neg),
            exactitud     = as.numeric((tp + tn) / (tp + tn + fp + fn)),
            umbral        = as.numeric({threshold})
        ), auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # SUPERVIVENCIA: KAPLAN-MEIER
    # =========================================================================

    @staticmethod
    def kaplan_meier(
        df: pd.DataFrame, time_var: str, event_var: str, group_var: str = None
    ) -> dict:
        safe_time  = RBridge._sanitize(time_var)
        safe_event = RBridge._sanitize(event_var)
        safe_group = RBridge._sanitize(group_var) if group_var else None

        cols       = [time_var, event_var]
        rename_map = {time_var: safe_time, event_var: safe_event}
        if group_var:
            cols.append(group_var)
            rename_map[group_var] = safe_group
        subset    = df[cols].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        group_code = f"'{safe_group}'" if safe_group else 'NULL'

        script = f"""
        library(jsonlite)
        library(survival)
        datos  <- read.csv('{data_path}', check.names = FALSE), encoding = 'UTF-8-sig')
        time   <- datos[['{safe_time}']]
        event  <- datos[['{safe_event}']]
        group  <- if (!is.null({group_code})) datos[[{group_code}]] else NULL

        if (is.null(group)) {{
            fit         <- survfit(Surv(time, event) ~ 1)
            strata_names <- "Global"
            logrank_p   <- NA_real_
        }} else {{
            fit          <- survfit(Surv(time, event) ~ group)
            strata_names <- names(fit$strata)
            logrank_test <- survdiff(Surv(time, event) ~ group)
            logrank_p    <- 1 - pchisq(logrank_test$chisq, df = length(logrank_test$n) - 1)
        }}

        s <- summary(fit)
        result <- list(
            tiempos       = s$time,
            n_riesgo      = s$n.risk,
            n_evento      = s$n.event,
            supervivencia = s$surv,
            strata        = s$strata,
            strata_nombres = strata_names,
            logrank_p     = ifelse(is.na(logrank_p), NA, as.numeric(logrank_p))
        )
        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # REGRESIÓN DE COX
    # =========================================================================

    @staticmethod
    def cox_regression(
        df: pd.DataFrame, time_var: str, event_var: str, covariates: list
    ) -> dict:
        safe_time  = RBridge._sanitize(time_var)
        safe_event = RBridge._sanitize(event_var)
        safe_cov   = [RBridge._sanitize(c) for c in covariates]
        rename_map = {time_var: safe_time, event_var: safe_event}
        for orig, safe in zip(covariates, safe_cov):
            rename_map[orig] = safe
        subset    = df[[time_var, event_var] + covariates].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        cov_r     = ', '.join([f"'{v}'" for v in safe_cov])

        script = f"""
        library(jsonlite)
        library(survival)
        datos  <- read.csv('{data_path}', check.names = FALSE), encoding = 'UTF-8-sig')
        time   <- datos[['{safe_time}']]
        event  <- datos[['{safe_event}']]
        covs   <- datos[, c({cov_r}), drop = FALSE]
        fit    <- coxph(Surv(time, event) ~ ., data = data.frame(time, event, covs))
        s      <- summary(fit)
        coef   <- s$coefficients
        ci     <- confint(fit)

        zph_p <- tryCatch({{
            z <- cox.zph(fit)
            as.numeric(z$table[nrow(z$table), "p"])
        }}, error = function(e) NA_real_)

        result <- list(
            coeficientes = data.frame(
                variable    = rownames(coef),
                hr          = exp(coef[,1]),
                ic_inferior = exp(ci[,1]),
                ic_superior = exp(ci[,2]),
                p_valor     = coef[,5]
            ),
            zph_global_p = ifelse(is.na(zph_p), NA, as.numeric(zph_p)),
            nota_zph = if (!is.na(zph_p) && zph_p < 0.05)
                "Posible violación de riesgos proporcionales (Schoenfeld p < 0.05). Revisar."
                else "Test de proporcionalidad no significativo."
        )
        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # BLAND-ALTMAN
    # =========================================================================

    @staticmethod
    def bland_altman(df: pd.DataFrame, var1: str, var2: str) -> dict:
        safe1     = RBridge._sanitize(var1)
        safe2     = RBridge._sanitize(var2)
        subset    = df[[var1, var2]].rename(columns={var1: safe1, var2: safe2})
        data_path = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        v1    <- datos[['{safe1}']]; v2 <- datos[['{safe2}']]
        valid <- complete.cases(v1, v2)
        v1    <- v1[valid]; v2 <- v2[valid]
        n     <- length(v1)

        diffs    <- v1 - v2
        medias   <- (v1 + v2) / 2
        md       <- mean(diffs)
        sd_d     <- sd(diffs)
        se_md    <- sd_d / sqrt(n)
        se_loa   <- sqrt(3) * se_md

        t_crit   <- qt(0.975, df = n - 1)
        loa_lo   <- md - 1.96 * sd_d
        loa_up   <- md + 1.96 * sd_d

        ic_loa_lo_inf <- loa_lo - t_crit * se_loa
        ic_loa_lo_sup <- loa_lo + t_crit * se_loa
        ic_loa_up_inf <- loa_up - t_crit * se_loa
        ic_loa_up_sup <- loa_up + t_crit * se_loa

        cor_bias <- tryCatch(cor.test(medias, diffs)$p.value, error = function(e) NA)

        cat(toJSON(list(
            sesgo_medio  = as.numeric(md),
            dt_diferencias = as.numeric(sd_d),
            loa_inferior = as.numeric(loa_lo),
            loa_superior = as.numeric(loa_up),
            ic_loa_inf   = list(inferior = as.numeric(ic_loa_lo_inf), superior = as.numeric(ic_loa_lo_sup)),
            ic_loa_sup   = list(inferior = as.numeric(ic_loa_up_inf), superior = as.numeric(ic_loa_up_sup)),
            sesgo_proporcional_p = ifelse(is.na(cor_bias), NA, as.numeric(cor_bias)),
            nota_sesgo = if (!is.na(cor_bias) && cor_bias < 0.05)
                "Posible sesgo proporcional (p < 0.05). La diferencia varía con la magnitud."
                else "No hay evidencia de sesgo proporcional."
        ), auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # ICC
    # =========================================================================

    @staticmethod
    def icc(df: pd.DataFrame, columns: list) -> dict:
        safe_cols  = [RBridge._sanitize(c) for c in columns]
        rename_map = {orig: safe for orig, safe in zip(columns, safe_cols)}
        subset     = df[columns].rename(columns=rename_map)
        data_path  = RBridge._write_temp_csv(subset)

        script = f"""
        library(jsonlite)
        library(irr)
        datos  <- read.csv('{data_path}', check.names = FALSE), encoding = 'UTF-8-sig')
        matriz <- as.matrix(datos)
        test   <- icc(matriz, model = "twoway", type = "agreement", unit = "single")

        icc_val <- as.numeric(test$value)
        interp  <- if (icc_val < 0.5)       "pobre"
                   else if (icc_val < 0.75)  "moderado"
                   else if (icc_val < 0.9)   "bueno"
                   else                       "excelente"

        cat(toJSON(list(
            icc             = icc_val,
            p_valor         = as.numeric(test$p.value),
            ic_inferior     = as.numeric(test$lbound),
            ic_superior     = as.numeric(test$ubound),
            interpretacion  = interp
        ), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # ANCOVA
    # =========================================================================

    @staticmethod
    def ancova(
        df: pd.DataFrame, dep_var: str, group_var: str, covariates: list
    ) -> dict:
        safe_dep   = RBridge._sanitize(dep_var)
        safe_group = RBridge._sanitize(group_var)
        safe_cov   = [RBridge._sanitize(c) for c in covariates]
        rename_map = {dep_var: safe_dep, group_var: safe_group}
        for orig, safe in zip(covariates, safe_cov):
            rename_map[orig] = safe
        subset    = df[[dep_var, group_var] + covariates].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        cov_r     = ', '.join([f"'{v}'" for v in safe_cov])

        script = f"""
        library(jsonlite)
        library(car)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        dep   <- datos[['{safe_dep}']]
        group <- as.factor(datos[['{safe_group}']])
        covs  <- datos[, c({cov_r}), drop = FALSE]
        fit   <- lm(dep ~ group + ., data = data.frame(dep, group, covs))
        s     <- summary(fit)
        coef  <- coef(s)
        result <- list(
            coeficientes = data.frame(
                variable   = rownames(coef),
                estimacion = coef[,1],
                p_valor    = coef[,4]
            )
        )
        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # PROPENSITY SCORE
    # =========================================================================

    @staticmethod
    def propensity_score(
        df: pd.DataFrame, treatment: str, covariates: list
    ) -> dict:
        safe_treat = RBridge._sanitize(treatment)
        safe_cov   = [RBridge._sanitize(c) for c in covariates]
        rename_map = {treatment: safe_treat}
        for orig, safe in zip(covariates, safe_cov):
            rename_map[orig] = safe
        subset    = df[[treatment] + covariates].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)
        cov_r     = ', '.join([f"'{v}'" for v in safe_cov])

        script = f"""
        library(jsonlite)
        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        treat <- datos[['{safe_treat}']]
        covs  <- datos[, c({cov_r}), drop = FALSE]
        fit   <- glm(treat ~ ., data = data.frame(treat, covs), family = binomial)
        result <- list(
            propensity_scores = as.numeric(fitted(fit))
        )
        cat(toJSON(result, auto_unbox = TRUE, na = "null"))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        finally:
            RBridge._cleanup(data_path)

    # =========================================================================
    # TAMAÑO MUESTRAL
    # =========================================================================

    @staticmethod
    def sample_size(
        alpha: float, power: float, effect: float, test_type: str = "t-test"
    ) -> dict:
        valid_tests = {"t-test", "proporciones", "ANOVA"}
        if test_type not in valid_tests:
            raise ValueError(
                f"test_type='{test_type}' no válido. Opciones: {valid_tests}"
            )
        RBridge._validate_numeric(alpha, 'alpha')
        RBridge._validate_numeric(power, 'power')
        RBridge._validate_numeric(effect, 'effect')

        script = f"""
        library(jsonlite)
        library(pwr)

        alpha   <- {alpha}
        power   <- {power}
        effect  <- {effect}

        if ("{test_type}" == "t-test") {{
            res          <- pwr.t.test(d = effect, sig.level = alpha, power = power, type = "two.sample")
            n_por_grupo  <- res$n
            n_total      <- ceiling(n_por_grupo) * 2
        }} else if ("{test_type}" == "proporciones") {{
            res          <- pwr.2p.test(h = effect, sig.level = alpha, power = power)
            n_por_grupo  <- res$n
            n_total      <- ceiling(n_por_grupo) * 2
        }} else if ("{test_type}" == "ANOVA") {{
            res          <- pwr.anova.test(k = 3, f = effect, sig.level = alpha, power = power)
            n_por_grupo  <- res$n
            n_total      <- ceiling(n_por_grupo) * 3
        }}

        cat(toJSON(list(
            n_por_grupo = as.numeric(ceiling(n_por_grupo)),
            n_total     = as.integer(n_total),
            potencia    = as.numeric(power),
            alpha       = as.numeric(alpha),
            tipo_test   = "{test_type}"
        ), auto_unbox = TRUE))
        """
        try:
            res = RBridge._run_script(script)
            ret = res["result"]
            ret["script_r"] = res["script"]
            return RBridge._to_native(ret)
        except Exception as e:
            raise RuntimeError(f"Error en cálculo de tamaño muestral: {e}")

    # =========================================================================
    # CORRECCIÓN DE BONFERRONI / HOLM
    # =========================================================================

    @staticmethod
    def bonferroni_correction(p_values: list) -> dict:
        if not p_values:
            raise ValueError("La lista de p-valores está vacía.")
        if any(not isinstance(p, (int, float)) or not (0 <= p <= 1) for p in p_values):
            raise ValueError("Todos los p-valores deben ser numéricos entre 0 y 1.")

        n          = len(p_values)
        bonf       = [min(p * n, 1.0) for p in p_values]
        indexed    = sorted(enumerate(p_values), key=lambda x: x[1])
        holm       = [0.0] * n
        prev       = 0.0
        for rank, (i, p) in enumerate(indexed):
            adj = min(p * (n - rank), 1.0)
            adj = max(adj, prev)
            holm[i] = adj
            prev = adj

        return {
            'p_original':   p_values,
            'p_bonferroni': bonf,
            'p_holm':       holm,
            'nota': (
                "Holm-Bonferroni es uniformemente más potente que Bonferroni "
                "y se recomienda como sustituto directo."
            )
        }

    # =========================================================================
    # GRÁFICOS CON GGPLOT2 (TODOS LOS TIPOS)
    # =========================================================================

    @staticmethod
    def _run_ggplot(data_path, script_content):
        full_script = (
            f"{RBridge._get_libpaths_header()}"
            f"options(warn = -1)\n"
            f"{script_content}"
        )
        script_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', suffix='.R', delete=False, encoding='utf-8'
            ) as f:
                f.write(full_script)
                script_path = f.name

            plot_path = os.path.join(os.path.dirname(script_path), 'plot.png')
            result = subprocess.run(
                ['Rscript', script_path],
                capture_output=True,
                text=True,
                encoding='utf-8',
                timeout=120,
                cwd=os.path.dirname(script_path)
            )

            if result.returncode != 0:
                stderr_lines = [
                    l for l in result.stderr.splitlines()
                    if not l.strip().startswith(("Loading", "Attaching", "The following"))
                ]
                raise RuntimeError("Error en R (gráfico):\n" + "\n".join(stderr_lines))

            if not os.path.exists(plot_path):
                if os.path.exists('plot.png'):
                    plot_path = 'plot.png'
                else:
                    raise RuntimeError("No se generó la imagen 'plot.png'")

            with open(plot_path, 'rb') as f:
                img_data = f.read()
            os.unlink(plot_path)
            return img_data, full_script

        except subprocess.TimeoutExpired:
            raise RuntimeError("El proceso R superó el tiempo límite (120 s).")
        finally:
            if script_path and os.path.exists(script_path):
                os.unlink(script_path)

    @staticmethod
    def ggplot_boxplot(df, x_var, y_var, color_var=None,
                       title="", xlab="", ylab="",
                       palette="Set1", theme="classic",
                       width=8, height=6, dpi=300):
        theme = RBridge._validate_theme(theme)
        palette = RBridge._validate_palette(palette)
        RBridge._validate_numeric(width, 'width')
        RBridge._validate_numeric(height, 'height')
        RBridge._validate_numeric(dpi, 'dpi')
        safe_x = RBridge._sanitize(x_var)
        safe_y = RBridge._sanitize(y_var)
        safe_color = RBridge._sanitize(color_var) if color_var else None
        rename_map = {x_var: safe_x, y_var: safe_y}
        if color_var:
            rename_map[color_var] = safe_color
        subset = df[[x_var, y_var] + ([color_var] if color_var else [])].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        title_esc = RBridge._escape_r_string(title)
        xlab_esc = RBridge._escape_r_string(xlab)
        ylab_esc = RBridge._escape_r_string(ylab)

        color_aes = f", fill = {safe_color}" if color_var else ""
        color_scale = f'scale_fill_brewer(palette = "{palette}")' if color_var else ""

        script = f'''
        library(ggplot2)
        library(RColorBrewer)
        library(viridis)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        p <- ggplot(datos, aes(x = {safe_x}, y = {safe_y}{color_aes})) +
            geom_boxplot() +
            labs(title = "{title_esc}", x = "{xlab_esc}", y = "{ylab_esc}") +
            theme_{theme}()
        {color_scale}

        ggsave("plot.png", plot = p, width = {width}, height = {height}, dpi = {dpi})
        '''
        try:
            img, code = RBridge._run_ggplot(data_path, script)
            return img, code
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def ggplot_scatter(df, x_var, y_var, color_var=None,
                       title="", xlab="", ylab="",
                       palette="Set1", theme="classic",
                       width=8, height=6, dpi=300):
        theme = RBridge._validate_theme(theme)
        palette = RBridge._validate_palette(palette)
        RBridge._validate_numeric(width, 'width')
        RBridge._validate_numeric(height, 'height')
        RBridge._validate_numeric(dpi, 'dpi')
        safe_x = RBridge._sanitize(x_var)
        safe_y = RBridge._sanitize(y_var)
        safe_color = RBridge._sanitize(color_var) if color_var else None
        rename_map = {x_var: safe_x, y_var: safe_y}
        if color_var:
            rename_map[color_var] = safe_color
        subset = df[[x_var, y_var] + ([color_var] if color_var else [])].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        title_esc = RBridge._escape_r_string(title)
        xlab_esc = RBridge._escape_r_string(xlab)
        ylab_esc = RBridge._escape_r_string(ylab)

        color_aes = f", color = {safe_color}" if color_var else ""
        color_scale = f'scale_color_brewer(palette = "{palette}")' if color_var else ""

        script = f'''
        library(ggplot2)
        library(RColorBrewer)
        library(viridis)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        p <- ggplot(datos, aes(x = {safe_x}, y = {safe_y}{color_aes})) +
            geom_point(size = 3, alpha = 0.7) +
            labs(title = "{title_esc}", x = "{xlab_esc}", y = "{ylab_esc}") +
            theme_{theme}()
        {color_scale}

        ggsave("plot.png", plot = p, width = {width}, height = {height}, dpi = {dpi})
        '''
        try:
            img, code = RBridge._run_ggplot(data_path, script)
            return img, code
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def ggplot_histogram(df, x_var, fill_var=None, bins=30,
                         title="", xlab="", ylab="",
                         palette="Set1", theme="classic",
                         width=8, height=6, dpi=300):
        theme = RBridge._validate_theme(theme)
        palette = RBridge._validate_palette(palette)
        RBridge._validate_numeric(bins, 'bins')
        RBridge._validate_numeric(width, 'width')
        RBridge._validate_numeric(height, 'height')
        RBridge._validate_numeric(dpi, 'dpi')
        safe_x = RBridge._sanitize(x_var)
        safe_fill = RBridge._sanitize(fill_var) if fill_var else None
        rename_map = {x_var: safe_x}
        if fill_var:
            rename_map[fill_var] = safe_fill
        subset = df[[x_var] + ([fill_var] if fill_var else [])].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        title_esc = RBridge._escape_r_string(title)
        xlab_esc = RBridge._escape_r_string(xlab)
        ylab_esc = RBridge._escape_r_string(ylab)

        fill_aes = f", fill = {safe_fill}" if fill_var else ""
        color_scale = f'scale_fill_brewer(palette = "{palette}")' if fill_var else ""

        script = f'''
        library(ggplot2)
        library(RColorBrewer)
        library(viridis)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        p <- ggplot(datos, aes(x = {safe_x}{fill_aes})) +
            geom_histogram(bins = {bins}, alpha = 0.7) +
            labs(title = "{title_esc}", x = "{xlab_esc}", y = "{ylab_esc}") +
            theme_{theme}()
        {color_scale}

        ggsave("plot.png", plot = p, width = {width}, height = {height}, dpi = {dpi})
        '''
        try:
            img, code = RBridge._run_ggplot(data_path, script)
            return img, code
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def ggplot_barplot(df, x_var, y_var=None, fill_var=None,
                       title="", xlab="", ylab="",
                       palette="Set1", theme="classic",
                       width=8, height=6, dpi=300):
        theme = RBridge._validate_theme(theme)
        palette = RBridge._validate_palette(palette)
        RBridge._validate_numeric(width, 'width')
        RBridge._validate_numeric(height, 'height')
        RBridge._validate_numeric(dpi, 'dpi')
        safe_x = RBridge._sanitize(x_var)
        safe_y = RBridge._sanitize(y_var) if y_var else None
        safe_fill = RBridge._sanitize(fill_var) if fill_var else None
        rename_map = {x_var: safe_x}
        cols = [x_var]
        if y_var:
            rename_map[y_var] = safe_y
            cols.append(y_var)
        if fill_var:
            rename_map[fill_var] = safe_fill
            cols.append(fill_var)
        subset = df[cols].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        title_esc = RBridge._escape_r_string(title)
        xlab_esc = RBridge._escape_r_string(xlab)
        ylab_esc = RBridge._escape_r_string(ylab)

        if y_var:
            aes_str = f"x = {safe_x}, y = {safe_y}"
        else:
            aes_str = f"x = {safe_x}"
        fill_aes = f", fill = {safe_fill}" if fill_var else ""
        geoms = 'geom_bar(stat = "identity")' if y_var else 'geom_bar()'
        color_scale = f'scale_fill_brewer(palette = "{palette}")' if fill_var else ""

        script = f'''
        library(ggplot2)
        library(RColorBrewer)
        library(viridis)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        p <- ggplot(datos, aes({aes_str}{fill_aes})) +
            {geoms} +
            labs(title = "{title_esc}", x = "{xlab_esc}", y = "{ylab_esc}") +
            theme_{theme}()
        {color_scale}

        ggsave("plot.png", plot = p, width = {width}, height = {height}, dpi = {dpi})
        '''
        try:
            img, code = RBridge._run_ggplot(data_path, script)
            return img, code
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def ggplot_density(df, x_var, fill_var=None,
                       title="", xlab="", ylab="",
                       palette="Set1", theme="classic",
                       width=8, height=6, dpi=300):
        theme = RBridge._validate_theme(theme)
        palette = RBridge._validate_palette(palette)
        RBridge._validate_numeric(width, 'width')
        RBridge._validate_numeric(height, 'height')
        RBridge._validate_numeric(dpi, 'dpi')
        safe_x = RBridge._sanitize(x_var)
        safe_fill = RBridge._sanitize(fill_var) if fill_var else None
        rename_map = {x_var: safe_x}
        if fill_var:
            rename_map[fill_var] = safe_fill
        subset = df[[x_var] + ([fill_var] if fill_var else [])].rename(columns=rename_map)
        data_path = RBridge._write_temp_csv(subset)

        title_esc = RBridge._escape_r_string(title)
        xlab_esc = RBridge._escape_r_string(xlab)
        ylab_esc = RBridge._escape_r_string(ylab)

        fill_aes = f", fill = {safe_fill}" if fill_var else ""
        color_scale = f'scale_fill_brewer(palette = "{palette}")' if fill_var else ""

        script = f'''
        library(ggplot2)
        library(RColorBrewer)
        library(viridis)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')

        p <- ggplot(datos, aes(x = {safe_x}{fill_aes})) +
            geom_density(alpha = 0.5) +
            labs(title = "{title_esc}", x = "{xlab_esc}", y = "{ylab_esc}") +
            theme_{theme}()
        {color_scale}

        ggsave("plot.png", plot = p, width = {width}, height = {height}, dpi = {dpi})
        '''
        try:
            img, code = RBridge._run_ggplot(data_path, script)
            return img, code
        finally:
            RBridge._cleanup(data_path)

    @staticmethod
    def ggplot_roc(df, outcome, predictor,
                   title="Curva ROC", xlab="1 - Especificidad", ylab="Sensibilidad",
                   palette="Set1", theme="classic",
                   width=8, height=6, dpi=300):
        theme = RBridge._validate_theme(theme)
        palette = RBridge._validate_palette(palette)
        RBridge._validate_numeric(width, 'width')
        RBridge._validate_numeric(height, 'height')
        RBridge._validate_numeric(dpi, 'dpi')
        safe_out = RBridge._sanitize(outcome)
        safe_pred = RBridge._sanitize(predictor)
        subset = df[[outcome, predictor]].rename(columns={outcome: safe_out, predictor: safe_pred})
        data_path = RBridge._write_temp_csv(subset)

        title_esc = RBridge._escape_r_string(title)
        xlab_esc = RBridge._escape_r_string(xlab)
        ylab_esc = RBridge._escape_r_string(ylab)

        script = f'''
        library(ggplot2)
        library(pROC)

        datos <- read.csv('{data_path}', check.names = FALSE, encoding = 'UTF-8-sig')
        roc_obj <- roc(datos[['{safe_out}']], datos[['{safe_pred}']], quiet = TRUE)
        roc_df <- data.frame(
            sensibilidad = roc_obj$sensitivities,
            especificidad = roc_obj$specificities
        )

        p <- ggplot(roc_df, aes(x = 1 - especificidad, y = sensibilidad)) +
            geom_line(color = "steelblue", size = 1.2) +
            geom_abline(intercept = 0, slope = 1, linetype = "dashed", color = "gray50") +
            labs(title = "{title_esc}", x = "{xlab_esc}", y = "{ylab_esc}") +
            theme_{theme}() +
            annotate("text", x = 0.8, y = 0.2,
                     label = paste("AUC =", round(auc(roc_obj), 3)),
                     size = 5, hjust = 0)

        ggsave("plot.png", plot = p, width = {wi