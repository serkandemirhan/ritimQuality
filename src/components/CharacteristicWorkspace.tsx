import { Button, Card, Field, Input, NumberInput, Select, Textarea, ToleranceBand, Badge } from './ui';
import React,{useEffect,useMemo,useState} from 'react';
import type {Characteristic,CharacteristicImageLink,ControlPlan,CriticalClass,EvidencePolicy,Product,ProductImage,CharacteristicType,MeasurementUnit,MeasurementTool} from '../types';
import {SaasApi} from '../services/api';
import {StorageService} from '../services/storage';
import {AnnotationCanvas} from './AnnotationCanvas';
import {EmptyState} from './EmptyState';

const field='rq-input';
const typeLabel:Record<CharacteristicType,string>={numeric:'Sayısal',ok_nok:'OK/NOK',visual:'Görsel',single_select:'Tekli Seçim',multi_select:'Çoklu Seçim',boolean:'Evet / Hayır',text:'Metin'};
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
    return <div className="rq-characteristic-editor">
      <div className="min-w-0">
        <div className="rq-reference-toolbar mb-2 flex flex-wrap items-center gap-2">
          {charLinks.map(link=><Button type="button" key={link.id} onClick={()=>setImageId(link.imageId)} className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold ${selectedLink?.id===link.id?'border-blue-600 bg-blue-600 text-white':'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{images.find(i=>i.id===link.imageId)?.name||'Teknik Resim'}</Button>)}
          <Select aria-label="Ürün görseli bağla" value="" onChange={e=>bind(e.target.value)} className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs"><option value="">+ Görsel Bağla</option>{images.filter(i=>!charLinks.some(l=>l.imageId===i.id)).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</Select>
          <label className="h-8 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{uploading?'Yükleniyor…':'Yeni görsel yükle'}<input hidden type="file" accept="image/*,application/pdf" disabled={uploading} onChange={upload}/></label>
          {selectedLink&&<Button type="button" title="Bu karakteristikten görseli kaldır" aria-label="Bu karakteristikten görseli kaldır" className="ml-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={()=>unbind(selectedLink.id)}>Görseli kaldır</Button>}
        </div>
        {selectedLink&&selectedImage?<div className="relative"><AnnotationCanvas imageUrl={selectedImage.url} pointNo={char.pointNo} annotations={selectedLink.annotations||[]} onChange={annotations=>onChange({...plan,characteristicImageLinks:links.map(l=>l.id===selectedLink.id?{...l,annotations}:l)})}/>{charLinks.length>1&&<div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 text-xs shadow"><Button type="button" aria-label="Önceki görsel" disabled={selectedImageIndex===0} onClick={()=>showImage(-1)} className="px-2 py-1 disabled:opacity-30">‹</Button><span className="min-w-10 text-center font-semibold">{selectedImageIndex+1} / {charLinks.length}</span><Button type="button" aria-label="Sonraki görsel" disabled={selectedImageIndex===charLinks.length-1} onClick={()=>showImage(1)} className="px-2 py-1 disabled:opacity-30">›</Button></div>}</div>:<EmptyState title="Görsel referansı eklenmemiş" description="Bu kontrol noktası için görsel kullanmak zorunlu değildir."/>}
      </div>
      <Card className="rq-characteristic-properties">
        <h3 className="text-base font-bold text-slate-900">#{char.pointNo} {char.name}</h3>
        <div className="mt-4 space-y-3">
          <Field label="Karakteristik adı"><Input value={char.name} onChange={e=>update(char.id,{name:e.target.value})}/></Field>
          <Field label="Kontrol tipi"><Select value={char.type||'numeric'} onChange={e=>update(char.id,{type:e.target.value as CharacteristicType})}>{Object.entries(typeLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></Field>
          <details><summary>Mobil ölçüm ve kanıt kuralları</summary><div className="grid gap-3 mt-3">
            {(char.type||'numeric')==='numeric'&&<Field label="Ondalık hassasiyet (isteğe bağlı)"><NumberInput min={0} max={12} value={char.precision??''} onChange={e=>update(char.id,{precision:e.target.value===''?undefined:Number(e.target.value)})}/></Field>}
            {char.type==='boolean'&&['yes','no'].map(value=><div key={value}><Field label={value==='yes'?'Evet sonucu':'Hayır sonucu'}><Select value={char.optionResults?.[value]||''} onChange={e=>update(char.id,{optionResults:{...char.optionResults,[value]:(e.target.value||undefined) as 'pass'|'fail'|'review'}})}><option value="">Kalite kararı tanımsız</option><option value="pass">Uygun</option><option value="fail">Uygunsuz</option><option value="review">İnceleme</option></Select></Field></div>)}
            <Field label="Uygunsuz / şüpheli sonuçta en az fotoğraf"><NumberInput min={0} max={100} value={char.policy?.minPhotos??0} onChange={e=>update(char.id,{policy:{...char.policy,minPhotos:Number(e.target.value)}})}/></Field>
            <Field label="En fazla fotoğraf (isteğe bağlı)"><NumberInput min={0} max={100} value={char.policy?.maxPhotos??''} onChange={e=>update(char.id,{policy:{...char.policy,maxPhotos:e.target.value===''?undefined:Number(e.target.value)}})}/></Field>
            {([['requireComment','Uygunsuzlukta açıklama zorunlu'],['requireReason','Uygunsuzlukta kusur sebebi zorunlu'],['requireReview','İnceleme zorunlu'],['requireSupervisorApproval','Yetkili onayı zorunlu'],['drawingRequired','Teknik resim zorunlu'],['requireInstrument','Ölçüm aleti kimliği zorunlu']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(char.policy?.[key])} onChange={e=>update(char.id,{policy:{...char.policy,[key]:e.target.checked}})}/> {label}</label>)}
            <Field label="Kusur sebepleri (her satıra bir sebep)"><Textarea value={char.policy?.reasons?.join('\n')||''} onChange={e=>update(char.id,{policy:{...char.policy,reasons:e.target.value.split('\n').filter(Boolean)}})}/></Field>
          </div></details>
          <div className="grid grid-cols-2 gap-3"><Field label="Önem seviyesi"><Select value={char.criticalClass} onChange={e=>update(char.id,{criticalClass:e.target.value as CriticalClass})}>{Object.entries(severity).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></Field><Field label="Kanıt politikası"><Select value={char.evidencePolicy||'none'} onChange={e=>update(char.id,{evidencePolicy:e.target.value as EvidencePolicy})}><option value="none">Kanıt yok</option><option value="optional">İsteğe bağlı</option><option value="required_on_fail">Uygunsuzlukta zorunlu</option><option value="always_required">Her zaman zorunlu</option><option value="photo_required">Fotoğraf zorunlu</option><option value="media_required">Fotoğraf veya video</option><option value="document_required">Dosya / belge gerekli</option></Select></Field></div>
          {(char.type||'numeric')==='numeric'&&<><div className="grid grid-cols-2 gap-3"><Field label="Nominal"><NumberInput step="0.001" value={char.nominal} onChange={e=>update(char.id,{nominal:Number(e.target.value)})}/></Field><Field label="Birim"><Select value={char.unit} onChange={e=>update(char.id,{unit:e.target.value as MeasurementUnit})}>{['mm','µm','°','N','Ra','kg','bar','adet'].map(v=><option key={v}>{v}</option>)}</Select></Field><Field label="Alt tolerans"><NumberInput step="0.001" value={char.tolLower} onChange={e=>update(char.id,{tolLower:Number(e.target.value)})}/></Field><Field label="Üst tolerans"><NumberInput step="0.001" value={char.tolUpper} onChange={e=>update(char.id,{tolUpper:Number(e.target.value)})}/></Field></div><ToleranceBand nominal={char.nominal} lsl={char.lsl} usl={char.usl} unit={char.unit}/></>}
          {(char.type==='single_select'||char.type==='multi_select')&&<><Field label="Seçenekler" hint="Her satıra bir seçenek yazın."><Textarea value={(char.options||[]).join('\n')} onChange={e=>update(char.id,{options:e.target.value.split('\n')})}/></Field><Field label="Uygunsuz seçenekler" hint="Her satıra bir seçenek yazın."><Textarea value={(char.rejectedOptions||[]).join('\n')} onChange={e=>update(char.id,{rejectedOptions:e.target.value.split('\n').filter(Boolean)})}/></Field></>}
          <Field label="Ölçüm aleti"><Select value={char.tool} onChange={e=>update(char.id,{tool:e.target.value as MeasurementTool})}>{['Dijital Kumpas 0.01','Mikrometre 0.001','CMM 3D Ölçüm Cihazı','Mihengir / Yükseklik Mastarı','Profil Projeksiyon / Optik','Yüzey Pürüzlülük (Surftest)','Geçer / Geçmez Tampon Mastar','Torkmetre','Sertlik Ölçüm Cihazı (HRC/HB)','Diğer Ölçüm Aleti'].map(tool=><option key={tool}>{tool}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Numune"><Input value={char.sampleSize} onChange={e=>update(char.id,{sampleSize:e.target.value})}/></Field><Field label="Kontrol sıklığı"><Input value={char.frequency} onChange={e=>update(char.id,{frequency:e.target.value})}/></Field></div>
          <Field label="Kontrol açıklaması"><Textarea rows={2} value={char.description||''} onChange={e=>update(char.id,{description:e.target.value})}/></Field>
        </div>
      </Card>
    </div>;
  };
  const summary=(c:Characteristic)=>`${(c.type||'numeric')==='numeric'?`${c.nominal} ${c.tolUpper>=0?'±':''}${Math.max(Math.abs(c.tolUpper),Math.abs(c.tolLower))} ${c.unit}`:typeLabel[c.type||'numeric']}`;
  const activeIndex=active?plan.characteristics.indexOf(active):-1;

  return <section className="rq-plan-workspace">
    <aside className="rq-plan-structure rq-card">
      <h2 className="rq-section-title">Plan yapısı</h2><p className="rq-helper rq-technical">{plan.version} · {plan.characteristics.length} / 50 nokta</p>
      <div className="rq-plan-point-list">{plan.characteristics.map(c=><Button id={`characteristic-chip-${c.pointNo}`} key={c.id} aria-pressed={c.id===activeId} onClick={()=>{setActiveId(c.id);setAll(false);}}><span className="rq-point-number">{c.pointNo}</span><span><strong>{c.name}</strong><small>{typeLabel[c.type||'numeric']}</small></span></Button>)}</div>
      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4"><Button id="btn-add-characteristic" disabled={plan.characteristics.length>=50} onClick={addCharacteristic}>+ Nokta ekle</Button><Button id="btn-toggle-all-characteristics" aria-pressed={all} onClick={()=>setAll(!all)}>{all?'Tekli görünüme dön':'Hepsini göster'}</Button>{active&&<Button variant="danger" disabled={plan.characteristics.length<=1} onClick={()=>deleteCharacteristic(active.id)}>Noktayı sil</Button>}</div>
    </aside>
    <div className="min-w-0 space-y-3">
    {all?<div className="space-y-2">{plan.characteristics.map(c=><details key={c.id} data-characteristic-id={c.id} className={`rounded-xl bg-white p-4 shadow-sm ${c.id===activeId?'ring-2 ring-blue-300':''}`} onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)setActiveId(c.id);}}><summary className="cursor-pointer list-none"><span className="grid gap-2 sm:grid-cols-[55px_1fr_180px_90px_90px]"><b>#{c.pointNo}</b><span>{c.name}</span><span>{summary(c)}</span><span>{severity[c.criticalClass]}</span><span>{links.filter(l=>l.characteristicId===c.id).length||'Görsel Yok'}{links.some(l=>l.characteristicId===c.id)&&' Görsel'}</span></span></summary><div className="mt-4">{editor(c)}</div></details>)}</div>:active&&<>{editor(active)}<div className="flex justify-center"><div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"><Button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30" disabled={activeIndex===0} onClick={()=>setActiveId(plan.characteristics[activeIndex-1].id)}>← Önceki</Button><b className="min-w-14 text-center text-sm">{activeIndex+1} / {plan.characteristics.length}</b><Button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30" disabled={activeIndex===plan.characteristics.length-1} onClick={()=>setActiveId(plan.characteristics[activeIndex+1].id)}>Sonraki →</Button></div></div></>}
    </div>
  </section>;
}
