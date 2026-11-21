import {z} from 'zod';
import type {PoolClient} from 'pg';

export const loginSchema=z.object({
  workspace:z.string().trim().min(3).max(49),
  // Keep the existing API field; only sign-in accepts a username as well as email.
  email:z.string().trim().min(1).max(254).transform(value=>value.toLowerCase()),
  password:z.string().min(1),
});
const columns='id, tenant_id, name, email, password_hash, role, department, status, session_version';
export async function findLoginUser(client:Pick<PoolClient,'query'>,tenantId:string,identifier:string){
  const exact=await client.query(`SELECT ${columns} FROM users WHERE tenant_id=$1 AND email=$2`,[tenantId,identifier]);
  if(exact.rows[0]||identifier.includes('@'))return exact.rows[0];
  // The schema stores account identities in email. Its local part may be used
  // only when it resolves to a single account within the chosen workspace.
  const aliases=await client.query(`SELECT ${columns} FROM users WHERE tenant_id=$1 AND split_part(lower(email),'@',1)=$2 LIMIT 2`,[tenantId,identifier]);
  return aliases.rows.length===1?aliases.rows[0]:undefined;
}
