// Native Android camera/file dialog probes. No contacts or messaging are opened.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
module.exports=async({devices,run,tap,shot,start,enter,shell,out,delay,phoneApi,alreadyStarted=false})=>{
 function ui(d){const remote='/sdcard/ritim-qa-device-ui.xml';shell(d,'shell','uiautomator','dump',remote);const xml=shell(d,'exec-out','cat',remote);shell(d,'shell','rm',remote);return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));}
 function touch(d,node){const match=node.bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);if(!match)return false;shell(d,'shell','input','tap',String(Math.round((+match[1]+ +match[3])/2)),String(Math.round((+match[2]+ +match[4])/2)));return true;}
 for(const d of devices){
  await run('MEDIA-native-camera',d.id,async()=>{
   const p=d.p;if(!alreadyStarted){const close=p.getByRole('button',{name:'Kapat',exact:true});if(await close.count())await tap(p,close.last());await start(d);}
   await run('OFF-storage-write-failure',d.id,async()=>{
    await enter(d,'10,02');await delay(800);
    await p.evaluate(()=>{window.__qaOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=window.__qaOriginalPut;throw new DOMException('QA_STORAGE_FAILURE','QuotaExceededError');};});
    try{await tap(p,p.getByRole('button',{name:'Kaydet ve ilerle',exact:true}));await p.locator('.mm-error').waitFor();assert.equal(await p.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}).count(),0);await shot(d,'storage-write-rejected');return 'Controlled IndexedDB write failure on physical browser; cell not completed. Does not fill the phone disk.';}
    finally{await p.evaluate(()=>{if(window.__qaOriginalPut)IDBObjectStore.prototype.put=window.__qaOriginalPut;});}
   });
   await enter(d,'10,11');await tap(p,p.getByRole('button',{name:'Kaydet ve ilerle',exact:true}));await p.getByRole('dialog',{name:'Kanıt ve uygunsuzluk',exact:true}).waitFor();
   await tap(p,p.locator('.mm-file').filter({hasText:'Fotoğraf çek'}));await delay(2000);
   let nodes=ui(d);const permissions=nodes.find(n=>/permissioncontroller/.test(n.package||'')&&/Uygulamayı kullanırken|While using|Bu seferlik|Only this time/i.test(n.text||''));if(permissions){touch(d,permissions);await delay(1500);nodes=ui(d);}
   const shutter=nodes.find(n=>n.clickable==='true'&&/camera/.test(n.package||'')&&(/shutter_button|center_button_container/i.test(n['resource-id']||'')||/Fotoğraf çek|Take picture|Shutter|Prendre une photo/i.test(n['content-desc']||'')));
   if(!shutter){shell(d,'shell','screencap','-p','/sdcard/ritim-qa-camera.png');shell(d,'pull','/sdcard/ritim-qa-camera.png',path.join(out,d.id+'-camera-native.png'));shell(d,'shell','rm','/sdcard/ritim-qa-camera.png');shell(d,'shell','input','keyevent','4');throw Error('Native camera dialog needs manual action; no shutter identified. No picture taken.');}
   touch(d,shutter);await delay(2000);nodes=ui(d);const accept=nodes.find(n=>n.clickable==='true'&&/camera/.test(n.package||'')&&(/done|okay|save|confirm/i.test(n['resource-id']||'')||/^(Tamam|OK|Kaydet|Save|Utiliser|Enregistrer|Terminé|Valider)$/i.test(n.text||n['content-desc']||'')));if(accept){touch(d,accept);await delay(1500);}
   await p.locator('.mm-photos img').first().waitFor({timeout:15000});await shot(d,'real-camera-preview');
   await tap(p,p.getByRole('button',{name:'Sonucu kaydet',exact:true}));await p.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}).waitFor();await tap(p,p.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}));
   for(let i=0;i<30;i++){const r=await phoneApi(d,'/bootstrap');if(r.body?.inspectionLogs?.some(l=>l.samples?.some(s=>s.evidence?.diameter?.length))){await shot(d,'real-camera-synced');return 'Native camera photo returned to browser and evidence-bearing inspection read from real server.';}await delay(500);}
   assert.fail('Camera photo preview existed, but server evidence confirmation did not complete.');
  });
 }
};
