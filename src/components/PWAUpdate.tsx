import {useEffect,useState} from 'react';
import {Button} from './ui';
export function PWAUpdate(){const [registration,setRegistration]=useState<ServiceWorkerRegistration>(),[visible,setVisible]=useState(false),[active,setActive]=useState(false);
 useEffect(()=>{if(!import.meta.env.PROD||!('serviceWorker'in navigator))return;let live=true;let timer:ReturnType<typeof setInterval>|undefined;const update=()=>setActive(Boolean(document.querySelector('.quality-session,.mm-shell,.rq-plan-editor-page,dialog[open]')));
 const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});update();
 void navigator.serviceWorker.register('/service-worker.js').then(r=>{if(!live)return;setRegistration(r);const ready=()=>{if(r.waiting&&navigator.serviceWorker.controller)setVisible(true);};ready();r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',ready));timer=setInterval(()=>void r.update().catch(()=>{}),60000);}).catch(()=>{});
 return()=>{live=false;observer.disconnect();if(timer)clearInterval(timer);};},[]);
 if(!visible)return null;
 return <aside className="rq-update-notice" role="status"><div><strong>Yeni sürüm hazır</strong><p>{active?'Açık işlemi tamamladıktan sonra güncelleyebilirsiniz.':'Son düzenlemeleri yüklemek için uygulamayı yenileyin.'}</p></div><Button onClick={()=>setVisible(false)}>Daha sonra</Button><Button variant="primary" disabled={active} onClick={()=>{if(document.querySelector('.quality-session,.mm-shell,.rq-plan-editor-page,dialog[open]'))return;if(!registration?.waiting){location.reload();return;}const reload=()=>location.reload();navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});registration?.waiting?.postMessage({type:'SKIP_WAITING'});}}>Güncelle</Button></aside>;
}
