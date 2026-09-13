import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = resolve('marketing/screenshots');
const profileDir = resolve(tmpdir(), 'ritim-quality-edge-promo-profile');
const debugPort = 9222;

await mkdir(outputDir, { recursive: true });

const edge = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--disable-gpu',
  '--no-proxy-server',
  '--hide-scrollbars',
  '--no-first-run',
  '--window-size=1600,1000',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function getTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json());
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      // Edge is still starting.
    }
    await delay(250);
  }
  throw new Error('Edge debugging endpoint did not become ready.');
}

const target = await getTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', rejectOpen, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, rejectCommand) => pending.set(id, { resolve: resolveCommand, reject: rejectCommand }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  return result.result?.value;
}

async function screenshot(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(resolve(outputDir, name), Buffer.from(result.data, 'base64'));
}

try {
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const navigation = await command('Page.navigate', { url: 'http://127.0.0.1:3000' });
  await delay(3000);
  const pageState = await evaluate(`({ href: location.href, title: document.title, text: document.body?.innerText?.slice(0, 120) })`);
  console.log('Page state:', pageState, navigation);

  const loginResult = await evaluate(`(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace: 'demirhan-demo', email: 'serkan@demirhanmakina.com', password: '9999' })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Login failed');
    localStorage.setItem('qualitrack_access_token', body.token);
    return true;
  })()`);
  if (!loginResult) throw new Error('Login did not complete.');

  await command('Page.reload', { ignoreCache: true });
  await delay(3000);
  await evaluate(`(() => {
    const productSelect = [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'prod-001'));
    if (!productSelect) return false;
    productSelect.value = 'prod-001';
    productSelect.dispatchEvent(new Event('change', { bubbles: true }));
    window.scrollTo(0, 0);
    return true;
  })()`);
  await delay(1800);
  await evaluate(`document.querySelector('#btn-start-inspection')?.click()`);
  await delay(2200);
  await evaluate(`[document.scrollingElement, ...document.querySelectorAll('*')].forEach((element) => { if (element) element.scrollTop = 0; })`);
  await screenshot('01-olcum-istasyonu.png');

  await evaluate(`document.querySelector('#nav-tab-control-plans')?.click()`);
  await delay(2600);
  await evaluate(`[document.scrollingElement, ...document.querySelectorAll('*')].forEach((element) => { if (element) element.scrollTop = 0; })`);
  await screenshot('02-kontrol-planlari.png');

  await evaluate(`document.querySelector('#nav-tab-spc')?.click()`);
  await delay(1800);
  await evaluate(`(() => {
    const productSelect = [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'prod-001'));
    if (!productSelect) return false;
    productSelect.value = 'prod-001';
    productSelect.dispatchEvent(new Event('change', { bubbles: true }));
    window.scrollTo(0, 0);
    return true;
  })()`);
  await delay(1800);
  await evaluate(`(() => {
    const characteristicSelect = [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'char-102'));
    if (characteristicSelect) {
      characteristicSelect.value = 'char-102';
      characteristicSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return Boolean(characteristicSelect);
  })()`);
  await delay(2600);
  await evaluate(`(() => {
    [document.scrollingElement, ...document.querySelectorAll('*')].forEach((element) => { if (element) element.scrollTop = 0; });
    const aside = document.querySelector('aside');
    aside?.firstElementChild?.scrollIntoView({ block: 'start' });
    window.scrollTo(0, 0);
  })()`);
  await screenshot('03-spc-analizi.png');
} finally {
  socket.close();
  edge.kill();
}

console.log(`Screenshots saved to ${outputDir}`);
