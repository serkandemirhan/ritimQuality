import {browserSession,delay} from './revision-browser-session.mjs';
const b=await browserSession('phases-36-43');
try {
  for(const width of [390,360,768]){
    await b.size(width,844,true);
    for(const tab of ['operator','work','approvals','cases','logs','notifications']){
      if(tab==='notifications'){await b.evaluate("document.querySelector('button[aria-label=Bildirimler]').click()");await delay(200);await b.key('Escape');continue;}
      await b.nav(tab);
      await b.assert(`document.documentElement.scrollWidth<=${width}`,tab+' fits '+width);
      if(width===390)await b.shot(tab);
    }
  }
  await b.size(390,844,true);
  await b.evaluate("document.querySelector('button[aria-label=\"Menüyü aç\"]').focus();document.activeElement.click()");await delay(200);
  await b.assert("document.querySelector('.rq-mobile-navigation').contains(document.activeElement)",'Mobile navigation receives focus');
  await b.key('Escape');
  await b.assert("!document.querySelector('dialog')&&document.activeElement.getAttribute('aria-label')==='Menüyü aç'",'Mobile navigation Escape restores focus');
  await b.nav('work');
  await b.assert("getComputedStyle(document.querySelector('.rq-mobile-cards tbody')).display==='grid'&&document.querySelector('.rq-mobile-cards td').dataset.label==='Görev / ilişkiler'",'Task cards retain column labels');
  await b.click('Tamamla');await b.fill('dialog textarea','Mobil kontrol tamamlandı.');await b.click('Kararı kaydet','dialog');
  await b.waitFor("!document.querySelector('dialog')");
  await b.assert("!document.querySelector('dialog')&&document.querySelector('main').textContent.includes('Tamamlandı')",'Mobile task completion');
  await b.nav('approvals');await b.click('Onayla');
  await b.assert("document.querySelector('.rq-bottom-sheet').getBoundingClientRect().bottom<=innerHeight",'Approval sheet fits viewport');
  await b.fill('dialog textarea','Mobil ölçüm incelendi.');await b.click('Kararı kaydet','dialog');
  await b.waitFor("!document.querySelector('dialog')");
  await b.assert("document.querySelector('main').textContent.includes('Onaylandı')",'Mobile approval saves');
  await b.nav('cases');await b.click('İncele');
  await b.fill('dialog textarea[name=rootCause]','Mobil inceleme kaydı.');await b.click('Kaydet','dialog');
  await b.waitFor("document.querySelector('dialog').textContent.includes('Mobil inceleme kaydı.')");
  await b.assert("document.querySelector('dialog').textContent.includes('Mobil inceleme kaydı.')",'Mobile case update preserves fields');await b.key('Escape');
  await b.nav('operator');await b.evaluate("document.querySelector('.rq-scan-panel summary').click()");
  await b.fill('input[aria-label="QR bağlantısı veya parça kodu"]','invalid');await b.click('Ürünü aç');
  await b.assert("!!document.querySelector('#qr-scan-error')",'Invalid QR has accessible error');
  const product=await b.evaluate("fetch('/api/bootstrap').then(r=>r.json()).then(data=>data.products[0])");
  await b.fill('input[aria-label="QR bağlantısı veya parça kodu"]',product.code);await b.click('Ürünü aç');
  await b.assert("document.querySelector('.rq-scan-content [role=status]').textContent.includes('Ürün seçildi')",'Manual QR fallback selects real product');
  await b.evaluate("window.BarcodeDetector=undefined;window.originalGetUserMedia=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError')}");await b.click('Kamerayla tara');
  await b.waitFor("!!document.querySelector('#qr-scan-error')");
  await b.assert("document.querySelector('#qr-scan-error').textContent.includes('Kamera izni verilmedi')&&!document.querySelector('.rq-is-scanning')",'Camera permission denial returns to manual entry');
  await b.evaluate("navigator.mediaDevices.getUserMedia=window.originalGetUserMedia");
  await b.evaluate("document.querySelector('#btn-start-inspection').click()");await delay(300);
  await b.fill('input[aria-label="Ölçülen değer"]','99');
  await b.assert("document.querySelector('.measurement-result').textContent.includes('NOK')",'Mobile terminal shows NOK text');
  await b.assert("getComputedStyle(document.querySelector('.quality-measurement-grid')).flexDirection==='column'&&getComputedStyle(document.querySelector('.rq-terminal-context')).display==='grid'",'Mobile terminal stacks drawing and readable context');
  await b.assert("getComputedStyle(document.querySelector('.quality-measurement-actions')).position==='sticky'",'Terminal actions stay reachable');
  await b.shot('terminal-nok');
  if(b.errors.length)throw Error(b.errors.join('\n'));
  console.log('PASS: '+b.checks.length+' mobile checks');
}catch(error){b.errors.push(String(error));throw error;}finally{await b.finish();}
