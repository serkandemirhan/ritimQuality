import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyOperatorPerformance} from '../src/services/operatorPerformance';
import type {InspectionLog} from '../src/types';

const base={productId:'p',productCode:'P',productName:'Parça',controlPlanId:'cp',controlPlanVersion:'v1',lotNumber:'',orderNumber:'',machineNo:'M',sampleCount:1,overallStatus:'pass' as const,totalPointsChecked:3,failedPointsCount:0,warningPointsCount:0,samples:[]};
test('groups daily performance and excludes untimed legacy records from duration average',()=>{
  const logs=[
    {...base,id:'1',sessionCode:'1',operatorUserId:'u',operatorName:'Ayşe',timestamp:'2026-11-09T08:00:00Z',timing:{startedAt:'2026-11-09T08:00:00Z',completedAt:'2026-11-09T08:02:00Z',elapsedSeconds:120,activeSeconds:90},mobileMeasurement:{attempts:[{}, {previousAttemptId:'a'}]}},
    {...base,id:'2',sessionCode:'2',operatorUserId:'u',operatorName:'Ayşe',timestamp:'2026-11-09T09:00:00Z'},
  ] as InspectionLog[];
  const rows=dailyOperatorPerformance(logs,new Date('2026-11-09T12:00:00Z'));
  assert.equal(rows[0].controls,2);assert.equal(rows[0].timedControls,1);assert.equal(rows[0].averageActiveSeconds,90);assert.equal(rows[0].retryCount,1);
});
