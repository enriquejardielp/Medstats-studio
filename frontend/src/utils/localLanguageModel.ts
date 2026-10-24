import type { FormField } from '../forms/types/clinical';

const MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX';
type ProgressInfo = { status?: string; file?: string; progress?: number };
type ProgressCallback = (info: ProgressInfo) => void;

let generatorPromise: Promise<any> | null = null;

async function getGenerator(onProgress?: ProgressCallback) {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.allowRemoteModels = true;
      env.useBrowserCache = true;

      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      const dtype = device === 'webgpu' ? 'q4f16' : 'q4';
      try {
        return await pipeline('text-generation', MODEL_ID, {
          device,
          dtype,
          progress_callback: onProgress,
        } as any);
      } catch (gpuError) {
        if (device !== 'webgpu') throw gpuError;
        onProgress?.({ status: 'fallback', progress: 0 });
        return pipeline('text-generation', MODEL_ID, {
          device: 'wasm',
          dtype: 'q4',
          progress_callback: onProgress,
        } as any);
      }
    })().catch((error) => {
      generatorPromise = null;
      throw error;
    });
  }
  return generatorPromise;
}

function readGeneratedText(output: any): string {
  const generated = output?.[0]?.generated_text;
  const text = Array.isArray(generated)
    ? generated.at(-1)?.content
    : typeof generated === 'string'
      ? generated
      : '';
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export async function generateLocalJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  onProgress?: ProgressCallback,
): Promise<T> {
  const generator = await getGenerator(onProgress);
  const output = await generator(
    [
      { role: 'system', content: `${systemPrompt}\n/no_think\nNo generes bloques de razonamiento. Responde únicamente con JSON válido.` },
      { role: 'user', content: userPrompt },
    ],
    { max_new_tokens: 1000, do_sample: false, temperature: 0 },
  );

  const generatedText = readGeneratedText(output);
  const unfenced = generatedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('El modelo no devolvió una respuesta estructurada. Prueba a concretar la petición.');
  }
  try {
    return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1)) as T;
  } catch {
    throw new Error('No se pudo leer la respuesta del modelo. Prueba a concretar la petición.');
  }
}

export interface ClinicalAIValue {
  value: unknown;
  evidence: string;
}

export interface ClinicalAIResponse {
  extractedData?: Record<string, ClinicalAIValue>;
}

const normalizeEvidence = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

function exactFormOption(value: unknown, options: string[]): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeEvidence(value);
  return options.find(option => normalizeEvidence(option) === normalized) || null;
}

function validateExtractedValue(field: FormField, value: unknown): unknown {
  if (field.type === 'number') {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN;
    if (!Number.isFinite(parsed)) return undefined;
    const min = field.min ?? field.range?.min;
    const max = field.max ?? field.range?.max;
    if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) return undefined;
    return parsed;
  }
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : undefined;
  if (field.type === 'select' || field.type === 'radio') {
    return exactFormOption(value, field.options || []) || undefined;
  }
  if (field.type === 'multiselect') {
    if (!Array.isArray(value)) return undefined;
    const accepted = value
      .map(item => exactFormOption(item, field.options || []))
      .filter((item): item is string => Boolean(item));
    return accepted.length ? Array.from(new Set(accepted)) : undefined;
  }
  if (field.type === 'date') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : undefined;
  }
  if (field.type === 'time') {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value) ? value : undefined;
  }
  if (field.type === 'text' || field.type === 'textarea') {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
  return undefined;
}

export function validateClinicalAIResponse(
  response: ClinicalAIResponse,
  text: string,
  fields: FormField[],
) {
  const fieldByName = new Map(fields.map(field => [field.name, field]));
  const normalizedText = normalizeEvidence(text);
  const matches = [];

  for (const [name, candidate] of Object.entries(response.extractedData || {})) {
    const field = fieldByName.get(name);
    if (!field || !candidate || typeof candidate !== 'object') continue;
    const evidence = typeof candidate.evidence === 'string' ? candidate.evidence.trim() : '';
    const normalizedQuote = normalizeEvidence(evidence);
    if (normalizedQuote.length < 3 || !normalizedText.includes(normalizedQuote)) continue;

    const value = validateExtractedValue(field, candidate.value);
    if (value === undefined) continue;
    matches.push({
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.type,
      extractedValue: value,
      formattedDisplay: Array.isArray(value) ? value.join(', ') : String(value) + (field.unit ? ` ${field.unit}` : ''),
      confidence: 'medium' as const,
      rawSnippet: evidence,
      unit: field.unit,
    });
  }
  return matches;
}

export function buildClinicalExtractionPrompt(text: string, fields: FormField[]) {
  const schema = fields.map(field => ({
    name: field.name,
    label: field.label,
    type: field.type,
    unit: field.unit,
    options: field.options,
    min: field.min ?? field.range?.min,
    max: field.max ?? field.range?.max,
  }));
  return JSON.stringify({
    clinicalText: text.slice(0, 24000),
    fields: schema,
    outputContract: {
      extractedData: {
        exact_field_name: {
          value: 'type-compatible value',
          evidence: 'verbatim quote copied exactly from clinicalText',
        },
      },
    },
    rules: [
      'Return only values explicitly stated in the text; never infer, diagnose, calculate or fill an absent value.',
      'Use only exact field names listed in fields. Omit unknown or ambiguous values.',
      'For number fields return a JSON number in the field unit; convert decimal comma to decimal point only.',
      'For select/radio use an exact option; for multiselect return an array of exact options.',
      'For boolean fields return true/false only when the text explicitly supports it.',
      'For date use YYYY-MM-DD and time use HH:mm only when unambiguous.',
      'Every value must include a short exact evidence quote copied from clinicalText. Do not paraphrase the quote.',
      'Return valid JSON and no markdown.',
    ],
  });
}
