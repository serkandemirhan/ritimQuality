import {Router} from 'express';
import {z} from 'zod';
import {withTenant} from '../db/pool.js';
import {requireAuth} from '../middleware/auth.js';
export const catalogRouter=Router();catalogRouter.use(requireAuth);
const input=z.object({search:z.string().max(250).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().refine(n=>[50,100].includes(n)).default(50),sort:z.string().max(50).default('timestamp'),direction:z.enum(['asc','desc']).default('desc'),product:z.string().max(250).default('all'),status:z.string().max(50).default('all'),period:z.enum(['all','today','week','month']).default('all'),customer:z.string().max(250).default('all'),revision:z.string().max(250).default('all'),planRevision:z.string().max(250).default('all'),source:z.string().max(50).default('all'),operator:z.string().max(250).default('all'),equipment:z.string().max(250).default('all'),characteristic:z.string().max(250).default('all'),quality:z.enum(['all','pass','fail','warning','review','na','unclassified']).default('all'),from:z.string().datetime().optional(),to:z.string().datetime().optional()});
catalogRouter.get('/inspection-catalog',async(req,res,next)=>{try{
 const q=input.parse(req.query),tenant=req.auth!.tenantId;
 const sorts:Record<string,string>={timestamp:'occurred_at',controlNumber:'control_number',productName:"payload->>'productName'",controlPlanVersion:"payload->>'controlPlanVersion'",lotNumber:"payload->>'lotNumber'",operatorName:"payload->>'operatorName'",sampleCount:"(payload->>'sampleCount')::int",overallStatus:"payload->>'overallStatus'",machineNo:"payload->>'machineNo'"};
 if(!sorts[q.sort])throw Object.assign(new Error('Geçersiz sıralama sütunu.'),{status:400});
 const args:unknown[]=[tenant],where=['l.tenant_id=$1','l.voided_at IS NULL'];
 const add=(sql:string,value:unknown)=>{args.push(value);where.push(sql.replaceAll('?', '$'+args.length));};
 if(q.search)add("strpos(lower(concat_ws(' ',l.control_number,l.payload->>'sessionCode',l.payload->>'productName',l.payload->>'productCode',l.payload->>'lotNumber',l.payload->>'orderNumber',l.payload->>'serialNumber',l.payload->>'operatorName')),lower(?))>0",q.search);
 for(const [value,key] of [[q.product,'productId'],[q.status,'overallStatus'],[q.revision,'productRevision'],[q.planRevision,'controlPlanVersion']] as const)if(value!=='all')add("l.payload->>'"+key+"'=?",value);
 if(q.customer!=='all')add("COALESCE(l.payload->>'customerSnapshot','__unknown__')=?",q.customer);
 if(q.source!=='all')add("COALESCE(l.payload->>'source','manual')=?",q.source);
 if(q.operator!=='all')add(q.operator.startsWith('legacy:')?"NULLIF(l.payload->>'operatorUserId','') IS NULL AND l.payload->>'operatorName'=?":"l.payload->>'operatorUserId'=?",q.operator.startsWith('legacy:')?q.operator.slice(7):q.operator);
 if(q.equipment!=='all')add("COALESCE(NULLIF(l.payload->>'equipmentId',''),l.payload->>'machineNo')=?",q.equipment);
 if(q.characteristic!=='all')add("EXISTS(SELECT 1 FROM jsonb_array_elements(l.payload->'samples') s WHERE s->'values'->? IS NOT NULL AND s->'values'->? <> 'null'::jsonb)",q.characteristic);
 if(q.quality!=='all')add("EXISTS(SELECT 1 FROM jsonb_array_elements(l.payload->'samples') s CROSS JOIN LATERAL jsonb_object_keys(COALESCE(s->'values','{}'::jsonb)) cid WHERE COALESCE((SELECT a->>'result' FROM jsonb_array_elements(COALESCE(l.payload->'mobileMeasurement'->'attempts','[]'::jsonb)) WITH ORDINALITY aa(a,n) WHERE a->>'characteristic'=cid AND a->>'sample'=s->>'sampleIndex' ORDER BY n DESC LIMIT 1),s->'qualityResults'->>cid,s->'statuses'->>cid)=?)",q.quality);
 if(q.period==='today')where.push("(l.occurred_at AT TIME ZONE 'Europe/Istanbul')::date=(now() AT TIME ZONE 'Europe/Istanbul')::date");
 if(q.period==='week'||q.period==='month')where.push("l.occurred_at>=now()-interval '"+(q.period==='week'?7:30)+" days'");
 args.push(q.pageSize,(q.page-1)*q.pageSize);const limit='$'+(args.length-1),offset='$'+args.length;
 const result=await withTenant(tenant,async c=>(await c.query(`WITH filtered AS (SELECT l.* FROM inspection_logs l WHERE ${where.join(' AND ')}), paged AS (SELECT * FROM filtered ORDER BY ${sorts[q.sort]} ${q.direction} NULLS LAST,id ASC LIMIT ${limit} OFFSET ${offset})
 SELECT (SELECT count(*)::int FROM filtered) total,COALESCE((SELECT json_agg(p.payload||jsonb_build_object('controlNumber',p.control_number,'approval',jsonb_build_object('status',COALESCE(a.status,'not_required'),'reviewedBy',u.name,'reviewedAt',a.reviewed_at,'reason',a.reason))) FROM paged p LEFT JOIN inspection_approvals a ON a.tenant_id=p.tenant_id AND a.inspection_id=p.id LEFT JOIN users u ON u.tenant_id=a.tenant_id AND u.id=a.reviewed_by),'[]'::json) items`,args)).rows[0]);res.json(result);
 }catch(e){next(e);}});
