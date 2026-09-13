import { createInspectionWorkflow } from '../services/workflow.js';
import { inspectionSignature, validateInspection, planSchema, assertRevisionUnchanged, conflict } from '../services/inspectionValidation.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { withDatabase } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../services/access.js';

export const appRouter = Router();
appRouter.use(requireAuth);

const entitySchema = z.record(z.unknown());
const idSchema = z.string().min(1).max(120);
const mediaRoot = resolve(process.env.MEDIA_ROOT || '.data/media');

appRouter.post('/media', requireRole('admin','quality_engineer','operator'), async (req,res,next) => {
  try {
    const input=z.object({fileName:z.string().min(1).max(180),mimeType:z.string().min(1).max(120),kind:z.enum(['photo','video','file']),dataUrl:z.string().min(10)}).parse(req.body);
    const match=input.dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if(!match||match[1]!==input.mimeType){res.status(400).json({error:'Geçersiz medya içeriği.'});return;}
    const data=Buffer.from(match[2],'base64');
    if(!data.length||data.length>8*1024*1024){res.status(413).json({error:'Dosya boyutu 8 MB sınırını aşıyor.'});return;}
    const extension=input.mimeType==='image/jpeg'?'.jpg':input.mimeType==='image/png'?'.png':input.mimeType==='image/webp'?'.webp':input.mimeType==='video/mp4'?'.mp4':input.mimeType==='application/pdf'?'.pdf':'.bin';
    const id=randomUUID(); const storageName=`${id}${extension}`;
    await mkdir(mediaRoot,{recursive:true});
    await writeFile(resolve(mediaRoot,storageName),data,{flag:'wx'});
    const createdAt=new Date().toISOString();
    await withDatabase(client=>client.query(`INSERT INTO media_evidence(id,tenant_id,file_name,mime_type,kind,storage_path,size_bytes,uploaded_by) VALUES($1,current_setting('app.tenant_id')::uuid,$2,$3,$4,$5,$6,$7)`,[id,input.fileName,input.mimeType,input.kind,storageName,data.length,req.auth!.userId]).then(()=>undefined));
    res.status(201).json({id,fileName:input.fileName,mimeType:input.mimeType,kind:input.kind,url:`/api/media/${id}`,createdAt});
  } catch(error){next(error);}
});

