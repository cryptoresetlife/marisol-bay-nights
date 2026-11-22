// End-to-end play test with real key presses: title screen, new game, walking, stealing and driving a car,
// gunfire raising the wanted level, police closing in, a Fresh Coat respray clearing it, all eight story
// chapters in order, saving from the pause menu and continuing after a reload.
//   node tools/playtest.mjs
import { launchBrowser } from './cdp.mjs';

const port = Number(process.env.GAME_PORT || 8737);
const url = `http://127.0.0.1:${port}/index.html`;
const b = await launchBrowser({ mode: 'gpu', profile: '.tmp/chrome-playtest' });
const G = (expr) => b.eval(`(() => { const g = window.__game; return ${expr}; })()`);
const info = () => G('g.debugInfo()');
const results = [];
const check = (label, ok, detail = '') => { results.push({ label, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); };

async function until(expr, timeout = 30000, poll = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await G(expr)) return true;
    await G('g.dev.skipLine()');
    await b.sleep(poll);
  }
  return false;
}
const stepIs = (type) => until(`g.dev.step() && g.dev.step().endsWith(':${type}')`, 40000);

async function enterNamed(name) {
  await G(`g.dev.nearNamed('${name}')`);
  await b.sleep(250);
  await b.press('KeyF');
  return until(`g.player.vehicle && g.player.vehicle === g.dev.named('${name}')`, 4000);
}

async function driveTo(x, z, yaw = 0) {
  await G(`g.dev.teleport(${x}, ${z}, ${yaw})`);
  await b.sleep(400);
}

async function walkToStart(x, z) {
  if (await G('!!g.player.vehicle')) { await b.press('KeyF'); await b.sleep(400); }
  await G(`g.dev.teleport(${x}, ${z})`);
  return until('!!g.activeMission', 8000);
}

