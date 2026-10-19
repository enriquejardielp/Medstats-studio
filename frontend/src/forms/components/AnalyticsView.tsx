import { useMemo, useState } from 'react';
import {
  BarChart3,
  Copy,
  Check,
  Activity,
} from 'lucide-react';
import type { ClinicalForm, RecordEntry } from '../types/clinical';
import { checkClinicalAlert } from '../utils/calculator';

interface AnalyticsViewProps {
  form: ClinicalForm;
  records: RecordEntry[];
}

export function AnalyticsView({ form, records }: AnalyticsViewProps) {
  const [copiedTable, setCopiedTable] = useState(false);

  // Global Quality Metrics
  const metrics = useMemo(() => {
    if (records.length === 0) {
      return {
        totalRecords: 0,
        completenessRate: 0,
        totalFieldsExpected: 0,
        totalFieldsFilled: 0,
        outlierAlertCount: 0,
      };
    }

    let totalExpected = 0;
    let totalFilled = 0;
    let outlierAlertCount = 0;

    records.forEach((rec) => {
      form.fields.forEach((field) => {
        totalExpected++;
        const val = rec.data[field.name];
        if (val !== undefined && val !== null && val !== '') {
          totalFilled++;
          if (checkClinicalAlert(field, val)) {
            outlierAlertCount++;
          }
        }
      });
    });

    const completenessRate = Math.round((totalFilled / (totalExpected || 1)) * 100);

    return {
      totalRecords: records.length,
      completenessRate,
      totalFieldsExpected: totalExpected,
      totalFieldsFilled: totalFilled,
      outlierAlertCount,
    };
  }, [form, records]);

  // Statistics per field
  const statsByField = useMemo(() => {
    return form.fields.map((field) => {
      const values = records
        .map((r) => r.data[field.name])
        .filter((v) => v !== undefined && v !== null && v !== '');

      const isNumeric = field.type === 'number' || field.type === 'calculated';

      if (isNumeric) {
        const numValues = values
          .map((v) => (typeof v === 'number' ? v : parseFloat(v)))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);

        if (numValues.length === 0) {
          return {
            field,
            isNumeric: true,
            count: 0,
            missing: records.length,
            mean: null,
            sd: null,
            min: null,
            max: null,
            median: null,
          };
        }

        const sum = numValues.reduce((acc, curr) => acc + curr, 0);
        const mean = sum / numValues.length;
        const variance =
          numValues.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) /
          (numValues.length > 1 ? numValues.length - 1 : 1);
        const sd = Math.sqrt(variance);
        const min = numValues[0];
        const max = numValues[numValues.length - 1];
        const median =
          numValues.length % 2 === 0
            ? (numValues[numValues.length / 2 - 1] + numValues[numValues.length / 2]) / 2
            : numValues[Math.floor(numValues.length / 2)];

        return {
          field,
          isNumeric: true,
          count: numValues.length,
          missing: records.length - numValues.length,
          mean: Math.round(mean * 10) / 10,
          sd: Math.round(sd * 10) / 10,
          min: Math.round(min * 10) / 10,
          max: Math.round(max * 10) / 10,
          median: Math.round(median * 10) / 10,
        };
      } else {
        // Categorical / Boolean / Select
        const freqMap: Record<string, number> = {};
        values.forEach((v) => {
          if (Array.isArray(v)) {
            v.forEach((item) => {
              const str = String(item);
              freqMap[str] = (freqMap[str] || 0) + 1;
            });
          } else if (typeof v === 'boolean') {
            const str = v ? 'Sí' : 'No';
            freqMap[str] = (freqMap[str] || 0) + 1;
          } else {
            const str = String(v);
            freqMap[str] = (freqMap[str] || 0) + 1;
          }
        });

        const sortedFreq = Object.entries(freqMap)
          .map(([key, count]) => ({
            label: key,
            count,
            percentage: Math.round((count / (records.length || 1)) * 100),
          }))
          .sort((a, b) => b.count - a.count);

        return {
          field,
          isNumeric: false,
          count: values.length,
          missing: records.length - values.length,
          frequencies: sortedFreq,
        };
      }
    });
  }, [form.fields, records]);

  // Generate Table 1 formatted plain text
  const table1Text = useMemo(() => {
    let lines = [`TABLA 1: CARACTERÍSTICAS BASALES Y CLÍNICAS (N = ${records.length})\n`];
    lines.push('Variable | Resumen | Rango / %');
    lines.push('----------------------------------------');

    statsByField.forEach((stat) => {
      if (stat.isNumeric) {
        if (stat.mean !== null) {
          lines.push(
            `${stat.field.label} (${stat.field.unit || '-'}) | Media: ${stat.mean} ± ${stat.sd} | [${stat.min} - ${stat.max}], Mediana: ${stat.median}`
          );
        }
      } else if (stat.frequencies && stat.frequencies.length > 0) {
        lines.push(`${stat.field.label} (n, %):`);
        stat.frequencies.slice(0, 4).forEach((f) => {
          lines.push(`  - ${f.label}: ${f.count} (${f.percentage}%)`);
        });
      }
    });

    return lines.join('\n');
  }, [statsByField, records.length]);

  const copyTable1 = () => {
    navigator.clipboard.writeText(table1Text);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Top Banner */}
      <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Estadísticas y Calidad de Datos</h1>
            <span className="text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded font-mono">
              Análisis Clínico Automático
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            Métricas de completitud, estadísticas descriptivas (media, DE, frecuencias) y detección de alertas clínicas para <span className="font-semibold text-slate-800">{form.title}</span>.
          </p>
        </div>

        <button
          onClick={copyTable1}
          disabled={records.length === 0}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors"
        >
          {copiedTable ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedTable ? 'Tabla 1 Copiada' : 'Copiar Tabla 1 para Informe'}</span>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
          <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-800 text-sm">No hay registros suficientes</h3>
          <p className="text-xs text-slate-500 mt-1">
            Rellena al menos un caso desde la pestaña "Rellenar Caso" para generar los estadísticos descriptivos.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Scorecards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Muestra Total (N)
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900">{metrics.totalRecords}</span>
                <span className="text-xs text-slate-500 font-mono">casos</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Registros en la cohorte activa</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tasa de Completitud
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-teal-700">{metrics.completenessRate}%</span>
                <span className="text-xs text-slate-500">
                  {metrics.totalFieldsFilled} / {metrics.totalFieldsExpected}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${metrics.completenessRate}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Variables Analizadas
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-indigo-700">{form.fields.length}</span>
                <span className="text-xs text-slate-500">{form.sections.length} secciones</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Columnas de datos clínicos</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Alertas Clínicas Detectadas
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-amber-700">{metrics.outlierAlertCount}</span>
                <span className="text-xs text-amber-600">valores fuera de rango</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Taquicardias, hipotensión, etc.</p>
            </div>
          </div>

          {/* Descriptive Statistics per Variable Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Estadística Descriptiva por Variable Clínica
                </h3>
              </div>
              <span className="text-xs text-slate-500">N = {records.length} pacientes</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {statsByField.map((stat) => (
                <div key={stat.field.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {stat.field.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                        {stat.field.name}
                      </span>
                      {stat.field.unit && (
                        <span className="text-[10px] text-teal-800 font-mono font-medium">
                          ({stat.field.unit})
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600 font-medium">
                        Sección: {stat.field.section}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Rellenado en {stat.count} de {records.length} casos ({Math.round((stat.count / records.length) * 100)}%)
                    </div>
                  </div>

                  {stat.isNumeric ? (
                    stat.mean !== null ? (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase">Media ± DE</span>
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            {stat.mean} ± {stat.sd}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase">Mediana</span>
                          <div className="font-mono font-bold text-slate-900 text-sm">{stat.median}</div>
                        </div>

                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase">Mínimo</span>
                          <div className="font-mono text-slate-700">{stat.min}</div>
                        </div>

                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase">Máximo</span>
                          <div className="font-mono text-slate-700">{stat.max}</div>
                        </div>

                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 uppercase">Rango Clínico</span>
                          <div className="font-mono text-[11px] text-teal-800">
                            {stat.field.range ? `${stat.field.range.min ?? '-'} a ${stat.field.range.max ?? '-'}` : 'Estándar'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">Sin datos numéricos registrados aún.</p>
                    )
                  ) : (
                    // Categorical frequencies
                    stat.frequencies && stat.frequencies.length > 0 ? (
                      <div className="space-y-1.5 pt-1.5">
                        {stat.frequencies.slice(0, 5).map((f) => (
                          <div key={f.label} className="flex items-center gap-2 text-xs">
                            <span className="w-48 truncate text-slate-700 font-medium" title={f.label}>
                              {f.label}
                            </span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-teal-600 h-2 rounded-full"
                                style={{ width: `${f.percentage}%` }}
                              ></div>
                            </div>
                            <span className="w-16 text-right font-mono text-[11px] text-slate-600">
                              {f.count} ({f.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">Sin respuestas categóricas registradas.</p>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
