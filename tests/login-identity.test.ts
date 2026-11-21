import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {findLoginUser,loginSchema} from '../server/services/loginIdentity.ts';

test('sign-in accepts usernames/email, normalizes identity and preserves password',()=>{
 for(const identity of ['operator123','operator123@example.com']){
  const result=loginSchema.parse({workspace:' flowp ',email:' '+identity.toUpperCase()+' ',password:' pass word '});
  assert.equal(result.email,identity);assert.equal(result.workspace,'flowp');assert.equal(result.password,' pass word ');
 }
 for(const email of ['', ' ', 'x'.repeat(255)])assert.equal(loginSchema.safeParse({workspace:'flowp',email,password:'p'}).success,false);
});
function client(responses:unknown[][]){
 const calls:{sql:string;params:unknown[]}[]=[];
 return {calls,db:{query:async(sql:string,params:unknown[])=>{calls.push({sql,params});return {rows:responses.shift()||[]};}} as unknown as Pick<PoolClient,'query'>};
}
test('exact stored identity retains precedence and email never falls back to aliases',async()=>{
 const account={email:'operator123'};const exact=client([[account]]);
 assert.equal(await findLoginUser(exact.db,'tenant-a','operator123'),account);assert.equal(exact.calls.length,1);
 const missing=client([[]]);assert.equal(await findLoginUser(missing.db,'tenant-a','operator123@example.com'),undefined);assert.equal(missing.calls.length,1);
});
test('username resolves only one workspace-scoped account and rejects ambiguity',async()=>{
 const account={email:'operator123@example.com'},unique=client([[],[account]]);
 assert.equal(await findLoginUser(unique.db,'tenant-a','operator123'),account);
 for(const call of unique.calls){assert.deepEqual(call.params,['tenant-a','operator123']);assert.match(call.sql,/tenant_id=\$1/);}
 assert.match(unique.calls[1].sql,/LIMIT 2/);
 for(const aliases of [[],[account,{email:'operator123@other.example'}]]){
  const ambiguous=client([[],aliases]);assert.equal(await findLoginUser(ambiguous.db,'tenant-a','operator123'),undefined);
 }
});
