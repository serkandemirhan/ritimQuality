// Presentation and offline measurement regression fixtures. Camera decoding uses its separate harness.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import express from 'express';
import {build} from 'esbuild';
import {validateInspection,inspectionSignature} from '../dist-server/services/inspectionValidation.js';
const out=resolve('.runtime/mobile-ergonomics');await mkdir(out,{recursive:true});
await build({entryPoints:['src/services/mobileMeasurement.ts'],bundle:true,format:'esm',platform:'browser',outfile:resolve(out,'core.js'),define:{'import.meta.env.VITE_API_URL':'"/api"'}});
const chars=Array.from({length:50},(_,i)=>({id:`c${i+1}`,pointNo:i+1,name:`Ölçüm ${i+1}`,type:'numeric',nominal:18.5,lsl:18.4,usl:18.6,tolLower:-.1,tolUpper:.1,unit:'mm',tool:'Diğer Ölçüm Aleti',sampleSize:'5',frequency:'Parti',criticalClass:'minor',pin:{x:50,y:50},precision:3}));
const drawing='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240"><rect width="640" height="240" fill="#fff"/><path d="M100 80H540V170H100Z M80 50H560 M80 40V60 M560 40V60" fill="none" stroke="#142438" stroke-width="3"/><text x="280" y="40" font-size="24">18.5 mm</text></svg>').toString('base64');
const product={id:'part',code:'TEST-250',name:'Mobil kabul parçası',defaultDrawingUrl:drawing,images:[]};
const plan={id:'plan',productId:'part',version:'v1',status:'active',isActive:true,defaultSampleCount:5,characteristics:chars,characteristicImageLinks:[]};
const record={id:'synced-record',sessionCode:'INS-301a9771-dbe7-4ed0-935b-f56619113060',timestamp:new Date().toISOString(),productId:'part',productName:product.name,productCode:product.code,controlPlanId:'plan',controlPlanVersion:'v1',controlPlanSnapshot:plan,lotNumber:'LOT-2026-TEST-12345678901234567890',orderNumber:'ORDER-2026-TEST-12345678901234567890',operatorName:'Operatör',machineNo:'CNC-01',sampleCount:1,totalPointsChecked:1,failedPointsCount:0,overallStatus:'pass',samples:[{sampleIndex:1,values:{c1:18.5},statuses:{c1:'pass'}}]};
const app=express();app.use(express.json({limit:'20mb'}));let posts=0;let rejected=0;const accepted=new Map();let mediaFailure=true;const mediaIds=new Set();
let delayedId='';const heldUploads=[];
app.get('/test-reset',(_,res)=>res.type('html').send('<!doctype html><title>Reset</title>'));
app.get('/api/media/config',(_,res)=>res.json({provider:'local',maxBytes:8*1024*1024}));
app.post('/api/media',(req,res)=>{if(mediaFailure){res.status(503).json({error:'Fotoğraf yükleme hatası'});return;}mediaIds.add(req.body.id);res.json({...req.body,url:'/api/media/'+req.body.id,createdAt:new Date().toISOString()});});
app.get('/api/bootstrap',(_req,res)=>res.json({company:{id:'review',name:'Mobil Kabul',plan_id:'enterprise',subscription_status:'active'},currentUserId:'user',users:[{id:'user',name:'Operatör',role:'admin',status:'active',email:'test@example.test'}],products:[product],controlPlans:[plan],inspectionLogs:[record],usage:{control_plans:1,users:1,monthly_measurements:0}}));
app.get('/api/inspection-rules',(_,res)=>res.json({requireActivePlan:true,requireLotNumber:false,requireOrderNumber:false}));
app.get('/api/work',(_,res)=>res.json({tasks:[],cases:[],approvals:[],notifications:[]}));
app.post('/api/inspection-logs',async(req,res)=>{posts++;if(req.body.id===delayedId)await new Promise(resolve=>heldUploads.push(resolve));if(rejected){rejected--;res.status(409).json({error:'Revizyon uyuşmazlığı; yerel kayıt korundu.'});return;}try{const old=accepted.get(req.body.id);const signature=inspectionSignature(req.body);if(old&&old.signature!==signature)throw Error('Çakışma');const payload=old?.payload||validateInspection(req.body,plan,{id:'user',name:'Operatör'});accepted.set(req.body.id,{signature,payload});res.json(payload);}catch(e){res.status(409).json({error:e.message});}});
app.get('/api/*',(_,res)=>res.json([]));app.get('/test-core.js',(_,res)=>res.sendFile(resolve(out,'core.js')));app.use(express.static('dist'));

