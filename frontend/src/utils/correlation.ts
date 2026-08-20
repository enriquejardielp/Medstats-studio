export const getCorrelationStrengthLabel = (value: number | undefined): string => {
  const magnitude = Math.abs(Number(value ?? 0));

  if (magnitude < 0.1) return 'Despreciable';
  if (magnitude < 0.3) return 'Débil';
  if (magnitude < 0.5) return 'Moderada';
  if (magnitude < 0.7) return 'Fuerte';
  return 'Muy fuerte';
};

export const formatCorrelationResult = (analysisResult: Record<string, any>) => {
  const rValue = Number(analysisResult?.r);
  const pValue = Number(analysisResult?.p_valor);
  const lower = Number(analysisResult?.ic_inferior);
  const upper = Number(analysisResult?.ic_superior);
  const sampleSize = analysisResult?.n;
  const diagnostics = analysisResult?.diagnosticos;

  return {
    methodBadge: analysisResult?.metodo || 'Correlación',
    rLabel: `r = ${Number.isFinite(rValue) ? rValue.toFixed(4) : '-'}`,
    strengthLabel: getCorrelationStrengthLabel(rValue),
    pValueLabel: Number.isFinite(pValue) ? pValue.toFixed(4) : '-',
    confidenceIntervalLabel: Number.isFinite(lower) && Number.isFinite(upper)
      ? `[${lower.toFixed(3)}, ${upper.toFixed(3)}]`
      : '-',
    sampleSizeLabel: `n = ${sampleSize ?? '-'}`,
    diagnosticsLabel: diagnostics?.shapiro_p_s1 !== undefined && diagnostics?.shapiro_p_s2 !== undefined
      ? `Shapiro-Wilk: p₁ = ${Number(diagnostics.shapiro_p_s1).toFixed(4)}, p₂ = ${Number(diagnostics.shapiro_p_s2).toFixed(4)}`
      : '',
    autoNote: diagnostics?.aviso_auto || '',
  };
};
