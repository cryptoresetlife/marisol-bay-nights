// Captures the entry's screenshots from real game renders, using the scene presets listed in shots.json.
// Each shot is 1280x720 JPEG, re-encoded at lower quality until it fits the 256 KiB cap.
//   node tools/screenshots.mjs [onlyName]
import { readFileSync, mkdirSync } from 'node:fs';
import { launchBrowser } from './cdp.mjs';

const port = Number(process.env.GAME_PORT || 8737);
const shots = JSON.parse(readFileSync('shots.json', 'utf8'));
const only = process.argv[2];
const outDir = process.env.SHOT_DIR || 'screenshots';
mkdirSync(outDir, { recursive: true });
const b = await launchBrowser({ profile: '.tmp/chrome-shots' });
try {
  for (const s of shots) {
    if (only && !s.name.includes(only)) continue;
    await b.goto(`http://127.0.0.1:${port}/index.html${s.query}`);
    await b.waitFor('window.__game && window.__game.ready', 60000);
    await b.sleep(s.wait || 3500);
    let q = 90, bytes = Infinity;
    while (q >= 50) {
      bytes = await b.screenshot(`${outDir}/${s.name}`, q);
      if (bytes <= 250 * 1024) break;
      q -= 5;
    }
    console.log(s.name, `${Math.round(bytes / 1024)} KiB at q${q}`, await b.eval('JSON.stringify(window.__game.debugInfo())'));
  }
} finally {
  console.log('errors:', b.errors.length ? b.errors.slice(0, 10).join('\n') : 'none');
  await b.close();
}
