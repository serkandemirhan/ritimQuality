import {readFileSync as read,writeFileSync as write,copyFileSync as copy} from 'node:fs';
const edit=(path,fn)=>write(path,fn(read(path,'utf8').replace(/\r\n/g,'\n')));
const adapter=`import { pool, withDatabase } from '../db/pool.js';
import type pg from 'pg';
const withTenant=<T>(tenantId:string,callback:(client:pg.PoolClient)=>Promise<T>)=>withDatabase((client,id)=>{if(id!==tenantId)throw new Error('Kurum kimliği geçersiz.');return callback(client);});`;
write('on-premise/server/services/push.ts',read('server/services/push.ts','utf8').replace("import { pool, withTenant } from '../db/pool.js';",adapter.replace("import type pg from 'pg';\n",'')));
write('on-premise/server/routes/push.ts',read('server/routes/push.ts','utf8').replace("import { withTenant } from '../db/pool.js';",adapter));
copy('server/db/migrations/006_push_notifications.sql','on-premise/server/db/migrations/006_push_notifications.sql');
copy('public/service-worker.js','on-premise/public/service-worker.js');
for(const file of ['InspectionQR','Onboarding','PushSettings'])write('on-premise/src/components/'+file+'.tsx',read('src/components/'+file+'.tsx','utf8').replaceAll('SaasApi','OnPremApi'));
edit('on-premise/package.json',s=>{const p=JSON.parse(s);const root=JSON.parse(read('package.json','utf8'));for(const name of ['qrcode','web-push'])p.dependencies[name]=root.dependencies[name];for(const name of ['@types/qrcode','@types/web-push'])p.devDependencies[name]=root.devDependencies[name];return JSON.stringify(p,null,2)+'\n';});
for(const prefix of ['', 'on-premise/']){
 const api=prefix?'OnPremApi':'SaasApi';
 edit(prefix+'server/index.ts',s=>"import { pushRouter } from './routes/push.js';\nimport { startNotificationWorker } from './services/push.js';\n"+s.replace("app.use('/api', workflowRouter);","app.use('/api', workflowRouter);\napp.use('/api', pushRouter);\nstartNotificationWorker();"));
 edit(prefix+'src/services/api.ts',s=>s.replace(`export const ${api} = {`,`export const ${api} = {
  pushConfig: () => request('/push/config'),
  subscribePush: (body:unknown) => request('/push/subscriptions',{method:'POST',body:JSON.stringify(body)}),
  unsubscribePush: () => request('/push/subscriptions',{method:'DELETE'}),`));
 edit(prefix+'src/components/WorkCenter.tsx',s=>"import { PushSettings } from './PushSettings';\n"+s.replace('  return <div className="space-y-4">','  return <div className="space-y-4">\n    <PushSettings/>'));
 edit(prefix+'src/App.tsx',s=>"import { Onboarding } from './components/Onboarding';\n"+s.replace("useState<NavTab>('operator')","useState<NavTab>(new URLSearchParams(window.location.search).get('view')==='work'?'work':'operator')").replace('        <PendingInspections', '        {currentUser.role === \'admin\' && <Onboarding products={products} plans={controlPlans} users={users} logs={inspectionLogs} onNavigate={setActiveTab}/>}\n        <PendingInspections'));
 edit(prefix+'src/components/OperatorStation.tsx',s=>"import { InspectionQR } from './InspectionQR';\n"+s.replace('{!isSessionActive && draftAvailable',`{!isSessionActive && <InspectionQR products={products} onSelect={(id,wo)=>{setSelectedProductId(id);setOrderNumber(wo);}}/>}
      {!isSessionActive && draftAvailable`).replace('if (!char) return;', 'if (!char || submissionRef.current) return;').replace('    const rejected=char.rejectedOptions||[];', '    if(submissionRef.current)return;\n    const rejected=char.rejectedOptions||[];').replace("const file=event.target.files?.[0]; if(!file||!currentCharacteristic) return;", "const file=event.target.files?.[0]; if(!file||!currentCharacteristic||submissionRef.current) return;")
   .replace('JSON.stringify({selectedProductId,selectedPlanId,', 'JSON.stringify({submission:submissionRef.current,selectedProductId,selectedPlanId,')
   .replace('equipmentId,draftKey]);', 'equipmentId,draftKey,saving]);')
   .replace('      restoredRef.current=true;', '      submissionRef.current=draft.submission||null;\n      restoredRef.current=true;')
   .replace('      {/* =========================================================================', '      {isSessionActive && submissionRef.current && !savedLog && <p role="status" className="my-2 rounded-lg bg-amber-50 p-3 text-sm">Bu ölçüm gönderim için kilitlendi. Kaydet düğmesi aynı kaydın gönderimini tekrar dener.</p>}\n      {/* ========================================================================='));
 edit(prefix+'src/components/ProductManagement.tsx',s=>s.replace("drawingUrl || SHAFT_BUSHING_SVG", "drawingUrl || ''").replace("        isActive: true,\n        status: 'active',", "        isActive: false,\n        status: 'draft',").replace("approvedBy: 'Üretim Müdürü'", "approvedBy: ''"));
 edit(prefix+'src/components/ControlPlanEditor.tsx',s=>s.replace("      isActive: true, // make new one default\n      status: 'active',", "      isActive: false,\n      status: 'draft',").replace("      isActive: productPlans.length === 0,\n      status: 'active',", "      isActive: false,\n      status: 'draft',").replace("approvedBy: 'Fabrika Müdürü'", "approvedBy: ''").replace('oluşturuldu ve aktif yapıldı!', 'taslak olarak oluşturuldu. Kontrol edip aktifleştirin.'));
}
