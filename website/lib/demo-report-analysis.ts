import {displayNumber,verdict,type ControlPoint,type DemoDocument,type DemoReading} from './drawing-demo';

export type DemoReportStatus='conforming'|'nonconforming'|'incomplete'|'not_evaluated';
export type DemoReportRowStatus='pass'|'fail'|'incomplete'|'not_evaluated'|'demo';
export type DemoReportRow={point:ControlPoint;pointNumber:number;reading?:DemoReading;status:DemoReportRowStatus;deviation:number|null;outOfTolerance:number|null;direction:'above'|'below'|null};

const precise=(value:number)=>Number(value.toFixed(12));
export function measurementDeviation(point:ControlPoint,value:number){
  const deviation=precise(value-point.nominal);
  if(point.lower===null||point.upper===null||point.lower>point.upper||!point.unit)return {deviation,outOfTolerance:null,direction:null};
  if(value>point.upper)return {deviation,outOfTolerance:precise(value-point.upper),direction:'above' as const};
  if(value<point.lower)return {deviation,outOfTolerance:precise(point.lower-value),direction:'below' as const};
  return {deviation,outOfTolerance:0,direction:null};
}

export function analyzeDemoReport(doc:DemoDocument,readings:Record<string,DemoReading>){
  const rows:DemoReportRow[]=doc.points.map((point,index)=>{
    const reading=readings[point.id];
    const calculation=reading?measurementDeviation(point,reading.value):{deviation:null,outOfTolerance:null,direction:null};
    const result=reading?.kind==='simulated'?'demo':!reading?'incomplete':verdict(reading.value,point);
    const status:DemoReportRowStatus=result==='unknown'?'not_evaluated':result;
    return {point,pointNumber:index+1,reading,status,...calculation};
  });
  const actual=rows.filter(row=>row.reading?.kind==='manual');
  const examples=rows.filter(row=>row.reading?.kind==='simulated');
  const failed=actual.filter(row=>row.status==='fail');
  const incomplete=rows.filter(row=>!row.reading).length;
  const notEvaluated=actual.filter(row=>row.status==='not_evaluated').length;
  const evaluated=actual.filter(row=>row.status==='pass'||row.status==='fail');
  const status:DemoReportStatus=failed.length?'nonconforming':!actual.length?'not_evaluated':incomplete||notEvaluated?'incomplete':evaluated.length?'conforming':'not_evaluated';
  return {rows,actual,examples,failed,status,summary:{total:doc.points.length,measured:actual.length,passed:actual.filter(row=>row.status==='pass').length,failed:failed.length,unmeasured:rows.length-actual.length-examples.length,examples:examples.length}};
}

export const demoReportStatusLabel=(status:DemoReportStatus)=>({conforming:'UYGUN',nonconforming:'UYGUNSUZ',incomplete:'TAMAMLANMADI',not_evaluated:'DEĞERLENDİRİLMEDİ'})[status];
export const demoRowStatusLabel=(status:DemoReportRowStatus)=>({pass:'Uygun',fail:'Uygunsuz',incomplete:'Ölçülmedi',not_evaluated:'Değerlendirilmedi',demo:'Otomatik demo örneği'})[status];

/** The exact value strings consumed by the raster PDF table. */
export function demoReportRowValues(row:DemoReportRow){
  const p=row.point,r=row.reading,unit=p.unit;
  return [String(row.pointNumber).padStart(2,'0'),p.name,`${displayNumber(p.nominal)} ${unit}`,`${displayNumber(p.lower)} ${unit}`,`${displayNumber(p.upper)} ${unit}`,r?`${displayNumber(r.value)} ${unit}`:'—',row.deviation===null?'—':`${row.deviation>=0?'+':''}${displayNumber(row.deviation)} ${unit}`,row.outOfTolerance===null?'—':`${displayNumber(row.outOfTolerance)} ${unit}`,demoRowStatusLabel(row.status)];
}
