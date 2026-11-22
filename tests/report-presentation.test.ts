import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReportPdf} from '../src/services/reportPdf';
import {reportHeading,reportApprovalState} from '../src/services/reportPresentation';
import type {ControlPlan,InspectionLog} from '../src/types';
const plan={id:'p',productId:'part',version:'v1',requiresApproval:true,characteristics:[{id:'c',pointNo:1,name:'Çap',nominal:10,lsl:9,usl:11,unit:'mm',pin:{x:50,y:50}}]} as ControlPlan;
const log={id:'r',controlNumber:'KNT-1',productCode:'PART',productName:'Test',controlPlanSnapshot:plan,timestamp:'2026-11-22T08:00:00Z',sampleCount:1,samples:[{sampleIndex:1,values:{c:10},statuses:{c:'pass'}}]} as InspectionLog;
test('report headings distinguish approval from technical conformance',()=>{
 for(const [status,title,tone] of [['pending','KALİTE RAPORU — ONAY BEKLİYOR','warning'],['approved','ONAYLANMIŞ KALİTE RAPORU','success'],['rejected','KALİTE RAPORU — REDDEDİLDİ','danger'],['not_required','KALİTE RAPORU','info']] as const){const h=reportHeading({...log,approval:{status}});assert.equal(h.title,title);assert.equal(h.tone,tone);assert.equal(h.state,status);}
 assert.equal(reportApprovalState(log),'pending');assert.equal(reportApprovalState({...log,operatorRoleAtMeasurement:'admin'}),'not_required');
 assert.equal(reportApprovalState({...log,operatorRoleAtMeasurement:'admin',approval:{status:'pending'}}),'pending');
 assert.equal(reportHeading({...log,approval:{status:'approved'},clientSyncStatus:'pending'}).state,'local');assert.equal(reportHeading(log,plan,true).state,'example');
 assert.equal(reportApprovalState({...log,controlPlanSnapshot:{...plan,requiresApproval:false,characteristics:[{...plan.characteristics[0],policy:{requireSupervisorApproval:true}}]}}),'pending');
});
test('every PDF page carries the pending report title',async()=>{
 const fonts={regular:readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'),bold:readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf')};
 const large={...log,samples:Array.from({length:100},(_,i)=>({sampleIndex:i+1,values:{c:10},statuses:{c:'pass' as const}}))};
 const bytes=await createReportPdf({log:large,fonts});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const pdf=await task.promise;
 try{assert.ok(pdf.numPages>1);for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const text=(await page.getTextContent()).items.map(i=>'str'in i?i.str:'').join(' ');assert.match(text,/KALİTE RAPORU — ONAY BEKLİYOR/);assert.match(text,/Rapor durumu: Onay bekliyor/);}}finally{await task.destroy();}
});
