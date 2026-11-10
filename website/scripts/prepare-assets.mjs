import {mkdir,writeFile,copyFile,readdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const require=createRequire(import.meta.url);await mkdir('public',{recursive:true});
await copyFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),'public/pdf.worker.min.mjs');
// Self-host OCR assets: no drawing, language or worker request goes to a CDN.
await mkdir('public/ocr/core',{recursive:true});await mkdir('public/ocr/lang',{recursive:true});
await copyFile(require.resolve('tesseract.js/dist/worker.min.js'),'public/ocr/worker.min.js');
const core=dirname(require.resolve('tesseract.js-core/package.json'));
for(const file of await readdir(core))if(file.endsWith('.wasm')||file.endsWith('.wasm.js'))await copyFile(join(core,file),join('public/ocr/core',file));
await copyFile(require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),'public/ocr/lang/eng.traineddata.gz');
const pdf=await PDFDocument.create(),page=pdf.addPage([800,500]),font=await pdf.embedFont(StandardFonts.Helvetica),color=rgb(.14,.24,.29);
for(let x=0;x<=800;x+=20)page.drawLine({start:{x,y:0},end:{x,y:500},thickness:.3,color:rgb(.91,.94,.94)});
for(let y=0;y<=500;y+=20)page.drawLine({start:{x:0,y},end:{x:800,y},thickness:.3,color:rgb(.91,.94,.94)});
const points=[[150,180],[360,180],[360,210],[640,210],[640,290],[360,290],[360,320],[150,320],[150,180]];
for(let i=1;i<points.length;i++)page.drawLine({start:{x:points[i-1][0],y:500-points[i-1][1]},end:{x:points[i][0],y:500-points[i][1]},thickness:2,color});
for(const [x1,y1,x2,y2] of [[150,340,150,400],[640,310,640,400],[150,380,640,380],[125,180,125,320],[685,210,685,290]])page.drawLine({start:{x:x1,y:500-y1},end:{x:x2,y:500-y2},thickness:1,color});
for(const [text,x,y] of [['80 ±0.10',360,370],['Ø32 ±0.02',225,157],['Ø20 ±0.02',615,194]])page.drawText(text,{x,y:500-y,size:16,font,color});
page.drawText('RQ-ORNEK-01 | REV A | UNITS: mm | SAMPLE ONLY - NOT FOR PRODUCTION',{x:80,y:28,size:10,font,color});
await writeFile('public/sample-drawing.pdf',await pdf.save());

// Independent seven-dimension drawing for the upload-first demo. All points are
// extracted from these actual PDF strings; the UI does not use hardcoded points.
const plate=await PDFDocument.create(),sheet=plate.addPage([900,620]);
const face=await plate.embedFont(StandardFonts.Helvetica),ink=rgb(.20,.32,.35),light=rgb(.68,.75,.73);
const line=(x1,y1,x2,y2,width=1)=>sheet.drawLine({start:{x:x1,y:620-y1},end:{x:x2,y:620-y2},thickness:width,color:ink});
const label=(text,x,y,size=15)=>sheet.drawText(text,{x,y:620-y,size,font:face,color:ink});
sheet.drawRectangle({x:35,y:35,width:830,height:550,borderWidth:.7,borderColor:light});
sheet.drawRectangle({x:230,y:250,width:400,height:240,borderWidth:2,borderColor:ink});
sheet.drawRectangle({x:350,y:330,width:160,height:80,borderWidth:1.5,borderColor:ink});
for(const [x,y] of [[270,170],[590,170],[270,330],[590,330]])sheet.drawCircle({x,y:620-y,size:20,borderWidth:1.5,borderColor:ink});
// Length, width, hole diameter, pitch, slot width, slot height, side thickness.
line(230,118,230,75);line(630,118,630,75);line(230,88,630,88);label('100 ±0.10 mm',377,77);
line(215,130,135,130);line(215,370,135,370);line(150,130,150,370);label('60 ±0.10 mm',48,230);
line(603,158,690,130);line(690,130,800,130);label('Ø10 ±0.02 mm',690,120);
line(270,395,270,430);line(590,395,590,430);line(270,420,590,420);label('80 ±0.05 mm',380,445);
line(350,293,350,310);line(510,293,510,310);line(350,304,510,304);label('40 ±0.05 mm',380,326);
line(525,210,660,210);line(525,290,660,290);line(650,210,650,290);label('20 ±0.05 mm',680,260);
sheet.drawRectangle({x:735,y:250,width:32,height:180,borderWidth:1.5,borderColor:ink});line(735,390,735,420);line(767,390,767,420);line(735,410,767,410);label('8 ±0.02 mm',710,446);
label('RITIM QUALITY / DEMO',60,545,11);label('Birim: mm',60,567,10);label('RQ-DEMO-02 / REV A',660,567,10);
await writeFile('public/demo-plate.pdf',await plate.save());
