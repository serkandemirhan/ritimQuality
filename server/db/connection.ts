import pg from 'pg';

export function createDatabasePool(connectionString: string) {
  return new pg.Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}) } : false,
    max: Number(process.env.DATABASE_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: process.env.VERCEL ? 5000 : 30000,
    allowExitOnIdle: true,
  });
}
