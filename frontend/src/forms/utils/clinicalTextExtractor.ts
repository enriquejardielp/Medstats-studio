import type { FormField } from '../types/clinical';

export interface ExtractedFieldMatch {
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  extractedValue: any;
  formattedDisplay: string;
  confidence: 'high' | 'medium';
  rawSnippet: string;
  unit?: string;
}

/**
 * Extracts structured clinical field values from unstructured medical text (labs, echo, history, vitals)
 */
export function extractFieldsFromClinicalText(
  text: string,
  targetFields: FormField[]
): ExtractedFieldMatch[] {
  if (!text || !text.trim() || !targetFields || targetFields.length === 0) {
    return [];
  }

  // Clean quotes (including Spanish smart quotes “ ” « »), replace line endings, and normalize spaces
  const cleanText = text
    .replace(/[\u201C\u201D\u201E\u201F"«»']/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
  const results: ExtractedFieldMatch[] = [];
  const matchedFieldNames = new Set<string>();

  // Helper to extract a number right after a label pattern
  const extractNumericValue = (patterns: RegExp[]): { val: number; snippet: string } | null => {
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        // Find group with number
        const rawNumStr = match[1] || match[2];
        if (rawNumStr) {
          const sanitized = rawNumStr.replace(',', '.');
          const parsed = parseFloat(sanitized);
          if (!isNaN(parsed)) {
            return { val: parsed, snippet: match[0].trim() };
          }
        }
      }
    }
    return null;
  };

  // 1. Specialized clinical extractions by common medical concepts
  for (const field of targetFields) {
    const fn = field.name.toLowerCase();
    const fl = field.label.toLowerCase();

    // --- DEMOGRAPHICS: AGE (EDAD) ---
    if (fn === 'edad' || fn.includes('edad') || fl.includes('edad') || fn.includes('age') || fl.includes('años') || fl.includes('anos')) {
      if (field.type === 'number') {
        const ageMatch = cleanText.match(/(?:(?:var[oó]n|mujer|paciente|hombre|sujeto)\s+de\s+)?([0-9]{1,3})\s*(?:a[ñn]os(?:\s+de\s+edad)?|\s+a\b)/i) ||
                         cleanText.match(/(?:edad|age)[\s:=-]+([0-9]{1,3})/i) ||
                         cleanText.match(/\b([0-9]{1,3})\s*a[ñn]os\b/i);
        if (ageMatch && ageMatch[1]) {
          const val = parseInt(ageMatch[1], 10);
          if (!isNaN(val) && val >= 0 && val <= 130) {
            results.push({
              fieldName: field.name,
              fieldLabel: field.label,
              fieldType: field.type,
              extractedValue: val,
              formattedDisplay: `${val} años`,
              confidence: 'high',
              rawSnippet: ageMatch[0].trim(),
              unit: field.unit || 'años',
            });
            matchedFieldNames.add(field.name);
            continue;
          }
        }
      }
    }

    // --- DEMOGRAPHICS: BIOLOGICAL SEX / GENDER (SEXO / GÉNERO) ---
    if (fn.includes('sexo') || fn.includes('genero') || fn.includes('género') || fl.includes('sexo') || fl.includes('género') || fl.includes('genero') || fn === 'sex') {
      const isMale = /\b(?:var[oó]n|varon|hombre|masculino|masc)\b/i.test(cleanText);
      const isFemale = /\b(?:mujer|femenino|fem|hembra)\b/i.test(cleanText);

      if (isMale || isFemale) {
        let extractedVal: any = null;
        const snippet = isMale
          ? (cleanText.match(/\b(?:var[oó]n|varon|hombre|masculino|masc)\b/i)?.[0] || 'Varón')
          : (cleanText.match(/\b(?:mujer|femenino|fem|hembra)\b/i)?.[0] || 'Mujer');

        if (field.type === 'select' || field.type === 'radio') {
          if (isMale) {
            extractedVal = 'Masculino';
            const opts = field.options;
            if (opts && opts.length > 0) {
              const matchedOpt = opts.find(o => /masculino/i.test(o)) ||
                                 opts.find(o => /var[oó]n/i.test(o)) ||
                                 opts.find(o => /hombre/i.test(o)) ||
                                 opts.find(o => o.trim().toUpperCase() === 'V') ||
                                 opts.find(o => o.trim().toUpperCase() === 'M' && !opts.some(x => /femenino/i.test(x)));
              if (matchedOpt) extractedVal = matchedOpt;
            }
          } else {
            extractedVal = 'Femenino';
            const opts = field.options;
            if (opts && opts.length > 0) {
              const matchedOpt = opts.find(o => /femenino/i.test(o)) ||
                                 opts.find(o => /mujer/i.test(o)) ||
                                 opts.find(o => o.trim().toUpperCase() === 'F');
              if (matchedOpt) extractedVal = matchedOpt;
            }
          }
        } else if (field.type === 'text') {
          extractedVal = isMale ? 'Masculino' : 'Femenino';
        }

        if (extractedVal) {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: extractedVal,
            formattedDisplay: String(extractedVal),
            confidence: 'high',
            rawSnippet: snippet,
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // --- BLOOD PRESSURE ---
    if (fn.includes('ta_sistolica') || fn.includes('tas') || fl.includes('sistólica') || fl.includes('sistolica')) {
      const bpMatch = cleanText.match(/(?:TA|PA|Presi[oó]n\s*Arterial|Tensi[oó]n|T\.A\.)[\s:]*([0-9]{2,3})\s*[\/|\\]\s*([0-9]{2,3})/i) ||
                      cleanText.match(/(?:TAS|PAS|Sist[oó]lica)[\s:]*([0-9]{2,3})/i);
      if (bpMatch) {
        const val = parseInt(bpMatch[1], 10);
        if (!isNaN(val)) {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: val,
            formattedDisplay: `${val} mmHg`,
            confidence: 'high',
            rawSnippet: bpMatch[0],
            unit: 'mmHg',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    if (fn.includes('ta_diastolica') || fn.includes('tad') || fl.includes('diastólica') || fl.includes('diastolica')) {
      const bpMatch = cleanText.match(/(?:TA|PA|Presi[oó]n\s*Arterial|Tensi[oó]n|T\.A\.)[\s:]*([0-9]{2,3})\s*[\/|\\]\s*([0-9]{2,3})/i);
      if (bpMatch && bpMatch[2]) {
        const val = parseInt(bpMatch[2], 10);
        if (!isNaN(val)) {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: val,
            formattedDisplay: `${val} mmHg`,
            confidence: 'high',
            rawSnippet: bpMatch[0],
            unit: 'mmHg',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      } else {
        const tadMatch = cleanText.match(/(?:TAD|PAD|Diast[oó]lica)[\s:]*([0-9]{2,3})/i);
        if (tadMatch) {
          const val = parseInt(tadMatch[1], 10);
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: val,
            formattedDisplay: `${val} mmHg`,
            confidence: 'high',
            rawSnippet: tadMatch[0],
            unit: 'mmHg',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // --- HEART RATE ---
    if (fn.includes('frecuencia_cardiaca') || fn.includes('fc') || fl.includes('frecuencia cardíaca') || fl.includes('cardíaca') || fl.includes('cardiaca') || fl.includes('pulso')) {
      const fcMatch = extractNumericValue([
        /(?:FC|Frecuencia\s*Card[ií]aca|Pulso)[\s:]*([0-9]{2,3})/i,
        /([0-9]{2,3})\s*(?:lpm|bpm|latidos\/min)/i,
      ]);
      if (fcMatch) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: fcMatch.val,
          formattedDisplay: `${fcMatch.val} lpm`,
          confidence: 'high',
          rawSnippet: fcMatch.snippet,
          unit: 'lpm',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // --- OXYGEN SATURATION ---
    if (fn.includes('saturacion') || fn.includes('sato2') || fn.includes('spo2') || fl.includes('saturación') || fl.includes('oxígeno') || fl.includes('spo2')) {
      const satMatch = extractNumericValue([
        /(?:Sat(?:uraci[oó]n)?(?:\s*O2|\s*de\s*O2)?|SpO2|SatO2)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)\s*%/i,
        /(?:Sat(?:uraci[oó]n)?(?:\s*O2|\s*de\s*O2)?|SpO2|SatO2)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)/i,
        /([0-9]{2,3})\s*%\s*(?:aire\s*ambiente|aa|basal|ox[ií]geno)/i,
      ]);
      if (satMatch) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: satMatch.val,
          formattedDisplay: `${satMatch.val} %`,
          confidence: 'high',
          rawSnippet: satMatch.snippet,
          unit: '%',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // --- TEMPERATURE ---
    if (fn.includes('temperatura') || fn.includes('temp') || fl.includes('temperatura') || fl.includes('febril')) {
      const tempMatch = extractNumericValue([
        /(?:Temperatura|Temp|T[ªa])[\s:]*([0-9]{2}(?:[.,][0-9]{1,2})?)\s*(?:º?C|grados)/i,
        /(?:Temperatura|Temp|T[ªa])[\s:]*([0-9]{2}(?:[.,][0-9]{1,2})?)/i,
        /([0-9]{2}(?:[.,][0-9]{1,2})?)\s*º?C/i,
      ]);
      if (tempMatch && tempMatch.val >= 32 && tempMatch.val <= 44) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: tempMatch.val,
          formattedDisplay: `${tempMatch.val} ºC`,
          confidence: 'high',
          rawSnippet: tempMatch.snippet,
          unit: 'ºC',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // --- RESPIRATORY RATE ---
    if (fn.includes('respiratoria') || fn.includes('fr') || fl.includes('respiratoria')) {
      const frMatch = extractNumericValue([
        /(?:FR|Frecuencia\s*Respiratoria)[\s:]*([0-9]{1,2})/i,
        /([0-9]{1,2})\s*(?:rpm|resp\/min|resp\.\/min)/i,
      ]);
      if (frMatch && frMatch.val >= 6 && frMatch.val <= 60) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: frMatch.val,
          formattedDisplay: `${frMatch.val} rpm`,
          confidence: 'high',
          rawSnippet: frMatch.snippet,
          unit: 'rpm',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // --- WEIGHT / HEIGHT ---
    if (fn.includes('peso') || fl.includes('peso')) {
      const pesoMatch = extractNumericValue([
        /(?:Peso(?:\s*actual)?)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)\s*kg/i,
        /(?:Peso(?:\s*actual)?)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)/i,
        /([0-9]{2,3}(?:[.,][0-9])?)\s*kg/i,
      ]);
      if (pesoMatch && pesoMatch.val >= 20 && pesoMatch.val <= 300) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: pesoMatch.val,
          formattedDisplay: `${pesoMatch.val} kg`,
          confidence: 'high',
          rawSnippet: pesoMatch.snippet,
          unit: 'kg',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    if (fn.includes('talla') || fn.includes('altura') || fl.includes('talla') || fl.includes('altura')) {
      const tallaMatch = extractNumericValue([
        /(?:Talla|Altura|Estatura)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)\s*cm/i,
        /(?:Talla|Altura|Estatura)[\s:]*([0-9]{2,3})/i,
        /(?:Talla|Altura|Estatura)[\s:]*([12][.,][0-9]{2})\s*m/i,
      ]);
      if (tallaMatch) {
        let val = tallaMatch.val;
        if (val < 3 && val > 0.5) val = Math.round(val * 100); // convert meters to cm
        if (val >= 50 && val <= 240) {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: val,
            formattedDisplay: `${val} cm`,
            confidence: 'high',
            rawSnippet: tallaMatch.snippet,
            unit: 'cm',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // --- ECHOCARDIOGRAM & IMAGING PARAMETERS ---
    // FEVI (Ejection Fraction)
    if (fn.includes('fevi') || fl.includes('fevi') || fl.includes('fracción de eyección') || fl.includes('fraccion de eyeccion')) {
      const feviMatch = extractNumericValue([
        /(?:FEVI|FE\s*VI|Fracci[oó]n\s*de\s*Eyecci[oó]n(?:\s*del\s*VI)?)[\s:]*([0-9]{1,2}(?:[.,][0-9])?)\s*%/i,
        /(?:FEVI|FE\s*VI|Fracci[oó]n\s*de\s*Eyecci[oó]n(?:\s*del\s*VI)?)[\s:]*([0-9]{1,2}(?:[.,][0-9])?)/i,
      ]);
      if (feviMatch && feviMatch.val <= 90 && feviMatch.val >= 5) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: feviMatch.val,
          formattedDisplay: `${feviMatch.val} %`,
          confidence: 'high',
          rawSnippet: feviMatch.snippet,
          unit: '%',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // DTDVI (LV End-diastolic Diameter)
    if (fn.includes('dtdvi') || fn.includes('diametro_telediastolico') || fl.includes('dtdvi') || fl.includes('telediastólico') || fl.includes('telediastolico')) {
      const dtdviMatch = extractNumericValue([
        /(?:DTDVI|Di[aá]metro\s*Telediast[oó]lico(?:\s*del\s*VI)?)[\s:]*([0-9]{2}(?:[.,][0-9])?)\s*mm/i,
        /(?:DTDVI|Di[aá]metro\s*Telediast[oó]lico(?:\s*del\s*VI)?)[\s:]*([0-9]{2}(?:[.,][0-9])?)/i,
      ]);
      if (dtdviMatch && dtdviMatch.val >= 20 && dtdviMatch.val <= 110) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: dtdviMatch.val,
          formattedDisplay: `${dtdviMatch.val} mm`,
          confidence: 'high',
          rawSnippet: dtdviMatch.snippet,
          unit: 'mm',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // AVA (Aortic Valve Area)
    if (fn.includes('area_valvular') || fn.includes('ava') || fl.includes('área valvular aórtica') || fl.includes('area valvular aortica') || fl.includes('ava')) {
      const avaMatch = extractNumericValue([
        /(?:[AÁ]rea\s*Valvular\s*A[oó]rtica|AVA)[\s:]*([0-9](?:[.,][0-9]{1,2})?)\s*(?:cm2|cm²)/i,
        /(?:[AÁ]rea\s*Valvular\s*A[oó]rtica|AVA)[\s:]*([0-9](?:[.,][0-9]{1,2})?)/i,
        /([0-9](?:[.,][0-9]{1,2})?)\s*(?:cm2|cm²)\s*(?:de\s*[aá]rea|por\s*ecuaci[oó]n)/i,
      ]);
      if (avaMatch && avaMatch.val >= 0.2 && avaMatch.val <= 4.5) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: avaMatch.val,
          formattedDisplay: `${avaMatch.val} cm²`,
          confidence: 'high',
          rawSnippet: avaMatch.snippet,
          unit: 'cm²',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Vmax (Peak Aortic Velocity)
    if (fn.includes('velocidad_maxima') || fn.includes('vmax') || fl.includes('velocidad pico') || fl.includes('vmax') || fl.includes('velocidad máxima')) {
      const vmaxMatch = extractNumericValue([
        /(?:Velocidad\s*Pico|Velocidad\s*M[aá]xima|Vmax|V\.max)[\s:]*([0-9](?:[.,][0-9]{1,2})?)\s*(?:m\/s|m\/seg)/i,
        /(?:Velocidad\s*Pico|Velocidad\s*M[aá]xima|Vmax|V\.max)[\s:]*([0-9](?:[.,][0-9]{1,2})?)/i,
        /([0-9](?:[.,][0-9]{1,2})?)\s*(?:m\/s|m\/seg)/i,
      ]);
      if (vmaxMatch && vmaxMatch.val >= 0.5 && vmaxMatch.val <= 9.0) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: vmaxMatch.val,
          formattedDisplay: `${vmaxMatch.val} m/s`,
          confidence: 'high',
          rawSnippet: vmaxMatch.snippet,
          unit: 'm/s',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Mean Aortic Gradient
    if (fn.includes('gradiente_medio') || fl.includes('gradiente medio')) {
      const gradMatch = extractNumericValue([
        /(?:Gradiente\s*Medio(?:\s*transa[oó]rtico)?)[\s:]*([0-9]{1,3}(?:[.,][0-9])?)\s*mmHg/i,
        /(?:Gradiente\s*Medio(?:\s*transa[oó]rtico)?)[\s:]*([0-9]{1,3}(?:[.,][0-9])?)/i,
      ]);
      if (gradMatch && gradMatch.val >= 2 && gradMatch.val <= 150) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: gradMatch.val,
          formattedDisplay: `${gradMatch.val} mmHg`,
          confidence: 'high',
          rawSnippet: gradMatch.snippet,
          unit: 'mmHg',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Valvulopathy significant / Aortic stenosis severity (multiselect or select)
    if (fn.includes('valvulopatia') || fl.includes('valvulopatía') || fl.includes('valvulopatia')) {
      const selectedOptions: string[] = [];
      let snippet = '';
      if (/estenosis\s*a[oó]rtica\s*severa|estenosis\s*a[oó]rtica\s*grave/i.test(cleanText)) {
        selectedOptions.push('Estenosis Aórtica Severa');
        snippet = 'estenosis aórtica severa';
      } else if (/estenosis\s*a[oó]rtica\s*moderada/i.test(cleanText)) {
        selectedOptions.push('Estenosis Aórtica Moderada');
        snippet = 'estenosis aórtica moderada';
      }
      if (/insuficiencia\s*mitral(?:\s*significativa|\s*moderada|\s*severa)/i.test(cleanText)) {
        selectedOptions.push('Insuficiencia Mitral Significativa');
        snippet += (snippet ? ', ' : '') + 'insuficiencia mitral';
      }
      if (/insuficiencia\s*a[oó]rtica(?:\s*significativa|\s*moderada|\s*severa)/i.test(cleanText)) {
        selectedOptions.push('Insuficiencia Aórtica Significativa');
      }
      if (selectedOptions.length > 0) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: field.type === 'multiselect' ? selectedOptions : selectedOptions[0],
          formattedDisplay: selectedOptions.join(', '),
          confidence: 'high',
          rawSnippet: snippet || selectedOptions.join(', '),
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Calcium score Agatston
    if (fn.includes('agatston') || fn.includes('calcio') || fl.includes('agatston') || fl.includes('calcio coronario')) {
      const calcMatch = extractNumericValue([
        /(?:Score\s*de\s*Calcio|Agatston|Calcio\s*Coronario)[\s:]*([0-9]{1,5})\s*(?:UA|unidades)?/i,
      ]);
      if (calcMatch) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: calcMatch.val,
          formattedDisplay: `${calcMatch.val} UA`,
          confidence: 'high',
          rawSnippet: calcMatch.snippet,
          unit: 'UA',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // --- LABORATORY ANALYTICS ---
    // Glucose
    if (fn.includes('glucosa') || fl.includes('glucosa') || fl.includes('glicemia') || fl.includes('glucemia')) {
      const gluMatch = extractNumericValue([
        /(?:Glucosa|Glucemia|Glicemia)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)\s*(?:mg\/dL|mg\/dl)/i,
        /(?:Glucosa|Glucemia|Glicemia)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)/i,
      ]);
      if (gluMatch && gluMatch.val >= 30 && gluMatch.val <= 1000) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: gluMatch.val,
          formattedDisplay: `${gluMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: gluMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Creatinine
    if (fn.includes('creatinina') || fl.includes('creatinina')) {
      const crMatch = extractNumericValue([
        /(?:Creatinina(?:\s*en\s*suero)?)[\s:]*([0-9]{1,2}(?:[.,][0-9]{1,2})?)\s*(?:mg\/dL|mg\/dl)/i,
        /(?:Creatinina(?:\s*en\s*suero)?)[\s:]*([0-9]{1,2}(?:[.,][0-9]{1,2})?)/i,
      ]);
      if (crMatch && crMatch.val >= 0.2 && crMatch.val <= 20) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: crMatch.val,
          formattedDisplay: `${crMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: crMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Urea
    if (fn.includes('urea') || fl.includes('urea') || fn.includes('bun') || fl.includes('bun')) {
      const ureaMatch = extractNumericValue([
        /(?:Urea|BUN)[\s:]*([0-9]{1,3}(?:[.,][0-9])?)\s*(?:mg\/dL|mg\/dl)/i,
        /(?:Urea|BUN)[\s:]*([0-9]{1,3}(?:[.,][0-9])?)/i,
      ]);
      if (ureaMatch && ureaMatch.val >= 5 && ureaMatch.val <= 350) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: ureaMatch.val,
          formattedDisplay: `${ureaMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: ureaMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // HbA1c
    if (fn.includes('hba1c') || fn.includes('hemoglobina_glicosilada') || fl.includes('hba1c') || fl.includes('glicosilada') || fl.includes('glucosilada')) {
      const hba1cMatch = extractNumericValue([
        /(?:HbA1c|Hb\s*A1c|Hemoglobina\s*glicosilada)[\s:]*([0-9]{1,2}(?:[.,][0-9])?)\s*%/i,
        /(?:HbA1c|Hb\s*A1c|Hemoglobina\s*glicosilada)[\s:]*([0-9]{1,2}(?:[.,][0-9])?)/i,
      ]);
      if (hba1cMatch && hba1cMatch.val >= 3 && hba1cMatch.val <= 20) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: hba1cMatch.val,
          formattedDisplay: `${hba1cMatch.val} %`,
          confidence: 'high',
          rawSnippet: hba1cMatch.snippet,
          unit: '%',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Hemoglobin
    if ((fn.includes('hemoglobina') && !fn.includes('glicosilada')) || (fl.includes('hemoglobina') && !fl.includes('glicosilada')) || fn === 'hb') {
      const hbMatch = extractNumericValue([
        /(?:Hemoglobina|Hb)(?!\s*A1c)[\s:]*([0-9]{1,2}(?:[.,][0-9])?)\s*(?:g\/dL|g\/dl)/i,
        /(?:Hemoglobina|Hb)(?!\s*A1c)[\s:]*([0-9]{1,2}(?:[.,][0-9])?)/i,
      ]);
      if (hbMatch && hbMatch.val >= 3 && hbMatch.val <= 24) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: hbMatch.val,
          formattedDisplay: `${hbMatch.val} g/dL`,
          confidence: 'high',
          rawSnippet: hbMatch.snippet,
          unit: 'g/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Platelets (Plaquetas)
    if (fn.includes('plaquetas') || fl.includes('plaquetas')) {
      const plqMatch = extractNumericValue([
        /(?:Plaquetas|Plaq)[\s:]*([0-9]{2,3}(?:[.,][0-9]{3})?|[0-9]{2,6})\s*(?:\/uL|\/mm3|x10\^3)?/i,
      ]);
      if (plqMatch) {
        let val = plqMatch.val;
        if (val < 1000 && val > 20) val = val * 1000; // e.g. 250 x 10^3
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: val,
          formattedDisplay: `${val.toLocaleString()} /µL`,
          confidence: 'high',
          rawSnippet: plqMatch.snippet,
          unit: '/µL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Leukocytes (Leucocitos)
    if (fn.includes('leucocitos') || fl.includes('leucocitos') || fn.includes('glóbulos_blancos')) {
      const leuMatch = extractNumericValue([
        /(?:Leucocitos|Gl[oó]bulos\s*blancos|WBC)[\s:]*([0-9]{1,2}(?:[.,][0-9]{3})?|[0-9]{3,6})\s*(?:\/uL|\/mm3)?/i,
      ]);
      if (leuMatch) {
        let val = leuMatch.val;
        if (val < 100 && val > 0.5) val = val * 1000;
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: val,
          formattedDisplay: `${val.toLocaleString()} /µL`,
          confidence: 'high',
          rawSnippet: leuMatch.snippet,
          unit: '/µL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Sodium (Na) / Potassium (K)
    if (fn.includes('potasio') || fl.includes('potasio') || fn === 'k') {
      const kMatch = extractNumericValue([
        /(?:Potasio|K\+)[\s:]*([0-9](?:[.,][0-9]{1,2})?)\s*(?:mEq\/L|mmol\/L)?/i,
      ]);
      if (kMatch && kMatch.val >= 1.5 && kMatch.val <= 9.0) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: kMatch.val,
          formattedDisplay: `${kMatch.val} mEq/L`,
          confidence: 'high',
          rawSnippet: kMatch.snippet,
          unit: 'mEq/L',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    if (fn.includes('sodio') || fl.includes('sodio') || fn === 'na') {
      const naMatch = extractNumericValue([
        /(?:Sodio|Na\+)[\s:]*([0-9]{3}(?:[.,][0-9])?)\s*(?:mEq\/L|mmol\/L)?/i,
      ]);
      if (naMatch && naMatch.val >= 100 && naMatch.val <= 180) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: naMatch.val,
          formattedDisplay: `${naMatch.val} mEq/L`,
          confidence: 'high',
          rawSnippet: naMatch.snippet,
          unit: 'mEq/L',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Troponin (Troponina)
    if (fn.includes('troponina') || fl.includes('troponina')) {
      const tropMatch = extractNumericValue([
        /(?:Troponina(?:\s*I|\s*T)?(?:\s*ultrasensible|\s*us)?|hs-cTnI|hs-cTnT)[\s:]*([0-9]{1,5}(?:[.,][0-9]{1,2})?)\s*(?:ng\/L|ng\/mL|pg\/mL)?/i,
      ]);
      if (tropMatch) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: tropMatch.val,
          formattedDisplay: `${tropMatch.val} ng/L`,
          confidence: 'high',
          rawSnippet: tropMatch.snippet,
          unit: 'ng/L',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // NT-proBNP / BNP
    if (fn.includes('bnp') || fl.includes('bnp') || fl.includes('probnp') || fl.includes('pro-bnp')) {
      const bnpMatch = extractNumericValue([
        /(?:NT-proBNP|NTproBNP|BNP)[\s:]*([0-9]{1,6}(?:[.,][0-9])?)\s*(?:pg\/mL|pg\/ml)?/i,
      ]);
      if (bnpMatch) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: bnpMatch.val,
          formattedDisplay: `${bnpMatch.val} pg/mL`,
          confidence: 'high',
          rawSnippet: bnpMatch.snippet,
          unit: 'pg/mL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // CRP (Proteína C reactiva)
    if (fn.includes('pcr') || fl.includes('proteína c reactiva') || fl.includes('proteina c reactiva') || fl.includes('pcr')) {
      const pcrMatch = extractNumericValue([
        /(?:Prote[ií]na\s*C\s*reactiva|PCR)(?!\s*reversa)[\s:]*([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*(?:mg\/L|mg\/dL)?/i,
      ]);
      if (pcrMatch) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: pcrMatch.val,
          formattedDisplay: `${pcrMatch.val} mg/L`,
          confidence: 'high',
          rawSnippet: pcrMatch.snippet,
          unit: 'mg/L',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Lipid profile (Colesterol, LDL, HDL, Triglicéridos)
    if (fn.includes('colesterol_total') || (fn.includes('colesterol') && !fn.includes('ldl') && !fn.includes('hdl')) || (fl.includes('colesterol total'))) {
      const colMatch = extractNumericValue([
        /(?:Colesterol(?:\s*total)?)[\s:]*([0-9]{2,3}(?:[.,][0-9])?)\s*(?:mg\/dL|mg\/dl)?/i,
      ]);
      if (colMatch && colMatch.val >= 50 && colMatch.val <= 600) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: colMatch.val,
          formattedDisplay: `${colMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: colMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    if (fn.includes('ldl') || fl.includes('ldl')) {
      const ldlMatch = extractNumericValue([
        /(?:Colesterol\s*LDL|c-LDL|LDL)[\s:]*([0-9]{1,3}(?:[.,][0-9])?)\s*(?:mg\/dL|mg\/dl)?/i,
      ]);
      if (ldlMatch && ldlMatch.val >= 15 && ldlMatch.val <= 450) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: ldlMatch.val,
          formattedDisplay: `${ldlMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: ldlMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    if (fn.includes('hdl') || fl.includes('hdl')) {
      const hdlMatch = extractNumericValue([
        /(?:Colesterol\s*HDL|c-HDL|HDL)[\s:]*([0-9]{1,3}(?:[.,][0-9])?)\s*(?:mg\/dL|mg\/dl)?/i,
      ]);
      if (hdlMatch && hdlMatch.val >= 10 && hdlMatch.val <= 150) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: hdlMatch.val,
          formattedDisplay: `${hdlMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: hdlMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    if (fn.includes('trigliceridos') || fl.includes('triglicéridos') || fl.includes('trigliceridos')) {
      const tgMatch = extractNumericValue([
        /(?:Triglic[eé]ridos|TG)[\s:]*([0-9]{2,4}(?:[.,][0-9])?)\s*(?:mg\/dL|mg\/dl)?/i,
      ]);
      if (tgMatch && tgMatch.val >= 20 && tgMatch.val <= 2000) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: tgMatch.val,
          formattedDisplay: `${tgMatch.val} mg/dL`,
          confidence: 'high',
          rawSnippet: tgMatch.snippet,
          unit: 'mg/dL',
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // --- MEDICAL HISTORY & CARDIOVASCULAR RISK FACTORS ---
    // Hypertension (HTA)
    if (fn.includes('hta') || fn.includes('hipertension') || fl.includes('hipertensión') || fl.includes('hipertension') || fl.includes('hipertenso') || fn.includes('hipertenso')) {
      const mentionsHTA = /(?:hipertensi[oó]n|hipertenso|hipertensa|hta)\b/i.test(cleanText);
      const negatesHTA = /no\s+(?:hipertensi[oó]n|hipertenso|hipertensa|hta)|sin\s+hta/i.test(cleanText);

      if (mentionsHTA || negatesHTA) {
        const isHTA = mentionsHTA && !negatesHTA;
        if (field.type === 'boolean') {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isHTA,
            formattedDisplay: isHTA ? 'Sí' : 'No',
            confidence: 'high',
            rawSnippet: isHTA ? 'Hipertensión confirmada en texto' : 'Sin hipertensión',
          });
          matchedFieldNames.add(field.name);
          continue;
        } else if (field.type === 'select' || field.type === 'radio') {
          const detected = isHTA
            ? (field.options?.find(o => /s[ií]|hta|hiperten/i.test(o)) || 'Sí')
            : (field.options?.find(o => /^no\b|sin\s*hta|normotenso/i.test(o)) || 'No');
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: detected,
            formattedDisplay: detected,
            confidence: 'high',
            rawSnippet: isHTA ? 'Hipertensión' : 'Sin HTA',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // Diabetes Mellitus
    if (fn.includes('diabetes') || fl.includes('diabetes') || fn.includes('diabetico') || fl.includes('diabético')) {
      const mentionsDM = /(?:diabetes\s*mellitus|diabetes|diab[eé]tic[oa]|dm1|dm2)\b/i.test(cleanText);
      const negatesDM = /no\s+diab[eé]tic|sin\s+diabetes|niega\s+diabetes/i.test(cleanText);

      if (mentionsDM || negatesDM) {
        const isDM = mentionsDM && !negatesDM;
        if (field.type === 'boolean') {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isDM,
            formattedDisplay: isDM ? 'Sí' : 'No',
            confidence: 'high',
            rawSnippet: isDM ? 'Diabetes confirmada en texto' : 'Sin diabetes',
          });
          matchedFieldNames.add(field.name);
          continue;
        } else if (field.type === 'select' || field.type === 'radio') {
          let detected = isDM ? 'Diabetes Mellitus Tipo 2' : 'No diabético';
          let snippet = isDM ? 'diabetes' : 'sin diabetes';
          if (!isDM) {
            detected = field.options?.find(o => /no\s*diab[eé]tico|^no\b/i.test(o)) || 'No diabético';
          } else if (/diabetes\s*mellitus\s*tipo\s*1|dm1|dm\s*tipo\s*1/i.test(cleanText)) {
            detected = field.options?.find(o => o.includes('Tipo 1')) || 'Diabetes Mellitus Tipo 1';
            snippet = 'diabetes tipo 1';
          } else if (/diabetes\s*mellitus\s*tipo\s*2|dm2|dm\s*tipo\s*2|diab[eé]tico\s*tipo\s*2|metformina|insulina/i.test(cleanText) || /diab[eé]tic[oa]/i.test(cleanText)) {
            detected = field.options?.find(o => o.includes('Tipo 2')) || field.options?.find(o => /s[ií]/i.test(o)) || 'Diabetes Mellitus Tipo 2';
            snippet = 'diabetes tipo 2';
          } else if (/prediabetes|intolerancia\s*a\s*la\s*glucosa/i.test(cleanText)) {
            detected = field.options?.find(o => o.toLowerCase().includes('prediabetes')) || 'Prediabetes';
            snippet = 'prediabetes';
          }
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: detected,
            formattedDisplay: detected,
            confidence: 'high',
            rawSnippet: snippet,
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // Smoking status (Tabaquismo / Fumador / Tabaco)
    if (fn.includes('tabaco') || fn.includes('tabaquismo') || fn.includes('fumador') || fn.includes('habito_tabaqu') ||
        fl.includes('tabaco') || fl.includes('tabaquismo') || fl.includes('fumador') || fl.includes('hábito tabáquico')) {
      const mentionsEx = /ex[\s-]?fumador|dej[oó]\s+de\s+fumar|fumador\s+hasta\s+hace/i.test(cleanText);
      const mentionsNeg = /no\s*fumador|nunca\s*ha\s*fumado|sin\s*h[aá]bito\s*tab[aá]quico|niega\s*tabaquismo|niega\s*tabaco|no\s*fuma/i.test(cleanText);
      const mentionsActive = /\b(?:fumador(?:a)?|fuma|tabaquismo(?:\s+activo)?|h[aá]bito\s+tab[aá]quico(?:\s+activo)?)\b/i.test(cleanText);

      if (mentionsEx || mentionsNeg || mentionsActive) {
        if (field.type === 'boolean') {
          const isSmoker = mentionsActive && !mentionsNeg && !mentionsEx;
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isSmoker,
            formattedDisplay: isSmoker ? 'Sí' : 'No',
            confidence: 'high',
            rawSnippet: isSmoker ? 'fumador activo' : (mentionsEx ? 'exfumador' : 'no fumador'),
          });
          matchedFieldNames.add(field.name);
          continue;
        } else if (field.type === 'select' || field.type === 'radio') {
          let detected = '';
          let snippet = '';
          if (mentionsEx) {
            detected = field.options?.find(o => o.toLowerCase().includes('exfumador')) || 'Exfumador (> 1 año)';
            snippet = 'exfumador';
          } else if (mentionsNeg) {
            detected = field.options?.find(o => o.toLowerCase().includes('nunca') || o.toLowerCase().includes('no')) || 'Nunca fumador';
            snippet = 'no fumador';
          } else if (mentionsActive) {
            detected = field.options?.find(o => o.toLowerCase().includes('activo < 10')) ||
                       field.options?.find(o => o.toLowerCase().includes('activo')) ||
                       field.options?.find(o => o.toLowerCase().includes('fumador') && !o.toLowerCase().includes('nunca') && !o.toLowerCase().includes('ex')) ||
                       field.options?.find(o => o.trim().toLowerCase() === 'sí' || o.trim().toLowerCase() === 'si') ||
                       'Fumador activo';
            snippet = 'fumador';
          }

          if (detected) {
            results.push({
              fieldName: field.name,
              fieldLabel: field.label,
              fieldType: field.type,
              extractedValue: detected,
              formattedDisplay: detected,
              confidence: 'high',
              rawSnippet: snippet || detected,
            });
            matchedFieldNames.add(field.name);
            continue;
          }
        } else if (field.type === 'text') {
          const val = mentionsActive && !mentionsNeg && !mentionsEx ? 'Fumador activo' : (mentionsEx ? 'Exfumador' : 'No fumador');
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: val,
            formattedDisplay: val,
            confidence: 'high',
            rawSnippet: val,
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // Previous Myocardial Infarction (IAM)
    if (fn.includes('iam') || fn.includes('infarto') || fl.includes('infarto') || fl.includes('iam')) {
      const mentionsIAM = /(?:infarto|iam|scacest|sicasest|sindrome\s*coronario)\b/i.test(cleanText);
      const negatesIAM = /no\s+(?:infarto|iam)|sin\s+infarto/i.test(cleanText);
      if (mentionsIAM || negatesIAM) {
        const isIAM = mentionsIAM && !negatesIAM;
        if (field.type === 'boolean') {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isIAM,
            formattedDisplay: isIAM ? 'Sí' : 'No',
            confidence: 'high',
            rawSnippet: isIAM ? 'Infarto / IAM detectado en texto' : 'Sin infarto previo',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // Coronary revascularization (ACTP / Stent / Bypass)
    if (fn.includes('revascularizacion') || fl.includes('revascularización') || fl.includes('stent') || fl.includes('bypass') || fl.includes('actp')) {
      const hasStent = /stent|actp|angioplastia/i.test(cleanText);
      const hasBypass = /bypass|cabg|cirug[ií]a\s*de\s*revascularizaci[oó]n/i.test(cleanText);
      const negRevasc = /sin\s*revascularizaci[oó]n|no\s*revascularizaci[oó]n/i.test(cleanText);

      if (hasStent || hasBypass || negRevasc) {
        if (field.type === 'select' || field.type === 'radio') {
          let detected = 'Ninguna';
          let snippet = 'sin revascularización';
          if (hasStent && hasBypass) {
            detected = field.options?.find(o => o.toLowerCase().includes('ambos')) || 'Ambos procedimientos';
            snippet = 'stent + bypass';
          } else if (hasStent) {
            detected = field.options?.find(o => o.toLowerCase().includes('stent') || o.toLowerCase().includes('actp')) || 'Angioplastia con Stent (ACTP)';
            snippet = 'stent / angioplastia';
          } else if (hasBypass) {
            detected = field.options?.find(o => o.toLowerCase().includes('bypass') || o.toLowerCase().includes('cabg')) || 'Bypass Aortocoronario (CABG)';
            snippet = 'bypass / CABG';
          } else {
            detected = field.options?.find(o => o.toLowerCase().includes('ninguna') || o.toLowerCase().includes('no')) || 'Ninguna';
          }
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: detected,
            formattedDisplay: detected,
            confidence: 'high',
            rawSnippet: snippet || detected,
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // Arrhythmia / Atrial Fibrillation (FA)
    if (fn.includes('arritmia') || fn.includes('fibrilacion') || fl.includes('arritmia') || fl.includes('fibrilación') || fl.includes('fibrilacion')) {
      const selected: string[] = [];
      if (/fibrilaci[oó]n\s*auricular|f\.?a\.?\s*parox[ií]stica|f\.?a\.?\s*permanente|\bfa\b/i.test(cleanText)) {
        selected.push('Fibrilación Auricular (FA)');
      }
      if (/flutter\s*auricular/i.test(cleanText)) {
        selected.push('Flutter Auricular');
      }
      if (/marcapasos|\bdai\b/i.test(cleanText)) {
        selected.push('Portador de Marcapasos / DAI');
      }
      if (selected.length > 0) {
        results.push({
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          extractedValue: field.type === 'multiselect' ? selected : selected[0],
          formattedDisplay: selected.join(', '),
          confidence: 'high',
          rawSnippet: selected.join(', '),
        });
        matchedFieldNames.add(field.name);
        continue;
      }
    }

    // Stroke / TIA
    if (fn.includes('ictus') || fn.includes('ait') || fl.includes('ictus') || fl.includes('ait') || fl.includes('acv')) {
      const mentionsIctus = /(?:ictus|ait|acv|accidente\s*cerebrovascular)\b/i.test(cleanText);
      const negatesIctus = /no\s+(?:ictus|ait|acv)|sin\s+ictus/i.test(cleanText);
      if (mentionsIctus || negatesIctus) {
        const isIctus = mentionsIctus && !negatesIctus;
        if (field.type === 'boolean') {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isIctus,
            formattedDisplay: isIctus ? 'Sí' : 'No',
            confidence: 'high',
            rawSnippet: isIctus ? 'Ictus / AIT detectado' : 'Sin ictus',
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // Dyslipidemia (Dislipemia / Hipercolesterolemia / Dislipémico / Estatinas)
    if (fn.includes('dislipemi') || fn.includes('dislipidemi') || fn.includes('hipercolesterol') || fn.includes('colesterol') || fn.includes('estatina') ||
        fl.includes('dislipemi') || fl.includes('dislipidemi') || fl.includes('hipercolesterol') || fl.includes('estatina')) {
      const mentionsDLP = /(?:dislip[eé]mic[oa]|dislipemia|dislipidemia|hipercolesterolemia|hiperlipidemia|atorvastatina|simvastatina|rosuvastatina|pravastatina|pitavastatina)\b/i.test(cleanText);
      const negatesDLP = /no\s+(?:dislip[eé]mic[oa]|dislipemia|dislipidemia)|sin\s+(?:dislipemia|dislipidemia)/i.test(cleanText);

      if (mentionsDLP || negatesDLP) {
        const isDLP = mentionsDLP && !negatesDLP;
        const snippetMatch = cleanText.match(/(?:dislip[eé]mic[oa]|dislipemia|dislipidemia|hipercolesterolemia|atorvastatina|simvastatina|rosuvastatina)\b/i);
        const snippet = snippetMatch ? snippetMatch[0] : (isDLP ? 'Dislipemia confirmada' : 'Sin dislipemia');

        if (field.type === 'boolean') {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isDLP,
            formattedDisplay: isDLP ? 'Sí' : 'No',
            confidence: 'high',
            rawSnippet: snippet,
          });
          matchedFieldNames.add(field.name);
          continue;
        } else if (field.type === 'select' || field.type === 'radio') {
          let detected = isDLP ? 'Sí' : 'No';
          if (field.options && field.options.length > 0) {
            if (isDLP) {
              detected = field.options.find(o => /s[ií]|dislipemi|hipercolesterol|tratamiento/i.test(o)) || field.options[0];
            } else {
              detected = field.options.find(o => /^no\b|sin\s*dislipemia|normal/i.test(o)) || 'No';
            }
          }
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: detected,
            formattedDisplay: detected,
            confidence: 'high',
            rawSnippet: snippet,
          });
          matchedFieldNames.add(field.name);
          continue;
        } else if (field.type === 'text') {
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isDLP ? 'Dislipidemia' : 'Sin dislipidemia',
            formattedDisplay: isDLP ? 'Dislipidemia' : 'Sin dislipidemia',
            confidence: 'high',
            rawSnippet: snippet,
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }

    // --- GENERIC FUZZY LABEL MATCH FOR CUSTOM FIELDS ---
    if (!matchedFieldNames.has(field.name)) {
      // Try to find: "Field Label: <value>" or "field_name: <value>"
      const escapedLabel = field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedName = field.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (field.type === 'number') {
        const regex = new RegExp(`(?:${escapedLabel}|${escapedName})[\\s:=]+([0-9]+(?:[.,][0-9]+)?)`, 'i');
        const match = cleanText.match(regex);
        if (match && match[1]) {
          const val = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(val)) {
            results.push({
              fieldName: field.name,
              fieldLabel: field.label,
              fieldType: field.type,
              extractedValue: val,
              formattedDisplay: `${val} ${field.unit || ''}`.trim(),
              confidence: 'medium',
              rawSnippet: match[0],
              unit: field.unit,
            });
            matchedFieldNames.add(field.name);
            continue;
          }
        }
      } else if (field.type === 'boolean') {
        const regex = new RegExp(`(?:${escapedLabel}|${escapedName})[\\s:=]+(s[ií]|no|true|false|positivo|negativo)`, 'i');
        const match = cleanText.match(regex);
        if (match && match[1]) {
          const isTrue = /s[ií]|true|positivo/i.test(match[1]);
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: isTrue,
            formattedDisplay: isTrue ? 'Sí' : 'No',
            confidence: 'medium',
            rawSnippet: match[0],
          });
          matchedFieldNames.add(field.name);
          continue;
        } else {
          // If label word exists as a standalone clinical term
          // e.g. field label "¿Fumador?" or "Dislipémico" -> word in text
          const cleanWord = field.label.replace(/[¿?()]/g, '').trim().split(/\s+/)[0];
          if (cleanWord.length >= 4) {
            const wordEscaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordRegex = new RegExp(`\\b${wordEscaped}\\b`, 'i');
            if (wordRegex.test(cleanText)) {
              const negRegex = new RegExp(`(?:no|sin|niega)\\s+${wordEscaped}`, 'i');
              const isNeg = negRegex.test(cleanText);
              results.push({
                fieldName: field.name,
                fieldLabel: field.label,
                fieldType: field.type,
                extractedValue: !isNeg,
                formattedDisplay: !isNeg ? 'Sí' : 'No',
                confidence: 'medium',
                rawSnippet: isNeg ? `Sin ${cleanWord}` : cleanWord,
              });
              matchedFieldNames.add(field.name);
              continue;
            }
          }
        }
      } else if (field.type === 'select' || field.type === 'radio') {
        if (field.options && field.options.length > 0) {
          for (const opt of field.options) {
            const escapedOpt = opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:${escapedLabel}|${escapedName})[\\s:=]+.*?(?:${escapedOpt})`, 'i');
            if (regex.test(cleanText) || (cleanText.toLowerCase().includes(opt.toLowerCase()) && opt.length > 4)) {
              results.push({
                fieldName: field.name,
                fieldLabel: field.label,
                fieldType: field.type,
                extractedValue: opt,
                formattedDisplay: opt,
                confidence: 'medium',
                rawSnippet: opt,
              });
              matchedFieldNames.add(field.name);
              break;
            }
          }
        }
      } else if (field.type === 'text' || field.type === 'textarea') {
        const regex = new RegExp(`(?:${escapedLabel}|${escapedName})[\\s:=]+([^\\n;]+)`, 'i');
        const match = cleanText.match(regex);
        if (match && match[1] && match[1].trim().length > 0) {
          const val = match[1].trim();
          results.push({
            fieldName: field.name,
            fieldLabel: field.label,
            fieldType: field.type,
            extractedValue: val,
            formattedDisplay: val,
            confidence: 'medium',
            rawSnippet: match[0],
          });
          matchedFieldNames.add(field.name);
          continue;
        }
      }
    }
  }

  return results;
}

/**
 * Pre-built real-world clinical test samples so clinicians and students can test
 * one-click free-text extraction on the fly.
 */
export const CLINICAL_TEXT_PRESETS = [
  {
    id: 'perfil-breve',
    title: 'Caso Rápido: Varón 45a, fumador y dislipémico',
    icon: 'Zap',
    description: 'Demográficos y factores de riesgo en una sola frase breve.',
    text: 'Varón de 45 años de edad fumador y dislipemico',
  },
  {
    id: 'analitica',
    title: 'Analítica Sanguínea y Bioquímica',
    icon: 'FlaskConical',
    description: 'Hemograma, glucemia, función renal (creatinina/urea), electrolitos y perfil lipídico.',
    text: `PACIENTE: Juan Martínez Ruiz (67 años)
ANALÍTICA DE URGENCIA / LABORATORIO CENTRAL
- Glucosa en suero: 126 mg/dL [70 - 105] (Elevada)
- HbA1c (Hemoglobina glicosilada): 7.1 % [< 6.5]
- Creatinina: 1.34 mg/dL [0.70 - 1.20]
- Urea: 48 mg/dL [15 - 45]
- Sodio (Na+): 139 mEq/L [135 - 145]
- Potasio (K+): 4.4 mEq/L [3.5 - 5.0]
- Troponina I ultrasensible: 38 ng/L [< 14 ng/L] (Positiva)
- NT-proBNP: 840 pg/mL [< 300]
- Proteína C reactiva (PCR): 12.4 mg/L [< 5.0]
- Colesterol total: 218 mg/dL
- c-LDL: 138 mg/dL
- c-HDL: 41 mg/dL
- Triglicéridos: 195 mg/dL
- Hemoglobina: 13.6 g/dL
- Leucocitos: 8.900 /uL
- Plaquetas: 215.000 /uL`,
  },
  {
    id: 'ecocardiograma',
    title: 'Informe de Ecocardiograma y Válvulas',
    icon: 'Heart',
    description: 'FEVI, DTDVI, estenosis aórtica severa (área valvular, velocidad pico, gradiente medio).',
    text: `SERVICIO DE CARDIOLOGÍA - GABINETE DE ECOCARDIOGRAFÍA
INFORME ECOCARDIOGRÁFICO TRANSTORÁCICO (ETT):
Ventrículo izquierdo de dimensiones ligeramente dilatadas, con diámetro telediastólico (DTDVI) de 56 mm. Grosor parietal conservado (SIV 11 mm, PP 10 mm).
Fracción de eyección del ventrículo izquierdo (FEVI) estimada en 44% mediante método biplano de Simpson, con contractilidad segmentaria que muestra hipocinesia anterior y apical.
Válvula aórtica tricúspide severamente calcificada con apertura marcadamente reducida, compatible con Estenosis Aórtica Severa sintomática.
Estudio Doppler transvalvular aórtico:
- Velocidad máxima pico (Vmax): 4.3 m/s (Criterio de severidad ≥ 4.0 m/s)
- Gradiente medio transaórtico: 46 mmHg (Criterio de severidad ≥ 40 mmHg)
- Área valvular aórtica estimada por ecuación de continuidad (AVA): 0.74 cm²
Insuficiencia mitral de grado ligero a moderado sin prolapso.
Presión sistólica de la arteria pulmonar estimada en 38 mmHg.`,
  },
  {
    id: 'antecedentes',
    title: 'Historia Clínica y Factores de Riesgo',
    icon: 'FileText',
    description: 'Hipertensión arterial, diabetes mellitus, tabaquismo, infarto previo y revascularización.',
    text: `ANAMNESIS Y ANTECEDENTES PERSONALES:
Varón de 64 años, jubilado.
Factores de riesgo cardiovascular:
- Hipertensión arterial diagnosticada hace 12 años, en tratamiento con Enalapril / Hidroclorotiazida 20/12.5 mg.
- Diabetes Mellitus Tipo 2 no insulinodependiente de 6 años de evolución, en tratamiento con Metformina 850 mg cada 12 horas.
- Dislipemia conocida en tratamiento con Atorvastatina 40 mg.
- Estatus tabáquico: Exfumador desde hace 2 años (fumador activo previo durante 35 años a razón de 20 cigarrillos al día, IPA de 35 paquetes-año).
Antecedentes cardiovasculares y quirúrgicos:
- Infarto agudo de miocardio previo (IAM con elevación de ST anteroseptal en 2020), realizándose revascularización coronaria percutánea urgente mediante Angioplastia con Stent farmacoactivo en descendente anterior (ACTP).
- Episodios de Fibrilación Auricular paroxística en tratamiento anticoagulante.
- No refiere antecedentes de ictus ni claudicación intermitente (sin arteriopatía periférica).`,
  },
  {
    id: 'constantes',
    title: 'Constantes de Triaje y Admisión',
    icon: 'Activity',
    description: 'Tensión arterial sistólica/diastólica, frecuencia cardíaca, SatO2, temperatura y FR.',
    text: `REGISTRO DE CONSTANTES EN BOX DE TRIAJE (08:30 h):
Paciente consciente y orientado.
- Presión arterial: 148/88 mmHg
- Frecuencia cardíaca: 88 lpm, ritmo sinusal
- Saturación de oxígeno (SpO2): 94% aire ambiente
- Temperatura axilar: 37.6 ºC
- Frecuencia respiratoria: 20 rpm
- Escala de dolor EVA: 4/10 precordial atípico
- Glucemia capilar de llegada: 132 mg/dL
- Peso: 78 kg, Talla: 172 cm`,
  },
];
