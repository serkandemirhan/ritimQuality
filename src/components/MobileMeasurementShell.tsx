import {revisionLabel} from '../services/presentation';
import {StorageService} from '../services/storage';
import React, {useEffect, useRef, useState, useCallback} from 'react';
import {MoreHorizontal} from 'lucide-react';
import type {InspectionLog} from '../types';
import {useDrawingSource} from './MediaImage';
import {SaasApi} from '../services/api';
import {discardMobileSession,finishMobileSession,cellKey, changeMobileSession, commitMobileCell, emptyDraft, evaluateMeasurement, evidenceErrors, latestAttempt, mobileSummary, readMobileSession, syncMobileSession, type Cell, type MobileDraft, type MobileSession} from '../services/mobileMeasurement';
import './mobileMeasurement.css';

const labels = {pass:'✓ Uygun',fail:'✕ Uygunsuz',review:'⚠ Şüpheli · İnceleme bekliyor',unclassified:'○ Kalite kararı bekliyor',na:'○ Uygulanamaz (N/A)'};
function Sheet({title,children,onClose,footer,context}:{title:string;children:React.ReactNode;onClose:()=>void;footer?:React.ReactNode;context?:React.ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement,dialog=ref.current!;dialog.showModal();
  const viewport=window.visualViewport;
  const layout=()=>{const height=viewport?.height||innerHeight;dialog.style.maxHeight=`${Math.max(120,height-16)}px`;dialog.style.top=`${(viewport?.offsetTop||0)+Math.max(8,height-dialog.getBoundingClientRect().height-8)}px`;};
  const observer=new ResizeObserver(layout);observer.observe(dialog);layout();viewport?.addEventListener('resize',layout);viewport?.addEventListener('scroll',layout);
  return()=>{observer.disconnect();viewport?.removeEventListener('resize',layout);viewport?.removeEventListener('scroll',layout);if(previous?.isConnected)previous.focus?.({preventScroll:true});};
 },[]);
 return <dialog ref={ref} className="mm-sheet" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><header><div><h2>{title}</h2>{context}</div><button onClick={onClose} aria-label="Kapat">✕</button></header><div className="mm-sheet-body" onFocusCapture={e=>{const target=e.target;if(target instanceof HTMLElement&&target.matches('input:not([type=file]),textarea,select'))setTimeout(()=>{if(target.isConnected)target.scrollIntoView({block:'nearest'});},250);}}>{children}</div>{footer&&<div className="mm-sheet-footer">{footer}</div>}</dialog>;
}
function Photo({file,onClick}:{key?:string;file:File;onClick:()=>void}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{const url=URL.createObjectURL(file);setUrl(url);return()=>URL.revokeObjectURL(url);},[file]);
  return <button onClick={onClick} aria-label={`${file.name} büyüt`}>{file.type.startsWith('image/')?<img src={url} alt={file.name}/>:file.name}</button>;
}
export function MobileMeasurementShell({seed,onSaved,onExit,onOpenActions,onCompleted}:{seed?:MobileSession;onSaved:(log:InspectionLog)=>void;onExit:()=>void;onOpenActions?:()=>void;onCompleted:(log:InspectionLog)=>void}) {
  const shellRef=useRef<HTMLElement>(null);
  const scope=useRef(SaasApi.scope()).current;
  const [session,setSession]=useState<MobileSession>();
  const [draft,setDraft]=useState<MobileDraft>(emptyDraft());
  const draftRef=useRef(draft); const dirty=useRef(false); const writeChain=useRef(Promise.resolve());
  const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  const [sheet,setSheet]=useState<'evidence'|'navigator'|'summary'|'drawing'|'history'|'tools'|'matrix'|'retry'|'discard'|null>(null);
  const [pending,setPending]=useState<Cell|'exit'|null>(null);
  const [matrixFilter,setMatrixFilter]=useState('all');
  const [search,setSearch]=useState(''); const [remaining,setRemaining]=useState(false); const [group,setGroup]=useState(-1);
  const [editingCompleted,setEditingCompleted]=useState(false);
  const [online,setOnline]=useState(navigator.onLine); const [syncing,setSyncing]=useState(false);
  const [hand,setHand]=useState(()=>localStorage.getItem('ritim:measurement:hand')||'right');
  const [imageIndex,setImageIndex]=useState(0); const [zoom,setZoom]=useState(1); const [imageReady,setImageReady]=useState(false); const [imageFailed,setImageFailed]=useState(false); const [imageRetry,setImageRetry]=useState(0);
  const [imageRatio,setImageRatio]=useState(1);
  const [photo,setPhoto]=useState<string>(); const [boundary,setBoundary]=useState<Cell>();
  const notified=useRef(''); const saveLock=useRef(false);
  const externalExit=useRef<(()=>void)|undefined>(undefined);
  const evidenceTarget=useRef<Cell|'exit'|undefined>(undefined);
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
  useEffect(()=>{
    const viewport=window.visualViewport;
    const update=()=>{
      const height=viewport?.height||window.innerHeight;
      document.documentElement.style.setProperty('--mm-viewport',`${height}px`);
      if(shellRef.current)shellRef.current.style.setProperty('--mm-space',`${Math.max(0,height-shellRef.current.getBoundingClientRect().top-8)}px`);
    };
    const frame=requestAnimationFrame(update);
    viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);
    return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[session?.id]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),1500);return()=>clearTimeout(timer);},[message]);
  const c=session?.plan.characteristics.find(c=>c.id===session.active.characteristic);
  const links=session?.plan.characteristicImageLinks?.filter(l=>l.characteristicId===c?.id)||[];
  const references=links.map(l=>({link:l,image:session?.product.images?.find(i=>i.id===l.imageId)})).filter(r=>r.image);
  const reference=references[imageIndex]||references[0];
  const imageSource=reference?.image?.url||session?.plan.drawingImageUrl||session?.product.defaultDrawingUrl;
  const imageError=useCallback(()=>setImageFailed(true),[]);
  const resolved=useDrawingSource(imageSource,imageRetry,imageError);
  useEffect(()=>{setImageReady(false);setImageFailed(false);setZoom(1);},[imageSource,imageRetry]);
  useEffect(()=>{setImageIndex(0);},[c?.id]);
  const updateDraft=(patch:Partial<MobileDraft>)=>{
    if(!session||session.submissionRequested||session.submission||session.confirmed)return;
    const next={...draftRef.current,...patch};draftRef.current=next;setDraft(next);dirty.current=true;setError('');setMessage('');
    const key=cellKey(session.active);
    writeChain.current=writeChain.current.then(async()=>{await changeMobileSession(scope,s=>({...s!,drafts:{...s!.drafts,[key]:next}}));}).catch(showError);
  };
  const move=async(target:Cell|'exit')=>{
    await writeChain.current;
    if(target==='exit'){if(externalExit.current){const exit=externalExit.current;externalExit.current=undefined;exit();}else onExit();return;}
    const s=await changeMobileSession(scope,s=>({...s!,active:target}));setSession(s);loadDraft(s);setSheet(null);setError('');
  };
  const navigate=(target:Cell|'exit')=>{if(dirty.current)setPending(target);else void move(target).catch(showError);};
  const complete=async()=>{
    if(saveLock.current)return;
    if(dirty.current&&!await save())return;
    saveLock.current=true;setBusy(true);
    try{await writeChain.current;const log=await finishMobileSession(scope);dirty.current=false;onCompleted(log);}
    catch(e){showError(e);}finally{saveLock.current=false;setBusy(false);}
  };
  const save=async(confirmedEvidence=false,target?:Cell|'exit')=>{
    if(!session||!c||saveLock.current)return false;
    setError('');
    try {
      const evaluated=evaluateMeasurement(c,draftRef.current.raw,draftRef.current.mode);
      const errors=evidenceErrors(c,evaluated.result,draftRef.current.photos.map(id=>({mimeType:session.media[id]?.file.type||''})),draftRef.current.comment,draftRef.current.reason);
      if(latestAttempt(session,session.active)&&!draftRef.current.retryReason.trim()){evidenceTarget.current=target;setPending(null);setError('Tekrar ölçüm sebebini girin.');setSheet('retry');setTimeout(()=>document.querySelector<HTMLInputElement>('#mm-retry-reason')?.focus(),50);return false;}
      if(errors.length&&!confirmedEvidence){evidenceTarget.current=target;setPending(null);setSheet('evidence');setTimeout(()=>document.querySelector<HTMLElement>('.mm-sheet [aria-invalid=true]')?.focus(),50);return false;}
      if(errors.length){setError(errors.join(' '));setTimeout(()=>document.querySelector<HTMLElement>('.mm-sheet [aria-invalid=true]')?.focus(),50);return false;}
      saveLock.current=true;setBusy(true);await writeChain.current;
      const s=await commitMobileCell(scope,session.active,draftRef.current,imageReady,latestAttempt(session,session.active)?.id||null);
      setSession(s);dirty.current=false;setEditingCompleted(false);draftRef.current=emptyDraft();setDraft(emptyDraft());setMessage('✓ Cihazda kaydedildi');setSheet(null);setPending(null);
      const summary=mobileSummary(s);const index=summary.cells.findIndex(cell=>cellKey(cell)===cellKey(s.active));
      const next=[...summary.cells.slice(index+1),...summary.cells.slice(0,index)].find(cell=>!latestAttempt(s,cell));
      if(target)await move(target);
      else if(!next)setSheet(null);
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
  const viewer=StorageService.getCurrentUser();const adminMeasurement=viewer.role==='admin'&&viewer.id===session.operatorId;
  const summary=mobileSummary(session);const current=latestAttempt(session,session.active);const locked=Boolean(session.submissionRequested||session.submission||session.confirmed);
  const beginRetake=()=>{if(!current||locked)return;setEditingCompleted(true);updateDraft({raw:current.raw,mode:current.mode,retryReason:''});setSheet(null);};
  const removeSession=async()=>{if(busy||locked)return;setBusy(true);try{await writeChain.current;await discardMobileSession(scope,session.id);dirty.current=false;onExit();}catch(e){showError(e);}finally{setBusy(false);}};
  const completedView=summary.missing.length===0&&!editingCompleted&&!dirty.current;
  let preview:ReturnType<typeof evaluateMeasurement>|undefined;let validation='';try{preview=evaluateMeasurement(c,draft.raw,draft.mode);}catch(e){validation=(e as Error).message;}
  const needs=preview?.result==='fail'||preview?.result==='review';
  const commentRequired=Boolean(needs&&c.policy?.requireComment),reasonRequired=Boolean(needs&&c.policy?.requireReason||preview?.result==='na');
  const requiredEvidence=Boolean(needs&&(c.policy?.minPhotos||0)>0||c.evidencePolicy==='always_required'||c.evidencePolicy==='required_on_fail'&&preview?.result==='fail'||['photo_required','media_required','document_required'].includes(c.evidencePolicy||''));
  const context=<p className="mm-sheet-context">Numune {session.active.sample} · Nokta {c.pointNo} — {c.name}</p>;
  const retryField=<label className="mm-retry-field">Tekrar ölçüm sebebi <small>Zorunlu</small><input id="mm-retry-reason" aria-label="Tekrar ölçüm sebebi" aria-invalid={!draft.retryReason.trim()} value={draft.retryReason} maxLength={2000} onChange={e=>updateDraft({retryReason:e.target.value})}/><small>Önceki kayıt: {String(current?.value??'—')} {c.unit} · Yeni giriş: {String(preview?.value??draft.raw??'—')} {c.unit}</small></label>;
  const activeIndex=session.plan.characteristics.findIndex(item=>item.id===c.id);
  const options=c.type==='boolean'?['yes','no']:c.type==='visual'?['OK','NOK','SUSPECT']:c.type==='ok_nok'?['OK','NOK']:c.options||[];
  const choiceLabels:Record<string,string>={yes:'Evet',no:'Hayır',OK:'✓ Uygun',NOK:'✕ Uygunsuz',SUSPECT:'⚠ Şüpheli'};
  const goNext=()=>{const next=summary.missing.find(cell=>cellKey(cell)!==cellKey(session.active));if(next)navigate(next);else setSheet('summary');};
  const drawing=<>
    {!!references.length&&<select aria-label="Referans resim" value={imageIndex} onChange={e=>setImageIndex(Number(e.target.value))}>{references.map((r,i)=><option key={r.link.id} value={i}>{r.image!.name}</option>)}</select>}
    {imageSource?<><div className="mm-drawing-tools"><button onClick={()=>{setZoom(z=>Math.min(4,z+.5));}}>＋</button><button onClick={()=>setZoom(z=>Math.max(1,z-.5))}>−</button><button onClick={()=>setZoom(1)}>Sığdır</button><button onClick={()=>setSheet(sheet==='drawing'?null:'drawing')}>{sheet==='drawing'?'Küçült':'Büyüt'}</button></div><div className="mm-drawing-scroll"><div className="mm-drawing-image" style={{width:`${zoom*100}%`,'--mm-image-ratio':imageRatio} as React.CSSProperties}>
      {resolved&&<img key={`${imageSource}:${imageRetry}`} src={resolved} alt={`${c.name} teknik resmi`} onLoad={e=>{setImageRatio(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight);setImageReady(true);setImageFailed(false);}} onError={()=>{setImageReady(false);setImageFailed(true);}}/>}
      {imageReady&&reference&&<svg className="mm-annotations" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{reference.link.annotations.map(a=>a.type==='measurement_line'?<line key={a.id} x1={a.startX} y1={a.startY} x2={a.endX} y2={a.endY} stroke={a.color||'#245b86'} strokeWidth=".5"/>:a.type==='area'?<rect key={a.id} x={Math.min(a.startX,a.endX)} y={Math.min(a.startY,a.endY)} width={Math.abs(a.endX-a.startX)} height={Math.abs(a.endY-a.startY)} fill="none" stroke={a.color||'#245b86'} strokeWidth=".5"/>:null)}</svg>}
      {imageReady&&(reference?session.plan.characteristicImageLinks?.filter(l=>l.imageId===reference.image!.id).flatMap(l=>l.annotations.filter(a=>a.type==='pin').slice(0,1).map(a=>({c:session.plan.characteristics.find(c=>c.id===l.characteristicId),x:'x' in a?a.x:0,y:'y' in a?a.y:0}))):session.plan.characteristics.map(c=>({c,x:c.pin.x,y:c.pin.y})))?.map((p,i)=>p.c&&<button key={i} className={`mm-pin ${session.plan.balloonMode==='embedded'?'rq-embedded-balloon':''} ${p.c.id===c.id?'active':''}`} style={{left:`${p.x}%`,top:`${p.y}%`}} aria-label={`Nokta ${p.c.pointNo}: ${p.c.name}`} onClick={()=>navigate({sample:session.active.sample,characteristic:p.c!.id})}>{session.plan.balloonMode!=='embedded'&&p.c.pointNo}</button>)}
    </div></div>{!resolved&&!imageFailed&&<p role="status" className="rq-media-placeholder">Teknik resim hazırlanıyor…</p>}{imageFailed&&<p role="alert">Teknik resim yüklenemedi. <button onClick={()=>setImageRetry(n=>n+1)}>Tekrar dene</button></p>}</>:<p>Bu nokta için teknik resim eklenmemiş.</p>}
    <p className="mm-instruction">{c.description||'Kontrol planındaki ölçüm talimatını uygulayın.'}</p>
  </>;
  const errorBlock=error&&<p role="alert" className="mm-error">{error}</p>;
  return <section ref={shellRef} className="mm-shell" data-hand={hand} aria-label="Mobil ölçüm istasyonu" onKeyDown={e=>{if(e.key==='Enter'&&!sheet&&!pending&&e.target instanceof HTMLElement&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();void save();}}}>
    {sheet==='tools'&&<Sheet title="Diğer işlemler" context={context} onClose={()=>setSheet(null)}>
    <section className="mm-menu-group"><h3>Sonuçlar</h3><button onClick={()=>setSheet('matrix')}>Tüm ölçümler</button><button onClick={()=>setSheet('history')}>Ölçüm geçmişi</button><button onClick={()=>setSheet('summary')}>Kontrol özeti</button></section>
    <section className="mm-menu-group"><h3>Aktif nokta</h3><button onClick={()=>setSheet('navigator')}>Noktalara git</button><button onClick={()=>{evidenceTarget.current=undefined;setSheet('evidence');}}>Not / kanıt ekle</button>{current&&!locked&&<button onClick={beginRetake}>Tekrar ölç</button>}{c.policy?.allowNA&&<button disabled={locked} onClick={()=>{updateDraft({raw:'__NA__'});setSheet('evidence');}}>Uygulanamaz (N/A)</button>}</section>
    <section className="mm-menu-group"><h3>Ayarlar</h3>    <details className="mm-preferences"><summary>Giriş ayarları · {session.order==='sample'?'Numune sırası':'Karakteristik sırası'} · {hand==='right'?'Sağ el':'Sol el'}</summary><div className="mm-settings"><select aria-label="Ölçüm sırası" value={session.order} onChange={e=>{const order=e.target.value as MobileSession['order'];void changeMobileSession(scope,s=>({...s!,order})).then(setSession).catch(showError);}}><option value="sample">Numune bazlı sıra</option><option value="characteristic">Karakteristik bazlı sıra</option></select><select aria-label="El tercihi" value={hand} onChange={e=>{setHand(e.target.value);try{localStorage.setItem('ritim:measurement:hand',e.target.value);}catch{setError('El tercihi cihazda saklanamadı.');}}}><option value="right">Sağ el</option><option value="left">Sol el</option></select></div><label className="mm-mode"><input type="checkbox" checked={draft.mode==='delta'} onChange={e=>updateDraft({mode:e.target.checked?'delta':'absolute'})}/> Nominalden sapma girişi</label></details></section>
    <section className="mm-menu-group"><h3>Oturum</h3><button onClick={()=>{setSheet(null);navigate('exit');}}>Ara ver ve çık</button>{!locked&&<button className="mm-delete" onClick={()=>setSheet('discard')}>Ölçümü sil ve kapat</button>}</section>
    <p className="mm-muted">{session.product.code} · Rev. {revisionLabel(session.plan.version)}<br/>İş emri: {session.orderNumber||'—'} · Lot: {session.lotNumber||'—'}<br/>Kaynak: {session.source==='manual'?'Manuel':session.source} · Alet: {session.instrumentId||'Belirtilmedi'}</p>
    <p className="mm-muted">{online?'Çevrimiçi':'Çevrimdışı'} · {syncing?'Gönderiliyor':session.confirmed?'Senkronlandı':`${session.attempts.length} deneme cihazda · ${summary.photos} medya bekliyor`}</p>{session.syncError&&<p role="alert">{session.syncError}<button onClick={()=>void sync()}>Yeniden gönder</button></p>}</Sheet>}
    <div className="mm-overview">
    <div className="mm-product-line"><span>{session.product.code} · {session.product.name}</span><span role="status">{session.syncError?'Gönderim bekliyor':syncing?'Gönderiliyor':online?'Çevrimiçi':'Çevrimdışı'}</span></div>
    <div className="mm-drawing">{drawing}</div>
    </div>
    <div className="mm-characteristic"><h1>{activeIndex+1} / {session.plan.characteristics.length} · {c.name}</h1><button className="mm-point-progress" aria-label="Tüm ölçümleri aç" onClick={()=>setSheet('matrix')}><span>Tümü · </span>{summary.cells.length-summary.missing.length}/{summary.cells.length}</button><button className="mm-tools-button" title="Diğer işlemler" aria-label="Diğer işlemler" onClick={()=>setSheet('tools')}><MoreHorizontal size={20}/></button></div>
    {completedView?<section className="mm-completed" role="status"><h2>Tüm ölçümler tamamlandı</h2><p>{summary.cells.length} ölçüm kaydedildi. Kontrolü tamamlayarak raporunuzu açabilirsiniz.</p>{adminMeasurement?<p>Yönetici ölçümü: ek onay gerekmiyor.</p>:summary.review&&<p>{session.attempts.some(a=>a.result!=='pass')?'İnceleme gerektiren ölçüm sonuçları bulunuyor. Kontrol yetkili değerlendirmesine gönderilecek.':'Kaydettiğiniz kontrol yönetici onayına gönderilecek.'}</p>}</section>:<>
    <div className="mm-samples" aria-label="Numuneler">{Array.from({length:session.count},(_,i)=>i+1).map(sample=>{const cells=summary.cells.filter(cell=>cell.sample===sample),latest=cells.map(cell=>latestAttempt(session,cell)),failed=latest.some(a=>a?.result==='fail'),missing=latest.some(a=>!a);return <button key={sample} aria-pressed={sample===session.active.sample} aria-label={`Numune ${sample}: ${failed?'Uygunsuz':missing?'Eksik':'Tamamlandı'}`} onClick={()=>navigate({sample,characteristic:c.id})}>N{sample} {failed?'✕':missing?'○':'✓'}</button>;})}</div>
    {(c.type||'numeric')==='numeric'&&<dl className="mm-limits"><div><dt>Alt sınır</dt><dd>{c.lsl??'—'}</dd></div><div><dt>Nominal</dt><dd>{c.nominal}</dd></div><div><dt>Üst sınır</dt><dd>{c.usl??'—'}</dd></div><span>{c.unit}</span><button className="mm-note-shortcut" disabled={locked} title={requiredEvidence||commentRequired||reasonRequired?'Plan gereği zorunlu alanlar var':'İsteğe bağlı'} onClick={()=>{evidenceTarget.current=undefined;setSheet('evidence');}}>Not / kanıt</button></dl>}
    {current&&<div className="mm-saved">Son kayıt: {String(current.value)} {c.unit} · {labels[current.result]} {!dirty.current&&<button disabled={locked} onClick={beginRetake}>Tekrar ölç</button>}{session.attempts.some(a=>cellKey(a)===cellKey(session.active)&&a.result==='fail')&&current.result!=='fail'&&<small>Önceki uygunsuz deneme geçmişte korunuyor.</small>}</div>}
    {current&&dirty.current&&<div className="mm-inline-retry"><label>Tekrar ölçüm sebebi <small>Zorunlu</small><input aria-label="Tekrar ölçüm sebebi — giriş" value={draft.retryReason} maxLength={2000} onChange={e=>updateDraft({retryReason:e.target.value})}/></label></div>}
    {!locked&&<fieldset disabled={busy} className="mm-input"><legend className="sr-only">Ölçüm girişi</legend>
      {(c.type||'numeric')==='numeric'?<><div className="mm-value-row"><input id="mobile-measured-value" aria-label="Ölçüm değeri" inputMode="none" readOnly value={String(draft.raw).replace('.',',')} placeholder="Değer girin"/><span role="status" className="mm-feedback">{message}</span></div>{draft.mode==='delta'&&<p>Nominal {c.nominal} + sapma {String(draft.raw)||'—'} = mutlak {preview?.value??'—'} {c.unit}</p>}
      {!sheet&&!pending&&<div className="mm-keypad">{['1','2','3','4','5','6','7','8','9',',','0','⌫'].map(key=><button key={key} data-key={key} aria-label={key==='⌫'?'Son rakamı sil':key} onClick={()=>{let raw=String(draftRef.current.raw);raw=key==='⌫'?raw.slice(0,-1):raw+key;updateDraft({raw});}}>{key}</button>)}{c.allowNegative!==false&&<button data-key="sign" aria-label="İşareti değiştir" onClick={()=>updateDraft({raw:String(draft.raw).startsWith('-')?String(draft.raw).slice(1):'-'+draft.raw})}>±</button>}</div>}</>:c.type==='text'?<textarea aria-label="Metin sonucu" maxLength={c.policy?.maxTextLength||2000} value={String(draft.raw)} onChange={e=>updateDraft({raw:e.target.value})}/>:<div className="mm-choices">{options.map(option=><button key={option} aria-pressed={Array.isArray(draft.raw)?draft.raw.includes(option):draft.raw===option} onClick={()=>updateDraft({raw:c.type==='multi_select'?(Array.isArray(draft.raw)&&draft.raw.includes(option)?draft.raw.filter(v=>v!==option):[...(Array.isArray(draft.raw)?draft.raw:[]),option]):option})}>{choiceLabels[option]||option}</button>)}</div>}
      <p className={`mm-preview ${preview?preview.result:''}`} role="status">{dirty.current?(preview?`${labels[preview.result]} · Henüz kaydedilmedi`:validation):''}</p>
      {preview?.result==='fail'&&typeof preview.value==='number'&&<p>{preview.value<c.lsl?`Alt sınırın ${Number((c.lsl-preview.value).toPrecision(10))} altında`:`Üst sınırın ${Number((preview.value-c.usl).toPrecision(10))} üzerinde`} {c.unit}</p>}
    </fieldset>}
    </>}
    {errorBlock}
    <footer className={`mm-actions${completedView?' mm-actions-completed':''}`}>{completedView?<><button disabled={busy||locked} onClick={()=>{setEditingCompleted(true);setSheet('navigator');}}>Ölçümü düzelt</button><button className="mm-primary" disabled={busy} onClick={()=>void complete()}>Ölçümü tamamla ve raporu aç</button></>:<><button onClick={()=>{const i=summary.cells.findIndex(cell=>cellKey(cell)===cellKey(session.active));if(i>0)navigate(summary.cells[i-1]);}}>Önceki</button><button className="mm-primary" disabled={busy||locked} onClick={()=>void save()}>Kaydet ve ilerle</button>{summary.missing.length>0&&<button onClick={goNext} title="Kaydetmeden diğer eksik ölçüme geç">Eksik noktaya git</button>}{summary.missing.length===0&&<button onClick={()=>{if(dirty.current){setError('Düzeltmeyi kaydedin veya taslakta bırakın.');return;}setEditingCompleted(false);}}>Özete dön</button>}</>}</footer>
    {sheet==='drawing'&&<Sheet title="Teknik resim" onClose={()=>setSheet(null)}>{drawing}</Sheet>}
    {sheet==='evidence'&&<Sheet title="Not ve kanıt" context={context} onClose={()=>setSheet(null)} footer={<div className="mm-sheet-actions"><button onClick={()=>setSheet(null)}>Girişe dön</button><button disabled={busy||locked} className="mm-primary" onClick={()=>void save(true,evidenceTarget.current)}>Kaydet ve ilerle</button></div>}><p>{preview?labels[preview.result]:'Sonuç girişi bekleniyor'} · {String(preview?.value??'—')} {(c.type||'numeric')==='numeric'?c.unit:''}</p>{(c.type||'numeric')==='numeric'?<p>Alt {c.lsl??'—'} · Nominal {c.nominal} · Üst {c.usl??'—'}</p>:<p>Kontrol tipi: {c.type==='ok_nok'?'Uygun / Uygunsuz':c.type==='visual'?'Görsel kontrol':c.type==='boolean'?'Evet / Hayır':c.type==='single_select'?'Tekli seçim':c.type==='multi_select'?'Çoklu seçim':'Metin'}</p>}<fieldset disabled={busy||locked}><label>Açıklama <small>{commentRequired?'Zorunlu':'İsteğe bağlı'}</small><textarea aria-label="Ölçüm açıklaması" aria-invalid={commentRequired&&!draft.comment.trim()} maxLength={2000} value={draft.comment} onChange={e=>updateDraft({comment:e.target.value})}/></label><label>Kusur sebebi <small>{reasonRequired?'Zorunlu':'İsteğe bağlı'}</small>{c.policy?.reasons?.length?<select aria-label="Kusur sebebi" aria-invalid={reasonRequired&&!draft.reason.trim()} value={draft.reason} onChange={e=>updateDraft({reason:e.target.value})}><option value="">Seçin</option>{c.policy.reasons.map(r=><option key={r}>{r}</option>)}</select>:<input aria-label="Kusur sebebi" aria-invalid={reasonRequired&&!draft.reason.trim()} value={draft.reason} onChange={e=>updateDraft({reason:e.target.value})}/>}</label><p className="mm-evidence-rule">{requiredEvidence?'Kanıt: plan gereği zorunlu':'Kanıt: isteğe bağlı'}{needs&&c.policy?.minPhotos?` · En az ${c.policy.minPhotos} fotoğraf`:''}</p><div className="mm-secondary"><label className="mm-file" tabIndex={0} aria-invalid={requiredEvidence&&Boolean(preview&&evidenceErrors(c,preview.result,draft.photos.map(id=>({mimeType:session.media[id]?.file.type||''})),draft.comment,draft.reason).some(e=>/fotoğraf|dosyası|video|belge/i.test(e)))}>Fotoğraf çek<input type="file" accept="image/*" capture="environment" onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label><label className="mm-file">Dosya ekle<input type="file" accept="image/*,video/*,application/pdf" multiple onChange={e=>{void addFiles(e.target.files);e.target.value='';}}/></label></div><details className="mm-help"><summary>Dosya / kamera yardımı</summary><p>Kamera açılamıyorsa cihaz izinlerini kontrol edin. Planın istediği fotoğraf, video veya PDF türünü ekleyin.</p></details><div className="mm-photos">{draft.photos.map(id=>session.media[id]&&<div key={id}><Photo file={session.media[id].file} onClick={()=>setPhoto(id)}/><button onClick={()=>updateDraft({photos:draft.photos.filter(p=>p!==id)})}>Kaldır</button><label className="mm-file">Yeniden çek<input type="file" accept="image/*" capture="environment" onChange={async e=>{const files=e.target.files;if(files?.length){await addFiles(files,id);}}}/></label></div>)}</div></fieldset>
      {preview&&evidenceErrors(c,preview.result,draft.photos.map(id=>({mimeType:session.media[id]?.file.type||''})),draft.comment,draft.reason).map(e=><p className="mm-error" key={e}>{e}</p>)}{errorBlock}{current&&<>{retryField}</>}</Sheet>}
    {sheet==='retry'&&<Sheet title="Tekrar ölçüm" context={context} onClose={()=>setSheet(null)} footer={<div className="mm-sheet-actions"><button onClick={()=>setSheet(null)}>Girişe dön</button><button className="mm-primary" disabled={busy||locked} onClick={()=>void save(false,evidenceTarget.current)}>Kaydet ve ilerle</button></div>}>{retryField}{errorBlock}</Sheet>}
    {sheet==='discard'&&<Sheet title="Ölçüm silinsin mi?" onClose={()=>setSheet(null)}><p>Bu cihazdaki tamamlanmamış ölçüm, giriş taslakları ve kanıtları kaldırılacak. Kaydedilmiş raporlar silinmez. Bu işlem geri alınamaz.</p>{errorBlock}<div className="mm-sheet-actions"><button disabled={busy} onClick={()=>setSheet('tools')}>Vazgeç</button><button className="mm-delete" disabled={busy||locked} onClick={()=>void removeSession()}>Evet, ölçümü sil ve kapat</button></div></Sheet>}
    {sheet==='matrix'&&<Sheet title="Tüm ölçümler" onClose={()=>setSheet(null)}><p>{session.product.code} · {summary.cells.length-summary.missing.length} / {summary.cells.length} kayıtlı ölçüm</p><label>Göster<select aria-label="Ölçüm tablosu filtresi" value={matrixFilter} onChange={e=>setMatrixFilter(e.target.value)}><option value="all">Tüm sonuçlar</option><option value="missing">Yalnızca eksikler</option><option value="fail">Yalnızca uygunsuzlar</option></select></label><div className="mm-matrix-scroll" tabIndex={0} aria-label="Numuneler ve ölçüm noktaları"><table className="mm-result-matrix"><thead><tr><th>Ölçüm noktası</th>{Array.from({length:session.count},(_,i)=><th key={i}>Numune {i+1}</th>)}</tr></thead><tbody>{session.plan.characteristics.filter(item=>matrixFilter==='all'||Array.from({length:session.count},(_,i)=>latestAttempt(session,{sample:i+1,characteristic:item.id})).some(a=>matrixFilter==='missing'?!a:a?.result==='fail')).map(item=><tr key={item.id}><th>#{item.pointNo} {item.name}<small>{item.unit}</small></th>{Array.from({length:session.count},(_,i)=>{const cell={sample:i+1,characteristic:item.id},a=latestAttempt(session,cell);return <td key={i}><button data-result={a?.result||'empty'} aria-label={`Numune ${i+1}, ${item.name}: ${a?String(a.value):'Eksik'}`} onClick={()=>{setEditingCompleted(true);setSheet(null);navigate(cell);}}><strong>{a?String(a.value):'—'}</strong><small>{a?labels[a.result]:'Bekliyor'}</small></button></td>;})}</tr>)}</tbody></table></div><p className="mm-muted">Bir hücreye dokunarak o ölçüme dönün. Değişiklik yeni deneme olarak kaydedilir; önceki sonuç korunur.</p></Sheet>}
    {sheet==='navigator'&&<Sheet title="Karakteristik gezgini" onClose={()=>setSheet(null)}><input aria-label="Karakteristik ara" placeholder="Numara veya ad ara" value={search} onChange={e=>setSearch(e.target.value)}/><label><input type="checkbox" checked={remaining} onChange={e=>setRemaining(e.target.checked)}/> Sadece kalanlar</label><div className="mm-groups"><button onClick={()=>setGroup(-1)}>Tümü</button>{Array.from({length:Math.ceil(session.plan.characteristics.length/10)},(_,i)=><button key={i} aria-pressed={group===i} onClick={()=>setGroup(i)}>{i*10+1}–{Math.min((i+1)*10,session.plan.characteristics.length)}</button>)}</div><div className="mm-navigator">{session.plan.characteristics.filter((item,i)=>(group<0||Math.floor(i/10)===group)&&`${item.pointNo} ${item.name}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))&&(!remaining||!latestAttempt(session,{sample:session.active.sample,characteristic:item.id}))).map(item=>{const attempt=latestAttempt(session,{sample:session.active.sample,characteristic:item.id});return <button key={item.id} onClick={()=>navigate({sample:session.active.sample,characteristic:item.id})}>#{item.pointNo} {item.name}<small>{attempt?labels[attempt.result]:'○ Bekliyor'}{session.attempts.some(a=>a.sample===session.active.sample&&a.characteristic===item.id&&a.result==='fail')?' · İlk uygunsuzluk korunuyor':''}</small></button>;})}</div></Sheet>}
    {sheet==='history'&&<Sheet title="Ölçüm geçmişi" context={context} onClose={()=>setSheet(null)}>{session.attempts.filter(a=>cellKey(a)===cellKey(session.active)).map(a=><article key={a.id}><strong>{labels[a.result]} · {String(a.value)}</strong><p>{StorageService.getUsers().find(u=>u.id===a.operatorId)?.name||session.operatorName} · {new Date(a.measuredAt).toLocaleString('tr-TR')}</p><p>{a.comment} {a.reason} {a.retryReason}</p><div className="mm-photos">{a.photos.map(id=><Photo key={id} file={session.media[id].file} onClick={()=>setPhoto(id)}/>)}</div></article>)}{current&&!locked&&<button onClick={beginRetake}>Tekrar ölç</button>}<p>İlk uygunsuzluk yeni uygun sonuçla kapanmaz. İnceleme / yetkili karar ayrı yürütülür.</p><button onClick={onOpenActions}>Görev ve onayları aç</button></Sheet>}
    {sheet==='summary'&&<Sheet title="Kontrol özeti" onClose={()=>setSheet(null)}><p>{summary.missing.length?`${summary.missing.length} hücre eksik`:'✓ Veri toplama tamamlandı'}</p><p>{session.confirmed?'✓ Senkronlandı':`${session.attempts.length} deneme ve ${summary.photos} medya gönderimi bekliyor`}</p><p>{adminMeasurement?'Yönetici ölçümü: ek onay gerekmiyor.':summary.review?'⚠ İnceleme / onay bekliyor':'Kalite sonucu: kayıtlı ölçümlere göre uygun'}</p><p>Rapor açılır; fotoğraf ve ölçüm gönderimi arka planda devam eder.</p>{errorBlock}<button disabled={!!summary.missing.length||busy} onClick={()=>void complete()}>Ölçümü tamamla ve raporu aç</button><button disabled={syncing||!online} onClick={()=>void sync()}>Senkronizasyonu tekrar dene</button><button onClick={()=>{setSheet(null);goNext();}}>Eksiklere dön</button><button onClick={onOpenActions}>Görev ve onayları aç</button></Sheet>}
    {pending&&<Sheet title="Kaydedilmemiş giriş var" onClose={()=>setPending(null)}><p>Girişi kaydedebilir veya cihazdaki taslakta bırakabilirsiniz.</p>{errorBlock}<button disabled={busy} onClick={()=>void save(false,pending)}>Kaydet</button><button onClick={()=>{const target=pending;setPending(null);void move(target).catch(showError);}}>Taslakta bırak</button><button onClick={()=>setPending(null)}>Vazgeç</button></Sheet>}
    {boundary&&<Sheet title={`Numune ${session.active.sample} tamamlandı`} onClose={()=>setBoundary(undefined)}><p>Uygunsuz denemeler: {session.attempts.filter(a=>a.sample===session.active.sample&&a.result==='fail').length}</p><button className="mm-primary" onClick={()=>{const next=boundary;setBoundary(undefined);void move(next).catch(showError);}}>Numune {boundary.sample} ile devam et</button></Sheet>}
    {photo&&session.media[photo]&&<Sheet title="Kanıt önizlemesi" onClose={()=>setPhoto(undefined)}><Photo file={session.media[photo].file} onClick={()=>{}}/></Sheet>}
  </section>;
}
