// Real API regression suite. Requires the isolated lifecycle test server and fixture.
// Tokens remain in .runtime and are never included in reports.
const fs=require('node:fs');const {randomUUID}=require('node:crypto');const assert=require('node:assert/strict');
const session=JSON.parse(fs.readFileSync('.runtime/lifecycle/session.json','utf8'));
const out='reports/control-lifecycle-review';fs.mkdirSync(out,{recursive:true});
const checks=[];
async function api(role,path,method='GET',body,status){
 const response=await fetch('http://127.0.0.1:3420/api/'+path,{method,headers:{Authorization:'Bearer '+session.users.find(u=>u.role===role).token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const text=await response.text();const data=text?JSON.parse(text):null;
 if(status)assert.equal(response.status,status,JSON.stringify(data));else assert.ok(response.ok,`${path}: ${response.status} ${text}`);
 return data;
}
(async()=>{
 const boot=await api('admin','bootstrap');const base=boot.controlPlans.find(p=>p.characteristics.length===3);assert.ok(base);
 const plan={...base,balloonMode:'embedded',id:'regression-'+randomUUID(),version:'test-'+Date.now(),isActive:true,status:'active',requiresApproval:false,characteristicImageLinks:undefined,characteristics:base.characteristics.map((c,i)=>({...c,pin:[{x:65,y:9.33},{x:10.33,y:68.33},{x:59.17,y:34.67}][i],policy:{...c.policy,requireReview:false,requireSupervisorApproval:false}}))};
 await api('admin','control-plans/'+plan.id,'PUT',plan);checks.push('Ayrık balonlu yeni kontrol planı kaydedildi.');
 const duplicateId=randomUUID();await api('admin','control-plans/'+duplicateId,'PUT',{...plan,id:duplicateId},409);checks.push('Aynı sürümün ikinci plan olarak kaydı reddediliyor.');
 const request={planId:plan.id,orderNumber:'TEST-İE-'+Date.now(),lotNumber:'TEST-LOT',sampleCount:1};
 const task=await api('admin','tasks','POST',{title:'Otomatik akış doğrulama',ownerId:session.users.find(u=>u.role==='operator').id,productId:plan.productId,dueAt:new Date(Date.now()+86400000).toISOString(),request});
 assert.equal(task.request_context.planVersion,plan.version);
 await api('operator',`tasks/${task.id}/complete`,'POST',{note:'Ölçüm olmadan kapatma denemesi'},409);checks.push('Ölçüm isteği sonuç kaydı olmadan kapatılamıyor.');
 const original=boot.inspectionLogs.find(l=>l.productId===plan.productId&&!l.mobileMeasurement);assert.ok(original);
 const log={...original,id:randomUUID(),sessionCode:'REG-'+randomUUID(),timestamp:new Date().toISOString(),controlPlanId:plan.id,controlPlanVersion:plan.version,controlPlanSnapshot:plan,taskId:task.id,orderNumber:request.orderNumber,lotNumber:request.lotNumber};
 delete log.requestSignature;delete log.draftId;
 await api('admin','inspection-logs','POST',{...log,id:randomUUID(),sessionCode:'REG-'+randomUUID()},409);checks.push('Başka kullanıcı atanmış isteği tamamlayamıyor.');
 await api('operator','inspection-logs','POST',{...log,id:randomUUID(),sessionCode:'REG-'+randomUUID(),lotNumber:'YANLIŞ'},409);checks.push('Yanlış parti ile ölçüm kaydı reddediliyor.');
 const before=await api('admin','work');const created=await api('operator','inspection-logs','POST',log);assert.match(created.controlNumber,/^KNT-\d+$/);const repeated=await api('operator','inspection-logs','POST',log);
 assert.equal(created.controlNumber,repeated.controlNumber);checks.push('Kısa kontrol numarası sunucuda atanıyor ve tekrar gönderimde korunuyor.');
 const after=await api('admin','work'),saved=after.tasks.find(t=>t.id===task.id);assert.ok(saved.completed_at);assert.equal(saved.result_inspection_id,log.id);assert.equal(after.notifications.filter(n=>n.entity_id===log.id&&n.kind==='inspection').length,1);
 checks.push('Ölçüm ve görev birlikte tamamlandı; tekrar gönderim ikinci bildirim üretmedi.');
 await api('operator','inspection-logs','POST',{...log,id:randomUUID(),sessionCode:'REG-'+randomUUID()},409);checks.push('Aynı görev ikinci ölçümle kapatılamıyor.');
 const noTask={...log,id:randomUUID(),sessionCode:'REG-'+randomUUID(),taskId:undefined};await api('operator','inspection-logs','POST',noTask);const final=await api('admin','work');assert.ok(final.notifications.some(n=>n.entity_id===noTask.id&&n.kind==='inspection'));checks.push('Görev ve onay gerektirmeyen ölçüm de yöneticiye bildiriliyor.');
 fs.writeFileSync('.runtime/lifecycle/regression.json',JSON.stringify({plan,request,task,log}));fs.writeFileSync(out+'/api-verification.json',JSON.stringify({at:new Date().toISOString(),checks,taskId:task.id,inspectionId:log.id},null,2));console.log('PASS: '+checks.length+' real API regression checks.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
