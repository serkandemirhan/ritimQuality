import React, {useEffect, useRef, useState} from 'react';
import {CloudUpload, RefreshCw} from 'lucide-react';
import type {InspectionLog} from '../types';
import {SaasApi} from '../services/api';
import {readMobileUploads, syncMobileSession, type MobileSession} from '../services/mobileMeasurement';
import {Button} from './ui';

export function MobileInspectionUploads({onConfirmed}:{onConfirmed:(log:InspectionLog)=>void}) {
  const [items,setItems]=useState<MobileSession[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const callback=useRef(onConfirmed);callback.current=onConfirmed;
  const retry=useRef<()=>void>(()=>{});
  useEffect(()=>{
    if(!SaasApi.hasSession())return;
    const scope=SaasApi.scope();let alive=true;let running=false;
    const refresh=async()=>{
      if(running||SaasApi.scope()!==scope)return;
      running=true;setBusy(true);
      try{
        const queued=await readMobileUploads(scope);if(alive)setItems(queued);
        for(const item of queued){
          if(!alive||!navigator.onLine||SaasApi.scope()!==scope)break;
          const result=await syncMobileSession(scope,item);
          if(alive&&result?.confirmed)callback.current(result.confirmed);
        }
        if(alive){setItems(await readMobileUploads(scope));setError('');}
      }catch(e){if(alive)setError(e instanceof Error?e.message:'Gönderim kuyruğu açılamadı.');}
      finally{running=false;if(alive)setBusy(false);}
    };
    const start=()=>{void refresh();};retry.current=start;start();
    const timer=setInterval(start,15000);
    window.addEventListener('online',start);window.addEventListener('quality-mobile-queue-changed',start);
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',start);window.removeEventListener('quality-mobile-queue-changed',start);};
  },[]);
  if(!items.length&&!error)return null;
  return <section className="rq-mobile-upload-status" role="status"><CloudUpload size={20}/><div><strong>{items.length} ölçüm {busy?'gönderiliyor':'gönderim bekliyor'}</strong><p>Ölçümler cihazda kayıtlı. Diğer işlemlere devam edebilirsiniz.</p>{(error||items.find(item=>item.syncError)?.syncError)&&<p>{error||items.find(item=>item.syncError)?.syncError}</p>}</div><Button disabled={busy||!navigator.onLine} title="Gönderimi tekrar dene" aria-label="Gönderimi tekrar dene" onClick={()=>retry.current()}><RefreshCw size={18}/></Button></section>;
}
