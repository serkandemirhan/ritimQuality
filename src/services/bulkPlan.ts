import type {Characteristic, ControlPlan, MeasurementTool} from '../types';

export function applyBulkTool(plan:ControlPlan, ids:string[], tool:MeasurementTool):ControlPlan {
  const selected=new Set(ids);
  return {...plan,characteristics:plan.characteristics.map(c=>selected.has(c.id)?{...c,tool}:c)};
}
export function applyBulkTolerance(plan:ControlPlan, ids:string[], lower:number, upper:number):ControlPlan {
  if(!Number.isFinite(lower)||!Number.isFinite(upper)||lower>0||upper<0||lower===upper)throw new Error('Alt tolerans sıfır veya negatif, üst tolerans sıfır veya pozitif olmalı; aralık sıfır olamaz.');
  const selected=new Set(ids);
  return {...plan,characteristics:plan.characteristics.map(c=>selected.has(c.id)&&(c.type||'numeric')==='numeric'?{...c,tolLower:lower,tolUpper:upper,lsl:Number((c.nominal+lower).toFixed(4)),usl:Number((c.nominal+upper).toFixed(4))}:c)};
}
export function deleteBulkPoints(plan:ControlPlan, ids:string[]):ControlPlan {
  const selected=new Set(ids);
  const remaining=plan.characteristics.filter(c=>!selected.has(c.id));
  if(!remaining.length)throw new Error('Planda en az bir kontrol noktası kalmalı.');
  const characteristics=remaining.map((c,index)=>({...c,pointNo:index+1}));
  const numbers=new Map(characteristics.map(c=>[c.id,c.pointNo]));
  const characteristicImageLinks=plan.characteristicImageLinks?.filter(l=>numbers.has(l.characteristicId)).map(l=>({...l,annotations:l.annotations.map(a=>a.type==='pin'?{...a,label:`#${numbers.get(l.characteristicId)}`}:a)}));
  return {...plan,characteristics,...(characteristicImageLinks?{characteristicImageLinks}:{})};
}
