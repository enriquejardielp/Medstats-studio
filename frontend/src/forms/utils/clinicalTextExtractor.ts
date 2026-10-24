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
function extractFieldsFromClinicalTextLegacy(
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

type ClinicalConcept = {
  id: string;
  field: RegExp;
  aliases: string[];
  kind: 'number' | 'boolean' | 'sex' | 'smoking';
  unit?: string;
  min?: number;
  max?: number;
};

// Explicit clinical vocabulary. Short abbreviations are only recognized inside
// a field that clearly represents the corresponding concept (e.g. FC as a field
// name is safe; searching for FC anywhere in the note is not).
const clinicalConcepts: ClinicalConcept[] = [
  { id: 'age', field: /\b(edad|age)\b|\b(?:anos|years) de edad\b|\byears old\b/, aliases: ['edad', 'anos de edad', 'years old', 'age'], kind: 'number', unit: 'años', min: 0, max: 120 },
  { id: 'sex', field: /\b(sexo|genero|sex)\b/, aliases: ['varon', 'hombre', 'masculino', 'male', 'man', 'mujer', 'femenino', 'hembra', 'female', 'woman'], kind: 'sex' },
  { id: 'sbp', field: /\b(ta sistolica|tension arterial sistolica|presion arterial sistolica|tas|pas|systolic)\b/, aliases: ['presion arterial', 'tension arterial', 'ta', 'pa', 'tas', 'pas', 'sistolica'], kind: 'number', unit: 'mmHg', min: 40, max: 300 },
  { id: 'dbp', field: /\b(ta diastolica|tension arterial diastolica|presion arterial diastolica|tad|pad|diastolic)\b/, aliases: ['presion arterial', 'tension arterial', 'ta', 'pa', 'tad', 'pad', 'diastolica'], kind: 'number', unit: 'mmHg', min: 20, max: 200 },
  { id: 'hr', field: /\b(frecuencia cardiaca|pulso|heart rate|\bfc\b|\bhr\b)\b/, aliases: ['frecuencia cardiaca', 'pulso', 'heart rate', 'fc', 'hr'], kind: 'number', unit: 'lpm', min: 20, max: 300 },
  { id: 'spo2', field: /\b(saturacion|spo2|sato2|oximetria)\b/, aliases: ['saturacion de oxigeno', 'saturacion o2', 'spo2', 'sato2'], kind: 'number', unit: '%', min: 0, max: 100 },
  { id: 'temperature', field: /\b(temperatura|temperature|temp)\b/, aliases: ['temperatura', 'temp', 'temperature'], kind: 'number', unit: '°C', min: 25, max: 45 },
  { id: 'rr', field: /\b(frecuencia respiratoria|respiratory rate|\bfr\b|\brr\b)\b/, aliases: ['frecuencia respiratoria', 'respiratory rate', 'fr', 'rpm'], kind: 'number', unit: 'rpm', min: 3, max: 100 },
  { id: 'weight', field: /\b(peso|weight)\b/, aliases: ['peso', 'weight'], kind: 'number', unit: 'kg', min: 0.5, max: 500 },
  { id: 'height', field: /\b(talla|altura|height)\b/, aliases: ['talla', 'altura', 'height'], kind: 'number', unit: 'cm', min: 30, max: 250 },
  { id: 'bmi', field: /\b(imc|indice de masa corporal|bmi)\b/, aliases: ['imc', 'indice de masa corporal', 'bmi'], kind: 'number', unit: 'kg/m²', min: 5, max: 100 },
  { id: 'hba1c', field: /\b(hba1c|hemoglobina glicosilada|hemoglobina glucosilada)\b/, aliases: ['hba1c', 'hemoglobina glicosilada', 'hemoglobina glucosilada'], kind: 'number', unit: '%', min: 2, max: 30 },
  { id: 'creatinine', field: /\b(creatinina|creatinine)\b/, aliases: ['creatinina', 'creatinine', 'creat'], kind: 'number', unit: 'mg/dL', min: 0.05, max: 50 },
  { id: 'egfr', field: /\b(egfr|fg|filtrado glomerular|tasa de filtracion)\b/, aliases: ['egfr', 'filtrado glomerular', 'tasa de filtracion glomerular', 'fg'], kind: 'number', unit: 'mL/min/1,73 m²', min: 0, max: 250 },
  { id: 'urea', field: /\b(urea|bun)\b/, aliases: ['urea', 'bun'], kind: 'number', unit: 'mg/dL', min: 0, max: 500 },
  { id: 'glucose', field: /\b(glucosa|glucemia|glucose)\b/, aliases: ['glucosa', 'glucemia', 'glucose'], kind: 'number', unit: 'mg/dL', min: 0, max: 2000 },
  { id: 'hemoglobin', field: /\b(hemoglobina|hemoglobin|\bhb\b)\b/, aliases: ['hemoglobina', 'hemoglobin', 'hb'], kind: 'number', unit: 'g/dL', min: 1, max: 30 },
  { id: 'platelets', field: /\b(plaquetas|platelets|trombocitos)\b/, aliases: ['plaquetas', 'platelets', 'trombocitos'], kind: 'number', unit: '10^3/µL', min: 0, max: 5000000 },
  { id: 'leukocytes', field: /\b(leucocitos|leukocytes|globulos blancos)\b/, aliases: ['leucocitos', 'leukocytes', 'globulos blancos'], kind: 'number', unit: '10^3/µL', min: 0, max: 5000000 },
  { id: 'sodium', field: /\b(sodio|natremia|sodium|\bna\b)\b/, aliases: ['sodio', 'natremia', 'sodium', 'na+'], kind: 'number', unit: 'mmol/L', min: 50, max: 250 },
  { id: 'potassium', field: /\b(potasio|potasemia|potassium|\bk\b)\b/, aliases: ['potasio', 'potasemia', 'potassium', 'k+'], kind: 'number', unit: 'mmol/L', min: 1, max: 15 },
  { id: 'troponin', field: /\b(troponina|troponin)\b/, aliases: ['troponina', 'troponin'], kind: 'number', unit: 'ng/L', min: 0, max: 1000000 },
  { id: 'bnp', field: /\b(nt.?probnp|probnp|\bbnp\b|peptido natriuretico)\b/, aliases: ['nt-probnp', 'ntprobnp', 'pro-bnp', 'probnp', 'bnp', 'peptido natriuretico'], kind: 'number', unit: 'pg/mL', min: 0, max: 10000000 },
  { id: 'crp', field: /\b(pcr|proteina c reactiva|crp)\b/, aliases: ['proteina c reactiva', 'pcr', 'crp'], kind: 'number', unit: 'mg/L', min: 0, max: 100000 },
  { id: 'ldl', field: /\b(ldl|c ldl)\b/, aliases: ['colesterol ldl', 'c-ldl', 'ldl'], kind: 'number', unit: 'mg/dL', min: 0, max: 2000 },
  { id: 'hdl', field: /\b(hdl|c hdl)\b/, aliases: ['colesterol hdl', 'c-hdl', 'hdl'], kind: 'number', unit: 'mg/dL', min: 0, max: 1000 },
  { id: 'cholesterol', field: /\b(colesterol total|colesterol|cholesterol)\b/, aliases: ['colesterol total', 'colesterol', 'cholesterol'], kind: 'number', unit: 'mg/dL', min: 0, max: 3000 },
  { id: 'triglycerides', field: /\b(trigliceridos|triglycerides)\b/, aliases: ['trigliceridos', 'triglycerides'], kind: 'number', unit: 'mg/dL', min: 0, max: 10000 },
  { id: 'lvef', field: /\b(fevi|fraccion de eyeccion|lvef)\b/, aliases: ['fraccion de eyeccion', 'fevi', 'lvef'], kind: 'number', unit: '%', min: 0, max: 100 },
  { id: 'lvidd', field: /\b(dtdvi|diametro telediastolico|lvidd)\b/, aliases: ['diametro telediastolico', 'dtdvi', 'lvidd'], kind: 'number', unit: 'mm', min: 5, max: 150 },
  { id: 'ava', field: /\b(ava|area valvular aortica)\b/, aliases: ['area valvular aortica', 'ava'], kind: 'number', unit: 'cm²', min: 0, max: 20 },
  { id: 'vmax', field: /\b(vmax|velocidad maxima|velocidad pico)\b/, aliases: ['velocidad maxima pico', 'velocidad maxima', 'vmax'], kind: 'number', unit: 'm/s', min: 0, max: 20 },
  { id: 'mean_gradient', field: /\b(gradiente medio|gradiente transaortico|mean gradient)\b/, aliases: ['gradiente medio transaortico', 'gradiente medio', 'mean gradient'], kind: 'number', unit: 'mmHg', min: 0, max: 300 },
  { id: 'psap', field: /\b(psap|presion sistolica pulmonar)\b/, aliases: ['presion sistolica de la arteria pulmonar', 'presion sistolica pulmonar', 'psap'], kind: 'number', unit: 'mmHg', min: 0, max: 200 },
  { id: 'hypertension', field: /\b(hta|htn|hipertension|hipertenso|hipertensa|hypertension)\b/, aliases: ['hipertension arterial', 'hipertension', 'hipertenso', 'hipertensa', 'hta', 'htn', 'hypertension'], kind: 'boolean' },
  { id: 'diabetes', field: /\b(diabetes|diabetico|diabetica|dm|dm1|dm2|diabetes mellitus)\b/, aliases: ['diabetes mellitus', 'diabetes', 'diabetico', 'diabetica', 'dm tipo 1', 'dm tipo 2', 'dm1', 'dm2', 'dm'], kind: 'boolean' },
  { id: 'dyslipidemia', field: /\b(dislipemia|dislipemico|dislipemica|dislipidemia|dyslipidemia|dlp)\b/, aliases: ['dislipemia', 'dislipemico', 'dislipemica', 'dislipidemia', 'dyslipidemia', 'dlp'], kind: 'boolean' },
  { id: 'smoking', field: /\b(tabaquismo|fumador|smoking)\b/, aliases: ['tabaquismo', 'fumador', 'fumadora', 'fumador activo', 'exfumador', 'exfumadora', 'smoking'], kind: 'smoking' },
  { id: 'prior_mi', field: /\b(iam|infarto|infarto de miocardio|myocardial infarction)\b/, aliases: ['infarto agudo de miocardio', 'infarto de miocardio', 'iam', 'myocardial infarction'], kind: 'boolean' },
  { id: 'revascularization', field: /\b(revascularizacion|angioplastia|actp|pci|bypass)\b/, aliases: ['revascularizacion coronaria', 'revascularizacion', 'angioplastia', 'actp', 'pci', 'bypass'], kind: 'boolean' },
  { id: 'atrial_fibrillation', field: /\b(fibrilacion auricular|fa|atrial fibrillation)\b/, aliases: ['fibrilacion auricular', 'fa', 'atrial fibrillation'], kind: 'boolean' },
  { id: 'stroke', field: /\b(ictus|acv|ait|stroke)\b/, aliases: ['accidente cerebrovascular', 'ictus', 'acv', 'ait', 'stroke'], kind: 'boolean' },
  { id: 'heart_failure', field: /\b(insuficiencia cardiaca|fallo cardiaco|icc|chf)\b/, aliases: ['insuficiencia cardiaca', 'fallo cardiaco', 'icc', 'chf'], kind: 'boolean' },
  { id: 'ckd', field: /\b(enfermedad renal cronica|insuficiencia renal cronica|erc|irc|ckd)\b/, aliases: ['enfermedad renal cronica', 'insuficiencia renal cronica', 'erc', 'irc', 'ckd'], kind: 'boolean' },
  { id: 'copd', field: /\b(epoc|e.?p.?o.?c|enfermedad pulmonar obstructiva cronica|copd)\b/, aliases: ['enfermedad pulmonar obstructiva cronica', 'epoc', 'copd'], kind: 'boolean' },
  { id: 'peripheral_artery', field: /\b(arteriopatia periferica|enfermedad arterial periferica|eap)\b/, aliases: ['arteriopatia periferica', 'enfermedad arterial periferica', 'eap'], kind: 'boolean' },
];

const normalizeClinicalText = (value: string) => value
  .replace(/[µμ]/g, 'u')
  .replace(/[º°]/g, ' ')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’']/g, ' ')
  .replace(/[^a-z0-9%+./-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clinicalSegments = (text: string) => text
  .replace(/\r/g, '')
  .split(/\n|;|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
  .map(value => value.trim())
  .filter(Boolean);

const getClinicalConcept = (field: FormField) => {
  const identity = normalizeClinicalText(`${field.name} ${field.label}`);
  // Order specific concepts first to avoid e.g. HbA1c being read as hemoglobin.
  return clinicalConcepts.find(concept => concept.field.test(identity));
};

const parseClinicalNumber = (raw: string, concept: ClinicalConcept): number | null => {
  let normalized = raw.replace(/\s/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    const decimal = normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
    normalized = normalized.replace(/[.,]/g, separator => separator === decimal ? '.' : '');
  } else if (normalized.includes(',')) {
    normalized = (concept.id === 'platelets' || concept.id === 'leukocytes') && /^\d{1,3},\d{3}$/.test(normalized)
      ? normalized.replace(',', '')
      : normalized.replace(',', '.');
  } else if (/^\d{1,3}\.\d{3}$/.test(normalized)) {
    const decimalValue = Number(normalized);
    const thousandsValue = Number(normalized.replace('.', ''));
    if (concept.id === 'platelets' || concept.id === 'leukocytes') normalized = String(thousandsValue);
    else {
      const decimalIsPlausible = decimalValue >= (concept.min ?? -Infinity) && decimalValue <= (concept.max ?? Infinity);
      const thousandsIsPlausible = thousandsValue >= (concept.min ?? -Infinity) && thousandsValue <= (concept.max ?? Infinity);
      if (decimalIsPlausible === thousandsIsPlausible) return null;
      normalized = String(decimalIsPlausible ? decimalValue : thousandsValue);
    }
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const findNumericMention = (segment: string, concept: ClinicalConcept) => {
  const normalized = normalizeClinicalText(segment);
  const aliases = [...concept.aliases].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const normalizedAlias = normalizeClinicalText(alias);
    const aliasPattern = new RegExp(`(^|\\b)${escapeRegExp(normalizedAlias).replace(/\\ /g, '\\s+')}(?=\\b|[^a-z0-9])`, 'i');
    const mention = aliasPattern.exec(normalized);
    if (!mention) continue;
    const start = mention.index + mention[1].length + mention[0].length - mention[1].length;
    const remainder = normalized.slice(start);
    const valueMatch = remainder.match(/^\s*(?:\([^)]*\)\s*)?(?:[:=]\s*)?(?:estimad[oa]s?\s+)?(?:en\s+|de\s+|es\s+)?(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)/i)
      || remainder.match(/^\s*(?:[^\d\n]{0,28}?)(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)/i);
    if (!valueMatch?.[1]) continue;
    const value = parseClinicalNumber(valueMatch[1], concept);
    if (value === null) continue;
    const afterValue = remainder.slice((valueMatch.index || 0) + valueMatch[0].length);
    const unit = afterValue.match(/^\s*(%|mmhg|mg\/dl|mg\/l|g\/dl|mmol\/l|mmol\/mol|meq\/l|umol\/l|micromol\/l|ng\/l|ng\/ml|pg\/ml|ml\/min(?:\/1[.,]73\s*m2)?|10\s*3\/(?:ul|ml)|\/ul|\/mm3|cm2|cm|mm|m\/s|kg|g|lb|lpm|bpm|rpm|c|f|m)(?=$|\s|\[|\()/i)?.[1]?.toLowerCase();
    // Only accept the nearby evidence. Preserve the original segment for review.
    return { value, snippet: segment, unit };
  }
  return null;
};

const mapCanonicalValue = (field: FormField, canonical: string | boolean | number): any => {
  if (field.type === 'number') return typeof canonical === 'number' ? canonical : null;
  if (field.type === 'boolean') {
    if (typeof canonical === 'boolean') return canonical;
    return null;
  }
  if (field.type === 'select' || field.type === 'radio' || field.type === 'multiselect') {
    const options = field.options || [];
    const aliases = typeof canonical === 'boolean'
      ? (canonical ? ['si', 'sí', 'yes', 'verdadero', 'presente', 'actual'] : ['no', 'ausente', 'falso', 'nunca'])
      : typeof canonical === 'number' ? [String(canonical)]
      : canonical === 'Masculino' ? ['masculino', 'varon', 'hombre', 'male', 'man']
      : canonical === 'Femenino' ? ['femenino', 'mujer', 'hembra', 'female', 'woman']
      : canonical === 'Exfumador' ? ['exfumador', 'exfumadora', 'previo', 'previa']
      : canonical === 'Fumador actual' ? ['fumador', 'fumadora', 'actual', 'activo', 'activa']
      : [String(canonical)];
    const selected = options.find(option => aliases.some(alias => {
      const normalizedOption = normalizeClinicalText(option);
      const normalizedAlias = normalizeClinicalText(alias);
      return normalizedOption === normalizedAlias || new RegExp(`\\b${escapeRegExp(normalizedAlias)}\\b`, 'i').test(normalizedOption);
    }));
    if (!selected) return null;
    return field.type === 'multiselect' ? [selected] : selected;
  }
  if (field.type === 'text' || field.type === 'textarea') return String(canonical);
  return null;
};

const extractBooleanMention = (segment: string, concept: ClinicalConcept): { value: boolean | string; snippet: string } | null => {
  const normalized = normalizeClinicalText(segment);
  const matchingAlias = concept.aliases
    .map(alias => normalizeClinicalText(alias))
    .sort((a, b) => b.length - a.length)
    .find(alias => new RegExp(`(^|\\b)${escapeRegExp(alias).replace(/\\ /g, '\\s+')}(?=\\b|[^a-z0-9])`, 'i').test(normalized));
  if (!matchingAlias) return null;
  // Mentions explicitly referring to a relative are not facts about the patient.
  const aliasAt = normalized.indexOf(matchingAlias);
  const before = normalized.slice(Math.max(0, aliasAt - 45), aliasAt);
  if (/\b(familiar|madre|padre|herman[oa]s?|abuelo|abuela)\b/.test(before)) return null;
  if (/\b(posible|probable|sospecha|sospechoso|no se descarta|pendiente de confirmar)\b/.test(before)) return null;
  const after = normalized.slice(aliasAt + matchingAlias.length).trim();
  if (/^(?:no confirmad[oa]|posible|probable|sospecha de)\b/.test(after)) return null;
  const explicitStatus = after.match(/^(?:[:=]\s*)?(0|1|si|no(?!\s+controlad[oa])|yes|never|ausente|presente|positivo|positiva|negativo|negativa)\b/);
  if (concept.kind === 'smoking') {
    if (/\b(exfumador|exfumadora|fumador previo|fumadora previa)\b/.test(normalized)) return { value: 'Exfumador', snippet: segment };
    if (explicitStatus && /^(0|no|never|ausente|negativo|negativa)$/.test(explicitStatus[1])) return { value: false, snippet: segment };
    if (explicitStatus && /^(1|si|yes|presente|positivo|positiva)$/.test(explicitStatus[1])) return { value: 'Fumador actual', snippet: segment };
    if (/\b(no fumador|no fumadora|nunca fumador|nunca fumadora|niega tabaquismo|sin tabaquismo)\b/.test(normalized)) return { value: false, snippet: segment };
    if (/\b(fumador activo|fumadora activa|fumador|fumadora|fumando|tabaquismo activo)\b/.test(normalized)) return { value: 'Fumador actual', snippet: segment };
    return null;
  }
  const isNegated = /\b(no|niega|niegan|sin|ausencia de|descarta|descartan|nunca)\b(?:\s+\w+){0,5}\s*$/.test(before);
  const isNegatedAfter = /^(?:no conocida?|no diagnosticada?|no presenta|no consta|ausente|negativ[oa]|descartad[oa])\b/.test(after);
  if (explicitStatus) {
    const status = explicitStatus[1];
    if (/^(0|no|never|ausente|negativo|negativa)$/.test(status)) return { value: false, snippet: segment };
    if (/^(1|si|yes|presente|positivo|positiva)$/.test(status)) return { value: true, snippet: segment };
  }
  return { value: !(isNegated || isNegatedAfter), snippet: segment };
};

const convertClinicalUnit = (concept: ClinicalConcept, value: number, sourceUnit?: string, targetUnit?: string) => {
  const source = sourceUnit?.replace(/\s/g, '').toLowerCase();
  const target = normalizeClinicalText(targetUnit || concept.unit || '').replace(/\s/g, '');
  let converted = value;
  let unit = concept.unit || '';

  if (source) {
    switch (concept.id) {
      case 'height':
        if (source === 'm') converted *= 100;
        else if (source === 'mm') converted /= 10;
        else if (source !== 'cm') return null;
        break;
      case 'weight':
        if (source === 'g') converted /= 1000;
        else if (source === 'lb') converted *= 0.45359237;
        else if (source !== 'kg') return null;
        break;
      case 'temperature':
        if (source === 'f') converted = (converted - 32) * 5 / 9;
        else if (source !== 'c') return null;
        break;
      case 'glucose':
        if (source === 'mmol/l') converted *= 18.0182;
        else if (source !== 'mg/dl') return null;
        break;
      case 'creatinine':
        if (source === 'umol/l' || source === 'micromol/l') converted *= 0.011312;
        else if (source !== 'mg/dl') return null;
        break;
      case 'urea':
        if (source === 'mmol/l') converted *= 6.006;
        else if (source !== 'mg/dl') return null;
        break;
      case 'cholesterol': case 'ldl': case 'hdl':
        if (source === 'mmol/l') converted *= 38.67;
        else if (source !== 'mg/dl') return null;
        break;
      case 'triglycerides':
        if (source === 'mmol/l') converted *= 88.57;
        else if (source !== 'mg/dl') return null;
        break;
      case 'hba1c':
        if (source === 'mmol/mol') converted = 0.09148 * converted + 2.152;
        else if (source !== '%') return null;
        break;
      case 'troponin':
        if (source === 'ng/ml') converted *= 1000;
        else if (source !== 'ng/l' && source !== 'pg/ml') return null;
        break;
      case 'bnp':
        if (source !== 'pg/ml' && source !== 'ng/l') return null;
        break;
      case 'sodium': case 'potassium':
        if (source !== 'mmol/l' && source !== 'meq/l') return null;
        break;
      case 'spo2':
        if (source !== '%') return null;
        break;
      case 'lvef':
        if (source === 'fraction' || (!source && converted <= 1 && converted > 0)) converted *= 100;
        else if (source && source !== '%' && source !== 'fraction') return null;
        break;
      case 'bmi':
        if (source !== 'kg/m2') return null;
        break;
      case 'egfr':
        if (source !== 'ml/min' && source !== 'ml/min/1,73m2' && source !== 'ml/min/1.73m2') return null;
        break;
      case 'hr':
        if (source !== 'lpm' && source !== 'bpm') return null;
        break;
      case 'rr':
        if (source !== 'rpm') return null;
        break;
      case 'lvidd':
        if (source === 'cm') converted *= 10;
        else if (source !== 'mm') return null;
        break;
      case 'vmax':
        if (source !== 'm/s') return null;
        break;
      case 'ava':
        if (source !== 'cm2') return null;
        break;
      case 'mean_gradient': case 'psap': case 'sbp': case 'dbp':
        if (source !== 'mmhg') return null;
        break;
      case 'hemoglobin':
        if (source !== 'g/dl') return null;
        break;
      case 'platelets': case 'leukocytes':
        if (source === '/ul' || source === '/mm3') converted /= 1000;
        else if (!/^103\/(?:ul|ml)$/.test(source)) return null;
        break;
      case 'crp':
        if (source !== 'mg/l') return null;
        break;
      default:
        break;
    }
  }

  if (!source && (concept.id === 'platelets' || concept.id === 'leukocytes') && converted > 5000) converted /= 1000;

  if (target && unit) {
    if (target === normalizeClinicalText(unit).replace(/\s/g, '')) return { value: Number(converted.toFixed(4)), unit: targetUnit || unit };
    if (concept.id === 'age' && ['a', 'ano', 'anos', 'year', 'years'].includes(target)) return { value: Number(converted.toFixed(4)), unit: targetUnit || unit };
    if (concept.id === 'glucose' && target === 'mmol/l') converted /= 18.0182;
    else if (concept.id === 'creatinine' && (target === 'umol/l' || target === 'micromol/l')) converted /= 0.011312;
    else if (concept.id === 'urea' && target === 'mmol/l') converted /= 6.006;
    else if (['cholesterol', 'ldl', 'hdl'].includes(concept.id) && target === 'mmol/l') converted /= 38.67;
    else if (concept.id === 'triglycerides' && target === 'mmol/l') converted /= 88.57;
    else if (concept.id === 'height' && target === 'm') converted /= 100;
    else if (concept.id === 'height' && target === 'mm') converted *= 10;
    else if (concept.id === 'weight' && target === 'g') converted *= 1000;
    else if (concept.id === 'weight' && target === 'lb') converted *= 2.20462262;
    else if (concept.id === 'temperature' && target === 'f') converted = converted * 9 / 5 + 32;
    else if (concept.id === 'hba1c' && target === 'mmol/mol') converted = (converted - 2.152) / 0.09148;
    else if (concept.id === 'troponin' && target === 'ng/ml') converted /= 1000;
    else if ((concept.id === 'troponin' && target === 'pg/ml') || (concept.id === 'bnp' && target === 'ng/l')) converted = converted;
    else if ((concept.id === 'sodium' || concept.id === 'potassium') && target === 'meq/l') converted = converted;
    else if ((concept.id === 'platelets' || concept.id === 'leukocytes') && (target === '109/l' || target === '10^9/l')) converted = converted;
    else if (concept.id === 'lvidd' && target === 'cm') converted /= 10;
    else if (concept.id === 'lvef' && target === 'fraction') converted /= 100;
    else return null;
    unit = targetUnit || unit;
  }
  return { value: Number(converted.toFixed(4)), unit };
};

/**
 * Conservative, fully local clinical extraction. Exact aliases, local context,
 * value bounds and the target field's actual option list are checked before a
 * match is returned. Unsupported custom fields keep the existing generic rules.
 */
export function extractFieldsFromClinicalText(text: string, targetFields: FormField[]): ExtractedFieldMatch[] {
  if (!text?.trim() || !targetFields?.length) return [];
  const segments = clinicalSegments(text);
  const results: ExtractedFieldMatch[] = [];
  const recognizedFields = new Set<string>();

  for (const field of targetFields) {
    if (field.type === 'calculated') continue;
    const concept = getClinicalConcept(field);
    if (!concept) continue;
    recognizedFields.add(field.name);

    let match: { value: any; snippet: string; unit?: string } | null = null;
    const candidates: Array<{ value: any; snippet: string; unit?: string }> = [];
    if (concept.id === 'sbp' || concept.id === 'dbp') {
      segments.forEach(segment => {
        const normalized = normalizeClinicalText(segment);
        const bp = normalized.match(/\b(?:presion arterial|tension arterial|ta|pa)\b\s*[:=]?\s*(\d{2,3})\s*[/|\\]\s*(\d{2,3})/i);
        if (!bp) return;
        const index = concept.id === 'sbp' ? 1 : 2;
        const value = Number(bp[index]);
        if (value >= (concept.min ?? -Infinity) && value <= (concept.max ?? Infinity)) candidates.push({ value, snippet: segment });
      });
    }

    if (concept.kind === 'number') {
      for (const segment of segments) {
        if (concept.id === 'age') {
          const normalized = normalizeClinicalText(segment);
          if (/\b(familiar|madre|padre|herman[oa]s?)\b/.test(normalized)) continue;
          const ageMatch = normalized.match(/\b(\d{1,3})\s*(?:anos?(?: de edad)?|years? old|a)\b/);
          if (ageMatch) {
            const value = Number(ageMatch[1]);
            if (value >= (concept.min ?? -Infinity) && value <= (concept.max ?? Infinity)) candidates.push({ value, snippet: segment });
            continue;
          }
        }
        const found = findNumericMention(segment, concept);
        if (!found) continue;
        if ((concept.id === 'sbp' || concept.id === 'dbp') && !/\b(?:tas|pas|tad|pad|sistolica|diastolica)\b/i.test(normalizeClinicalText(segment))) continue;
        candidates.push({ value: found.value, snippet: found.snippet, unit: found.unit });
      }
    } else if (concept.kind === 'boolean' || concept.kind === 'smoking') {
      for (const segment of segments) {
        const found = extractBooleanMention(segment, concept);
        if (!found) continue;
        candidates.push({ value: found.value, snippet: found.snippet });
      }
    } else if (concept.kind === 'sex') {
      for (const segment of segments) {
        const normalized = normalizeClinicalText(segment);
        const male = /\b(varon|hombre|masculino|male|man)\b/.test(normalized);
        const female = /\b(mujer|femenino|hembra|female|woman)\b/.test(normalized);
        if (male === female) continue;
        candidates.push({ value: male ? 'Masculino' : 'Femenino', snippet: segment });
      }
    }

    const distinctCandidates = new Set(candidates.map(candidate => JSON.stringify(candidate.value)));
    if (distinctCandidates.size === 1) match = candidates[0];

    if (!match) continue;
    const converted = concept.kind === 'number'
      ? convertClinicalUnit(concept, match.value, match.unit, field.unit)
      : null;
    if (concept.kind === 'number' && (!converted || converted.value < (concept.min ?? -Infinity) || converted.value > (concept.max ?? Infinity))) continue;
    const extractedValue = mapCanonicalValue(field, converted?.value ?? match.value);
    // For configured select/radio fields, never place a value that is not one
    // of the form's actual choices.
    if (extractedValue === null || extractedValue === undefined) continue;
    const display = typeof extractedValue === 'boolean'
      ? (extractedValue ? 'Sí' : 'No')
      : typeof extractedValue === 'number'
        ? `${extractedValue}${converted?.unit ? ` ${converted.unit}` : concept.unit ? ` ${concept.unit}` : ''}`
        : String(extractedValue);
    results.push({
      fieldName: field.name,
      fieldLabel: field.label,
      fieldType: field.type,
      extractedValue,
      formattedDisplay: display,
      confidence: concept.kind === 'number' && match.unit ? 'high' : 'medium',
      rawSnippet: match.snippet,
      unit: converted?.unit || concept.unit || field.unit,
    });
  }

  const genericFields = targetFields.filter(field => !recognizedFields.has(field.name));
  const genericResults = genericFields.length ? extractFieldsFromClinicalTextLegacy(text, genericFields) : [];
  const all = [...results, ...genericResults];
  return all.filter((match, index) => all.findIndex(candidate => candidate.fieldName === match.fieldName) === index);
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
