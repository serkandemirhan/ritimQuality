// Uses the restricted runtime connection. All fixture data is rolled back.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pool} from '../server/db/pool.js';
const c=await pool.connect(),checks:string[]=[];
try{
 await c.query('BEGIN');
 const role=(await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);checks.push('Çalışma zamanı rolü superuser değil; RLS atlama yetkisi yok.');
 const a=randomUUID(),b=randomUUID();
 for(const tenant of [a,b]){
  await c.query("INSERT INTO tenants(id,slug,name,legal_name,contact_email) VALUES($1,$2,'Rollback isolation','Rollback isolation','nobody@example.invalid')",[tenant,'isolation-'+tenant]);
  await c.query("SELECT set_config('app.tenant_id',$1,true)",[tenant]);
  await c.query("INSERT INTO products(id,tenant_id,code,name,payload) VALUES('part',$1,'PART','Isolation part','{}')",[tenant]);
  await c.query("INSERT INTO control_plans(id,tenant_id,product_id,version,status,is_active,payload) VALUES('plan',$1,'part','v1','active',true,'{}')",[tenant]);
  await c.query("INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload) VALUES('log',$1,'part','plan','TEST',now(),'{}')",[tenant]);
 }
 await c.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
 for(const table of ['products','control_plans','inspection_logs']){
  assert.equal((await c.query(`SELECT id FROM ${table} WHERE tenant_id=$1`,[b])).rowCount,0);
  assert.equal((await c.query(`SELECT id FROM ${table} WHERE tenant_id=$1`,[a])).rowCount,1);
  checks.push(`${table}: diğer firmanın kayıtları okunamıyor, kendi kaydı erişilebilir.`);
 }
 assert.equal((await c.query("UPDATE products SET name='forbidden' WHERE tenant_id=$1",[b])).rowCount,0);checks.push('Diğer firmanın parçası güncellenemiyor.');
 await c.query('SAVEPOINT cross_insert');
 await assert.rejects(c.query("INSERT INTO products(id,tenant_id,code,name,payload) VALUES('forbidden',$1,'X','X','{}')",[b]),(e:any)=>e.code==='42501');
 await c.query('ROLLBACK TO SAVEPOINT cross_insert');checks.push('Diğer firma adına kayıt ekleme RLS tarafından reddediliyor.');
 const tables=(await c.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1)",[['users','products','control_plans','inspection_logs','quality_tasks','quality_notifications','media_evidence','inspection_drafts']])).rows;
 assert.equal(tables.length,8);for(const t of tables){assert.equal(t.relrowsecurity,true,t.relname);assert.equal(t.relforcerowsecurity,true,t.relname);}checks.push('Sekiz temel tabloda RLS ve FORCE RLS etkin.');
 mkdirSync('reports/completion-audit',{recursive:true});writeFileSync('reports/completion-audit/isolation.json',JSON.stringify({at:new Date().toISOString(),checks,rolledBack:true},null,2));console.log('PASS: '+checks.length+' runtime tenant isolation checks; fixtures rolled back.');
}finally{await c.query('ROLLBACK');c.release();await pool.end();}
