import {recordOperator} from './presentation';
import type {Characteristic,ControlPlan,InspectionLog,SPCMetric} from '../types';
import {SPCEngine,type SPCFilters} from './spcEngine';
export type SPCLink={sourcePlanId:string;sourceCharacteristicId:string;targetPlanId:string;targetCharacteristicId:string;enabled:boolean;reason:string;approvedBy?:string;approvedAt?:string};
export const characteristicKey=(p:string,c:string)=>JSON.stringify([p,c]);
const numeric=(c:Characteristic)=>(c.type||'numeric')==='numeric';
export function compatibility(a:Characteristic,b:Characteristic):string[]{
 const reasons:string[]=[];
 if(![a.nominal,a.lsl,a.usl,b.nominal,b.lsl,b.usl].every(Number.isFinite)||a.lsl>=a.usl||b.lsl>=b.usl)reasons.push('Geçersiz spesifikasyon sınırları');
 if(!numeric(a)||!numeric(b))reasons.push('Sayısal ölçüm değil');
 for(const [key,label] of [['unit','Birim'],['tool','Ölçüm yöntemi / aleti'],['nominal','Nominal'],['lsl','Alt sınır'],['usl','Üst sınır'],['resolution','Çözünürlük'],['precision','Hassasiyet']] as const)if(a[key]!==b[key])reasons.push(`${label} değişmiş`);
 return reasons;
}
export function revisionCatalog(productId:string,plans:ControlPlan[],logs:InspectionLog[]):ControlPlan[]{
 const map=new Map(plans.filter(p=>p.productId===productId).map(p=>[p.id,p]));
 for(const l of logs)if(l.productId===productId&&l.controlPlanSnapshot?.productId===productId&&!map.has(l.controlPlanId))map.set(l.controlPlanId,l.controlPlanSnapshot);
 return [...map.values()];
}
export function linkedCharacteristics(anchor:ControlPlan,char:Characteristic,plans:ControlPlan[],links:SPCLink[]){
 const sameProduct=plans.filter(p=>p.productId===anchor.productId),graph=new Map<string,Set<string>>();
 const edge=(a:string,b:string)=>{if(!graph.has(a))graph.set(a,new Set());graph.get(a)!.add(b);};
 const ids=new Map<string,string[]>();
 for(const p of sameProduct)for(const c of p.characteristics){const key=characteristicKey(p.id,c.id),list=ids.get(c.id)||[];list.push(key);ids.set(c.id,list);}
 for(const list of ids.values())for(const k of list){edge(k,list[0]);edge(list[0],k);}
 for(const l of links)if(l.enabled){const a=sameProduct.find(p=>p.id===l.sourcePlanId),b=sameProduct.find(p=>p.id===l.targetPlanId);if(a?.characteristics.some(c=>c.id===l.sourceCharacteristicId)&&b?.characteristics.some(c=>c.id===l.targetCharacteristicId)){const ak=characteristicKey(a.id,l.sourceCharacteristicId),bk=characteristicKey(b.id,l.targetCharacteristicId);edge(ak,bk);edge(bk,ak);}}
 const visited=new Set<string>(),queue=[characteristicKey(anchor.id,char.id)];while(queue.length){const k=queue.pop()!;if(visited.has(k))continue;visited.add(k);queue.push(...(graph.get(k)||[]));}
 return sameProduct.map(plan=>({plan,candidates:plan.characteristics.filter(c=>visited.has(characteristicKey(plan.id,c.id)))}));
}
export type RevisionPoint={timestamp:string;value:number;nominal:number;lsl:number;usl:number;recordedStatus:string;version:string;planId:string;unit:string;sampleIndex:number;serialNumber?:string;lotNumber:string;operator:string;machineNo:string;compatible:boolean;controlUcl:number|null;controlLcl:number|null};
export function capabilityGuard(metric:SPCMetric|null){
 if(!metric)return 'Geçerli ölçüm yok';
 if(metric.capabilityUnavailableReason)return metric.capabilityUnavailableReason;
 if(metric.historyValues.some(p=>p.value<metric.controlLimits.lcl||p.value>metric.controlLimits.ucl))return 'Kontrol sınırı dışında sinyal var; ortak yetenek sonucu verilmedi.';
 return null;
}
export function analyzeRevisions(anchor:ControlPlan,char:Characteristic,plans:ControlPlan[],logs:InspectionLog[],links:SPCLink[]=[],filters:SPCFilters={}){
 const matches=linkedCharacteristics(anchor,char,plans,links),points:RevisionPoint[]=[],compatibleLogs:InspectionLog[]=[];
 let missingSnapshots=0;
 const rows=matches.flatMap(({plan,candidates})=>{
  if(candidates.length!==1)return [{plan,characteristic:undefined as Characteristic|undefined,reason:candidates.length?'Belirsiz eşleşme: aynı revizyonda birden fazla nokta':'Nokta yok / eşleşme onaylanmadı',metric:null as SPCMetric|null,compatible:false,first:'',last:'',currentSpecFailCount:null as number|null,points:[] as RevisionPoint[]}];
  const linked=candidates[0],groups=new Map<string,{characteristic:Characteristic;logs:InspectionLog[]}>();
  const scoped=logs.filter(l=>l.productId===anchor.productId&&l.controlPlanId===plan.id&&l.controlPlanVersion===plan.version&&(!filters.operator||l.operatorName===filters.operator)&&(!filters.operatorKey||recordOperator(l)===filters.operatorKey)&&(!filters.lotNumber||l.lotNumber===filters.lotNumber)&&(!filters.machineNo||l.machineNo===filters.machineNo)&&(!filters.startDate||new Date(l.timestamp)>=new Date(filters.startDate))&&(!filters.endDate||new Date(l.timestamp)<=new Date(filters.endDate)));
  for(const log of scoped){const snap=log.controlPlanSnapshot;if(!snap||snap.id!==log.controlPlanId||snap.version!==log.controlPlanVersion||snap.productId!==anchor.productId){missingSnapshots++;continue;}const historical=snap.characteristics.find(c=>c.id===linked.id);if(!historical)continue;const key=JSON.stringify([historical.nominal,historical.lsl,historical.usl,historical.unit,historical.type,historical.tool,historical.resolution,historical.precision,log.machineNo,log.source||'manual',log.equipmentId||'']);const group=groups.get(key)||{characteristic:historical,logs:[]};group.logs.push(log);groups.set(key,group);}
  if(!groups.size)groups.set('empty',{characteristic:linked,logs:[]});
  return [...groups.values()].map(({characteristic:c,logs:groupLogs})=>{
   const reasons=compatibility(char,c),compatible=!reasons.length,metric=numeric(c)?SPCEngine.calculateMetric(c,groupLogs):null;
   const ownPoints:RevisionPoint[]=groupLogs.flatMap(l=>l.samples.flatMap(s=>{const value=s.values[c.id],status=s.statuses[c.id];return numeric(c)&&[c.nominal,c.lsl,c.usl].every(Number.isFinite)&&c.lsl<c.usl&&typeof value==='number'&&Number.isFinite(value)&&['pass','warning','fail'].includes(status)?[{timestamp:l.timestamp,value,nominal:c.nominal,lsl:c.lsl,usl:c.usl,recordedStatus:status,version:plan.version,planId:plan.id,unit:c.unit,sampleIndex:s.sampleIndex,serialNumber:s.serialNumber,lotNumber:l.lotNumber,operator:l.operatorName,machineNo:l.machineNo,compatible,controlUcl:metric?.controlLimits.ucl??null,controlLcl:metric?.controlLimits.lcl??null}]:[];})).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
   points.push(...ownPoints);
   if(compatible)for(const l of groupLogs)compatibleLogs.push({...l,samples:l.samples.map(s=>({...s,values:{...s.values,[char.id]:s.values[c.id]},statuses:{...s.statuses,[char.id]:s.statuses[c.id]}}))});
   return {plan,characteristic:c,reason:(reasons.join(' · ')||'Uyumlu')+(groupLogs[0]?` · ${groupLogs[0].machineNo||'İstasyon yok'} / ${groupLogs[0].source||'manual'} / ${groupLogs[0].equipmentId||'Ekipman yok'}`:''),metric,compatible,first:ownPoints[0]?.timestamp||'',last:ownPoints.at(-1)?.timestamp||'',currentSpecFailCount:c.unit===char.unit&&numeric(c)?ownPoints.filter(p=>p.value<char.lsl||p.value>char.usl).length:null,points:ownPoints};
  });
 });
 points.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.planId.localeCompare(b.planId)||a.sampleIndex-b.sampleIndex);
 // Different stations/sources are separate populations unless explicitly filtered to one.
 const populations=new Set(compatibleLogs.map(l=>JSON.stringify([l.machineNo,l.source||'manual',l.equipmentId||''])));
 const pooled=SPCEngine.calculateMetric(char,compatibleLogs);
 const pooledReason=populations.size>1?'İstasyon / kaynak / ekipman farklı; ortak Cp/Cpk hesaplanmadı. İstasyon filtresiyle kapsamı daraltın.':capabilityGuard(pooled);
 return {rows,points,missingSnapshots,pooled,pooledReason};
}
