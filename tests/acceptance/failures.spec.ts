// Deliberate failure injection is separate from the unmocked five-minute test.
import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
test('registration conflict, bootstrap and drawing upload recover without losing input',async({page})=>{
 const workspace='conflict-'+randomUUID().slice(0,8),password=randomUUID()+'Aa1!',email=workspace+'@example.invalid';
 const response=await page.request.post('/api/auth/register',{data:{companyName:'Conflict',name:'Admin',workspace,email,password}});expect(response.status()).toBe(201);
 await page.goto('/?auth=register');page.on('dialog',d=>d.dismiss());
 for(const [label,value]of [['Firma adı','Yeni firma'],['Ad soyad','Yeni kullanıcı'],['Çalışma alanı',workspace],['E-posta adresi',email],['Şifre',password]])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Ücretsiz hesap oluştur',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Firma adı',{exact:true})).toHaveValue('Yeni firma');
 await page.getByLabel('Çalışma alanı',{exact:true}).fill('retry-'+randomUUID().slice(0,8));
 await page.route('**/api/bootstrap',route=>route.fulfill({status:503,json:{error:'Kabul testi: bağlantı kesildi'}}));
 await page.getByRole('button',{name:'Ücretsiz hesap oluştur',exact:true}).click();await expect(page.getByText('Kabul testi: bağlantı kesildi',{exact:false})).toBeVisible();
 await page.unroute('**/api/bootstrap');await page.reload();await page.getByRole('button',{name:'İlk parçayı ekle',exact:true}).click();await page.locator('#btn-add-new-product').click();
 await page.getByLabel('Parça kodu *',{exact:true}).fill('RECOVERY');await page.getByLabel('Parça adı *',{exact:true}).fill('Kurtarılan parça');
 await page.route('**/api/media',route=>route.fulfill({status:503,json:{error:'Kabul testi: yükleme kesildi'}}));
 const failed=page.waitForResponse(r=>r.url().endsWith('/api/media')&&r.status()===503);
 const input=page.locator('input[type=file]'),file=fileURLToPath(new URL('./drawing.png',import.meta.url));await input.setInputFiles(file);await failed;
 await expect(page.getByLabel('Parça adı *',{exact:true})).toHaveValue('Kurtarılan parça');await expect(page.getByRole('button',{name:'Parçayı kaydet',exact:true})).toBeEnabled();
 await page.unroute('**/api/media');await input.setInputFiles([]);await input.setInputFiles(file);await expect(page.getByRole('button',{name:'Parçayı kaydet',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Parçayı kaydet',exact:true}).click();
 await page.getByRole('button',{name:'İlk kontrol planını oluştur',exact:true}).click();await expect(page.locator('#btn-save-control-plan')).toBeEnabled();await page.locator('#btn-add-characteristic').click();await page.getByLabel('Karakteristik adı',{exact:true}).fill('Gerçek ölçü');await page.getByLabel('Nominal',{exact:true}).fill('10');await page.getByLabel('Alt tolerans',{exact:true}).fill('-0.1');await page.getByLabel('Üst tolerans',{exact:true}).fill('0.1');
 await page.getByText('Diğer işlemler ▾',{exact:true}).click();await page.getByRole('button',{name:'PDF’den plan oluştur',exact:true}).click();
 const analysis=page.getByRole('region',{name:'PDF’den kontrol planı oluştur'});
 await analysis.locator('input[type=file]').setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});await expect(analysis.getByRole('alert')).toContainText('Geçerli bir PDF');await analysis.getByRole('button',{name:'Kapat',exact:true}).click();
 await expect(page.getByLabel('Karakteristik adı',{exact:true})).toHaveValue('Gerçek ölçü');await expect(page.getByLabel('Nominal',{exact:true})).toHaveValue('10');
});
