import type pg from 'pg';
import { pool } from '../db/pool.js';
export async function withPlatform<T>(tenantId: string | null, callback: (client: pg.PoolClient) => Promise<T>, snapshot = false): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query(snapshot ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN');
        await client.query("SELECT set_config('app.platform_owner','on',true)");
        if (tenantId)
            await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function platformAudit(client: pg.PoolClient, actor: string, tenantId: string | null, action: string, reason: string, metadata: unknown = {}) {
    await client.query('INSERT INTO platform_audit_events(actor_user_id,tenant_id,action,reason,metadata) VALUES($1,$2,$3,$4,$5)', [actor, tenantId, action, reason, metadata]);
}
