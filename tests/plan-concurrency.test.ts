import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectionSignature} from '../server/services/inspectionValidation';
import {assertPlanPreconditions} from '../server/services/planConcurrency';
import {drawingRevisionStatus} from '../src/services/drawingRevision';
import type {ControlPlan,Product} from '../src/types';
test('stale plan edit and active-plan change are rejected',()=>{
 const plan={id:'p',version:'v1',value:1},token=inspectionSignature(plan);
 assert.doesNotThrow(()=>assertPlanPreconditions(plan,token,'active','active'));
 assert.throws(()=>assertPlanPreconditions({...plan,value:2},token,'active','active'),/başka bir kullanıcı/);
 assert.throws(()=>assertPlanPreconditions(plan,token,'other','active'),/Aktif plan/);
 assert.doesNotThrow(()=>assertPlanPreconditions(undefined,'missing','none','none'));
 assert.throws(()=>assertPlanPreconditions(plan,'missing','none','none'));
});
test('drawing revision never infers a match when metadata is missing',()=>{
 const product={images:[{id:'img',revision:'B',url:'image'}]} as Product;
 const plan={drawingRevision:'A',drawingImageUrl:'image'} as ControlPlan;
 assert.equal(drawingRevisionStatus(plan,product).mismatch,true);
 assert.equal(drawingRevisionStatus({...plan,drawingRevision:'B'},product).mismatch,false);
 assert.equal(drawingRevisionStatus({...plan,drawingRevision:undefined},product).unverified,true);
 assert.equal(drawingRevisionStatus(plan,{images:[]} as Product).unverified,true);
});
