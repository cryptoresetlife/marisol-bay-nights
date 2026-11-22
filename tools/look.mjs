// Loads the game with a query string, waits, optionally runs an expression, and saves a screenshot.
//   node tools/look.mjs "?scene=chase" .tmp/chase.jpg 4000 [--swift] [--eval "expr"]
import { launchBrowser } from './cdp.mjs';

const [query = '', out = '.tmp/look.jpg', wait = '4000', ...rest] = process.argv.slice(2);
const swift = rest.includes('--swift');
const evalIdx = rest.indexOf('--eval');
const expr = evalIdx >= 0 ? rest[evalIdx + 1] : null;
const port = Number(process.env.GAME_PORT || 8737);

const browser = await launchBrowser({ mode: swift ? 'swift' : 'gpu' });
try {
  await browser.goto(`http://127.0.0.1:${port}/index.html${query}`);
  await browser.waitFor('window.__game && window.__game.ready', 60000);
  if (expr) console.log('eval:', JSON.stringify(await browser.eval(expr)));
  await browser.sleep(Number(wait));
  const info = await browser.eval('JSON.stringify(window.__game.debugInfo ? window.__game.debugInfo() : {})');
  console.log('info:', info);
  const bytes = await browser.screenshot(out);
  console.log('saved', out, bytes, 'bytes');
} finally {
  console.log('errors:', browser.errors.length ? browser.errors.slice(0, 12).join('\n') : 'none');
  await browser.close();
}
