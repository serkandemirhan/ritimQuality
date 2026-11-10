import {createHash,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {withTenant} from '../db/pool.js';

export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function tokenTenant(token:string): string|null {
  const match=token.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i);
  return match?.[1] ?? null;
}
export async function issueAccountToken(tenantId:string,userId:string,purpose:'reset'|'verify') {
  const token=`${tenantId}.${randomBytes(32).toString('base64url')}`;
  await withTenant(tenantId,async client=>{
    await client.query('DELETE FROM account_tokens WHERE user_id=$1 AND expires_at<now()',[userId]);
    await client.query(`INSERT INTO account_tokens(token_hash,tenant_id,user_id,purpose,expires_at,session_version)
      SELECT $1,$2,id,$4,now()+interval '30 minutes',session_version FROM users WHERE id=$3 AND tenant_id=$2 AND status='active'`,[tokenHash(token),tenantId,userId,purpose]);
  });
  return token;
}
export async function redeemAccountToken(token:string,purpose:'reset'|'verify',password?:string):Promise<boolean> {
  const tenantId=tokenTenant(token);if(!tenantId)return false;
  const hash=purpose==='reset'&&password?await bcrypt.hash(password,12):null;
  if(purpose==='reset'&&!hash)return false;
  return withTenant(tenantId,async client=>{
    const candidate=await client.query(`SELECT user_id,session_version FROM account_tokens WHERE token_hash=$1 AND purpose=$2`,[tokenHash(token),purpose]);
    if(!candidate.rowCount)return false;
    // Lock the user first, so concurrent links cannot both reset the same account.
    const user=await client.query('SELECT id,session_version FROM users WHERE id=$1 AND tenant_id=$2 AND status=$3 FOR UPDATE',[candidate.rows[0].user_id,tenantId,'active']);
    if(!user.rowCount)return false;
    if(user.rows[0].session_version!==candidate.rows[0].session_version)return false;
    const consumed=await client.query(`UPDATE account_tokens SET consumed_at=now() WHERE token_hash=$1 AND purpose=$2
      AND consumed_at IS NULL AND expires_at>now() RETURNING user_id`,[tokenHash(token),purpose]);
    if(!consumed.rowCount)return false;
    const userId=consumed.rows[0].user_id;
    if(purpose==='reset') await client.query('UPDATE users SET password_hash=$1,session_version=session_version+1,updated_at=now() WHERE id=$2',[hash,userId]);
    else await client.query('UPDATE users SET email_verified_at=now(),updated_at=now() WHERE id=$1',[userId]);
    await client.query('UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL',[userId,purpose]);
    return true;
  });
}
