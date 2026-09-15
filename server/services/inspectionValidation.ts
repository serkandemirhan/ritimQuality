import { createHash } from 'node:crypto';
import { z } from 'zod';

const valueSchema = z.union([z.number().finite(), z.string(), z.boolean(), z.array(z.string()), z.null()]);
const characteristicSchema = z.object({
  id: z.string().min(1), pointNo: z.number().int().positive(), name: z.string().min(1),
  type: z.enum(['numeric', 'ok_nok', 'visual', 'single_select', 'multi_select']).default('numeric'),
  nominal: z.number().finite(), lsl: z.number().finite(), usl: z.number().finite(),
  options: z.array(z.string()).optional(), rejectedOptions: z.array(z.string()).optional(),
  evidencePolicy: z.enum(['none', 'optional', 'required_on_fail', 'always_required', 'photo_required', 'media_required', 'document_required']).default('none'),
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
    if (c.type === 'numeric' && (c.lsl >= c.usl || c.nominal < c.lsl || c.nominal > c.usl))
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

export function validateInspection(input: Record<string, unknown>, rawPlan: unknown, actor: { id: string; name: string }) {
  const plan = planSchema.parse(rawPlan);
  if (!plan.isActive || plan.status !== 'active') conflict('Yalnızca aktif kontrol planıyla ölçüm kaydedilebilir.');
  if (input.productId !== plan.productId || input.controlPlanId !== plan.id || input.controlPlanVersion !== plan.version)
    conflict('Ürün veya plan revizyonu değişti. Kontrol planını yeniden açın.');
  const samples = z.array(z.object({
    sampleIndex: z.number().int().positive(), values: z.record(valueSchema),
    pointNotes: z.record(z.string().trim().max(2000)).optional(),
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
      if (c.type === 'numeric') {
        if (typeof value !== 'number' || !Number.isFinite(value)) conflict(`#${c.pointNo}: sayısal ölçüm zorunludur.`);
        status = value < c.lsl || value > c.usl ? 'fail' : Math.min(value - c.lsl, c.usl - value) <= (c.usl - c.lsl) * .12 ? 'warning' : 'pass';
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
      statuses[c.id] = status;
      if (status === 'fail') failed++;
      if (status === 'warning') warning++;
    }
    return { ...sample, statuses };
  });
  z.string().trim().min(1).max(120).parse(input.lotNumber);
  z.string().trim().min(1).max(120).parse(input.orderNumber);
  return { ...input, samples: normalized, operatorUserId: actor.id, operatorName: actor.name,
    controlPlanSnapshot: rawPlan, sampleCount: samples.length, totalPointsChecked: samples.length * plan.characteristics.length,
    failedPointsCount: failed, warningPointsCount: warning, overallStatus: failed ? 'fail' : warning ? 'warning' : 'pass' };
}

// Only lifecycle metadata may change once measurements reference a revision.
export function assertRevisionUnchanged(before: Record<string, unknown>, after: Record<string, unknown>) {
  const content = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['isActive', 'status', 'updatedAt'].includes(key)).sort(([a], [b]) => a.localeCompare(b)));
  if (canonical(content(before)) !== canonical(content(after))) conflict('Bu revizyon ölçümde kullanılmış. Değişiklik için yeni revizyon oluşturun.');
}
