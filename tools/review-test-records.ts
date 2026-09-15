import 'dotenv/config';
import {pool,withTenant} from '../server/db/pool.js';
// Read-only inventory. Names alone never authorize deleting quality history.
try {
  const workspace=process.env.REVIEW_WORKSPACE;
  if(!workspace)throw new Error('Set REVIEW_WORKSPACE to the exact workspace slug.');
  const tenant=(await pool.query('SELECT id FROM tenants WHERE slug=$1',[workspace])).rows[0];
  if(!tenant)throw new Error('Workspace not found.');
  const records=await withTenant(tenant.id,async client=>({
    products:(await client.query("SELECT p.id,p.code,p.name,(SELECT count(*)::int FROM inspection_logs l WHERE l.tenant_id=p.tenant_id AND l.product_id=p.id) inspection_count FROM products p WHERE tenant_id=$1 AND (lower(trim(name))=ANY($2) OR lower(trim(code))=ANY($2))",[tenant.id,['tt','tty']])).rows,
    tasks:(await client.query("SELECT id,title,completed_at FROM quality_tasks WHERE tenant_id=$1 AND lower(trim(title))=ANY($2)",[tenant.id,['tt','tty']])).rows,
  }));
  console.log(JSON.stringify({workspace,readOnly:true,...records},null,2));
}finally{await pool.end();}
