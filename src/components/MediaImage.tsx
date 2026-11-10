import React, {useEffect,useState,useCallback} from 'react';
import { SaasApi } from '../services/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** A shared first-page representation keeps PDF coordinates identical everywhere. */
export function useDrawingSource(source:string|undefined,retry=0,onError?:()=>void) {
  const resolved=useMediaSource(source,retry,onError);
  const [page,setPage]=useState<{source:string;url:string}>();
  useEffect(()=>{
    if(!resolved||!isPdfMedia(source))return;
    let live=true;let task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
    void (async()=>{
      const pdf=await import('pdfjs-dist');
      if(!live)return;
      pdf.GlobalWorkerOptions.workerSrc=workerUrl;
      const response=await fetch(resolved);
      if(!response.ok)throw new Error('PDF indirilemedi.');
      if(!live)return;
      task=pdf.getDocument({data:new Uint8Array(await response.arrayBuffer())});
      const doc=await task.promise;
      const first=await doc.getPage(1),base=first.getViewport({scale:1});
      const viewport=first.getViewport({scale:Math.min(2,1800/Math.max(base.width,base.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await first.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
      if(live)setPage({source:resolved,url:canvas.toDataURL('image/png')});
      await task.destroy();
    })().catch(()=>{if(live){setPage({source:resolved,url:''});onError?.();}});
    return()=>{live=false;void task?.destroy();};
  },[resolved,source,retry,onError]);
  return isPdfMedia(source)?(page?.source===resolved?page.url:''):resolved;
}

export function useMediaSource(source: string | undefined, retry = 0,onError?:()=>void) {
  const [resolved,setResolved]=useState('');
  useEffect(()=>{
    if(!source?.startsWith('media:'))return;
    let active=true;let url='';setResolved('');
    SaasApi.mediaUrl(source.slice(6).split('#')[0]).then(value=>{url=value;if(active)setResolved(value);else if(value.startsWith('blob:'))URL.revokeObjectURL(value);}).catch(()=>{if(active){setResolved('');onError?.();}});
    return()=>{active=false;if(url.startsWith('blob:'))URL.revokeObjectURL(url);};
  },[source,retry,onError]);
  return source?.startsWith('media:') ? resolved : source;
}
export function MediaImage({src,...props}:React.ImgHTMLAttributes<HTMLImageElement>) {
  const [retry,setRetry]=useState(0),[failed,setFailed]=useState(false);
  const fail=useCallback(()=>setFailed(true),[]);
  const resolved=useDrawingSource(src,retry,fail);
  useEffect(()=>setFailed(false),[src,retry]);
  if(src&&(!resolved||failed))return <div role={failed?'alert':'status'} className={`${props.className||''} rq-media-placeholder`}><span>{failed?'Teknik resim yüklenemedi.':'Teknik resim hazırlanıyor…'}</span>{failed&&<button type="button" className="rq-button" onClick={()=>{setFailed(false);setRetry(v=>v+1);}}>Tekrar dene</button>}</div>;
  return <img {...props} key={`${src}:${retry}`} src={resolved||undefined} onError={event=>{fail();props.onError?.(event);}}/>;
}
export const isPdfMedia=(source:string|undefined)=>Boolean(source?.startsWith('data:application/pdf')||source?.endsWith('#application/pdf'));
