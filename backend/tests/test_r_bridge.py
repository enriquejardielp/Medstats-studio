from unittest.mock import patch

import pandas as pd
from backend.core.r_bridge import RBridge


def test_shapiro():
    data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    res = RBridge.shapiro_test(data)
    assert 'p_valor' in res


def test_linear_regression():
    df = pd.DataFrame({
        'y': [1, 2, 3, 4, 5, 6, 7, 8],
        'x1': [1, 2, 3, 4, 5, 6, 7, 8],
        'x2': [2, 1, 3, 2, 4, 3, 5, 4],
    })
    res = RBridge.linear_regression(df, 'y', ['x1', 'x2'])
    assert 'coeficientes' in res
    assert 'r_cuadrado' in res


def test_chi_square_returns_json_serializable_payload():
    df = pd.DataFrame({
        'var1': ['A', 'A', 'B', 'B'],
        'var2': ['X', 'Y', 'X', 'Y'],
    })
    payload = {
        'p_valor': 0.42,
        'estadistico': 1.23,
        'gl': 1,
        'metodo': 'Chi-cuadrado de Pearson',
        'cramer_v': 0.2,
        'tabla': [{'var1': 'A', 'var2': 'X', 'frecuencia': 2}],
        'residuos_std': [{'A': 0.1, 'B': -0.1}],
    }

    with patch('backend.core.r_bridge.RBridge._run_script', return_value={'result': payload, 'script': ''}), \
         patch('backend.core.r_bridge.RBridge._cleanup'):
        res = RBridge.chi_square(df, 'var1', 'var2')

    assert isinstance(res['tabla'], list)
    assert isinstance(res['residuos_std'], list)
    assert res['tabla'][0]['frecuencia'] == 2


def test_logistic_regression_requires_binary_target():
    df = pd.DataFrame({
        'y': ['yes', 'no', 'maybe', 'yes'],
        'x1': [1, 2, 3, 4],
    })

    try:
        RBridge.logistic_regression(df, 'y', ['x1'])
    except ValueError as exc:
        assert 'binaria' in str(exc).lower()
    else:
        raise AssertionError('Expected ValueError for non-binary target')


def test_icc():
    df = pd.DataFrame({
        'r1': [1, 2, 3, 4, 5],
        'r2': [1, 2, 4, 4, 5],
        'r3': [2, 2, 3, 5, 5],
    })
    res = RBridge.icc(df, ['r1', 'r2', 'r3'])
    assert 'icc' in res
    assert res['icc'] is not None
    assert 'interpretacion' in res


def test_kappa():
    df = pd.DataFrame({
        'v1': ['A', 'A', 'B', 'B'],
        'v2': ['A', 'B', 'B', 'B'],
    })
    res = RBridge.kappa_cohen(df, 'v1', 'v2')
    assert 'kappa' in res
    assert 'interpretacion_landis' in res


def test_odds_ratio_zero_cell():
    df = pd.DataFrame({
        'v1': ['Yes'] * 10 + ['No'] * 10,
        'v2': ['Yes'] * 10 + ['No'] * 10,
    })
    res = RBridge.odds_ratio(df, 'v1', 'v2')
    assert 'odds_ratio' in res
    assert res['odds_ratio'] > 0
    assert 'nota' in res


def test_shapiro_constant_fails_gracefully():
    s = pd.Series([5.0, 5.0, 5.0, 5.0, 5.0])
    try:
        RBridge.shapiro_test(s)
    except ValueError as e:
        assert 'idénticos' in str(e)
    else:
        raise AssertionError('Expected ValueError for zero variance')


if __name__ == '__main__':
    print('Running RBridge test suite...')
    test_shapiro()
    print('  ✓ test_shapiro passed')
    test_linear_regression()
    print('  ✓ test_linear_regression passed')
    test_chi_square_returns_json_serializable_payload()
    print('  ✓ test_chi_square_returns_json_serializable_payload passed')
    test_logistic_regression_requires_binary_target()
    print('  ✓ test_logistic_regression_requires_binary_target passed')
    test_icc()
    print('  ✓ test_icc passed')
    test_kappa()
    print('  ✓ test_kappa passed')
    test_odds_ratio_zero_cell()
    print('  ✓ test_odds_ratio_zero_cell passed')
    test_shapiro_constant_fails_gracefully()
    print('  ✓ test_shapiro_constant_fails_gracefully passed')
    print('All tests passed successfully!')
