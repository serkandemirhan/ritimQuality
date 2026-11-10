const {chromium,expect}=require('../website/node_modules/@playwright/test');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try {
  for(const width of [390,1440]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.route('**/api/auth/capabilities',route=>route.fulfill({json:{accountEmail:false}}));
   await page.goto(process.env.TEST_APP_URL||'http://127.0.0.1:3404');
   await expect(page.getByRole('heading',{name:'Çalışma alanınıza hoş geldiniz.'})).toBeVisible();
   await page.getByRole('button',{name:'Şifremi unuttum'}).click();
   await expect(page.getByText('E-posta ile hesap işlemleri henüz etkin değil.',{exact:false})).toBeVisible();
   await expect(page.getByRole('button',{name:'Bağlantı iste'})).toBeDisabled();
   await page.getByRole('button',{name:'Giriş ekranına dön'}).click();
   await page.getByRole('button',{name:'Yeni firma hesabı oluştur'}).click();
   await expect(page.getByLabel('Firma adı',{exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`.runtime/account-register-${width}.png`});
   await page.goto((process.env.TEST_APP_URL||'http://127.0.0.1:3404')+'/?auth=reset#token=test-token');
   await expect(page.getByLabel('Yeni şifre',{exact:true})).toBeVisible();
   expect(new URL(page.url()).hash).toBe('');
   await page.getByLabel('Yeni şifre',{exact:true}).fill('first-password');
   await page.getByLabel('Yeni şifreyi tekrar girin').fill('different-password');
   await page.getByRole('button',{name:'Şifremi yenile'}).click();
   await expect(page.getByRole('alert')).toHaveText('Şifreler eşleşmiyor.');
   await page.close();
  }
  console.log('PASS: desktop/mobile account forms, unavailable email state, reset fragment removal, password mismatch, no horizontal overflow.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
