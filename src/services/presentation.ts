import type {InspectionLog,SampleMeasurement} from '../types';
export const qualityLabels:Record<string,string>={pass:'Uygun',fail:'Uygunsuz',warning:'Uygun · uyarı',review:'Şüpheli / inceleme',na:'Uygulanamaz (N/A)',unclassified:'Kalite kararı bekliyor',empty:'Ölçülmedi'};
export function cellQuality(sample:SampleMeasurement,id:string,log?:InspectionLog):string{
 if(sample.qualityResults?.[id])return sample.qualityResults[id];
 const history=(log?.mobileMeasurement as {attempts?:{sample:number;characteristic:string;result:string}[]}|undefined)?.attempts;
 return history?.filter(a=>a.sample===sample.sampleIndex&&a.characteristic===id).at(-1)?.result||sample.statuses[id]||'empty';
}
export const revisionLabel=(value?:string)=>!value?'—':/^(android|approval|draft)-\d{10,}$/.test(value)?'Eski revizyon · '+value.slice(-6):value;
export const localDay=(value:string|number|Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const recordOperator=(log:InspectionLog)=>log.operatorUserId||'legacy:'+log.operatorName;
