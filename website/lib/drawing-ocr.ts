import {sitePath} from '@/lib/site-path';
import {processingScope} from './processing-scope';
import type {SourceText} from './drawing-demo';
import {plusMinusGlyph} from './ocr-symbols';

/** Converts OCR boxes back from the rotated canvas to the original PDF page. */
export function originalBox(box:{x0:number;y0:number;x1:number;y1:number},width:number,height:number,rotation:number){
  const {x0,y0,x1,y1}=box;
  const b=rotation===90?{x0:y0,y0:height-x1,x1:y1,y1:height-x0}:rotation===270?{x0:width-y1,y0:x0,x1:width-y0,y1:x1}:box;
  return {x:b.x0/width*100,y:b.y0/height*100,width:(b.x1-b.x0)/width*100,height:(b.y1-b.y0)/height*100};
}

export async function recognizeDrawing(canvas:HTMLCanvasElement,onProgress:(message:string)=>void,signal?:AbortSignal):Promise<SourceText[]> {
  onProgress('Görüntüdeki yazılar okunuyor. İlk kullanım biraz sürebilir…');
  const scope=processingScope(90000,'Görüntüden okuma zaman sınırına ulaştı.',signal);
  let worker:import('tesseract.js').Worker|undefined;
  let phase='Okuma motoru hazırlanıyor';
  let lastMessage='';
  const sources:SourceText[]=[];
  try{
    const {createWorker,PSM}=await scope.wait(import('tesseract.js'));
    const starting=createWorker('eng',1,{workerPath:sitePath('/ocr/worker.min.js'),corePath:sitePath('/ocr/core'),langPath:sitePath('/ocr/lang'),workerBlobURL:false,logger:event=>{
      if(scope.stopped)return;
      const label=event.status==='recognizing text'?phase:event.status==='loading language traineddata'?'Okuma verileri yükleniyor':'Okuma motoru hazırlanıyor';
      const message=`${label} · %${Math.round((event.progress||0)*100)}`;
      if(message!==lastMessage){lastMessage=message;onProgress(message);}
    }});
    void starting.then(created=>{if(scope.stopped)void created.terminate();},()=>{});
    worker=await scope.wait(starting);
    await scope.wait(worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,user_defined_dpi:'300'}));
    for(const rotation of [0,90,270]){
      phase=rotation===0?'Yatay ölçüler okunuyor (1/3)':`Dikey ölçüler okunuyor (${rotation===90?2:3}/3)`;
      onProgress(rotation===0?'İlk sayfadaki ölçü yazıları okunuyor…':`Döndürülmüş ölçü yazıları okunuyor (${rotation===90?'2':'3'}/3)…`);
      const rotated=document.createElement('canvas');
      rotated.width=rotation?canvas.height:canvas.width;rotated.height=rotation?canvas.width:canvas.height;
      const context=rotated.getContext('2d',{willReadFrequently:true})!;
      if(rotation===90){context.translate(rotated.width,0);context.rotate(Math.PI/2);}
      if(rotation===270){context.translate(0,rotated.height);context.rotate(-Math.PI/2);}
      context.drawImage(canvas,0,0);
      try{
        const {data}=await scope.wait(worker.recognize(rotated,{}, {text:true,blocks:true}));
        for(const block of data.blocks||[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines){
          let text=line.text.trim(),confidence=line.confidence;if(!text)continue;
          if(/\d/.test(text)&&line.bbox.y1-line.bbox.y0<100&&line.bbox.x1-line.bbox.x0<1000){
            const {x0,y0,x1,y1}=line.bbox,w=x1-x0,h=y1-y0;
            const glyph=plusMinusGlyph(context.getImageData(x0,y0,w,h).data,w,h);
            if(glyph){
              if(/hole\s+cent/i.test(text))text=text.replace(/[=+]\s*(\d+[.,]\d+)/,'±$1');
              else if(/^[\d.,+±=\s-]+$/.test(text)&&glyph.left>0&&glyph.right<w){
                await scope.wait(worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789.,'}));
                const readNumber=async(left:number,right:number)=>{
                  const crop=document.createElement('canvas');crop.width=(right-left)*3+40;crop.height=h*3+40;const c=crop.getContext('2d')!;c.fillStyle='white';c.fillRect(0,0,crop.width,crop.height);c.drawImage(rotated,x0+left,y0,right-left,h,20,20,(right-left)*3,h*3);
                  try{return (await scope.wait(worker!.recognize(crop))).data;}finally{crop.width=0;crop.height=0;}
                };
                const nominal=await readNumber(0,glyph.left),tolerance=await readNumber(glyph.right,w);
                if(/^\d+(?:[.,]\d+)?$/.test(nominal.text.trim())&&/^\d+(?:[.,]\d+)?$/.test(tolerance.text.trim())&&Math.min(nominal.confidence,tolerance.confidence)>=85){text=`${nominal.text.trim()} ±${tolerance.text.trim()}`;confidence=Math.min(nominal.confidence,tolerance.confidence);}
                await scope.wait(worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,tessedit_char_whitelist:''}));
              }
            }
          }
          sources.push({id:sources.length,text,...originalBox(line.bbox,canvas.width,canvas.height,rotation),confidence,origin:'ocr',rotation});
        }
      }finally{rotated.width=0;rotated.height=0;}
    }
    return sources;
  }finally{scope.close();if(worker)void worker.terminate().catch(()=>{});}
}
