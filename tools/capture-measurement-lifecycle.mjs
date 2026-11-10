import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import express from 'express';
import ts from 'typescript';

const output = resolve('output/measurement-lifecycle');
const runtime = resolve('.runtime/measurement-lifecycle');
await rm(output, { recursive: true, force: true });
await rm(runtime, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(runtime, { recursive: true });

const source = await readFile('src/data/mockData.ts', 'utf8');
await writeFile(resolve(runtime, 'mock.mjs'), ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
const data = await import('../.runtime/measurement-lifecycle/mock.mjs');
const product = data.INITIAL_PRODUCTS[0];
const sourcePlan = data.INITIAL_CONTROL_PLANS.find(plan => plan.productId === product.id && plan.isActive) || data.INITIAL_CONTROL_PLANS[0];
const plan = {
  ...sourcePlan,
  id: 'lifecycle-plan',
  productId: product.id,
  version: 'OPERASYON-R01',
  isActive: true,
  status: 'active',
  defaultSampleCount: 1,
  characteristics: sourcePlan.characteristics.slice(0, 2).map((item, index) => ({
    ...item,
    id: `lifecycle-char-${index + 1}`,
    pointNo: index + 1,
    evidencePolicy: index === 0 ? 'optional' : 'none',
  })),
};
const logs = [];
const media = [];
const token = 'review.eyJ0ZW5hbnRJZCI6InJldmlldyIsInVzZXJJZCI6InJldmlldy11c2VyIn0.preview';
const app = express();
app.use(express.json({ limit: '12mb' }));
app.get('/api/bootstrap', (_, res) => res.json({
  company: { id: 'review', name: 'Ölçüm Yaşam Döngüsü', plan_id: 'enterprise', subscription_status: 'active', billing_period: 'annual' },
  currentUserId: 'review-user',
  users: [{ id: 'review-user', name: 'Operatör Deniz', role: 'admin', status: 'active', email: 'operator@example.test', stationOrMachine: 'CNC-01' }],
  products: [product],
  controlPlans: [plan],
  inspectionLogs: logs,
  usage: { control_plans: 1, users: 1, monthly_measurements: logs.length },
}));
app.get('/api/inspection-rules', (_, res) => res.json({ requireActivePlan: false, requireLotNumber: false, requireOrderNumber: false }));
app.get('/api/work', (_, res) => res.json({ tasks: [], cases: [], approvals: [], notifications: [], summary: { open_cases: 0, overdue_tasks: 0, pending_approvals: 0 } }));
app.get('/api/inspection-drafts', (_, res) => res.json([]));
app.post('/api/inspection-drafts/:id/claim', (_, res) => res.json({ payload: {} }));
app.post('/api/inspection-drafts/:id/release', (_, res) => res.json({ ok: true }));
app.post('/api/inspection-drafts', (_, res) => res.json({ ok: true }));
app.get('/api/media/config', (_, res) => res.json({ provider: 'local', maxBytes: 5 * 1024 * 1024 }));
app.post('/api/media', (req, res) => {
  const item = { id: req.body.id || `media-${media.length + 1}`, fileName: req.body.fileName, mimeType: req.body.mimeType, kind: req.body.kind, url: req.body.dataUrl, createdAt: new Date().toISOString() };
  media.push(item);
  res.json(item);
});
app.post('/api/inspection-logs', (req, res) => {
  const confirmed = { ...req.body, syncedAt: new Date().toISOString() };
  logs.push(confirmed);
  res.json(confirmed);
});
app.get('/api/*', (_, res) => res.json([]));
app.use(express.static('dist'));
const server = app.listen(3365, '127.0.0.1');

const devices = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'tablet', width: 820, height: 1180, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
];
const tinyPng = resolve(runtime, 'evidence.png');
await writeFile(tinyPng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'));

const browserPath = process.env.EDGE_PATH || process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edge = spawn(browserPath, [
  '--headless=new',
  '--remote-debugging-port=9365',
  '--remote-debugging-address=127.0.0.1',
  '--user-data-dir=' + resolve(runtime, 'profile'),
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank',
], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browserLog = '';
edge.stdout?.on('data', chunk => { browserLog += chunk.toString(); });
edge.stderr?.on('data', chunk => { browserLog += chunk.toString(); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const report = [];

try {
  let target;
  for (let i = 0; i < 50; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9365/json')).json()).find(item => item.type === 'page');
      if (target) break;
    } catch {}
    await delay(250);
  }
  if (!target) throw new Error('Browser unavailable: ' + browserLog.slice(-2000));
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let seq = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      message.error ? handler.reject(message.error) : handler.resolve(message.result);
    }
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const screenshot = async (device, step, description) => {
    await delay(250);
    const png = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const file = `${device.name}-${String(step).padStart(2, '0')}.png`;
    await writeFile(resolve(output, file), Buffer.from(png.data, 'base64'));
    const metrics = await evaluate(`(()=>({url:location.href,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,viewport:innerHeight,body:document.body.innerText.slice(0,500)}))()`);
    report.push({ device: device.name, step, file, description, metrics, verticalScroll: metrics.scrollHeight > metrics.viewport + 2, horizontalOverflow: metrics.scrollWidth > metrics.width + 2 });
  };
  const click = async selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  const clickText = async text => evaluate(`Array.from(document.querySelectorAll('button,summary')).find(el=>el.textContent.includes(${JSON.stringify(text)}))?.click()`);
  const tapMobileKeys = async keys => {
    for (const key of keys) {
      await evaluate(`Array.from(document.querySelectorAll('.mm-keypad button')).find(button=>button.textContent.trim()===${JSON.stringify(key)})?.click()`);
      await delay(80);
    }
  };
  const setInput = async (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;const setter=Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  const setFile = async selector => {
    const doc = await command('DOM.getDocument', { depth: -1, pierce: true });
    const node = await command('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    if (node.nodeId) await command('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [tinyPng] });
  };
  const mouseClickSelector = async selector => {
    const box = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    if (!box) return false;
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    return true;
  };
  await command('Page.enable');
  await command('Runtime.enable');
  await command('DOM.enable');

  for (const device of devices) {
    await command('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, deviceScaleFactor: 1, mobile: device.mobile });
    await command('Emulation.setTouchEmulationEnabled', { enabled: device.mobile });
    await command('Page.navigate', { url: 'http://127.0.0.1:3365' });
    await delay(1200);
    await evaluate(`localStorage.clear();localStorage.setItem('qualitrack_access_token',${JSON.stringify(token)});location.reload()`);
    await delay(1400);
    await click('#nav-tab-operator');
    await delay(500);
    await screenshot(device, 1, 'Ölçüm hazırlığı ilk durum: QR, arama ve ürün kartı görünür.');
    await setInput('.rq-start-search input', product.code.slice(0, 8));
    await delay(250);
    await click('.rq-start-card');
    await delay(450);
    await screenshot(device, 2, 'Ürün karttan seçildi; aktif plan otomatik geldi.');
    await setInput('#inspection-work-order', `WO-${device.name.toUpperCase()}-001`);
    await setInput('input[aria-label="Parti numarası"]', `LOT-${device.name.toUpperCase()}-A`);
    await screenshot(device, 3, 'İş emri ve lot bilgisi girildi; ölçüme başlama özeti hazır.');
    await click('#btn-start-inspection');
    await delay(700);
    await screenshot(device, 4, 'Ölçüm terminali açıldı; ilk ölçüm noktası aktif.');
    if (device.name === 'phone') {
      await tapMobileKeys(['9', '9']);
      await clickText('Kaydet ve ilerle');
      await delay(400);
      await setInput('dialog textarea', 'İlk noktada yüzey çizik izi görüldü; uygunsuz değer bilinçli test edildi.');
      await setInput('dialog input:not([type="file"])', 'Yüzey çizik izi');
      await delay(700);
      await screenshot(device, 5, 'Uygunsuz ölçüm girildi; açıklama eklendi ve mobil kanıt aksiyonları görünür.');
      await mouseClickSelector('dialog .mm-sheet-actions .mm-primary');
      for (let i = 0; i < 20; i++) {
        const moved = await evaluate(`!document.querySelector('dialog[open]') && document.body.innerText.includes('2 / 2')`);
        if (moved) break;
        await delay(150);
      }
    } else {
      await setInput('input[aria-label="Ölçülen değer"]', '99');
      await delay(350);
      await clickText('Fotoğraf ve ölçüm notu');
      await setInput('textarea[aria-label="Ölçüm noktası notu"]', 'İlk noktada yüzey çizik izi görüldü; uygunsuz değer bilinçli test edildi.');
      await setFile('input[type="file"]');
      await delay(700);
      await screenshot(device, 5, 'Uygunsuz ölçüm girildi; açıklama ve fotoğraf kanıtı eklendi.');
      await clickText('Sonraki');
    }
    await delay(450);
    if (device.name === 'phone') await tapMobileKeys(['2', '0', ',', '0', '1']);
    else await setInput('input[aria-label="Ölçülen değer"]', '20.01');
    await delay(350);
    await screenshot(device, 6, 'İkinci ölçüm uygun değerle girildi; kayıt butonu hazır hale geliyor.');
    if (device.name === 'phone') {
      await click('.mm-actions .mm-primary');
      await delay(700);
      await clickText('Ölçümü tamamla');
    } else {
      await click('#btn-save-inspection-log');
    }
    await delay(900);
    await screenshot(device, 7, 'Ölçüm kaydedildi; uygunsuzluk/PDF aksiyonları görünür.');
  }
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(output, 'README.md'), [
    '# Ölçüm Yaşam Döngüsü Screenshot Seti',
    '',
    'Cihaz grupları: desktop 1440x900, tablet 820x1180, phone 390x844.',
    '',
    ...report.map(item => `- ${item.file}: ${item.description} Scroll: ${item.verticalScroll ? 'var' : 'yok'}, yatay taşma: ${item.horizontalOverflow ? 'var' : 'yok'}.`),
    '',
  ].join('\n'));
  console.log(`PASS: ${report.length} screenshot saved to ${output}`);
} finally {
  socket?.close();
  edge.kill();
  server.close();
}
