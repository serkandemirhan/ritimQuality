import React,{useRef,useState,useEffect} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {Button,Field,Input,Select,Textarea} from './ui';
import {SaasApi} from '../services/api';
import {StorageService} from '../services/storage';
import type {ControlPlan,Product,Characteristic,MeasurementTool} from '../types';
import './drawingAnalysis.css';
GlobalWorkerOptions.workerSrc=workerUrl;
type Box={x:number;y:number;width:number;height:number};
type Row={id:string;description:string;characteristicType:string;originalText:string;nominal:number|null;unit:'mm'|'inch'|'°'|'µm'|null;tolerancePlus:number|null;toleranceMinus:number|null;lowerLimit:number|null;upperLimit:number|null;toleranceSource:string|null;suggestedInstrument:string;sourcePage:number;sourceBoundingBox:Box|null;sourceMethod?:string;verified?:boolean};
type Result={pageCount:number;notes:string[];characteristics:Row[];model:string;durationMs:number;usage:unknown};
const kinds:Record<string,string>={linear:'Uzunluk',diameter:'Çap',radius:'Yarıçap',angle:'Açı',hole:'Delik',thread:'Diş',chamfer:'Pah',roughness:'Yüzey pürüzlülüğü',gdt:'Geometrik tolerans'};
const tools:MeasurementTool[]=['Dijital Kumpas 0.01','Mikrometre 0.001','CMM 3D Ölçüm Cihazı','Mihengir / Yükseklik Mastarı','Profil Projeksiyon / Optik','Yüzey Pürüzlülük (Surftest)','Geçer / Geçmez Tampon Mastar','Diğer Ölçüm Aleti'];
const ready=(r:Row)=>r.nominal!==null&&Number.isFinite(r.nominal)&&r.unit!==null&&r.lowerLimit!==null&&Number.isFinite(r.lowerLimit)&&r.upperLimit!==null&&Number.isFinite(r.upperLimit)&&r.lowerLimit<r.upperLimit&&r.description.trim().length>0&&r.sourceBoundingBox!==null;

