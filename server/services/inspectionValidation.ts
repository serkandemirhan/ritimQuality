import { createHash } from 'node:crypto';
import { z } from 'zod';
import { evaluateMeasurement, evidenceErrors, type MeasurementDefinition } from './measurementCore.js';

const valueSchema = z.union([z.number().finite(), z.string(), z.boolean(), z.array(z.string()), z.null()]);
const characteristicSchema = z.object({
  id: z.string().min(1), pointNo: z.number().int().positive(), name: z.string().min(1),
  type: z.enum(['numeric', 'ok_nok', 'visual', 'single_select', 'multi_select', 'boolean', 'text']).default('numeric'),
  nominal: z.number().finite(), lsl: z.number().finite().optional(), usl: z.number().finite().optional(),
  options: z.array(z.string()).optional(), rejectedOptions: z.array(z.string()).optional(),
  evidencePolicy: z.enum(['none', 'optional', 'required_on_fail', 'always_required', 'photo_required', 'media_required', 'document_required']).default('none'),
  precision: z.number().int().min(0).max(12).optional(), allowNegative: z.boolean().optional(), resolution: z.number().positive().optional(),
  optionResults: z.record(z.enum(['pass','fail','review'])).optional(),
  policy: z.object({requireComment:z.boolean().optional(),minPhotos:z.number().int().min(0).max(100).optional(),maxPhotos:z.number().int().min(0).max(100).optional(),requireReason:z.boolean().optional(),reasons:z.array(z.string()).optional(),requireReview:z.boolean().optional(),requireSupervisorApproval:z.boolean().optional(),drawingRequired:z.boolean().optional(),requireInstrument:z.boolean().optional(),liveCaptureRequired:z.boolean().optional(),maxTextLength:z.number().int().positive().max(2000).optional(),allowNA:z.boolean().optional()}).optional(),
}).passthrough();
export const planSchema = z.object({
  id: z.string().min(1), productId: z.string().min(1), version: z.string().min(1),
  status: z.enum(['active', 'draft', 'archived']), isActive: z.boolean(),
  characteristics: z.array(characteristicSchema).min(1),
}).passthrough().superRefine((plan, ctx) => {
  if (plan.isActive !== (plan.status === 'active')) ctx.addIssue({ code: 'custom', message: 'Aktif plan durumu tutarsız.' });
  if (new Set(plan.characteristics.map(c => c.id)).size !== plan.characteristics.length ||
      new Set(plan.characteristics.map(c => c.pointNo)).size !== plan.characteristics.length)
    ctx.addIssue({ code: 'custom', message: 'Kontrol noktaları benzersiz olmalıdır.' });
  for (const c of plan.characteristics) {
    if(c.policy?.minPhotos!=null&&c.policy.maxPhotos!=null&&c.policy.minPhotos>c.policy.maxPhotos)ctx.addIssue({code:'custom',message:'Minimum fotoğraf adedi maksimumu aşamaz.'});
    if (c.type === 'numeric' && (c.lsl!=null&&c.usl!=null&&c.lsl>=c.usl || c.lsl!=null&&c.nominal<c.lsl || c.usl!=null&&c.nominal>c.usl))
      ctx.addIssue({ code: 'custom', message: `#${c.pointNo}: tolerans aralığı geçersiz.` });
    if (c.type.endsWith('select') && (!c.options?.length || new Set(c.options).size !== c.options.length || c.rejectedOptions?.some(v => !c.options!.includes(v))))
      ctx.addIssue({ code: 'custom', message: `#${c.pointNo}: seçenekler geçersiz.` });
  }
});

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export const inspectionSignature = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function conflict(message: string): never { throw Object.assign(new Error(message), { status: 409 }); }

export const inspectionRulesSchema = z.object({
  requireActivePlan: z.boolean().default(false),
  requireLotNumber: z.boolean().default(false),
  requireOrderNumber: z.boolean().default(false),
});

