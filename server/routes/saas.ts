import { createInspectionWorkflow } from '../services/workflow.js';
import { inspectionRulesSchema, inspectionSignature, validateInspection, planSchema, assertRevisionUnchanged, conflict } from '../services/inspectionValidation.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { withTenant } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { assertQuota, assertSubscription, audit } from '../services/access.js';

export const saasRouter = Router();
saasRouter.use(requireAuth);

const entitySchema = z.record(z.unknown());
const idSchema = z.string().min(1).max(120);

saasRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const { tenantId } = req.auth!;
    const data = await withTenant(tenantId, async client => {
      const tenant = await client.query(`SELECT id, slug, name, legal_name, tax_number, tax_office, industry, facility_location,
          contact_email, contact_phone, plan_id, subscription_status, billing_period, subscription_renews_at,
          trial_ends_at, created_at FROM tenants WHERE id = $1`, [tenantId]);
      const users = await client.query(`SELECT id, name, email, role, department, station_or_machine, status, last_login_at
          FROM users WHERE tenant_id = $1 ORDER BY name`, [tenantId]);
      const products = await client.query('SELECT payload FROM products WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
      const controlPlans = await client.query('SELECT payload FROM control_plans WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
      const logs = await client.query('SELECT payload FROM inspection_logs WHERE tenant_id = $1 AND voided_at IS NULL ORDER BY occurred_at DESC', [tenantId]);
      const usage = await client.query(`SELECT
          (SELECT count(*)::int FROM control_plans WHERE tenant_id = $1) control_plans,
          (SELECT count(*)::int FROM users WHERE tenant_id = $1 AND status = 'active') users,
          (SELECT COALESCE(sum(jsonb_array_length(payload->'samples')), 0)::int FROM inspection_logs
            WHERE tenant_id = $1 AND voided_at IS NULL AND occurred_at >= date_trunc('month', now())) monthly_measurements`, [tenantId]);
      return {
        currentUserId: req.auth!.userId,
        company: tenant.rows[0], users: users.rows,
        products: products.rows.map(row => row.payload),
        controlPlans: controlPlans.rows.map(row => row.payload),
        inspectionLogs: logs.rows.map(row => row.payload),
        usage: usage.rows[0],
      };
    });
    res.json(data);
  } catch (error) { next(error); }
});

saasRouter.get('/inspection-rules', async (req, res, next) => {
  try {
    const result = await withTenant(req.auth!.tenantId, client => client.query('SELECT inspection_rules FROM tenants WHERE id=$1', [req.auth!.tenantId]));
    res.json(inspectionRulesSchema.parse(result.rows[0].inspection_rules));
  } catch (error) { next(error); }
});

saasRouter.put('/inspection-rules', requireRole('admin'), async (req, res, next) => {
  try {
    const input = inspectionRulesSchema.strict().parse(req.body);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      const before = (await client.query('SELECT inspection_rules FROM tenants WHERE id=$1 FOR UPDATE', [tenantId])).rows[0].inspection_rules;
      await client.query('UPDATE tenants SET inspection_rules=$2, updated_at=now() WHERE id=$1', [tenantId, input]);
      await audit(client, { tenantId, userId, action: 'inspection_rules.updated', entityType: 'tenant', entityId: tenantId, before, after: input, ip: req.ip });
    });
    res.json(input);
  } catch (error) { next(error); }
});

saasRouter.patch('/company', requireRole('admin'), async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().min(2), legalName: z.string().min(2), taxNumber: z.string().optional(), taxOffice: z.string().optional(), industry: z.string().optional(), facilityLocation: z.string().optional(), contactEmail: z.string().email(), contactPhone: z.string().optional() }).parse(req.body);
    const { tenantId, userId } = req.auth!;
    const company = await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      const before = (await client.query('SELECT * FROM tenants WHERE id = $1', [tenantId])).rows[0];
      const result = await client.query(`UPDATE tenants SET name=$2, legal_name=$3, tax_number=$4, tax_office=$5,
        industry=$6, facility_location=$7, contact_email=$8, contact_phone=$9, updated_at=now()
        WHERE id=$1 RETURNING *`, [tenantId, input.name, input.legalName, input.taxNumber, input.taxOffice, input.industry, input.facilityLocation, input.contactEmail, input.contactPhone]);
      await audit(client, { tenantId, userId, action: 'company.updated', entityType: 'tenant', entityId: tenantId, before, after: result.rows[0], ip: req.ip });
      return result.rows[0];
    });
    res.json(company);
  } catch (error) { next(error); }
});

