// Minimal Chrome DevTools Protocol driver (Node 24, standard library only): launches headless Chrome,
// loads the game, sends real keyboard and mouse input, evaluates expressions, gathers console errors
// and captures JPEG screenshots.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const KEYS = {
  Space: [' ', 32], ShiftLeft: ['Shift', 16], Escape: ['Escape', 27], Enter: ['Enter', 13], Tab: ['Tab', 9],
  ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
  ControlLeft: ['Control', 17], Backspace: ['Backspace', 8],
};
function keyInfo(code) {
  if (KEYS[code]) return KEYS[code];
  if (code.startsWith('Key')) return [code.slice(3).toLowerCase(), code.charCodeAt(3)];
  if (code.startsWith('Digit')) return [code.slice(5), code.charCodeAt(5)];
  return [code, 0];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchBrowser({ port = 9341, width = 1280, height = 720, mode = 'gpu', profile = '.tmp/chrome-profile' } = {}) {
  mkdirSync(profile, { recursive: true });
  const args = [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(profile)}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ];
  if (mode === 'gpu') args.push('--use-angle=d3d11', '--enable-gpu-rasterization');
  else args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  const proc = spawn(CHROME, [...args, 'about:blank'], { stdio: 'ignore' });
  let version = null;
  for (let k = 0; k < 80 && !version; k++) {
    await sleep(150);
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* not up yet */ }
  }
  if (!version) throw new Error('chrome did not start');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
  const errors = [];
  const logs = [];
  on('Runtime.consoleAPICalled', (p) => {
    const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ');
    logs.push(`[${p.type}] ${text}`);
    if (p.type === 'error') errors.push(text);
  });
  on('Runtime.exceptionThrown', (p) => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
  on('Log.entryAdded', (p) => { if (p.entry.level === 'error') errors.push(`log: ${p.entry.text} ${p.entry.url || ''}`); });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const browser = {
    send, on, errors, logs, version,
    async goto(url) {
      const loaded = new Promise((r) => on('Page.loadEventFired', r));
      await send('Page.navigate', { url });
      await loaded;
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async waitFor(expression, timeout = 30000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        try { if (await browser.eval(expression)) return true; } catch { /* page still loading */ }
        await sleep(200);
      }
      throw new Error('timeout waiting for ' + expression);
    },
    async keyDown(code) {
      const [key, vk] = keyInfo(code);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: vk, text: key.length === 1 ? key : undefined });
    },
    async keyUp(code) {
      const [key, vk] = keyInfo(code);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: vk });
    },
    async press(code, hold = 80) { await browser.keyDown(code); await sleep(hold); await browser.keyUp(code); },
    async hold(codes, ms) {
      for (const c of codes) await browser.keyDown(c);
      await sleep(ms);
      for (const c of codes) await browser.keyUp(c);
    },
    async mouse(type, x, y, button = 'left') {
      await send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mouseReleased' ? 0 : (button === 'right' ? 2 : 1), clickCount: 1 });
    },
    async click(x = width / 2, y = height / 2, button = 'left', hold = 60) {
      await browser.mouse('mousePressed', x, y, button);
      await sleep(hold);
      await browser.mouse('mouseReleased', x, y, button);
    },
    async drag(dx, dy, steps = 8, button = 'right') {
      const x0 = width / 2, y0 = height / 2;
      await browser.mouse('mousePressed', x0, y0, button);
      for (let k = 1; k <= steps; k++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (dx * k) / steps, y: y0 + (dy * k) / steps, button, buttons: button === 'right' ? 2 : 1 });
        await sleep(16);
      }
      await browser.mouse('mouseReleased', x0 + dx, y0 + dy, button);
    },
    async screenshot(path, quality = 88) {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
      const buf = Buffer.from(r.data, 'base64');
      writeFileSync(path, buf);
      return buf.length;
    },
    sleep,
    async close() {
      try { await send('Browser.close'); } catch { /* already gone */ }
      ws.close();
      setTimeout(() => { try { proc.kill(); } catch { /* exited */ } }, 500);
    },
  };
  return browser;
}
