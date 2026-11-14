const assert=require('node:assert/strict'),{randomUUID}=require('crypto');
module.exports=async({call,ownerToken,aToken,tenantId,plan,product,check})=>{
 const user=await call('/platform/tenants/'+tenantId+'/users',ownerToken,'POST',{name:'Acceptance Auditor',email:'fix-auditor@example.invalid',role:'auditor',status:'active',password:'Local-test-password-123!',reason:'Verify auditor routing fix'},200);
 const auth=await call('/auth/login',null,'POST',{workspace:'factory-a',email:user.email,password:'Local-test-password-123!'});const token=auth.token;
 await call('/bootstrap',token);await call('/audit-logs',token);
 await call('/inspection-drafts',token,'GET',undefined,403);
 await call('/inspection-drafts/'+randomUUID()+'/claim',token,'POST',{},403);
 await call('/products/denied',token,'PUT',product,403);await call('/inspection-logs',token,'POST',{},403);await call('/approvals/denied',token,'POST',{},403);await call('/platform/tenants',token,'GET',undefined,403);
 check('QA001: Auditor bootstrap/audit allowed, draft and other writes denied');
 const p={...plan,id:'precision-fix',version:'fix-v1',characteristics:[{...plan.characteristics[0],precision:2}]};await call('/control-plans/'+p.id,aToken,'PUT',p);
 const make=value=>{const id=randomUUID();return{id,sessionCode:'INS-'+id,productId:product.id,controlPlanId:p.id,controlPlanVersion:p.version,operatorName:'Test',lotNumber:'LOT',orderNumber:'WO',machineNo:'QA',sampleCount:1,timestamp:new Date().toISOString(),samples:[{sampleIndex:1,values:{[p.characteristics[0].id]:value},statuses:{}}]};};
 await call('/inspection-logs',aToken,'POST',make(10.001),409);const saved=await call('/inspection-logs',aToken,'POST',make(10.01),201);assert.equal(saved.samples[0].values[p.characteristics[0].id],10.01);check('QA002: Classic excess precision rejected; valid precise measurement persisted');
 const dataUrl='data:image/png;base64,';const body={fileName:'valid.png',mimeType:'image/png',kind:'photo'};
 await call('/media',aToken,'POST',{...body,dataUrl:dataUrl+Buffer.from('not an actual PNG image').toString('base64')},400);
 const good=await call('/media',aToken,'POST',{...body,id:randomUUID(),dataUrl:dataUrl+'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHc8AAAAASUVORK5CYII='},201);assert.ok(good.id);check('QA003: Fake PNG rejected before saving, valid PNG accepted');
};