saasRouter.put('/products/:id', requireRole('admin', 'quality_engineer'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id); const payload = entitySchema.parse(req.body);
    const code = z.string().min(1).parse(payload.code); const name = z.string().min(1).parse(payload.name);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      const before = (await client.query('SELECT payload FROM products WHERE tenant_id=$1 AND id=$2', [tenantId, id])).rows[0]?.payload;
      await client.query(`INSERT INTO products (id, tenant_id, code, name, payload) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (tenant_id,id) DO UPDATE SET code=$3,name=$4,payload=$5,updated_at=now()`, [id, tenantId, code, name, payload]);
      await audit(client, { tenantId, userId, action: before ? 'product.updated' : 'product.created', entityType: 'product', entityId: id, before, after: payload, ip: req.ip });
    });
    res.json(payload);
  } catch (error) { next(error); }
});

saasRouter.delete('/products/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id); const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      const before = (await client.query('SELECT payload FROM products WHERE tenant_id=$1 AND id=$2', [tenantId, id])).rows[0]?.payload;
      await client.query('DELETE FROM products WHERE tenant_id=$1 AND id=$2', [tenantId, id]);
      await audit(client, { tenantId, userId, action: 'product.deleted', entityType: 'product', entityId: id, before, ip: req.ip });
    });
    res.status(204).end();
  } catch (error) { next(error); }
});

saasRouter.put('/control-plans/:id', requireRole('admin', 'quality_engineer'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id); const payload = planSchema.parse(req.body);
    const productId = idSchema.parse(payload.productId); const version = z.string().min(1).parse(payload.version);
    const status = z.enum(['active', 'draft', 'archived']).parse(payload.status); const isActive = z.boolean().parse(payload.isActive);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      if (payload.id !== id) conflict('Plan kimliği tutarsız.');
      await client.query('SELECT id FROM products WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, productId]);
      const prior = (await client.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId,id])).rows[0]?.payload;
      if (prior && (await client.query('SELECT 1 FROM inspection_logs WHERE tenant_id=$1 AND control_plan_id=$2 LIMIT 1',[tenantId,id])).rowCount) assertRevisionUnchanged(prior,payload);
      const exists = await client.query('SELECT 1 FROM control_plans WHERE tenant_id=$1 AND id=$2', [tenantId, id]);
      if (!exists.rowCount) await assertQuota(client, tenantId, 'controlPlans'); else await assertSubscription(client, tenantId);
      if (isActive) await client.query(`UPDATE control_plans SET is_active=false, status=CASE WHEN status='active' THEN 'archived' ELSE status END,
        payload=jsonb_set(jsonb_set(payload,'{isActive}','false'::jsonb),'{status}','"archived"'::jsonb)
        WHERE tenant_id=$1 AND product_id=$2 AND id<>$3 AND is_active`, [tenantId, productId, id]);
      const before = (await client.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND id=$2', [tenantId, id])).rows[0]?.payload;
      await client.query(`INSERT INTO control_plans (id,tenant_id,product_id,version,status,is_active,payload) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (tenant_id,id) DO UPDATE SET version=$4,status=$5,is_active=$6,payload=$7,updated_at=now()`, [id, tenantId, productId, version, status, isActive, payload]);
      await audit(client, { tenantId, userId, action: before ? 'control_plan.updated' : 'control_plan.created', entityType: 'control_plan', entityId: id, before, after: payload, ip: req.ip });
    });
    res.json(payload);
  } catch (error) { next(error); }
});

saasRouter.delete('/control-plans/:id', requireRole('admin', 'quality_engineer'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id); const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      const used = await client.query('SELECT 1 FROM inspection_logs WHERE tenant_id=$1 AND control_plan_id=$2 LIMIT 1', [tenantId, id]);
      if (used.rowCount) {
        const error = new Error('Ölçüm kaydı bulunan kontrol planı silinemez; arşivleyin.');
        Object.assign(error, { status: 409 });
        throw error;
      }
      const before = (await client.query('DELETE FROM control_plans WHERE tenant_id=$1 AND id=$2 RETURNING payload', [tenantId, id])).rows[0]?.payload;
      await audit(client, { tenantId, userId, action:'control_plan.deleted', entityType:'control_plan', entityId:id, before, ip:req.ip });
    });
    res.status(204).end();
  } catch (error) { next(error); }
});

