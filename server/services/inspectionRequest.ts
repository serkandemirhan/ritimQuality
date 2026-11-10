import type pg from 'pg';
import { conflict } from './inspectionValidation.js';
import { workflowAudit } from './workflow.js';

// Called in the inspection transaction. The row lock prevents two measurements
// from completing the same request; a retried log is handled before this call.
export async function completeInspectionRequest(client: pg.PoolClient, tenantId:string, userId:string, payload:Record<string,unknown>) {
  if (!payload.taskId) return;
  if (typeof payload.taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.taskId)) conflict('Kontrol isteği geçersiz.');
  const task = (await client.query('SELECT * FROM quality_tasks WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,payload.taskId])).rows[0];
  if (!task || task.owner_id !== userId || task.completed_at) conflict('Kontrol isteği kapalı veya başka bir operatöre atanmış.');
  if (task.product_id !== payload.productId) conflict('İstek ile ölçümün parçası eşleşmiyor.');
  const request = task.request_context;
  if (request && (request.planId !== payload.controlPlanId || request.planVersion !== payload.controlPlanVersion || request.sampleCount !== payload.sampleCount || request.orderNumber !== payload.orderNumber || request.lotNumber !== payload.lotNumber)) conflict('Kontrol planı, numune veya iş emri bilgileri istekle eşleşmiyor.');
  await client.query("UPDATE quality_tasks SET result_inspection_id=$3,started_at=COALESCE(started_at,now()),completed_at=now(),completion_note='Ölçüm kaydedildi. Kalite kararı rapordan izlenebilir.' WHERE tenant_id=$1 AND id=$2",[tenantId,task.id,payload.id]);
  await workflowAudit(client,tenantId,userId,'task.inspection_completed',task.id,task,{inspectionId:payload.id});
}
