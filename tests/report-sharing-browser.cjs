// Local fixture only. Native sharing is stubbed: no message is sent to anyone.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const origin='http://127.0.0.1:3350',out=path.resolve('.runtime/report-sharing');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const base=await(await fetch(origin+'/api/bootstrap')).json();assert.equal(base.company.id,'review');
 const plan=base.controlPlans[0],log=base.inspectionLogs.find(l=>l.controlPlanId===plan.id);
 log.controlPlanSnapshot=plan;log.requiresReview=true;log.approval={status:'pending'};log.clientSyncStatus='pending';log.samples[0].pointNotes={[plan.characteristics[0].id]:'Türkçe not: ölçüm şüpheli, gözden geçirilsin.'};
 base.inspectionLogs=[log];base.company.unlimited_pilot=true;
 const browser=await chromium.launch();const checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(20000);
  await page.addInitScript(()=>{
   localStorage.setItem('qualitrack_access_token','review.'+btoa(JSON.stringify({tenantId:'review',userId:'review-user',exp:9999999999}))+'.preview');
   window.__shareMode='success';window.__shareCalls=[];
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>window.__shareMode!=='unsupported'});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shareCalls.push({name:data.files[0].name,type:data.files[0].type,size:data.files[0].size,active:navigator.userActivation.isActive});window.__sharedFile=data.files[0];if(window.__shareMode==='cancel')throw new DOMException('Cancelled','AbortError');if(window.__shareMode==='error')throw new DOMException('Failed','DataError');}});
  });
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/bootstrap',r=>r.fulfill({json:base}));
  await page.goto(origin+'/?view=logs');await page.getByRole('button',{name:'Kalite raporu yazdır',exact:true}).first().click();
  const downloadButton=page.getByRole('button',{name:'PDF indir',exact:true}),shareButton=page.getByRole('button',{name:'Paylaş',exact:true});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF indir'&&!b.disabled),{},{timeout:60000});
  const downloaded=page.waitForEvent('download');await downloadButton.click();const pdf=await downloaded;assert.ok(pdf.suggestedFilename().endsWith('.pdf'));await pdf.saveAs(path.join(out,'example-report.pdf'));
  await shareButton.click();await page.getByText('PDF cihazın paylaşım menüsüne aktarıldı.',{exact:true}).waitFor();const calls=await page.evaluate(()=>window.__shareCalls);assert.equal(calls.length,1);assert.equal(calls[0].type,'application/pdf');assert.ok(calls[0].size>1000);assert.equal(calls[0].active,true);checks.push('Real PDF download; native file share starts within user activation');
  const extracted=await page.evaluate(async()=>{
   const pdfjs=await import('/node_modules/pdfjs-dist/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/node_modules/pdfjs-dist/build/pdf.worker.mjs';
   const doc=await pdfjs.getDocument({data:new Uint8Array(await window.__sharedFile.arrayBuffer())}).promise;let text='',images=0;
   for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n);text+=(await p.getTextContent()).items.map(i=>i.str||'').join(' ')+'\n';const operators=await p.getOperatorList();images+=operators.fnArray.filter(fn=>fn===pdfjs.OPS.paintImageXObject).length;}
   return {pages:doc.numPages,text,images};
  });
  assert.match(extracted.text,/Onay bekliyor/);assert.match(extracted.text,/YEREL RAPOR/);assert.match(extracted.text,/Türkçe not/);assert.match(extracted.text,/Teknik resim/);assert.ok(extracted.images>0);assert.ok(extracted.pages>1);checks.push('Searchable Turkish PDF, approval state, unsynced notice, point note, paginated table and embedded drawing');
  await page.evaluate(()=>window.__shareMode='cancel');await shareButton.click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [aria-busy=true]'));assert.equal(await page.getByText('Paylaşım açılamadı.',{exact:false}).count(),0);checks.push('Share cancellation stays in report without false delivery');
  await page.evaluate(()=>window.__shareMode='error');await shareButton.click();await page.getByText('Paylaşım açılamadı. PDF indir düğmesiyle dosyayı kaydedip gönderebilirsiniz.',{exact:true}).waitFor();checks.push('Native share failure provides download recovery');
  await page.evaluate(()=>window.__shareMode='unsupported');const fallback=page.waitForEvent('download');await shareButton.click();await fallback;checks.push('Unsupported file sharing falls back to PDF download');
  await page.getByRole('button',{name:'Detaylı',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF indir'&&!b.disabled));
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);await page.screenshot({path:path.join(out,'report-mobile.png')});checks.push('Detailed export refreshes safely and 390px report fits');
  await page.getByRole('button',{name:'Kapat',exact:true}).click();await page.setViewportSize({width:1440,height:1000});await page.locator('.rq-sidebar button').filter({hasText:'Abonelik'}).click();
  await page.getByText('Sınırsız Deneme Hesabı',{exact:true}).waitFor();assert.equal(await page.getByRole('progressbar').count(),0);assert.equal(await page.getByRole('heading',{name:'Abonelik planları',exact:true}).count(),0);assert.equal(await page.getByText('Süre sınırı yok',{exact:true}).count(),1);await page.screenshot({path:path.join(out,'unlimited-pilot.png')});checks.push('Server-provided pilot entitlement displays unlimited usage, no expiry and no purchase prompts');
  {
   const retry=await browser.newPage();let blockFonts=true;const retryErrors=[];retry.on('pageerror',e=>retryErrors.push(e.message));
   await retry.addInitScript(()=>localStorage.setItem('qualitrack_access_token','review.'+btoa(JSON.stringify({tenantId:'review',userId:'review-user',exp:9999999999}))+'.preview'));
   await retry.route('**/api/bootstrap',r=>r.fulfill({json:base}));
   await retry.route('**/*.ttf*',r=>blockFonts?r.fulfill({status:503,body:''}):r.continue());
   await retry.goto(origin+'/?view=logs');await retry.getByRole('button',{name:'Kalite raporu yazdır',exact:true}).first().click();
   await retry.getByRole('button',{name:'PDF hazırlamayı tekrar dene',exact:true}).waitFor({timeout:60000});assert.equal(await retry.getByRole('button',{name:'PDF indir',exact:true}).isDisabled(),true);
   blockFonts=false;await retry.getByRole('button',{name:'PDF hazırlamayı tekrar dene',exact:true}).click();
   await retry.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF indir'&&!b.disabled),{},{timeout:60000});assert.deepEqual(retryErrors,[]);await retry.close();checks.push('PDF asset failure disables export and successful retry recovers');
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,errors,pdf:{pages:extracted.pages,images:extracted.images,text:extracted.text}},null,2));console.log('PASS: '+checks.length+' report sharing and pilot UI scenarios.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
