import { readFileSync as read, writeFileSync as write, copyFileSync as copy } from 'node:fs';
const edit = (path, fn) => write(path, fn(read(path, 'utf8').replace(/\r\n/g, '\n')));
copy('server/services/inspectionValidation.ts', 'on-premise/server/services/inspectionValidation.ts');
edit('server/middleware/auth.ts', s => s.replace("import jwt from 'jsonwebtoken';", "import jwt from 'jsonwebtoken';\nimport { withTenant } from '../db/pool.js';")
  .replace('export function requireAuth(req: Request, res: Response, next: NextFunction): void', 'export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>')
  .replace('req.auth = jwt.verify(token, jwtSecret()) as AuthClaims;', `const claims = jwt.verify(token, jwtSecret()) as AuthClaims;
    const result = await withTenant(claims.tenantId, client => client.query('SELECT role,status FROM users WHERE tenant_id=$1 AND id=$2', [claims.tenantId, claims.userId]));
    const user = result.rows[0];
    if (!user || user.status !== 'active') { res.status(401).json({error:'Kullanıcı hesabı aktif değil.'}); return; }
    req.auth = {userId:claims.userId, tenantId:claims.tenantId, role:user.role};`));
for (const [path, saas] of [['server/routes/saas.ts', true], ['on-premise/server/routes/app.ts', false]]) edit(path, s => {
  s = "import { validateInspection, planSchema, assertRevisionUnchanged, conflict } from '../services/inspectionValidation.js';\n" + s;
  const start = s.indexOf(saas ? "saasRouter.put('/control-plans/:id'" : "appRouter.put('/control-plans/:id'");
  const end = s.indexOf(saas ? "saasRouter.delete('/control-plans/:id'" : "appRouter.delete('/control-plans/:id'", start);
  let block = s.slice(start, end);
  block = block.replace('entitySchema.parse(req.body)', 'planSchema.parse(req.body)');
  const anchor = saas ? "      const exists = await client.query" : "      if(isActive)";
  const guard = `      if (payload.id !== id) conflict('Plan kimliği tutarsız.');
      await client.query('SELECT id FROM products WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, productId]);
      const prior = (await client.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId,id])).rows[0]?.payload;
      if (prior && (await client.query('SELECT 1 FROM inspection_logs WHERE tenant_id=$1 AND control_plan_id=$2 LIMIT 1',[tenantId,id])).rowCount) assertRevisionUnchanged(prior,payload);
`;
  block = block.replace(anchor, guard + anchor);
  s = s.slice(0,start) + block + s.slice(end);
  if (saas) {
    s = s.replace("    const payload = entitySchema.parse(req.body); const id = idSchema.parse(payload.id);", "    let payload = entitySchema.parse(req.body); const id = idSchema.parse(payload.id);");
    s = s.replace("      await assertQuota(client, tenantId, 'monthlyMeasurements', samples.length);", `      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenantId+':inspection:'+id]);
      const existing = (await client.query('SELECT payload,voided_at FROM inspection_logs WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
      if (existing) {
        if(existing.voided_at || existing.payload.operatorUserId !== userId || JSON.stringify(existing.payload.samples.map((s: any) => s.values)) !== JSON.stringify((payload.samples as any[]).map(s => s.values)) || existing.payload.controlPlanId !== payload.controlPlanId || existing.payload.lotNumber !== payload.lotNumber || existing.payload.orderNumber !== payload.orderNumber) conflict('Bu kayıt kimliği başka bir ölçüm için kullanılmış.');
        payload=existing.payload; return;
      }
      const plan = (await client.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND id=$2 FOR SHARE',[tenantId,controlPlanId])).rows[0]?.payload;
      const actor = (await client.query('SELECT name FROM users WHERE tenant_id=$1 AND id=$2',[tenantId,userId])).rows[0];
      payload = validateInspection(payload,plan,{id:userId,name:actor.name});
      await assertQuota(client, tenantId, 'monthlyMeasurements', samples.length);`);
  } else {
    s = s.replace('const payload=entitySchema.parse(req.body); const id=idSchema.parse(payload.id);', 'let payload=entitySchema.parse(req.body); const id=idSchema.parse(payload.id);');
    const anchor = "      const planPayload=(await client.query";
    s = s.replace(anchor, `      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenantId+':inspection:'+id]);
      const existing=(await client.query('SELECT payload,voided_at FROM inspection_logs WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
      if(existing){
        if(existing.voided_at || existing.payload.operatorUserId !== req.auth!.userId || JSON.stringify(existing.payload.samples.map((s:any)=>s.values)) !== JSON.stringify(samples.map(s=>s.values)) || existing.payload.controlPlanId !== planId || existing.payload.lotNumber !== payload.lotNumber || existing.payload.orderNumber !== payload.orderNumber) conflict('Bu kayıt kimliği başka bir ölçüm için kullanılmış.');
        payload=existing.payload;return;
      }
` + anchor);
    s = s.replace("'SELECT payload FROM control_plans WHERE id=$1',[planId]", "'SELECT payload FROM control_plans WHERE id=$1 FOR SHARE',[planId]");
    s = s.replace('      const characteristics=Array.isArray(planPayload.characteristics)', `      const actor=(await client.query('SELECT name FROM users WHERE id=$1',[req.auth!.userId])).rows[0];
      payload=validateInspection(payload,planPayload,{id:req.auth!.userId,name:actor.name});
      samples.splice(0,samples.length,...payload.samples as Record<string,unknown>[]);
      const characteristics=Array.isArray(planPayload.characteristics)`);
  }
  return s;
});
// Preserve the exact plan used for new certificates; legacy records retain their existing fallback.
for (const prefix of ['', 'on-premise/']) {
  edit(prefix+'src/types.ts', s => s.replace('export interface InspectionLog {', 'export interface InspectionLog {\n  controlPlanSnapshot?: ControlPlan;\n  operatorUserId?: string;'));
  edit(prefix+'src/App.tsx', s => s.replace('controlPlans.find(cp => cp.id === certificateLog.controlPlanId)', 'certificateLog.controlPlanSnapshot || controlPlans.find(cp => cp.id === certificateLog.controlPlanId)'));
  edit(prefix+'src/components/OperatorStation.tsx', s => s
    .replace(" || plans[0]", '')
    .replace('onClick={handleFillDemoValues}', "hidden={!import.meta.env.DEV} onClick={handleFillDemoValues}")
    .replace("`LOT-${new Date().getFullYear()}-0815-B`", "''")
    .replace("useState<string>('IE-99210')", "useState<string>('')")
    .replace("lotNumber || 'LOT-VAR-01'", 'lotNumber.trim()')
    .replace("orderNumber || 'IE-001'", 'orderNumber.trim()')
    .replace("if (!currentPlan || characteristics.length === 0) return;", "if (!currentPlan || !currentPlan.isActive || currentPlan.status !== 'active' || !characteristics.length || !lotNumber.trim() || !orderNumber.trim()) { alert('Aktif plan, parti ve iş emri zorunludur.'); return; }")
    .replace('setActivePointNo(1);\n    setActiveSampleIndex(1);', 'setActivePointNo(characteristics[0].pointNo);\n    setActiveSampleIndex(1);'));
}
