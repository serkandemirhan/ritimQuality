const {chromium,expect}=require('../website/node_modules/@playwright/test');
const {mkdirSync}=require('node:fs');
const phase=process.argv[2]||'after';
const out=process.env.REVIEW_OUTPUT||'reports/overview-redesign';mkdirSync(out,{recursive:true});
const now=Date.now();
const product={id:'p1',code:'BR-042',name:'Bağlantı plakası',images:[]};
const plan={id:'cp1',productId:'p1',version:'1',status:'active',isActive:true,characteristics:[]};
const logs=Array.from({length:12},(_,i)=>({id:'log'+i,productId:'p1',productName:product.name,productCode:product.code,controlPlanId:'cp1',controlPlanVersion:'1',sessionCode:'KNT-'+(1042-i),timestamp:new Date(now-i*86400000-3600000).toISOString(),overallStatus:i===3?'fail':'pass',operatorName:'Deniz Yılmaz',machineNo:'CNC-01',sampleCount:1,totalPointsChecked:1,failedPointsCount:i===3?1:0,samples:[]}));
(async()=>{const browser=await chromium.launch({channel:'msedge'});try{
 for(const scenario of ['empty','active','inactive','error'])for(const width of (process.env.REVIEW_WIDTHS||'390,1440').split(',').map(Number)){
 const page=await browser.newPage({viewport:{width,height:width<=760?844:1000},deviceScaleFactor:1});
 let workRecovered=false,recordLimit=12,allWork=false;
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const token='review.'+Buffer.from(JSON.stringify({tenantId:'review',userId:'review-user',exp:Math.floor(now/1000)+3600})).toString('base64url')+'.preview';
 await page.addInitScript(token=>localStorage.setItem('qualitrack_access_token',token),token);
 await page.route('**/api/**',route=>{
 const path=new URL(route.request().url()).pathname;
 let json=[];
 if(path.endsWith('/bootstrap'))json={company:{id:'review',name:'Örnek İmalat',plan_id:'enterprise',subscription_status:'active'},currentUserId:'review-user',users:[{id:'review-user',name:'Deniz Yılmaz',role:'admin',status:'active',email:'review@example.invalid'}],products:scenario==='empty'?[]:[product],controlPlans:scenario==='empty'?[]:[plan],inspectionLogs:scenario==='empty'?[]:scenario==='inactive'?logs.map(l=>({...l,timestamp:new Date(now-90*86400000).toISOString()})):logs.slice(0,recordLimit),usage:{users:1,control_plans:1,monthly_measurements:12}};
 if(path.endsWith('/work')){if(scenario==='error'&&!workRecovered)return route.fulfill({status:503,json:{error:'Fixture unavailable'}});json={tasks:[],cases:[],approvals:[],notifications:[],summary:{open_cases:scenario==='active'?2:0,overdue_tasks:scenario==='active'?1:0,pending_approvals:allWork?1:0}};}
 if(path.endsWith('/capabilities'))json={accountEmail:false};
 if(path.endsWith('/organization'))json={plants:[],departments:[],stations:[]};
 if(path.endsWith('/inspection-rules'))json={requireActivePlan:false,requireLotNumber:false,requireOrderNumber:false};
 return route.fulfill({json});
 });
 await page.goto('http://127.0.0.1:3410');await expect(page.locator('.rq-overview')).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 if(phase==='after'){
 await expect(page.locator('.rq-overview')).not.toContainText('Veri bekleniyor');
 if(scenario==='empty'){await expect(page.getByRole('heading',{name:'İlk kontrolünüzü hazırlayalım.'})).toBeVisible();await expect(page.locator('.rq-overview-summary')).toHaveCount(0);}
 if(scenario==='inactive')await expect(page.getByText('Bu dönemde kontrol kaydı yok.',{exact:true})).toBeVisible();
 if(scenario==='error')await expect(page.getByRole('button',{name:'Yeniden dene',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
 }
 await page.screenshot({path:`${out}/${phase}-${scenario}-${width}.png`,fullPage:true});
 await page.screenshot({path:`${out}/${phase}-${scenario}-${width}-viewport.png`});
 if(phase==='after'){
   if(scenario==='empty'){await expect(page.locator('.ov-start-guide li').last()).toContainText('Ölçüm ve rapor');await page.getByRole('button',{name:'İlk parçayı ekle',exact:true}).click();await expect(page.getByRole('heading',{name:'Parçalar',exact:true})).toBeVisible();}
   if(scenario==='inactive'){await expect(page.locator('.ov-start')).toHaveCount(0);await expect(page.locator('.ov-trend')).toHaveCount(0);}
   if(scenario==='active'){
     await expect(page.locator('.ov-record:visible')).toHaveCount(width<=760?3:5);
     await expect(page.locator('.ov-summary')).toContainText('11 uygun / 12 kontrol');
     await expect(page.locator('.ov-record').first()).toContainText('KNT-1042');
     if(width<=760){const bottom=await page.locator('.quality-bottom-nav').boundingBox();const last=await page.locator('.ov-priority-list>button').last().boundingBox();expect(last.y+last.height).toBeLessThanOrEqual(bottom.y);await expect(page.locator('.rq-desktop-topbar')).toBeHidden();}
     await page.locator('.ov-rate-info summary').click();await expect(page.locator('.ov-rate-info')).toContainText('hem paydaki uygun sayısına hem paydadaki');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.ov-rate-info summary').click();
     await page.getByRole('button',{name:'7 gün',exact:true}).click();await expect(page.locator('.ov-heading')).toContainText('7 kontrol');await expect(page.locator('.ov-priority-list')).toContainText('Açık uygunsuzluk');
     await page.getByRole('button',{name:'90 gün',exact:true}).click();await expect(page.locator('.ov-heading')).toContainText('12 kontrol');await page.getByRole('button',{name:'30 gün',exact:true}).click();
     await page.locator('.ov-daily-data summary').click();await expect(page.locator('.ov-daily-data table')).toBeVisible();
     await page.locator('.ov-details summary').click();await expect(page.locator('.ov-breakdowns')).toBeVisible();
     await page.getByRole('button',{name:'Raporu aç',exact:true}).click();await expect(page.getByRole('dialog',{name:'Kalite kontrol raporu'})).toBeVisible();await expect(page.getByRole('button',{name:'Yazdır / PDF Kaydet'})).toBeVisible();
     await page.locator('.rq-report-modal > header button').click();
     recordLimit=1;allWork=true;await page.reload();
     await expect(page.getByRole('heading',{name:'İlk kontrol raporunuz hazır.'})).toBeVisible();await expect(page.locator('.ov-priority-list>button')).toHaveCount(3);
     if(width<=760){const bottom=await page.locator('.quality-bottom-nav').boundingBox();const last=await page.locator('.ov-priority-list>button').last().boundingBox();expect(last.y+last.height).toBeLessThanOrEqual(bottom.y);}
     await page.getByRole('button',{name:'İlk raporumu aç',exact:true}).click();await expect(page.getByRole('dialog',{name:'Kalite kontrol raporu'})).toBeVisible();await page.locator('.rq-report-modal > header button').click();
     const profile=page.locator('.rq-account-menu:visible');await profile.locator('summary').click();await expect(profile).toContainText('Deniz Yılmaz');await expect(profile).toContainText('Yönetici');await profile.locator('summary').press('Escape');await expect(profile).not.toHaveAttribute('open','');
     await page.getByRole('button',{name:'Bildirimler',exact:true}).filter({visible:true}).click();await expect(page.getByRole('dialog',{name:'Bildirimler'})).toBeVisible();
   }
   if(scenario==='error'){workRecovered=true;await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await expect(page.locator('.ov-work-error')).toHaveCount(0);await expect(page.locator('.ov-quiet')).toContainText('Bekleyen aksiyon yok');}
 }
 await page.close();
 }console.log('PASS: overview captures '+phase+'; four scenarios at mobile/desktop sizes.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
