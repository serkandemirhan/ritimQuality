// Disposable loopback PostgreSQL only; no production credentials or database.
const fs=require('fs'),os=require('os'),path=require('path'),net=require('net'),crypto=require('crypto'),assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('child_process'),{Pool}=require('pg');
const root=path.resolve(__dirname,'..'),bin=process.env.RITIM_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const port=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ritim-plan-test-')),data=path.join(dir,'data'),pw=crypto.randomBytes(24).toString('hex'),pgPort=await port(),pwfile=path.join(dir,'pw');let admin,pool,server,started=false;
 try{
  const sid=execFileSync('powershell.exe',['-NoProfile','-Command','[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8',windowsHide:true}).trim();assert.match(sid,/^S-1-/);execFileSync('icacls.exe',[dir,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F'],{windowsHide:true,stdio:'pipe'});
  fs.writeFileSync(pwfile,pw+'\n');try{execFileSync(path.join(bin,'initdb.exe'),['-D',data,'--username=plan_test_admin','--pwfile='+pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C'],{windowsHide:true,stdio:'pipe',timeout:90000});}finally{fs.unlinkSync(pwfile);}
  execFileSync(path.join(bin,'pg_ctl.exe'),['-D',data,'-l',path.join(dir,'pg.log'),'-o',`-h 127.0.0.1 -p ${pgPort}`,'-w','start'],{windowsHide:true,stdio:'ignore',timeout:90000});started=true;
  const url=new URL(`postgresql://plan_test_admin@127.0.0.1:${pgPort}/postgres`);url.password=pw;
  const migration=spawnSync(process.execPath,['--import','tsx','server/db/migrate.ts'],{cwd:root,env:{...process.env,MIGRATION_DATABASE_URL:url.toString(),DATABASE_URL:url.toString(),DATABASE_SSL:'false'},encoding:'utf8',windowsHide:true,timeout:90000});if(migration.status!==0)throw Error('Local migration failed: '+String(migration.stderr).split(pw).join('[REDACTED]'));
  admin=new Pool({connectionString:url.toString()});await admin.query(`CREATE ROLE qualitrack_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${pw}'`);await admin.query(fs.readFileSync(path.join(root,'supabase/runtime-role.sql'),'utf8'));
  const tenant=crypto.randomUUID(),other=crypto.randomUUID(),first=crypto.randomUUID(),second=crypto.randomUUID();
  for(const [id,slug] of [[tenant,'plan-test'],[other,'other-test']])await admin.query("INSERT INTO tenants(id,slug,name,legal_name,contact_email,subscription_status,plan_id) VALUES($1,$2,$2,$2,'test@example.invalid','active','enterprise')",[id,slug]);
  for(const [id,tid] of [[first,tenant],[second,tenant]])await admin.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role) VALUES($1,$2,$1,$3,'unused','admin')",[id,tid,id+'@example.invalid']);
  const product={id:'part',code:'P',name:'Part'},base={id:'base',productId:'part',version:'v1.0',status:'active',isActive:true,characteristics:[{id:'point',pointNo:1,name:'Point',nominal:10,lsl:9,usl:11}]};
  await admin.query('INSERT INTO products(id,tenant_id,code,name,payload) VALUES($1,$2,$3,$4,$5)',[product.id,tenant,product.code,product.name,product]);
  const plans=[base,{...base,id:'draft-a',version:'v1.1',status:'draft',isActive:false},{...base,id:'draft-b',version:'v1.2',status:'draft',isActive:false}];
  for(const plan of plans)await admin.query('INSERT INTO control_plans(id,tenant_id,product_id,version,status,is_active,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[plan.id,tenant,plan.productId,plan.version,plan.status,plan.isActive,plan]);
  const runtime=new URL(url);runtime.username='qualitrack_app';process.env.DATABASE_URL=runtime.toString();process.env.DATABASE_SSL='false';process.env.JWT_SECRET='isolated-plan-test-secret-not-for-production-12345';process.env.MEDIA_STORAGE='local';
  const {app}=await import('../dist-server/app.js');const db=await import('../dist-server/db/pool.js');pool=db.pool;const auth=await import('../dist-server/middleware/auth.js');
  const tokens=[first,second].map(userId=>auth.signToken({userId,tenantId:tenant,role:'admin'}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
  async function call(route,token,method='GET',body,headers={}){const r=await fetch(origin+'/api'+route,{method,headers:{Authorization:'Bearer '+token,...body?{'Content-Type':'application/json'}:{},...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
  const usage=(await call('/control-plans/draft-a/revision-usage',tokens[0])).body;
  const concurrent=await Promise.all(tokens.map((token,i)=>call('/control-plans/draft-a',token,'PUT',{...usage.payload,revisionNote:'editor-'+i},{'X-Plan-Expected':usage.token})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  const ua=(await call('/control-plans/draft-a/revision-usage',tokens[0])).body,ub=(await call('/control-plans/draft-b/revision-usage',tokens[1])).body;
  const publish=await Promise.all([[ua,tokens[0]],[ub,tokens[1]]].map(([u,token])=>call('/control-plans/'+u.payload.id,token,'PUT',{...u.payload,status:'active',isActive:true},{'X-Plan-Expected':u.token,'X-Active-Plan-Expected':'base'})));
  assert.deepEqual(publish.map(r=>r.status).sort(),[200,409]);
  const rows=await admin.query('SELECT id FROM control_plans WHERE tenant_id=$1 AND is_active',[tenant]);assert.equal(rows.rowCount,1);assert.notEqual(rows.rows[0].id,'base');
  console.log('PASS: real PostgreSQL concurrent edit 200/409; concurrent publish 200/409; one active plan');
 }finally{
  if(server)await new Promise(r=>server.close(r));if(pool)await pool.end();if(admin)await admin.end();
  if(started)try{execFileSync(path.join(bin,'pg_ctl.exe'),['-D',data,'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore',timeout:30000});}catch{}
  if(dir.startsWith(path.join(os.tmpdir(),'ritim-plan-test-')))fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
