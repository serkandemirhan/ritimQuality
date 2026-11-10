import {aiEnabled,reserveAnalysis,analyzeFirstPage} from '@/lib/demo-ai';
import type {SourceText} from '@/lib/drawing-demo';
export const runtime='nodejs';
export const maxDuration=60;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply({available:aiEnabled()});}
export async function POST(request:Request){
  if(!aiEnabled())return reply({error:'Yapay zekâ bağlantısı henüz etkin değil. PDF metninden bulunan noktalarla devam edebilirsiniz.'},503);
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('x-ai-consent')!=='accepted')return reply({error:'Analiz için işleme izni gerekli.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Geçersiz istek.'},415);
  const reader=request.body?.getReader();if(!reader)return reply({error:'İlk sayfa gönderilmedi.'},400);
  try{
    let total=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>3500000){await reader.cancel();return reply({error:'İlk sayfa görüntüsü çok büyük.'},413);}chunks.push(value);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(typeof body.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.image)||!Array.isArray(body.sources)||body.sources.length>10000)return reply({error:'Geçersiz ilk sayfa.'},400);
    const bytes=Buffer.from(body.image.split(',')[1],'base64');if(bytes[0]!==255||bytes[1]!==216)return reply({error:'Geçersiz görüntü.'},400);
    if(JSON.stringify(body.sources).length>250000)return reply({error:'Sayfadaki metin çok yoğun.'},413);
    const sources:SourceText[]=body.sources.map((s:SourceText)=>{
      if(typeof s.text!=='string'||s.text.length>2000||![s.id,s.x,s.y,s.width,s.height].every(n=>typeof n==='number'&&Number.isFinite(n)))throw Error('Geçersiz sayfa metni.');
      return {id:s.id,text:s.text,x:s.x,y:s.y,width:s.width,height:s.height,...(s.origin==='ocr'?{origin:'ocr' as const,confidence:typeof s.confidence==='number'&&Number.isFinite(s.confidence)?Math.max(0,Math.min(100,s.confidence)):0}:{})};
    });
    if(!await reserveAnalysis(request))return reply({error:'Ücretsiz analiz sınırına ulaşıldı. PDF metninden bulunan noktalarla devam edebilirsiniz.'},429);
    return reply({points:await analyzeFirstPage(body.image,sources)});
  }catch(error){return reply({error:error instanceof Error&&error.name==='TimeoutError'?'Analiz zaman aşımına uğradı. Tekrar deneyin.':'Analiz tamamlanamadı. PDF metninden bulunan noktalarla devam edin veya tekrar deneyin.'},422);}
}
