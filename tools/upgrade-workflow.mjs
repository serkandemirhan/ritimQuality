import {readFileSync as read,writeFileSync as write,copyFileSync as copy} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
copy('server/db/migrations/005_quality_workflow.sql','on-premise/server/db/migrations/005_quality_workflow.sql');
copy('server/services/workflow.ts','on-premise/server/services/workflow.ts');
edit('server/routes/workflow.ts',s=>"import { assertSubscription } from '../services/access.js';\n"+s.replace('workflowRouter.use(requireAuth);',`workflowRouter.use(requireAuth);
workflowRouter.use(async(req,res,next)=>{try{if(req.method!=='GET' && !req.path.startsWith('/notifications'))await withTenant(req.auth!.tenantId,client=>assertSubscription(client,req.auth!.tenantId));next();}catch(error){next(error);}});`));
let local=read('server/routes/workflow.ts','utf8').replace("import { assertSubscription } from '../services/access.js';\n",'').replace(/workflowRouter.use\(async\(req,res,next\)=>\{try\{if\(req.method[^\n]+\n/,'');
local=local.replace("import { withTenant } from '../db/pool.js';", `import { withDatabase } from '../db/pool.js';
import type pg from 'pg';
const withTenant=<T>(tenantId:string,callback:(client:pg.PoolClient)=>Promise<T>)=>withDatabase((client,id)=>{if(id!==tenantId)throw new Error('Kurum kimliği geçersiz.');return callback(client);});`);
write('on-premise/server/routes/workflow.ts',local);
for(const prefix of ['', 'on-premise/']){
  const api=prefix?'OnPremApi':'SaasApi';
  edit(prefix+'server/index.ts',s=>"import { workflowRouter } from './routes/workflow.js';\n"+s.replace("app.use('/api/auth', authRouter);","app.use('/api/auth', authRouter);\napp.use('/api', workflowRouter);"));
  edit(prefix+'server/routes/'+(prefix?'app.ts':'saas.ts'),s=>"import { createInspectionWorkflow } from '../services/workflow.js';\n"+s.replace(prefix?"      await audit(client,{userId:req.auth!.userId,action:'inspection.created'":"      await audit(client, { tenantId, userId, action: 'inspection.created'",`      await createInspectionWorkflow(client,tenantId,${prefix?'req.auth!.userId':'userId'},payload);\n`+(prefix?"      await audit(client,{userId:req.auth!.userId,action:'inspection.created'":"      await audit(client, { tenantId, userId, action: 'inspection.created'")));
  edit(prefix+'src/types.ts',s=>s.replace('export interface ControlPlan {','export interface ControlPlan {\n  requiresApproval?: boolean;'));
  edit(prefix+'src/services/api.ts',s=>s.replace(`export const ${api} = {`,`export const ${api} = {
  work: () => request('/work'),
  auditLogs: () => request('/audit-logs'),
  updateCase: (id:string,body:unknown) => request('/cases/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(body)}),
  readNotification: (id:number) => request('/notifications/'+id+'/read',{method:'PATCH'}),
  createTask: (body:unknown) => request('/tasks',{method:'POST',body:JSON.stringify(body)}),
  completeTask: (id:string,note:string) => request('/tasks/'+encodeURIComponent(id)+'/complete',{method:'POST',body:JSON.stringify({note})}),
  reviewInspection: (id:string,status:'approved'|'rejected',reason:string) => request('/approvals/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({status,reason})}),
  organization: () => request('/organization'),
  createOrganization: (body:unknown) => request('/organization',{method:'POST',body:JSON.stringify(body)}),`));
  edit(prefix+'src/components/Navbar.tsx',s=>s.replace("export type NavTab = ","export type NavTab = 'work' | ").replace('  const navItems: NavItem[] = [',`  const navItems: NavItem[] = [
    {id:'work',label:'İşlerim',description:'Bildirimler, uygunsuzluk ve onay',icon:<ClipboardCheck className="h-4 w-4"/>,allowedRoles:['admin','quality_engineer','operator','auditor'],group:'Operasyon'},`));
  edit(prefix+'src/App.tsx',s=>"import { WorkCenter } from './components/WorkCenter';\n"+s
    .replace('  const [products, setProducts]',"  const [inspectionProductId,setInspectionProductId] = useState('');\n  const [products, setProducts]")
    .replace("  const handleSelectProductForInspection = (productId: string) => {\n    setActiveTab('operator');", "  const handleSelectProductForInspection = (productId: string) => {\n    setInspectionProductId(productId);\n    setActiveTab('operator');")
    .replace("    operator: { title:","    work: {title:'İşlerim',description:'Uygunsuzluk, görev ve onay yönetimi.'},\n    operator: { title:")
    .replace("        {activeTab === 'operator' && (", "        {activeTab === 'work' && <WorkCenter users={users} products={products} currentUser={currentUser} onInspect={handleSelectProductForInspection}/>}\n        {activeTab === 'operator' && (")
    .replace('          <OperatorStation\n','          <OperatorStation\n            initialProductId={inspectionProductId}\n'));
  edit(prefix+'src/components/OperatorStation.tsx',s=>s.replace('interface OperatorStationProps {','interface OperatorStationProps {\n  initialProductId?: string;').replace('  products,\n  controlPlans,','  initialProductId,\n  products,\n  controlPlans,').replace("useState<string>(products[0]?.id || '')","useState<string>(initialProductId || new URLSearchParams(window.location.search).get('product') || products[0]?.id || '')").replace("useState<string>('');\n  const [machineNo", "useState<string>(new URLSearchParams(window.location.search).get('wo') || '');\n  const [machineNo"));
  edit(prefix+'src/components/ControlPlanEditor.tsx',s=>s.replace('      {/* Top Header Card */}', `      {currentPlan && <label className="flex items-center gap-3 rounded-xl border bg-white p-4"><input type="checkbox" checked={Boolean(currentPlan.requiresApproval)} onChange={event=>setCurrentPlan({...currentPlan,requiresApproval:event.target.checked})}/>Bu planla tamamlanan kontroller kalite onayı gerektirsin</label>}
      {/* Top Header Card */}`));
}
write('on-premise/src/components/WorkCenter.tsx',read('src/components/WorkCenter.tsx','utf8').replaceAll('SaasApi','OnPremApi'));
