import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInspection, assertRevisionUnchanged, inspectionSignature } from '../server/services/inspectionValidation.ts';
const plan={id:'p1',productId:'part1',version:'v1.0',status:'active',isActive:true,characteristics:[{id:'diameter',pointNo:1,name:'Çap',nominal:10,lsl:9,usl:11}]};
const input={id:'i1',productId:'part1',controlPlanId:'p1',controlPlanVersion:'v1.0',sampleCount:1,lotNumber:'LOT-1',orderNumber:'WO-1',samples:[{sampleIndex:1,values:{diameter:12},statuses:{diameter:'pass'}}]};
const actor={id:'u1',name:'Operator'};
test('optional point notes survive validation and remain bound to known points',()=>{
 const samples=[{sampleIndex:1,values:{diameter:12},pointNotes:{diameter:'Yüzeyde çizik'}}];
 assert.equal(validateInspection({...input,samples},plan,actor).samples[0].pointNotes?.diameter,'Yüzeyde çizik');
 assert.doesNotThrow(()=>validateInspection(input,plan,actor));
 for(const pointNotes of [{unknown:'Not'},{diameter:'x'.repeat(2001)}])assert.throws(()=>validateInspection({...input,samples:[{...samples[0],pointNotes}]},plan,actor));
});
test('server overrides forged pass results and binds actor and plan snapshot',()=>{
 const result=validateInspection({...input,operatorName:'Other',overallStatus:'pass'},plan,actor);
 assert.equal(result.overallStatus,'fail');assert.equal(result.failedPointsCount,1);assert.equal(result.operatorName,actor.name);assert.deepEqual(result.controlPlanSnapshot,plan);
});
test('rejects missing points, nonfinite values and unknown points',()=>{
 for(const values of [{},{diameter:null},{diameter:Infinity},{diameter:10,unknown:5}])assert.throws(()=>validateInspection({...input,samples:[{sampleIndex:1,values}]},plan,actor));
});
test('rejects foreign product, stale revision, archived plan and sample mismatch',()=>{
 for(const fields of [{productId:'other'},{controlPlanVersion:'v2.0'},{sampleCount:2}])assert.throws(()=>validateInspection({...input,...fields},plan,actor));
 assert.throws(()=>validateInspection(input,{...plan,isActive:false,status:'archived'},actor,{requireActivePlan:true,requireLotNumber:false,requireOrderNumber:false}));
});
test('required-on-fail evidence uses recalculated result',()=>{
 assert.throws(()=>validateInspection(input,{...plan,characteristics:[{...plan.characteristics[0],evidencePolicy:'required_on_fail'}]},actor));
});
test('qualitative selections are validated and rejected options fail',()=>{
 const c={...plan.characteristics[0],type:'single_select',options:['Clean','Scratch'],rejectedOptions:['Scratch']};
 assert.equal(validateInspection({...input,samples:[{sampleIndex:1,values:{diameter:'Scratch'}}]},{...plan,characteristics:[c]},actor).overallStatus,'fail');
 assert.throws(()=>validateInspection({...input,samples:[{sampleIndex:1,values:{diameter:'Unknown'}}]},{...plan,characteristics:[c]},actor));
});
test('used revision permits only lifecycle changes; JSON key order is irrelevant',()=>{
 assert.doesNotThrow(()=>assertRevisionUnchanged(plan,{...plan,isActive:false,status:'archived'}));
 assert.throws(()=>assertRevisionUnchanged(plan,{...plan,version:'v2'}));
 assert.throws(()=>assertRevisionUnchanged(plan,{...plan,characteristics:[{...plan.characteristics[0],usl:20}]}));
 assert.equal(inspectionSignature({a:1,b:{c:2,d:3}}),inspectionSignature({b:{d:3,c:2},a:1}));
 assert.notEqual(inspectionSignature(input),inspectionSignature({...input,lotNumber:'other'}));
});

test('inspection business rules independently enforce optional metadata and plan state', () => {
 const empty = {...input, lotNumber:'  ', orderNumber:''};
 const inactive = {...plan, isActive:false, status:'draft'};
 const optional = {requireActivePlan:false, requireLotNumber:false, requireOrderNumber:false};
 assert.doesNotThrow(() => validateInspection(empty, inactive, actor, optional));
 for (const key of Object.keys(optional)) {
   assert.throws(() => validateInspection(empty, inactive, actor, {...optional, [key]:true}));
 }
 assert.doesNotThrow(() => validateInspection({...empty, lotNumber:'LOT'}, inactive, actor, {...optional, requireLotNumber:true}));
 assert.doesNotThrow(() => validateInspection({...empty, orderNumber:'WO'}, inactive, actor, {...optional, requireOrderNumber:true}));
 assert.throws(() => validateInspection({...empty, lotNumber:'x'.repeat(121)}, plan, actor, optional));
});
