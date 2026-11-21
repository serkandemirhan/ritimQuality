import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyBulkTolerance,applyBulkTool,deleteBulkPoints} from '../src/services/bulkPlan';
import type {ControlPlan} from '../src/types';
const plan={id:'p',characteristics:[{id:'a',pointNo:1,nominal:10,type:'numeric',tool:'Mikrometre 0.001'},{id:'b',pointNo:2,nominal:20,type:'numeric'},{id:'c',pointNo:3,nominal:0,type:'visual'}],characteristicImageLinks:[{id:'la',characteristicId:'a',imageId:'i',annotations:[{id:'pa',type:'pin',x:10,y:10,label:'#1'}]},{id:'lb',characteristicId:'b',imageId:'i',annotations:[{id:'pb',type:'pin',x:20,y:20,label:'#2'}]}]} as unknown as ControlPlan;
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
