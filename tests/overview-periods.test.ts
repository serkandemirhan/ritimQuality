import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qualityOverview} from '../src/services/overview';
import type {InspectionLog} from '../src/types';
const now=new Date('2026-11-08T12:00:00Z');
const record=(days:number,status:InspectionLog['overallStatus'])=>({timestamp:new Date(+now-days*86400000).toISOString(),overallStatus:status} as InspectionLog);
test('periods filter counts and explain warnings without changing the rate',()=>{
 const logs=[record(1,'pass'),record(2,'warning'),record(3,'fail'),record(15,'pass'),record(45,'pass'),record(-1,'fail')];
 const seven=qualityOverview(logs,now,7),thirty=qualityOverview(logs,now,30),ninety=qualityOverview(logs,now,90);
 assert.equal(seven.count,3);assert.equal(seven.passCount,1);assert.equal(seven.warningCount,1);assert.equal(seven.failCount,1);assert.equal(seven.acceptedCount,2);
 assert.ok(Math.abs(seven.rate!-200/3)<1e-9);assert.equal(thirty.count,4);assert.equal(ninety.count,5);
 assert.equal(seven.change,null);
 assert.ok(Math.abs(thirty.change!+25)<.001);
});
test('daily volume totals match the selected rolling period, including partial boundary day',()=>{
 for(const days of [7,30,90] as const){
 const result=qualityOverview([record(days-.01,'pass'),record(days,'fail'),record(0,'warning'),record(-.01,'fail')],now,days);
 assert.equal(result.count,2);assert.equal(result.trend.reduce((total,day)=>total+day.count,0),2);
 assert.ok(result.trend.filter(day=>day.count===0).every(day=>day.rate===null));
 }
});
