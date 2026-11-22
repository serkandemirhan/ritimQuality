// Browser fixtures only. SQL filtering and access control are covered by the integration test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'D:/Projects/RitimFlowLite/RitimFlowLite/node_modules/playwright');
const express=require('express'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const cases=Array.from({length:260},(_,i)=>({id:'case-'+i,inspection_id:'log-'+i,title:'NOK: PRODUCT-'+String(i).padStart(3,'0'),product_code:'PRODUCT-'+String(i).padStart(3,'0'),lot_number:'LOT-'+i,machine_no:'CNC-01',owner_id:i%2?'u':null,owner_name:i%2?'Deniz':null,created_by:'creator',created_by_name:'Ece',created_at:new Date(Date.UTC(2026,10,1,0,i)).toISOString(),due_at:null,severity:i%2?'critical':'major',state:'open',containment:'',root_cause:'',action:'',verification:'',version:1}));
 let latest,fail=false;
 const approvals=cases.map((c,i)=>({...c,session_code:'KNT-'+i,product_name:'Parça '+i,revision:'v1',operator_name:'Ece',measured_at:c.created_at,status:i%2?'pending':'approved',reason:'Test gerekçesi',reviewer_name:'Deniz',reviewed_at:c.created_at}));
 const app=express();app.post('/api/approvals/admin-exemption',(_,res)=>res.json({resolved:0}));app.get('/api/bootstrap',(_,res)=>res.json({company:{id:'review',name:'Test',plan_id:'enterprise',subscription_status:'active',unlimited_pilot:true},currentUserId:'u',users:[{id:'u',name:'Deniz',email:'test@example.invalid',role:'admin',status:'active'}],products:[],controlPlans:[],inspectionLogs:[],usage:{}}));
 app.get('/api/work',(_,res)=>res.json({cases:[],tasks:[],approvals:[],notifications:[],summary:{open_cases:260,pending_approvals:0,overdue_tasks:0}}));
 app.get('/api/approvals/catalog',(req,res)=>{latest=req.query;if(fail)return res.status(503).json({error:'Geçici hata'});let items=approvals.filter(c=>(!latest.search||c.session_code===latest.search)&&(!latest.status||c.status===latest.status));items.sort((a,b)=>String(a[latest.sort]||'').localeCompare(String(b[latest.sort]||''))*(latest.direction==='desc'?-1:1));const size=Number(latest.pageSize),start=(Number(latest.page)-1)*size;res.json({items:items.slice(start,start+size),total:items.length,products:['PRODUCT-001'],revisions:['v1'],operators:['Ece']});});
 app.get('/api/*',(_,res)=>res.json([]));app.use(express.static('dist'));
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}),browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('qualitrack_access_token','review.'+btoa(JSON.stringify({tenantId:'review',userId:'u',exp:9999999999}))+'.fixture'));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#nav-tab-approvals').click();const list=page.locator('.rq-approval-catalog');await list.waitFor();
 const rows=()=>page.waitForFunction(()=>document.querySelectorAll('.rq-approval-catalog tbody tr').length===50);await rows();
 assert.equal(await list.locator('thead th').count(),11);
 for(let i=0;i<10;i++){await list.locator('thead th button').nth(i).click();await page.waitForTimeout(100);assert.equal(await list.locator('thead th').nth(i).getAttribute('aria-sort'),'ascending');await list.locator('thead th button').nth(i).click();await page.waitForTimeout(100);assert.equal(await list.locator('thead th').nth(i).getAttribute('aria-sort'),'descending');}
 await list.getByLabel('Sayfa başına kayıt',{exact:true}).selectOption('100');await page.waitForFunction(()=>document.querySelectorAll('.rq-approval-catalog tbody tr').length===100);
 await list.getByRole('button',{name:'Sonraki',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.rq-approval-catalog footer').innerText.includes('101–200'));
 await list.getByLabel('Ara',{exact:true}).fill('KNT-259');await page.waitForFunction(()=>document.querySelectorAll('.rq-approval-catalog tbody tr').length===1);assert.equal(latest.page,'1');
 await list.getByRole('button',{name:'Temizle',exact:true}).click();await list.getByLabel('Onay durumu',{exact:true}).selectOption('pending');await page.waitForFunction(()=>document.querySelector('.rq-approval-catalog footer').innerText.includes('/ 130 kayıt'));
 await list.getByLabel('Ürün',{exact:true}).selectOption('PRODUCT-001');await list.getByLabel('Revizyon',{exact:true}).selectOption('v1');await list.getByLabel('Operatör',{exact:true}).selectOption('Ece');await list.getByLabel('Ölçüm başlangıcı',{exact:true}).fill('2026-11-01');await list.getByLabel('Ölçüm bitişi',{exact:true}).fill('2026-11-02');await page.waitForTimeout(200);assert.equal(latest.product,'PRODUCT-001');assert.equal(latest.revision,'v1');assert.equal(latest.operator,'Ece');assert.ok(latest.from&&latest.to);
 await list.locator('tbody tr').first().getByRole('button',{name:'Onayla',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow at '+width);}
 fail=true;await list.getByRole('button',{name:'Yenile',exact:true}).click();await list.getByRole('alert').waitFor();fail=false;await list.getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.rq-approval-catalog [role=alert]'));
 assert.deepEqual(errors,[]);console.log('PASS: all approval sort headers, filters, paging, decision dialog, responsive layout and error recovery');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