export function DrawingAnalysis({product,onCreated,onProductUpdated,onClose}:{key?:string;product:Product;onCreated:(plan:ControlPlan)=>void;onProductUpdated?:(product:Product)=>void;onClose:()=>void}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[pages,setPages]=useState(0),[consent,setConsent]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState('');
  const abort=useRef<AbortController|null>(null),generation=useRef(0);
  useEffect(()=>()=>{generation.current++;abort.current?.abort();},[]);
  const load=async(f:File)=>{
    const version=++generation.current;setFile(null);setResult(null);setRows([]);setPreview('');setError('');setBusy('PDF okunuyor…');
    try{
      if(f.size>4*1024*1024)throw Error('PDF en fazla 4 MB olabilir.');
      const bytes=new Uint8Array(await f.arrayBuffer());
      if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Geçerli bir PDF seçin.');
      const task=getDocument({data:bytes});
      try{
        const doc=await task.promise,page=await doc.getPage(1),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,2000/Math.max(base.width,base.height))});
        const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
        await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
        if(version===generation.current){setPreview(canvas.toDataURL('image/png'));setPages(doc.numPages);setFile(f);}
      }finally{await task.destroy();}
    }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'PDF açılamadı.');}
    finally{if(version===generation.current)setBusy('');}
  };
  const analyze=async()=>{
    if(!file)return;setBusy('Ölçüler ve toleranslar yapay zekâ ile inceleniyor…');setError('');abort.current=new AbortController();
    try{
      const data=await SaasApi.analyzeDrawing<Result>(file,abort.current.signal);
      setResult(data);setRows(data.characteristics);setSelected(data.characteristics[0]?.id||'');
      if(!data.characteristics.length)setError('Ölçü bulunamadı. Elle kontrol noktası ekleyebilir veya başka bir çizim deneyebilirsiniz.');
    }catch(e){setError(e instanceof Error&&e.name==='AbortError'?'Analiz ekranı iptal edildi. Sunucuda başlamış istek tamamlanabilir.':e instanceof Error?e.message:'Analiz tamamlanamadı.');}
    finally{setBusy('');}
  };
  const update=(id:string,patch:Partial<Row>)=>setRows(all=>all.map(r=>{
    if(r.id!==id)return r;const next={...r,...patch,verified:false};
    if('nominal'in patch||'tolerancePlus'in patch||'toleranceMinus'in patch){next.lowerLimit=next.nominal!==null&&next.toleranceMinus!==null?Number((next.nominal+next.toleranceMinus).toFixed(10)):null;next.upperLimit=next.nominal!==null&&next.tolerancePlus!==null?Number((next.nominal+next.tolerancePlus).toFixed(10)):null;}
    return next;
  }));
  const create=async()=>{
    if(!file||!rows.length||!rows.every(r=>r.verified&&ready(r)))return;
    setBusy('Çizim ve doğrulanan kontrol planı kaydediliyor…');setError('');
    try{
      const original=await SaasApi.uploadFile(file);
      const blob=await(await fetch(preview)).blob();
      const image=await SaasApi.uploadFile(new File([blob],file.name+'-sayfa-1.png',{type:'image/png'}));
      const imageUrl=`media:${image.id}#image/png`;
      const chars:Characteristic[]=rows.map((r,i)=>({id:r.id,pointNo:i+1,name:r.description,type:'numeric',nominal:r.nominal!,unit:r.unit!,tolLower:Number((r.lowerLimit!-r.nominal!).toFixed(10)),tolUpper:Number((r.upperLimit!-r.nominal!).toFixed(10)),lsl:r.lowerLimit!,usl:r.upperLimit!,tool:tools.includes(r.suggestedInstrument as MeasurementTool)?r.suggestedInstrument as MeasurementTool:'Diğer Ölçüm Aleti',sampleSize:'1',frequency:'Parti başı',criticalClass:'major',pin:{x:r.sourceBoundingBox!.x,y:r.sourceBoundingBox!.y},description:r.originalText,extraction:{...r,verificationStatus:'verified'}}));
      const now=new Date().toISOString();
      const plan:ControlPlan={id:crypto.randomUUID(),productId:product.id,version:'AI-'+Date.now().toString(36),revisionDate:now.slice(0,10),revisionNote:'PDF analizinden oluşturuldu; kullanıcı tarafından doğrulandı.',isActive:false,status:'draft',author:StorageService.getCurrentUser().name,approvedBy:'',drawingImageUrl:imageUrl,characteristics:chars,createdAt:now,updatedAt:now,drawingAnalysis:{originalUrl:`media:${original.id}#application/pdf`,pageCount:pages,analyzedPage:1,notes:result?.notes||[],model:result?.model||'manual',durationMs:result?.durationMs,usage:result?.usage},characteristicImageLinks:rows.map(r=>({id:crypto.randomUUID(),characteristicId:r.id,imageId:image.id,annotations:r.sourceBoundingBox?[{id:crypto.randomUUID(),type:'area' as const,startX:r.sourceBoundingBox.x,startY:r.sourceBoundingBox.y,endX:Math.min(100,r.sourceBoundingBox.x+r.sourceBoundingBox.width),endY:Math.min(100,r.sourceBoundingBox.y+r.sourceBoundingBox.height),label:r.originalText}]:[]}))};
      const updated={...product,images:[...(product.images||[]),{id:image.id,name:file.name+' · Sayfa 1',url:imageUrl,mimeType:'image/png'}],updatedAt:now};
      await StorageService.saveProduct(updated);onProductUpdated?.(updated);
      await StorageService.saveControlPlan(plan);onCreated(plan);
    }catch(e){setError(e instanceof Error?e.message:'Plan kaydedilemedi.');}finally{setBusy('');}
  };
  const active=rows.find(r=>r.id===selected),box=active?.sourceBoundingBox;
  return <section className="rq-card drawing-analysis" aria-label="PDF’den kontrol planı oluştur">
    <div className="rq-actions"><h2 className="rq-section-title">PDF’den kontrol planı oluştur</h2><Button disabled={!!busy} onClick={onClose}>Kapat</Button></div>
    <p className="rq-helper">Yalnızca ilk sayfa incelenir. Sonuçları doğruladıktan sonra yeni bir taslak plan oluşturulur.</p>
    <Field label="Teknik resim PDF dosyası"><Input type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);}}/></Field>
    {file&&<><p>{file.name} · {pages} sayfa · İncelenen sayfa: 1</p><label className="drawing-consent"><input type="checkbox" checked={consent} disabled={!!busy} onChange={e=>setConsent(e.target.checked)}/> İlk sayfanın harici yapay zekâ sağlayıcısına (OpenAI) gönderilmesine yetkim var ve bu işlemeyi kabul ediyorum. Kaynak dosya ve plan, kaydettiğimde çalışma alanımda saklanır.</label><Button variant="primary" disabled={!consent||!!busy} onClick={()=>void analyze()}>Teknik resmi yapay zekâ ile incele</Button></>}
    {busy&&<p role="status">{busy}</p>}{error&&<p role="alert" className="rq-feedback rq-tone-danger">{error}</p>}
    {preview&&<div className="drawing-analysis-grid"><div><div className="drawing-preview" onClick={e=>{if(!active||busy)return;const rect=e.currentTarget.getBoundingClientRect();update(active.id,{sourceBoundingBox:{x:Math.min(99,Math.max(0,(e.clientX-rect.left)/rect.width*100)),y:Math.min(99,Math.max(0,(e.clientY-rect.top)/rect.height*100)),width:1,height:1},sourceMethod:'manual'});}}><img src={preview} alt="Teknik resmin ilk sayfası"/>{box&&<span className="drawing-source" style={{left:box.x+'%',top:box.y+'%',width:Math.max(box.width,1)+'%',height:Math.max(box.height,1)+'%'}}/>}</div><p className="rq-helper">Satırı seçerek kaynağı vurgulayın. Konum eksik veya hatalıysa satırı seçip çizimde ilgili ölçünün üzerine tıklayın.</p></div>
      <div className="drawing-rows">{rows.map((r,i)=><article key={r.id} className={'drawing-row '+(selected===r.id?'selected':'')} onFocus={()=>setSelected(r.id)} onClick={()=>setSelected(r.id)}>
        <div className="rq-actions"><strong>#{i+1} · {r.verified?'Doğrulandı':'İnceleme gerekli'}</strong><Button disabled={!!busy} onClick={()=>setRows(all=>all.filter(x=>x.id!==r.id))}>Sil</Button></div>
        <Field label="Karakteristik"><Input disabled={!!busy} value={r.description} onChange={e=>update(r.id,{description:e.target.value})}/></Field>
        <div className="drawing-fields"><Field label="Ölçü türü"><Select disabled={!!busy} value={r.characteristicType} onChange={e=>update(r.id,{characteristicType:e.target.value})}>{Object.entries(kinds).map(([v,label])=><option key={v} value={v}>{label}</option>)}</Select></Field><Field label="Birim"><Select disabled={!!busy} value={r.unit||''} onChange={e=>update(r.id,{unit:e.target.value as Row['unit']||null})}><option value="">Belirsiz</option>{['mm','inch','°','µm'].map(v=><option key={v} value={v}>{v==='inch'?'inç':v}</option>)}</Select></Field>
        {([['nominal','Nominal'],['toleranceMinus','Alt sapma (işaretli)'],['tolerancePlus','Üst sapma (işaretli)'],['lowerLimit','Alt sınır'],['upperLimit','Üst sınır']] as const).map(([key,label])=><div key={key}><Field label={label}><Input disabled={!!busy} type="number" step="any" value={r[key]??''} onChange={e=>update(r.id,{[key]:e.target.value===''?null:Number(e.target.value)})}/></Field></div>)}</div>
        <Field label="Ölçüm aleti"><Select disabled={!!busy} value={tools.includes(r.suggestedInstrument as MeasurementTool)?r.suggestedInstrument:'Diğer Ölçüm Aleti'} onChange={e=>update(r.id,{suggestedInstrument:e.target.value})}>{tools.map(t=><option key={t}>{t}</option>)}</Select></Field>
        <p className="rq-helper">Kaynak: {r.originalText} · Tolerans: {r.toleranceSource||'Belirtilmemiş'}{!r.sourceBoundingBox?' · Kaynak konumu elle incelenmeli':''}</p>
        <label><input type="checkbox" disabled={!!busy||!ready(r)} checked={!!r.verified} onChange={e=>setRows(all=>all.map(x=>x.id===r.id?{...x,verified:e.target.checked}:x))}/> Ölçüyü, birimi, sınırları ve çizimdeki kaynağı doğruladım.</label>
        {!ready(r)&&<p className="rq-helper">Nominal, birim, geçerli sınırlar ve çizimdeki kaynak konumunu tamamlayın. Sayısal olmayan gereksinimleri notlarda koruyup bu listeden çıkarın.</p>}
      </article>)}<Button disabled={!!busy} onClick={()=>setRows(all=>[...all,{id:crypto.randomUUID(),description:'',characteristicType:'linear',originalText:'Elle eklendi',nominal:null,unit:null,tolerancePlus:null,toleranceMinus:null,lowerLimit:null,upperLimit:null,toleranceSource:null,suggestedInstrument:'Diğer Ölçüm Aleti',sourcePage:1,sourceBoundingBox:null}])}>Eksik kontrol noktası ekle</Button></div></div>}
    {result&&<details><summary>Çizim notları ve analiz bilgisi</summary><Field label="Mühendislik notları (her satıra bir not)"><Textarea disabled={!!busy} value={result.notes.join('\n')} onChange={e=>setResult({...result,notes:e.target.value.split('\n')})}/></Field><p>{(result.durationMs/1000).toFixed(1)} saniye · Model: {result.model}</p></details>}
    {!!rows.length&&<Button variant="primary" disabled={!!busy||!rows.every(r=>r.verified&&ready(r))} onClick={()=>void create()}>Doğrulanan ölçülerden kontrol planı oluştur</Button>}
  </section>;
}
