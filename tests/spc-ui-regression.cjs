// Run against tests/desktop-review-server.mjs (in-memory fixture). Requires Playwright.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin='http://127.0.0.1:3350',out=path.resolve('.runtime/spc-fixes');
const token='review.'+Buffer.from(JSON.stringify({tenantId:'review',userId:'review-user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.preview';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const base=await(await fetch(origin+'/api/bootstrap')).json();assert.equal(base.company.id,'review','Use the local in-memory review server.');
 const browser=await chromium.launch(),checks=[],errors=[];
 try{
  async function open(data){const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(t=>localStorage.setItem('qualitrack_access_token',t),token);const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/bootstrap',r=>r.fulfill({json:data}));await page.route('**/api/products/*',r=>r.request().method()==='PUT'?r.fulfill({json:r.request().postDataJSON()}):r.continue());await page.goto(origin);await page.locator('.rq-sidebar').waitFor();return {context,page};}
  const ch={...base.controlPlans[0].characteristics[0],id:'shared',nominal:10,lsl:9,usl:11};
  const plan={...base.controlPlans[0],id:'audit-plan',productId:base.products[0].id,version:'v1.0',isActive:true,characteristics:[ch]};
  const old={...plan,id:'audit-old',version:'v0.9',isActive:false,status:'archived'};
  const record=(id,values,p=plan,lot='LOT-A',statuses)=>({...base.inspectionLogs[0],id,productId:p.productId,controlPlanId:p.id,controlPlanVersion:p.version,controlPlanSnapshot:p,lotNumber:lot,samples:values.map((v,i)=>({sampleIndex:i+1,values:{shared:v},statuses:{shared:statuses?.[i]||'pass'}}))});
  const data=(plans,logs)=>({...base,products:base.products.slice(0,1),controlPlans:plans,inspectionLogs:logs});
  async function spc(page){await page.locator('.rq-sidebar button').filter({hasText:'SPC Analizi'}).click();await page.locator('.rq-spc-workspace').waitFor();}
  const sampleCard=p=>p.locator('.rq-metric').filter({has:p.getByRole('heading',{name:'Numune sayısı',exact:true})});
  {
   const {context,page}=await open(data([plan,old],[record('new',[9.9,10.1]),record('old',[19.9,20.1],old,'LOT-OLD'),record('other',[100,101],{...plan,productId:'foreign'},'FOREIGN')]));await spc(page);
   assert.equal(await sampleCard(page).locator('.rq-kpi-value').innerText(),'2');assert.equal(await page.locator('.rq-metric').nth(2).locator('.rq-kpi-value').innerText(),'10');
   assert.equal(await page.locator('.rq-spc-filters select').nth(3).locator('option[value="LOT-OLD"]').count(),0);
   await page.locator('.rq-spc-filters select').nth(3).selectOption('LOT-A');await page.locator('.rq-spc-filters select').nth(1).selectOption('audit-old');
   assert.equal(await page.locator('.rq-spc-filters select').nth(3).inputValue(),'all');assert.equal(await page.locator('.rq-metric').nth(2).locator('.rq-kpi-value').innerText(),'20');
   await page.locator('.rq-spc-filters select').nth(1).selectOption('audit-plan');assert.equal(await page.locator('tbody tr').first().locator('td').nth(2).innerText(),'2');
   await page.screenshot({path:path.join(out,'revision-scope.png')});checks.push('Product/plan/revision isolation, summary agreement and filter reset');await context.close();
  }
  {
   const {context,page}=await open(data([plan],[record('empty',[0,9.9,10.1],plan,'LOT-A',['empty','pass','pass'])]));await spc(page);assert.equal(await sampleCard(page).locator('.rq-kpi-value').innerText(),'2');checks.push('Empty placeholder excluded from displayed sample count');await context.close();
  }
  {
   const {context,page}=await open(data([plan],[record('single-a',[9.9]),record('single-b',[10.1])]));await spc(page);assert.equal(await page.getByRole('heading',{name:'X̄-R Alt Grup Analizi',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'I-MR Bireysel Analiz',exact:true}).count(),1);assert.match(await page.locator('.rq-spc-workspace').innerText(),/Tek numuneli/);checks.push('Single-sample sessions show I-MR with explicit Xbar-R explanation');await context.close();
  }
  {
   const {context,page}=await open(data([plan],[record('constant',[10,10,10])]));await spc(page);assert.equal(await sampleCard(page).locator('.rq-kpi-value').innerText(),'3');assert.equal(await page.locator('.rq-metric').first().locator('.rq-kpi-value').innerText(),'—');assert.match(await page.locator('.rq-spc-workspace').innerText(),/yayılımı sıfır/);assert.equal(await page.getByText('Analiz için yeterli ölçüm bulunamadı',{exact:true}).count(),0);await page.screenshot({path:path.join(out,'constant-data.png')});checks.push('Constant measurements remain visible with undefined capability');await context.close();
  }
  {
   const small={...plan,characteristics:[{...ch,nominal:.0005,lsl:0,usl:.001,precision:6}]};const {context,page}=await open(data([small],[record('small',[.000501,.000502],small)]));await spc(page);const sd=await page.locator('.rq-metric').nth(3).locator('.rq-kpi-value').innerText();assert.notEqual(sd,'0');assert.match(await page.locator('.rq-metric').nth(2).locator('.rq-kpi-value').innerText(),/0005015/);
   for(const width of [1440,768,390,375]){await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,{},{timeout:5000}).catch(async e=>{console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('main *')].filter(x=>x.getBoundingClientRect().right>innerWidth+5).slice(0,8).map(x=>({cls:x.getAttribute('class'),text:x.textContent.slice(0,90),right:x.getBoundingClientRect().right}))})));await page.screenshot({path:path.join(out,'responsive-failure.png')});throw e;});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+width);}await page.locator('.rq-metrics-row').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'small-measurements-mobile.png')});checks.push('Small measurement precision retained; four viewport widths fit');await context.close();
  }
  {
   const {context,page}=await open(base);await page.locator('.rq-sidebar button').filter({hasText:'Parçalar'}).click();const add=page.getByRole('button',{name:'Yeni parça ekle',exact:true});let prompts=0,accept=false;page.on('dialog',async d=>{prompts++;await (accept?d.accept():d.dismiss());});
   await add.click();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(prompts,0,'Clean form must close without confirmation');
   await add.click();await page.getByLabel('Parça kodu *',{exact:true}).fill('UNSAVED-REVIEW');await page.keyboard.press('Escape');assert.equal(prompts,1);assert.equal(await page.locator('dialog[open]').count(),1);assert.equal(await page.getByLabel('Parça kodu *',{exact:true}).inputValue(),'UNSAVED-REVIEW');
   await page.getByRole('button',{name:'Kapat',exact:true}).click();assert.equal(prompts,2);assert.equal(await page.locator('dialog[open]').count(),1);
   await page.getByRole('button',{name:'İptal',exact:true}).click();assert.equal(prompts,3);assert.equal(await page.locator('dialog[open]').count(),1);
   const before=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});assert.equal(before,true);
   await page.evaluate(()=>{window.dispatchEvent(new CustomEvent('ritim-measurement-navigate',{cancelable:true}));});assert.equal(prompts,4);
   await page.screenshot({path:path.join(out,'unsaved-form.png')});accept=true;await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
   await page.locator('main button').filter({hasText:base.products[0].name}).first().click();await page.getByRole('button',{name:'Düzenle',exact:true}).click();await page.keyboard.press('Escape');assert.equal(prompts,5,'Unchanged edit must not prompt');
   await page.getByRole('button',{name:'Düzenle',exact:true}).click();await page.getByLabel('Parça adı *',{exact:true}).fill('Reviewed local fixture');const saved=page.waitForResponse(r=>r.url().includes('/api/products/')&&r.request().method()==='PUT'&&r.status()===200);await page.getByRole('button',{name:'Güncelle',exact:true}).click();await saved;await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(prompts,5,'Successful save must not ask to discard');
   checks.push('Clean close; Escape/close/cancel/navigation/reload protection; retained fields; confirmed discard; normal save');await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));console.log('PASS: '+checks.length+' UI regression scenarios; zero JavaScript errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