saasRouter.post('/inspection-logs', requireRole('admin', 'quality_engineer', 'operator'), async (req, res, next) => {
  try {
    let payload = entitySchema.parse(req.body); const id = idSchema.parse(payload.id);
    const productId = idSchema.parse(payload.productId); const controlPlanId = idSchema.parse(payload.controlPlanId);
    const sessionCode = z.string().min(1).parse(payload.sessionCode); const occurredAt = z.string().datetime().parse(payload.timestamp);
    const samples = z.array(z.unknown()).min(1).parse(payload.samples);
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      const signature = inspectionSignature(req.body);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenantId+':inspection:'+id]);
      const existing = (await client.query('SELECT payload,voided_at FROM inspection_logs WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
      if (existing) {
        if(existing.voided_at || existing.payload.operatorUserId !== userId || existing.payload.requestSignature !== signature) conflict('Bu kayıt kimliği başka bir ölçüm için kullanılmış.');
        payload=existing.payload; return;
      }
      const plan = (await client.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND id=$2 FOR SHARE',[tenantId,controlPlanId])).rows[0]?.payload;
      const actor = (await client.query('SELECT name FROM users WHERE tenant_id=$1 AND id=$2',[tenantId,userId])).rows[0];
      const rules = inspectionRulesSchema.parse((await client.query('SELECT inspection_rules FROM tenants WHERE id=$1 FOR SHARE', [tenantId])).rows[0].inspection_rules);
      payload = { ...validateInspection(payload,plan,{id:userId,name:actor.name},rules), requestSignature: signature };
      const attachments = (payload.samples as any[]).flatMap(sample => Object.values(sample.evidence || {}).flat()) as {id:string}[];
      const mediaIds=attachments.map(item=>item.id);
      const draftId=typeof payload.draftId==='string'?z.string().uuid().parse(payload.draftId):null;
      if(draftId&&!(await client.query('SELECT 1 FROM inspection_drafts WHERE tenant_id=$1 AND id=$2 AND claimed_by=$3',[tenantId,draftId,userId])).rowCount)conflict('Taslak bu kullanıcı tarafından devralınmamış.');
      if(new Set(mediaIds).size!==mediaIds.length) conflict('Bir kanıt birden fazla kontrol noktasına bağlanamaz.');
      if(mediaIds.length) {
        const owned=await client.query("SELECT id,mime_type FROM media_evidence WHERE tenant_id=$1 AND (uploaded_by=$2 OR draft_id=$4) AND inspection_id IS NULL AND upload_status='ready' AND id=ANY($3::uuid[]) FOR UPDATE",[tenantId,userId,mediaIds,draftId]);
        if(owned.rowCount!==mediaIds.length) conflict('Kanıt dosyası geçersiz veya başka kayda bağlı.');
        const mime=new Map(owned.rows.map(row=>[row.id,row.mime_type]));
        const policies=new Map(((plan as any).characteristics||[]).map((item:any)=>[item.id,item.evidencePolicy]));
        for(const sample of payload.samples as any[])for(const [characteristicId,items] of Object.entries(sample.evidence||{})){
          const types=(items as {id:string}[]).map(item=>mime.get(item.id)||'');const policy=policies.get(characteristicId);
          if(policy==='photo_required'&&!types.some(type=>type.startsWith('image/')))conflict('Bu kontrol noktası için fotoğraf zorunludur.');
          if(policy==='media_required'&&!types.some(type=>type.startsWith('image/')||type.startsWith('video/')))conflict('Bu kontrol noktası için fotoğraf veya video zorunludur.');
          if(policy==='document_required'&&!types.some(type=>type==='application/pdf'))conflict('Bu kontrol noktası için PDF belge zorunludur.');
        }
      }
      await assertQuota(client, tenantId, 'monthlyMeasurements', samples.length);
      await client.query(`INSERT INTO inspection_logs (id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, tenantId, productId, controlPlanId, sessionCode, occurredAt, payload]);
      for(const sample of payload.samples as any[]) for(const [characteristicId,items] of Object.entries(sample.evidence || {})) {
        await client.query('UPDATE media_evidence SET inspection_id=$1,draft_id=NULL,sample_index=$2,characteristic_id=$3 WHERE tenant_id=$4 AND id=ANY($5::uuid[])',[id,sample.sampleIndex,characteristicId,tenantId,(items as {id:string}[]).map(item=>item.id)]);
      }
      await createInspectionWorkflow(client,tenantId,userId,payload);
      if(typeof payload.draftId==='string')await client.query('DELETE FROM inspection_drafts WHERE tenant_id=$1 AND id=$2 AND claimed_by=$3',[tenantId,payload.draftId,userId]);
      await audit(client, { tenantId, userId, action: 'inspection.created', entityType: 'inspection_log', entityId: id, after: payload, ip: req.ip });
    });
    res.status(201).json(payload);
  } catch (error) { next(error); }
});

saasRouter.post('/inspection-logs/:id/void', requireRole('admin', 'quality_engineer'), async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id); const reason = z.object({ reason: z.string().min(5).max(500) }).parse(req.body).reason;
    const { tenantId, userId } = req.auth!;
    await withTenant(tenantId, async client => {
      await assertSubscription(client, tenantId);
      await client.query(`UPDATE inspection_logs SET voided_at=now(),voided_by=$3,void_reason=$4
        WHERE tenant_id=$1 AND id=$2 AND voided_at IS NULL`, [tenantId, id, userId, reason]);
      await audit(client, { tenantId, userId, action: 'inspection.voided', entityType: 'inspection_log', entityId: id, after: { reason }, ip: req.ip });
    });
    res.status(204).end();
  } catch (error) { next(error); }
});

saasRouter.post('/users', requireRole('admin'), async (req, res, next) => {
  try {
    const input = z.object({ id:z.string().min(1).max(120),name:z.string().min(2),email:z.string().email(),password:z.string().min(10).max(128).optional(),role:z.enum(['admin','quality_engineer','operator','auditor']),department:z.string().default(''),stationOrMachine:z.string().optional(),status:z.enum(['active','suspended']).default('active') }).parse(req.body);
    const { tenantId, userId } = req.auth!;
    const user = await withTenant(tenantId, async client => {
      const existing = (await client.query('SELECT * FROM users WHERE tenant_id=$1 AND id=$2', [tenantId,input.id])).rows[0];
      if (!existing) await assertQuota(client, tenantId, 'users'); else await assertSubscription(client, tenantId);
      if (!existing && !input.password) { const error = new Error('Yeni kullanıcı için geçici PIN/şifre zorunludur.'); Object.assign(error,{status:400}); throw error; }
      if(existing?.role==='admin' && (input.role!=='admin'||input.status!=='active')) {
        await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenantId]);
        if((await client.query("SELECT count(*)::int count FROM users WHERE tenant_id=$1 AND role='admin' AND status='active'",[tenantId])).rows[0].count<=1) conflict('Son aktif yöneticinin rolü veya durumu değiştirilemez.');
      }
      if(existing?.status==='suspended' && input.status==='active')await assertQuota(client,tenantId,'users');
      const hash = input.password ? await bcrypt.hash(input.password, 12) : existing.password_hash;
      const result = await client.query(`INSERT INTO users (id,tenant_id,name,email,password_hash,role,department,station_or_machine,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET name=$3,email=$4,password_hash=$5,role=$6,department=$7,station_or_machine=$8,status=$9,updated_at=now()
        WHERE users.tenant_id=$2 RETURNING id,name,email,role,department,station_or_machine,status`, [input.id,tenantId,input.name,input.email.toLowerCase(),hash,input.role,input.department,input.stationOrMachine,input.status]);
      if (!result.rowCount) { const error = new Error('Kullanıcı başka bir çalışma alanına ait.'); Object.assign(error,{status:403}); throw error; }
      await audit(client, { tenantId, userId, action:existing?'user.updated':'user.created', entityType:'user', entityId:result.rows[0].id, before:existing && { ...existing, password_hash: undefined }, after:result.rows[0], ip:req.ip });
      return result.rows[0];
    });
    res.status(201).json(user);
  } catch (error) { next(error); }
});

saasRouter.delete('/users/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id=idSchema.parse(req.params.id); const {tenantId,userId}=req.auth!;
    if (id===userId) { res.status(409).json({error:'Kendi hesabınızı silemezsiniz.'}); return; }
    await withTenant(tenantId, async client => {
      await assertSubscription(client,tenantId);
      const target=(await client.query('SELECT id,role,name,email FROM users WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
      if (target?.role==='admin') {
        const admins=await client.query("SELECT count(*)::int count FROM users WHERE tenant_id=$1 AND role='admin' AND status='active'",[tenantId]);
        if (admins.rows[0].count<=1) { const error=new Error('Son aktif yönetici silinemez.'); Object.assign(error,{status:409}); throw error; }
      }
      await client.query('DELETE FROM users WHERE tenant_id=$1 AND id=$2',[tenantId,id]);
      await audit(client,{tenantId,userId,action:'user.deleted',entityType:'user',entityId:id,before:target,ip:req.ip});
    });
    res.status(204).end();
  } catch(error){next(error);}
});

saasRouter.get('/audit-logs', requireRole('admin', 'auditor'), async (req, res, next) => {
  try {
    const { tenantId } = req.auth!;
    const result = await withTenant(tenantId, client => client.query(`SELECT a.*,u.name actor_name FROM audit_logs a
      LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.tenant_id=$1 ORDER BY a.created_at DESC LIMIT 500`, [tenantId]));
    res.json(result.rows);
  } catch (error) { next(error); }
});