export function validateInspection(input: Record<string, unknown>, rawPlan: unknown, actor: { id: string; name: string }, rules = inspectionRulesSchema.parse({})) {
  const plan = planSchema.parse(rawPlan);
  if (rules.requireActivePlan && (!plan.isActive || plan.status !== 'active')) conflict('Yalnızca aktif kontrol planıyla ölçüm kaydedilebilir.');
  if (input.productId !== plan.productId || input.controlPlanId !== plan.id || input.controlPlanVersion !== plan.version)
    conflict('Ürün veya plan revizyonu değişti. Kontrol planını yeniden açın.');
  const mobile = input.mobileMeasurement === undefined ? undefined : validateMobileAttempts(input, plan, rawPlan, actor);
  const samples = z.array(z.object({
    sampleIndex: z.number().int().positive(), values: z.record(valueSchema),
    pointNotes: z.record(z.string().trim().max(2000)).optional(),
    pointReasons: z.record(z.string().trim().max(2000)).optional(),
    evidence: z.record(z.array(z.object({ id: z.string().uuid() }).passthrough())).optional(),
  })).min(1).max(1000).parse(input.samples);
  if (input.sampleCount !== samples.length || samples.some((s, index) => s.sampleIndex !== index + 1))
    conflict('Numune sayısı veya sırası geçersiz.');
  const expected = new Set(plan.characteristics.map(c => c.id));
  let failed = 0; let warning = 0;
  const normalized = samples.map(sample => {
    if (Object.keys(sample.pointNotes || {}).some(id => !expected.has(id)) || Object.keys(sample.values).some(id => !expected.has(id)) || Object.keys(sample.evidence || {}).some(id => !expected.has(id)))
      conflict('Planda bulunmayan kontrol noktası.');
    const statuses: Record<string, 'pass' | 'warning' | 'fail'> = {};
    for (const c of plan.characteristics) {
      const value = sample.values[c.id];
      let status: 'pass' | 'warning' | 'fail' = 'pass';
      if (mobile || c.type === 'boolean' || c.type === 'text' || c.type === 'visual' && value === 'SUSPECT') {
        const evaluated = evaluateMeasurement(c as MeasurementDefinition, typeof value === 'number' ? String(value) : value as string | string[]);
        status = evaluated.result === 'pass' ? 'pass' : evaluated.result === 'fail' ? 'fail' : 'warning';
      } else if (c.type === 'numeric') {
        if (typeof value !== 'number' || !Number.isFinite(value)) conflict(`#${c.pointNo}: sayısal ölçüm zorunludur.`);
        status = c.lsl!=null&&value<c.lsl || c.usl!=null&&value>c.usl ? 'fail' : c.lsl!=null&&c.usl!=null&&Math.min(value - c.lsl, c.usl - value) <= (c.usl - c.lsl) * .12 ? 'warning' : 'pass';
      } else if (c.type === 'ok_nok' || c.type === 'visual') {
        if (![true, false, 'OK', 'NOK'].includes(value as boolean | string)) conflict(`#${c.pointNo}: OK/NOK seçin.`);
        status = value === true || value === 'OK' ? 'pass' : 'fail';
      } else {
        const chosen = c.type === 'single_select' && typeof value === 'string' ? [value] : c.type === 'multi_select' && Array.isArray(value) ? value : [];
        if (!chosen.length || new Set(chosen).size !== chosen.length || chosen.some(v => !c.options?.includes(v))) conflict(`#${c.pointNo}: geçerli seçim zorunludur.`);
        if (chosen.some(v => c.rejectedOptions?.includes(v))) status = 'fail';
      }
      if ((['always_required','photo_required','media_required','document_required'].includes(c.evidencePolicy) || c.evidencePolicy === 'required_on_fail' && status === 'fail') && !sample.evidence?.[c.id]?.length)
        conflict(`#${c.pointNo}: kanıt dosyası zorunludur.`);
      if(!mobile&&c.policy){
        const evaluated=evaluateMeasurement(c as MeasurementDefinition,typeof value==='number'?String(value):value===true?'OK':value===false?'NOK':value as string|string[]);
        const errors=evidenceErrors(c as MeasurementDefinition,evaluated.result,(sample.evidence?.[c.id]||[]).map(e=>({mimeType:typeof e.mimeType==='string'?e.mimeType:''})),sample.pointNotes?.[c.id]||'',sample.pointReasons?.[c.id]||'');
        if(c.policy.requireInstrument&&!input.equipmentId)errors.push('Ölçüm aleti zorunludur.');
        if(c.policy.liveCaptureRequired)errors.push('Doğrulanmış canlı çekim desteği gerekli.');
        if(errors.length)conflict(errors.join(' '));
      }
      statuses[c.id] = status;
      if (status === 'fail') failed++;
      if (status === 'warning') warning++;
    }
    return { ...sample, statuses };
  });
  const lotNumber = z.string().trim().min(rules.requireLotNumber ? 1 : 0).max(120).parse(input.lotNumber ?? '');
  const orderNumber = z.string().trim().min(rules.requireOrderNumber ? 1 : 0).max(120).parse(input.orderNumber ?? '');
  return { ...input, ...(mobile ? {mobileMeasurement:mobile} : {}),requiresReview:plan.characteristics.some(c=>c.policy?.requireReview||c.policy?.requireSupervisorApproval)||Boolean(mobile?.attempts.some(a=>a.result!=='pass')),hasHistoricalFailure:Boolean(mobile?.attempts.some(a=>a.result==='fail')), lotNumber, orderNumber, samples: normalized, operatorUserId: actor.id, operatorName: actor.name,
    controlPlanSnapshot: rawPlan, sampleCount: samples.length, totalPointsChecked: samples.length * plan.characteristics.length,
    failedPointsCount: failed, warningPointsCount: warning, overallStatus: failed ? 'fail' : warning ? 'warning' : 'pass' };
}

