import {sitePath} from '@/lib/site-path';
import {processingScope} from './processing-scope';
import {extractDimensions,type DemoDocument,type SourceText} from './drawing-demo';
import {textBounds} from './drawing-regions';

export async function readDemoPdf(file:File,onProgress:(message:string)=>void=()=>{},signal?:AbortSignal):Promise<DemoDocument> {
  if(!/\.pdf$/i.test(file.name))throw Error('Lütfen PDF biçiminde bir teknik resim seçin.');
  if(file.size>15*1024*1024)throw Error('PDF en fazla 15 MB olabilir. Daha küçük bir dosya seçin.');
  const scope=processingScope(150000,'PDF okuma beklenenden uzun sürdü. Lütfen tekrar deneyin.',signal);
  let task:ReturnType<typeof import('pdfjs-dist').getDocument>|undefined;
  try {
  onProgress('PDF dosyası açılıyor…');
  const data=new Uint8Array(await scope.wait(file.arrayBuffer()));
  if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw Error('Bu dosya geçerli bir PDF değil.');
  const pdf=await scope.wait(import('pdfjs-dist'));
  pdf.GlobalWorkerOptions.workerSrc=sitePath('/pdf.worker.min.mjs');
  task=pdf.getDocument({data,useSystemFonts:true});
    const doc=await scope.wait(task.promise),page=await scope.wait(doc.getPage(1)),base=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(2,1800/Math.max(base.width,base.height))});
    const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    onProgress('İlk sayfanın görüntüsü hazırlanıyor…');
    await scope.wait(page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise);
    onProgress('Ölçü yazıları ve birimler okunuyor…');
    const content=await scope.wait(page.getTextContent());
    const items:SourceText[]=content.items.flatMap((item,index)=>{
      if(!('str'in item)||!item.str.trim())return [];
      const t=pdf.Util.transform(base.transform,item.transform);
      return [{id:index,text:item.str,...textBounds(t,item.width,base.width,base.height)}];
    });
    if(items.length>10000)throw Error('İlk sayfa çok yoğun. Daha sade bir PDF ile deneyin.');
    // Rejoin nearby PDF fragments (e.g. nominal, ± and tolerance) without merging distant dimensions.
    const sources:SourceText[]=[];
    for(const item of items.sort((a,b)=>Math.abs(a.y-b.y)<.5?a.x-b.x:a.y-b.y)){
      const prev=sources.at(-1),gap=prev?item.x-(prev.x+prev.width):Infinity;
      if(prev&&prev.rotation===0&&item.rotation===0&&Math.abs(prev.y-item.y)<Math.max(.5,item.height*.3)&&gap>=-.2&&gap<Math.max(.8,item.height*.9)){
        prev.text+=' '+item.text;prev.width=item.x+item.width-prev.x;
      }else sources.push({...item});
    }
    const preview=canvas.toDataURL('image/jpeg',.88);
    let extraction:'text'|'ocr'='text',warning='';
    if(extractDimensions(sources).length===0){
      extraction='ocr';
      const ocrCanvas=document.createElement('canvas'),ocrView=page.getViewport({scale:Math.min(4,3600/Math.max(base.width,base.height))});
      ocrCanvas.width=ocrView.width;ocrCanvas.height=ocrView.height;
      try{
        onProgress('Taranmış sayfa ayrıntılı okuma için hazırlanıyor…');
        await scope.wait(page.render({canvas:ocrCanvas,canvasContext:ocrCanvas.getContext('2d')!,viewport:ocrView}).promise);
        const {recognizeDrawing}=await scope.wait(import('./drawing-ocr'));
        const offset=Math.max(-1,...sources.map(s=>s.id))+1;
        sources.push(...(await scope.wait(recognizeDrawing(ocrCanvas,onProgress,signal))).map((s,index)=>({...s,id:offset+index})));
      }catch(error){if(scope.stopped||signal?.aborted)throw error;warning='Görüntüden okuma tamamlanamadı. Tekrar deneyin veya kullanılabiliyorsa yapay zekâ analizini seçin.';}
      finally{ocrCanvas.width=0;ocrCanvas.height=0;}
    }
    onProgress('Kontrol noktaları ve tolerans sınırları oluşturuluyor…');
    await scope.wait(new Promise(resolve=>setTimeout(resolve,0)));
    const points=extractDimensions(sources);
    // Put dimensions with an explicit tolerance first in the five-reading demo.
    // Identical nominal values at different positions remain independent points.
    if(extraction==='ocr')points.sort((a,b)=>Number(b.toleranceSource==='Ölçünün yanında belirtilen tolerans')-Number(a.toleranceSource==='Ölçünün yanında belirtilen tolerans'));
    return {name:file.name,pages:doc.numPages,width:base.width,height:base.height,preview,sources,points,extraction,warning};
  }catch(error){
    if(error instanceof Error&&error.name==='PasswordException')throw Error('Şifreli PDF açılamadı. Şifresiz bir kopya seçin.');
    throw error;
  }finally{scope.close();void task?.destroy().catch(()=>{});}
}
