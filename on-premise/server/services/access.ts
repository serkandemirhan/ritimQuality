import type pg from 'pg';

export async function audit(
  client: pg.PoolClient,
  input: { userId: string; action: string; entityType: string; entityId?: string; before?: unknown; after?: unknown; ip?: string },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address)
     VALUES (current_setting('app.tenant_id')::uuid,$1,$2,$3,$4,$5,$6,$7)`,
    [input.userId, input.action, input.entityType, input.entityId, input.before || null, input.after || null, input.ip || null],
  );
}
