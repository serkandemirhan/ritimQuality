import type {Characteristic, InspectionLog, MeasurementValue, SampleMeasurement} from '../types';

export type ReportTechnicalStatus = 'conforming'|'nonconforming'|'incomplete'|'not_evaluated';
export type ReportRowStatus = 'pass'|'fail'|'incomplete'|'not_evaluated'|'not_applicable';

export interface ReportMeasurementRow {
  id:string;
  sampleIndex:number;
  pointNo:number;
  characteristic:string;
  unit:string;
  nominal:number|null;
  lowerLimit:number|null;
  upperLimit:number|null;
  measuredValue:MeasurementValue;
  measuredNumeric:number|null;
  deviation:number|null;
  outOfToleranceDeviation:number|null;
  status:ReportRowStatus;
  note?:string;
  isDemo:boolean;
}

export interface ReportAnalysis {
  status:ReportTechnicalStatus;
  totalCharacteristics:number;
  measuredCharacteristics:number;
  conformingCharacteristics:number;
  nonconformingCharacteristics:number;
  incompleteCharacteristics:number;
  demoMeasurements:number;
  rows:ReportMeasurementRow[];
  nonconformities:ReportMeasurementRow[];
}

const numeric=(value:MeasurementValue)=>typeof value==='number'&&Number.isFinite(value)?value:null;
const typeOf=(characteristic:Characteristic)=>characteristic.type||'numeric';
const reportPrecision=(value:number)=>Number(value.toFixed(12));

export function toleranceAnalysis(nominal:number|null,lowerLimit:number|null,upperLimit:number|null,measured:MeasurementValue){
  const measuredNumeric=numeric(measured);
  if(measuredNumeric===null||nominal===null)return {measuredNumeric,deviation:null,outOfToleranceDeviation:null};
  const deviation=reportPrecision(measuredNumeric-nominal);
  const outOfToleranceDeviation=reportPrecision(lowerLimit!==null&&measuredNumeric<lowerLimit?lowerLimit-measuredNumeric:upperLimit!==null&&measuredNumeric>upperLimit?measuredNumeric-upperLimit:0);
  return {measuredNumeric,deviation,outOfToleranceDeviation};
}

function rowStatus(characteristic:Characteristic,sample:SampleMeasurement,value:MeasurementValue):ReportRowStatus{
  const status=sample.statuses[characteristic.id];
  if(value===null||value===undefined||status==='empty'||!status)return 'incomplete';
  if(value==='__NA__')return 'not_applicable';
  if(typeOf(characteristic)==='numeric'&&(!Number.isFinite(characteristic.lsl)||!Number.isFinite(characteristic.usl)))return 'not_evaluated';
  if(status==='fail')return 'fail';
  if(status==='pass')return 'pass';
  return 'not_evaluated';
}

export function analyzeInspectionReport(log:InspectionLog,characteristics:Characteristic[],isDemo=false):ReportAnalysis{
  const rows=log.samples.flatMap(sample=>characteristics.map(characteristic=>{
    const measuredValue=sample.values[characteristic.id];
    const nominal=typeOf(characteristic)==='numeric'?characteristic.nominal:null;
    const lowerLimit=typeOf(characteristic)==='numeric'&&Number.isFinite(characteristic.lsl)?characteristic.lsl:null;
    const upperLimit=typeOf(characteristic)==='numeric'&&Number.isFinite(characteristic.usl)?characteristic.usl:null;
    const calculation=toleranceAnalysis(nominal,lowerLimit,upperLimit,measuredValue);
    return {id:`${sample.sampleIndex}:${characteristic.id}`,sampleIndex:sample.sampleIndex,pointNo:characteristic.pointNo,characteristic:characteristic.name,unit:characteristic.unit,nominal,lowerLimit,upperLimit,measuredValue, ...calculation,status:rowStatus(characteristic,sample,measuredValue),note:sample.pointNotes?.[characteristic.id],isDemo} satisfies ReportMeasurementRow;
  }));
  const realRows=rows.filter(row=>!row.isDemo);
  const evaluated=realRows.filter(row=>row.status==='pass'||row.status==='fail');
  const failed=evaluated.filter(row=>row.status==='fail');
  const incomplete=realRows.filter(row=>row.status==='incomplete').length;
  const notEvaluated=realRows.filter(row=>row.status==='not_evaluated').length;
  const status:ReportTechnicalStatus=failed.length?'nonconforming':!realRows.length||!evaluated.length?'not_evaluated':incomplete||notEvaluated?'incomplete':'conforming';
  return {status,totalCharacteristics:characteristics.length,measuredCharacteristics:evaluated.length,conformingCharacteristics:evaluated.filter(row=>row.status==='pass').length,nonconformingCharacteristics:failed.length,incompleteCharacteristics:incomplete,demoMeasurements:rows.filter(row=>row.isDemo).length,rows,nonconformities:failed};
}

export function reportStatusLabel(status:ReportTechnicalStatus){return {conforming:'UYGUN',nonconforming:'UYGUNSUZ',incomplete:'TAMAMLANMADI',not_evaluated:'DEĞERLENDİRİLMEDİ'}[status];}

export function reportRowStatusLabel(status:ReportRowStatus){return {pass:'UYGUN',fail:'UYGUNSUZ',incomplete:'ÖLÇÜLMEDİ',not_evaluated:'DEĞERLENDİRİLMEDİ',not_applicable:'UYGULANAMAZ'}[status];}
