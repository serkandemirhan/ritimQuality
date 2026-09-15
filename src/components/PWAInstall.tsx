import React,{useEffect,useState} from 'react';

interface InstallPromptEvent extends Event {
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
}
interface StandaloneNavigator extends Navigator {standalone?:boolean}

export function PWAInstall(){
  const [prompt,setPrompt]=useState<InstallPromptEvent|null>(null);
  const [instructions,setInstructions]=useState(false);
  const [installed,setInstalled]=useState(()=>window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as StandaloneNavigator).standalone));
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const android=/Android/.test(navigator.userAgent);
  useEffect(()=>{const available=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent);};const complete=()=>{setInstalled(true);setPrompt(null);setInstructions(false);};window.addEventListener('beforeinstallprompt',available);window.addEventListener('appinstalled',complete);return()=>{window.removeEventListener('beforeinstallprompt',available);window.removeEventListener('appinstalled',complete);};},[]);
  const install=async()=>{if(installed)return;if(prompt){await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setInstalled(true);setPrompt(null);return;}setInstructions(true);};
  return <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-bold text-slate-900">Telefona uygulama olarak ekle</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Ritim Quality’yi tam ekran açın ve bu cihazda bildirim testleri yapın. {android?'Android cihaz algılandı.':ios?'iPhone/iPad algılandı.':'Cihazınıza uygun kurulum yöntemi gösterilir.'}</p></div>
      <button type="button" disabled={installed} onClick={()=>void install()} className="quality-primary disabled:cursor-default disabled:bg-emerald-600">{installed?'Bu cihazda yüklü':prompt?'Ana ekrana ekle':ios?'iPhone/iPad’e ekle':'Kurulum adımlarını göster'}</button>
    </div>
    {instructions&&<div role="status" className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">{ios?<ol className="list-decimal space-y-2 pl-5"><li>Bu sayfayı Safari ile açın.</li><li>Safari araç çubuğundaki <strong>Paylaş</strong> simgesine dokunun.</li><li><strong>Ana Ekrana Ekle</strong> seçeneğine, ardından <strong>Ekle</strong> düğmesine dokunun.</li></ol>:<p>Tarayıcı menüsünü açıp <strong>Uygulamayı yükle</strong> veya <strong>Ana ekrana ekle</strong> seçeneğini kullanın. Chrome/Edge kurulum koşulları oluştuğunda bu düğme doğrudan kurulum penceresini açar.</p>}</div>}
  </section>;
}
