import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabasePool } from './connection.js';
const migrationUrl=process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if(!migrationUrl)throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
if(new URL(migrationUrl).port==='6543')throw new Error('Migrations require a direct or session-pooler connection (port 5432), not transaction pooling.');
const pool=createDatabasePool(migrationUrl);
const directory=join(dirname(fileURLToPath(import.meta.url)),'migrations');
try {
  const client=await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('quality-schema-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
    const versions=new Set((await client.query('SELECT version FROM schema_migrations')).rows.map(row=>row.version));
    for(const file of (await readdir(directory)).filter(file=>file.endsWith('.sql')).sort()){
      const version=file.slice(0,-4);
      if(versions.has(version) || version.startsWith('001_') && [...versions].some(v=>String(v).startsWith('001_')))continue;
      try { await client.query('BEGIN'); await client.query(await readFile(join(directory,file),'utf8')); await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]); await client.query('COMMIT'); console.log('Applied '+version); }
      catch(error){await client.query('ROLLBACK');throw error;}
    }
  } finally {await client.query("SELECT pg_advisory_unlock(hashtext('quality-schema-migrations'))");client.release();}
} finally {await pool.end();}
