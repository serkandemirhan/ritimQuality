import {SPCEngine} from '../src/services/spcEngine';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDay,cellQuality,revisionLabel} from '../src/services/presentation';
import {analyzeInspectionReport,reportRowStatusLabel} from '../src/services/reportAnalysis';
import {validateInspection} from '../server/services/inspectionValidation';
import type {InspectionLog,Characteristic} from '../src/types';
test('Istanbul local day includes UTC evening in next local day',()=>{assert.equal(localDay('2026-11-22T21:30:00Z'),'2026-11-23');assert.equal(localDay('2026-11-22T20:59:59Z'),'2026-11-22');});
test('special quality results stay distinct in historic records and reports',()=>{for(const quality of ['review','unclassified','na'] as const){const sample={sampleIndex:1,values:{p:quality==='na'?'__NA__':'SUSPECT'},statuses:{p:'warning' as const}};const log={samples:[sample],mobileMeasurement:{attempts:[{sample:1,characteristic:'p',result:quality}]}} as unknown as InspectionLog;assert.equal(cellQuality(sample,'p',log),quality);const analysis=analyzeInspectionReport(log,[{id:'p',pointNo:1,name:'Visual',type:'visual',unit:''} as unknown as Characteristic]);assert.equal(analysis.rows[0].status,quality==='na'?'not_applicable':quality);assert.notEqual(reportRowStatusLabel(analysis.rows[0].status),'UYGUN');assert.notEqual(analysis.status,'conforming');}});
test('revision labels preserve official versions and shorten only legacy generated identities',()=>{assert.equal(revisionLabel('v1.2'),'v1.2');assert.match(revisionLabel('android-1794144841109'),/^Eski revizyon/);});

test('operators with equal names are isolated by stable identity',()=>{const char={id:'p',pointNo:1,name:'Çap',type:'numeric',nominal:10,lsl:9,usl:11} as unknown as Characteristic;const logs=['one','two'].map((id,i)=>({operatorName:'Aynı İsim',operatorUserId:id,timestamp:'2026-11-22T12:00:00Z',samples:[{sampleIndex:1,values:{p:10+i*.1},statuses:{p:'pass'}}]})) as unknown as InspectionLog[];assert.equal(SPCEngine.calculateMetric(char,logs,{operatorKey:'one'})?.count,1);assert.equal(SPCEngine.calculateMetric(char,logs,{operator:'Aynı İsim'})?.count,2);});