appRouter.get('/media/:id', async (req,res,next) => {
  try {
    const id=z.string().uuid().parse(req.params.id);
    const result=await withDatabase(client=>client.query('SELECT file_name,mime_type,storage_path FROM media_evidence WHERE id=$1',[id]));
    const media=result.rows[0]; if(!media){res.status(404).json({error:'Medya bulunamadı.'});return;}
    res.type(media.mime_type); res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(media.file_name)}`); res.sendFile(resolve(mediaRoot,media.storage_path));
  } catch(error){next(error);}
});

appRouter.get('/bootstrap', async (req, res, next) => {
  try {
    const data = await withDatabase(async (client, tenantId) => {
      const company = await client.query(`SELECT id,name,legal_name,tax_number,tax_office,industry,facility_location,contact_email,contact_phone,created_at,updated_at FROM tenants WHERE id=$1`, [tenantId]);
      const users = await client.query(`SELECT id,name,email,role,department,station_or_machine,status,last_login_at FROM users ORDER BY name`);
      const products = await client.query('SELECT payload FROM products ORDER BY created_at DESC');
      const plans = await client.query('SELECT payload FROM control_plans ORDER BY created_at DESC');
      const logs = await client.query('SELECT payload FROM inspection_logs WHERE voided_at IS NULL ORDER BY occurred_at DESC');
      return {
        currentUserId: req.auth!.userId,
        company: company.rows[0], users: users.rows,
        products: products.rows.map(row => row.payload),
        controlPlans: plans.rows.map(row => row.payload),
        inspectionLogs: logs.rows.map(row => row.payload),
      };
    });
    res.json(data);
  } catch (error) { next(error); }
});

appRouter.patch('/company', requireRole('admin'), async (req, res, next) => {
  try {
    const input = z.object({ name:z.string().min(2), legalName:z.string().min(2), taxNumber:z.string().optional(), taxOffice:z.string().optional(), industry:z.string().optional(), facilityLocation:z.string().optional(), contactEmail:z.string().email(), contactPhone:z.string().optional() }).parse(req.body);
    const company = await withDatabase(async (client, tenantId) => {
      const before = (await client.query('SELECT * FROM tenants WHERE id=$1',[tenantId])).rows[0];
      const result = await client.query(`UPDATE tenants SET name=$2,legal_name=$3,tax_number=$4,tax_office=$5,industry=$6,facility_location=$7,contact_email=$8,contact_phone=$9,updated_at=now() WHERE id=$1 RETURNING *`, [tenantId,input.name,input.legalName,input.taxNumber,input.taxOffice,input.industry,input.facilityLocation,input.contactEmail,input.contactPhone]);
      await audit(client,{userId:req.auth!.userId,action:'company.updated',entityType:'company',before,after:result.rows[0],ip:req.ip});
      return result.rows[0];
    });
    res.json(company);
  } catch (error) { next(error); }
});

appRouter.put('/products/:id', requireRole('admin','quality_engineer'), async (req,res,next) => {
  try {
    const id=idSchema.parse(req.params.id); const payload=entitySchema.parse(req.body);
    const code=z.string().min(1).parse(payload.code); const name=z.string().min(1).parse(payload.name);
    await withDatabase(async (client, tenantId) => {
      const before=(await client.query('SELECT payload FROM products WHERE id=$1',[id])).rows[0]?.payload;
      await client.query(`INSERT INTO products(id,tenant_id,code,name,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,id) DO UPDATE SET code=$3,name=$4,payload=$5,updated_at=now()`,[id,tenantId,code,name,payload]);
      await audit(client,{userId:req.auth!.userId,action:before?'product.updated':'product.created',entityType:'product',entityId:id,before,after:payload,ip:req.ip});
    });
    res.json(payload);
  } catch(error){next(error);}
});

appRouter.delete('/products/:id', requireRole('admin'), async (req,res,next) => {
  try {
    const id=idSchema.parse(req.params.id);
    await withDatabase(async client => {
      const before=(await client.query('DELETE FROM products WHERE id=$1 RETURNING payload',[id])).rows[0]?.payload;
      await audit(client,{userId:req.auth!.userId,action:'product.deleted',entityType:'product',entityId:id,before,ip:req.ip});
    });
    res.status(204).end();
  } catch(error){next(error);}
});

appRouter.put('/control-plans/:id', requireRole('admin','quality_engineer'), async (req,res,next) => {
  try {
    const id=idSchema.parse(req.params.id); const payload=planSchema.parse(req.body);
    const productId=idSchema.parse(payload.productId); const version=z.string().min(1).parse(payload.version);
    const status=z.enum(['active','draft','archived']).parse(payload.status); const isActive=z.boolean().parse(payload.isActive);
    await withDatabase(async (client, tenantId) => {
      if (payload.id !== id) conflict('Plan kimliği tutarsız.');
      await client.query('SELECT id FROM products WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, productId]);
      const prior = (await client.query('SELECT payload FROM control_plans WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId,id])).rows[0]?.payload;
      if (prior && (await client.query('SELECT 1 FROM inspection_logs WHERE tenant_id=$1 AND control_plan_id=$2 LIMIT 1',[tenantId,id])).rowCount) assertRevisionUnchanged(prior,payload);
      if(isActive) await client.query(`UPDATE control_plans SET is_active=false,status=CASE WHEN status='active' THEN 'archived' ELSE status END,payload=jsonb_set(jsonb_set(payload,'{isActive}','false'::jsonb),'{status}','"archived"'::jsonb) WHERE product_id=$1 AND id<>$2 AND is_active`,[productId,id]);
      const before=(await client.query('SELECT payload FROM control_plans WHERE id=$1',[id])).rows[0]?.payload;
      await client.query(`INSERT INTO control_plans(id,tenant_id,product_id,version,status,is_active,payload) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,id) DO UPDATE SET product_id=$3,version=$4,status=$5,is_active=$6,payload=$7,updated_at=now()`,[id,tenantId,productId,version,status,isActive,payload]);
      await audit(client,{userId:req.auth!.userId,action:before?'control_plan.updated':'control_plan.created',entityType:'control_plan',entityId:id,before,after:payload,ip:req.ip});
    });
    res.json(payload);
  } catch(error){next(error);}
});

appRouter.delete('/control-plans/:id', requireRole('admin','quality_engineer'), async (req,res,next) => {
  try {
    const id=idSchema.parse(req.params.id);
    await withDatabase(async client => {
      if((await client.query('SELECT 1 FROM inspection_logs WHERE control_plan_id=$1 LIMIT 1',[id])).rowCount){const error=new Error('Ölçüm kaydı bulunan kontrol planı silinemez; arşivleyin.');Object.assign(error,{status:409});throw error;}
      const before=(await client.query('DELETE FROM control_plans WHERE id=$1 RETURNING payload',[id])).rows[0]?.payload;
      await audit(client,{userId:req.auth!.userId,action:'control_plan.deleted',entityType:'control_plan',entityId:id,before,ip:req.ip});
    });
    res.status(204).end();
  } catch(error){next(error);}
});

appRouter.post('/inspection-logs', requireRole('admin','quality_engineer','operator'), async (req,res,next) => {
  try {
    let payload=entitySchema.parse(req.body); const id=idSchema.parse(payload.id); const productId=idSchema.parse(payload.productId); const planId=idSchema.parse(payload.controlPlanId); const code=z.string().min(1).parse(payload.sessionCode); const occurredAt=z.string().datetime().parse(payload.timestamp); const samples=z.array(z.record(z.unknown())).min(1).parse(payload.samples);
    await withDatabase(async (client, tenantId) => {
      const signature = inspectionSignature(req.body);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[tenantId+':inspection:'+id]);
      const existing=(await client.query('SELECT payload,voided_at FROM inspection_logs WHERE tenant_id=$1 AND id=$2',[tenantId,id])).rows[0];
      if(existing){
        if(existing.voided_at || existing.payload.operatorUserId !== req.auth!.userId || existing.payload.requestSignature !== signature) conflict('Bu kayıt kimliği başka bir ölçüm için kullanılmış.');
        payload=existing.payload;return;
      }
      const planPayload=(await client.query('SELECT payload FROM control_plans WHERE id=$1 FOR SHARE',[planId])).rows[0]?.payload as {characteristics?:Record<string,unknown>[]} | undefined;
      if(!planPayload){const error=new Error('Kontrol planı bulunamadı.');Object.assign(error,{status:404});throw error;}
      const actor=(await client.query('SELECT name FROM users WHERE id=$1',[req.auth!.userId])).rows[0];
      payload={...validateInspection(payload,planPayload,{id:req.auth!.userId,name:actor.name}), requestSignature:signature};
      samples.splice(0,samples.length,...payload.samples as Record<string,unknown>[]);
      const characteristics=Array.isArray(planPayload.characteristics)?planPayload.characteristics:[];
      const characteristicMap=new Map(characteristics.map(characteristic=>[String(characteristic.id),characteristic]));
      for(const sample of samples){
        const values=(sample.values||{}) as Record<string,unknown>; const statuses=(sample.statuses||{}) as Record<string,unknown>; const evidence=(sample.evidence||{}) as Record<string,unknown>;
        for(const [characteristicId,value] of Object.entries(values)){
          if(value===null||value===undefined||statuses[characteristicId]==='empty') continue;
          const characteristic=characteristicMap.get(characteristicId); if(!characteristic) continue;
          const policy=String(characteristic.evidencePolicy||'none'); const failed=statuses[characteristicId]==='fail'; const attachments=Array.isArray(evidence[characteristicId])?evidence[characteristicId] as Record<string,unknown>[]:[];
          if((policy==='always_required'||(policy==='required_on_fail'&&failed))&&attachments.length===0){const error=new Error(`#${characteristic.pointNo} için kanıt dosyası zorunludur.`);Object.assign(error,{status:400});throw error;}
          if(attachments.length){const ids=attachments.map(item=>z.string().uuid().parse(item.id));const owned=await client.query('SELECT count(*)::int count FROM media_evidence WHERE tenant_id=$1 AND uploaded_by=$2 AND inspection_id IS NULL AND id=ANY($3::uuid[])',[tenantId,req.auth!.userId,ids]);if(owned.rows[0].count!==ids.length){const error=new Error('Kanıt dosyalarından biri geçersiz veya başka bir kayda bağlı.');Object.assign(error,{status:400});throw error;}}
        }
      }
      await client.query(`INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,tenantId,productId,planId,code,occurredAt,payload]);
      for(const sample of samples){
        const sampleIndex=z.number().int().positive().parse(sample.sampleIndex); const values=(sample.values||{}) as Record<string,unknown>; const statuses=(sample.statuses||{}) as Record<string,unknown>; const evidence=(sample.evidence||{}) as Record<string,unknown>;
        for(const [characteristicId,value] of Object.entries(values)){
          if(value===null||value===undefined||statuses[characteristicId]==='empty') continue;
          const characteristic=characteristicMap.get(characteristicId); if(!characteristic) continue;
          const type=String(characteristic.type||'numeric'); const status=z.enum(['pass','warning','fail']).parse(statuses[characteristicId]);
          await client.query(`INSERT INTO measurement_results(tenant_id,inspection_id,sample_index,characteristic_id,point_no,characteristic_name,characteristic_type,value,numeric_value,nominal,lsl,usl,unit,status,source,product_id,product_revision,lot_number,serial_number,work_order,equipment_id,operator_name,measured_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,[
            tenantId,id,sampleIndex,characteristicId,Number(characteristic.pointNo||0),String(characteristic.name||''),type,JSON.stringify(value),typeof value==='number'?value:null,type==='numeric'?Number(characteristic.nominal):null,type==='numeric'?Number(characteristic.lsl):null,type==='numeric'?Number(characteristic.usl):null,String(characteristic.unit||''),status,String(payload.source||'manual'),productId,String(payload.productRevision||''),String(payload.lotNumber||''),String(payload.serialNumber||''),String(payload.orderNumber||''),String(payload.equipmentId||payload.machineNo||''),String(payload.operatorName||''),occurredAt,
          ]);
          const attachments=Array.isArray(evidence[characteristicId])?evidence[characteristicId] as Record<string,unknown>[]:[];
          const mediaIds=attachments.map(item=>z.string().uuid().parse(item.id));
          if(mediaIds.length) await client.query('UPDATE media_evidence SET inspection_id=$1,sample_index=$2,characteristic_id=$3 WHERE tenant_id=$4 AND id=ANY($5::uuid[])',[id,sampleIndex,characteristicId,tenantId,mediaIds]);
        }
      }
      await createInspectionWorkflow(client,tenantId,req.auth!.userId,payload);
      await audit(client,{userId:req.auth!.userId,action:'inspection.created',entityType:'inspection_log',entityId:id,after:payload,ip:req.ip});
    });
    res.status(201).json(payload);
  } catch(error){next(error);}
});

