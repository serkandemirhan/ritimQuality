'use client';
import {useEffect,useState} from 'react';
import {FileDown,LoaderCircle,Check} from 'lucide-react';
import type {DemoDocument,DemoReading} from '@/lib/drawing-demo';
import type {ReportMetadata} from '@/lib/report-metadata';

export function DemoReportDownload({doc,metadata,readings}:{doc:DemoDocument;metadata:ReportMetadata;readings:Record<string,DemoReading>}){
  const [result,setResult]=useState<{url:string;doc:DemoDocument;metadata:ReportMetadata;readings:Record<string,DemoReading>}|null>(null);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const current=result?.doc===doc&&result.metadata===metadata&&result.readings===readings?result:null;
  useEffect(()=>{
    let cancelled=false,url='';setError('');
    const timer=setTimeout(()=>{
      void import('@/lib/demo-report-pdf').then(m=>m.createDemoReportPdf(doc,metadata,readings)).then(blob=>{
        if(cancelled)return;url=URL.createObjectURL(blob);setResult({url,doc,metadata,readings});
      }).catch(()=>{if(!cancelled)setError('PDF hazırlanamadı. Ölçümleriniz korunuyor; tekrar deneyebilirsiniz.');});
    },0);
    return()=>{cancelled=true;clearTimeout(timer);if(url)URL.revokeObjectURL(url);};
  },[doc,metadata,readings,attempt]);
  return <div className="dd-report-download">
    <div className="dd-download-icon" aria-hidden="true">{current?<Check size={30}/>:error?<FileDown size={30}/>:<LoaderCircle size={30} className="dd-spin"/>}</div>
    <span className="eyebrow">DEMO TAMAMLANDI · EN FAZLA 5 ÖLÇÜM</span>
    <h2 role="status">{current?'PDF raporunuz hazır':error?'Rapor yeniden hazırlanmalı':'PDF raporunuz hazırlanıyor…'}</h2>
    <p>{current?'Parça ve müşteri bilgileri, balonlanmış çizim ve ölçüm sonuçları tek bir raporda.':'Ölçüm sonuçlarınız ve numaralandırılmış teknik resminiz rapora yerleştiriliyor.'}</p>
    {current&&<a className="button button-dark" href={current.url} download="ritim-demo-olcum-raporu.pdf"><FileDown size={19}/> PDF raporunu indir</a>}
    {error&&<><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>PDF’yi yeniden oluştur</button></>}
    <small>Demo yalnızca ilk sayfayı ve en fazla 5 ölçüm girişini kapsar. Diğer satırlar raporda otomatik örnek olarak işaretlenir.</small>
  </div>;
}