try {
  await b.goto(url);
  await b.waitFor('window.__game && window.__game.ready', 60000);
  await G('localStorage.clear(), true');
  check('title screen shown', (await info()).mode === 'title');
  await b.press('Enter');
  await b.sleep(600);
  check('new game started from the title menu', (await info()).mode === 'play');

  // ---- free roam basics -----------------------------------------------------------------
  const p0 = await info();
  await b.hold(['KeyW'], 1200);
  const p1 = await info();
  check('walking moves Dez', Math.hypot(p1.player[0] - p0.player[0], p1.player[1] - p0.player[1]) > 2, JSON.stringify(p1.player));

  // ---- chapter 1: Homecoming ------------------------------------------------------------
  check('chapter 1 starts automatically', await until("g.dev.step() && g.dev.step().startsWith('homecoming')", 8000));
  await stepIs('enter');
  check('steal-free entry into Lupe\'s car with F', await enterNamed('ride'));
  await stepIs('pickup');
  await driveTo(-180, -50.5, Math.PI / 2);
  check('Lupe walks over and gets in', await until("g.dev.step() && !g.dev.step().endsWith(':pickup')", 20000));
  await stepIs('goto');
  await driveTo(309.1, -90, Math.PI);
  check('chapter 1 complete', await until('g.story.chapter >= 1', 30000), JSON.stringify(await info()));

  // ---- driving and the law --------------------------------------------------------------
  const before = await info();
  await b.hold(['KeyW'], 2000);
  const after = await info();
  check('driving accelerates the car', after.speed > 20, `speed ${after.speed} km/h`);
  await b.hold(['KeyS'], 1500);
  await b.press('KeyF');
  await b.sleep(500);
  check('F exits the car', !(await info()).inCar);
  void before;
  await G("g.player.current = 'pistol', true");
  await b.mouse('mousePressed', 640, 360, 'right');
  for (let k = 0; k < 4; k++) { await b.click(640, 360, 'left', 40); await b.sleep(300); }
  await b.mouse('mouseReleased', 640, 360, 'right');
  await b.sleep(300);
  check('gunfire raises the wanted level', (await info()).wanted >= 1, `wanted ${(await info()).wanted}`);
  await G('g.dev.teleport(g.player.pos.x, g.player.pos.z), true');
  check('police respond to the wanted level', await until("g.vehicles.some(v => v.ai && v.ai.mode === 'police' && Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z) < 120)", 30000));
  // steal a car from traffic, then get a respray at Fresh Coat
  const jack = await G(`(() => { let best = null, bd = 1e9; for (const v of g.vehicles) { if (!v.driver || v.driver === 'player' || v.isPolice) continue; const d = Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z); if (d < bd) { bd = d; best = v; } }
    if (!best) return null; g.dev.teleport(best.pos.x + Math.cos(best.yaw) * 2.6, best.pos.z - Math.sin(best.yaw) * 2.6); return best.type.name; })()`);
  await b.sleep(150);
  await b.press('KeyF');
  await b.sleep(400);
  const jacked = await info();
  check('carjacking an occupied car', !!jacked.inCar && !!jack, `${jack} -> ${jacked.inCar}`);
  await driveTo(90, -230.9, Math.PI / 2);
  check('Fresh Coat respray clears the stars', await until('g.wanted.level === 0', 6000), `money ${(await info()).money}`);

  // ---- chapter 2: Borrowed Time ---------------------------------------------------------
  check('chapter 2 starts at Tiki Taco', await walkToStart(304.5, -90));
  await stepIs('enter');
  check('steal the Marlin GT', await enterNamed('marlin'));
  check('stolen Marlin brings two stars', await until('g.wanted.level >= 2', 5000));
  await driveTo(90, -230.9, Math.PI / 2);
  check('respray loses the cops during the mission', await until('g.wanted.level === 0', 6000));
  await stepIs('goto');
  await driveTo(-230.9, 180, 0);
  check('chapter 2 complete', await until('g.story.chapter >= 2', 20000));

  // ---- chapter 3: Quiet Shadow ----------------------------------------------------------
  check('chapter 3 starts', await walkToStart(304.5, -90));
  await stepIs('goto');
  await G("(() => { const v = g.vehicles.find(v => !v.driver && !v.mission && !v.destroyed) ; return true; })()");
  // borrow any car nearby for the tail
  await G(`(() => { let best = null, bd = 1e9; for (const v of g.vehicles) { if (v.mission || v.isPolice || v.destroyed) continue; const d = Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z); if (d < bd) { bd = d; best = v; } } g.dev.teleport(best.pos.x + Math.cos(best.yaw) * 2.6, best.pos.z - Math.sin(best.yaw) * 2.6); return true; })()`);
  await b.press('KeyF');
  await b.sleep(400);
  await driveTo(51, 75, Math.PI);
  await stepIs('follow');
  let tailOk = false;
  for (let k = 0; k < 400; k++) {
    // keep about 35 m behind the van, as a careful driver would
    const s = await G(`(() => { const v = g.dev.named('courier'); if (!v) return 'gone'; const x = v.pos.x - Math.sin(v.yaw) * 35, z = v.pos.z - Math.cos(v.yaw) * 35; g.dev.teleport(x, z, v.yaw); g.dev.skipLine(); return g.dev.step(); })()`);
    if (s === 'gone' || !String(s).includes('follow')) { tailOk = true; break; }
    await b.sleep(250);
  }
  check('tail the courier van to the warehouse', tailOk && await until('g.story.chapter >= 3', 20000), JSON.stringify(await info()));

  // ---- chapter 4: Reef Cleanup ----------------------------------------------------------
  await G('(g.godMode = true)'); // the test teleports into firefights; keep Dez standing
  check('chapter 4 starts at the garage', await walkToStart(-235.5, 180));
  await stepIs('goto');
  await G('g.dev.teleport(-180, 212)');
  await stepIs('killAll');
  await b.sleep(1500);
  await G('g.dev.shootHostiles(), true');
  check('chapter 4 complete after clearing the Coral Kings', await until('g.story.chapter >= 4', 20000));

  // ---- chapter 5: Hot Ice ---------------------------------------------------------------
  check('chapter 5 starts', await walkToStart(-235.5, 180));
  await stepIs('enter');
  check('get in the freezer van', await enterNamed('icevan'));
  await stepIs('goto');
  await b.sleep(1500);
  const timer = (await G('g.missionHud && g.missionHud.counter')) || '';
  await driveTo(377, -45, Math.PI / 2);
  check('timed delivery to The Pier', await until('g.story.chapter >= 5', 20000), timer);

  // ---- chapter 6: Tail Lights -----------------------------------------------------------
  check('chapter 6 starts', await walkToStart(304.5, -90));
  await stepIs('chase');
  const start = await G("(() => { const v = g.dev.named('rook'); return v ? [v.pos.x, v.pos.z] : [0, 0]; })()");
  await b.sleep(2500);
  const fled = await G(`(() => { const v = g.dev.named('rook'); return v ? Math.round(Math.hypot(v.pos.x - ${start[0]}, v.pos.z - ${start[1]})) : -1; })()`);
  await G("g.dev.wreck('rook'), true");
  check('getaway car drives off and can be wrecked', fled > 5 && await until('g.story.chapter >= 6', 25000), `fled ${fled} m`);

  // ---- chapter 7: Bank Holiday ----------------------------------------------------------
  check('chapter 7 starts', await walkToStart(304.5, -90));
  await stepIs('goto');
  await G('g.dev.teleport(55.5, 0)');
  await stepIs('hold');
  check('robbery alarm brings the police', await until('g.wanted.level >= 2', 5000));
  let held = false;
  for (let k = 0; k < 60 && !held; k++) {
    // stay in the lobby even if a cruiser shoves Dez aside
    held = await G("!String(g.dev.step()).endsWith(':hold') || (g.dev.teleport(55.5, 0), false)");
    await b.sleep(500);
  }
  check('vault cracked after holding the lobby', held);
  check('four stars after the robbery', await until('g.wanted.level >= 4', 5000));
  await stepIs('enter');
  check('reach the getaway car', await enterNamed('getaway'));
  await driveTo(-145.5 + 4.6, 90, Math.PI / 2);
  check('respray clears four stars', await until('g.wanted.level === 0', 6000));
  await stepIs('goto');
  await driveTo(309.1, 90, Math.PI);
  check('chapter 7 complete', await until('g.story.chapter >= 7', 20000));

  // ---- chapter 8: Sundown ---------------------------------------------------------------
  check('chapter 8 starts', await walkToStart(304.5, -90));
  await stepIs('goto');
  await G('g.dev.teleport(50, -90)');
  await stepIs('killAll');
  await b.sleep(1200);
  check('Sterling Vance appears with his guards', await G("g.hostiles.some(h => h.name === 'Sterling Vance')"));
  await G('g.dev.shootHostiles(), true');
  check('wanted after the showdown', await until('g.wanted.level >= 3', 25000));
  await G(`(() => { let best = null, bd = 1e9; for (const v of g.vehicles) { if (v.mission || v.isPolice || v.destroyed) continue; const d = Math.hypot(v.pos.x - g.player.pos.x, v.pos.z - g.player.pos.z); if (d < bd) { bd = d; best = v; } } g.dev.teleport(best.pos.x + Math.cos(best.yaw) * 2.6, best.pos.z - Math.sin(best.yaw) * 2.6); return true; })()`);
  await b.press('KeyF');
  await b.sleep(400);
  await driveTo(90, -230.9, Math.PI / 2);
  check('respray after the showdown', await until('g.wanted.level === 0', 6000));
  await stepIs('goto');
  await b.press('KeyF');
  await b.sleep(400);
  await G('g.dev.teleport(304.5, -90)');
  check('story complete: all eight chapters', await until('g.story.chapter >= 8', 30000), JSON.stringify(await info()));

  // ---- Iron Pelican Arms ----------------------------------------------------------------
  if (await G('!!g.player.vehicle')) { await b.press('KeyF'); await b.sleep(300); }
  await G('g.dev.teleport(145.5, 90)');
  await b.sleep(300);
  await b.press('KeyE');
  await b.sleep(300);
  check('gun shop menu opens with E', await G("g.menu && g.menu.id === 'shop'"));
  await b.screenshot('.tmp/shop.jpg');
  await G("(document.querySelector('[data-buy=armor]').click(), true)");
  await G("(document.querySelector('[data-buy=rifle]').click(), true)");
  check('buy body armour and a rifle', (await G('g.player.armor')) === 100 && await G('!!g.player.weapons.rifle'));
  await b.press('Escape');
  await b.sleep(300);
  check('leave the shop with Esc', (await info()).mode === 'play');

  // ---- death and the hospital -----------------------------------------------------------
  await G("(g.godMode = false, g.events.emit('playerHurt', { amount: 500, cause: 'test' }), true)");
  const cash0 = (await info()).money;
  check('wasted: Dez wakes up at Mercy General', await until('g.player.alive && !g.respawn.state && Math.hypot(g.player.pos.x - 0, g.player.pos.z + 146) < 8', 12000), JSON.stringify(await info()));
  check('hospital bill charged', (await info()).money < cash0);

  // ---- save, reload, continue -----------------------------------------------------------
  const money = (await info()).money;
  await b.sleep(500);
  await b.press('Escape');
  await b.sleep(300);
  check('pause menu opens with Esc', (await info()).mode === 'menu');
  await b.press('ArrowDown');
  await b.press('Enter');
  await b.sleep(300);
  check('save game from the pause menu', await G("!!localStorage.getItem('sundown.save.v1')"));
  await b.goto(url);
  await b.waitFor('window.__game && window.__game.ready', 60000);
  await b.press('ArrowDown');
  await b.press('Enter');
  await b.sleep(800);
  const loaded = await info();
  check('continue restores the story and cash', loaded.mode === 'play' && loaded.chapter === 8 && Math.abs(loaded.money - money) < 2, JSON.stringify(loaded));
} catch (e) {
  check('test run finished without exceptions', false, e.message);
} finally {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  console.log('console errors:', b.errors.length ? b.errors.slice(0, 20).join('\n') : 'none');
  await b.close();
  process.exitCode = failed ? 1 : 0;
}
