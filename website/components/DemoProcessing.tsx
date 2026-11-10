'use client';
import {useEffect,useState} from 'react';
import {FileSearch,LoaderCircle} from 'lucide-react';

export function DemoProcessing({message,onCancel}:{message:string;onCancel:()=>void}){
  const [seconds,setSeconds]=useState(0);
  useEffect(()=>{const start=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[]);
  return <div className="dd-processing" aria-label="PDF işleme durumu">
    <div className="dd-processing-orbit" aria-hidden="true"><FileSearch size={34}/></div>
    <span className="eyebrow">ÇİZİMİNİZDEN KONTROL PLANINA</span>
    <h3>İlk sayfanız inceleniyor</h3>
    <p role="status" aria-live="polite"><LoaderCircle size={16} className="dd-spin"/>{message}</p>
    <div className="dd-processing-track" aria-hidden="true"><span/></div>
    <small>{seconds} saniye geçti · Yalnızca ilk sayfa işleniyor</small>
    <p className="dd-processing-help">{seconds>=30?'Ayrıntılı çizimlerde yatay ve dikey ölçüleri ayrı ayrı okumak daha uzun sürebilir. İşlem sürüyor; isterseniz durdurabilirsiniz.':'Ölçü yazıları, birimler ve toleranslar incelenerek kontrol noktaları hazırlanır. Taranmış PDF’lerde ilk kullanım daha uzun sürebilir.'}</p>
    <button type="button" onClick={onCancel}>İşlemi durdur</button>
  </div>;
}
