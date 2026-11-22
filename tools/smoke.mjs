// Quick play session: walk, steal the nearest car, drive, and save screenshots along the way.
//   node tools/smoke.mjs [query]
import { launchBrowser } from './cdp.mjs';

const query = process.argv[2] || '';
const port = Number(process.env.GAME_PORT || 8737);
const b = await launchBrowser({ mode: process.argv.includes('--swift') ? 'swift' : 'gpu' });
const info = async (label) => console.log(label, await b.eval('JSON.stringify(window.__game.debugInfo())'));
try {
  await b.goto(`http://127.0.0.1:${port}/index.html${query}`);
  await b.waitFor('window.__game && window.__game.ready', 60000);
  await b.eval('window.__game.startForTest && window.__game.startForTest()');
  await b.sleep(2500);
  await info('start');
  await b.screenshot('.tmp/s1.jpg');
  await b.hold(['KeyW'], 1500);
  await info('walked');
  await b.screenshot('.tmp/s2.jpg');
  // walk to the closest car and take it
  const near = await b.eval(`(() => { const g = window.__game; let best = null, bd = 1e9;
    for (const v of g.vehicles) { const d = Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z); if (d < bd) { bd = d; best = v; } }
    if (!best) return 'none';
    g.player.pos.set(best.pos.x + 2.6 * Math.cos(best.yaw), 0, best.pos.z - 2.6 * Math.sin(best.yaw));
    return best.type.name + ' driver=' + (best.driver ? 'npc' : 'none') + ' d=' + bd.toFixed(1); })()`);
  console.log('nearest car:', near);
  await b.sleep(300);
  await b.press('KeyF');
  await b.sleep(800);
  await info('after F');
  await b.hold(['KeyW'], 2500);
  await b.screenshot('.tmp/s3.jpg');
  await b.hold(['KeyW', 'KeyD'], 900);
  await b.hold(['KeyW'], 1500);
  await info('drove');
  await b.screenshot('.tmp/s4.jpg');
} finally {
  console.log('errors:', b.errors.length ? b.errors.slice(0, 15).join('\n') : 'none');
  await b.close();
}
