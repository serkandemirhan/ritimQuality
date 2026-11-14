import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectionIssues} from '../src/services/inspectionIssues';
import type {Characteristic, SampleMeasurement} from '../src/types';

const point=(id:string, pointNo:number, evidencePolicy:Characteristic['evidencePolicy'])=>({id,pointNo,evidencePolicy,nominal:10,lsl:9,usl:11} as Characteristic);
const file=(mimeType:string)=>({id:mimeType,mimeType,fileName:'file',kind:'file',url:'',createdAt:''} as const);

test('reports missing or incorrect evidence for the relevant sample and point',()=>{
  const plan=[point('a',1,'photo_required'),point('b',3,'document_required')];
  const sample={sampleIndex:2,values:{a:10,b:10},statuses:{a:'pass',b:'pass'},evidence:{a:[file('application/pdf')],b:[file('image/jpeg')]}} as SampleMeasurement;
  const issues=inspectionIssues([sample],plan,'caliper');
  assert.deepEqual(issues.map(i=>[i.sample,i.pointNo,i.messages]),[[2,1,['Fotoğraf zorunludur.']],[2,3,['PDF belge zorunludur.']]]);
  sample.evidence={a:[file('image/png')],b:[file('application/pdf')]};
  assert.deepEqual(inspectionIssues([sample],plan,'caliper'),[]);
});

test('reports missing measurements and conditional evidence only for failed results',()=>{
  const plan=[point('a',1,'required_on_fail')];
  const sample={sampleIndex:1,values:{},statuses:{a:'empty'}} as SampleMeasurement;
  assert.deepEqual(inspectionIssues([sample],plan,'')[0].messages,['Ölçüm değeri girilmedi.']);
  sample.values.a=12;sample.statuses.a='fail';
  assert.deepEqual(inspectionIssues([sample],plan,'')[0].messages,['Kanıt dosyası zorunludur.']);
  sample.statuses.a='pass';assert.deepEqual(inspectionIssues([sample],plan,''),[]);
});
