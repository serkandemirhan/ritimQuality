import {browserSession,delay} from './revision-browser-session.mjs';
const b=await browserSession('phases-32-35');
try {
  await b.evaluate("document.querySelector('.rq-skip-link').focus()");
  await delay(250);
  await b.assert("document.activeElement.textContent==='İçeriğe geç'&&document.activeElement.getBoundingClientRect().top>=0",'Keyboard skip link visible on focus');
  await b.key('Enter');await b.assert("document.activeElement.id==='main-content'",'Skip link focuses main content');
  await b.nav('users');await b.click('Kullanıcı ekle');
  await b.assert("document.querySelector('dialog').open&&document.querySelector('dialog').contains(document.activeElement)",'Dialog receives focus');
  await b.assert("!!document.querySelector('input[type=password][aria-describedby]')",'Input helper is associated with its field');
  for(let i=0;i<15;i++){await b.key('Tab');await b.assert("document.querySelector('dialog').contains(document.activeElement)",'Dialog contains keyboard focus '+i);}
  await b.key('Escape');await b.assert("!document.querySelector('dialog')",'Escape closes modal');
  await b.nav('settings');await b.evaluate("document.querySelector('[role=tab]').focus()");await b.key('ArrowRight');
  await b.assert("document.activeElement.getAttribute('aria-selected')==='true'&&document.activeElement.textContent==='Denetim izi'",'Arrow key selects settings tab');
  await b.cmd('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await b.evaluate("document.querySelector('button[aria-label=Bildirimler]').click()");await delay(200);
  await b.assert("getComputedStyle(document.querySelector('dialog')).animationName==='none'",'Reduced motion disables dialog animation');await b.key('Escape');
  await b.cmd('Emulation.setEmulatedMedia',{features:[]});
  for(const tab of ['overview','products','control-plans','operator','logs','spc','work','cases','approvals','organization','users','settings','subscription']) {
    await b.nav(tab);
    for(const width of [1920,1440,1366,1280]) {
      await b.size(width);
      await b.assert(`document.documentElement.scrollWidth<=${width}&&innerWidth<=${width}`,tab+' fits '+width);
      if(width===1440)await b.shot(tab);
    }
  }
  if(b.errors.length)throw Error(b.errors.join('\n'));
  console.log('PASS: '+b.checks.length+' desktop keyboard, motion and route checks');
} catch(error){b.errors.push(String(error));throw error;} finally {await b.finish();}
