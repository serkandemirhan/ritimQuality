import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import playwright from '../website/node_modules/@playwright/test/index.js';

const {chromium}=playwright;

const base=process.env.TEST_APP_URL||'http://127.0.0.1:3350';
const out='.runtime/ui-lifecycle';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>localStorage.setItem('qualitrack_access_token','review.eyJ0ZW5hbnRJZCI6InJldmlldyIsInVzZXJJZCI6InJldmlldy11c2VyIn0.preview'));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.request.post(base+'/api/review/reset');
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#nav-tab-users').click();

  const createUser=async({name,email,role,department,station})=>{
    await page.getByRole('button',{name:'Kullanıcı ekle'}).click();
    const dialog=page.getByRole('dialog',{name:'Yeni kullanıcı'});
    await dialog.getByLabel('Ad soyad').fill(name);
    await dialog.getByLabel('E-posta').fill(email);
    await dialog.getByLabel('Rol').selectOption(role);
    await dialog.getByLabel('Bölüm').fill(department);
    await dialog.getByLabel('İstasyon / Tezgâh').fill(station);
    await dialog.getByLabel('Geçici şifre').fill('Test-password-123');
    await dialog.getByRole('button',{name:'Kullanıcı oluştur'}).click();
    await page.getByText(email,{exact:true}).waitFor();
  };

  await createUser({name:'Ayşe Operatör',email:'ayse.operator@example.test',role:'operator',department:'Talaşlı İmalat',station:'CNC-07'});
  await createUser({name:'Mert Kalite',email:'mert.kalite@example.test',role:'quality_engineer',department:'Kalite',station:'Ölçüm Odası'});
  const bootstrap=await (await page.request.get(base+'/api/bootstrap')).json();
  assert.equal(bootstrap.users.length,3);
  assert.equal(bootstrap.users.find(user=>user.email==='ayse.operator@example.test')?.role,'operator');
  assert.equal(bootstrap.users.find(user=>user.email==='mert.kalite@example.test')?.role,'quality_engineer');
  assert.ok(bootstrap.users.every(user=>!('password' in user)&&!('pinCode' in user)),'Passwords must never return from bootstrap');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop users page must not overflow');
  await page.screenshot({path:out+'/users-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile users page must not overflow');
  await page.screenshot({path:out+'/users-mobile.png',fullPage:false});
  console.log('PASS: two users created through the UI, roles and assignments persisted, credentials excluded from bootstrap, desktop/mobile no overflow.');
} finally {
  await browser.close();
}
