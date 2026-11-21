// Local fixtures only; verifies native mobile form validation and API submission.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'D:/Projects/RitimFlowLite/RitimFlowLite/node_modules/playwright');
const express=require('express'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const app=express(),requests=[];app.use(express.json());
 app.get('/api/auth/capabilities',(_,res)=>res.json({accountEmail:true}));
 app.post('/api/auth/login',(req,res)=>{requests.push(req.body);res.status(401).json({error:'Fixture: account not connected'});});
 app.use(express.static('dist'));const server=await new Promise(resolve=>{const s=app.listen(3377,'127.0.0.1',()=>resolve(s));});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const out=path.resolve('.runtime/username-login');fs.mkdirSync(out,{recursive:true});
 try{
  for(const mobile of [true,false]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
   if(mobile)await context.addInitScript(()=>{const original=matchMedia;window.matchMedia=q=>q==='(display-mode: standalone)'?{...original(q),matches:true,addEventListener(){},removeEventListener(){}}:original(q);});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:3377');
   const identity=page.getByLabel('E-posta veya kullanıcı adı');assert.equal(await identity.getAttribute('type'),'text');
   await page.getByLabel('Çalışma alanı',{exact:true}).fill('test-workspace');await page.getByLabel('Şifre',{exact:true}).fill('test-password');
   for(const account of ['operator123','operator123@example.test']){
    await identity.fill(account);const before=requests.length;await page.getByRole('button',{name:'Giriş yap',exact:true}).click();
    await page.getByRole('alert').waitFor();assert.equal(requests.length,before+1);assert.equal(requests.at(-1).email,account);
   }
   await page.screenshot({path:path.join(out,mobile?'mobile-pwa-login.png':'desktop-login.png'),fullPage:true});
   await page.getByRole('button',{name:'Şifremi unuttum',exact:true}).click();assert.equal(await page.getByLabel('E-posta adresi').getAttribute('type'),'email');
   await page.getByRole('button',{name:'Giriş ekranına dön',exact:true}).click();await page.getByRole('button',{name:'Yeni firma hesabı oluştur',exact:true}).click();assert.equal(await page.getByLabel('E-posta adresi').getAttribute('type'),'email');
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: mobile standalone PWA and desktop accept username/email submissions; registration and recovery still require email; no page exceptions.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