catalogRouter.get('/workflow-catalog/:kind',async(req,res,next)=>{try{
 const kind=z.enum(['tasks','audit']).parse(req.params.kind),q=input.parse(req.query),{tenantId,userId,role}=req.auth!;
 if(kind==='audit'&&role!=='admin'&&role!=='quality_engineer'&&role!=='auditor')throw Object.assign(new Error('Denetim kaydı yetkisi gerekli.'),{status:403});
 const columns=kind==='tasks'?['title','owner_name','due_at','completed_at','priority','started_at']:['created_at','actor_name','action','entity_type','entity_id','ip_address'];
 const sort=q.sort==='timestamp'?columns[kind==='tasks'?2:0]:q.sort;if(!columns.includes(sort))throw Object.assign(new Error('Geçersiz sıralama sütunu.'),{status:400});
 const args:unknown[]=[tenantId],where=['q.tenant_id=$1'];
 const add=(sql:string,value:unknown)=>{args.push(value);where.push(sql.replaceAll('?', '$'+args.length));};
 if(kind==='tasks'&&role==='operator')add('q.owner_id=?',userId);
 if(q.operator!=='all')add(kind==='tasks'?'q.owner_id=?':'q.actor_user_id=?',q.operator);
 if(q.status!=='all'&&kind==='tasks'){if(q.status==='completed')where.push('q.completed_at IS NOT NULL');else if(q.status==='overdue')where.push('q.completed_at IS NULL AND q.due_at<now()');else if(q.status==='open')where.push('q.completed_at IS NULL');else throw Object.assign(new Error('Geçersiz görev durumu.'),{status:400});}
 const time=kind==='tasks'?'due_at':'created_at';
 if(q.from)add('q.'+time+'>=?::timestamptz',q.from);if(q.to)add('q.'+time+'<?::timestamptz',q.to);
 if(q.from&&q.to&&q.from>=q.to)throw Object.assign(new Error('Geçersiz tarih aralığı.'),{status:400});
 const select=kind==='tasks'?'q.*,u.name owner_name,l.control_number':'q.*,u.name actor_name';
 const source=kind==='tasks'?'quality_tasks q LEFT JOIN users u ON u.tenant_id=q.tenant_id AND u.id=q.owner_id LEFT JOIN inspection_logs l ON l.tenant_id=q.tenant_id AND l.id=q.result_inspection_id':'audit_logs q LEFT JOIN users u ON u.tenant_id=q.tenant_id AND u.id=q.actor_user_id';
 args.push(q.search);const term='$'+args.length;
 args.push(q.pageSize,(q.page-1)*q.pageSize);
 const row=await withTenant(tenantId,async c=>(await c.query(`WITH scoped AS (SELECT ${select} FROM ${source} WHERE ${where.join(' AND ')}),filtered AS (SELECT * FROM scoped WHERE ${term}='' OR strpos(lower(concat_ws(' ',${kind==='tasks'?'title,owner_name,control_number':'actor_name,action,entity_type,entity_id,ip_address::text'})),lower(${term}))>0),paged AS (SELECT * FROM filtered ORDER BY ${sort} ${q.direction} NULLS LAST,id ASC LIMIT $${args.length-1} OFFSET $${args.length}) SELECT (SELECT count(*)::int FROM filtered) total,COALESCE((SELECT json_agg(paged) FROM paged),'[]'::json) items`,args)).rows[0]);res.json(row);
 }catch(e){next(e);}});
