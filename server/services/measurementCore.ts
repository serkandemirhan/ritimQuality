// Pure domain functions shared by the mobile UI and server validation.
export type QualityResult = 'pass' | 'fail' | 'review' | 'unclassified' | 'na';
export interface MeasurementDefinition {
  id: string; type?: string; nominal: number; lsl?: number; usl?: number;
  precision?: number; allowNegative?: boolean; resolution?: number;
  options?: string[]; rejectedOptions?: string[]; optionResults?: Record<string, QualityResult>;
  evidencePolicy?: string;
  policy?: { requireComment?: boolean; minPhotos?: number; maxPhotos?: number; requireReason?: boolean;
    reasons?: string[]; requireReview?: boolean; requireSupervisorApproval?: boolean; drawingRequired?: boolean;
    requireInstrument?: boolean; liveCaptureRequired?: boolean; maxTextLength?: number; allowNA?: boolean };
}
export function evaluateMeasurement(c: MeasurementDefinition, raw: string | string[], mode: 'absolute' | 'delta' = 'absolute') {
  if(raw==='__NA__'){
    if(!c.policy?.allowNA)throw new Error('Bu plan uygulanamaz (N/A) sonucuna izin vermiyor.');
    return {value:raw,result:'na' as QualityResult,canonical:undefined};
  }
  const type = c.type || 'numeric';
  let value: number | string | string[] = raw;
  let result: QualityResult = 'pass';
  let canonical: string | undefined;
  if (type === 'numeric') {
    if (typeof raw !== 'string' || !/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) throw new Error('Tam bir sayı girin; virgül veya nokta kullanabilirsiniz.');
    const decimals = raw.split(/[.,]/)[1]?.length || 0;
    if (c.precision !== undefined && decimals > c.precision) throw new Error(`En fazla ${c.precision} ondalık hane girin; değer yuvarlanmadı.`);
    value = Number(raw.replace(',', '.'));
    if (mode === 'delta') value = Number((c.nominal + value).toFixed(Math.max(decimals, String(c.nominal).split('.')[1]?.length || 0)));
    if (!Number.isFinite(value)) throw new Error('Geçerli bir sayı girin.');
    if (c.allowNegative === false && value < 0) throw new Error('Bu nokta negatif değer kabul etmiyor.');
    if (c.resolution && Math.abs(value / c.resolution - Math.round(value / c.resolution)) > 1e-7) throw new Error(`Ölçüm çözünürlüğü ${c.resolution} olmalıdır.`);
    canonical = String(value);
    result = (c.lsl != null && value < c.lsl) || (c.usl != null && value > c.usl) ? 'fail' : 'pass';
  } else if (type === 'text') {
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('Açıklama metni girin.');
    if (raw.length > (c.policy?.maxTextLength || 2000)) throw new Error('Metin izin verilen uzunluğu aşıyor.');
    value = raw.trim(); result = c.optionResults?.[value] || 'unclassified';
  } else {
    const options = type === 'visual' ? ['OK', 'NOK', 'SUSPECT'] : type === 'ok_nok' ? ['OK', 'NOK'] : type === 'boolean' ? ['yes', 'no'] : c.options || [];
    const selected = Array.isArray(raw) ? raw : [raw];
    if (!selected.length || selected.some(v => !options.includes(v)) || (type !== 'multi_select' && selected.length !== 1)) throw new Error('Geçerli bir seçenek seçin.');
    const outcomes = selected.map(v => c.optionResults?.[v] || (v === 'SUSPECT' ? 'review' : v === 'NOK' || c.rejectedOptions?.includes(v) ? 'fail' : type === 'boolean' ? 'unclassified' : 'pass'));
    result = outcomes.includes('fail') ? 'fail' : outcomes.includes('review') ? 'review' : outcomes.includes('unclassified') ? 'unclassified' : 'pass';
  }
  return { value, result, canonical };
}
export function evidenceErrors(c: MeasurementDefinition, result: QualityResult, evidence: {mimeType: string}[], comment: string, reason: string) {
  const errors: string[] = [];
  const p = c.policy || {};
  if(result==='na'&&!reason.trim())errors.push('Uygulanamaz (N/A) sonucu için gerekçe zorunludur.');
  const photos = evidence.filter(e => e.mimeType.startsWith('image/')).length;
  // Structured evidence rules apply to nonconforming/review results; legacy always rules remain effective.
  const needs = result === 'fail' || result === 'review';
  const minimum = needs ? p.minPhotos || 0 : 0;
  if (photos < minimum) errors.push(`En az ${minimum} fotoğraf gerekli; ${photos} fotoğraf eklendi.`);
  if (p.maxPhotos != null && photos > p.maxPhotos) errors.push(`En fazla ${p.maxPhotos} fotoğraf ekleyin.`);
  if (needs && p.requireComment && !comment.trim()) errors.push('Açıklama zorunludur.');
  if (needs && p.requireReason && (!reason.trim() || p.reasons?.length && !p.reasons.includes(reason))) errors.push('Geçerli kusur sebebi seçin.');
  const legacy = c.evidencePolicy;
  if ((legacy === 'always_required' || legacy === 'required_on_fail' && result === 'fail') && !evidence.length) errors.push('Kanıt dosyası zorunludur.');
  if (legacy === 'photo_required' && !photos) errors.push('Fotoğraf zorunludur.');
  if (legacy === 'media_required' && !evidence.some(e => /^(image|video)\//.test(e.mimeType))) errors.push('Fotoğraf veya video zorunludur.');
  if (legacy === 'document_required' && !evidence.some(e => e.mimeType === 'application/pdf')) errors.push('PDF belge zorunludur.');
  return errors;
}
export function orderedCells(characteristicIds: string[], count: number, order: 'sample' | 'characteristic') {
  const samples = Array.from({length: count}, (_, i) => i + 1);
  return order === 'sample' ? samples.flatMap(sample => characteristicIds.map(characteristic => ({sample, characteristic}))) : characteristicIds.flatMap(characteristic => samples.map(sample => ({sample, characteristic})));
}
