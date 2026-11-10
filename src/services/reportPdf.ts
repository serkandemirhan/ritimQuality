import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {analyzeInspectionReport,reportRowStatusLabel,reportStatusLabel} from './reportAnalysis';
import {controlLabel} from './controlLabel';
import {orderedCharacteristics} from './measurementOrder';
import type {ControlPlan,InspectionLog,Product,TenantCompany} from '../types';

export interface ReportPdfInput {
 log:InspectionLog; company?:TenantCompany; product?:Product; controlPlan?:ControlPlan;
 isExample?:boolean; detailed?:boolean;
 fonts:{regular:Uint8Array;bold:Uint8Array}; drawingPng?:Uint8Array;
}
export function reportApprovalLabel(log:InspectionLog,plan?:ControlPlan):string {
 const status=log.approval?.status||(log.requiresReview||(log.controlPlanSnapshot||plan)?.requiresApproval?'pending':'not_required');
 return {approved:'Onaylandı',rejected:'Reddedildi',pending:'Onay bekliyor',not_required:'Onay gerekmiyor'}[status];
}
export function reportPdfFilename(log:InspectionLog):string{
 const safe=(value:string)=>value.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu,'_').replace(/^\.+/,'').slice(0,70)||'rapor';
 return `Ritim_Kalite_${safe(controlLabel(log))}_${safe(log.productCode||'parca')}.pdf`;
}
/** Vector text and embedded Unicode fonts keep long reports searchable and printable. */
export async function createReportPdf(input:ReportPdfInput):Promise<Uint8Array>{
 const {log,company,product,isExample=false,detailed=false}=input;
 const plan=log.controlPlanSnapshot||input.controlPlan;
 const chars=orderedCharacteristics(plan);
 const analysis=analyzeInspectionReport(log,chars,isExample);
 if(plan?.drawingImageUrl&&!input.drawingPng)throw Error('Teknik resim hazır olmadan PDF oluşturulamaz.');
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const normal=await doc.embedFont(input.fonts.regular,{subset:true}),bold=await doc.embedFont(input.fonts.bold,{subset:true});
 const number=controlLabel(log),technical=reportStatusLabel(analysis.status),approval=reportApprovalLabel(log,plan);
 doc.setTitle(`${number} · Kalite kontrol raporu`);doc.setAuthor(company?.legalName||company?.name||'Ritim Quality');doc.setSubject(`${technical} · Yönetici onayı: ${approval}`);doc.setCreator('Ritim Quality');
 const width=842,height=595,margin=35,content=width-margin*2,bottom=48;
 const ink=rgb(.09,.18,.25),muted=rgb(.35,.42,.47),line=rgb(.82,.86,.88),red=rgb(.65,.12,.18);
 const clean=(value:unknown)=>String(value??'—').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\t/g,' ');
 const wrap=(text:unknown,font:PDFFont,size:number,maxWidth:number):string[]=>{
  const lines:string[]=[];let current='';
  for(const paragraph of clean(text).split(/\r?\n/)){
   for(const word of paragraph.split(/\s+/)){
    const candidate=current?current+' '+word:word;
    if(font.widthOfTextAtSize(candidate,size)<=maxWidth){current=candidate;continue;}
    if(current){lines.push(current);current='';}
    for(const letter of word){if(font.widthOfTextAtSize(current+letter,size)>maxWidth&&current){lines.push(current);current='';}current+=letter;}
   }
   lines.push(current);current='';
  }
  return lines.length?lines:[''];
 };
 let page:PDFPage,y=0;
 function draw(text:unknown,x:number,top:number,size=9,font=normal,color=ink){page.drawText(clean(text),{x,y:top,size,font,color});}
 function newPage(){
  page=doc.addPage([width,height]);y=height-margin;
  draw('ritim quality',margin,y,19,bold);draw(number,width-260,y,10,bold);y-=24;
  const status=`Teknik sonuç: ${technical} | Yönetici onayı: ${approval}`;
  draw(status,margin,y,9,bold);y-=18;
  if(isExample){draw('DEMO RAPORU — Üretim onayı veya resmi kalite kabul belgesi değildir.',margin,y,9,bold,red);y-=18;}
  if(log.clientSyncStatus==='pending'){draw('YEREL RAPOR — Sunucu senkronizasyonu henüz tamamlanmadı.',margin,y,9,bold,red);y-=18;}
  page.drawLine({start:{x:margin,y:y+7},end:{x:width-margin,y:y+7},thickness:.5,color:line});y-=8;
 }
 function paragraph(text:unknown,font=normal,size=9){for(const value of wrap(text,font,size,content)){if(y<bottom+16)newPage();draw(value,margin,y,size,font);y-=size+5;}y-=4;}
 newPage();
 paragraph(company?.legalName||company?.name||'Kalite kontrol raporu',bold,12);
 paragraph(`Parça: ${log.productCode} · ${log.productName} | Çizim revizyonu: ${log.productRevision||'—'} | Plan revizyonu: ${log.controlPlanVersion||'—'}`);
 paragraph(`Lot: ${log.lotNumber||'—'} | İş emri: ${log.orderNumber||'—'} | Seri: ${log.serialNumber||'—'}`);
 paragraph(`Muayene eden: ${log.operatorName||'—'} | Zaman: ${new Date(log.timestamp).toLocaleString('tr-TR')} | İstasyon: ${log.machineNo||'—'} | Ekipman: ${log.equipmentId||'Belirtilmedi'}`);
 paragraph(`Ölçüm kaynağı: ${log.source||'manual'} | Program: ${log.programName||'—'}`);
 if(product?.customer||product?.material)paragraph(`Müşteri: ${product?.customer||'—'} | Malzeme: ${product?.material||'—'}`);
 paragraph(`Kontrol noktası: ${analysis.totalCharacteristics} | Ölçülen: ${analysis.measuredCharacteristics} | Uygun: ${analysis.conformingCharacteristics} | Uygunsuz: ${analysis.nonconformingCharacteristics} | Ölçülmedi: ${analysis.incompleteCharacteristics}`,bold);
 if(log.approval?.reviewedBy||log.approval?.reason)paragraph(`İnceleyen: ${log.approval.reviewedBy||'—'} | İnceleme zamanı: ${log.approval.reviewedAt?new Date(log.approval.reviewedAt).toLocaleString('tr-TR'):'—'} | Gerekçe: ${log.approval.reason||'—'}`);
 const columns=[40,174,70,70,70,78,78,78,114];
 const headings=['No / N','Karakteristik','Nominal','Alt sınır','Üst sınır','Ölçülen','Nominal sapma','Tolerans dışı','Sonuç'];
 function header(){
  let x=margin;const h=34;
  page.drawRectangle({x:margin,y:y-h+8,width:content,height:h,color:rgb(.94,.96,.97)});
  headings.forEach((label,i)=>{wrap(label,bold,8,columns[i]-10).forEach((s,k)=>draw(s,x+5,y-k*10,8,bold));x+=columns[i];});y-=h;
 }
 if(y<bottom+70)newPage();header();
 const num=(n:number|null,unit='')=>n===null?'—':`${n.toLocaleString('tr-TR',{maximumFractionDigits:12,useGrouping:false})}${unit?' '+unit:''}`;
 for(const row of analysis.rows){
  const value=row.measuredValue;
  const displayed=value==null?'—':Array.isArray(value)?value.join(', '):typeof value==='boolean'?(value?'Uygun':'Uygunsuz'):typeof value==='number'?num(value,row.unit):value==='__NA__'?'Uygulanamaz':String(value);
  const cells=[`#${row.pointNo} / N${row.sampleIndex}`,row.characteristic+(row.note?'\nNot: '+row.note:''),num(row.nominal,row.unit),num(row.lowerLimit,row.unit),num(row.upperLimit,row.unit),displayed,num(row.deviation,row.unit),num(row.outOfToleranceDeviation,row.unit),reportRowStatusLabel(row.status)+(isExample?'\nDemo kaydı':'')];
  const lines=cells.map((cell,i)=>wrap(cell,normal,8,columns[i]-10));
  // Split exceptionally long notes across pages without clipping any measurement.
  let offset=0;const total=Math.max(...lines.map(a=>a.length));
  while(offset<total){
   if(y<bottom+24){newPage();header();}
   const available=Math.max(1,Math.floor((y-bottom-12)/11)),take=Math.min(total-offset,available),h=take*11+10;
   let x=margin;
   lines.forEach((values,i)=>{values.slice(offset,offset+take).forEach((s,k)=>draw(s,x+5,y-k*11,8,normal,row.status==='fail'?red:ink));x+=columns[i];});
   page.drawLine({start:{x:margin,y:y-h+7},end:{x:width-margin,y:y-h+7},thickness:.4,color:line});y-=h;offset+=take;
  }
 }
 if(detailed&&analysis.nonconformities.length){
  paragraph('Uygunsuzluk özeti',bold,12);
  for(const row of analysis.nonconformities)paragraph(`#${row.pointNo} / N${row.sampleIndex} · ${row.characteristic} | Ölçülen: ${row.measuredNumeric===null?String(row.measuredValue):num(row.measuredNumeric,row.unit)} | Tolerans dışı sapma: ${num(row.outOfToleranceDeviation,row.unit)}`);
 }
 if(input.drawingPng){
  newPage();paragraph('Teknik resim ve kontrol noktaları',bold,12);
  const image=await doc.embedPng(input.drawingPng),scale=Math.min(content/image.width,(y-bottom-30)/image.height),w=image.width*scale,h=image.height*scale,x=margin+(content-w)/2,top=y;
  page.drawImage(image,{x,y:top-h,width:w,height:h});
  if(!isExample&&plan?.balloonMode!=='embedded')for(const c of chars){
   const cx=x+w*c.pin.x/100,cy=top-h*c.pin.y/100;
   const failed=analysis.rows.some(row=>row.pointNo===c.pointNo&&row.status==='fail');
   page.drawCircle({x:cx,y:cy,size:9,color:failed?red:rgb(.12,.32,.53),borderColor:rgb(1,1,1),borderWidth:1});
   const label=String(c.pointNo);draw(label,cx-bold.widthOfTextAtSize(label,8)/2,cy-3,8,bold,rgb(1,1,1));
  }
 }
 const pages=doc.getPages();for(let i=0;i<pages.length;i++){
  const p=pages[i];p.drawText(`${number} · ${i+1} / ${pages.length}`,{x:margin,y:23,size:8,font:normal,color:muted});
  p.drawText('Ritim Quality · Ölçüm sonucu ve yönetici onayı ayrı değerlendirilir.',{x:width-365,y:23,size:8,font:normal,color:muted});
 }
 return doc.save();
}
