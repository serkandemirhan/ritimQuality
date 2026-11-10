// Run from the repository root. API responses are fixtures; no production data is changed.
const {chromium,expect}=require('@playwright/test');
const {mkdirSync,writeFileSync}=require('node:fs');
const {join}=require('node:path');
const out=process.env.REVIEW_OUTPUT||'reports/overview-validation';mkdirSync(out,{recursive:true});
const now=Date.parse('2026-11-08T12:00:00Z');
const baseURL=process.env.REVIEW_URL||'http://127.0.0.1:3410';
const widths=(process.env.REVIEW_WIDTHS||'390,1440').split(',').map(Number);
const evidence=[];
const product={id:'p1',code:'BR-042',name:'Bağlantı plakası',images:[]};
const characteristic={id:'c1',pointNo:1,name:'Uzunluk',nominal:100,tolUpper:.1,tolLower:-.1,usl:100.1,lsl:99.9,unit:'mm',tool:'Dijital Kumpas 0.01',sampleSize:'1',frequency:'Örnek',criticalClass:'minor',pin:{x:50,y:50}};
const plan={id:'cp1',productId:'p1',version:'1',status:'active',isActive:true,characteristics:[characteristic]};
const records=Array.from({length:12},(_,i)=>({id:'log'+i,productId:'p1',productName:product.name,productCode:product.code,controlPlanId:'cp1',controlPlanVersion:'1',sessionCode:'KNT-'+(1042-i),timestamp:new Date(now-i*86400000-3600000).toISOString(),overallStatus:i===3?'fail':'pass',operatorName:'Deniz Yılmaz',machineNo:'CNC-01',lotNumber:'LOT-'+(42-i),orderNumber:'IE-210',sampleCount:1,totalPointsChecked:1,failedPointsCount:i===3?1:0,warningPointsCount:0,samples:[{sampleIndex:1,values:{c1:i===3?100.2:100.02},statuses:{c1:i===3?'fail':'pass'}}]}));
(async()=>{const browser=await chromium.launch({channel:'msedge'});try{
 for(const width of widths)for(const scenario of ['empty','active','inactive','error']){
  const page=await browser.newPage({viewport:{width,height:width<=760?844:1000},deviceScaleFactor:1});
  await page.clock.setFixedTime(new Date(now));
  let limit=12,allWork=false,recovered=false,warning=false,gapped=false;
  const errors=[],mutations=[];page.on('pageerror',e=>errors.push(e.message));
  const token='review.'+Buffer.from(JSON.stringify({tenantId:'review',userId:'review-user',exp:Math.floor(now/1000)+3600})).toString('base64url')+'.preview';
  await page.addInitScript(token=>localStorage.setItem('qualitrack_access_token',token),token);
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;if(route.request().method()!=='GET')mutations.push(path);
   let json=[];
   let logs=scenario==='empty'?[]:records.slice(0,limit).map((record,i)=>({...record,...(scenario==='inactive'?{timestamp:new Date(now-100*86400000).toISOString()}:gapped&&i>=6?{timestamp:new Date(now-(i+3)*86400000-3600000).toISOString()}:{}),...(warning&&i===1?{overallStatus:'warning',warningPointsCount:1,samples:[{sampleIndex:1,values:{c1:100.095},statuses:{c1:'warning'}}]}:{})}));
   if(path.endsWith('/bootstrap'))json={company:{id:'review',name:'Örnek İmalat',plan_id:'enterprise',subscription_status:'active'},currentUserId:'review-user',users:[{id:'review-user',name:'Deniz Yılmaz',role:'admin',status:'active',email:'review@example.invalid'}],products:scenario==='empty'?[]:[product],controlPlans:scenario==='empty'?[]:[plan],inspectionLogs:logs,usage:{users:1,control_plans:1,monthly_measurements:logs.length}};
   if(path.endsWith('/work')){if(scenario==='error'&&!recovered)return route.fulfill({status:503,json:{error:'Fixture unavailable'}});json={tasks:[],cases:[],approvals:[],notifications:[],summary:{open_cases:scenario==='active'?2:0,overdue_tasks:scenario==='active'?1:0,pending_approvals:allWork?1:0}};}
   if(path.endsWith('/capabilities'))json={accountEmail:false};
   if(path.endsWith('/organization'))json={plants:[],departments:[],stations:[]};
   if(path.endsWith('/inspection-rules'))json={requireActivePlan:false,requireLotNumber:false,requireOrderNumber:false};
   return route.fulfill({json});
  });
  const capture=async(name,checks,selector)=>{
   await page.evaluate(()=>document.fonts.ready);
   expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const file=`${name}-${width}.png`;
   if(selector)await page.locator(selector).screenshot({path:join(out,file)});else await page.screenshot({path:join(out,file),fullPage:true});
   evidence.push({scenario:name,width,checks,file});
  };
  const load=async()=>{await page.goto(baseURL);await expect(page.locator('.rq-overview')).toBeVisible();if(scenario!=='error')await expect(page.locator('.ov-work-error')).toHaveCount(0);};
  await load();
  if(width<=760){const nav=page.getByRole('navigation',{name:'Mobil gezinme'});await expect(nav.getByRole('button')).toHaveText(['Genel Bakış','Kontrol başlat','İşler','Diğer']);await expect(nav.getByRole('button',{name:'Genel Bakış',exact:true})).toHaveAttribute('aria-current','page');}
  if(scenario==='empty'){
   await expect(page.locator('.ov-quiet')).toHaveCount(0);await expect(page.getByRole('button',{name:'Örnek parçayla dene'})).toBeVisible();
  }
  if(scenario==='inactive'&&width<=760){const text=await page.locator('.ov-inactive>div').boundingBox(),link=await page.locator('.ov-inactive .ov-text-button').boundingBox();expect(link.y).toBeGreaterThanOrEqual(text.y+text.height);expect(text.width).toBeGreaterThan(220);}
  if(scenario==='error')await expect(page.getByRole('button',{name:'Yeniden dene'})).toBeVisible();
  await capture(`after-${scenario}`,['Yatay taşma yok','Mobil gezinmede Genel Bakış seçili',...(scenario==='empty'?['Boş aksiyon satırı yok','Örnek parça bağlantısı var']:scenario==='inactive'?['Mobil geçmiş bağlantısı metnin altında']:[])]);
  await page.screenshot({path:join(out,`after-${scenario}-${width}-viewport.png`)});
  if(scenario==='empty'){
   await page.getByRole('button',{name:'Örnek parçayla dene'}).click();await expect(page.getByRole('dialog',{name:'Örnek parçayla dene'})).toBeVisible();
   await expect(page.getByRole('button',{name:'Örnek raporu aç'})).toBeDisabled();
   await page.getByRole('button',{name:'Örnek değerleri doldur'}).click();await page.getByLabel('Uzunluk ölçümü').fill('100,20');
   await expect(page.locator('.ov-sample-fail')).toContainText('Uygunsuz');await capture('sample-control',['Üç örnek nokta','Virgüllü giriş','Tolerans dışı sonuç'],'.ov-sample-modal');
   await page.getByRole('button',{name:'Örnek raporu aç'}).click();await expect(page.getByRole('dialog',{name:'Kalite kontrol raporu'})).toBeVisible();await expect(page.locator('.rq-report-paper')).toContainText('üretim kaydı değildir');expect(mutations).toEqual([]);await capture('sample-report',['Örnek rapor açıldı','API yazma isteği yok'],'.rq-report-modal');
   await page.locator('#btn-close-certificate').click();await page.getByRole('dialog',{name:'Örnek parçayla dene'}).getByRole('button',{name:'Kapat',exact:true}).click();await expect(page.locator('.ov-start')).toBeVisible();
  }
  if(scenario==='active'){
   await expect(page.locator('.ov-record:visible')).toHaveCount(width<=760?3:5);await expect(page.locator('.ov-record').first()).toContainText('LOT-42');
   for(const period of [7,90,30]){await page.getByRole('button',{name:`${period} gün`,exact:true}).click();await expect(page.getByRole('button',{name:`${period} gün`,exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.ov-heading')).toContainText(period===7?'7 kontrol':'12 kontrol');await capture(`period-${period}`,['Dönem seçimi ve kontrol sayısı doğrulandı']);}
   await page.getByRole('button',{name:'Raporu aç',exact:true}).click();await expect(page.getByRole('dialog',{name:'Kalite kontrol raporu'})).toBeVisible();await expect(page.getByRole('button',{name:'Yazdır / PDF Kaydet'})).toBeVisible();await capture('report-dialog',['Rapor penceresi ve PDF kaydet eylemi görünür'],'.rq-report-modal');await page.locator('#btn-close-certificate').click();
   allWork=true;await load();await expect(page.locator('.ov-priority-list>button')).toHaveCount(3);
   if(width<=760){const last=await page.locator('.ov-priority-list>button').last().boundingBox(),bottom=await page.locator('.quality-bottom-nav').boundingBox();expect(last.y+last.height).toBeLessThanOrEqual(bottom.y);}
   await capture('three-priorities',['Üç öncelik türü var','Mobilde üçü de alt menünün üzerinde']);await page.screenshot({path:join(out,`three-priorities-${width}-viewport.png`)});
   limit=1;await load();await expect(page.getByRole('heading',{name:'İlk kontrol raporunuz hazır.'})).toBeVisible();await capture('first-report',['Tek kayıt durumunda rapor çağrısı görünür']);await page.getByRole('button',{name:'İlk raporumu aç'}).click();await expect(page.getByRole('dialog',{name:'Kalite kontrol raporu'})).toBeVisible();await capture('first-report-dialog',['İlk rapor düğmesi raporu açtı'],'.rq-report-modal');await page.locator('#btn-close-certificate').click();
   limit=12;warning=true;allWork=false;await load();await expect(page.locator('.ov-summary')).toContainText('10 uygun + 1 uyarılı / 12 kontrol');await page.locator('.ov-rate-info summary').click();await capture('warning-breakdown',['Uyarı ayrı gösteriliyor','Oran değişmedi: 11/12']);await page.locator('.ov-rate-info summary').click();
   gapped=true;await load();await page.locator('.ov-trend').scrollIntoViewIfNeeded();await expect(page.locator('.ov-no-data')).toContainText('Veri yokluğu %0 uygunluk anlamına gelmez');await capture('chart-rate',['Eksik günler sıfır oran olarak çizilmiyor','Mobilde tarih başındaki boş alan daraltıldı'],'.ov-trend');
   if(width<=760){await page.getByRole('button',{name:'Kontrol sayısı',exact:true}).click();await expect(page.locator('.ov-volume-chart')).toBeVisible();await capture('chart-volume',['Mobil hacim görünümü açıldı'],'.ov-trend');}
   await page.locator('.ov-daily-data summary').click();await expect(page.locator('.ov-daily-data table')).toContainText('Veri yok');await expect(page.locator('.ov-daily-data table')).toContainText('%0');await capture('daily-values',['Veri yok ile %0 farklı gösteriliyor'],'.ov-daily-data');
  }
  if(scenario==='error'){recovered=true;await page.getByRole('button',{name:'Yeniden dene'}).click();await expect(page.locator('.ov-work-error')).toHaveCount(0);await capture('retry-success',['Yeniden deneme hatayı kaldırdı']);}
  expect(errors).toEqual([]);await page.close();
 }
 writeFileSync(join(out,'evidence.json'),JSON.stringify({generatedAt:new Date().toISOString(),fixtureTime:new Date(now).toISOString(),baseURL,browser:'Microsoft Edge / Playwright',widths,mode:'Mock API; no real account or delivery test',evidence},null,2));
 console.log(`PASS: ${evidence.length} evidence captures; sample flow, navigation, periods, reports, warnings, empty dates and recovery.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
