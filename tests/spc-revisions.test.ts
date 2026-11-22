import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Characteristic,ControlPlan,InspectionLog} from '../src/types';
import {analyzeRevisions,compatibility,revisionCatalog,type SPCLink} from '../src/services/spcRevisions';
const c={id:'a',name:'Çap',pointNo:1,type:'numeric',nominal:10,lsl:9,usl:11,tolLower:-1,tolUpper:1,unit:'mm',tool:'CMM 3D Ölçüm Cihazı',precision:3,sampleSize:'2',frequency:'Saat başı',criticalClass:'minor',pin:{x:50,y:50}} as Characteristic;
const plan=(id:string,chars=[c])=>({id,productId:'p',version:id,characteristics:chars} as ControlPlan);
const log=(p:ControlPlan,day:number,values=[9.9,10.1])=>({id:p.id+day,productId:'p',controlPlanId:p.id,controlPlanVersion:p.version,controlPlanSnapshot:structuredClone(p),timestamp:`2026-01-${String(day).padStart(2,'0')}T12:00:00Z`,operatorName:'Ece',lotNumber:'L',machineNo:'CNC-1',source:'manual',samples:values.map((v,i)=>({sampleIndex:i+1,serialNumber:'SN'+i,values:{[p.characteristics[0]?.id||'a']:v},statuses:{[p.characteristics[0]?.id||'a']:'pass'}}))} as InspectionLog);
test('identity survives renaming/renumbering; changed specs split; deleted/new points never fabricate continuity',()=>{
 const p1=plan('v1'),p2=plan('v2',[{...c,name:'Yeni ad',pointNo:7}]),p3=plan('v3',[{...c,lsl:9.95,usl:10.05}]),p4=plan('v4',[]),p5=plan('v5',[{...c,id:'new'}]),plans=[p1,p2,p3,p4,p5],logs=[log(p2,2),log(p1,1),log(p3,3)],before=structuredClone({plans,logs});
 const a=analyzeRevisions(p1,c,plans,logs);assert.equal(a.pooled?.count,4);assert.equal(a.points.length,6);assert.equal(a.rows[2].compatible,false);assert.match(a.rows[2].reason,/sınır/);assert.equal(a.rows[2].metric?.outOfSpecCount,2);assert.equal(a.points[4].recordedStatus,'pass');assert.equal(a.rows[3].metric,null);assert.equal(a.rows[4].metric,null);assert.equal(a.rows[0].currentSpecFailCount,0);assert.equal(a.rows[2].currentSpecFailCount,0);assert.deepEqual({plans,logs},before);
});
test('snapshots are mandatory and specification periods within a revision remain separate',()=>{
 const p=plan('v1'),historic=plan('v1',[{...c,nominal:20,lsl:19,usl:21}]),good=log(p,1),old=log(historic,2,[19.9,20.1]),missing={...log(p,3),controlPlanSnapshot:undefined};
 const a=analyzeRevisions(p,c,[p],[good,old,missing]);assert.equal(a.rows.length,2);assert.equal(a.pooled?.count,2);assert.equal(a.missingSnapshots,1);assert.equal(a.rows[1].characteristic?.nominal,20);assert.equal(a.rows[1].metric?.mean,20);
});
test('quality-approved legacy links map values without changing logs; revocation and ambiguous chains are respected',()=>{
 const p1=plan('v1'),p2=plan('v2',[{...c,id:'legacy'}]),link:SPCLink={sourcePlanId:'v1',sourceCharacteristicId:'a',targetPlanId:'v2',targetCharacteristicId:'legacy',enabled:true,reason:'Aynı fiziksel çap'};const logs=[log(p1,1),log(p2,2)],before=structuredClone(logs);
 assert.equal(analyzeRevisions(p1,c,[p1,p2],logs,[link]).pooled?.count,4);assert.equal(analyzeRevisions(p1,c,[p1,p2],logs,[{...link,enabled:false}]).pooled?.count,2);assert.deepEqual(logs,before);
 const ambiguous={...p2,characteristics:[...p2.characteristics,{...c,id:'second'}]},link2={...link,targetCharacteristicId:'second'};const a=analyzeRevisions(p1,c,[p1,ambiguous],logs,[link,link2]);assert.match(a.rows[1].reason,/Belirsiz/);assert.equal(a.rows[1].metric,null);
});
test('units, method, resolution and process populations prevent inappropriate pooled capability',()=>{
 assert.ok(compatibility(c,{...c,unit:'inch'}).length);assert.ok(compatibility(c,{...c,tool:'Other' as never}).length);assert.ok(compatibility(c,{...c,resolution:.01}).length);
 const p=plan('v1'),a=analyzeRevisions(p,c,[p],[log(p,1),{...log(p,2),machineNo:'CNC-2'}]);assert.match(a.pooledReason||'',/İstasyon/);assert.equal(analyzeRevisions(p,c,[p],[log(p,1)],[],{operator:'Other'}).pooled,null);
});
test('catalog includes retired snapshots and never imports another product',()=>{
 const p1=plan('v1'),p2=plan('v2'),foreign={...log(plan('foreign'),3),productId:'other'};assert.deepEqual(revisionCatalog('p',[p2],[log(p1,1),foreign]).map(p=>p.id),['v2','v1']);
});
