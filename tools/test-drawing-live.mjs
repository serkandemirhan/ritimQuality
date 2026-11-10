// Sends only a synthetic, non-customer drawing to the configured AI provider.
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {mkdir,writeFile} from 'node:fs/promises';
import {analyzeDrawing} from '../dist-server/services/drawingAnalysis.js';
const pdf=await PDFDocument.create(),page=pdf.addPage([800,600]),font=await pdf.embedFont(StandardFonts.Helvetica);
page.drawText('SYNTHETIC TEST DRAWING - NOT FOR MANUFACTURING',{x:40,y:555,size:14,font});
page.drawRectangle({x:150,y:230,width:400,height:90,borderColor:rgb(0,0,0),borderWidth:2});
page.drawLine({start:{x:150,y:350},end:{x:550,y:350},thickness:1});
for(const x of [150,550])page.drawLine({start:{x,y:330},end:{x,y:370},thickness:1});
page.drawText('5.000',{x:320,y:365,font,size:15});
page.drawLine({start:{x:100,y:230},end:{x:100,y:320},thickness:1});
page.drawText('1.000',{x:40,y:270,font,size:15});
page.drawText('UNITS: INCHES. GENERAL TOLERANCE: .XXX +/- .005',{x:40,y:100,font,size:13});
page.drawText('DRAWING TEST-002   REVISION A1   MATERIAL: ALUMINUM',{x:40,y:70,font,size:12});
const bytes=Buffer.from(await pdf.save());await mkdir('.runtime/drawing-analysis',{recursive:true});
await writeFile('.runtime/drawing-analysis/synthetic-test.pdf',bytes);
try{
 const result=await analyzeDrawing(bytes);
 await writeFile('.runtime/drawing-analysis/live-result.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({model:result.model,durationMs:result.durationMs,usage:result.usage,characteristics:result.characteristics.map(c=>({name:c.description,nominal:c.nominal,unit:c.unit,lower:c.lowerLimit,upper:c.upperLimit,sourceMapped:!!c.sourceBoundingBox})),notes:result.notes},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
