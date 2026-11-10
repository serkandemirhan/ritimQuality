import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {isUnlimitedPilotWorkspace} from '../server/services/pilotAccess';
import {assertQuota,assertSubscription} from '../server/services/access';
const original=process.env.UNLIMITED_PILOT_WORKSPACES;
afterEach(()=>{if(original===undefined)delete process.env.UNLIMITED_PILOT_WORKSPACES;else process.env.UNLIMITED_PILOT_WORKSPACES=original;});
const tenant={slug:'factory-a',plan_id:'starter',subscription_status:'trial',trial_ends_at:'2000-01-01T00:00:00Z',billing_source:'manual',manual_license_ends_at:null};
function client(row:unknown=tenant,count=0){
 const queries:string[]=[];
 const db={query:async(sql:string,params:unknown[])=>{
  queries.push(sql);assert.deepEqual(params,['tenant-id']);
  return sql.includes('subscription_status')?{rows:row?[row]:[]}:{rows:[{id:'tenant-id',count}]};
 }} as unknown as pg.PoolClient;
 return {queries,db};
}
test('pilot access uses exact server-configured workspace slugs; wildcards and prefixes do not grant access',()=>{
 assert.equal(isUnlimitedPilotWorkspace('factory-a','factory-a, factory-b'),true);
 for(const slug of ['factory-ab','factory','Factory-a','*',null])assert.equal(isUnlimitedPilotWorkspace(slug,'factory-a,*'),false);
 assert.equal(isUnlimitedPilotWorkspace('factory-a',''),false);
});
test('only allowlisted pilot skips expiry and all three quotas, including counts above enterprise caps',async()=>{
 process.env.UNLIMITED_PILOT_WORKSPACES='factory-a,factory-b';const c=client(tenant,2_000_000);
 assert.equal(await assertSubscription(c.db,'tenant-id'),'starter');
 for(const resource of ['users','controlPlans','monthlyMeasurements'] as const)await assertQuota(c.db,'tenant-id',resource,2_000_000);
 assert.equal(c.queries.some(sql=>sql.includes('count(*)')||sql.includes('sum(')),false);
});
test('a different tenant with identical subscription fields remains expired',async()=>{
 process.env.UNLIMITED_PILOT_WORKSPACES='factory-b';const c=client();await assert.rejects(()=>assertSubscription(c.db,'tenant-id'),(error:any)=>error.status===402);
});
test('missing tenant never acquires entitlement through configured workspace',async()=>{
 process.env.UNLIMITED_PILOT_WORKSPACES='factory-a';await assert.rejects(()=>assertSubscription(client(null).db,'tenant-id'));
});
test('ordinary active account retains quota enforcement',async()=>{
 process.env.UNLIMITED_PILOT_WORKSPACES='factory-b';const c=client({...tenant,billing_source:'stripe',subscription_status:'active'},3);
 await assert.rejects(()=>assertQuota(c.db,'tenant-id','users'),(error:any)=>error.code==='QUOTA_EXCEEDED');
});
test('removing the allowlist restores normal subscription checks',async()=>{
 process.env.UNLIMITED_PILOT_WORKSPACES='factory-a';await assertSubscription(client().db,'tenant-id');delete process.env.UNLIMITED_PILOT_WORKSPACES;
 await assert.rejects(()=>assertSubscription(client().db,'tenant-id'),(error:any)=>error.status===402);
});
