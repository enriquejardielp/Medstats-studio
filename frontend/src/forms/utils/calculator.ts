import type { FormField } from '../types/clinical';

/**
 * Calculates formula values based on current form data
 */
export function calculateFieldValue(
  field: FormField,
  data: Record<string, any>
): number | string | null {
  if (field.type !== 'calculated') return null;

  // Preset: IMC / BMI = peso / ((talla / 100) ** 2)
  if (field.formulaPreset === 'imc' || field.name.toLowerCase().includes('imc') || field.name.toLowerCase().includes('bmi')) {
    const peso = parseFloat(data.peso ?? data.weight ?? 0);
    let talla = parseFloat(data.talla ?? data.altura ?? data.height ?? 0);
    if (peso > 0 && talla > 0) {
      // If height entered in meters (e.g. 1.75) vs cm (175)
      if (talla < 3) {
        talla = talla * 100;
      }
      const imc = peso / Math.pow(talla / 100, 2);
      return Math.round(imc * 10) / 10;
    }
    return null;
  }

  // Preset: PAM / MAP = (PAD * 2 + PAS) / 3
  if (field.formulaPreset === 'pam' || field.name.toLowerCase().includes('pam') || field.name.toLowerCase().includes('presion_arterial_media')) {
    const pas = parseFloat(data.ta_sistolica ?? data.pas ?? data.tension_sistolica ?? 0);
    const pad = parseFloat(data.ta_diastolica ?? data.pad ?? data.tension_diastolica ?? 0);
    if (pas > 0 && pad > 0) {
      const pam = (pad * 2 + pas) / 3;
      return Math.round(pam * 10) / 10;
    }
    return null;
  }

  // Preset: Braden Score sum
  if (field.formulaPreset === 'braden' || field.name.toLowerCase().includes('braden')) {
    const bradenKeys = [
      'percepcion_sensorial',
      'humedad',
      'actividad',
      'movilidad',
      'nutricion',
      'friccion_cizallamiento',
    ];
    let sum = 0;
    let counted = 0;
    for (const key of bradenKeys) {
      const val = parseFloat(data[key]);
      if (!isNaN(val) && val > 0) {
        sum += val;
        counted++;
      }
    }
    return counted > 0 ? sum : null;
  }

  // Custom formula evaluator safely
  if (field.formula) {
    try {
      let expression = field.formula;
      // Replace variable names with their values from data
      for (const [key, val] of Object.entries(data)) {
        if (key && !isNaN(Number(val))) {
          // Replace isolated identifier
          const regex = new RegExp(`\\b${key}\\b`, 'g');
          expression = expression.replace(regex, String(Number(val)));
        }
      }
      // Safety check: expression should only contain numbers, math operators, spaces, parentheses
      if (!/^[0-9+\-*/().^% \t]+$/.test(expression)) {
        return null;
      }
      // Replace ^ with ** for power
      expression = expression.replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expression})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.round(result * 100) / 100;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Checks if a value falls outside of clinical normal ranges
 */
export function checkClinicalAlert(field: FormField, value: any): string | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return null;

  if (field.range) {
    if (field.range.min !== undefined && num < field.range.min) {
      return field.range.warningLow || `Valor bajo (< ${field.range.min} ${field.unit || ''})`;
    }
    if (field.range.max !== undefined && num > field.range.max) {
      return field.range.warningHigh || `Valor elevado (> ${field.range.max} ${field.unit || ''})`;
    }
  }

  // Built-in smart checks for common clinical names if no custom range is defined
  const n = field.name.toLowerCase();
  if ((n.includes('frecuencia_cardiaca') || n.includes('fc') || n.includes('frec_cardiaca')) && !field.range) {
    if (num < 50) return 'Bradicardia (< 50 lpm)';
    if (num > 100) return 'Taquicardia (> 100 lpm)';
  }
  if ((n.includes('saturacion') || n.includes('sato2') || n.includes('spo2')) && !field.range) {
    if (num < 92) return 'Desaturación / Hipoxemia (< 92%)';
  }
  if ((n.includes('temperatura') || n.includes('temp')) && !field.range) {
    if (num >= 38.0) return 'Fiebre (≥ 38.0 °C)';
    if (num <= 35.5) return 'Hipotermia (≤ 35.5 °C)';
  }
  if ((n.includes('sistolica') || n.includes('pas')) && !field.range) {
    if (num >= 140) return 'Cifra sistólica hipertensiva (≥ 140 mmHg)';
    if (num < 90) return 'Hipotensión sistólica (< 90 mmHg)';
  }

  return null;
}
