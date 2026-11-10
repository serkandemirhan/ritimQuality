import {readFileSync,writeFileSync} from 'node:fs';
import {pool,withTenant} from '../../server/db/pool.js';
const {tenantId}=JSON.parse(readFileSync('.runtime/lifecycle/session.json','utf8'));
const evidence=await withTenant(tenantId,async c=>({
 verifiedAt:new Date().toISOString(),scope:'Isolated test tenant; real API, Supabase PostgreSQL; local frontend; no API response mocks',
 plans:(await c.query('SELECT id,version,status,is_active,jsonb_array_length(payload->\'characteristics\') points FROM control_plans WHERE tenant_id=$1',[tenantId])).rows,
 measurements:(await c.query("SELECT id,session_code,payload->>'orderNumber' work_order,payload->>'operatorUserId' operator_id,payload->>'overallStatus' result,payload->'samples' samples FROM inspection_logs WHERE tenant_id=$1",[tenantId])).rows,
 approvals:(await c.query('SELECT inspection_id,status,reviewed_by,reviewed_at FROM inspection_approvals WHERE tenant_id=$1',[tenantId])).rows,
 tasks:(await c.query('SELECT title,owner_id,product_id,inspection_id,started_at,completed_at,completion_note FROM quality_tasks WHERE tenant_id=$1',[tenantId])).rows,
 notifications:(await c.query('SELECT title,kind,user_id,read_at,created_at FROM quality_notifications WHERE tenant_id=$1 ORDER BY created_at',[tenantId])).rows,
 media:(await c.query('SELECT file_name,storage_provider,upload_status FROM media_evidence WHERE tenant_id=$1',[tenantId])).rows
}));
writeFileSync('reports/control-lifecycle/verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({measurements:evidence.measurements.length,approvals:evidence.approvals.map(a=>a.status),media:evidence.media.map(m=>m.storage_provider)}));await pool.end();
