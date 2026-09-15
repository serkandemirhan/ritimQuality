import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {pool} from '../server/db/pool.js';
import {INITIAL_PRODUCTS,INITIAL_CONTROL_PLANS} from '../src/data/mockData.js';
import {validateInspection} from '../server/services/inspectionValidation.js';
import {createInspectionWorkflow,workflowAudit} from '../server/services/workflow.js';

// Explicit provisioning only: never seed an ordinary customer's registration.
const workspace=process.env.DEMO_WORKSPACE||'sales-demo';
const password=process.env.DEMO_PASSWORD;
if(!/^[a-z0-9][a-z0-9-]*-demo$/.test(workspace)||!password||password.length<10) {
  await pool.end();throw new Error('DEMO_WORKSPACE must end with -demo and DEMO_PASSWORD must have at least 10 characters.');
}
const client=await pool.connect();
try {
  await client.query('BEGIN');
  const exists=await client.query('SELECT id FROM tenants WHERE slug=$1',[workspace]);
  if(exists.rowCount)throw new Error('Workspace already exists. No data was changed; use a new demo workspace.');
  const tenantId=randomUUID();
  await client.query("INSERT INTO tenants(id,slug,name,legal_name,contact_email,plan_id,subscription_status,billing_source) VALUES($1,$2,'Ritim Demo İmalat','Ritim Demo İmalat','demo@example.com','pro','trial','manual')",[tenantId,workspace]);
  await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  const users=[{id:randomUUID(),name:'Demo Yönetici',email:'admin@example.com',role:'admin'},{id:randomUUID(),name:'Kalite Uzmanı',email:'quality@example.com',role:'quality_engineer'},{id:randomUUID(),name:'Operatör 01',email:'operator01@example.com',role:'operator'}];
  const hash=await bcrypt.hash(password,12);
  for(const user of users)await client.query("INSERT INTO users(id,tenant_id,name,email,password_hash,role,station_or_machine) VALUES($1,$2,$3,$4,$5,$6,'CNC-01')",[user.id,tenantId,user.name,user.email,hash,user.role]);
  const products=INITIAL_PRODUCTS.map((p,i)=>({...p,id:randomUUID(),name:['Hassas Şaft','Alüminyum Flanş','Konnektör Gövdesi'][i],customer:'Demo Müşteri',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
  const plans=products.map((p,i)=>({...INITIAL_CONTROL_PLANS.find(plan=>plan.productId===INITIAL_PRODUCTS[i].id&&plan.isActive)!,id:randomUUID(),productId:p.id,requiresApproval:true,author:'Kalite Uzmanı',approvedBy:'Demo Yönetici'}));
  for(const product of products)await client.query('INSERT INTO products(id,tenant_id,code,name,payload) VALUES($1,$2,$3,$4,$5)',[product.id,tenantId,product.code,product.name,product]);
  for(const plan of plans)await client.query('INSERT INTO control_plans(id,tenant_id,product_id,version,status,is_active,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[plan.id,tenantId,plan.productId,plan.version,plan.status,plan.isActive,plan]);
  for(let i=0;i<48;i++) {
    const product=products[i%3],plan=plans[i%3],id=randomUUID();
    const timestamp=new Date(Date.now()-i*12*3600000).toISOString();
    const samples=Array.from({length:5},(_,n)=>({sampleIndex:n+1,values:Object.fromEntries(plan.characteristics.map((c,index)=>[c.id,i%8===0&&n===4&&index===0?c.usl+(c.usl-c.lsl)*.1:c.nominal+Math.sin(i+n+index)*(c.usl-c.lsl)*.1]))}));
    const log=validateInspection({id,sessionCode:`DEMO-${String(i+1).padStart(3,'0')}`,productId:product.id,productCode:product.code,productName:product.name,controlPlanId:plan.id,controlPlanVersion:plan.version,timestamp,sampleCount:5,samples,lotNumber:`DEMO-LOT-${i+1}`,orderNumber:`DEMO-WO-${i+1}`,machineNo:'CNC-01'},plan,users[2]);
    await client.query('INSERT INTO inspection_logs(id,tenant_id,product_id,control_plan_id,session_code,occurred_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,tenantId,product.id,plan.id,`DEMO-${String(i+1).padStart(3,'0')}`,timestamp,log]);
    await createInspectionWorkflow(client,tenantId,users[2].id,log);
  }
  const cases=(await client.query('SELECT id FROM quality_cases WHERE tenant_id=$1 ORDER BY created_at LIMIT 3',[tenantId])).rows;
  for(let i=0;i<3;i++)await client.query("INSERT INTO quality_tasks(tenant_id,title,owner_id,product_id,case_id,priority,due_at) VALUES($1,$2,$3,$4,$5,$6,now()+($7||' days')::interval)",[tenantId,['Takım aşınmasını incele','İlk parça kontrolünü doğrula','Ölçüm cihazını kontrol et'][i],users[1].id,products[i].id,cases[i]?.id||null,['high','normal','critical'][i],i-1]);
  const plant=(await client.query("INSERT INTO plants(tenant_id,name) VALUES($1,'Demo Tesis') RETURNING id",[tenantId])).rows[0];
  const department=(await client.query("INSERT INTO departments(tenant_id,plant_id,name) VALUES($1,$2,'Talaşlı İmalat') RETURNING id",[tenantId,plant.id])).rows[0];
  await client.query("INSERT INTO stations(tenant_id,department_id,name) VALUES($1,$2,'CNC-01')",[tenantId,department.id]);
  await workflowAudit(client,tenantId,users[0].id,'demo.provisioned',tenantId,null,{products:3,plans:3,inspections:48,tasks:3});
  await client.query('COMMIT');
  console.log(`Demo ready: ${workspace}; admin@example.com, quality@example.com, operator01@example.com. Password: supplied DEMO_PASSWORD.`);
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
