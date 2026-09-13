import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// These tests never connect to a real project or send a push notification.
process.env.DATABASE_URL='postgresql://unused@127.0.0.1:1/unused';
process.env.DATABASE_SSL='false';
process.env.CRON_SECRET='test-cron-secret-with-more-than-32-characters';
delete process.env.VERCEL;
const { app }=await import('../dist-server/app.js');
const { validCronToken }=await import('../dist-server/routes/cron.js');
const { assertUploadedObject, usesSupabaseStorage, mediaObjectPath, MAX_MEDIA_BYTES }=await import('../dist-server/services/mediaStorage.js');
const { pool }=await import('../dist-server/db/pool.js');
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
after(async()=>{await new Promise(resolve=>server.close(resolve));await pool.end();});

test('serverless app health has no dependency on a listening database',async()=>{
  const response=await fetch(base+'/api/health');assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ok'});
  assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('x-powered-by'),null);
});
test('scheduled worker requires its independent secret before any database work',async()=>{
  for(const headers of [{},{Authorization:'Bearer wrong'}]){const response=await fetch(base+'/api/cron/notifications',{headers});assert.equal(response.status,401);}
  assert.equal(validCronToken('Bearer '+process.env.CRON_SECRET,process.env.CRON_SECRET),true);
  assert.equal(validCronToken(undefined,process.env.CRON_SECRET),false);
  assert.equal(validCronToken('Bearer x','x'),false);
  assert.equal(validCronToken('Bearer abc',undefined),false);
});
test('Storage finalization rejects size and MIME spoofing',()=>{
  assert.doesNotThrow(()=>assertUploadedObject({size:5000000,contentType:'video/mp4'},{size_bytes:5000000,mime_type:'video/mp4'}));
  for(const info of [{size:0,contentType:'video/mp4'},{size:5000001,contentType:'video/mp4'},{size:5000000,contentType:'text/html'},{size:MAX_MEDIA_BYTES+1,contentType:'video/mp4'},{}])assert.throws(()=>assertUploadedObject(info,{size_bytes:5000000,mime_type:'video/mp4'}));
  assert.equal(mediaObjectPath('tenant-a','asset-1'),'tenant-a/asset-1');
});
test('Vercel cannot silently fall back to its temporary filesystem',()=>{
  process.env.VERCEL='1';process.env.MEDIA_STORAGE='local';assert.throws(()=>usesSupabaseStorage());
  process.env.MEDIA_STORAGE='supabase';assert.equal(usesSupabaseStorage(),true);
  delete process.env.VERCEL;process.env.MEDIA_STORAGE='local';assert.equal(usesSupabaseStorage(),false);
});
test('webhook rejects unsigned bodies without depending on JSON parsing',async()=>{
  const response=await fetch(base+'/api/billing/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'not-json'});
  assert.equal(response.status,400);assert.match((await response.json()).error,/signature/);
});
test('deployment config separates API from the SPA and fits the default cron tier',async()=>{
  const config=JSON.parse(await readFile('vercel.json','utf8'));
  assert.equal(config.framework,'vite');assert.equal(config.outputDirectory,'dist');
  assert.equal(config.rewrites[0].source,'/api/:path*');assert.equal(config.rewrites[0].destination,'/api');
  assert.equal(config.crons[0].path,'/api/cron/notifications');assert.equal(config.crons[0].schedule,'0 6 * * *');
  const entry=await readFile('api/index.ts','utf8');assert.match(entry,/export default app/);assert.doesNotMatch(entry,/\.listen\(/);
});
