import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

let organizationId: string | undefined;

async function getOrganizationId(): Promise<string> {
  if (organizationId) return organizationId;
  const result = await pool.query('SELECT id FROM tenants ORDER BY created_at LIMIT 2');
  if (result.rowCount !== 1) throw new Error('On-premise çalışma modu tam olarak bir kurum kaydı gerektirir.');
  organizationId = result.rows[0].id;
  return organizationId!;
}

export async function withDatabase<T>(callback: (client: pg.PoolClient, tenantId: string) => Promise<T>): Promise<T> {
  const tenantId = await getOrganizationId();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await callback(client, tenantId);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
