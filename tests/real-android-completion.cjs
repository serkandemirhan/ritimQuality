const {chromium,expect}=require('../website/node_modules/@playwright/test');
const fs=require('fs');
const {execFileSync}=require('child_process');

const port=process.env.ANDROID_CDP_PORT||'9223';
const serial=process.env.ANDROID_SERIAL||'unknown';
const base=process.env.TEST_APP_URL||'http://127.0.0.1:3350';
const out=`reports/real-android/${serial}`;
const adb=process.env.ADB_PATH||'C:/Users/serkan/Downloads/platform-tools-latest-windows/platform-tools/adb.exe';
fs.mkdirSync(out,{recursive:true});

const shot=name=>{
  const remote=`/sdcard/${name}.png`;
  execFileSync(adb,['-s',serial,'shell','screencap','-p',remote]);
  execFileSync(adb,['-s',serial,'pull',remote,`${out}/${name}.png`],{stdio:'ignore'});
  execFileSync(adb,['-s',serial,'shell','rm',remote]);
};

(async()=>{
  const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context=browser.contexts()[0];
  // A previous Android orientation run may leave a restored Chrome tab with an
  // opaque (sandboxed) origin even though its address bar shows the app URL.
  // A fresh tab gives this acceptance run an unambiguous application origin.
  const page=await context.newPage();
  page.setDefaultTimeout(30000);
  const cdp=await context.newCDPSession(page);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
      localStorage.clear();
      for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();
      for(const key of await caches.keys())await caches.delete(key);
      await new Promise(resolve=>{const request=indexedDB.deleteDatabase('ritim-mobile-measurement');request.onsuccess=request.onerror=request.onblocked=()=>resolve();});
      const payload=btoa(JSON.stringify({tenantId:'review',userId:'review-user',exp:Math.floor(Date.now()/1000)+3600})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      localStorage.setItem('qualitrack_access_token','review.'+payload+'.preview');
    });
    await page.reload({waitUntil:'networkidle'});
    await page.evaluate(()=>document.querySelector('#nav-tab-operator')?.click());
    await expect(page.locator('#select-operator-product')).toBeVisible();
    await page.locator('#select-operator-product').selectOption({index:1});
    await page.getByRole('button',{name:'1',exact:true}).click();
    await expect(page.locator('#btn-start-inspection')).toBeEnabled();
    await page.locator('#btn-start-inspection').click();
    await expect(page.locator('.mm-shell')).toBeVisible();

    for(let index=0;index<6;index++){
      const input=page.locator('#mobile-measured-value');
      if(await input.count()){
        const nominal=(await page.locator('.mm-limits div').nth(1).locator('dd').innerText()).trim().replace('.',',').replace(/[^0-9,-]/g,'');
        for(const key of nominal)await page.locator('.mm-keypad').getByRole('button',{name:key==='-'?'İşareti değiştir':key,exact:true}).click();
      }else if(await page.locator('.mm-choices button').count())await page.locator('.mm-choices button').first().click();
      else await page.getByLabel('Metin sonucu').fill('Uygun');
      await page.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();
      await page.waitForTimeout(250);
    }
    await expect(page.getByText('Tüm ölçümler tamamlandı')).toBeVisible();
    shot('17-tum-olcumler-tamamlandi');
    await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await page.getByRole('button',{name:'Ölçümü tamamla ve raporu aç',exact:true}).click();
    await expect(page.getByText('Yerel rapor')).toBeVisible();
    shot('18-cevrimdisi-yerel-rapor');
    const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,localReport:[...document.querySelectorAll('*')].some(e=>e.textContent?.trim()==='Yerel rapor')}));
    if(state.scrollWidth>state.width+1)throw Error(`Horizontal overflow: ${JSON.stringify(state)}`);
    if(!state.localReport)throw Error('Local report notice missing');
    const applicationErrors=errors.filter(message=>!message.includes('WebSocket closed without opened'));
    if(applicationErrors.length)throw Error(applicationErrors.join('\n'));
    fs.writeFileSync(`${out}/completion-results.json`,JSON.stringify({serial,at:new Date().toISOString(),...state,errors:applicationErrors},null,2));
    console.log(`PASS ${serial}: one-sample inspection completed and offline local report opened.`);
  }finally{
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
