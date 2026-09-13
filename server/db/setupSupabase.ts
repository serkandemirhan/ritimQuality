import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createDatabasePool } from './connection.js';
import { createClient } from '@supabase/supabase-js';
import { MAX_MEDIA_BYTES, MEDIA_MIME_TYPES } from '../services/mediaStorage.js';

const url=process.env.MIGRATION_DATABASE_URL;
const password=process.env.QUALITY_DB_PASSWORD;
if(!url || !password || password.length<24)throw new Error('MIGRATION_DATABASE_URL and a QUALITY_DB_PASSWORD of at least 24 characters are required');
if(new URL(url).port==='6543')throw new Error('Use direct/session pooling on port 5432 for setup');
const projectUrl=process.env.SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!projectUrl||!secret)throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
// Reusable migrations are run explicitly, never during a Vercel build or request.
await import('./migrate.js');
const pool=createDatabasePool(url);
try{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(await readFile(new URL('../../supabase/runtime-role.sql',import.meta.url),'utf8').catch(()=>readFile('supabase/runtime-role.sql','utf8')));
    const statement=(await client.query("SELECT format('ALTER ROLE qualitrack_app PASSWORD %L',$1::text) sql",[password])).rows[0].sql;
    await client.query(statement);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}finally{await pool.end();}
const storage=createClient(projectUrl,secret,{auth:{persistSession:false,autoRefreshToken:false}}).storage;
const bucket=process.env.SUPABASE_STORAGE_BUCKET||'quality-evidence';
const existing=await storage.listBuckets();if(existing.error)throw existing.error;
const found=existing.data.find(item=>item.id===bucket);
if(found?.public)throw new Error('The selected bucket is public. Choose a new private bucket for quality evidence.');
const options={public:false,fileSizeLimit:MAX_MEDIA_BYTES,allowedMimeTypes:[...MEDIA_MIME_TYPES]};
const result=found?await storage.updateBucket(bucket,options):await storage.createBucket(bucket,options);
if(result.error)throw result.error;
console.log('Application migrations, restricted database role and private Storage bucket are ready.');
