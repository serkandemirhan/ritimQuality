import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import express from 'express';
import ts from 'typescript';
const out=resolve('.runtime/measurement-redesign');await mkdir(out,{recursive:true});
const source=await readFile('src/data/mockData.ts','utf8');
await writeFile(resolve(out,'mock.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const data=await import('../.runtime/measurement-redesign/mock.mjs');
const product=data.INITIAL_PRODUCTS[0];const plans=data.INITIAL_CONTROL_PLANS.filter(p=>p.productId===product.id);const plan=plans.find(p=>p.isActive)||plans[0];
const app=express();app.get('/api/bootstrap',(_,res)=>res.json({company:{id:'review',name:'Ölçüm İncelemesi',plan_id:'enterprise',subscription_status:'active',billing_period:'yearly'},currentUserId:'review-user',users:[{id:'review-user',name:'Operatör',role:'admin',status:'active',email:'review@example.test'}],products:[product],controlPlans:[{...plan,isActive:true,status:'active',defaultSampleCount:2}],inspectionLogs:[],usage:{control_plans:1,users:1,monthly_measurements:0}}));
app.get('/api/inspection-rules',(_,res)=>res.json({requireActivePlan:false,requireLotNumber:false,requireOrderNumber:false}));
app.get('/api/work',(_,res)=>res.json({tasks:[],cases:[],approvals:[],notifications:[]}));
app.get('/api/*',(_,res)=>res.json([]));app.use(express.static('dist'));
const server=app.listen(3345,'127.0.0.1');
const edge=spawn(process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--remote-debugging-port=9345','--user-data-dir='+resolve(out,'profile'),'--no-first-run','--disable-gpu','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try {
let target;for(let i=0;i<40;i++){try{target=(await(await fetch('http://127.0.0.1:9345/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}await delay(250);}if(!target)throw Error('Browser unavailable');
socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const h=pending.get(m.id);pending.delete(m.id);m.error?h.reject(m.error):h.resolve(m.result);}});
const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('qualitrack_access_token','review.eyJ0ZW5hbnRJZCI6InJldmlldyIsInVzZXJJZCI6InJldmlldy11c2VyIn0.preview');`});
await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await cmd('Page.navigate',{url:'http://127.0.0.1:3345'});await delay(1600);
await evaluate(`document.querySelector('#nav-tab-operator')?.click()`);await delay(300);
await evaluate(`(()=>{const s=document.querySelector('#select-operator-product');s.value=${JSON.stringify(product.id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(350);
await evaluate(`document.querySelector('#btn-start-inspection')?.click()`);await delay(500);
if(!await evaluate(`!!document.querySelector('[id^="input-measured-value"]')`))throw Error(await evaluate('document.body.innerText'));
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);
const press=async key=>{await evaluate(`Array.from(document.querySelectorAll('.measurement-keypad button')).find(b=>b.textContent===${JSON.stringify(key)})?.click()`);await delay(40);};
for(const key of ['3','2',',','0','1'])await press(key);
if(await evaluate(`document.querySelector('[id^="input-measured-value"]').value`)!=='32,01')throw Error('Decimal keypad input failed');
await press('⌫');if(await evaluate(`document.querySelector('[id^="input-measured-value"]').value`)!=='32,0')throw Error('Backspace lost trailing decimal');
await press('1');await press('±');if(await evaluate(`document.querySelector('[id^="input-measured-value"]').value`)!=='-32,01')throw Error('Negative input failed');await press('±');
if(!await evaluate(`document.querySelector('[id^="input-measured-value"]').readOnly`))throw Error('Phone would open native keyboard');
await evaluate(`document.querySelector('.keypad-next').click()`);await delay(150);
if(await evaluate(`document.querySelector('[id^="input-measured-value"]').value`)!=='')throw Error('Next point retained previous value');
await evaluate(`document.querySelector('.measurement-points button').click()`);await delay(150);
if(await evaluate(`document.querySelector('[id^="input-measured-value"]').value`)!=='32,01')throw Error('Returning to point lost value');
console.log('PASS: decimal, backspace, negative, readonly, point navigation and restored value');
const metrics=[];
for(const [name,width,height,mobile,focus] of [['desktop',1440,900,false,false],['tablet-landscape',1180,820,true,false],['tablet-portrait',820,1180,true,false],['phone',390,844,true,false],['phone-input',390,844,true,true],['phone-small',360,740,true,false],['phone-narrow',320,640,true,false]]){
await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await cmd('Emulation.setTouchEmulationEnabled',{enabled:mobile});await delay(300);
await evaluate(`document.activeElement?.blur();window.scrollTo(0,0);document.querySelector('main')?.scrollTo(0,0);`);
if(focus)await evaluate(`document.querySelector('[id^="input-measured-value"]').focus();document.querySelector('[id^="input-measured-value"]').scrollIntoView({block:'center'});`);
await delay(250);const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(out,name+'.png'),Buffer.from(shot.data,'base64'));
metrics.push({name,width,height,...await evaluate(`(()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,font:getComputedStyle(e).fontSize}};return {scrollWidth:document.documentElement.scrollWidth,drawing:rect('.quality-drawing'),input:rect('[id^="input-measured-value"]'),grid:rect('.quality-measurement-grid')}})()`)});
}
await writeFile(resolve(out,'metrics.json'),JSON.stringify(metrics,null,2));for (const item of metrics) {if (item.scrollWidth > item.width) throw Error(item.name + ': horizontal overflow'); if (item.drawing.x + item.drawing.width > item.input.x) throw Error(item.name + ': drawing overlaps input');} console.log('PASS: layout at '+metrics.length+' device sizes; screenshots in '+out);
}finally{socket?.close();edge.kill();server.close();}

