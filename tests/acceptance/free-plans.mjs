import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyFreePlans(origin,db){
 const call=async(route,token,method='GET',body,status=200)=>{const r=await fetch(origin+'/api/'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(data));return data;};
 const register=async()=>call('auth/register',null,'POST',{companyName:'Acceptance',name:'Test Admin',workspace:'accept-'+randomUUID().slice(0,8),email:'test@example.invalid',password:randomUUID(),plan_id:'enterprise',pilot_unlimited:true},201);
 const a=await register(),token=a.token;assert.equal(a.tenant.plan_id,'free');assert.equal(a.tenant.subscription_status,'active');assert.equal(a.tenant.trial_ends_at,null);
 let boot=await call('bootstrap',token);assert.equal(boot.company.unlimited_pilot,false);assert.equal(boot.products.length+boot.controlPlans.length+boot.inspectionLogs.length,0);
 await db.query("UPDATE tenants SET trial_ends_at=now()-interval '30 days' WHERE id=$1",[a.tenant.id]);
 const plan=(id,productId,status='draft')=>({id,productId,version:id,isActive:status==='active',status,characteristics:[{id:'c',pointNo:1,name:'Gövde boyu',nominal:100,lsl:99.9,usl:100.1}]});
 for(const id of ['a','b','c','d','e'])await call('products/'+id,token,'PUT',{id,code:id,name:id});
 for(let i=0;i<7;i++)await call('control-plans/draft-'+i,token,'PUT',plan('draft-'+i,'a'));
 await call('control-plans/a1',token,'PUT',plan('a1','a','active'));
 await call('control-plans/b1',token,'PUT',plan('b1','b','active'));
 await call('control-plans/c1',token,'PUT',plan('c1','c'));
 const denied=await call('control-plans/c1',token,'PUT',plan('c1','c','active'),409);assert.equal(denied.code,'QUOTA_EXCEEDED');
 // New revision replaces A without needing a third slot.
 await call('control-plans/a2',token,'PUT',plan('a2','a','active'));
 boot=await call('bootstrap',token);assert.equal(boot.usage.control_plans,2);assert.equal(boot.controlPlans.find(p=>p.id==='a1').isActive,false);
 await call('control-plans/b1',token,'PUT',plan('b1','b','archived'));
 await call('control-plans/c1',token,'PUT',plan('c1','c','active'));
 await call('control-plans/b1',token,'PUT',plan('b1','b','active'),409);
 await call('control-plans/c1',token,'PUT',plan('c1','c','archived'));
 const results=await Promise.all(['d','e'].map(async id=>{const r=await fetch(origin+'/api/control-plans/'+id,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(plan(id,id,'active'))});return r.status;}));assert.deepEqual(results.sort(),[200,409]);
 assert.equal((await call('bootstrap',token)).usage.control_plans,2);
 // Product reassignment cannot be used to bypass the replacement calculation.
 await call('control-plans/a2',token,'PUT',plan('a2','b','active'),409);
 const empty={...plan('empty','c'),characteristics:[]};await call('control-plans/empty',token,'PUT',empty);await call('control-plans/empty',token,'PUT',{...empty,isActive:true,status:'active'},400);
 await call('control-plans/bad',token,'PUT',{...plan('bad','c'),characteristics:[{id:'x',pointNo:1,name:'Bad',nominal:1,lsl:2,usl:1}]},400);
 const log={id:randomUUID(),sessionCode:'ACCEPT-'+randomUUID(),timestamp:new Date().toISOString(),productId:'a',controlPlanId:'a2',controlPlanVersion:'a2',sampleCount:1,samples:[{sampleIndex:1,values:{c:100.02},statuses:{c:'pass'}}]};
 const rejected=await call('inspection-logs',token,'POST',{...log,samples:[{sampleIndex:1,values:{}}]},409);assert.equal(rejected.code,'INSPECTION_REJECTED_UNSAVED');
 const bad={...log,id:randomUUID(),sessionCode:randomUUID(),samples:[{sampleIndex:1,values:{c:101},statuses:{c:'pass'}}]};
 const [saved,retry]=await Promise.all([call('inspection-logs',token,'POST',bad,201),call('inspection-logs',token,'POST',bad,201)]);assert.equal(saved.controlNumber,retry.controlNumber);assert.equal(saved.samples[0].statuses.c,'fail');assert.equal((await call('bootstrap',token)).inspectionLogs.filter(l=>l.id===bad.id).length,1);
 const identityConflict=await call('inspection-logs',token,'POST',{...bad,sessionCode:randomUUID()},409);assert.notEqual(identityConflict.code,'INSPECTION_REJECTED_UNSAVED');
 const operatorId=randomUUID(),operatorPassword=randomUUID();await call('users',token,'POST',{id:operatorId,name:'Operator',email:'operator@example.invalid',password:operatorPassword,role:'operator',status:'active'},201);
 const operator=await call('auth/login',null,'POST',{workspace:a.tenant.slug,email:'operator@example.invalid',password:operatorPassword});await call('control-plans/forbidden',operator.token,'PUT',plan('forbidden','c'),403);
 const b=await register();await call('products/other',b.token,'PUT',{id:'other',code:'other',name:'Other'});await call('control-plans/other',b.token,'PUT',plan('other','other','active'));assert.equal((await call('bootstrap',token)).usage.control_plans,2);
 // Existing paid account keeps its existing total-revision quota.
 await db.query("UPDATE tenants SET plan_id='starter',subscription_status='active' WHERE id=$1",[b.tenant.id]);
 for(let i=0;i<4;i++)await call('control-plans/paid-'+i,b.token,'PUT',plan('paid-'+i,'other'));
 await call('control-plans/paid-full',b.token,'PUT',plan('paid-full','other'),409);
 console.log('PASS: real free registration, expiry independence, drafts, 2 active slots, API bypass, archive/reactivate, revision replacement, concurrent publication, tenant isolation, paid quota.');
}
