import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {evaluateMeasurement,evidenceErrors,orderedCells} from '../server/services/measurementCore.ts';
import {validateInspection} from '../server/services/inspectionValidation.ts';
const c={id:'c1',pointNo:1,name:'Çap',type:'numeric',nominal:18.5,lsl:18.4,usl:18.6,precision:3};
test('strict numeric input and inclusive boundaries',()=>{
 for(const raw of ['', ' ', '-', '.', '18,', '18,,5','18.5.2','1e2','18.5001'])assert.throws(()=>evaluateMeasurement(c,raw),raw);
 for(const raw of ['18.40','18,60','18.52'])assert.equal(evaluateMeasurement(c,raw).result,'pass');
 assert.equal(evaluateMeasurement(c,'18.67').result,'fail');
 assert.equal(evaluateMeasurement(c,'+0.030','delta').canonical,'18.53');
 assert.throws(()=>evaluateMeasurement({...c,allowNegative:false},'-1'));
 assert.throws(()=>evaluateMeasurement({...c,resolution:.01},'18.501'));
});
test('250 cells and both traversal orders use the same identities',()=>{
 const chars=Array.from({length:50},(_,i)=>'c'+i);
 const sample=orderedCells(chars,5,'sample');const characteristic=orderedCells(chars,5,'characteristic');
 assert.equal(sample.length,250);assert.deepEqual(sample[50],{sample:2,characteristic:'c0'});
 assert.deepEqual(characteristic[5],{sample:1,characteristic:'c1'});
 assert.deepEqual(new Set(sample.map(v=>JSON.stringify(v))),new Set(characteristic.map(v=>JSON.stringify(v))));
});
test('plan-defined boolean meaning, suspect and text stay distinct',()=>{
 assert.equal(evaluateMeasurement({...c,type:'boolean',optionResults:{yes:'fail',no:'pass'}},'yes').result,'fail');
 assert.equal(evaluateMeasurement({...c,type:'boolean'},'yes').result,'unclassified');
 assert.equal(evaluateMeasurement({...c,type:'visual'},'SUSPECT').result,'review');
 assert.equal(evaluateMeasurement({...c,type:'text'},'Parça kontrol edildi').result,'unclassified');
 assert.throws(()=>evaluateMeasurement({...c,type:'text'},'  '));
});
test('one-sided limits and N/A do not invent a pass decision',()=>{
 assert.equal(evaluateMeasurement({...c,lsl:undefined},'0').result,'pass');
 assert.equal(evaluateMeasurement({...c,usl:undefined},'100').result,'pass');
 assert.throws(()=>evaluateMeasurement(c,'__NA__'));
 assert.equal(evaluateMeasurement({...c,policy:{allowNA:true}},'__NA__').result,'na');
 assert.equal(evidenceErrors({...c,policy:{allowNA:true}},'na',[],'','').length,1);
});
test('evidence count and reason come from the plan',()=>{
 const definition={...c,policy:{minPhotos:2,requireComment:true,requireReason:true,reasons:['Çizik']}};
 assert.equal(evidenceErrors(definition,'fail',[{mimeType:'image/png'}],'','').length,3);
 assert.deepEqual(evidenceErrors(definition,'fail',[{mimeType:'image/png'},{mimeType:'image/jpeg'}],'İz var','Çizik'),[]);
 assert.deepEqual(evidenceErrors(definition,'pass',[],'',''),[]);
 assert.deepEqual(evidenceErrors(c,'fail',[],'',''),[]);
});
const plan={id:'p',productId:'part',version:'v1',status:'active',isActive:true,characteristics:[c]};
const actor={id:'user',name:'Operatör'};
const attempt=(raw:string,previousAttemptId?:string)=>({id:randomUUID(),sample:1,characteristic:c.id,raw,mode:'absolute',...evaluateMeasurement(c,raw),comment:'',reason:'',retryReason:previousAttemptId?'Tekrar doğrulama':'',photos:[],previousAttemptId,operatorId:actor.id,measuredAt:new Date().toISOString(),source:'manual',instrumentId:'gauge'});
const payload=(attempts:ReturnType<typeof attempt>[])=>({productId:plan.productId,controlPlanId:plan.id,controlPlanVersion:plan.version,controlPlanSnapshot:plan,sampleCount:1,samples:[{sampleIndex:1,values:{c1:attempts.at(-1)!.value}}],mobileMeasurement:{version:1,attempts}});
test('retake preserves historical NOK and requires review after passing last attempt',()=>{
 const first=attempt('18.67');const second=attempt('18.52',first.id);
 const result=validateInspection(payload([first,second]),plan,actor) as any;
 assert.equal(result.overallStatus,'pass');assert.equal(result.hasHistoricalFailure,true);assert.equal(result.requiresReview,true);
 assert.equal(result.mobileMeasurement.attempts.length,2);
 assert.throws(()=>validateInspection(payload([first,{...second,previousAttemptId:undefined}]),plan,actor));
 assert.throws(()=>validateInspection(payload([first,{...second,retryReason:''}]),plan,actor));
 assert.throws(()=>validateInspection(payload([first,{...second,operatorId:'other'}]),plan,actor));
});
test('server rejects revision content mismatch and forged values, reevaluates quality',()=>{
 const a=attempt('18.6');
 assert.throws(()=>validateInspection(payload([a]),{...plan,characteristics:[{...c,usl:19}]},actor));
 assert.throws(()=>validateInspection(payload([{...a,value:18.5}]),plan,actor));
 assert.equal(validateInspection(payload([{...a,result:'fail'}]),plan,actor).overallStatus,'pass');
});
