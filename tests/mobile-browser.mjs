import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const fixture=JSON.parse(await readFile('.runtime/quality-test-fixture.json','utf8'));
const base='http://127.0.0.1:3300';
const profile=resolve('.runtime/quality-mobile-profile');await mkdir(profile,{recursive:true});
const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--remote-debugging-port=9339','--user-data-dir='+profile,'--no-first-run','--disable-gpu','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;
try{
 let target;for(let i=0;i<40;i++){try{target=(await (await fetch('http://127.0.0.1:9339/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}await delay(250);}
 if(!target)throw new Error('Browser unavailable');
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 let seq=0;const pending=new Map();const errors=[];
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(message.id){const handler=pending.get(message.id);pending.delete(message.id);message.error?handler.reject(message.error):handler.resolve(message.result);}});
 const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Page.javascriptDialogOpening'){errors.push('Unexpected dialog: '+message.params.message);void command('Page.handleJavaScriptDialog',{accept:true});}});
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result?.value;};
 await command('Runtime.enable');await command('Page.enable');
 await command('Page.navigate',{url:base});await delay(1000);
 await evaluate(`localStorage.clear();localStorage.setItem('qualitrack_access_token',${JSON.stringify(fixture.token)});location.reload()`);await delay(1600);
 // Realistic, isolated mobile fixture, separate revision from the API integrity tests.
 await evaluate(`(async()=>{const headers={'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('qualitrack_access_token')};const drawing='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20500%22%3E%3Crect%20width%3D%22800%22%20height%3D%22500%22%20fill%3D%22white%22%2F%3E%3Crect%20x%3D%22120%22%20y%3D%22100%22%20width%3D%22560%22%20height%3D%22300%22%20rx%3D%2240%22%20fill%3D%22%23dbeafe%22%20stroke%3D%22%231e293b%22%20stroke-width%3D%228%22%2F%3E%3C%2Fsvg%3E';await fetch('/api/products/part-a',{method:'PUT',headers,body:JSON.stringify({id:'part-a',code:'PART-A',name:'Test Part',customer:'Test Customer',material:'Steel',category:'Machining',description:'Mobile test',defaultDrawingUrl:drawing,images:[{id:'drawing-a',name:'Teknik Resim',url:drawing,mimeType:'image/svg+xml'}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})});const response=await fetch('/api/control-plans/mobile-plan',{method:'PUT',headers,body:JSON.stringify({id:'mobile-plan',productId:'part-a',version:'v2.0',isActive:true,status:'active',requiresApproval:false,defaultSampleCount:1,drawingImageUrl:drawing,author:'Quality Manager',approvedBy:'',revisionDate:'2026-09-13',revisionNote:'Mobile test',characteristics:[{id:'mobile-diameter',pointNo:1,name:'Diameter',type:'numeric',nominal:10,lsl:9,usl:11,tolUpper:1,tolLower:-1,unit:'mm',tool:'Diğer Ölçüm Aleti',sampleSize:'1',frequency:'Parti başı',criticalClass:'major',pin:{x:50,y:50}}],characteristicImageLinks:[{id:'mobile-link',characteristicId:'mobile-diameter',imageId:'drawing-a',annotations:[{id:'test-measurement-line',type:'measurement_line',startX:20,startY:25,endX:78,endY:65,label:'#1',color:'#dc2626'}]}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})});if(!response.ok)throw new Error(await response.text());location.reload();})()`);await delay(1000);
 const setInput=`(element,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));}`;
 const dimensions=[];
 for(let attempt=0;attempt<40;attempt++){if(await evaluate(`!!document.querySelector('aside')`))break;await delay(250);}
 await command('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});await delay(300);
 const sidebar=await evaluate(`(()=>{const aside=Array.from(document.querySelectorAll('aside')).find(e=>e.getBoundingClientRect().width>0);const nav=aside.querySelector('nav');return {height:nav.clientHeight,scroll:nav.scrollHeight,hand:!!aside.querySelector('select')};})()`);
 assert.equal(sidebar.hand,false,'Hand preference is absent from navigation');
 assert.ok(sidebar.scroll<=sidebar.height+1,'Desktop sidebar fits at 1366×768: '+JSON.stringify(sidebar));
 await evaluate(`document.querySelector('#nav-tab-settings').click()`);await delay(200);
 assert.ok(await evaluate(`!!document.querySelector('select[aria-label="Kullanılan el"]')`),'Hand preference is in Settings');
 await evaluate(`document.querySelector('#nav-tab-operator').click()`);await delay(200);
 await evaluate(`(()=>{const select=document.querySelector('#select-operator-product');select.value='part-a';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);
 for(const width of [320,360,390,430]){
   await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await command('Emulation.setTouchEmulationEnabled',{enabled:true});await delay(250);
   const state=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:document.body.innerText.slice(0,200)})`);
   dimensions.push({stage:'setup',width,...state});
 }
 await evaluate(`(()=>{const set=${setInput};const inputs=Array.from(document.querySelectorAll('input'));const lot=inputs.find(i=>i.placeholder?.includes('Parti')||i.placeholder?.includes('LOT'));const wo=inputs.find(i=>i.placeholder?.includes('İş')||i.placeholder?.includes('IE-'));return inputs.map(i=>({placeholder:i.placeholder,type:i.type,id:i.id}));})()`).then(result=>console.log('Setup inputs',JSON.stringify(result)));
 const inputInfo=await evaluate(`Array.from(document.querySelectorAll('input')).map(i=>({placeholder:i.placeholder,type:i.type,id:i.id}))`);
 // Select by the surrounding visible labels rather than relying on layout coordinates.
 await evaluate(`(()=>{const set=${setInput};const inputs=Array.from(document.querySelectorAll('input'));for(const i of inputs){const label=i.parentElement.textContent;if(label.includes('Parti')||label.includes('Şarj'))set(i,'MOBILE-LOT');if(label.includes('İş Emri'))set(i,'MOBILE-WO');}return Array.from(document.querySelectorAll('button')).map(b=>b.innerText).filter(t=>t.includes('Başla'));})()`).then(result=>console.log('Start buttons',JSON.stringify(result)));
 await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Ölçüme Başla')||b.innerText.includes('Kontrole Başla')||b.id==='btn-start-inspection')?.click()`);await delay(400);
 let active=await evaluate(`Boolean(document.querySelector('#btn-save-inspection-log'))`);
 if(!active){console.log('Page',await evaluate('document.body.innerText'));throw new Error('Inspection did not start');}
 await evaluate(`(()=>{const input=document.querySelector('input[type="number"]');const set=${setInput};set(input,'12');})()`);await delay(200);
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Son nokta'))?.disabled`),true,'Final measurement disables next navigation');
 assert.ok(await evaluate(`document.querySelector('#btn-save-inspection-log')?.className.includes('emerald')`),'Completed measurement highlights save/PDF action');
 assert.ok(await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.innerText.includes('Kaydet ve devret'))`),'In-progress inspection can be saved for another operator');
 assert.ok(await evaluate(`!!document.querySelector('textarea[aria-label="Ölçüm noktası notu"]')`),'NOK point offers an optional note even without an evidence policy');
 assert.ok(await evaluate(`!!document.querySelector('input[type="file"]')`),'NOK point offers an optional attachment');
 for(const [width,height] of [[320,640],[360,740],[390,844],[430,932],[740,360],[390,400]]){
   await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(200);
   const state=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,saveHeight:document.querySelector('#btn-save-inspection-log').getBoundingClientRect().height,navHeight:document.querySelector('.quality-bottom-nav').getBoundingClientRect().height})`);
   dimensions.push({stage:'measurement',width,height,...state});
 }
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const png=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('.runtime/quality-mobile.png',Buffer.from(png.data,'base64'));
 await command('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 for(const tab of ['overview','work','organization','products','control-plans','logs','users','settings','spc']){
   await evaluate(`document.querySelector('#nav-tab-${tab}').click()`);await delay(350);
   assert.ok(await evaluate(`!!document.querySelector('main')`),tab+' renders');
   if(tab!=='overview')assert.equal(await evaluate(`document.body.innerText.includes('İlk kontrole başlayalım')`),false,'Onboarding appears only on overview');
   if(tab==='control-plans'){
     await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.innerText.includes('Test Part'))?.click()`);await delay(200);
     assert.equal(await evaluate(`document.querySelectorAll('#characteristic-chip-1').length`),1,'Characteristic navigation renders');
     const chipBox=await evaluate(`(()=>{const box=document.querySelector('#characteristic-chip-1').getBoundingClientRect();return {width:box.width,height:box.height};})()`);
     assert.ok(chipBox.width>=40&&chipBox.width<=44.5&&chipBox.height>=34&&chipBox.height<=36.5,'Characteristic chip uses compact fixed dimensions: '+JSON.stringify(chipBox));
     assert.equal(await evaluate(`Array.from(document.querySelectorAll('h3')).filter(e=>e.innerText.startsWith('#1 ')).length`),1,'Single-characteristic mode renders one named editor');
     assert.ok(await evaluate(`(()=>{const labels=Array.from(document.querySelectorAll('label'));const tops=['Kontrol tipi','Önem seviyesi','Kanıt politikası'].map(text=>labels.find(label=>label.innerText.startsWith(text))?.getBoundingClientRect().top);return tops.every(Number.isFinite)&&Math.max(...tops)-Math.min(...tops)<2;})()`),'Type, severity and evidence policy share one row');
     assert.ok(await evaluate(`(()=>{const labels=Array.from(document.querySelectorAll('label'));const tops=['Nominal','Alt tolerans','Üst tolerans','Birim'].map(text=>labels.find(label=>label.innerText.startsWith(text))?.getBoundingClientRect().top);return tops.every(Number.isFinite)&&Math.max(...tops)-Math.min(...tops)<2;})()`),'Nominal, tolerances and unit share one row');
     const lineGeometry=await evaluate(`(()=>{const group=document.querySelector('g[data-annotation-id="test-measurement-line"]');if(!group)return {found:false};const main=group.querySelector('line:not([data-role])'),cap=group.querySelector('[data-role="start-cap"]'),svg=group.ownerSVGElement,box=svg.getBoundingClientRect();const n=e=>Number(e);const dx=(n(main.getAttribute('x2'))-n(main.getAttribute('x1')))*box.width/100,dy=(n(main.getAttribute('y2'))-n(main.getAttribute('y1')))*box.height/100,cx=(n(cap.getAttribute('x2'))-n(cap.getAttribute('x1')))*box.width/100,cy=(n(cap.getAttribute('y2'))-n(cap.getAttribute('y1')))*box.height/100,dot=Math.abs(dx*cx+dy*cy),cosine=dot/(Math.hypot(dx,dy)*Math.hypot(cx,cy));return {found:true,stroke:main.getAttribute('stroke'),dot,cosine,box:{width:box.width,height:box.height},line:{dx,dy},cap:{cx,cy}};})()`);
     assert.ok(lineGeometry.found&&lineGeometry.stroke==='#dc2626'&&lineGeometry.cosine<0.0001,'Measurement end cap is perpendicular and custom color persists: '+JSON.stringify(lineGeometry));
     assert.equal(await evaluate(`document.querySelectorAll('g[data-annotation-id="test-measurement-line"] polygon[data-role$="-arrow"]').length`),2,'Measurement line has engineering arrowheads at both endpoints');
     assert.equal(await evaluate(`document.querySelectorAll('[role="menu"] button').length`),0,'Color choices stay collapsed until requested');
     await evaluate(`document.querySelector('button[aria-haspopup="menu"]').click()`);await delay(50);
     assert.equal(await evaluate(`document.querySelectorAll('[role="menu"] button').length`),6,'Selected color opens a compact color menu');
     await evaluate(`document.querySelector('[role="menu"] button').click()`);await delay(50);
     await evaluate(`document.querySelector('g[data-annotation-id="test-measurement-line"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);await delay(50);
     assert.equal(await evaluate(`document.querySelectorAll('rect[aria-label$="noktasını taşı"]').length`),2,'Selected measurement exposes square draggable start and end handles');
     const startHandle=await evaluate(`(()=>{const handle=document.querySelector('rect[aria-label="Başlangıç noktasını taşı"]');handle.scrollIntoView({block:'center'});const rect=handle.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,before:Number(handle.getAttribute('x'))};})()`);await delay(80);
     await command('Input.dispatchMouseEvent',{type:'mousePressed',x:startHandle.x,y:startHandle.y,button:'left',clickCount:1});
     await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:startHandle.x+35,y:startHandle.y+15,button:'left',buttons:1});
     await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:startHandle.x+35,y:startHandle.y+15,button:'left',clickCount:1});await delay(80);
     assert.notEqual(await evaluate(`Number(document.querySelector('rect[aria-label="Başlangıç noktasını taşı"]').getAttribute('x'))`),startHandle.before,'Measurement start handle is draggable');
     await evaluate(`document.querySelector('#btn-toggle-all-characteristics').click()`);await delay(100);
     assert.equal(await evaluate(`document.querySelectorAll('details[data-characteristic-id]').length`),1,'Compact all view renders characteristics as accordions');
   }
   if(tab==='settings'){
     assert.ok(await evaluate(`document.body.innerText.includes('Telefona uygulama olarak ekle')`),'Settings exposes device-aware PWA installation');
     assert.ok(await evaluate(`!!document.querySelector('link[rel="manifest"]')`),'PWA manifest is linked');
     assert.ok(await evaluate(`navigator.serviceWorker?.getRegistration().then(Boolean)`),'Production app registers its service worker');
   }
   for(const [width,height] of [[390,844],[1024,768],[1280,800]]){
     await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1024});await delay(120);
     const state=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);dimensions.push({stage:tab,...state});
   }
 }
 console.log(JSON.stringify({dimensions,errors},null,2));
 assert.equal(errors.length,0,'No browser runtime errors');
 for(const item of dimensions)assert.ok(item.scrollWidth<=item.width+1,`Horizontal overflow at ${item.stage} ${item.width}: ${item.scrollWidth}`);
 console.log('PASS: mobile viewport checks');
}finally{socket?.close();edge.kill();}
