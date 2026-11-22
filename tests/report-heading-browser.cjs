// Local browser fixtures only; production records are never changed.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'D:/Projects/RitimFlowLite/RitimFlowLite/node_modules/playwright');
const express=require('express'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const plan={id:'plan',productId:'part',version:'v1',status:'active',isActive:true,requiresApproval:true,characteristics:[{id:'c',pointNo:1,name:'Çap',type:'numeric',nominal:10,lsl:9,usl:11,unit:'mm',tool:'Kumpas',pin:{x:50,y:50}}]};
 let log;const base={id:'r',sessionCode:'INS-TEST',controlNumber:'KNT-1',productId:'part',productCode:'PART',productName:'Test parça',controlPlanId:'plan',controlPlanVersion:'v1',controlPlanSnapshot:plan,operatorName:'Ece',timestamp:new Date().toISOString(),sampleCount:1,overallStatus:'pass',totalPointsChecked:1,failedPointsCount:0,warningPointsCount:0,samples:[{sampleIndex:1,values:{c:10},statuses:{c:'pass'}}]};
 const app=express();app.get('/api/bootstrap',(_,res)=>res.json({company:{id:'review',name:'Test',plan_id:'enterprise',subscription_status:'active',unlimited_pilot:true},currentUserId:'u',users:[{id:'u',name:'Deniz',email:'test@example.invalid',role:'admin',status:'active'}],products:[{id:'part',code:'PART',name:'Test parça',images:[]}],controlPlans:[plan],inspectionLogs:[log],usage:{}}));app.get('/api/work',(_,res)=>res.json({cases:[],tasks:[],approvals:[],notifications:[]}));app.get('/api/*',(_,res)=>res.json([]));app.use(express.static('dist'));
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}),browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{localStorage.setItem('qualitrack_access_token','review.'+btoa(JSON.stringify({tenantId:'review',userId:'u',exp:9999999999}))+'.fixture');window.print=()=>{window.__printCalled=true;};});
 for(const state of ['pending','approved','rejected','not_required','admin','local']){
 log={...base,...state==='admin'?{operatorRoleAtMeasurement:'admin'}:state==='local'?{approval:{status:'approved'},clientSyncStatus:'pending'}:{approval:{status:state}}};
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#nav-tab-logs').click();
 if(state==='pending'){await page.getByRole('button',{name:'Ölçüm değerlerini gör',exact:true}).click();await page.getByRole('button',{name:'Kalite raporunu yazdır',exact:true}).click();}else await page.getByRole('button',{name:'Kalite raporu yazdır',exact:true}).click();
 const header=page.locator('.rq-report-header'),badge=header.locator('.rq-report-heading-state');await badge.waitFor();assert.equal(await badge.getAttribute('data-state'),state==='admin'?'not_required':state);assert.ok(!(await page.locator('body').innerText()).includes('Sertifikası'));
 if(state==='pending'){assert.match(await header.innerText(),/ONAY BEKLİYOR/);assert.equal(await badge.getAttribute('data-tone'),'warning');await page.getByRole('button',{name:'Detaylı',exact:true}).click();assert.match(await page.locator('.rq-report-traceability').innerText(),/Onay bekliyor/);await page.emulateMedia({media:'print'});assert.ok(await header.isVisible());await page.emulateMedia({media:'screen'});}
 if(state==='admin')assert.match(await header.innerText(),/Ek onay gerekmiyor/);
 fs.mkdirSync('.runtime/report-headings',{recursive:true});await page.screenshot({path:'.runtime/report-headings/'+state+'.png',fullPage:true});
 if(state==='pending'){await page.setViewportSize({width:390,height:844});assert.ok(await header.evaluate(e=>{const r=e.getBoundingClientRect();return r.width<=innerWidth;}));await page.screenshot({path:'.runtime/report-headings/pending-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});}
 }
 assert.deepEqual(errors,[]);console.log('PASS: report naming, pending/approved/rejected/no-approval/admin/local headers, detailed consistency, print visibility and mobile header.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
