'use strict';
// Public presentation opens supplied screenshots, never operational accounts.
const publicScreens=["inventory-mobile.png","inventory.png","job.png","machine-planning.png","master.png","operator-drawing-mobile.png","operator-mobile.png","orders.png","outsourcing.png","overview-mobile.png","overview.png","production-monitor.png","production-orders.png","quality.png","returns.png","shifts.png","shipping.png","team.png"];
const publicDialog=document.querySelector('#live');
publicDialog.querySelector('iframe').hidden=true;
const publicImage=document.createElement('img');
publicImage.style.cssText='display:block;max-width:100%;height:auto;margin:auto';
publicDialog.appendChild(publicImage);
publicDialog.querySelector('.live-note').textContent='Tanıtım sunumu · Ekran görüntüsü önizlemesi · Gerçek sisteme veri gönderilmez.';
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-route]');if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 const route=button.dataset.route;
 const key=Object.keys(routes).find(key=>routes[key]===route)||slides[current].screen||'overview';
 const file=publicScreens.includes(key+'.png')?key+'.png':'overview.png';
 publicImage.src='screens/'+file;
 publicImage.alt=slides[current].label+' ekran görüntüsü';
 document.querySelector('#live-title').textContent=slides[current].label+' · Ekran görüntüsü';
 document.querySelector('#new-tab').href='screens/'+file;
 document.querySelector('#new-tab').textContent='Görseli ayrı aç ↗';
 publicDialog.showModal();
},true);
for(const button of document.querySelectorAll('[data-route]'))button.title='Sunumdaki örnek ekran görüntüsünü aç';
