import type pg from 'pg';
import {hasUnlimitedPilot} from './pilotAccess.js';
import { PLAN_LIMITS, type PlanId } from '../config/plans.js';

async function subscriptionAccess(client: pg.PoolClient, tenantId: string): Promise<{planId:PlanId;unlimited:boolean}> {
  const result = await client.query(
    `SELECT slug, pilot_unlimited, platform_suspended, plan_id, subscription_status, trial_ends_at, billing_source, manual_license_ends_at FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const tenant = result.rows[0];
  if(tenant?.platform_suspended)throw Object.assign(Error('Firma hesabı geçici olarak durduruldu.'),{status:403});
  if(tenant&&hasUnlimitedPilot(tenant))return {planId:tenant.plan_id,unlimited:true};
  const trialValid = tenant?.subscription_status === 'trial' && new Date(tenant.trial_ends_at) > new Date();
  if (tenant?.billing_source === 'manual' && (!tenant.manual_license_ends_at || new Date(tenant.manual_license_ends_at).getTime() <= Date.now())) throw Object.assign(new Error('Manuel lisans süresi dolmuş.'), {status:402});
  if (!tenant || (!trialValid && tenant.subscription_status !== 'active')) {
    const error = new Error('Abonelik aktif değil.');
    Object.assign(error, { status: 402 });
    throw error;
  }
  return {planId:tenant.plan_id,unlimited:false};
}

export async function assertSubscription(client:pg.PoolClient,tenantId:string):Promise<PlanId>{
  return (await subscriptionAccess(client,tenantId)).planId;
}

export async function assertQuota(
  client: pg.PoolClient,
  tenantId: string,
  resource: 'controlPlans' | 'users' | 'monthlyMeasurements',
  requestedAmount = 1,
): Promise<void> {
  await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenantId]);
  const {planId,unlimited} = await subscriptionAccess(client,tenantId);
  if(unlimited)return;
  // Free plans consume quota only when published, never when saving drafts.
  if (planId === 'free' && resource === 'controlPlans') return;
  const limits = PLAN_LIMITS[planId];
  const sql = resource === 'controlPlans'
    ? 'SELECT count(*)::int count FROM control_plans WHERE tenant_id = $1'
    : resource === 'users'
      ? 'SELECT count(*)::int count FROM users WHERE tenant_id = $1 AND status = \'active\''
      : `SELECT COALESCE(sum(jsonb_array_length(payload->'samples')), 0)::int count
         FROM inspection_logs WHERE tenant_id = $1 AND voided_at IS NULL
           AND occurred_at >= date_trunc('month', now())`;
  const result = await client.query(sql, [tenantId]);
  if (result.rows[0].count + requestedAmount > limits[resource]) {
    const labels={controlPlans:'kontrol planı / revizyon sayısı',users:'aktif kullanıcı sayısı',monthlyMeasurements:'aylık numune sayısı'};
    const error = new Error(`Paketinizdeki ${labels[resource]} sınırına ulaştınız. Paket ve kullanım bilgilerinizi kontrol edin.`);
    Object.assign(error, { status: 409, code: 'QUOTA_EXCEEDED' });
    throw error;
  }
}

export async function audit(
  client: pg.PoolClient,
  input: { tenantId: string; userId: string; action: string; entityType: string; entityId?: string; before?: unknown; after?: unknown; ip?: string },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::inet)`,
    [input.tenantId, input.userId, input.action, input.entityType, input.entityId, input.before || null, input.after || null, input.ip || ''],
  );
}

/** Caller holds the tenant lock before any product/plan locks. Replacement revisions
 * for the same product consume the same slot; parallel products serialize here. */
export async function assertActivePlanQuota(client:pg.PoolClient,tenantId:string,productId:string):Promise<void>{
  const {planId,unlimited}=await subscriptionAccess(client,tenantId);
  if(unlimited||planId!=='free')return;
  const result=await client.query("SELECT count(*)::int count FROM control_plans WHERE tenant_id=$1 AND is_active AND status='active' AND product_id<>$2",[tenantId,productId]);
  if(result.rows[0].count>=PLAN_LIMITS.free.controlPlans)throw Object.assign(new Error('Ücretsiz pakette en fazla 2 aktif kontrol planı kullanabilirsiniz. Bir planı arşivleyin veya paketinizi yükseltin.'),{status:409,code:'QUOTA_EXCEEDED'});
}
