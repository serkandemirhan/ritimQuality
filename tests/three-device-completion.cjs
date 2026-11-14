// Resume persisted synthetic physical-device checkpoints without changing the plan.
const fs=require('fs'),assert=require('node:assert/strict'),{execFileSync}=require('child_process');
const {chromium}=require('D:/Projects/RitimFlowLite/RitimFlowLite/node_modules/playwright');
const out='.runtime/three-device-acceptance',f=JSON.parse(fs.readFileSync(out+'/fixture-stable.json')),origin=JSON.parse(fs.readFileSync(out+'/local-session.json')).origin;
assert.equal(new URL(origin).hostname,'127.0.0.1');
const ds=[{id:'T1',serial:'R5CTB21F4LH',port:9223},{id:'T2',serial:'RFCRC1R150K',port:9224}],results=[],bs=[],sent=[];let admin;
const save=()=>fs.writeFileSync(out+'/completion-results.json',JSON.stringify({environment:'Real Android devices, local isolated PostgreSQL, automated CDP touch; not production',results},null,2));
async function api(url,token,method='GET',body,expected){const r=await fetch(origin+'/api'+url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>null);if(expected)assert.equal(r.status,expected,JSON.stringify(data));else assert.ok(r.ok,url+': '+JSON.stringify(data));return data;}
async function check(id,device,fn){try{results.push({id,device,status:'Geçti',detail:await fn(),time:new Date().toISOString()});console.log('PASS '+id+' '+device);}catch(e){results.push({id,device,status:'Kaldı',detail:e.message});throw e;}finally{save();}}
async function tap(p,l){await p.bringToFront();await l.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await p.waitForTimeout(350);const r=await l.boundingBox();assert.ok(r);const c=await p.context().newCDPSession(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
(async()=>{
 admin=await api('/auth/login','', 'POST',{workspace:f.a.slug,email:f.a.adminEmail,password:'Physical-acceptance-test-123!'});
 const baseline=(await api('/bootstrap',admin.token)).inspectionLogs.length;
 for(const [i,d]of ds.entries()){
  execFileSync('C:/Users/serkan/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s',d.serial,'shell','input','keyevent','224']);
  execFileSync('C:/Users/serkan/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s',d.serial,'reverse','tcp:3000','tcp:'+new URL(origin).port]);
  const b=await chromium.connectOverCDP('http://127.0.0.1:'+d.port);bs.push(b);const p=b.contexts()[0].pages().findLast(p=>p.url().startsWith('http://localhost:3000'))||await b.contexts()[0].newPage();d.p=p;await p.bringToFront();p.setDefaultTimeout(30000);
  await p.context().setOffline(false);await p.goto('http://localhost:3000/');
  if(await p.getByRole('button',{name:'Giriş yap',exact:true}).count()){
   await p.getByLabel('Çalışma alanı',{exact:true}).fill(f.a.slug);await p.getByLabel('E-posta adresi',{exact:true}).fill(f.a.users[i].email);await p.getByLabel('Şifre',{exact:true}).fill('Physical-acceptance-test-123!');execFileSync('C:/Users/serkan/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s',d.serial,'shell','input','keyevent','111']);await p.waitForTimeout(600);await tap(p,p.getByRole('button',{name:'Giriş yap',exact:true}));
  }
  await p.getByRole('button',{name:'Mobil kontrole devam et',exact:true}).waitFor();await tap(p,p.getByRole('button',{name:'Mobil kontrole devam et',exact:true}));await p.locator('.mm-shell').waitFor();
  if(await p.locator('#mobile-measured-value').count()){
   const input=p.locator('#mobile-measured-value');for(let k=0;k<20&&await input.inputValue();k++)await tap(p,p.locator('.mm-keypad [data-key="⌫"]'));
   for(const k of (i===0?'9,90':'10,10'))await tap(p,p.locator('.mm-keypad [data-key="'+k+'"]'));
   await tap(p,p.getByRole('button',{name:'Kaydet ve ilerle',exact:true}));
  }
  await p.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}).waitFor();
  p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/inspection-logs'))sent.push({device:d.id,payload:r.postDataJSON()});});
  await p.screenshot({path:out+'/'+d.id+'-ready-to-submit.png'});
 }
 await check('RACE-01','T1 T2 D',async()=>{await Promise.all(ds.map(d=>tap(d.p,d.p.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}))));let logs=[];for(let i=0;i<30;i++){logs=(await api('/bootstrap',admin.token)).inspectionLogs;if(logs.length===baseline+2)break;await new Promise(r=>setTimeout(r,500));}assert.equal(logs.length,baseline+2);assert.equal(sent.length,2);const rows=sent.map(s=>logs.find(l=>l.id===s.payload.id));assert.ok(rows.every(Boolean));assert.equal(new Set(rows.map(r=>r.controlNumber)).size,2);for(const d of ds)await d.p.screenshot({path:out+'/'+d.id+'-synced-report.png'});return rows.map(r=>({id:r.id,controlNumber:r.controlNumber,operator:r.operatorName,values:r.samples[0].values}));});
 await check('SAVE-01','T1 T2 D',async()=>{const logs=(await api('/bootstrap',admin.token)).inspectionLogs;for(const [i,d]of ds.entries()){const row=logs.find(l=>l.id===sent.find(s=>s.device===d.id).payload.id);assert.equal(row.operatorUserId,f.a.users[i].id);assert.equal(row.samples[0].values.diameter,i===0?9.9:10.1);assert.equal(row.overallStatus,'pass');}return 'Physical boundaries and actual user identity verified by independent server read.';});
 for(const [i,d]of ds.entries())d.auth=await api('/auth/login','', 'POST',{workspace:f.a.slug,email:f.a.users[i].email,password:'Physical-acceptance-test-123!'});
 await check('SAVE-04-replay','D API',async()=>{for(const d of ds)await api('/inspection-logs',d.auth.token,'POST',sent.find(s=>s.device===d.id).payload);assert.equal((await api('/bootstrap',admin.token)).inspectionLogs.length,baseline+2);return 'Exact payload retries create no duplicates; double-touch and lost-response remain separate tests.';});
 await check('SAVE-06','D API',async()=>{const bad=structuredClone(sent.find(s=>s.device==='T1').payload);bad.notes='Conflicting test payload';await api('/inspection-logs',ds[0].auth.token,'POST',bad,409);});
 await check('PLAN-07','D API',async()=>{const b=await api('/bootstrap',admin.token);const plan=b.controlPlans.find(p=>p.id==='physical-plan');const bad=structuredClone(plan);bad.characteristics[0].usl=11;await api('/control-plans/'+plan.id,admin.token,'PUT',bad,409);});
 const owner=await api('/auth/login','', 'POST',{workspace:'platform-owner',email:'owner@example.invalid',password:'Local-test-password-123!'});
 await check('RACE-10','D API T1 T2',async()=>{await api('/platform/tenants/'+f.a.tenant.id,owner.token,'PATCH',{unlimitedPilot:true,suspended:true,reason:'Physical acceptance maintenance test'});try{for(const d of ds){const status=await d.p.evaluate(async()=>{const r=await fetch('/api/bootstrap',{headers:{Authorization:'Bearer '+localStorage.getItem('qualitrack_access_token')}});return r.status;});assert.equal(status,403);}}finally{await api('/platform/tenants/'+f.a.tenant.id,owner.token,'PATCH',{unlimitedPilot:true,suspended:false,reason:'Physical acceptance maintenance complete'});}return 'Both real sessions blocked during suspension, independent of unlimited pilot.';});
 for(const d of ds){await check('SHARE-pdf-ready',d.id,async()=>{await d.p.getByRole('button',{name:'PDF indir',exact:true}).waitFor();await d.p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF indir'&&!b.disabled));return 'Actual PDF generation completed in Android browser; native filesystem and WhatsApp receiver still require manual acceptance.';});}
})().catch(async e=>{console.error(e.stack);for(const d of ds){if(d.p){try{fs.writeFileSync(out+'/'+d.id+'-last-state.txt',(await d.p.locator('body').innerText()).replace(/Bearer\s+\S+/g,'[REDACTED]'));await d.p.screenshot({path:out+'/'+d.id+'-last-state.png'});}catch{}}}process.exitCode=1;}).finally(async()=>{save();for(const b of bs)await b.close();});
