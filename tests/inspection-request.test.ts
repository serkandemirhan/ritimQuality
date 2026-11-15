import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {completeInspectionRequest} from '../server/services/inspectionRequest';

test('task allows a changed sample count while retaining request and actual counts in audit',async()=>{
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const request={planId:'plan',planVersion:'v1',orderNumber:'WO',lotNumber:'LOT',sampleCount:3};
 const task={id,owner_id:'user',product_id:'part',completed_at:null,request_context:request};
 const writes:{sql:string;args:unknown[]}[]=[];
 const client={query:async(sql:string,args:unknown[])=>{writes.push({sql,args});return {rows:sql.startsWith('SELECT')?[task]:[]};}} as unknown as pg.PoolClient;
 const payload={id:'inspection',taskId:id,productId:'part',controlPlanId:'plan',controlPlanVersion:'v1',orderNumber:'WO',lotNumber:'LOT',sampleCount:5};
 await completeInspectionRequest(client,'tenant','user',payload);
 assert.deepEqual(writes.at(-1)?.args.at(-1),{inspectionId:'inspection',requestedSampleCount:3,measuredSampleCount:5});
 await assert.rejects(()=>completeInspectionRequest(client,'tenant','user',{...payload,orderNumber:'other'}));
});
