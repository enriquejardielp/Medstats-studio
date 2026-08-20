import pandas as pd


def clean_uploaded_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df is None:
        raise ValueError('El DataFrame no puede ser None')

    if not isinstance(df, pd.DataFrame):
        raise TypeError('Se esperaba un DataFrame de pandas')

    cleaned = df.copy()

    cleaned.columns = [str(col).strip() if isinstance(col, str) else col for col in cleaned.columns]

    # Eliminar columnas totalmente vacías o con solo valores nulos/espacios
    def _is_blank_value(value):
        if pd.isna(value):
            return True
        if isinstance(value, str):
            return value.strip() == ''
        return False

    blank_columns = [
        col for col in cleaned.columns
        if cleaned[col].apply(_is_blank_value).all()
    ]
    cleaned = cleaned.drop(columns=blank_columns)

    # Eliminar filas completamente vacías o con solo valores nulos/espacios
    blank_rows_mask = cleaned.apply(lambda row: row.apply(_is_blank_value).all(), axis=1)
    cleaned = cleaned.loc[~blank_rows_mask]

    # Eliminar columnas con nombre vacío tras el saneado
    cleaned = cleaned.loc[:, [col for col in cleaned.columns if str(col).strip() != '']]

    return cleaned.reset_index(drop=True)
