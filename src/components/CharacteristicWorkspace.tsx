import React,{useEffect,useMemo,useState} from 'react';
import type {Characteristic,CharacteristicImageLink,ControlPlan,CriticalClass,EvidencePolicy,Product,ProductImage,CharacteristicType,MeasurementUnit} from '../types';
import {SaasApi} from '../services/api';
import {StorageService} from '../services/storage';
import {AnnotationCanvas} from './AnnotationCanvas';
import {EmptyState} from './EmptyState';

const field='mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm';
const typeLabel:Record<CharacteristicType,string>={numeric:'Sayısal',ok_nok:'OK/NOK',visual:'Görsel',single_select:'Tekli Seçim',multi_select:'Çoklu Seçim'};
const severity:Record<CriticalClass,string>={minor:'Normal',major:'Önemli',critical:'Kritik'};

export function CharacteristicWorkspace({product,plan,onChange,onProductUpdated}:{product:Product;plan:ControlPlan;onChange:(plan:ControlPlan)=>void;onProductUpdated?:(product:Product)=>void}){
  const [activeId,setActiveId]=useState(plan.characteristics[0]?.id||'');
  const [all,setAll]=useState(false);
  const [images,setImages]=useState<ProductImage[]>(()=>product.images?.length?product.images:product.defaultDrawingUrl?[{id:'legacy-drawing',name:'Teknik Resim',url:product.defaultDrawingUrl}]:[]);
  const [imageId,setImageId]=useState('');
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{if(!plan.characteristics.some(c=>c.id===activeId))setActiveId(plan.characteristics[0]?.id||'');},[plan.characteristics,activeId]);
  useEffect(()=>{setImages(product.images?.length?product.images:product.defaultDrawingUrl?[{id:'legacy-drawing',name:'Teknik Resim',url:product.defaultDrawingUrl}]:[]);setImageId('');},[product.id,product.images,product.defaultDrawingUrl]);
  const active=plan.characteristics.find(c=>c.id===activeId)||plan.characteristics[0];
  const links=useMemo<CharacteristicImageLink[]>(()=>{
    if(plan.characteristicImageLinks)return plan.characteristicImageLinks;
    if(!images[0])return [];
    return plan.characteristics.map(c=>({id:`legacy-link-${c.id}`,characteristicId:c.id,imageId:images[0].id,annotations:c.pin?[{id:`legacy-pin-${c.id}`,type:'pin' as const,x:c.pin.x,y:c.pin.y,label:`#${c.pointNo}`}]:[]}));
  },[plan.characteristicImageLinks,plan.characteristics,images]);
  const activeLinks=links.filter(l=>l.characteristicId===active?.id);
  useEffect(()=>{if(!activeLinks.some(l=>l.imageId===imageId))setImageId(activeLinks[0]?.imageId||'');},[activeId,plan.characteristicImageLinks]);

  const update=(id:string,value:Partial<Characteristic>)=>onChange({...plan,characteristics:plan.characteristics.map(c=>c.id===id?{...c,...value,...(('nominal'in value||'tolUpper'in value||'tolLower'in value)?{usl:Number(((value.nominal??c.nominal)+(value.tolUpper??c.tolUpper)).toFixed(4)),lsl:Number(((value.nominal??c.nominal)-Math.abs(value.tolLower??c.tolLower)).toFixed(4))}: {})}:c)});
  const bind=(target:string)=>{if(!active||activeLinks.some(l=>l.imageId===target))return;const link:CharacteristicImageLink={id:crypto.randomUUID(),characteristicId:active.id,imageId:target,annotations:[]};onChange({...plan,characteristicImageLinks:[...links,link]});setImageId(target);};
  const unbind=(linkId:string)=>{onChange({...plan,characteristicImageLinks:links.filter(l=>l.id!==linkId)});setImageId('');};
  const addCharacteristic=()=>{if(plan.characteristics.length>=50)return;const pointNo=Math.max(0,...plan.characteristics.map(c=>c.pointNo))+1,id=crypto.randomUUID();const next:Characteristic={id,pointNo,name:`Karakteristik #${pointNo}`,nominal:25,tolUpper:.05,tolLower:-.05,usl:25.05,lsl:24.95,unit:'mm',tool:'Dijital Kumpas 0.01',sampleSize:'5 Adet',frequency:'Saat başı',criticalClass:'major',pin:{x:50,y:50},type:'numeric',evidencePolicy:'none'};onChange({...plan,characteristics:[...plan.characteristics,next],characteristicImageLinks:plan.characteristicImageLinks?[...links]:undefined});setActiveId(id);setAll(false);};
  const deleteCharacteristic=(id:string)=>{if(plan.characteristics.length<=1||!confirm('Bu kontrol noktası silinsin mi?'))return;const characteristics=plan.characteristics.filter(c=>c.id!==id).map((c,index)=>({...c,pointNo:index+1}));onChange({...plan,characteristics,characteristicImageLinks:links.filter(l=>l.characteristicId!==id)});setActiveId(characteristics[0].id);};
  const upload=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);try{const stored=await SaasApi.uploadFile(file);const image={id:stored.id,name:file.name,url:`media:${stored.id}#${stored.mimeType}`,mimeType:stored.mimeType};const next=[...images,image],updatedProduct={...product,images:next,defaultDrawingUrl:product.defaultDrawingUrl||image.url,updatedAt:new Date().toISOString()};await StorageService.saveProduct(updatedProduct);setImages(next);onProductUpdated?.(updatedProduct);bind(image.id);}catch(error){alert(error instanceof Error?error.message:'Görsel yüklenemedi.');}finally{setUploading(false);e.target.value='';}};

  const editor=(char:Characteristic)=>{
    const charLinks=links.filter(l=>l.characteristicId===char.id);
    const selectedLink=charLinks.find(l=>l.imageId===imageId)||charLinks[0];
    const selectedImage=images.find(i=>i.id===selectedLink?.imageId);
    const selectedImageIndex=Math.max(0,charLinks.findIndex(link=>link.id===selectedLink?.id));
    const showImage=(offset:number)=>{const target=charLinks[selectedImageIndex+offset];if(target)setImageId(target.imageId);};
    return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(340px,1fr)]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {charLinks.map(link=><button type="button" key={link.id} onClick={()=>setImageId(link.imageId)} className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold ${selectedLink?.id===link.id?'border-blue-600 bg-blue-600 text-white':'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{images.find(i=>i.id===link.imageId)?.name||'Teknik Resim'}</button>)}
          <select aria-label="Ürün görseli bağla" value="" onChange={e=>bind(e.target.value)} className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs"><option value="">+ Görsel Bağla</option>{images.filter(i=>!charLinks.some(l=>l.imageId===i.id)).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <label className="h-8 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{uploading?'Yükleniyor…':'Yeni görsel yükle'}<input hidden type="file" accept="image/*,application/pdf" disabled={uploading} onChange={upload}/></label>
          {selectedLink&&<button type="button" title="Bu karakteristikten görseli kaldır" aria-label="Bu karakteristikten görseli kaldır" className="ml-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={()=>unbind(selectedLink.id)}>Görseli kaldır</button>}
        </div>
        {selectedLink&&selectedImage?<div className="relative"><AnnotationCanvas imageUrl={selectedImage.url} pointNo={char.pointNo} annotations={selectedLink.annotations||[]} onChange={annotations=>onChange({...plan,characteristicImageLinks:links.map(l=>l.id===selectedLink.id?{...l,annotations}:l)})}/>{charLinks.length>1&&<div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 text-xs shadow"><button type="button" aria-label="Önceki görsel" disabled={selectedImageIndex===0} onClick={()=>showImage(-1)} className="px-2 py-1 disabled:opacity-30">‹</button><span className="min-w-10 text-center font-semibold">{selectedImageIndex+1} / {charLinks.length}</span><button type="button" aria-label="Sonraki görsel" disabled={selectedImageIndex===charLinks.length-1} onClick={()=>showImage(1)} className="px-2 py-1 disabled:opacity-30">›</button></div>}</div>:<EmptyState title="Görsel referansı eklenmemiş" description="Bu kontrol noktası için görsel kullanmak zorunlu değildir."/>}
      </div>
      <div className="quality-card self-start p-4">
        <h3 className="text-base font-bold text-slate-900">#{char.pointNo} {char.name}</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-12">
          <label className="md:col-span-12">Karakteristik adı<input className={field} value={char.name} onChange={e=>update(char.id,{name:e.target.value})}/></label>
          <label className="md:col-span-4">Kontrol tipi<select className={field} value={char.type||'numeric'} onChange={e=>update(char.id,{type:e.target.value as CharacteristicType})}>{Object.entries(typeLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          <label className="md:col-span-4">Önem seviyesi<select className={field} value={char.criticalClass} onChange={e=>update(char.id,{criticalClass:e.target.value as CriticalClass})}>{Object.entries(severity).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          <label className="md:col-span-4">Kanıt politikası<select className={field} value={char.evidencePolicy||'none'} onChange={e=>update(char.id,{evidencePolicy:e.target.value as EvidencePolicy})}><option value="none">Kanıt yok</option><option value="optional">Fotoğraf opsiyonel</option><option value="required_on_fail">Uygunsuzlukta kanıt zorunlu</option><option value="photo_required">Fotoğraf zorunlu</option><option value="media_required">Fotoğraf veya video zorunlu</option><option value="document_required">Dosya/belge gerekli</option></select></label>
          {(char.type||'numeric')==='numeric'&&<><label className="md:col-span-3">Nominal<input type="number" step="0.001" className={field} value={char.nominal} onChange={e=>update(char.id,{nominal:Number(e.target.value)})}/></label><label className="md:col-span-3">Alt tolerans<input type="number" step="0.001" className={field} value={char.tolLower} onChange={e=>update(char.id,{tolLower:Number(e.target.value)})}/></label><label className="md:col-span-3">Üst tolerans<input type="number" step="0.001" className={field} value={char.tolUpper} onChange={e=>update(char.id,{tolUpper:Number(e.target.value)})}/></label><label className="md:col-span-3">Birim<select className={field} value={char.unit} onChange={e=>update(char.id,{unit:e.target.value as MeasurementUnit})}>{['mm','µm','°','N','Ra','kg','bar','adet'].map(v=><option key={v}>{v}</option>)}</select></label></>}
        </div>
      </div>
    </div>;
  };
  const summary=(c:Characteristic)=>`${(c.type||'numeric')==='numeric'?`${c.nominal} ${c.tolUpper>=0?'±':''}${Math.max(Math.abs(c.tolUpper),Math.abs(c.tolLower))} ${c.unit}`:typeLabel[c.type||'numeric']}`;
  const activeIndex=active?plan.characteristics.indexOf(active):-1;

  return <section className="mt-4 space-y-3">
    <div className="quality-card p-3">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
          <h2 className="text-base font-bold">Ölçüm Karakteristikleri</h2><span className="text-slate-300">·</span><span className="text-sm font-semibold text-slate-600">{plan.characteristics.length} / 50 Nokta</span><span className="text-slate-300">·</span>
          <button id="btn-toggle-all-characteristics" type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold" onClick={()=>setAll(!all)}>{all?'Tekli Görünüme Dön':'Hepsini Göster'}</button>
          <button id="btn-add-characteristic" type="button" disabled={plan.characteristics.length>=50} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-40" onClick={addCharacteristic}>+ Nokta Ekle</button>
          {active&&<button type="button" disabled={plan.characteristics.length<=1} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40" onClick={()=>deleteCharacteristic(active.id)}>Noktayı Sil</button>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">{plan.characteristics.map(c=><button id={`characteristic-chip-${c.pointNo}`} type="button" key={c.id} aria-pressed={c.id===activeId} style={{minHeight:36}} onClick={()=>{setActiveId(c.id);setAll(false);}} className={`h-9 w-10 flex-none rounded-lg border text-xs font-bold transition ${c.id===activeId?'border-blue-600 bg-blue-600 text-white shadow-sm':'border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'}`}>{c.pointNo}</button>)}</div>
    </div>
    {all?<div className="space-y-2">{plan.characteristics.map(c=><details key={c.id} data-characteristic-id={c.id} className={`rounded-xl bg-white p-4 shadow-sm ${c.id===activeId?'ring-2 ring-blue-300':''}`} onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)setActiveId(c.id);}}><summary className="cursor-pointer list-none"><span className="grid gap-2 sm:grid-cols-[55px_1fr_180px_90px_90px]"><b>#{c.pointNo}</b><span>{c.name}</span><span>{summary(c)}</span><span>{severity[c.criticalClass]}</span><span>{links.filter(l=>l.characteristicId===c.id).length||'Görsel Yok'}{links.some(l=>l.characteristicId===c.id)&&' Görsel'}</span></span></summary><div className="mt-4">{editor(c)}</div></details>)}</div>:active&&<>{editor(active)}<div className="flex justify-center"><div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"><button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30" disabled={activeIndex===0} onClick={()=>setActiveId(plan.characteristics[activeIndex-1].id)}>← Önceki</button><b className="min-w-14 text-center text-sm">{activeIndex+1} / {plan.characteristics.length}</b><button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30" disabled={activeIndex===plan.characteristics.length-1} onClick={()=>setActiveId(plan.characteristics[activeIndex+1].id)}>Sonraki →</button></div></div></>}
  </section>;
}
