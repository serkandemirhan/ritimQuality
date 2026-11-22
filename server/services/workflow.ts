import type pg from 'pg';

export async function workflowAudit(client: pg.PoolClient, tenantId:string, userId:string, action:string, entityId:string, before:unknown, after:unknown) {
  await client.query('INSERT INTO audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenantId,userId,action,'quality_workflow',entityId,before,after]);
}
export async function notifyQuality(client: pg.PoolClient, tenantId:string, title:string, kind:string, entityId:string, ownerId?:string) {
  await client.query(`INSERT INTO quality_notifications(tenant_id,user_id,title,kind,entity_id)
    SELECT tenant_id,id,$2,$3,$4 FROM users WHERE tenant_id=$1 AND status='active' AND (id=$5 OR ($5::text IS NULL AND role IN('admin','quality_engineer')))`,[tenantId,title,kind,entityId,ownerId||null]);
}
export async function createInspectionWorkflow(client:pg.PoolClient,tenantId:string,userId:string,payload:Record<string,unknown>,actorRole?:string) {
  if(payload.overallStatus==='fail'||payload.hasHistoricalFailure){
    const result=await client.query('INSERT INTO quality_cases(tenant_id,inspection_id,title) VALUES($1,$2,$3) ON CONFLICT(tenant_id,inspection_id) DO NOTHING RETURNING id',[tenantId,payload.id,`NOK: ${payload.productCode || payload.productId} · ${(payload.controlNumber || payload.sessionCode)}`]);
    if(result.rowCount){await notifyQuality(client,tenantId,'Yeni uygunsuzluk: '+(payload.controlNumber || payload.sessionCode),'ncr',result.rows[0].id);await workflowAudit(client,tenantId,userId,'ncr.created',result.rows[0].id,null,{inspectionId:payload.id});}
  }
  const measuredByRole=actorRole??(await client.query('SELECT role FROM users WHERE tenant_id=$1 AND id=$2',[tenantId,userId])).rows[0]?.role;
  const plan=payload.controlPlanSnapshot as {requiresApproval?:boolean};
  if(measuredByRole!=='admin'&&(plan.requiresApproval||payload.requiresReview)){
    await client.query('INSERT INTO inspection_approvals(tenant_id,inspection_id) VALUES($1,$2)',[tenantId,payload.id]);
    await notifyQuality(client,tenantId,'Kontrol onay bekliyor: '+(payload.controlNumber || payload.sessionCode),'approval',String(payload.id));
  } else {
    await notifyQuality(client,tenantId,'Kontrol tamamlandı: '+(payload.controlNumber || payload.sessionCode),'inspection',String(payload.id));
  }
}

// Explicit administrative reconciliation; never changes measurement values or historical decisions.
export async function exemptPendingAdminMeasurements(client:pg.PoolClient,tenantId:string,actorId:string){
 const rows=(await client.query(`SELECT a.inspection_id FROM inspection_approvals a
 JOIN inspection_logs l ON l.tenant_id=a.tenant_id AND l.id=a.inspection_id
 JOIN users u ON u.tenant_id=l.tenant_id AND u.id=l.payload->>'operatorUserId'
 WHERE a.tenant_id=$1 AND a.status='pending' AND l.voided_at IS NULL
 AND (l.payload->>'operatorRoleAtMeasurement'='admin' OR (l.payload->>'operatorRoleAtMeasurement' IS NULL AND u.role='admin'))
 ORDER BY a.inspection_id FOR UPDATE OF a,l`,[tenantId])).rows;
 const reason='Yönetici tarafından yapılan ölçüm: ek onay gerekmiyor. Eski rol kaydı bulunmayan ölçümlerde mevcut yönetici rolü esas alındı.';
 for(const row of rows){
  await client.query("UPDATE inspection_approvals SET status='approved',reason=$3,reviewed_by=NULL,reviewed_at=now() WHERE tenant_id=$1 AND inspection_id=$2",[tenantId,row.inspection_id,reason]);
  await workflowAudit(client,tenantId,actorId,'inspection.approval_not_required',row.inspection_id,{status:'pending'},{status:'approved',automatic:true,reason});
  await client.query("UPDATE quality_notifications SET read_at=COALESCE(read_at,now()) WHERE tenant_id=$1 AND kind='approval' AND entity_id=$2",[tenantId,row.inspection_id]);
 }
 return rows.length;
}
