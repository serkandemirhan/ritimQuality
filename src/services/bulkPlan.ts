import type {Characteristic, ControlPlan, MeasurementTool} from '../types';

export type BulkCharacteristicPatch=Partial<Pick<Characteristic,'nominal'|'tolLower'|'tolUpper'|'unit'|'tool'|'criticalClass'|'evidencePolicy'|'sampleSize'|'frequency'|'description'|'precision'|'allowNegative'|'resolution'|'options'|'rejectedOptions'|'optionResults'|'policy'>>;
export function commonCharacteristicValue<T>(points:Characteristic[],read:(point:Characteristic)=>T):{mixed:boolean;value:T}{
 const value=read(points[0]);return {value,mixed:points.some(point=>JSON.stringify(read(point))!==JSON.stringify(value))};
}
export function applyBulkCharacteristicPatch(plan:ControlPlan,ids:string[],patch:BulkCharacteristicPatch):ControlPlan{
 const allowed=new Set(['nominal','tolLower','tolUpper','unit','tool','criticalClass','evidencePolicy','sampleSize','frequency','description','precision','allowNegative','resolution','options','rejectedOptions','optionResults','policy']);
 if(Object.keys(patch).some(key=>!allowed.has(key)))throw new Error('Ad, kimlik, kontrol tipi ve çizim konumu topluca değiştirilemez.');
 const selected=new Set(ids),points=plan.characteristics.filter(c=>selected.has(c.id));
 if(!points.length)throw new Error('En az bir kontrol noktası seçin.');
 if(points.length!==selected.size)throw new Error('Seçilen kontrol noktalarından biri artık planda bulunmuyor.');
 const numeric=['nominal','tolLower','tolUpper','unit','precision','allowNegative','resolution'];
 if(numeric.some(key=>key in patch)&&!points.some(c=>(c.type||'numeric')==='numeric'))throw new Error('Seçimde sayısal kontrol noktası bulunmuyor.');
 if(['options','rejectedOptions','optionResults'].some(key=>key in patch)){
  const type=points[0].type||'numeric';
  if(points.some(c=>(c.type||'numeric')!==type)||!['single_select','multi_select','boolean','ok_nok','visual'].includes(type))throw new Error('Seçenekleri düzenlemek için aynı kontrol tipini seçin.');
  if(('options'in patch||'rejectedOptions'in patch)&&!['single_select','multi_select'].includes(type))throw new Error('Bu kontrol tipinin seçenekleri sabittir.');
 }
 return {...plan,characteristics:plan.characteristics.map(c=>{
  if(!selected.has(c.id))return c;
  if((c.type||'numeric')!=='numeric'&&numeric.some(key=>key in patch)){
   const shared=Object.fromEntries(Object.entries(patch).filter(([key])=>!numeric.includes(key)));
   return Object.keys(shared).length?applyBulkCharacteristicPatch({...plan,characteristics:[c]},[c.id],shared).characteristics[0]:c;
  }
  const next={...c,...patch,...patch.policy?{policy:{...c.policy,...patch.policy}}:{}};
  if('optionResults'in patch)next.optionResults={...c.optionResults,...patch.optionResults};
  if(patch.options){
   const options=[...new Set(patch.options.map(v=>v.trim()).filter(Boolean))];if(!options.length)throw new Error('En az bir seçenek girin.');next.options=options;
   next.rejectedOptions=(next.rejectedOptions||[]).filter(v=>options.includes(v));
   if(next.optionResults)next.optionResults=Object.fromEntries(Object.entries(next.optionResults).filter(([key])=>options.includes(key)));
  }
  if('optionResults'in patch&&next.optionResults)next.optionResults=Object.fromEntries(Object.entries(next.optionResults).filter(([,value])=>value!==undefined));
  const type=c.type||'numeric';
  const choices=type==='boolean'?['yes','no']:type==='visual'?['OK','NOK','SUSPECT']:type==='ok_nok'?['OK','NOK']:next.options||[];
  if(patch.optionResults&&Object.keys(patch.optionResults).some(key=>!choices.includes(key)))throw new Error('Kalite kararı her seçili noktada tanımlı bir seçeneğe ait olmalı.');
  if(patch.rejectedOptions&&patch.rejectedOptions.some(key=>!choices.includes(key)))throw new Error('Uygunsuz seçenek her seçili noktada tanımlı olmalı.');
  if(['nominal','tolLower','tolUpper'].some(key=>key in patch)){
   const lower='tolLower'in patch?patch.tolLower!:(c.extraction?c.tolLower:-Math.abs(c.tolLower));
   const upper=next.tolUpper;
   if(![next.nominal,lower,upper].every(Number.isFinite)||lower>0||upper<0||lower>=upper)throw new Error('Alt tolerans sıfır veya negatif, üst tolerans sıfır veya pozitif olmalı; aralık sıfır olamaz.');
   next.tolLower=lower;next.lsl=Number((next.nominal+lower).toFixed(12));next.usl=Number((next.nominal+upper).toFixed(12));
   if(next.lsl>=next.usl)throw new Error('Tolerans aralığı geçersiz.');
  }
  if(next.precision!==undefined&&(!Number.isInteger(next.precision)||next.precision<0||next.precision>12))throw new Error('Ondalık hassasiyet 0–12 arasında bir tam sayı olmalı.');
  if(next.resolution!==undefined&&(!Number.isFinite(next.resolution)||next.resolution<=0))throw new Error('Çözünürlük sıfırdan büyük olmalı.');
  const policy=next.policy;if(policy){
   for(const count of [policy.minPhotos,policy.maxPhotos])if(count!==undefined&&(!Number.isInteger(count)||count<0||count>100))throw new Error('Fotoğraf sayısı 0–100 arasında olmalı.');
   if(policy.minPhotos!==undefined&&policy.maxPhotos!==undefined&&policy.minPhotos>policy.maxPhotos)throw new Error('En az fotoğraf sayısı en fazla fotoğraf sayısını aşamaz.');
  }
  return next;
 })};
}

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
