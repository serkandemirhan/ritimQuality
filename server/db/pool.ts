import type pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { createDatabasePool } from './connection.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const pool = createDatabasePool(process.env.DATABASE_URL);
if (process.env.VERCEL) attachDatabasePool(pool);

export async function withTenant<T>(tenantId: string, callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
