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
  const history={controlPlanSnapshot:structuredClone(base),samples:[{sampleIndex:1,values:{point:10}}]};
  await admin.query("INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload) VALUES('history',$1,'part','base','HISTORY',now(),$2)",[tenant,history]);
  const baseUsage=await call('/control-plans/base/revision-usage',tokens[0]);assert.equal(baseUsage.status,200);assert.equal(baseUsage.body.used,true);
  const initialCatalog=await call('/control-plan-catalog-metadata',tokens[0]);assert.equal(initialCatalog.status,200);assert.equal(initialCatalog.body.length,1);assert.equal(initialCatalog.body[0].publishedAt,null);assert.ok(initialCatalog.body[0].updatedAt);
  const allCatalog=await call('/control-plan-catalog-metadata?all=true',tokens[0]);assert.equal(allCatalog.status,200);assert.equal(allCatalog.body.length,3);assert.equal(allCatalog.body[0].updatedBy,null);
  const overwrite=await call('/control-plans/base',tokens[0],'PUT',{...base,characteristics:[{...base.characteristics[0],name:'Changed'}]},{'X-Plan-Expected':baseUsage.body.token});assert.equal(overwrite.status,409);
  const usage=(await call('/control-plans/draft-a/revision-usage',tokens[0])).body;
  const concurrent=await Promise.all(tokens.map((token,i)=>call('/control-plans/draft-a',token,'PUT',{...usage.payload,revisionNote:'editor-'+i},{'X-Plan-Expected':usage.token})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  const ua=(await call('/control-plans/draft-a/revision-usage',tokens[0])).body,ub=(await call('/control-plans/draft-b/revision-usage',tokens[1])).body;
  const publish=await Promise.all([[ua,tokens[0]],[ub,tokens[1]]].map(([u,token])=>call('/control-plans/'+u.payload.id,token,'PUT',{...u.payload,status:'active',isActive:true},{'X-Plan-Expected':u.token,'X-Active-Plan-Expected':'base'})));
  assert.deepEqual(publish.map(r=>r.status).sort(),[200,409]);
  const catalog=await call('/control-plan-catalog-metadata',tokens[0]);assert.equal(catalog.status,200);assert.equal(catalog.body.length,1);assert.ok(catalog.body[0].publishedAt);assert.ok(catalog.body[0].publishedBy);assert.notEqual(catalog.body[0].id,'base');
  assert.ok([first,second].includes(catalog.body[0].updatedBy));
  const foreignUser=crypto.randomUUID();await admin.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role) VALUES($1,$2,'Other','other@example.invalid','unused','operator')",[foreignUser,other]);
  const foreignToken=auth.signToken({userId:foreignUser,tenantId:other,role:'operator'});const foreignCatalog=await call('/control-plan-catalog-metadata',foreignToken);assert.equal(foreignCatalog.status,200);assert.deepEqual(foreignCatalog.body,[]);
  const decision={sourcePlanId:'base',sourceCharacteristicId:'point',targetPlanId:'draft-a',targetCharacteristicId:'point',enabled:true,reason:'Aynı fiziksel ölçüm doğrulandı'};
  assert.equal((await call('/spc-characteristic-links/part',tokens[0],'POST',decision)).status,200);
  const associations=await call('/spc-characteristic-links/part',tokens[0]);assert.equal(associations.status,200);assert.equal(associations.body.length,1);assert.equal(associations.body[0].enabled,true);assert.equal(associations.body[0].approvedBy,first);
  assert.equal((await call('/spc-characteristic-links/part',foreignToken,'POST',decision)).status,403);assert.deepEqual((await call('/spc-characteristic-links/part',foreignToken)).body,[]);
  assert.equal((await call('/spc-characteristic-links/part',tokens[0],'POST',{...decision,targetCharacteristicId:'missing'})).status,409);
  assert.equal((await call('/spc-characteristic-links/part',tokens[0],'POST',{...decision,enabled:false,reason:'Eşleştirme geri alındı'})).status,200);assert.equal((await call('/spc-characteristic-links/part',tokens[0])).body[0].enabled,false);
  const rows=await admin.query('SELECT id FROM control_plans WHERE tenant_id=$1 AND is_active',[tenant]);assert.equal(rows.rowCount,1);assert.notEqual(rows.rows[0].id,'base');
  const fork={...base,id:'history-fork',version:'v2.0',status:'draft',isActive:false,characteristics:[{...base.characteristics[0],name:'Changed in new revision'}]};
  assert.equal((await call('/control-plans/history-fork',tokens[0],'PUT',fork,{'X-Plan-Expected':'missing'})).status,200);
  assert.equal((await call('/control-plans/duplicate-version',tokens[0],'PUT',{...fork,id:'duplicate-version'},{'X-Plan-Expected':'missing'})).status,409);
  assert.deepEqual((await admin.query("SELECT payload FROM inspection_logs WHERE tenant_id=$1 AND id='history'",[tenant])).rows[0].payload,history);
  assert.deepEqual((await admin.query("SELECT payload FROM control_plans WHERE tenant_id=$1 AND id='base'",[tenant])).rows[0].payload.characteristics,base.characteristics);
  await admin.query(`INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload)
   SELECT 'catalog-'||n,$1,'part','base','CAT-'||n,now(),jsonb_build_object('productCode','PRODUCT-'||lpad(n::text,3,'0'),'lotNumber','LOT-'||(n%4),'machineNo','CNC-'||(n%3)) FROM generate_series(1,260) n`,[tenant]);
  await admin.query(`INSERT INTO quality_cases(tenant_id,inspection_id,title,owner_id,severity,created_at)
   SELECT $1,'catalog-'||n,'Case '||lpad(n::text,3,'0'),CASE WHEN n%2=0 THEN $2 ELSE NULL END,CASE WHEN n%2=0 THEN 'critical' ELSE 'major' END,'2026-11-01T00:00:00Z'::timestamptz+n*interval '1 minute' FROM generate_series(1,260) n`,[tenant,first]);
  await admin.query(`INSERT INTO audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,after_data)
   SELECT $1,$2,'ncr.created','quality_workflow',id::text,'{}'::jsonb FROM quality_cases WHERE tenant_id=$1`,[tenant,second]);
  const listing=await call('/cases/catalog?pageSize=100',tokens[0]);assert.equal(listing.status,200);assert.equal(listing.body.total,260);assert.equal(listing.body.items.length,100);assert.equal(listing.body.items[0].title,'Case 260');assert.equal(listing.body.items[0].created_by,second);assert.equal(listing.body.items[0].created_by_name,second);assert.equal(listing.body.items[0].product_code,'PRODUCT-260');
  const page3=await call('/cases/catalog?pageSize=100&page=3',tokens[0]);assert.equal(page3.body.items.length,60);assert.equal(page3.body.items[0].title,'Case 060');
  const ascending=await call('/cases/catalog?sort=title&direction=asc',tokens[0]);assert.equal(ascending.body.items[0].title,'Case 001');
  for(const sort of ['title','product_code','lot_number','machine_no','severity','state','owner_name','created_at','created_by_name','due_at'])assert.equal((await call('/cases/catalog?sort='+sort,tokens[0])).status,200);
  assert.equal((await call('/cases/catalog?search=PRODUCT-259',tokens[0])).body.total,1);
  assert.equal((await call('/cases/catalog?severity=critical&owner='+first+'&creator='+second,tokens[0])).body.total,130);
  assert.equal((await call('/cases/catalog?owner=unassigned',tokens[0])).body.total,130);
  assert.equal((await call('/cases/catalog?from=2026-11-01T00:00:00Z&to=2026-11-01T00:11:00Z',tokens[0])).body.total,10);
  assert.equal((await call('/cases/catalog',foreignToken)).body.total,0);
  await admin.query("UPDATE users SET role='operator' WHERE tenant_id=$1 AND id=$2",[tenant,first]);
  const scopedOperator=auth.signToken({userId:first,tenantId:tenant,role:'operator'});assert.equal((await call('/cases/catalog',scopedOperator)).body.total,130);
  await admin.query("UPDATE users SET role='admin' WHERE tenant_id=$1 AND id=$2",[tenant,first]);
  assert.equal((await call('/cases/catalog?pageSize=999',tokens[0])).status,400);
  console.log('PASS: 260-case full catalog, 50/100 paging, all sort columns, metadata, combined filters and operator/tenant scope');
  const discardId=crypto.randomUUID();
  await admin.query('INSERT INTO inspection_drafts(id,tenant_id,created_by,claimed_by,product_id,control_plan_id,payload) VALUES($1,$2,$3,$3,$4,$5,$6)',[discardId,tenant,first,'part','base',{}]);
  const discard=async(token,id=discardId)=>fetch(origin+'/api/inspection-drafts/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
  assert.equal((await discard(tokens[1])).status,409,'Other holder discarded draft');
  assert.equal((await admin.query('SELECT id FROM inspection_drafts WHERE id=$1',[discardId])).rowCount,1);
  assert.equal((await discard(tokens[0])).status,204);
  assert.equal((await admin.query('SELECT id FROM inspection_drafts WHERE id=$1',[discardId])).rowCount,0);
  assert.equal((await discard(tokens[0])).status,204,'Discard retry is not idempotent');
  assert.equal((await admin.query("SELECT id FROM inspection_logs WHERE tenant_id=$1 AND id='history'",[tenant])).rowCount,1,'Discard touched completed log');
  console.log('PASS: draft discard ownership, persistence, retry and completed-history protection');
  const activePlan=(await admin.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND is_active',[tenant])).rows[0].payload;
  activePlan.requiresApproval=true;await admin.query('UPDATE control_plans SET payload=$3 WHERE tenant_id=$1 AND id=$2',[tenant,activePlan.id,activePlan]);
  const submit=async(token,suffix,value=10,role='admin')=>{const payload={id:'approval-'+suffix,sessionCode:'APPROVAL-'+suffix,productId:'part',controlPlanId:activePlan.id,controlPlanVersion:activePlan.version,operatorRoleAtMeasurement:role,timestamp:new Date().toISOString(),sampleCount:1,samples:[{sampleIndex:1,values:{point:value}}]};const result=await call('/inspection-logs',token,'POST',payload);assert.equal(result.status,201,JSON.stringify(result.body));return result.body;};
  const adminLog=await submit(tokens[0],'admin',12,'operator');assert.equal(adminLog.operatorRoleAtMeasurement,'admin');
  assert.equal((await admin.query('SELECT * FROM inspection_approvals WHERE tenant_id=$1 AND inspection_id=$2',[tenant,adminLog.id])).rowCount,0,'Admin needs approval');
  assert.equal((await admin.query('SELECT * FROM quality_cases WHERE tenant_id=$1 AND inspection_id=$2',[tenant,adminLog.id])).rowCount,1,'Admin failure lost case');
  await admin.query("UPDATE users SET role='operator' WHERE tenant_id=$1 AND id=$2",[tenant,second]);
  const operatorLog=await submit(tokens[1],'operator',10,'admin');assert.equal(operatorLog.operatorRoleAtMeasurement,'operator');
  assert.equal((await admin.query('SELECT status FROM inspection_approvals WHERE tenant_id=$1 AND inspection_id=$2',[tenant,operatorLog.id])).rows[0].status,'pending');
  assert.equal((await call('/approvals/admin-exemption',tokens[1],'POST',{})).status,403);
  await admin.query("UPDATE users SET role='quality_engineer' WHERE tenant_id=$1 AND id=$2",[tenant,second]);
  const qualityLog=await submit(tokens[1],'quality',10,'admin');assert.equal(qualityLog.operatorRoleAtMeasurement,'quality_engineer');
  assert.equal((await call('/approvals/'+qualityLog.id,tokens[1],'POST',{status:'approved',reason:'Self approval denied'})).status,409);
  await admin.query("UPDATE users SET role='admin' WHERE tenant_id=$1 AND id=$2",[tenant,second]);
  // A legacy measurement has no role snapshot; reconcile only pending admin measurements.
  await admin.query("INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload) VALUES('legacy-admin',$1,'part','base','LEGACY-ADMIN',now(),$2)",[tenant,{operatorUserId:first}]);
  await admin.query("INSERT INTO inspection_approvals(tenant_id,inspection_id) VALUES($1,'legacy-admin')",[tenant]);
  const exempt=await call('/approvals/admin-exemption',tokens[0],'POST',{});assert.equal(exempt.status,200);assert.equal(exempt.body.resolved,1);
  assert.equal((await admin.query("SELECT status FROM inspection_approvals WHERE tenant_id=$1 AND inspection_id='legacy-admin'",[tenant])).rows[0].status,'approved');
  for(const id of [operatorLog.id,qualityLog.id])assert.equal((await admin.query('SELECT status FROM inspection_approvals WHERE tenant_id=$1 AND inspection_id=$2',[tenant,id])).rows[0].status,'pending','Promotion bypassed historical role');
  assert.equal((await call('/approvals/admin-exemption',tokens[0],'POST',{})).body.resolved,0);
  assert.equal((await admin.query("SELECT count(*)::int n FROM audit_logs WHERE tenant_id=$1 AND entity_id='legacy-admin' AND action='inspection.approval_not_required'",[tenant])).rows[0].n,1);
  console.log('PASS: server-verified admin exemption, failed-result case retained, operator/quality approval protected, legacy reconciliation audited/idempotent');
  console.log('PASS: real PostgreSQL immutable used revision/history, separate new draft, duplicate version rejection, concurrent edit/publish 200/409 and one active plan');
 }finally{
  if(server)await new Promise(r=>server.close(r));if(pool)await pool.end();if(admin)await admin.end();
  if(started)try{execFileSync(path.join(bin,'pg_ctl.exe'),['-D',data,'-m','fast','-w','stop'],{windowsHide:true,stdio:'ignore',timeout:30000});}catch{}
  if(dir.startsWith(path.join(os.tmpdir(),'ritim-plan-test-')))fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
