import assert from 'node:assert/strict';
import {analyzeInspectionReport,toleranceAnalysis} from '../src/services/reportAnalysis';
import type {Characteristic,InspectionLog} from '../src/types';

const characteristic=(id:string,pointNo:number,nominal:number,lsl:number,usl:number):Characteristic=>({id,pointNo,name:`Ölçü ${pointNo}`,nominal,tolLower:lsl-nominal,tolUpper:usl-nominal,lsl,usl,unit:'mm',tool:'Dijital Kumpas 0.01',sampleSize:'1',frequency:'100%',criticalClass:'major',pin:{x:10,y:10}});
const characteristics=[characteristic('one',1,100,99.9,100.1),characteristic('two',2,10,9.98,10.02),characteristic('three',3,60,59.9,60.1),characteristic('four',4,20,19.95,20.05),characteristic('five',5,40,39.95,40.05)];
const log=(values:Record<string,number>,statuses:Record<string,'pass'|'fail'|'empty'>):InspectionLog=>({id:'report-test',sessionCode:'INS-TEST',productId:'part',productCode:'P-1',productName:'Test parçası',controlPlanId:'plan',controlPlanVersion:'v1',operatorName:'Kontrolör',lotNumber:'LOT-1',orderNumber:'ORDER-1',machineNo:'CNC-1',sampleCount:1,overallStatus:'pass',totalPointsChecked:5,failedPointsCount:0,warningPointsCount:0,timestamp:'2026-11-09T10:00:00.000Z',samples:[{sampleIndex:1,values,statuses}]});

const above=toleranceAnalysis(10,9.98,10.02,12);
assert.equal(above.deviation,2);
assert.equal(above.outOfToleranceDeviation,1.98);
assert.equal(toleranceAnalysis(100,99.9,100.1,100).outOfToleranceDeviation,0);
assert.equal(toleranceAnalysis(20,19.95,20.05,19).outOfToleranceDeviation,.95);
assert.equal(toleranceAnalysis(20,null,20.05,19).outOfToleranceDeviation,0);

const mixed=analyzeInspectionReport(log({one:100,two:12,three:62,four:21,five:41},{one:'pass',two:'fail',three:'fail',four:'fail',five:'fail'}),characteristics);
assert.equal(mixed.status,'nonconforming');
assert.deepEqual(mixed.nonconformities.map(row=>row.outOfToleranceDeviation),[1.98,1.9,.95,.95]);
assert.equal(mixed.conformingCharacteristics,1);
assert.equal(mixed.nonconformingCharacteristics,4);

const incomplete=analyzeInspectionReport(log({one:100,two:0,three:0,four:0,five:0},{one:'pass',two:'empty',three:'empty',four:'empty',five:'empty'}),characteristics);
assert.equal(incomplete.status,'incomplete');
assert.equal(incomplete.incompleteCharacteristics,4);

const noLimits={...characteristics[0],lsl:NaN,usl:NaN};
const noLimitsResult=analyzeInspectionReport(log({one:100},{one:'pass'}),[noLimits]);
assert.equal(noLimitsResult.status,'not_evaluated');
assert.equal(noLimitsResult.rows[0].status,'not_evaluated');
const mixedLimits=analyzeInspectionReport(log({one:100,two:10},{one:'pass',two:'pass'}),[characteristics[0],{...characteristics[1],lsl:NaN,usl:NaN}]);
assert.equal(mixedLimits.status,'incomplete');

const demo=analyzeInspectionReport(log({one:100,two:12,three:62,four:21,five:41},{one:'pass',two:'fail',three:'fail',four:'fail',five:'fail'}),characteristics,true);
assert.equal(demo.status,'not_evaluated');
assert.equal(demo.demoMeasurements,5);
assert.equal(demo.nonconformingCharacteristics,0);

const fifty=Array.from({length:50},(_,index)=>characteristic(`p-${index}`,index+1,100,99.9,100.1));
const fiftyValues=Object.fromEntries(fifty.map(item=>[item.id,100]));
const fiftyStatuses=Object.fromEntries(fifty.map(item=>[item.id,'pass' as const]));
const large=analyzeInspectionReport(log(fiftyValues,fiftyStatuses),fifty);
assert.equal(large.rows.length,50);
assert.equal(new Set(large.rows.map(row=>row.id)).size,50);
assert.equal(large.status,'conforming');

console.log('PASS: report analysis calculates deviations, technical status, incomplete measurements and demo isolation.');
