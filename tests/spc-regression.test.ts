import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SPCEngine,selectPlanLogs} from '../src/services/spcEngine';
import {formatSpcMeasurement,formatCapability} from '../src/services/spcFormat';
import type {Characteristic,ControlPlan,InspectionLog} from '../src/types';

const characteristic={id:'point',name:'Diameter',pointNo:1,nominal:10,lsl:9,usl:11,unit:'mm'} as Characteristic;
const plan={id:'plan',productId:'product',version:'v1.0',characteristics:[characteristic]} as ControlPlan;
const log=(id:string,values:unknown[],patch:Partial<InspectionLog>={},statuses?:string[]):InspectionLog=>({id,productId:'product',controlPlanId:'plan',controlPlanVersion:'v1.0',timestamp:'2026-11-10T10:00:00Z',operatorName:'Operator',lotNumber:'LOT',samples:values.map((value,i)=>({sampleIndex:i+1,values:{point:value},statuses:{point:statuses?.[i]||'pass'}})),...patch} as InspectionLog);
const metric=(logs:InspectionLog[],char=characteristic)=>SPCEngine.calculateMetric(char,logs)!;
const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test('product, plan and revision scope isolates shared characteristic IDs',()=>{
 const current=log('current',[9.9,10.1]);
 const logs=[current,log('old',[19.9,20.1],{controlPlanVersion:'v0.9'}),log('foreign',[100,101],{productId:'other'}),log('other-plan',[200,201],{controlPlanId:'other'})];
 assert.deepEqual(selectPlanLogs(plan,logs),[current]);
 const [result]=SPCEngine.calculateAllForPlan(plan,logs);assert.equal(result.count,2);assert.equal(result.mean,10);
});
test('empty, missing, nonnumeric and nonfinite values are excluded everywhere; real zero remains',()=>{
 const input=log('mixed',[0,0,10,NaN,Infinity,null,'12',undefined,11],{},['empty','pass','pass','pass','pass','pass','pass','pass','empty']);
 delete input.samples[2].statuses.point;
 const result=metric([input]);assert.equal(result.count,1);assert.equal(result.mean,0);assert.equal(result.historyValues[0].sampleIndex,2);assert.equal(result.historyValues[0].status,'fail');assert.equal(result.outOfSpecCount,1);
 assert.equal(result.histogramBins.reduce((n,b)=>n+b.count,0),1);assert.equal(result.imr.points.length,1);assert.equal(result.xbarR,null);
});
test('numeric status is recalculated against limits; genuine warnings remain',()=>{
 const result=metric([log('stale',[12,10],{},['pass','warning'])]);
 assert.deepEqual(result.historyValues.map(p=>p.status),['fail','warning']);assert.equal(result.outOfSpecCount,1);
});
test('filters and chronological order apply to all analyses without mutating inputs',()=>{
 const a=log('a',[9.8,10],{timestamp:'2026-11-10T11:00:00Z',lotNumber:'A'}),b=log('b',[10.1,10.2],{timestamp:'2026-11-10T10:00:00Z',lotNumber:'B'});
 const input=[a,b],result=SPCEngine.calculateMetric(characteristic,input,{lotNumber:'A'})!;assert.equal(result.count,2);assert.equal(result.historyValues[0].lotNumber,'A');assert.deepEqual(input,[a,b]);
 assert.equal(metric(input).historyValues[0].lotNumber,'B');
});
test('single-sample sessions use I-MR, never Xbar-R constants for n=2',()=>{
 const result=metric([log('a',[9.9]),log('b',[10.1])]);assert.equal(result.xbarR,null);assert.match(result.xbarRUnavailableReason!,/Tek numuneli/);near(result.imr.movingRangeAverage,.2);near(result.imr.individualUcl,10.532);
});
test('equal groups have exact supported Xbar-R limits',()=>{
 const result=metric([log('a',[9,11]),log('b',[10,12])]);assert.equal(result.xbarR!.subgroupSize,2);near(result.xbarR!.xbarbar,10.5);near(result.xbarR!.rbar,2);near(result.xbarR!.xbarUcl,14.26);near(result.xbarR!.rUcl,6.534);
});
test('mixed group sizes, n>10 and only one group never produce Xbar-R limits',()=>{
 for(const logs of [[log('a',[9,10]),log('b',[9,10,11])],[log('a',Array(11).fill(10)),log('b',Array(11).fill(10.1))],[log('one',[9,10,11])]]){assert.equal(metric(logs).xbarR,null);assert.ok(metric(logs).xbarRUnavailableReason);}
});
test('constant data retain count, descriptive statistics, histogram and history; capability is undefined',()=>{
 const result=metric([log('constant',[10,10,10])]);assert.equal(result.count,3);assert.equal(result.mean,10);assert.equal(result.stdDev,0);assert.equal(result.min,10);assert.equal(result.max,10);assert.equal(result.historyValues.length,3);assert.equal(result.histogramBins.reduce((n,b)=>n+b.count,0),3);
 for(const key of ['cp','cpk','cpu','cpl','pp','ppk'] as const)assert.equal(result[key],null);
 assert.equal(result.capabilityStatus,'unavailable');assert.match(SPCEngine.generateDiagnosis(result).title,/hesaplanamadı/);assert.equal(formatCapability(result.cpk),'—');
});
test('zero within-group spread does not suppress overall variation and Pp',()=>{
 const result=metric([log('a',[9,9]),log('b',[11,11])]);assert.equal(result.cpk,null);assert.ok(result.stdDev>0);assert.ok(result.pp!>0);assert.equal(result.count,4);
});
test('one real measurement remains visible without capability',()=>{const result=metric([log('one',[10])]);assert.equal(result.count,1);assert.equal(result.cpk,null);assert.match(result.capabilityUnavailableReason!,/en az iki/);});
test('small measurements preserve standard deviation, limits and distinct histogram midpoints',()=>{
 const small={...characteristic,nominal:.0005,lsl:0,usl:.001,precision:6};const result=metric([log('small',[.000501,.000502])],small);
 assert.ok(result.stdDev>0);near(result.mean,.0005015);assert.ok(result.controlLimits.ucl>result.controlLimits.lcl);assert.equal(new Set(result.histogramBins.map(b=>b.midpoint)).size,9);
 assert.notEqual(formatSpcMeasurement(result.stdDev,small),'0');assert.notEqual(formatSpcMeasurement(result.controlLimits.ucl,small),formatSpcMeasurement(result.controlLimits.lcl,small));
});
test('very small nonzero measurements use scientific notation instead of zero',()=>{assert.match(formatSpcMeasurement(1e-15,characteristic),/e-/);assert.equal(formatSpcMeasurement(0,characteristic),'0');});
test('unusable data and invalid specification limits return no metric',()=>{assert.equal(SPCEngine.calculateMetric(characteristic,[log('none',[null])]),null);assert.equal(SPCEngine.calculateMetric({...characteristic,usl:9},[log('bad',[10])]),null);});
