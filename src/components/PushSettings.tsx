import React, {useState} from 'react';
import { SaasApi } from '../services/api';
export function PushSettings(){
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const enable=async()=>{
    setBusy(true);try{
      if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Bu tarayıcı push bildirimlerini desteklemiyor. İşlerim içindeki bildirimleri kullanabilirsiniz. iPhone’da uygulamayı Ana Ekrana ekleyip oradan açın.');
      const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.');
      const config=await SaasApi.pushConfig() as {enabled:boolean;publicKey:string};if(!config.enabled)throw new Error('Push hizmeti sunucuda henüz etkinleştirilmemiş. Uygulama içi bildirimler aktif.');
      const registration=await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;
      const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
      const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      await SaasApi.subscribePush(subscription.toJSON());setMessage('Bu cihazda bildirimler etkin.');
    }catch(error){setMessage(error instanceof Error?error.message:'Bildirimler etkinleştirilemedi.');}finally{setBusy(false);}
  };
  return <div className="rounded-xl border bg-white p-4"><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void enable()} className="rounded-lg border p-3 text-sm">Bu cihazda push aç</button><button disabled={busy} onClick={async()=>{setBusy(true);try{await SaasApi.unsubscribePush();const registration=await navigator.serviceWorker?.getRegistration();await (await registration?.pushManager.getSubscription())?.unsubscribe();setMessage('Push kapatıldı.');}catch(error){setMessage(String(error));}finally{setBusy(false);}}} className="rounded-lg border p-3 text-sm">Push kapat</button></div>{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</div>;
}
