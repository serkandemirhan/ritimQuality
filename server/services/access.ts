import type pg from 'pg';
import { PLAN_LIMITS, type PlanId } from '../config/plans.js';

export async function assertSubscription(client: pg.PoolClient, tenantId: string): Promise<PlanId> {
  const result = await client.query(
    `SELECT plan_id, subscription_status, trial_ends_at, billing_source, manual_license_ends_at FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const tenant = result.rows[0];
  const trialValid = tenant?.subscription_status === 'trial' && new Date(tenant.trial_ends_at) > new Date();
  if (tenant?.billing_source === 'manual' && (!tenant.manual_license_ends_at || new Date(tenant.manual_license_ends_at).getTime() <= Date.now())) throw Object.assign(new Error('Manuel lisans süresi dolmuş.'), {status:402});
  if (!tenant || (!trialValid && tenant.subscription_status !== 'active')) {
    const error = new Error('Abonelik aktif değil.');
    Object.assign(error, { status: 402 });
    throw error;
  }
  return tenant.plan_id;
}

export async function assertQuota(
  client: pg.PoolClient,
  tenantId: string,
  resource: 'controlPlans' | 'users' | 'monthlyMeasurements',
  requestedAmount = 1,
): Promise<void> {
  await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenantId]);
  const planId = await assertSubscription(client, tenantId);
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
    const error = new Error(`Paket kotası doldu: ${resource}`);
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
