const {chromium,expect}=require('../website/node_modules/@playwright/test');
const fs=require('fs');
const {execFileSync}=require('child_process');

const port=process.env.ANDROID_CDP_PORT||'9223';
const serial=process.env.ANDROID_SERIAL||'unknown';
const base=process.env.TEST_APP_URL||'http://127.0.0.1:3350';
const out=`reports/real-android/${serial}`;
const adb=process.env.ADB_PATH||'C:/Users/serkan/Downloads/platform-tools-latest-windows/platform-tools/adb.exe';
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context=browser.contexts()[0];
  const page=context.pages()[0]||await context.newPage();
  page.setDefaultTimeout(30000);
  const cdp=await context.newCDPSession(page);
  const errors=[];const evidence=[];
  page.on('pageerror',error=>errors.push(error.message));
  const shot=async name=>{
    const state=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,online:navigator.onLine,title:document.querySelector('h1')?.textContent||''}));
    assertState(state.scrollWidth<=state.width+1,`Horizontal overflow: ${JSON.stringify(state)}`);
    const remote=`/sdcard/${name}.png`;
    execFileSync(adb,['-s',serial,'shell','screencap','-p',remote]);
    execFileSync(adb,['-s',serial,'pull',remote,`${out}/${name}.png`],{stdio:'ignore'});
    execFileSync(adb,['-s',serial,'shell','rm',remote]);
    evidence.push({name,...state});
  };
  const assertState=(value,message)=>{if(!value)throw Error(message);};
  const openTab=async id=>{
    await page.evaluate(tab=>document.querySelector(`#nav-tab-${tab}`)?.click(),id);
    await page.waitForTimeout(500);
  };
  try{
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await page.goto(base,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{localStorage.clear();for(const registration of await navigator.serviceWorker.getRegistrations())await registration.unregister();for(const key of await caches.keys())await caches.delete(key);await new Promise(resolve=>{const request=indexedDB.deleteDatabase('ritim-mobile-measurement');request.onsuccess=request.onerror=request.onblocked=()=>resolve();});const payload=btoa(JSON.stringify({tenantId:'review',userId:'review-user',exp:Math.floor(Date.now()/1000)+3600})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');localStorage.setItem('qualitrack_access_token','review.'+payload+'.preview');});
    await page.reload({waitUntil:'networkidle'});
    await expect(page.getByRole('heading',{name:'Kaliteye genel bakış'})).toBeVisible();
    const device=await page.evaluate(()=>({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,touchPoints:navigator.maxTouchPoints}));
    fs.writeFileSync(`${out}/device.json`,JSON.stringify(device,null,2));
    await shot('01-genel-bakis');
    for(const [id,name] of [['control-plans','02-kontrol-planlari'],['products','03-parcalar'],['work','04-aksiyonlar'],['logs','05-kontrol-kayitlari'],['users','06-kullanicilar'],['settings','07-ayarlar']]){await openTab(id);await shot(name);}
    await openTab('operator');
    await expect(page.getByRole('heading',{name:'Ölçüm hazırlığı'})).toBeVisible();
    await shot('08-olcum-hazirligi');
    await page.locator('#select-operator-product').selectOption({index:1});
    await expect(page.locator('#btn-start-inspection')).toBeEnabled();
    await page.locator('#btn-start-inspection').click();
    await expect(page.locator('.mm-shell')).toBeVisible();
    await expect.poll(()=>page.locator('.mm-drawing img').evaluateAll(items=>items.some(item=>item.naturalWidth>0))).toBe(true);
    await shot('09-mobil-olcum-basladi');
    const rects=await page.evaluate(()=>{const input=document.querySelector('#mobile-measured-value')?.getBoundingClientRect();const save=document.querySelector('.mm-actions .mm-primary')?.getBoundingClientRect();return {input:input&&{top:input.top,bottom:input.bottom,left:input.left,right:input.right},save:save&&{top:save.top,bottom:save.bottom,left:save.left,right:save.right}};});
    if(rects.input&&rects.save)assertState(rects.input.bottom<=rects.save.top||rects.save.bottom<=rects.input.top,'Input and save overlap');
    for(let index=0;index<5;index++){
      if(await page.locator('.mm-keypad').count()){
        const nominal=(await page.locator('.mm-limits div').nth(1).locator('dd').innerText()).trim().replace('.',',').replace(/[^0-9,-]/g,'');
        for(const key of nominal)await page.locator('.mm-keypad').getByRole('button',{name:key==='-'?'İşareti değiştir':key,exact:true}).click();
      }else if(await page.locator('.mm-choices button').count()){
        await page.locator('.mm-choices button').first().click();
      }else{
        await page.getByLabel('Metin sonucu').fill('Uygun');
      }
      await shot(`10-olcum-${index+1}-girildi`);
      await page.getByRole('button',{name:'Kaydet ve ilerle',exact:true}).click();
      await page.waitForTimeout(250);
      if(index===2){
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
        await page.waitForTimeout(500);
        await shot('11-cevrimdisi-cihazda-kayit');
      }
    }
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await page.waitForTimeout(800);
    const session=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('ritim-mobile-measurement');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return await new Promise((resolve,reject)=>{const tx=db.transaction('sessions');const req=tx.objectStore('sessions').getAll();req.onsuccess=()=>resolve(req.result[0]);req.onerror=()=>reject(req.error);});});
    assertState(session?.attempts?.length>=5,`Expected five durable attempts, got ${session?.attempts?.length}`);
    await shot('12-bes-ardisik-olcum');
    const applicationErrors=errors.filter(message=>!message.includes('WebSocket closed without opened'));
    assertState(applicationErrors.length===0,applicationErrors.join('\n'));
    fs.writeFileSync(`${out}/results.json`,JSON.stringify({serial,at:new Date().toISOString(),device,evidence,attempts:session.attempts.length,errors:applicationErrors,testTransportWarnings:errors.filter(message=>message.includes('WebSocket closed without opened'))},null,2));
    console.log(`PASS ${serial}: ${device.width}x${device.height}, all main screens, five durable measurements, offline save, no overflow or JS errors.`);
  } catch(error){
    try{execFileSync(adb,['-s',serial,'shell','screencap','-p','/sdcard/ritim-failure.png']);execFileSync(adb,['-s',serial,'pull','/sdcard/ritim-failure.png',`${out}/failure.png`],{stdio:'ignore'});execFileSync(adb,['-s',serial,'shell','rm','/sdcard/ritim-failure.png']);}catch{}
    fs.writeFileSync(`${out}/failure.txt`,String(error));throw error;
  } finally {await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
