import {readFileSync as read, writeFileSync as write, copyFileSync as copy} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
let media=read('on-premise/server/routes/app.ts','utf8').replace(/\r\n/g,'\n');
media=media.slice(media.indexOf('const mediaRoot'),media.indexOf("appRouter.get('/bootstrap'"));
media=media.replaceAll('appRouter','mediaRouter').replaceAll('withDatabase(', 'withTenant(req.auth!.tenantId, ');
media=media.replace("WHERE id=$1',[id]", "WHERE id=$1 AND tenant_id=$2',[id,req.auth!.tenantId]");
write('server/routes/media.ts',`import { Router } from 'express';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { withTenant } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
export const mediaRouter=Router();
mediaRouter.use(requireAuth);
`+media);
edit('server/index.ts',s=>"import { mediaRouter } from './routes/media.js';\n"+s.replace("app.use('/api', saasRouter);","app.use('/api', mediaRouter);\napp.use('/api', saasRouter);"));
copy('on-premise/server/db/migrations/002_quality_measurements.sql','server/db/migrations/002_quality_measurements.sql');
for(const path of ['server/services/inspectionValidation.ts','on-premise/server/services/inspectionValidation.ts'])edit(path,s=>"import { createHash } from 'node:crypto';\n"+s.replace("export function conflict",`export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export const inspectionSignature = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function conflict`).replace('JSON.stringify(content(before)) !== JSON.stringify(content(after))','canonical(content(before)) !== canonical(content(after))'));
for(const path of ['server/routes/saas.ts','on-premise/server/routes/app.ts'])edit(path,s=>{
  s=s.replace('validateInspection, planSchema', 'inspectionSignature, validateInspection, planSchema');
  s=s.replace("      await client.query('SELECT pg_advisory_xact_lock", "      const signature = inspectionSignature(req.body);\n      await client.query('SELECT pg_advisory_xact_lock");
  s=s.replace(/if\(existing.voided_at[^\n]+conflict\('Bu kayıt kimliği başka bir ölçüm için kullanılmış.'\);/g,"if(existing.voided_at || existing.payload.requestSignature !== signature) conflict('Bu kayıt kimliği başka bir ölçüm için kullanılmış.');");
  s=s.replace('payload = validateInspection(payload,plan,{id:userId,name:actor.name});','payload = { ...validateInspection(payload,plan,{id:userId,name:actor.name}), requestSignature: signature };');
  s=s.replace('payload=validateInspection(payload,planPayload,{id:req.auth!.userId,name:actor.name});','payload={...validateInspection(payload,planPayload,{id:req.auth!.userId,name:actor.name}), requestSignature:signature};');
  if(path==='server/routes/saas.ts')s=s.replace("      await assertQuota(client, tenantId, 'monthlyMeasurements', samples.length);", `      const attachments = (payload.samples as any[]).flatMap(sample => Object.values(sample.evidence || {}).flat()) as {id:string}[];
      const mediaIds=attachments.map(item=>item.id);
      if(new Set(mediaIds).size!==mediaIds.length) conflict('Bir kanıt birden fazla kontrol noktasına bağlanamaz.');
      if(mediaIds.length) {
        const owned=await client.query('SELECT id FROM media_evidence WHERE tenant_id=$1 AND uploaded_by=$2 AND inspection_id IS NULL AND id=ANY($3::uuid[]) FOR UPDATE',[tenantId,userId,mediaIds]);
        if(owned.rowCount!==mediaIds.length) conflict('Kanıt dosyası geçersiz veya başka kayda bağlı.');
      }
      await assertQuota(client, tenantId, 'monthlyMeasurements', samples.length);`)
      .replace("      await audit(client, { tenantId, userId, action: 'inspection.created'",`      for(const sample of payload.samples as any[]) for(const [characteristicId,items] of Object.entries(sample.evidence || {})) {
        await client.query('UPDATE media_evidence SET inspection_id=$1,sample_index=$2,characteristic_id=$3 WHERE tenant_id=$4 AND id=ANY($5::uuid[])',[id,sample.sampleIndex,characteristicId,tenantId,(items as {id:string}[]).map(item=>item.id)]);
      }
      await audit(client, { tenantId, userId, action: 'inspection.created'`);
  return s;
});
edit('server/services/access.ts',s=>s.replace('  const planId = await assertSubscription', "  await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenantId]);\n  const planId = await assertSubscription"));
// Ordered, transaction-safe migrations, compatible with both existing installation histories.
const runner=`import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';
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
`;
write('server/db/migrate.ts',runner);write('on-premise/server/db/migrate.ts',runner);
