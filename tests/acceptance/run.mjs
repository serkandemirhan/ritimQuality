// Creates and drops only a uniquely named database on a loopback PostgreSQL server.
import pg from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
const url=new URL(process.env.TEST_DATABASE_URL||'');
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('TEST_DATABASE_URL must use disposable loopback PostgreSQL.');
const name='ritim_acceptance_'+randomUUID().replaceAll('-','');
const admin=new pg.Pool({connectionString:url.toString(),ssl:false});
const dbUrl=new URL(url);dbUrl.pathname='/'+name;
const media=await mkdtemp(join(tmpdir(),'ritim-acceptance-media-'));
let runtime,server,vite,testDb,created=false;
const child=(args,env={})=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{env:{...process.env,...env},stdio:'inherit'});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error('Acceptance child exited '+code)));});
try{
 await admin.query(`CREATE DATABASE "${name}"`);created=true;
 Object.assign(process.env,{DATABASE_URL:dbUrl.toString(),DATABASE_SSL:'false',MIGRATION_DATABASE_URL:dbUrl.toString(),JWT_SECRET:randomBytes(40).toString('hex'),MEDIA_STORAGE:'local',MEDIA_ROOT:media,UNLIMITED_PILOT_WORKSPACES:'',PLATFORM_ADMIN_USER_IDS:'',STRIPE_SECRET_KEY:'',RESEND_API_KEY:'',ACCOUNT_EMAIL_PROVIDER:''});
 await child(['--import','tsx','server/db/migrate.ts']);
 testDb=new pg.Pool({connectionString:dbUrl.toString()});
 // Exercise the same non-owner, NOBYPASSRLS role used in production.
 await testDb.query(await readFile('supabase/runtime-role.sql','utf8'));
 const password=randomBytes(24).toString('hex');
 await testDb.query(`ALTER ROLE qualitrack_app PASSWORD '${password}'`);
 const runtimeUrl=new URL(dbUrl);runtimeUrl.username='qualitrack_app';runtimeUrl.password=password;process.env.DATABASE_URL=runtimeUrl.toString();
 const {app}=await import('../../dist-server/app.js');runtime=(await import('../../dist-server/db/pool.js')).pool;
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const apiOrigin='http://127.0.0.1:'+server.address().port;
 // Bulk read must cover the whole inbox without touching another user or tenant.
 const registration=await fetch(apiOrigin+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyName:'Bildirim Test',workspace:'notify-'+randomUUID().slice(0,8),name:'Test Operator',email:randomUUID()+'@example.invalid',password:'Test-password-123!'})});
 if(registration.status!==201)throw Error('Notification fixture registration failed');
 const account=await registration.json(),otherUser=randomUUID(),otherTenant=randomUUID(),otherTenantUser=randomUUID();
 await testDb.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role) SELECT $1,tenant_id,'Other','other@example.invalid',password_hash,'operator' FROM users WHERE id=$2",[otherUser,account.user.id]);
 await testDb.query("INSERT INTO tenants(id,slug,name,legal_name,contact_email) VALUES($1,$2,'Other','Other','other@example.invalid')",[otherTenant,'other-'+randomUUID().slice(0,8)]);
 await testDb.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role) SELECT $1,$2,'Other tenant','other-tenant@example.invalid',password_hash,'operator' FROM users WHERE id=$3",[otherTenantUser,otherTenant,account.user.id]);
 await testDb.query("INSERT INTO quality_notifications(tenant_id,user_id,title,kind,entity_id) SELECT $1,$2,'Test','task',n::text FROM generate_series(1,105) n",[account.tenant.id,account.user.id]);
 await testDb.query("INSERT INTO quality_notifications(tenant_id,user_id,title,kind,entity_id) VALUES($1,$2,'Other','task','other'),($3,$4,'Other tenant','task','other')",[account.tenant.id,otherUser,otherTenant,otherTenantUser]);
 const inbox=await fetch(apiOrigin+'/api/work',{headers:{Authorization:'Bearer '+account.token}});const inboxBody=await inbox.json();if(!inbox.ok||inboxBody.notificationUnreadCount!==105||inboxBody.notifications.length!==100)throw Error('Notification unread count or pagination is incorrect');
 const marked=await fetch(apiOrigin+'/api/notifications/read-all',{method:'PATCH',headers:{Authorization:'Bearer '+account.token}});
 const markedBody=await marked.json();if(!marked.ok||markedBody.updated!==105)throw Error(`Bulk notification read failed: HTTP ${marked.status}, ${JSON.stringify(markedBody)}`);
 const counts=await testDb.query('SELECT user_id,count(*)::int AS unread FROM quality_notifications WHERE user_id=ANY($1::text[]) AND read_at IS NULL GROUP BY user_id',[[account.user.id,otherUser,otherTenantUser]]);
 if(counts.rows.some(row=>row.user_id===account.user.id)||counts.rows.find(row=>row.user_id===otherUser)?.unread!==1||counts.rows.find(row=>row.user_id===otherTenantUser)?.unread!==1)throw Error('Bulk notification read crossed user or tenant boundaries');
 console.log('PASS: bulk notification read covers all items and preserves user and tenant isolation.');
 const {verifyFreePlans}=await import('./free-plans.mjs');await verifyFreePlans(apiOrigin,testDb);
 process.env.API_PROXY_TARGET=apiOrigin;process.env.DISABLE_HMR='true';
 vite=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'warn'});await vite.listen();
 const origin='http://127.0.0.1:'+vite.httpServer.address().port;
 process.env.NEXT_PUBLIC_APPLICATION_URL=origin;
 const {ApplicationEntry}=await import('../../website/components/ApplicationEntry.tsx');
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 app.get('/signup',(_req,res)=>res.type('html').send('<!doctype html><html lang="tr"><body>'+renderToStaticMarkup(createElement(ApplicationEntry,{signup:true}))+'</body></html>'));
 await mkdir('.runtime/acceptance',{recursive:true});
 await child(['node_modules/@playwright/test/cli.js','test','--config=tests/acceptance/playwright.config.ts',...(process.env.ACCEPTANCE_GREP?['--grep',process.env.ACCEPTANCE_GREP]:[])],{ACCEPTANCE_ORIGIN:origin,ACCEPTANCE_ENTRY:apiOrigin+'/signup',ACCEPTANCE_ISOLATED:'1',ACCEPTANCE_OUTPUT:'.runtime/acceptance/'+name});
}finally{
 if(vite)await vite.close();if(server)await new Promise(r=>server.close(r));if(runtime)await runtime.end();if(testDb)await testDb.end();
 if(created)await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();await rm(media,{recursive:true,force:true});
}
