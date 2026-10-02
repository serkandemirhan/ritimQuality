import { Button, Input, Field, Select } from './ui';
import React, { useEffect, useRef, useState } from 'react';
import { QrCode, Tag, Camera, CheckCircle2, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import type { Product } from '../types';

export function InspectionQR({products,onSelect}:{products:Product[];onSelect:(id:string,workOrder:string)=>void}) {
  const [productId,setProductId]=useState(products[0]?.id||'');
  const [workOrder,setWorkOrder]=useState('');const [qr,setQr]=useState('');
  const [selected,setSelected]=useState<{id:string;workOrder:string}|null>(null);
  const [input,setInput]=useState('');const [error,setError]=useState('');const [scanning,setScanning]=useState(false);
  const [torchAvailable,setTorchAvailable]=useState(false);const [torch,setTorch]=useState(false);
  const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
  const link=new URL(window.location.origin+window.location.pathname);link.searchParams.set('product',productId);if(workOrder)link.searchParams.set('wo',workOrder);
  useEffect(()=>{let active=true;if(productId)QRCode.toDataURL(link.href,{width:256,margin:4}).then(url=>{if(active)setQr(url);}).catch(error=>setError(String(error)));return()=>{active=false;};},[productId,workOrder]);
  const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;setScanning(false);setTorch(false);setTorchAvailable(false);};
  const toggleTorch=async()=>{const track=stream.current?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{torch:!torch} as MediaTrackConstraintSet]});setTorch(value=>!value);}catch{setError('Fener açılamadı. Ortam ışığını artırarak tekrar deneyin.');}};
  const select=(value:string)=>{
    const product=products.find(p=>p.code===value.trim());
    if(product){onSelect(product.id,'');setSelected({id:product.id,workOrder:''});setError('');stop();return;}
    try {
      const url=new URL(value);
      if(url.origin!==window.location.origin || url.pathname!==window.location.pathname)throw new Error('QR bu uygulamaya ait değil.');
      const id=url.searchParams.get('product')||'';
      if(!products.some(p=>p.id===id))throw new Error('Parça bu çalışma alanında bulunamadı.');
      const workOrder=url.searchParams.get('wo')||'';onSelect(id,workOrder);setSelected({id,workOrder});stop();setError('');
    }catch(error){stop();setSelected(null);setError(error instanceof TypeError?'Geçerli bir ürün kodu veya bu uygulamaya ait QR bağlantısı girin.':error instanceof Error?error.message:'QR okunamadı.');}
  };
  useEffect(()=>{
    if(!scanning)return;
    let canceled=false;let timer:ReturnType<typeof setTimeout>;
    const start=async()=>{
      try{
        const Constructor=(window as unknown as {BarcodeDetector?:new(options:{formats:string[]})=>{detect:(source:HTMLVideoElement)=>Promise<{rawValue:string}[]>}}).BarcodeDetector;
        let detector:InstanceType<NonNullable<typeof Constructor>>|undefined;
        try{if(Constructor)detector=new Constructor({formats:['qr_code']});}catch{/* Use the image decoder when native QR detection is unavailable. */}
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera için güvenli bağlantı (HTTPS) gerekli. Ürün kodunu elle girebilirsiniz.');
        let decoder:typeof import('jsqr').default|undefined;
        const canvas=document.createElement('canvas');
        const context=canvas.getContext('2d',{willReadFrequently:true});
        const decodeFrame=async(source:HTMLVideoElement)=>{
          if(!decoder)decoder=(await import('jsqr')).default;
          if(canceled||!context||source.readyState<2||!source.videoWidth||!source.videoHeight)return [];
          const scale=Math.min(1,960/Math.max(source.videoWidth,source.videoHeight));
          canvas.width=Math.max(1,Math.round(source.videoWidth*scale));canvas.height=Math.max(1,Math.round(source.videoHeight*scale));
          context.drawImage(source,0,0,canvas.width,canvas.height);
          const pixels=context.getImageData(0,0,canvas.width,canvas.height);
          const code=decoder(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
          return code?[{rawValue:code.data}]:[];
        };
        if(!detector){decoder=(await import('jsqr')).default;if(!context)throw new Error('Kamera görüntüsü işlenemedi. Lütfen tarayıcıyı yeniden açın.');}
        if(canceled)return;
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
        if(canceled){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
        setTorchAvailable(!!(media.getVideoTracks()[0]?.getCapabilities?.() as MediaTrackCapabilities & {torch?:boolean})?.torch);
        video.current!.srcObject=media;await video.current!.play();
        const scan=async()=>{if(canceled||!video.current)return;try{
          let codes:{rawValue:string}[];
          if(detector){try{codes=await detector.detect(video.current);}catch{detector=undefined;codes=await decodeFrame(video.current);}}
          else codes=await decodeFrame(video.current);
          if(canceled)return;if(codes[0]){select(codes[0].rawValue);return;}
        }catch{}if(!canceled)timer=setTimeout(scan,350);};await scan();
      }catch(error){if(canceled)return;setError(error instanceof DOMException&&error.name==='NotAllowedError'?'Kamera izni verilmedi. Tarayıcıdan izin verebilir veya ürün kodunu elle girebilirsiniz.':error instanceof Error?error.message:'Kamera açılamadı.');stop();}
    };void start();
    return()=>{canceled=true;clearTimeout(timer);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;};
  },[scanning]);
  useEffect(()=>{if(!scanning)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')stop();};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',close);};},[scanning]);
  return <div className="rq-scan-tools"><details onToggle={event=>{if(!event.currentTarget.open)stop();}} className={'rq-scan-panel'+(scanning?' rq-is-scanning':'')}><summary><QrCode size={16}/>QR Tara</summary><div className="rq-scan-content">
    <div className="rq-camera-frame">
      {scanning?<><video ref={video} playsInline muted className="h-full w-full object-cover"/><div className="rq-scan-guide" aria-hidden="true"/><Button onClick={stop} className="absolute bottom-3 left-3">Kamerayı kapat</Button>{torchAvailable&&<Button aria-pressed={torch} onClick={()=>void toggleTorch()} className="absolute top-3 right-3">{torch?'Feneri kapat':'Feneri aç'}</Button>}</>:<div className="flex flex-col items-center gap-4 p-6 text-center"><Camera size={32}/><p>Ürün etiketindeki QR kodunu tarayın.</p><Button variant="primary" onClick={()=>{setError('');setScanning(true);}}>Kamerayla tara</Button></div>}
    </div>
    <div className="space-y-4"><div><h2 className="rq-section-title">Ürün ve iş emrini aç</h2><p className="rq-helper">Kamerayı kullanın veya ürün kodunu / QR bağlantısını elle girin.</p></div>
      <form onSubmit={event=>{event.preventDefault();select(input);}} className="space-y-3"><Field label="Ürün kodu veya QR bağlantısı"><Input aria-label="QR bağlantısı veya parça kodu" aria-invalid={!!error} aria-describedby={error?'qr-scan-error':undefined} value={input} onChange={e=>setInput(e.target.value)} placeholder="PRD-2026-001 veya QR bağlantısı"/></Field><Button type="submit" variant="primary">Ürünü aç</Button></form>
      {error&&<div role="alert" id="qr-scan-error" className="rq-feedback rq-tone-danger"><AlertTriangle size={18}/><p>{error}</p></div>}
      {selected&&<div role="status" className="rq-feedback rq-tone-success"><CheckCircle2 size={18}/><div><strong>Ürün seçildi</strong><p>{products.find(p=>p.id===selected.id)?.name}</p><p className="rq-technical">{products.find(p=>p.id===selected.id)?.code}</p><p>İş emri: {selected.workOrder||'Belirtilmedi'}</p></div></div>}
    </div>
  </div></details><details className="rq-scan-panel"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-600 [&::-webkit-details-marker]:hidden"><Tag className="h-4 w-4"/>Etiket Oluştur</summary><div className="rq-label-layout">
    <div><h2 className="rq-section-title">Etiket bilgileri</h2><p className="rq-helper">Kontrol planını açan ürün etiketi. İş emri bağlantıya dahil edilir.</p>
      <Field label="Etiket ürünü"><Select value={productId} onChange={event=>setProductId(event.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</Select></Field>
      <div className="mt-4"><Field label="İş emri (isteğe bağlı)"><Input value={workOrder} onChange={e=>setWorkOrder(e.target.value)} maxLength={120}/></Field></div>
      {qr&&<a href={qr} download={'kontrol-'+(products.find(p=>p.id===productId)?.code||'etiket')+'.png'} className="rq-button rq-button-primary mt-5">QR etiketini indir</a>}
    </div>
    <div className="rq-label-preview"><span className="rq-eyebrow">ETİKET ÖNİZLEMESİ</span>{qr?<><img src={qr} alt="Kontrol planını açan QR etiketi" width={256} height={256}/><strong>{products.find(p=>p.id===productId)?.name}</strong><p className="rq-technical">{products.find(p=>p.id===productId)?.code}</p><p>İş emri: {workOrder||'Belirtilmedi'}</p></>:<p>Etiket için ürün seçin.</p>}<p className="rq-helper break-all">{link.href}</p></div>
  </div></details></div>;
}
