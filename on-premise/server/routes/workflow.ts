import { Router } from 'express';
import { z } from 'zod';
import { withDatabase } from '../db/pool.js';
import type pg from 'pg';
const withTenant=<T>(tenantId:string,callback:(client:pg.PoolClient)=>Promise<T>)=>withDatabase((client,id)=>{if(id!==tenantId)throw new Error('Kurum kimliği geçersiz.');return callback(client);});
import { requireAuth, requireRole } from '../middleware/auth.js';
import { workflowAudit, notifyQuality } from '../services/workflow.js';
import { conflict } from '../services/inspectionValidation.js';

export const workflowRouter=Router();
workflowRouter.use(requireAuth);
workflowRouter.get('/work',async(req,res,next)=>{
  try {
    const {tenantId,userId,role}=req.auth!;
    const result=await withTenant(tenantId,async client=>{
      const restricted=role==='operator';
      const cases=await client.query('SELECT * FROM quality_cases WHERE tenant_id=$1 AND ($2::boolean=false OR owner_id=$3) ORDER BY created_at DESC LIMIT 200',[tenantId,restricted,userId]);
      const approvals=restricted ? {rows:[]} : await client.query(`SELECT a.*,l.payload->>'sessionCode' session_code,l.payload->>'operatorName' operator_name FROM inspection_approvals a JOIN inspection_logs l ON l.tenant_id=a.tenant_id AND l.id=a.inspection_id WHERE a.tenant_id=$1 AND l.voided_at IS NULL ORDER BY l.occurred_at DESC LIMIT 200`,[tenantId]);
      const tasks=await client.query('SELECT * FROM quality_tasks WHERE tenant_id=$1 AND ($2::boolean=false OR owner_id=$3) ORDER BY due_at LIMIT 200',[tenantId,restricted,userId]);
      const notifications=await client.query('SELECT * FROM quality_notifications WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100',[tenantId,userId]);
      return {cases:cases.rows,approvals:approvals.rows,tasks:tasks.rows,notifications:notifications.rows};
    });res.json(result);
  }catch(error){next(error);}
});
workflowRouter.patch('/notifications/:id/read',async(req,res,next)=>{
  try{const {tenantId,userId}=req.auth!;await withTenant(tenantId,client=>client.query('UPDATE quality_notifications SET read_at=COALESCE(read_at,now()) WHERE tenant_id=$1 AND user_id=$2 AND id=$3',[tenantId,userId,z.coerce.number().int().positive().parse(req.params.id)]));res.status(204).end();}catch(error){next(error);}
});
workflowRouter.patch('/cases/:id',requireRole('admin','quality_engineer','operator'),async(req,res,next)=>{
  try {
    const id=z.string().uuid().parse(req.params.id);
    const input=z.object({version:z.number().int().positive(),ownerId:z.string().min(1),dueAt:z.string().datetime(),state:z.enum(['open','action','verification','closed']),containment:z.string().max(5000),rootCause:z.string().max(5000),action:z.string().max(5000),verification:z.string().max(5000)}).parse(req.body);
    const {tenantId,userId,role}=req.auth!;
    const result=await withTenant(tenantId,async client=>{
      const before=(await client.query('SELECT * FROM quality_cases WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,id])).rows[0];
      if(!before || before.version!==input.version)conflict('Kayıt değişti. Listeyi yenileyin.');
      if(before.state==='closed')conflict('Kapatılmış uygunsuzluk değiştirilemez.');
      if(role==='operator' && (before.owner_id!==userId || input.ownerId!==userId || input.state==='closed'))throw Object.assign(new Error('Bu işlem için yetkiniz yok.'),{status:403});
      if(!(await client.query("SELECT 1 FROM users WHERE tenant_id=$1 AND id=$2 AND status='active'",[tenantId,input.ownerId])).rowCount)conflict('Aktif bir sorumlu seçin.');
      const transitions:Record<string,string[]>={open:['open','action'],action:['action','verification'],verification:['action','verification','closed']};
      if(!transitions[before.state]?.includes(input.state))conflict('Önce aksiyon ve doğrulama aşamalarını tamamlayın.');
      if(input.state!=='open' && (!input.containment.trim() || !input.action.trim()))conflict('Geçici önlem ve aksiyon zorunludur.');
      if(['verification','closed'].includes(input.state) && !input.rootCause.trim())conflict('Kök neden zorunludur.');
      if(input.state==='closed' && (!input.verification.trim() || input.ownerId===userId))conflict('Kapatma için farklı bir kalite sorumlusunun doğrulaması gerekir.');
      const after=(await client.query(`UPDATE quality_cases SET owner_id=$3,due_at=$4,state=$5,containment=$6,root_cause=$7,action=$8,verification=$9,version=version+1,updated_at=now(),closed_by=$10 WHERE tenant_id=$1 AND id=$2 RETURNING *`,[tenantId,id,input.ownerId,input.dueAt,input.state,input.containment,input.rootCause,input.action,input.verification,input.state==='closed'?userId:null])).rows[0];
      await workflowAudit(client,tenantId,userId,'ncr.'+input.state,id,before,after);
      await notifyQuality(client,tenantId,'Uygunsuzluk güncellendi: '+before.title,'ncr',id,input.state==='verification'?undefined:input.ownerId);
      return after;
    });res.json(result);
  }catch(error){next(error);}
});
workflowRouter.post('/approvals/:id',requireRole('admin','quality_engineer'),async(req,res,next)=>{
  try {
    const id=z.string().min(1).max(120).parse(req.params.id);
    const input=z.object({status:z.enum(['approved','rejected']),reason:z.string().trim().min(5).max(2000)}).parse(req.body);
    const {tenantId,userId}=req.auth!;
    await withTenant(tenantId,async client=>{
      const row=(await client.query(`SELECT a.status,l.payload,l.voided_at FROM inspection_approvals a JOIN inspection_logs l ON l.tenant_id=a.tenant_id AND l.id=a.inspection_id WHERE a.tenant_id=$1 AND a.inspection_id=$2 FOR UPDATE OF a,l`,[tenantId,id])).rows[0];
      if(!row || row.status!=='pending' || row.voided_at)conflict('Kontrol onay beklemiyor.');
      if(row.payload.operatorUserId===userId)conflict('Kendi kontrolünüzü onaylayamaz veya reddedemezsiniz.');
      await client.query('UPDATE inspection_approvals SET status=$3,reason=$4,reviewed_by=$5,reviewed_at=now() WHERE tenant_id=$1 AND inspection_id=$2',[tenantId,id,input.status,input.reason,userId]);
      await workflowAudit(client,tenantId,userId,'inspection.'+input.status,id,{status:'pending'},input);
      await notifyQuality(client,tenantId,'Kontrol '+(input.status==='approved'?'onaylandı':'reddedildi: yeniden kontrol gerekli'),'approval',id,row.payload.operatorUserId);
      if(input.status==='rejected')await client.query('INSERT INTO quality_tasks(tenant_id,title,owner_id,product_id,due_at) VALUES($1,$2,$3,$4,now()+interval \'1 day\')',[tenantId,'Yeniden kontrol: '+row.payload.sessionCode,row.payload.operatorUserId,row.payload.productId]);
    });res.status(204).end();
  }catch(error){next(error);}
});
workflowRouter.post('/tasks',requireRole('admin','quality_engineer'),async(req,res,next)=>{
  try{
    const input=z.object({title:z.string().trim().min(3).max(250),ownerId:z.string().min(1),productId:z.string().optional(),dueAt:z.string().datetime()}).parse(req.body);
    const {tenantId,userId}=req.auth!;
    const result=await withTenant(tenantId,async client=>{
      if(!(await client.query("SELECT 1 FROM users WHERE tenant_id=$1 AND id=$2 AND status='active'",[tenantId,input.ownerId])).rowCount)conflict('Aktif sorumlu seçin.');
      const row=(await client.query('INSERT INTO quality_tasks(tenant_id,title,owner_id,product_id,due_at) VALUES($1,$2,$3,$4,$5) RETURNING *',[tenantId,input.title,input.ownerId,input.productId||null,input.dueAt])).rows[0];
      await workflowAudit(client,tenantId,userId,'task.created',row.id,null,row);await notifyQuality(client,tenantId,input.title,'task',row.id,input.ownerId);return row;
    });res.status(201).json(result);
  }catch(error){next(error);}
});
workflowRouter.post('/tasks/:id/complete',requireRole('admin','quality_engineer','operator'),async(req,res,next)=>{
  try{const {tenantId,userId,role}=req.auth!;const id=z.string().uuid().parse(req.params.id);const note=z.object({note:z.string().trim().min(5).max(2000)}).parse(req.body).note;
    await withTenant(tenantId,async client=>{const result=await client.query('UPDATE quality_tasks SET completed_at=now(),completion_note=$3 WHERE tenant_id=$1 AND id=$2 AND completed_at IS NULL AND ($4::boolean OR owner_id=$5) RETURNING *',[tenantId,id,note,role!=='operator',userId]);if(!result.rowCount)conflict('Görev bulunamadı veya kapalı.');await workflowAudit(client,tenantId,userId,'task.completed',id,null,result.rows[0]);});res.status(204).end();
  }catch(error){next(error);}
});
workflowRouter.get('/organization',requireRole('admin'),async(req,res,next)=>{
  try{res.json(await withTenant(req.auth!.tenantId,async client=>({plants:(await client.query('SELECT * FROM plants WHERE tenant_id=$1',[req.auth!.tenantId])).rows,departments:(await client.query('SELECT * FROM departments WHERE tenant_id=$1',[req.auth!.tenantId])).rows})));}catch(error){next(error);}
});
workflowRouter.post('/organization',requireRole('admin'),async(req,res,next)=>{
  try{const input=z.object({name:z.string().trim().min(2).max(120),plantId:z.string().uuid().optional()}).parse(req.body);const {tenantId,userId}=req.auth!;
    const result=await withTenant(tenantId,async client=>{const row=(input.plantId?await client.query('INSERT INTO departments(tenant_id,plant_id,name) VALUES($1,$2,$3) RETURNING *',[tenantId,input.plantId,input.name]):await client.query('INSERT INTO plants(tenant_id,name) VALUES($1,$2) RETURNING *',[tenantId,input.name])).rows[0];await workflowAudit(client,tenantId,userId,'organization.created',row.id,null,row);return row;});res.status(201).json(result);
  }catch(error){next(error);}
});
