import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderedCharacteristics,orderedMeasurements} from '../src/services/measurementOrder';
import type {ControlPlan,SampleMeasurement} from '../src/types';
test('Detail and report use point numbers instead of JSON property order without mutating the plan',()=>{
 const plan={characteristics:[{id:'hole',pointNo:3},{id:'length',pointNo:1},{id:'width',pointNo:2}]} as ControlPlan;
 const sample:SampleMeasurement={sampleIndex:1,statuses:{},values:{length:100.02,hole:10.01,width:49.98}};
 assert.deepEqual(orderedCharacteristics(plan).map(c=>c.id),['length','width','hole']);
 assert.deepEqual(orderedMeasurements(sample,plan),[['length',100.02],['width',49.98],['hole',10.01]]);
 assert.equal(plan.characteristics[0].id,'hole');
});
test('Missing points remain visible and unrecognised legacy values are not discarded',()=>{
 const plan={characteristics:[{id:'a',pointNo:1},{id:'b',pointNo:2}]} as ControlPlan;
 const sample:SampleMeasurement={sampleIndex:1,statuses:{},values:{a:1,legacy:7}};
 assert.deepEqual(orderedMeasurements(sample,plan),[['a',1],['b',undefined],['legacy',7]]);
});
