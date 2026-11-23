import {qualityLabels,cellQuality} from './presentation';
import type {InspectionLog,SampleMeasurement,Characteristic} from '../types';
export const safeCell=(value:unknown)=>{const text=String(value??'');return /^[\s]*[=+@-]/.test(text)?"'"+text:text;};
const xml=(value:unknown)=>safeCell(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const csvRows=(rows:unknown[][])=>'\uFEFF'+rows.map(row=>row.map(v=>'"'+safeCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
export function exportMeasurementMatrix(samples:SampleMeasurement[],characteristics:Characteristic[]){
 const value=(v:unknown)=>v==null?'':Array.isArray(v)?v.join(', '):v===true?'Uygun':v===false?'Uygunsuz':v==='yes'?'Evet':v==='no'?'Hayır':v==='__NA__'?'Uygulanamaz (N/A)':v==='SUSPECT'?'Şüpheli':v;
 const rows:unknown[][]=[['Ölçüm noktası',...samples.map(s=>'N'+s.sampleIndex)],['Seri numarası',...samples.map(s=>s.serialNumber||'')],...characteristics.flatMap(c=>{const row=['#'+c.pointNo+' '+c.name+(c.unit?' ('+c.unit+')':''),...samples.map(s=>value(s.values[c.id]))];return samples.some(s=>['review','na','unclassified'].includes(cellQuality(s,c.id)))?[row,['Sonuç · #'+c.pointNo,...samples.map(s=>qualityLabels[cellQuality(s,c.id)])]]:[row];})];
 const url=URL.createObjectURL(new Blob([csvRows(rows)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`Olcum_Kayitlari_${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function inspectionExport(logs:InspectionLog[],format:'csv'|'excel') {
  const rows:unknown[][]=[['Oturum Kodu','Tarih Saat','Ürün Kodu','Ürün Adı','Ürün Revizyonu','Plan Revizyonu','Parti','Seri','İş Emri','Operatör','İstasyon','Numune','Sonuç','Hatalı Nokta'],...logs.map(l=>[l.sessionCode,l.timestamp,l.productCode,l.productName,l.productRevision,l.controlPlanVersion,l.lotNumber,l.serialNumber,l.orderNumber,l.operatorName,l.machineNo,l.sampleCount,l.overallStatus==='fail'?'Uygunsuz':l.overallStatus==='warning'?'Uygun / Uyarı':'Uygun',l.failedPointsCount])];
  if(format==='csv')return csvRows(rows);
  return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Ölçüm Kayıtları"><Table>'+rows.map(row=>'<Row>'+row.map(v=>'<Cell><Data ss:Type="String">'+xml(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet></Workbook>';
}
export function exportInspectionRecords(logs:InspectionLog[],format:'csv'|'excel') {
  if(!logs.length)return;
  const blob=new Blob([inspectionExport(logs,format)],{type:format==='csv'?'text/csv;charset=utf-8':'application/vnd.ms-excel;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`Olcum_Kayitlari_${new Date().toISOString().slice(0,10)}.${format==='csv'?'csv':'xml'}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
