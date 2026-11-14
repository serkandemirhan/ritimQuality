import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

for(const scenario of [{width:1440,height:1000,recovery:false},{width:390,height:844,recovery:false},{width:390,height:844,recovery:true}]){
 const {recovery,...viewport}=scenario;
 test(`${recovery?'failure recovery':'new free customer'} to downloaded PDF ${viewport.width}`,async({page,browserName},testInfo)=>{
  await page.setViewportSize(viewport);
  const fontPattern=/LiberationSans.*\.ttf(?:\?.*)?$/;
  const marks:Record<string,number>={};let t0=0;const mark=(name:string)=>marks[name]=Math.round(performance.now()-t0);
  let token='',tenantId='',inspectionId='',controlNumber='',completed=false;
  const boot=async()=>{const r=await page.request.get('/api/bootstrap',{headers:{Authorization:'Bearer '+token}});expect(r.ok()).toBe(true);return r.json();};
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.type()==='confirm'?d.accept():d.dismiss());
  try{
   t0=performance.now();mark('T0');
   await page.goto(process.env.ACCEPTANCE_ENTRY||'/?auth=register');
   if(process.env.ACCEPTANCE_ENTRY)await page.getByRole('link',{name:'Ücretsiz hesap oluştur',exact:true}).click();
   await expect(page.getByLabel('Firma adı',{exact:true})).toBeVisible();mark('T1');
   const workspace='new-'+randomUUID().slice(0,8);
   for(const [label,value]of [['Firma adı','Acceptance Atölye'],['Ad soyad','Yeni Müşteri'],['Çalışma alanı',workspace],['E-posta adresi',workspace+'@example.invalid'],['Şifre',randomUUID()+'Aa1!']])await page.getByLabel(label,{exact:true}).fill(value);
   const registration=page.waitForResponse(r=>r.url().endsWith('/api/auth/register')&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Ücretsiz hesap oluştur',exact:true}).click();
   const response=await registration;expect(response.status()).toBe(201);mark('T2');
   const registered=await response.json();token=registered.token;tenantId=registered.tenant.id;
   const initial=await boot();expect(initial.company.plan_id).toBe('free');expect(initial.company.subscription_status).toBe('active');expect(initial.company.trial_ends_at).toBeNull();expect(initial.company.unlimited_pilot).toBe(false);
   for(const field of ['products','controlPlans','inspectionLogs'])expect(initial[field]).toHaveLength(0);
   await page.getByRole('button',{name:'İlk parçayı ekle',exact:true}).click();mark('T3');
   await page.locator('#btn-add-new-product').click();
   await page.getByLabel('Parça kodu *',{exact:true}).fill('ACCEPTANCE-001');await page.getByLabel('Parça adı *',{exact:true}).fill('Kontrol plakası');
   await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('./drawing.png',import.meta.url)));
   await expect(page.getByRole('button',{name:'Parçayı kaydet',exact:true})).toBeEnabled();
   await page.getByRole('button',{name:'Parçayı kaydet',exact:true}).click();
   await expect(page.getByRole('button',{name:'İlk kontrol planını oluştur',exact:true})).toBeVisible();mark('T4');
   expect((await boot()).controlPlans).toHaveLength(0);
   await page.getByRole('button',{name:'İlk kontrol planını oluştur',exact:true}).click();
   await expect(page.locator('#btn-save-control-plan')).toBeEnabled();
   expect((await boot()).controlPlans[0].characteristics).toHaveLength(0);
   await expect(page.getByRole('button',{name:'Yayınla ve ölçüme geç',exact:true})).toBeDisabled();
   for(const [index,[name,nominal,tolerance]]of [['Gövde boyu','100','0.1'],['Kanal genişliği','50','0.1'],['Delik çapı','10','0.05']].entries()){
    await page.locator('#btn-add-characteristic').click();if(viewport.width<768)await page.getByRole('button',{name:'Ölçü ve tolerans',exact:true}).click();await page.getByLabel('Karakteristik adı',{exact:true}).fill(name);
    await page.getByLabel('Nominal',{exact:true}).fill(nominal);await page.getByLabel('Alt tolerans',{exact:true}).fill('-'+tolerance);await page.getByLabel('Üst tolerans',{exact:true}).fill(tolerance);
    if(viewport.width<768)await page.getByRole('button',{name:'Teknik resim',exact:true}).click();
    const stage=page.locator('img[alt="Anotasyon yapılan teknik görsel"]').locator('..');const pin=stage.getByRole('button',{name:'Nokta '+(index+1),exact:true});await pin.scrollIntoViewIfNeeded();const box=(await stage.boundingBox())!;const [x,y]=[[45,18],[12,45],[65,43]][index];await pin.hover();await page.mouse.down();await page.mouse.move(box.x+box.width*x/100,box.y+box.height*y/100,{steps:8});await page.mouse.up();

   }
   // Publication saves current edits and publishes atomically; no separate save/reselect.
   const publication=page.waitForResponse(r=>/\/api\/control-plans\//.test(r.url())&&r.request().method()==='PUT');
   await page.getByRole('button',{name:'Yayınla ve ölçüme geç',exact:true}).click();expect((await publication).ok()).toBe(true);mark('T5');
   await expect(page.locator('#btn-start-inspection')).toBeEnabled();mark('T6');
   const planned=await boot(),plan=planned.controlPlans[0];expect(plan.isActive).toBe(true);expect(plan.status).toBe('active');expect(plan.characteristics.map((c:any)=>c.name)).toEqual(['Gövde boyu','Kanal genişliği','Delik çapı']);expect(plan.characteristics.map((c:any)=>c.lsl)).toEqual([99.9,49.9,9.95]);
   await page.getByLabel('Parti numarası',{exact:true}).fill('LOT-ACCEPTANCE');await page.locator('#btn-start-inspection').click();
   if(viewport.width<768){
    await expect(page.locator('.mm-shell')).toBeVisible();mark('T7');
    for(const [i,value]of ['100,02','49,98','10,01'].entries()){
     await expect(page.locator('.mm-keypad')).toBeVisible();
     for(const key of value)await page.locator('.mm-keypad').getByRole('button',{name:key,exact:true}).click();
     await page.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();
     if(i<2)await expect(page.locator('.mm-shell')).toContainText(['Kanal genişliği','Delik çapı'][i]);
    }
   }else{
    await expect(page.getByLabel('Ölçülen değer',{exact:true})).toBeVisible();mark('T7');
    for(const [i,value]of ['100,02','49,98','10,01'].entries()){
     await page.getByLabel('Ölçülen değer',{exact:true}).fill(value);
     if(i<2)await page.getByLabel('Ölçülen değer',{exact:true}).press('Enter');
    }
   }
   if(recovery){
    await page.route('**/api/inspection-logs',route=>route.fulfill({status:503,json:{error:'Kabul testi: kayıt bağlantısı kesildi'}}));
    await page.route(fontPattern,route=>route.request().resourceType()==='fetch'?route.fulfill({status:503,body:'font unavailable'}):route.continue());
   }
   let savedResponse=recovery?undefined:page.waitForResponse(r=>r.url().endsWith('/api/inspection-logs')&&r.request().method()==='POST'&&r.ok());
   if(viewport.width<768)await page.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}).click();
   else await page.locator('#btn-save-inspection-log').click();
   if(recovery){
    const local=page.getByRole('dialog',{name:'Kalite kontrol raporu'});await expect(local.getByText('Yerel rapor',{exact:true})).toBeVisible();expect((await boot()).inspectionLogs).toHaveLength(0);
    await expect(local.getByRole('alert')).toContainText('PDF hazırlanamadı');await expect(local.getByRole('button',{name:'PDF indir',exact:true})).toBeDisabled();
    await page.unroute(fontPattern);await local.getByRole('button',{name:'PDF hazırlamayı tekrar dene',exact:true}).click();await expect(local.getByRole('button',{name:'PDF indir',exact:true})).toBeEnabled();
    const pendingEvent=page.waitForEvent('download');await local.getByRole('button',{name:'PDF indir',exact:true}).click();const pending=await pendingEvent;const pendingPath=testInfo.outputPath('pending-report.pdf');await pending.saveAs(pendingPath);
    const parser=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=parser.getDocument({data:new Uint8Array(await readFile(pendingPath)),useSystemFonts:true});const document=await loading.promise;const first=await document.getPage(1);expect((await first.getTextContent()).items.map((i:any)=>i.str||'').join(' ')).toContain('YEREL RAPOR');await loading.destroy();
    savedResponse=page.waitForResponse(r=>r.url().endsWith('/api/inspection-logs')&&r.request().method()==='POST'&&r.ok());
    await page.unroute('**/api/inspection-logs');await page.evaluate(()=>window.dispatchEvent(new Event('online')));
   }
   const saved=await(await savedResponse).json();inspectionId=saved.id;controlNumber=saved.controlNumber;mark('T8');
   if(viewport.width>=768)await page.locator('#btn-print-certificate').click();
   const report=page.getByRole('dialog',{name:'Kalite kontrol raporu'});await expect(report).toBeVisible();
   await expect(report.getByText('Yerel rapor',{exact:true})).toHaveCount(0);
   await expect(report.getByRole('button',{name:'PDF indir',exact:true})).toBeEnabled();mark('T9');
   const downloadEvent=page.waitForEvent('download');await report.getByRole('button',{name:'PDF indir',exact:true}).click();
   const download=await downloadEvent,pdfPath=testInfo.outputPath('first-report.pdf');await download.saveAs(pdfPath);expect(await download.failure()).toBeNull();mark('T10');
   // Assertions after T10 do not inflate the user task time, but all must pass.
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
   const task=pdfjs.getDocument({data:new Uint8Array(await readFile(pdfPath)),useSystemFonts:true});const pdf=await task.promise;let text='';let embeddedImage=false;
   for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);text+=(await p.getTextContent()).items.map((i:any)=>i.str||'').join(' ');const operators=await p.getOperatorList();embeddedImage ||= operators.fnArray.some((op:number)=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject].includes(op));}
   for(const term of ['ACCEPTANCE-001',controlNumber,'Gövde boyu','Kanal genişliği','Delik çapı','100,02','49,98','10,01','99,9 mm','100,1 mm','49,9 mm','50,1 mm','9,95 mm','10,05 mm'])expect(text).toContain(term);
   expect(embeddedImage).toBe(true);expect(text).not.toContain('YEREL RAPOR');await task.destroy();
   await page.screenshot({path:testInfo.outputPath('report.png'),fullPage:true});
   await page.reload();const persisted=await boot();expect(persisted.inspectionLogs).toHaveLength(1);const log=persisted.inspectionLogs[0];expect(log.id).toBe(inspectionId);expect(log.overallStatus).toBe('pass');expect(log.totalPointsChecked).toBe(3);expect(log.sampleCount).toBe(1);expect(plan.characteristics.map((c:any)=>log.samples[0].values[c.id])).toEqual([100.02,49.98,10.01]);expect(errors).toEqual([]);
   if(!recovery)expect(marks.T10).toBeLessThanOrEqual(300000);completed=true;
  }finally{
   let commit='unknown';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
   const result={commit,workingTree:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()? 'modified':'clean',environment:'disposable loopback PostgreSQL; real API; no mocks or seed',scope:process.env.ACCEPTANCE_ENTRY?'registration entry to application PDF':'application registration to PDF',browserName,viewport,failureInjection:recovery,network:'local unthrottled',package:'free',tenantId,inspectionId,controlNumber,marks,totalMs:marks.T10??null,elapsedMs:Math.round(performance.now()-t0),status:completed?'passed':'failed',expectedStatus:testInfo.expectedStatus,humanFiveMinuteGoal:'not measured'};
   await writeFile(testInfo.outputPath('timing.json'),JSON.stringify(result,null,2));
  }
 });
}
