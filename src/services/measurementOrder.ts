import type {ControlPlan, SampleMeasurement} from '../types';
export const orderedCharacteristics=(plan?:ControlPlan)=>[...(plan?.characteristics||[])].sort((a,b)=>a.pointNo-b.pointNo||a.id.localeCompare(b.id));
export function orderedMeasurements(sample:SampleMeasurement,plan?:ControlPlan){
 const ids=orderedCharacteristics(plan).map(c=>c.id);
 const known=new Set(ids);
 return [...ids,...Object.keys(sample.values).filter(id=>!known.has(id)).sort()].map(id=>[id,sample.values[id]] as const);
}