const attemptSchema=z.object({id:z.string().uuid(),sample:z.number().int().min(1).max(5),characteristic:z.string(),raw:z.union([z.string(),z.array(z.string())]),mode:z.enum(['absolute','delta']),value:z.union([z.number(),z.string(),z.array(z.string())]),canonical:z.string().optional(),result:z.string(),comment:z.string().max(2000),reason:z.string().max(2000),retryReason:z.string().max(2000),photos:z.array(z.string().uuid()),previousAttemptId:z.string().uuid().optional(),operatorId:z.string(),measuredAt:z.string().datetime(),source:z.string(),instrumentId:z.string()});
function validateMobileAttempts(input:Record<string,unknown>,plan:z.infer<typeof planSchema>,rawPlan:unknown,actor:{id:string;name:string}) {
  const mobile=z.object({version:z.literal(1),attempts:z.array(attemptSchema).min(1).max(10000)}).parse(input.mobileMeasurement);
  const snapshot=input.controlPlanSnapshot as Record<string,unknown>;
  const content=(p:Record<string,unknown>)=>Object.fromEntries(Object.entries(p||{}).filter(([key])=>!['status','isActive','updatedAt'].includes(key)));
  if(canonical(content(snapshot))!==canonical(content(rawPlan as Record<string,unknown>)))conflict('Plan revizyonunun içeriği değişti. Yerel ölçümler korunuyor; kalite yetkilisine başvurun.');
  const samples=z.array(z.object({sampleIndex:z.number(),values:z.record(valueSchema),evidence:z.record(z.array(z.object({id:z.string(),mimeType:z.string()}))).optional()})).max(5).parse(input.samples);
  const latest=new Map<string,z.infer<typeof attemptSchema>>();const ids=new Set<string>();const usedPhotos=new Set<string>();
  for(const a of mobile.attempts){
    const c=plan.characteristics.find(c=>c.id===a.characteristic);const sample=samples.find(s=>s.sampleIndex===a.sample);
    if(!c||!sample||a.operatorId!==actor.id||ids.has(a.id))conflict('Deneme kimliği, operatör veya numune geçersiz.');
    ids.add(a.id);const key=`${a.sample}:${a.characteristic}`;const previous=latest.get(key);
    if(a.previousAttemptId!==previous?.id||previous&&!a.retryReason.trim())conflict('Tekrar ölçüm zinciri veya gerekçesi geçersiz.');
    const evaluated=evaluateMeasurement(c as MeasurementDefinition,a.raw,a.mode);
    if(canonical(evaluated.value)!==canonical(a.value)||canonical(sample.values[c.id])===undefined)conflict('Deneme değeri ham girişle eşleşmiyor.');
    a.result=evaluated.result;a.canonical=evaluated.canonical;
    const media=a.photos.map(id=>{const item=sample.evidence?.[c.id]?.find(e=>e.id===id);if(!item||usedPhotos.has(id))conflict('Deneme kanıtı eksik veya tekrar kullanılmış.');usedPhotos.add(id);return item;});
    const errors=evidenceErrors(c as MeasurementDefinition,evaluated.result,media.map(m=>({mimeType:m.mimeType!})),a.comment,a.reason);
    if(c.policy?.requireInstrument&&!a.instrumentId.trim())errors.push('Ölçüm aleti zorunludur.');
    if(c.policy?.liveCaptureRequired)errors.push('Doğrulanmış canlı çekim desteği gerekli.');
    if(errors.length)conflict(errors.join(' '));
    latest.set(key,a);
  }
  for(const sample of samples)for(const c of plan.characteristics){const a=latest.get(`${sample.sampleIndex}:${c.id}`);if(!a||canonical(a.value)!==canonical(sample.values[c.id]))conflict('Son ölçüm denemesi ile sonuç matrisi eşleşmiyor.');}
  return mobile;
}

// Only lifecycle metadata may change once measurements reference a revision.
export function assertRevisionUnchanged(before: Record<string, unknown>, after: Record<string, unknown>) {
  const content = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['isActive', 'status', 'updatedAt'].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
  if (canonical(content(before)) !== canonical(content(after))) conflict('Bu revizyon ölçümde kullanılmış. Değişiklik için yeni revizyon oluşturun.');
}
