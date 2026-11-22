import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyBulkTolerance,applyBulkTool,deleteBulkPoints,applyBulkCharacteristicPatch,commonCharacteristicValue} from '../src/services/bulkPlan';
import type {ControlPlan} from '../src/types';
const plan={id:'p',characteristics:[{id:'a',pointNo:1,nominal:10,type:'numeric',tool:'Mikrometre 0.001'},{id:'b',pointNo:2,nominal:20,type:'numeric'},{id:'c',pointNo:3,nominal:0,type:'visual'}],characteristicImageLinks:[{id:'la',characteristicId:'a',imageId:'i',annotations:[{id:'pa',type:'pin',x:10,y:10,label:'#1'}]},{id:'lb',characteristicId:'b',imageId:'i',annotations:[{id:'pb',type:'pin',x:20,y:20,label:'#2'}]}]} as unknown as ControlPlan;
const complete={...plan,characteristics:plan.characteristics.map((c,i)=>({...c,name:c.id,tolLower:i===0?.1:-.1,tolUpper:.1,lsl:c.nominal-.1,usl:c.nominal+.1,evidencePolicy:i===0?'none':'optional',policy:{minPhotos:i+1,maxPhotos:5,requireReview:i===0}}))} as ControlPlan;
test('bulk patch recalculates each nominal, overrides nominal only explicitly and preserves identities',()=>{
 const before=structuredClone(complete),next=applyBulkCharacteristicPatch(complete,['a','b'],{tolUpper:.2});
 assert.deepEqual(next.characteristics.slice(0,2).map(c=>[c.nominal,c.lsl,c.usl]),[[10,9.9,10.2],[20,19.9,20.2]]);
 const overridden=applyBulkCharacteristicPatch(next,['a','b'],{nominal:30});assert.deepEqual(overridden.characteristics.slice(0,2).map(c=>[c.lsl,c.usl]),[[29.9,30.2],[29.9,30.2]]);
 assert.equal(next.characteristics[2],complete.characteristics[2]);assert.equal(next.characteristicImageLinks,complete.characteristicImageLinks);
 assert.deepEqual(complete,before);assert.deepEqual(next.characteristics.map(c=>[c.id,c.name,c.pointNo]),complete.characteristics.map(c=>[c.id,c.name,c.pointNo]));
});
test('mixed values remain distinct until changed; common and nested policies update only selected fields',()=>{
 assert.equal(commonCharacteristicValue(complete.characteristics.slice(0,2),c=>c.nominal).mixed,true);
 assert.equal(commonCharacteristicValue(complete.characteristics.slice(0,2),c=>c.tolUpper).mixed,false);
 const next=applyBulkCharacteristicPatch(complete,['a','b'],{evidencePolicy:'none',policy:{requireComment:true}});
 assert.deepEqual(next.characteristics.slice(0,2).map(c=>c.evidencePolicy),['none','none']);assert.deepEqual(next.characteristics.map(c=>c.policy?.minPhotos),[1,2,3]);assert.deepEqual(next.characteristics.map(c=>c.policy?.requireReview),[true,false,false]);
 assert.equal(next.characteristics[2],complete.characteristics[2]);
});
test('incompatible or invalid numeric patches are atomic and reject rather than partially changing points',()=>{
 for(const patch of [{tolLower:.2},{tolUpper:-.1},{nominal:NaN},{precision:2.5},{resolution:0},{policy:{minPhotos:6}}])assert.throws(()=>applyBulkCharacteristicPatch(complete,['a','b'],patch));
 const mixed=applyBulkCharacteristicPatch(complete,['a','b','c'],{tolLower:-.3,evidencePolicy:'none'});
 assert.deepEqual(mixed.characteristics.slice(0,2).map(c=>[c.lsl,c.evidencePolicy]),[[9.7,'none'],[19.7,'none']]);
 assert.equal(mixed.characteristics[2].evidencePolicy,'none');assert.equal(mixed.characteristics[2].tolLower,complete.characteristics[2].tolLower);
 assert.throws(()=>applyBulkCharacteristicPatch(complete,['c'],{tolUpper:.2}));
 assert.throws(()=>applyBulkCharacteristicPatch(complete,['a','missing'],{evidencePolicy:'none'}));
 assert.throws(()=>applyBulkCharacteristicPatch(complete,['a','b'],{name:'overwrite'} as never));
 const precise=applyBulkCharacteristicPatch(complete,['a','b'],{tolLower:-.000001,tolUpper:.000002});assert.deepEqual(precise.characteristics.slice(0,2).map(c=>[c.lsl,c.usl]),[[9.999999,10.000002],[19.999999,20.000002]]);
 assert.doesNotThrow(()=>applyBulkCharacteristicPatch(complete,['a','c'],{evidencePolicy:'none'}));
});
test('choice option results merge per point and changing options prunes only obsolete decisions',()=>{
 const choices={...complete,characteristics:complete.characteristics.slice(0,2).map(c=>({...c,type:'single_select' as const,options:['A','B'],rejectedOptions:['B'],optionResults:{A:'pass' as const,B:'fail' as const}}))};
 const next=applyBulkCharacteristicPatch(choices,['a','b'],{optionResults:{A:'review'}});assert.deepEqual(next.characteristics[0].optionResults,{A:'review',B:'fail'});
 const options=applyBulkCharacteristicPatch(next,['a','b'],{options:['A','C','C']});assert.deepEqual(options.characteristics[0].options,['A','C']);assert.deepEqual(options.characteristics[0].rejectedOptions,[]);assert.deepEqual(options.characteristics[0].optionResults,{A:'review'});
 assert.throws(()=>applyBulkCharacteristicPatch(complete,['a','c'],{options:['A']}));
});
test('bulk tolerance uses each nominal and skips qualitative points',()=>{
 const result=applyBulkTolerance(plan,['a','b','c'],-.1,.1);
 assert.deepEqual(result.characteristics.slice(0,2).map(c=>[c.lsl,c.usl]),[[9.9,10.1],[19.9,20.1]]);
 assert.equal(result.characteristics[2],plan.characteristics[2]);
 assert.throws(()=>applyBulkTolerance(plan,['a'],.1,.1));
});
test('bulk tool and deletion affect only selected points and clean drawing links',()=>{
 assert.equal(applyBulkTool(plan,['a'],'Dijital Kumpas 0.01').characteristics[0].tool,'Dijital Kumpas 0.01');
 const result=deleteBulkPoints(plan,['a']);assert.deepEqual(result.characteristics.map(c=>c.pointNo),[1,2]);
 assert.equal(result.characteristicImageLinks?.length,1);assert.equal(result.characteristicImageLinks?.[0].annotations[0].label,'#1');
 assert.throws(()=>deleteBulkPoints(plan,['a','b','c']));
});