const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
const {chromium}=require('D:/Projects/RitimFlowLite/RitimFlowLite/node_modules/playwright');
const server=app.listen(3359,'127.0.0.1'),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('qualitrack_access_token','review.'+btoa(JSON.stringify({tenantId:'review',userId:'user',exp:9999999999}))+'.fixture');});
 const scope='review:user';
 const seed={id:'ergonomic-test',scope,product,plan:{...plan,characteristics:chars.slice(0,3)},count:3,operatorId:'user',operatorName:'Operatör',orderNumber:'',lotNumber:'',serialNumber:'',instrumentId:'CNC-01',source:'manual',active:{sample:1,characteristic:'c1'},order:'sample',drafts:{},attempts:[],media:{},createdAt:new Date().toISOString()};
 await page.goto('http://127.0.0.1:3359/test-reset');
 await page.evaluate(async seed=>{const core=await import('/test-core.js');await core.changeMobileSession('review:user',()=>seed);},seed);
 const open=async()=>{await page.goto('http://127.0.0.1:3359');await page.locator('#nav-tab-operator').evaluate(e=>e.click());await page.getByRole('button',{name:'Devam et',exact:true}).click();await page.locator('.mm-shell').waitFor();await page.locator('.mm-keypad').waitFor();};
 await open();
 const enter=async raw=>{for(const k of raw)await page.locator('.mm-keypad button').evaluateAll((buttons,k)=>buttons.find(b=>b.textContent===k).click(),k);};
 const attempts=()=>page.evaluate(async()=>{const c=await import('/test-core.js');return (await c.readMobileSession('review:user')).attempts;});
 await enter('25');await page.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.mm-characteristic h1').textContent.includes('2 /'));
 assert.equal(await page.locator('.mm-sheet[open]').count(),0,'Optional evidence interrupted NOK save');
 assert.equal((await attempts()).length,1);assert.equal((await attempts())[0].result,'fail');
 await page.getByRole('button',{name:'Tüm ölçümleri aç',exact:true}).click();
 const matrix=page.getByRole('dialog',{name:'Tüm ölçümler',exact:true});await matrix.waitFor();
 assert.equal(await matrix.locator('thead th').count(),4);assert.equal(await matrix.locator('tbody tr').count(),3);
 await matrix.getByLabel('Ölçüm tablosu filtresi').selectOption('missing');assert.equal(await matrix.locator('tbody tr').count(),3);
 await matrix.screenshot({path:resolve(out,'all-measurements.png')});
 await matrix.getByLabel('Ölçüm tablosu filtresi').selectOption('fail');assert.equal(await matrix.locator('tbody tr').count(),1);
 await matrix.locator('tbody button').first().click();await page.getByRole('button',{name:'Tekrar ölç',exact:true}).click();
 assert.equal(await page.locator('#mobile-measured-value').inputValue(),'25');
 // Clear via keypad and enter a passing replacement.
 await page.getByRole('button',{name:'Son rakamı sil',exact:true}).click();await page.getByRole('button',{name:'Son rakamı sil',exact:true}).click();await enter('18,5');
 assert.ok(await page.getByLabel('Tekrar ölçüm sebebi — giriş',{exact:true}).isVisible());
 await page.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();
 const retry=page.getByRole('dialog',{name:'Tekrar ölçüm',exact:true});await retry.waitFor();
 await page.waitForFunction(()=>document.activeElement.id==='mm-retry-reason');
 await retry.getByLabel('Tekrar ölçüm sebebi',{exact:true}).fill('Yanlış değer düzeltildi');
 await retry.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 assert.equal((await attempts()).length,2);assert.equal((await attempts())[0].result,'fail');assert.equal((await attempts())[1].result,'pass');
 // Required evidence still blocks; form context and validation identify the missing fields.
 await page.evaluate(async()=>{const c=await import('/test-core.js');await c.changeMobileSession('review:user',s=>({...s,plan:{...s.plan,characteristics:s.plan.characteristics.map(ch=>ch.id==='c2'?{...ch,policy:{requireComment:true,requireReason:true,minPhotos:1}}:ch)}}));});
 await open();await enter('25');await page.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();
 const evidence=page.getByRole('dialog',{name:'Not ve kanıt',exact:true});await evidence.waitFor();
 assert.ok((await evidence.locator('.mm-sheet-context').innerText()).includes('Numune 1'));
 await evidence.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();assert.equal((await attempts()).length,2);
 await evidence.getByLabel('Ölçüm açıklaması').fill('Yüzey kusuru');await evidence.getByLabel('Kusur sebebi',{exact:true}).fill('Çizik');
 // Simulate the visible viewport shrinking and moving when the software keyboard opens.
 await page.evaluate(()=>{const v=window.visualViewport;Object.defineProperty(v,'height',{configurable:true,get:()=>340});Object.defineProperty(v,'offsetTop',{configurable:true,get:()=>40});v.dispatchEvent(new Event('resize'));});
 await page.waitForTimeout(300);
 assert.ok(await evidence.evaluate(e=>{const r=e.getBoundingClientRect(),h=e.querySelector(':scope > header').getBoundingClientRect(),f=e.querySelector('.mm-sheet-footer').getBoundingClientRect(),b=e.querySelector('.mm-sheet-body').getBoundingClientRect();return r.top>=40&&r.bottom<=381&&h.bottom<=b.top+1&&b.bottom<=f.top+1;}),'Keyboard viewport overlaps header/body/actions');
 await evidence.screenshot({path:resolve(out,'keyboard-panel.png')});
 await evidence.getByLabel('Fotoğraf çek',{exact:true}).setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('image fixture')});
 await page.waitForTimeout(200);await evidence.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 assert.equal((await attempts()).length,3);
 await page.evaluate(()=>{const v=window.visualViewport;delete v.height;delete v.offsetTop;v.dispatchEvent(new Event('resize'));});
 for(const width of [320,390,430,768]){
 await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'Diğer işlemler',exact:true}).click();
 const tools=page.getByRole('dialog',{name:'Diğer işlemler',exact:true});
 assert.deepEqual(await tools.locator('h3').allTextContents(),['Sonuçlar','Aktif nokta','Ayarlar','Oturum']);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width);
 await tools.screenshot({path:resolve(out,'tools-'+width+'.png')});await tools.getByRole('button',{name:'Kapat',exact:true}).click();
 }
 // Dirty navigation is explicit and resumable; discard needs confirmation and removes only local active data.
 await page.setViewportSize({width:390,height:844});await enter('18');await page.getByRole('button',{name:'Eksik noktaya git',exact:true}).click();await page.getByRole('dialog',{name:'Kaydedilmemiş giriş var'}).waitFor();await page.getByRole('button',{name:'Vazgeç',exact:true}).click();
 await page.getByRole('button',{name:'Diğer işlemler',exact:true}).click();await page.getByRole('button',{name:'Ara ver ve çık',exact:true}).click();await page.getByRole('button',{name:'Taslakta bırak',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mm-shell'));await page.getByRole('button',{name:'Devam et',exact:true}).click();await page.locator('.mm-keypad').waitFor();assert.equal(await page.locator('#mobile-measured-value').inputValue(),'18');
 await page.getByRole('button',{name:'Diğer işlemler',exact:true}).click();await page.getByRole('button',{name:'Ölçümü sil ve kapat',exact:true}).click();await page.getByRole('button',{name:'Vazgeç',exact:true}).click();assert.equal((await attempts()).length,3);
 assert.match(await page.evaluate(async()=>{const c=await import('/test-core.js');try{await c.discardMobileSession('review:user','wrong-session');return 'unsafe';}catch(e){return e.message;}}),/silinemez/);
 assert.equal((await attempts()).length,3);
 await page.getByRole('button',{name:'Ölçümü sil ve kapat',exact:true}).click();await page.getByRole('button',{name:'Evet, ölçümü sil ve kapat',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.mm-shell'));
 assert.equal(await page.evaluate(async()=>{const c=await import('/test-core.js');return await c.readMobileSession('review:user')||null;}),null);
 // Submitted data cannot be discarded through the local service.
 assert.match(await page.evaluate(async seed=>{const c=await import('/test-core.js');await c.changeMobileSession('review:user',()=>({...seed,submissionRequested:true}));try{await c.discardMobileSession('review:user',seed.id);return 'unsafe';}catch(e){return e.message;}},seed),/silinemez/);
 assert.deepEqual(errors,[]);console.log('PASS: optional NOK flow, required evidence, visible retake reason and history, mobile matrix/navigation, keyboard viewport, menu/targets, dirty guard and safe discard');
}finally{await browser.close();server.close();}
