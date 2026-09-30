import {browserSession,delay} from './revision-browser-session.mjs';
const b=await browserSession('review-edge-cases');
const failures=[];
const check=async(expression,label)=>{
  if(await b.evaluate(expression))b.checks.push(label);else failures.push(label);
};
try{
  await b.size(390,844,true);await b.nav('settings');
  await b.evaluate("document.querySelector('button[aria-label=\"Menüyü aç\"]').click()");await delay(200);
  await check("(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return new Set(ids).size===ids.length;})()",'Mobile navigation has unique IDs');
  await b.click('Kişisel ayarlar','dialog');
  await check("!document.querySelector('dialog')",'Selecting current settings page closes mobile menu');
  if(await b.evaluate("!!document.querySelector('dialog')"))await b.key('Escape');
  await b.nav('operator');await b.evaluate("document.querySelector('.rq-scan-panel summary').click()");
  await b.evaluate(`
    window.BarcodeDetector=class {detect(){return new Promise(resolve=>window.finishDetection=resolve);}};
    window.originalVideoPlay=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=async()=>{};
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>new MediaStream()});
    window.initialProduct=document.querySelector('#select-operator-product').value;
  `);
  await b.click('Kamerayla tara');await b.waitFor("typeof window.finishDetection==='function'");
  await b.click('Kamerayı kapat');
  await b.evaluate("fetch('/api/bootstrap').then(r=>r.json()).then(data=>window.finishDetection([{rawValue:data.products.at(-1).code}]))");await delay(300);
  await check("document.querySelector('#select-operator-product').value===window.initialProduct&&!document.querySelector('.rq-scan-content [role=status]')",'Closed camera ignores delayed detection');
  await b.evaluate("HTMLMediaElement.prototype.play=window.originalVideoPlay");
  await check(`(async()=>{
    const before=await fetch('/api/bootstrap').then(r=>r.json());
    const plan=before.controlPlans[0], product=before.products[0];
    await fetch('/api/control-plans/'+plan.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...plan,version:'RESET-TEST'})});
    await fetch('/api/products/'+product.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...product,code:'RESET-TEST'})});
    await fetch('/api/review/reset',{method:'POST'});
    const after=await fetch('/api/bootstrap').then(r=>r.json());
    return JSON.stringify(before.controlPlans)===JSON.stringify(after.controlPlans)&&JSON.stringify(before.products)===JSON.stringify(after.products);
  })()`, 'Fixture reset restores edited products and control plans');
  if(failures.length||b.errors.length)throw Error([...failures,...b.errors].join('\n'));
  console.log('PASS: '+b.checks.length+' review edge cases');
}catch(error){b.errors.push(String(error));throw error;}finally{await b.finish();}
