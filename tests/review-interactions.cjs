const {chromium,expect}=require('../website/node_modules/@playwright/test');
const fs=require('fs');const s=JSON.parse(fs.readFileSync('.runtime/lifecycle/session.json'));const f=JSON.parse(fs.readFileSync('.runtime/lifecycle/regression.json'));const out='reports/control-lifecycle-review';
const checks=[];
(async()=>{const b=await chromium.launch({channel:'msedge'});try{
for(const width of [1440,390]){
 const c=await b.newContext({viewport:{width,height:width===390?844:1000},hasTouch:width===390});await c.addInitScript(t=>localStorage.setItem('qualitrack_access_token',t),s.users.find(u=>u.role==='admin').token);const p=await c.newPage();await p.goto('http://127.0.0.1:3420/?view=work');await p.getByText('Yeni görev ata',{exact:true}).click();
 await expect(p.locator('[name=inspectionId]')).toHaveCount(0);await expect(p.locator('[name=caseId]')).toHaveCount(0);await p.getByLabel('Görev türü').selectOption('corrective');await expect(p.locator('[name=inspectionId]')).toBeVisible();await expect(p.locator('[name=caseId]')).toBeVisible();await p.screenshot({path:`${out}/14-duzeltici-gorev-${width}.png`});
 await p.getByLabel('Görev türü').selectOption('inspection');await expect(p.locator('[name=inspectionId]')).toHaveCount(0);checks.push({width,check:'Görev türüne göre kaynak alanları gösteriliyor.'});
 await p.locator('body').click({position:{x:5,y:5}});expect(await p.locator('.rq-skip-link').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(0);checks.push({width,check:'Dokunma / fare kullanımında içeriğe geç bağlantısı ekran dışında.'});
 let fail=true;await p.route('**/api/media/*',route=>fail?route.fulfill({status:503,body:'Controlled test failure'}):route.continue());
 await p.goto('http://127.0.0.1:3420/?product='+encodeURIComponent(f.plan.productId));await p.locator('#btn-start-inspection').waitFor({timeout:45000});
 // The supported product deep link selects the fixture before rendering preparation.
 await expect(p.locator('.rq-preparation-summary').getByRole('button',{name:'Tekrar dene',exact:true})).toBeVisible({timeout:45000});await p.locator('.rq-preparation-summary').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/15-cizim-hatasi-${width}.png`});fail=false;await p.locator('.rq-preparation-summary').getByRole('button',{name:'Tekrar dene',exact:true}).click();await expect.poll(()=>p.locator('.rq-preparation-summary img').evaluateAll(imgs=>imgs.some(i=>i.naturalWidth>0)),{timeout:45000}).toBe(true);await p.screenshot({path:`${out}/16-cizim-tekrar-${width}.png`});checks.push({width,check:'503 dosya hatası açık zeminle gösterildi; tekrar dene gerçek depolamadan çizimi yükledi.'});await c.close();
}
fs.writeFileSync(out+'/interaction-verification.json',JSON.stringify(checks,null,2));console.log('PASS: task types, pointer skip link and failed image retry at both widths.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
