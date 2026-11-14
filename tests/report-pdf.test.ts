import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {createReportPdf,reportPdfFilename,reportApprovalLabel} from '../src/services/reportPdf';
import type {ControlPlan,InspectionLog} from '../src/types';
const fonts={regular:readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'),bold:readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf')};
const plan={id:'plan',productId:'p',version:'v1',requiresApproval:true,characteristics:[{id:'c',pointNo:1,name:'Gövde çapı – ölçüm',nominal:10,lsl:9.9,usl:10.1,unit:'mm',pin:{x:50,y:50}}]} as ControlPlan;
const log={id:'log',sessionCode:'INS-ÖRNEK',controlNumber:'KNT-12',productId:'p',productCode:'ÇELİK-ŞAFT',productName:'Türkçe ölçüm – ığüşöç İĞÜŞÖÇ',controlPlanId:'plan',controlPlanVersion:'v1',controlPlanSnapshot:plan,operatorName:'Ölçümcü',lotNumber:'LOT-A',orderNumber:'IE-1',machineNo:'CNC-1',sampleCount:1,overallStatus:'pass',totalPointsChecked:1,failedPointsCount:0,warningPointsCount:0,timestamp:'2026-11-10T10:00:00Z',samples:[{sampleIndex:1,values:{c:10},statuses:{c:'pass'}}]} as InspectionLog;
test('PDF contains a real readable document with Unicode metadata and report identity',async()=>{
 const bytes=await createReportPdf({log,fonts});const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),1);assert.match(pdf.getTitle()!,/KNT-12/);assert.match(pdf.getSubject()!,/UYGUN.*Onay bekliyor/);assert.ok(bytes.length>1000);
});
test('large reports and long notes paginate rather than clipping measurements',async()=>{
 const large={...log,samples:Array.from({length:120},(_,i)=>({sampleIndex:i+1,values:{c:10},statuses:{c:'pass' as const},pointNotes:{c:i===0?'İnceleme notu '.repeat(1500):'Sonraki numune'}}))};
 const pdf=await PDFDocument.load(await createReportPdf({log:large,fonts,detailed:true}));assert.ok(pdf.getPageCount()>4);
});
test('missing drawing cannot silently produce an incomplete PDF',async()=>{
 const withDrawing={...plan,drawingImageUrl:'media:private-drawing'};await assert.rejects(()=>createReportPdf({log:{...log,controlPlanSnapshot:withDrawing},fonts}),/Teknik resim/);
});
test('approval fallback does not turn a required pending review into approval',()=>{
 assert.equal(reportApprovalLabel(log),'Onay bekliyor');assert.equal(reportApprovalLabel({...log,approval:{status:'rejected',reason:'İnceleme'}}),'Reddedildi');
 assert.equal(reportApprovalLabel({...log,approval:{status:'approved'}}),'Onaylandı');
});
test('file names retain report identity without allowing path characters',()=>{const name=reportPdfFilename({...log,productCode:'../../a/b'});assert.ok(name.endsWith('.pdf'));assert.equal(name.includes('/'),false);assert.match(name,/KNT-12/);});
