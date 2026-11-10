import regularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import boldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import {createReportPdf,reportPdfFilename,type ReportPdfInput} from './reportPdf';
let fonts:Promise<ReportPdfInput['fonts']>|undefined;
async function bytes(url:string){const r=await fetch(url);if(!r.ok)throw Error('PDF yazı tipi yüklenemedi. İnternet bağlantısını kontrol edip yeniden deneyin.');return new Uint8Array(await r.arrayBuffer());}
async function captureDrawing(image:HTMLImageElement):Promise<Uint8Array>{
 const r=await fetch(image.currentSrc||image.src);if(!r.ok)throw Error('Teknik resim PDF için alınamadı.');
 const blob=await r.blob(),url=URL.createObjectURL(blob);
 try{
  const copy=new Image();copy.src=url;await copy.decode();
  const scale=Math.min(1,2400/Math.max(copy.naturalWidth,copy.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(copy.naturalWidth*scale);canvas.height=Math.ceil(copy.naturalHeight*scale);
  const context=canvas.getContext('2d');if(!context)throw Error('Teknik resim oluşturulamadı.');context.drawImage(copy,0,0,canvas.width,canvas.height);
  const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Teknik resim PDF için dönüştürülemedi.')),'image/png'));
  return new Uint8Array(await png.arrayBuffer());
 }finally{URL.revokeObjectURL(url);}
}
export async function prepareReportFile(input:Omit<ReportPdfInput,'fonts'|'drawingPng'>,image?:HTMLImageElement):Promise<File>{
 fonts??=Promise.all([bytes(regularUrl),bytes(boldUrl)]).then(([regular,bold])=>({regular,bold})).catch(error=>{fonts=undefined;throw error;});
 const drawingPng=image?await captureDrawing(image):undefined;
 const pdf=await createReportPdf({...input,fonts:await fonts,drawingPng});
 return new File([pdf as Uint8Array<ArrayBuffer>],reportPdfFilename(input.log),{type:'application/pdf'});
}
export function downloadReportFile(file:File):void{
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
