import React, {useEffect, useRef, useState} from 'react';
import type {InspectionLog} from '../types';
import {useMediaSource,isPdfMedia} from './MediaImage';
import {SaasApi} from '../services/api';
import {archiveMobileSession,cellKey, changeMobileSession, commitMobileCell, emptyDraft, evaluateMeasurement, evidenceErrors, latestAttempt, mobileSummary, readMobileSession, syncMobileSession, type Cell, type MobileDraft, type MobileSession} from '../services/mobileMeasurement';
import './mobileMeasurement.css';

const labels = {pass:'✓ Uygun',fail:'✕ Uygunsuz',review:'⚠ Şüpheli · İnceleme bekliyor',unclassified:'○ Kalite kararı bekliyor',na:'○ Uygulanamaz (N/A)'};
function Sheet({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {ref.current?.showModal(); const previous = document.activeElement as HTMLElement; return () => previous?.focus?.();},[]);
  return <dialog ref={ref} className="mm-sheet" onCancel={e=>{e.preventDefault();onClose();}}><header><h2>{title}</h2><button onClick={onClose} aria-label="Kapat">✕</button></header>{children}</dialog>;
}
function Photo({file,onClick}:{key?:string;file:File;onClick:()=>void}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const url=URL.createObjectURL(file);setUrl(url);return()=>URL.revokeObjectURL(url);},[file]);
  return <button onClick={onClick} aria-label={`${file.name} büyüt`}>{file.type.startsWith('image/')?<img src={url} alt={file.name}/>:file.name}</button>;
}
export function MobileMeasurementShell({seed,onSaved,onExit,onOpenActions}:{seed?:MobileSession;onSaved:(log:InspectionLog)=>void;onExit:()=>void;onOpenActions?:()=>void}) {
  const scope=useRef(SaasApi.scope()).current;
  const [session,setSession]=useState<MobileSession>();
  const [draft,setDraft]=useState<MobileDraft>(emptyDraft());
  const draftRef=useRef(draft); const dirty=useRef(false); const writeChain=useRef(Promise.resolve());
  const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const [sheet,setSheet]=useState<'evidence'|'navigator'|'summary'|'drawing'|'history'|null>(null);
  const [pending,setPending]=useState<Cell|'exit'|null>(null);
  const [search,setSearch]=useState(''); const [remaining,setRemaining]=useState(false); const [group,setGroup]=useState(-1);
  const [online,setOnline]=useState(navigator.onLine); const [syncing,setSyncing]=useState(false);
  const [hand,setHand]=useState(()=>localStorage.getItem('ritim:measurement:hand')||'right');
  const [imageIndex,setImageIndex]=useState(0); const [zoom,setZoom]=useState(1); const [imageReady,setImageReady]=useState(false); const [imageFailed,setImageFailed]=useState(false); const [imageRetry,setImageRetry]=useState(0);
  const [photo,setPhoto]=useState<string>(); const [boundary,setBoundary]=useState<Cell>();
  const notified=useRef(''); const saveLock=useRef(false);
  const externalExit=useRef<(()=>void)|undefined>();
  const evidenceTarget=useRef<Cell|'exit'|undefined>();
  const showError=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
  const loadDraft=(s:MobileSession)=>{const d=s.drafts[cellKey(s.active)]||emptyDraft();draftRef.current=d;setDraft(d);dirty.current=Boolean(s.drafts[cellKey(s.active)]);};
  useEffect(()=>{let alive=true;void (async()=>{
    const found=await readMobileSession(scope);
    const s=found||await changeMobileSession(scope,()=>{if(!seed)throw new Error('Kurtarılacak mobil oturum bulunamadı.');return seed;});
    if(alive){setSession(s);loadDraft(s);void sync();}
  })().catch(showError);return()=>{alive=false;};},[scope]);
  const sync=async()=>{
    setSyncing(true);
    try {const s=await syncMobileSession(scope);if(s){setSession(s);if(s.confirmed&&notified.current!==s.id){notified.current=s.id;onSaved(s.confirmed);}}}catch(e){showError(e);}finally{setSyncing(false);}
  };
  useEffect(()=>{const update=()=>{setOnline(navigator.onLine);if(navigator.onLine)void sync();};window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{const unload=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);return()=>window.removeEventListener('beforeunload',unload);},[]);
  useEffect(()=>{const guard=(event:Event)=>{if(!dirty.current)return;event.preventDefault();externalExit.current=(event as CustomEvent).detail;setPending('exit');};window.addEventListener('ritim-measurement-navigate',guard);return()=>window.removeEventListener('ritim-measurement-navigate',guard);},[]);
  useEffect(()=>{const viewport=window.visualViewport;const update=()=>document.documentElement.style.setProperty('--mm-viewport',`${viewport?.height||window.innerHeight}px`);update();viewport?.addEventListener('resize',update);return()=>viewport?.removeEventListener('resize',update);},[]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),1500);return()=>clearTimeout(timer);},[message]);
  const c=session?.plan.characteristics.find(c=>c.id===session.active.characteristic);
  const links=session?.plan.characteristicImageLinks?.filter(l=>l.characteristicId===c?.id)||[];
  const references=links.map(l=>({link:l,image:session?.product.images?.find(i=>i.id===l.imageId)})).filter(r=>r.image);
  const reference=references[imageIndex]||references[0];
  const imageSource=reference?.image?.url||session?.plan.drawingImageUrl||session?.product.defaultDrawingUrl;
  const resolved=useMediaSource(imageSource,imageRetry);
  useEffect(()=>{setImageReady(false);setImageFailed(false);setZoom(1);},[imageSource,imageRetry]);
  useEffect(()=>{setImageIndex(0);},[c?.id]);
  const updateDraft=(patch:Partial<MobileDraft>)=>{
    if(!session||session.submissionRequested||session.submission||session.confirmed)return;
    const next={...draftRef.current,...patch};draftRef.current=next;setDraft(next);dirty.current=true;setError('');
    const key=cellKey(session.active);
    writeChain.current=writeChain.current.then(async()=>{await changeMobileSession(scope,s=>({...s!,drafts:{...s!.drafts,[key]:next}}));}).catch(showError);
  };
  const move=async(target:Cell|'exit')=>{
    await writeChain.current;
    if(target==='exit'){if(externalExit.current){const exit=externalExit.current;externalExit.current=undefined;exit();}else onExit();return;}
    const s=await changeMobileSession(scope,s=>({...s!,active:target}));setSession(s);loadDraft(s);setSheet(null);setError('');
  };
  const navigate=(target:Cell|'exit')=>{if(dirty.current)setPending(target);else void move(target).catch(showError);};
  const save=async(confirmedEvidence=false,target?:Cell|'exit')=>{
    if(!session||!c||saveLock.current)return false;
    setError('');
    try {
      const evaluated=evaluateMeasurement(c,draftRef.current.raw,draftRef.current.mode);
      const errors=evidenceErrors(c,evaluated.result,draftRef.current.photos.map(id=>({mimeType:session.media[id]?.file.type||''})),draftRef.current.comment,draftRef.current.reason);
      if(!confirmedEvidence&&(evaluated.result==='fail'||evaluated.result==='review'||errors.length)){evidenceTarget.current=target;setPending(null);setSheet('evidence');return false;}
      saveLock.current=true;setBusy(true);await writeChain.current;
      const s=await commitMobileCell(scope,session.active,draftRef.current,imageReady,latestAttempt(session,session.active)?.id||null);
      setSession(s);dirty.current=false;draftRef.current=emptyDraft();setDraft(emptyDraft());setMessage('✓ Cihazda kaydedildi');setSheet(null);setPending(null);
      const summary=mobileSummary(s);const index=summary.cells.findIndex(cell=>cellKey(cell)===cellKey(s.active));
      const next=[...summary.cells.slice(index+1),...summary.cells.slice(0,index)].find(cell=>!latestAttempt(s,cell));
      const attempt=latestAttempt(s,s.active)!;
      if(target)await move(target);
      else if(attempt.result==='review'||c.policy?.requireReview||c.policy?.requireSupervisorApproval)setSheet('history');
      else if(!next)setSheet('summary');
      else if(s.order==='sample'&&next.sample!==s.active.sample)setBoundary(next);
      else await move(next);
      void sync();return true;
    } catch(e){showError(e);return false;}finally{saveLock.current=false;setBusy(false);}
  };
  const addFiles=async(files:FileList|null,replaceId?:string)=>{
    if(!files?.length||!session)return;setBusy(true);
    try {
      const media=Array.from(files).map(file=>({id:crypto.randomUUID(),file}));
      if(media.some(m=>!m.file.size||!(/^(image|video)\//.test(m.file.type)||m.file.type==='application/pdf')))throw new Error('Fotoğraf, video veya PDF seçin.');
      const s=await changeMobileSession(scope,s=>({...s!,media:{...s!.media,...Object.fromEntries(media.map(m=>[m.id,m]))}}));setSession(s);updateDraft({photos:[...draftRef.current.photos.filter(id=>id!==replaceId),...media.map(m=>m.id)]});
    }catch(e){showError(e);}finally{setBusy(false);}
  };
  if(!session||!c)return <section className="mm-shell"><p role={error?'alert':'status'}>{error||'Yerel ölçüm oturumu açılıyor…'}</p><button onClick={onExit}>Hazırlığa dön</button></section>;
  const summary=mobileSummary(session);const current=latestAttempt(session,session.active);const locked=Boolean(session.submissionRequested||session.submission||session.confirmed);
  let preview:ReturnType<typeof evaluateMeasurement>|undefined;let validation='';try{preview=evaluateMeasurement(c,draft.raw,draft.mode);}catch(e){validation=(e as Error).message;}
  const activeIndex=session.plan.characteristics.findIndex(item=>item.id===c.id);
  const options=c.type==='boolean'?['yes','no']:c.type==='visual'?['OK','NOK','SUSPECT']:c.type==='ok_nok'?['OK','NOK']:c.options||[];
  const choiceLabels:Record<string,string>={yes:'Evet',no:'Hayır',OK:'✓ Uygun',NOK:'✕ Uygunsuz',SUSPECT:'⚠ Şüpheli'};
  const goNext=()=>{const next=summary.missing.find(cell=>cellKey(cell)!==cellKey(session.active));if(next)navigate(next);else setSheet('summary');};
  const drawing=<>
    {!!references.length&&<select aria-label="Referans resim" value={imageIndex} onChange={e=>setImageIndex(Number(e.target.value))}>{references.map((r,i)=><option key={r.link.id} value={i}>{r.image!.name}</option>)}</select>}
    {imageSource?<><div className="mm-drawing-tools"><button onClick={()=>{setZoom(z=>Math.min(4,z+.5));}}>＋</button><button onClick={()=>setZoom(z=>Math.max(1,z-.5))}>−</button><button onClick={()=>setZoom(1)}>Sığdır</button><button onClick={()=>setSheet(sheet==='drawing'?null:'drawing')}>{sheet==='drawing'?'Küçült':'Büyüt'}</button></div><div className="mm-drawing-scroll"><div className="mm-drawing-image" style={{width:`${zoom*100}%`}}>
      {resolved&&(isPdfMedia(imageSource)?<object data={resolved} type="application/pdf" aria-label={`${c.name} PDF teknik resmi`} style={{width:'100%',height:400}} onLoad={()=>setImageReady(true)} onError={()=>setImageFailed(true)}><p>PDF bu cihazda görüntülenemiyor.</p></object>:<img key={`${imageSource}:${imageRetry}`} src={resolved} alt={`${c.name} teknik resmi`} onLoad={()=>{setImageReady(true);setImageFailed(false);}} onError={()=>{setImageReady(false);setImageFailed(true);}}/>)}
      {imageReady&&reference&&<svg className="mm-annotations" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{reference.link.annotations.map(a=>a.type==='measurement_line'?<line key={a.id} x1={a.startX} y1={a.startY} x2={a.endX} y2={a.endY} stroke={a.color||'#245b86'} strokeWidth=".5"/>:a.type==='area'?<rect key={a.id} x={Math.min(a.startX,a.endX)} y={Math.min(a.startY,a.endY)} width={Math.abs(a.endX-a.startX)} height={Math.abs(a.endY-a.startY)} fill="none" stroke={a.color||'#245b86'} strokeWidth=".5"/>:null)}</svg>}
      {imageReady&&(reference?session.plan.characteristicImageLinks?.filter(l=>l.imageId===reference.image!.id).flatMap(l=>l.annotations.filter(a=>a.type==='pin').map(a=>({c:session.plan.characteristics.find(c=>c.id===l.characteristicId),x:'x' in a?a.x:0,y:'y' in a?a.y:0}))):session.plan.characteristics.map(c=>({c,x:c.pin.x,y:c.pin.y})))?.map((p,i)=>p.c&&<button key={i} className={`mm-pin ${p.c.id===c.id?'active':''}`} style={{left:`${p.x}%`,top:`${p.y}%`}} aria-label={`Nokta ${p.c.pointNo}: ${p.c.name}`} onClick={()=>navigate({sample:session.active.sample,characteristic:p.c!.id})}>{p.c.pointNo}</button>)}
    </div></div>{(!resolved||imageFailed)&&<p role="alert">Teknik resim yüklenemedi. <button onClick={()=>setImageRetry(n=>n+1)}>Tekrar dene</button></p>}</>:<p>Bu nokta için teknik resim eklenmemiş.</p>}
    <p className="mm-instruction">{c.description||'Kontrol planındaki ölçüm talimatını uygulayın.'}</p>
  </>;
  const errorBlock=error&&<p role="alert" className="mm-error">{error}</p>;
  return <section className="mm-shell" data-hand={hand} aria-label="Mobil ölçüm istasyonu" onKeyDown={e=>{if(e.key==='Enter'&&!sheet&&!pending&&e.target instanceof HTMLElement&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();void save();}}}>
    <header className="mm-context"><strong>RITIM QUALITY</strong><button onClick={()=>navigate('exit')}>Taslağı bırak</button><span>{session.product.code} · {session.product.name}</span><small>İş emri: {session.orderNumber||'—'} · Lot: {session.lotNumber||'—'} · Seri: {session.serialNumber||'—'} · Rev. {session.plan.version}</small></header>
    <div className="mm-connectivity" role="status">{online?'● Çevrimiçi':'⚠ Çevrimdışı'} · {syncing?'Senkronizasyon sürüyor':session.confirmed?'Senkronlandı':`${session.attempts.length} deneme cihazda · ${summary.photos} medya bekliyor`}</div>
    {session.syncError&&<div role="alert" className="mm-error">Gönderim tamamlanmadı: {session.syncError}<button disabled={syncing} onClick={()=>void sync()}>Yeniden gönder</button></div>}
    <details className="mm-preferences"><summary>Giriş ayarları · {session.order==='sample'?'Numune sırası':'Karakteristik sırası'} · {hand==='right'?'Sağ el':'Sol el'}</summary><div className="mm-settings"><select aria-label="Ölçüm sırası" value={session.order} onChange={e=>{const order=e.target.value as MobileSession['order'];void changeMobileSession(scope,s=>({...s!,order})).then(setSession).catch(showError);}}><option value="sample">Numune bazlı sıra</option><option value="characteristic">Karakteristik bazlı sıra</option></select><select aria-label="El tercihi" value={hand} onChange={e=>{setHand(e.target.value);try{localStorage.setItem('ritim:measurement:hand',e.target.value);}catch{setError('El tercihi cihazda saklanamadı.');}}}><option value="right">Sağ el</option><option value="left">Sol el</option></select></div><label className="mm-mode"><input type="checkbox" checked={draft.mode==='delta'} onChange={e=>updateDraft({mode:e.target.checked?'delta':'absolute'})}/> Nominalden sapma girişi</label></details>
    <div className="mm-drawing">{drawing}</div>
    <div className="mm-characteristic"><h1>{activeIndex+1} / {session.plan.characteristics.length} · {c.name}</h1><button onClick={()=>setSheet('navigator')}>Noktalar · {summary.cells.length-summary.missing.length}/{summary.cells.length}</button></div>
    <div className="mm-samples" aria-label="Numuneler">{Array.from({length:session.count},(_,i)=>i+1).map(sample=><button key={sample} aria-pressed={sample===session.active.sample} onClick={()=>navigate({sample,characteristic:c.id})}>S{sample} {session.attempts.some(a=>a.sample===sample&&a.result==='fail')?'✕':summary.missing.some(cell=>cell.sample===sample)?'○':'✓'}</button>)}</div>
    {(c.type||'numeric')==='numeric'&&<dl className="mm-limits"><div><dt>Alt sınır</dt><dd>{c.lsl??'—'}</dd></div><div><dt>Nominal</dt><dd>{c.nominal}</dd></div><div><dt>Üst sınır</dt><dd>{c.usl??'—'}</dd></div><span>{c.unit}</span></dl>}
    {current&&!dirty.current&&<div className="mm-saved">{labels[current.result]} · Son kayıt: {String(current.value)} <button disabled={locked} onClick={()=>{updateDraft({raw:'',retryReason:''});setSheet('history');}}>Tekrar ölç</button></div>}
    {!locked&&<fieldset disabled={busy} className="mm-input"><legend className="sr-only">Ölçüm girişi</legend>
      {(c.type||'numeric')==='numeric'?<><input id="mobile-measured-value" aria-label="Ölçüm değeri" inputMode="none" readOnly value={String(draft.raw).replace('.',',')} placeholder="Değer girin"/>{draft.mode==='delta'&&<p>Nominal {c.nominal} + sapma {String(draft.raw)||'—'} = mutlak {preview?.value??'—'} {c.unit}</p>}
      {!sheet&&!pending&&<div className="mm-keypad">{['1','2','3','4','5','6','7','8','9',',','0','⌫'].map(key=><button key={key} onClick={()=>{let raw=String(draftRef.current.raw);raw=key==='⌫'?raw.slice(0,-1):raw+key;updateDraft({raw});}}>{key}</button>)}{c.allowNegative!==false&&<button onClick={()=>updateDraft({raw:String(draft.raw).startsWith('-')?String(draft.raw).slice(1):'-'+draft.raw})}>±</button>}</div>}</>:c.type==='text'?<textarea aria-label="Metin sonucu" maxLength={c.policy?.maxTextLength||2000} value={String(draft.raw)} onChange={e=>updateDraft({raw:e.target.value})}/>:<div className="mm-choices">{options.map(option=><button key={option} aria-pressed={Array.isArray(draft.raw)?draft.raw.includes(option):draft.raw===option} onClick={()=>updateDraft({raw:c.type==='multi_select'?(Array.isArray(draft.raw)&&draft.raw.includes(option)?draft.raw.filter(v=>v!==option):[...(Array.isArray(draft.raw)?draft.raw:[]),option]):option})}>{choiceLabels[option]||option}</button>)}</div>}
      <p className={`mm-preview ${preview?.result||''}`} role="status">{preview?`${labels[preview.result]} · Henüz kaydedilmedi`:dirty.current?validation:'Henüz değer girilmedi'}</p>
      {preview?.result==='fail'&&typeof preview.value==='number'&&<p>{preview.value<c.lsl?`Alt sınırın ${Number((c.lsl-preview.value).toPrecision(10))} altında`:`Üst sınırın ${Number((preview.value-c.usl).toPrecision(10))} üzerinde`} {c.unit}</p>}
    </fieldset>}
    <p className="mm-instruction">Kaynak: {session.source==='manual'?'Manuel':session.source} · Alet: {session.instrumentId||'Belirtilmedi'}</p>
    {errorBlock}<p role="status" className="mm-feedback">{message}</p>
    <footer className="mm-actions"><button onClick={()=>{const i=summary.cells.findIndex(cell=>cellKey(cell)===cellKey(session.active));if(i>0)navigate(summary.cells[i-1]);}}>Önceki</button><button className="mm-primary" disabled={busy||locked} onClick={()=>void save()}>Kaydet ve ilerle</button><button onClick={goNext}>Sonraki eksik</button></footer>
    <div className="mm-secondary"><button onClick={()=>setSheet('evidence')}>Kanıt / açıklama</button><button onClick={()=>setSheet('history')}>Denemeler</button><button onClick={()=>setSheet('summary')}>Kontrol özeti</button>{c.policy?.allowNA&&<button disabled={locked} onClick={()=>{updateDraft({raw:'__NA__'});setSheet('evidence');}}>Uygulanamaz (N/A)</button>}</div>
    {sheet==='drawing'&&<Sheet title="Teknik resim" onClose={()=>setSheet(null)}>{drawing}</Sheet>}
    {sheet==='evidence'&&<Sheet title="Kanıt ve uygunsuzluk" onClose={()=>setSheet(null)}><p>{preview?labels[preview.result]:'Sonuç girişi bekleniyor'} · {String(preview?.value??'—')} {c.unit}</p><p>Alt {c.lsl} · Nominal {c.nominal} · Üst {c.usl}</p><fieldset disabled={busy||locked}><label>Açıklama<textarea maxLength={2000} value={draft.comment} onChange={e=>updateDraft({comment:e.target.value})}/></label><label>Kusur sebebi{c.policy?.reasons?.length?<select value={draft.reason} onChange={e=>updateDraft({reason:e.target.value})}><option value="">Seçin</option>{c.policy.reasons.map(r=><option key={r}>{r}</option>)}</select>:<input value={draft.reason} onChange={e=>updateDraft({reason:e.target.value})}/>}</label><div className="mm-secondary"><label className="mm-file">Fotoğraf çek<input type="file" accept="image/*" capture="environment" onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label><label className="mm-file">Dosya ekle<input type="file" accept="image/*,video/*,application/pdf" multiple onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label></div><p>Kamera açılamıyorsa cihaz izinlerini kontrol edin veya plan izin veriyorsa dosya seçin.</p><div className="mm-photos">{draft.photos.map(id=>session.media[id]&&<div key={id}><Photo file={session.media[id].file} onClick={()=>setPhoto(id)}/><button onClick={()=>updateDraft({photos:draft.photos.filter(p=>p!==id)})}>Kaldır</button><label className="mm-file">Yeniden çek<input type="file" accept="image/*" capture="environment" onChange={async e=>{const files=e.target.files;if(files?.length){await addFiles(files,id);}}}/></label></div>)}</div></fieldset>
      {preview&&evidenceErrors(c,preview.result,draft.photos.map(id=>({mimeType:session.media[id]?.file.type||''})),draft.comment,draft.reason).map(e=><p className="mm-error" key={e}>{e}</p>)}{errorBlock}<div className="mm-sheet-actions"><button onClick={()=>setSheet(null)}>Girişe dön</button><button disabled={busy||locked} className="mm-primary" onClick={()=>void save(true,evidenceTarget.current)}>Sonucu kaydet</button></div></Sheet>}
    {sheet==='navigator'&&<Sheet title="Karakteristik gezgini" onClose={()=>setSheet(null)}><input aria-label="Karakteristik ara" placeholder="Numara veya ad ara" value={search} onChange={e=>setSearch(e.target.value)}/><label><input type="checkbox" checked={remaining} onChange={e=>setRemaining(e.target.checked)}/> Sadece kalanlar</label><div className="mm-groups"><button onClick={()=>setGroup(-1)}>Tümü</button>{Array.from({length:Math.ceil(session.plan.characteristics.length/10)},(_,i)=><button key={i} aria-pressed={group===i} onClick={()=>setGroup(i)}>{i*10+1}–{Math.min((i+1)*10,session.plan.characteristics.length)}</button>)}</div><div className="mm-navigator">{session.plan.characteristics.filter((item,i)=>(group<0||Math.floor(i/10)===group)&&`${item.pointNo} ${item.name}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))&&(!remaining||!latestAttempt(session,{sample:session.active.sample,characteristic:item.id}))).map(item=>{const attempt=latestAttempt(session,{sample:session.active.sample,characteristic:item.id});return <button key={item.id} onClick={()=>navigate({sample:session.active.sample,characteristic:item.id})}>#{item.pointNo} {item.name}<small>{attempt?labels[attempt.result]:'○ Bekliyor'}{session.attempts.some(a=>a.sample===session.active.sample&&a.characteristic===item.id&&a.result==='fail')?' · İlk uygunsuzluk korunuyor':''}</small></button>;})}</div></Sheet>}
    {sheet==='history'&&<Sheet title="Ölçüm denemeleri" onClose={()=>setSheet(null)}>{session.attempts.filter(a=>cellKey(a)===cellKey(session.active)).map(a=><article key={a.id}><strong>{labels[a.result]} · {String(a.value)}</strong><p>{a.operatorId} · {new Date(a.measuredAt).toLocaleString('tr-TR')}</p><p>{a.comment} {a.reason} {a.retryReason}</p><div className="mm-photos">{a.photos.map(id=><Photo key={id} file={session.media[id].file} onClick={()=>setPhoto(id)}/>)}</div></article>)}{current&&!locked&&<><label>Tekrar ölçüm sebebi<input value={draft.retryReason} onChange={e=>updateDraft({retryReason:e.target.value})}/></label><button onClick={()=>{updateDraft({raw:''});setSheet(null);}}>Yeni denemeye başla</button></>}<p>İlk uygunsuzluk yeni uygun sonuçla kapanmaz. İnceleme / yetkili karar ayrı yürütülür.</p><button onClick={onOpenActions}>Görev ve onayları aç</button></Sheet>}
    {sheet==='summary'&&<Sheet title="Kontrol özeti" onClose={()=>setSheet(null)}><p>{summary.missing.length?`${summary.missing.length} hücre eksik`:'✓ Veri toplama tamamlandı'}</p><p>{session.confirmed?'✓ Senkronlandı':`${session.attempts.length} deneme ve ${summary.photos} medya gönderimi bekliyor`}</p><p>{summary.review?'⚠ İnceleme / onay bekliyor':'Kalite sonucu: kayıtlı ölçümlere göre uygun'}</p><p>Kontrol kapatılmadı. Sunucu kaydı ve yetkili kapanış kararı ayrı işlemlerdir.</p>{errorBlock}<button disabled={!!summary.missing.length||locked||!online} onClick={()=>void changeMobileSession(scope,s=>({...s!,submissionRequested:true})).then(s=>{setSession(s);void sync();}).catch(showError)}>Kontrolü sunucuya gönder</button><button disabled={!session.confirmed} onClick={()=>void archiveMobileSession(scope).then(onExit).catch(showError)}>Yeni kontrol</button><button disabled={syncing||!online} onClick={()=>void sync()}>Senkronizasyonu tekrar dene</button><button onClick={()=>{setSheet(null);goNext();}}>Eksiklere dön</button><button onClick={onOpenActions}>Görev ve onayları aç</button></Sheet>}
    {pending&&<Sheet title="Kaydedilmemiş giriş var" onClose={()=>setPending(null)}><p>Girişi kaydedebilir veya cihazdaki taslakta bırakabilirsiniz.</p>{errorBlock}<button disabled={busy} onClick={()=>void save(false,pending)}>Kaydet</button><button onClick={()=>{const target=pending;setPending(null);void move(target).catch(showError);}}>Taslakta bırak</button><button onClick={()=>setPending(null)}>Vazgeç</button></Sheet>}
    {boundary&&<Sheet title={`S${session.active.sample} veri toplama tamamlandı`} onClose={()=>setBoundary(undefined)}><p>Uygunsuz denemeler: {session.attempts.filter(a=>a.sample===session.active.sample&&a.result==='fail').length}</p><button className="mm-primary" onClick={()=>{const next=boundary;setBoundary(undefined);void move(next).catch(showError);}}>S{boundary.sample} numunesine devam et</button></Sheet>}
    {photo&&session.media[photo]&&<Sheet title="Kanıt önizlemesi" onClose={()=>setPhoto(undefined)}><Photo file={session.media[photo].file} onClick={()=>{}}/></Sheet>}
  </section>;
}
