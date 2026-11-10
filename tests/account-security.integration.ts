// Run explicitly with node --env-file=.env.cloud --import tsx tests/account-security.integration.ts.
// All fixture changes and rate-limit counters are rolled back; no email is sent.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../server/db/pool.js';
import {issueAccountToken,redeemAccountToken,tokenHash} from '../server/services/accountTokens.js';
import {consumeLimit} from '../server/services/requestLimit.js';
import {requireAuth,signToken} from '../server/middleware/auth.js';
const client=await pool.connect();
const originalConnect=pool.connect.bind(pool),originalQuery=pool.query.bind(pool);
try {
  await client.query('BEGIN');
  // Keep each service's transaction inside the outer rollback-only fixture.
  const adapter={release(){},async query(sql:string,params?:unknown[]){
    if(sql==='BEGIN')return client.query('SAVEPOINT service_call');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT service_call');
    if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT service_call');
    return client.query(sql,params);
  }};
  pool.connect=(async()=>adapter) as typeof pool.connect;
  pool.query=client.query.bind(client) as typeof pool.query;
  const tenantId=randomUUID(),userId=randomUUID();
  await client.query('INSERT INTO tenants(id,slug,name,legal_name,contact_email) VALUES($1,$2,$3,$3,$4)',[tenantId,`test-${tenantId}`,'Rollback security fixture','nobody@example.invalid']);
  await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  await client.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role) VALUES($1,$2,'Fixture','nobody@example.invalid','unusable','admin')",[userId,tenantId]);
  const oldSession=signToken({tenantId,userId,role:'admin'});
  const verify=await issueAccountToken(tenantId,userId,'verify');
  assert.equal(await redeemAccountToken(verify,'reset','replacement-password'),false,'purpose separation');
  assert.equal(await redeemAccountToken(verify,'verify'),true);
  assert.equal(await redeemAccountToken(verify,'verify'),false,'single use');
  const expired=await issueAccountToken(tenantId,userId,'reset');
  await client.query("UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(expired)]);
  assert.equal(await redeemAccountToken(expired,'reset','replacement-password'),false,'expiry');
  const reset=await issueAccountToken(tenantId,userId,'reset');
  const sibling=await issueAccountToken(tenantId,userId,'reset');
  assert.equal(await redeemAccountToken(reset,'reset','replacement-password'),true);
  assert.equal(await redeemAccountToken(sibling,'reset','another-password'),false,'other links revoked');
  let status=200,nextCalled=false;
  const response={status(code:number){status=code;return this;},json(){return this;}};
  await requireAuth({headers:{authorization:`Bearer ${oldSession}`}} as never,response as never,()=>{nextCalled=true;});
  assert.equal(status,401);assert.equal(nextCalled,false,'old session revoked');
  const user=(await client.query('SELECT session_version,email_verified_at FROM users WHERE id=$1',[userId])).rows[0];
  assert.equal(user.session_version,1);assert.ok(user.email_verified_at);
  const beforeEmailChange=await issueAccountToken(tenantId,userId,'verify');
  await client.query("UPDATE users SET email='changed@example.invalid' WHERE id=$1",[userId]);
  assert.equal(await redeemAccountToken(beforeEmailChange,'verify'),false,'old address link revoked');
  assert.equal((await client.query('SELECT email_verified_at FROM users WHERE id=$1',[userId])).rows[0].email_verified_at,null);
  const key=randomUUID();
  assert.equal(await consumeLimit('test',key,2,900),true);
  assert.equal(await consumeLimit('test',key,2,900),true);
  assert.equal(await consumeLimit('test',key,2,900),false,'persistent rate limit');
  await client.query("SELECT set_config('app.tenant_id',$1,true)",[randomUUID()]);
  assert.equal((await client.query('SELECT * FROM account_tokens WHERE user_id=$1',[userId])).rowCount,0,'tenant isolation');
  console.log('PASS: single use, purpose, expiry, sibling revocation, session revocation, email change, rate limit, token tenant isolation. Fixtures rolled back.');
}finally{
  pool.connect=originalConnect as typeof pool.connect;pool.query=originalQuery as typeof pool.query;
  await client.query('ROLLBACK');client.release();await pool.end();
}
