import type pg from 'pg';

export async function workflowAudit(client: pg.PoolClient, tenantId:string, userId:string, action:string, entityId:string, before:unknown, after:unknown) {
  await client.query('INSERT INTO audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenantId,userId,action,'quality_workflow',entityId,before,after]);
}
export async function notifyQuality(client: pg.PoolClient, tenantId:string, title:string, kind:string, entityId:string, ownerId?:string) {
  await client.query(`INSERT INTO quality_notifications(tenant_id,user_id,title,kind,entity_id)
    SELECT tenant_id,id,$2,$3,$4 FROM users WHERE tenant_id=$1 AND status='active' AND (id=$5 OR ($5::text IS NULL AND role IN('admin','quality_engineer')))`,[tenantId,title,kind,entityId,ownerId||null]);
}
export async function createInspectionWorkflow(client:pg.PoolClient,tenantId:string,userId:string,payload:Record<string,unknown>) {
  if(payload.overallStatus==='fail'){
    const result=await client.query('INSERT INTO quality_cases(tenant_id,inspection_id,title) VALUES($1,$2,$3) ON CONFLICT(tenant_id,inspection_id) DO NOTHING RETURNING id',[tenantId,payload.id,`NOK: ${payload.productCode || payload.productId} · ${payload.sessionCode}`]);
    if(result.rowCount){await notifyQuality(client,tenantId,'Yeni uygunsuzluk: '+payload.sessionCode,'ncr',result.rows[0].id);await workflowAudit(client,tenantId,userId,'ncr.created',result.rows[0].id,null,{inspectionId:payload.id});}
  }
  const plan=payload.controlPlanSnapshot as {requiresApproval?:boolean};
  if(plan.requiresApproval){
    await client.query('INSERT INTO inspection_approvals(tenant_id,inspection_id) VALUES($1,$2)',[tenantId,payload.id]);
    await notifyQuality(client,tenantId,'Kontrol onay bekliyor: '+payload.sessionCode,'approval',String(payload.id));
  }
}
