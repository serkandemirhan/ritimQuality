import 'dotenv/config';
import {pool, withTenant} from '../server/db/pool.js';
import {validateInspection, inspectionSignature} from '../server/services/inspectionValidation.js';
import {createInspectionWorkflow, workflowAudit, notifyQuality} from '../server/services/workflow.js';

const tenantSlug=process.env.OPERATIONAL_DEMO_WORKSPACE || 'demirhan-demo';

function numericValue(c:any,index:number,sample:number,mode:'pass'|'warning'|'fail') {
  const lsl=Number(c.lsl ?? c.nominal-c.tolLower ?? c.nominal-1);
  const usl=Number(c.usl ?? c.nominal+c.tolUpper ?? c.nominal+1);
  const span=Math.max(usl-lsl,0.001);
  if(mode==='fail' && sample===5)return Number((usl+span*.16).toFixed(c.precision ?? 3));
  if(mode==='warning' && sample>=4)return Number((usl-span*.06).toFixed(c.precision ?? 3));
  const wave=Math.sin(index*1.7+sample+c.pointNo)*span*.13;
  return Number((Number(c.nominal)+wave).toFixed(c.precision ?? 3));
}

function valueFor(c:any,index:number,sample:number,mode:'pass'|'warning'|'fail') {
  if((c.type||'numeric')==='numeric')return numericValue(c,index,sample,mode);
  if(['ok_nok','visual','boolean'].includes(c.type))return mode==='fail'&&sample===5?'NOK':'OK';
  if(c.type==='single_select')return mode==='fail'&&sample===5&&c.rejectedOptions?.[0]?c.rejectedOptions[0]:c.options?.[0];
  if(c.type==='multi_select')return [c.options?.[0]].filter(Boolean);
  return 'Uygun';
}

const tenant=(await pool.query('SELECT id FROM tenants WHERE slug=$1',[tenantSlug])).rows[0];
if(!tenant){await pool.end();throw new Error(`Tenant not found: ${tenantSlug}`);}

try{
  const inserted=await withTenant(tenant.id,async client=>{
    const users=(await client.query("SELECT id,name,role,station_or_machine FROM users WHERE tenant_id=$1 AND status='active' ORDER BY role,name",[tenant.id])).rows;
    const operators=users.filter(user=>['operator','quality_engineer','admin'].includes(user.role));
    const products=(await client.query('SELECT id,code,name,payload FROM products WHERE tenant_id=$1 ORDER BY code',[tenant.id])).rows;
    const plans=(await client.query("SELECT payload FROM control_plans WHERE tenant_id=$1 AND is_active=true AND status='active' ORDER BY product_id",[tenant.id])).rows.map(row=>row.payload);
    const rules=(await client.query('SELECT inspection_rules FROM tenants WHERE id=$1',[tenant.id])).rows[0].inspection_rules;
    let count=0;
    for(let i=0;i<18;i++){
      const plan=plans[i%plans.length];
      const product=products.find(product=>product.id===plan.productId);
      const operator=operators[i%operators.length];
      const mode:'pass'|'warning'|'fail'=i%7===0?'fail':i%5===0?'warning':'pass';
      const at=new Date(Date.now()-i*3*60*60*1000);
      const id=`ops-${at.toISOString().slice(0,10)}-${String(i+1).padStart(2,'0')}`;
      const exists=await client.query('SELECT 1 FROM inspection_logs WHERE tenant_id=$1 AND id=$2',[tenant.id,id]);
      if(exists.rowCount)continue;
      const samples=Array.from({length:5},(_,sampleIndex)=>({
        sampleIndex:sampleIndex+1,
        values:Object.fromEntries(plan.characteristics.map((c:any)=>[c.id,valueFor(c,i,sampleIndex+1,mode)])),
        pointNotes:mode==='fail'&&sampleIndex===4?Object.fromEntries(plan.characteristics.slice(0,1).map((c:any)=>[c.id,'Operasyonel demo: ayar kontrolü ve tekrar ölçüm planlandı.'])):{},
      }));
      const input:any={id,sessionCode:`OPS-${at.toISOString().slice(0,10).replaceAll('-','')}-${String(i+1).padStart(2,'0')}`,productId:product.id,productCode:product.code,productName:product.name,controlPlanId:plan.id,controlPlanVersion:plan.version,operatorName:operator.name,operatorUserId:operator.id,lotNumber:`LOT-${at.toISOString().slice(5,10).replace('-','')}-${(i%4)+1}`,orderNumber:`WO-${String(9100+i)}`,serialNumber:`SN-${String(43000+i)}`,machineNo:operator.station_or_machine||['CNC-01','CMM-01','Taşlama-03'][i%3],equipmentId:operator.station_or_machine||'MANUEL-ISTASYON-01',source:i%4===0?'gauge':'manual',sampleCount:samples.length,samples,timestamp:at.toISOString()};
      const payload:any=validateInspection(input,plan,{id:operator.id,name:operator.name},rules);
      payload.requestSignature=inspectionSignature(input);
      await client.query(`INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,tenant.id,product.id,plan.id,payload.sessionCode,payload.timestamp,payload]);
      await createInspectionWorkflow(client,tenant.id,operator.id,payload);
      count++;
    }
    const qualityOwner=users.find(user=>user.role==='quality_engineer')||users.find(user=>user.role==='admin')||users[0];
    for(const row of (await client.query("SELECT id,product_id,payload FROM inspection_logs WHERE tenant_id=$1 AND voided_at IS NULL ORDER BY occurred_at DESC LIMIT 3",[tenant.id])).rows){
      const taskExists=await client.query('SELECT 1 FROM quality_tasks WHERE tenant_id=$1 AND inspection_id=$2',[tenant.id,row.id]);
      if(taskExists.rowCount)continue;
      const task=(await client.query("INSERT INTO quality_tasks(tenant_id,title,owner_id,product_id,due_at,priority,inspection_id) VALUES($1,$2,$3,$4,now()+interval '6 hours',$5,$6) RETURNING id",[tenant.id,'Vardiya kapanış kontrolü: '+row.payload.sessionCode,qualityOwner.id,row.product_id,row.payload.overallStatus==='fail'?'high':'normal',row.id])).rows[0];
      await workflowAudit(client,tenant.id,qualityOwner.id,'task.created',task.id,null,{inspectionId:row.id});
      await notifyQuality(client,tenant.id,'Yeni operasyon görevi: '+row.payload.sessionCode,'task',task.id,qualityOwner.id);
    }
    return count;
  });
  console.log(`Operational demo records inserted: ${inserted}`);
}finally{
  await pool.end();
}
