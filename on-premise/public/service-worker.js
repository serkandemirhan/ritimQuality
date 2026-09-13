self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'Ritim Quality',{body:data.body||'Yeni kalite bildirimi',tag:data.tag||'quality',data:{url:'/?view=work'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.openWindow(new URL('/?view=work',self.location.origin).href));
});
