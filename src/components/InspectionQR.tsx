import React, { useEffect, useRef, useState } from 'react';
import { QrCode, Tag } from 'lucide-react';
import QRCode from 'qrcode';
import type { Product } from '../types';

export function InspectionQR({products,onSelect}:{products:Product[];onSelect:(id:string,workOrder:string)=>void}) {
  const [productId,setProductId]=useState(products[0]?.id||'');
  const [workOrder,setWorkOrder]=useState('');const [qr,setQr]=useState('');
  const [input,setInput]=useState('');const [error,setError]=useState('');const [scanning,setScanning]=useState(false);
  const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
  const link=new URL(window.location.origin+window.location.pathname);link.searchParams.set('product',productId);if(workOrder)link.searchParams.set('wo',workOrder);
  useEffect(()=>{let active=true;if(productId)QRCode.toDataURL(link.href,{width:256,margin:4}).then(url=>{if(active)setQr(url);}).catch(error=>setError(String(error)));return()=>{active=false;};},[productId,workOrder]);
  const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setScanning(false);};
  const select=(value:string)=>{
    const product=products.find(p=>p.code===value.trim());
    if(product){onSelect(product.id,'');stop();return;}
    try {
      const url=new URL(value);
      if(url.origin!==window.location.origin || url.pathname!==window.location.pathname)throw new Error('QR bu uygulamaya ait değil.');
      const id=url.searchParams.get('product')||'';
      if(!products.some(p=>p.id===id))throw new Error('Parça bu çalışma alanında bulunamadı.');
      onSelect(id,url.searchParams.get('wo')||'');stop();setError('');
    }catch(error){setError(error instanceof Error?error.message:'QR okunamadı.');}
  };
  useEffect(()=>{
    if(!scanning)return;
    let canceled=false;let timer:ReturnType<typeof setTimeout>;
    const start=async()=>{
      try{
        const Constructor=(window as unknown as {BarcodeDetector?:new(options:{formats:string[]})=>{detect:(source:HTMLVideoElement)=>Promise<{rawValue:string}[]>}}).BarcodeDetector;
        if(!Constructor)throw new Error('Bu tarayıcıda uygulama içi QR tarama desteklenmiyor. Telefonun Kamera uygulamasıyla QR açabilir veya parça kodunu yazabilirsiniz.');
        const detector=new Constructor({formats:['qr_code']});
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(canceled){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
        video.current!.srcObject=media;await video.current!.play();
        const scan=async()=>{if(canceled)return;try{const codes=await detector.detect(video.current!);if(codes[0]){select(codes[0].rawValue);return;}}catch{}timer=setTimeout(scan,350);};await scan();
      }catch(error){setError(error instanceof Error?error.message:'Kamera açılamadı.');stop();}
    };void start();
    return()=>{canceled=true;clearTimeout(timer);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;};
  },[scanning]);
  return <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-end gap-2"><details onToggle={event=>{if(!event.currentTarget.open)stop();}} className="group w-full rounded-xl border border-slate-200 bg-white p-3 sm:w-auto sm:open:w-full"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-600 [&::-webkit-details-marker]:hidden"><QrCode className="h-4 w-4"/>QR Tara</summary><div className="mt-4 space-y-3">
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <form className="flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();select(input);}}><input aria-label="QR bağlantısı veya parça kodu" value={input} onChange={e=>setInput(e.target.value)} placeholder="Parça kodu veya QR bağlantısı" className="min-w-0 flex-1 rounded-lg border p-3"/><button className="rounded-lg bg-blue-700 p-3 text-white">Aç</button><button type="button" className="rounded-lg border p-3" onClick={()=>setScanning(true)}>Kamerayla tara</button></form>
    {scanning&&<div><video ref={video} playsInline muted className="max-h-72 w-full rounded-xl"/><button type="button" onClick={stop} className="rounded-lg border p-3">Kamerayı kapat</button></div>}
  </div></details><details className="group w-full rounded-xl border border-slate-200 bg-white p-3 sm:w-auto sm:open:w-full"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-600 [&::-webkit-details-marker]:hidden"><Tag className="h-4 w-4"/>Etiket Oluştur</summary><div className="mt-4 space-y-3">
    <label className="block text-sm">Etiket ürünü<select value={productId} onChange={event=>setProductId(event.target.value)} className="mt-1 w-full rounded-lg border p-3">{products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
    <label className="block text-sm">İş emri (isteğe bağlı)<input value={workOrder} onChange={e=>setWorkOrder(e.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border p-3"/></label>
    {qr&&<div><img src={qr} alt="Kontrol planını açan QR etiketi" width={256} height={256}/><a href={qr} download={'kontrol-'+(products.find(p=>p.id===productId)?.code||'etiket')+'.png'} className="inline-block rounded-lg border p-3">QR etiketini indir</a><p className="mt-2 break-all text-xs text-slate-500">{link.href}</p></div>}
  </div></details></div>;
}
