self.addEventListener('install',event=>{
  event.waitUntil(caches.open('ritim-quality-shell-v1').then(cache=>cache.addAll(['/','/index.html','/manifest.webmanifest','/qualitrack-mark.svg'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ritim-quality-shell-')&&key!=='ritim-quality-shell-v1').map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||new URL(event.request.url).pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open('ritim-quality-shell-v1').then(cache=>cache.put('/index.html',copy));return response;}).catch(()=>caches.match('/index.html')));
  else event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open('ritim-quality-shell-v1').then(cache=>cache.put(event.request,copy));}return response;})));
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'Ritim Quality',{body:data.body||'Yeni kalite bildirimi',tag:data.tag||'quality',data:{url:'/?view=work'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.openWindow(new URL('/?view=work',self.location.origin).href));
});
