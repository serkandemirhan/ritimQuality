import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateInspection} from '../server/services/inspectionValidation.js';

const plan={id:'plan',productId:'part',version:'v1.0',status:'active',isActive:true,characteristics:[{id:'point',pointNo:1,name:'Çap',nominal:10,lsl:9,usl:11}]};
const actor={id:'operator',name:'Operatör'};
function input(count:number){
  const samples=Array.from({length:count},(_,i)=>({sampleIndex:i+1,values:{point:10}}));
  const attempts=samples.map(s=>({id:randomUUID(),sample:s.sampleIndex,characteristic:'point',raw:'10',mode:'absolute',value:10,result:'pass',comment:'',reason:'',retryReason:'',photos:[],operatorId:actor.id,measuredAt:new Date().toISOString(),source:'manual',instrumentId:''}));
  return {productId:'part',controlPlanId:'plan',controlPlanVersion:'v1.0',controlPlanSnapshot:plan,sampleCount:count,samples,mobileMeasurement:{version:1,attempts}};
}
test('mobile measurement validates 6, 20 and 100 samples; rejects 101',()=>{
  for(const count of [6,20,100])assert.equal(validateInspection(input(count),plan,actor).samples.length,count);
  assert.throws(()=>validateInspection(input(101),plan,actor));
});