appRouter.post('/inspection-logs/:id/void', requireRole('admin','quality_engineer'), async (req,res,next) => {
  try {
    const id=idSchema.parse(req.params.id); const reason=z.object({reason:z.string().min(5).max(500)}).parse(req.body).reason;
    await withDatabase(async client => {
      await client.query('UPDATE inspection_logs SET voided_at=now(),voided_by=$2,void_reason=$3 WHERE id=$1 AND voided_at IS NULL',[id,req.auth!.userId,reason]);
      await audit(client,{userId:req.auth!.userId,action:'inspection.voided',entityType:'inspection_log',entityId:id,after:{reason},ip:req.ip});
    });
    res.status(204).end();
  } catch(error){next(error);}
});

appRouter.post('/users', requireRole('admin'), async (req,res,next) => {
  try {
    const input=z.object({id:z.string().min(1).max(120),name:z.string().min(2),email:z.string().email(),password:z.string().min(10).max(128).optional(),role:z.enum(['admin','quality_engineer','operator','auditor']),department:z.string().default(''),stationOrMachine:z.string().optional(),status:z.enum(['active','suspended']).default('active')}).parse(req.body);
    const user=await withDatabase(async (client, tenantId) => {
      const existing=(await client.query('SELECT * FROM users WHERE id=$1',[input.id])).rows[0];
      if(!existing&&!input.password){const error=new Error('Yeni kullanıcı için geçici PIN/şifre zorunludur.');Object.assign(error,{status:400});throw error;}
      if(existing?.role==='admin'&&(input.role!=='admin'||input.status!=='active')){
        const admins=await client.query("SELECT count(*)::int count FROM users WHERE role='admin' AND status='active'");
        if(admins.rows[0].count<=1){const error=new Error('Son aktif yöneticinin rolü veya durumu değiştirilemez.');Object.assign(error,{status:409});throw error;}
      }
      const hash=input.password?await bcrypt.hash(input.password,12):existing.password_hash;
      const result=await client.query(`INSERT INTO users(id,tenant_id,name,email,password_hash,role,department,station_or_machine,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET name=$3,email=$4,password_hash=$5,role=$6,department=$7,station_or_machine=$8,status=$9,updated_at=now() RETURNING id,name,email,role,department,station_or_machine,status`,[input.id,tenantId,input.name,input.email.toLowerCase(),hash,input.role,input.department,input.stationOrMachine,input.status]);
      await audit(client,{userId:req.auth!.userId,action:existing?'user.updated':'user.created',entityType:'user',entityId:input.id,before:existing&&{...existing,password_hash:undefined},after:result.rows[0],ip:req.ip});
      return result.rows[0];
    });
    res.status(201).json(user);
  } catch(error){next(error);}
});

appRouter.delete('/users/:id', requireRole('admin'), async (req,res,next) => {
  try {
    const id=idSchema.parse(req.params.id); const userId=req.auth!.userId;
    if(id===userId){res.status(409).json({error:'Kendi hesabınızı silemezsiniz.'});return;}
    await withDatabase(async client => {
      const target=(await client.query('SELECT id,role,name,email FROM users WHERE id=$1',[id])).rows[0];
      if(target?.role==='admin'&&(await client.query("SELECT count(*)::int count FROM users WHERE role='admin' AND status='active'")).rows[0].count<=1){const error=new Error('Son aktif yönetici silinemez.');Object.assign(error,{status:409});throw error;}
      await audit(client,{userId,action:'user.deleted',entityType:'user',entityId:id,before:target,ip:req.ip});
      await client.query('DELETE FROM users WHERE id=$1',[id]);
    });
    res.status(204).end();
  } catch(error){next(error);}
});

appRouter.get('/audit-logs', requireRole('admin','auditor'), async (_req,res,next) => {
  try { const result=await withDatabase(client=>client.query(`SELECT a.*,u.name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 500`)); res.json(result.rows); }
  catch(error){next(error);}
});
