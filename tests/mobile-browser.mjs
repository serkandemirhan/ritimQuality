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
 await evaluate(`(async()=>{const headers={'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('qualitrack_access_token')};await fetch('/api/products/part-a',{method:'PUT',headers,body:JSON.stringify({id:'part-a',code:'PART-A',name:'Test Part',customer:'Test Customer',material:'Steel',category:'Machining',description:'Mobile test',defaultDrawingUrl:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})});const response=await fetch('/api/control-plans/mobile-plan',{method:'PUT',headers,body:JSON.stringify({id:'mobile-plan',productId:'part-a',version:'v2.0',isActive:true,status:'active',requiresApproval:false,defaultSampleCount:1,drawingImageUrl:'',author:'Quality Manager',approvedBy:'',revisionDate:'2026-09-13',revisionNote:'Mobile test',characteristics:[{id:'mobile-diameter',pointNo:1,name:'Diameter',type:'numeric',nominal:10,lsl:9,usl:11,tolUpper:1,tolLower:-1,unit:'mm',tool:'Diğer Ölçüm Aleti',sampleSize:'1',frequency:'Parti başı',criticalClass:'major',pin:{x:50,y:50}}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})});if(!response.ok)throw new Error(await response.text());location.reload();})()`);await delay(1000);
 const setInput=`(element,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));}`;
 const dimensions=[];
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
 for(const [width,height] of [[320,640],[360,740],[390,844],[430,932],[740,360],[390,400]]){
   await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(200);
   const state=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,saveHeight:document.querySelector('#btn-save-inspection-log').getBoundingClientRect().height,navHeight:document.querySelector('.quality-bottom-nav').getBoundingClientRect().height})`);
   dimensions.push({stage:'measurement',width,height,...state});
 }
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const png=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('.runtime/quality-mobile.png',Buffer.from(png.data,'base64'));
 console.log(JSON.stringify({dimensions,errors},null,2));
 assert.equal(errors.length,0,'No browser runtime errors');
 for(const item of dimensions)assert.ok(item.scrollWidth<=item.width+1,`Horizontal overflow at ${item.stage} ${item.width}: ${item.scrollWidth}`);
 console.log('PASS: mobile viewport checks');
}finally{socket?.close();edge.kill();}
