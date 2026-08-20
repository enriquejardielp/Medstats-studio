import pandas as pd

from backend.core.data_utils import clean_uploaded_dataframe


def test_clean_uploaded_dataframe_drops_blank_rows_and_columns():
    df = pd.DataFrame({
        'Edad': [30, 40, 50, None],
        'Sexo': ['M', 'F', '', None],
        '': [None, None, None, None],
    })
    df.loc[4] = [None, None, None]
    df.loc[5] = [None, None, None]

    cleaned = clean_uploaded_dataframe(df)

    assert list(cleaned.columns) == ['Edad', 'Sexo']
    assert len(cleaned) == 4
    assert cleaned.iloc[0]['Edad'] == 30
    assert cleaned.iloc[2]['Sexo'] == ''
