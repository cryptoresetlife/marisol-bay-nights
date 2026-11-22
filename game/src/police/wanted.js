// The wanted level: crimes add heat and stars (one to five), police eyes keep it alive, and slipping out of
// sight makes the stars flash and fall away one at a time.
import { hasLineOfSight } from '../systems/collisions.js';
import { streetNameAt } from '../world/districts.js';

const CRIMES = {
  gunfire: { heat: 0.08, min: 1 },
  assault: { heat: 0.3, min: 1 },
  hitPed: { heat: 0.35, min: 1 },
  killPed: { heat: 0.6, min: 1 },
  carjack: { heat: 0.45, min: 1 },
  stealPolice: { heat: 1, min: 2 },
  shootPoliceCar: { heat: 0.25, min: 2 },
  assaultCop: { heat: 0.7, min: 2 },
  killCop: { heat: 1.1, min: 3 },
  ramPolice: { heat: 0.35, min: 1 },
  explosion: { heat: 0.9, min: 2 },
};

export function createWanted() {
  return { level: 0, heat: 0, seen: false, unseen: 0, searching: false, lastSeenAt: { x: 0, z: 0 }, peak: 0 };
}

export function reportCrime(game, kind, x, z) {
  const w = game.wanted;
  const c = CRIMES[kind];
  if (!c || game.noCrimes) return;
  const before = w.level;
  w.heat += c.heat;
  while (w.heat >= 1 && w.level < 5) { w.heat -= 1; w.level += 1; }
  if (w.level < c.min) w.level = c.min;
  if (w.level >= 5) w.heat = Math.min(w.heat, 0.99);
  w.lastSeenAt = { x, z };
  if (w.level > 0 && (w.seen || before === 0)) w.unseen = 0;
  if (w.level !== before) onLevelChange(game, before);
}

export function setWantedLevel(game, level) {
  const before = game.wanted.level;
  game.wanted.level = Math.max(0, Math.min(5, level));
  game.wanted.heat = 0;
  game.wanted.unseen = 0;
  if (before !== game.wanted.level) onLevelChange(game, before);
}

export function clearWanted(game) {
  setWantedLevel(game, 0);
}

function onLevelChange(game, before) {
  const w = game.wanted;
  w.peak = Math.max(w.peak, w.level);
  game.events.emit('wantedChanged', { level: w.level, before });
  const p = game.player.pos;
  if (w.level > before) {
    const street = streetNameAt(p.x, p.z);
    const lines = [
      '',
      `Dispatch: units respond, disturbance on ${street}`,
      `Dispatch: suspect armed and dangerous near ${street}`,
      `Dispatch: all units converge on ${street}, roadblocks authorized`,
      'Dispatch: air support en route, Eagle One lifting off',
      'Dispatch: tactical teams deployed, lethal force authorized',
    ];
    game.events.emit('dispatch', { text: lines[w.level] });
  } else if (w.level === 0 && before > 0) {
    game.events.emit('dispatch', { text: 'Dispatch: suspect lost, all units resume patrol' });
  }
}

// Called every frame: is any officer, cruiser or helicopter looking at Dez?
export function updateWantedLevel(game, dt) {
  const w = game.wanted;
  if (w.level === 0) { w.searching = false; return; }
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  let seen = false;
  const sees = (x, y, z, range) => Math.hypot(x - p.x, z - p.z) < range && hasLineOfSight(game.city.collisions, x, y, z, p.x, p.y + 1.2, p.z);
  for (const v of game.vehicles) {
    if (seen) break;
    if (v.ai?.mode === 'police' && !v.destroyed && v.driver) seen = sees(v.pos.x, v.pos.y + 1.4, v.pos.z, 85);
  }
  if (!seen) for (const g of game.hostiles) {
    if ((g.faction === 'police' || g.faction === 'swat') && !g.dead && g.seesPlayer) { seen = true; break; }
  }
  if (!seen && game.police.heli && Math.hypot(game.police.heli.pos.x - p.x, game.police.heli.pos.z - p.z) < 70) seen = true;
  w.seen = seen;
  if (seen) {
    w.unseen = 0;
    w.lastSeenAt = { x: p.x, z: p.z };
  } else {
    w.unseen += dt;
  }
  w.searching = w.unseen > 2.5;
  const loseAfter = 7 + w.level * 3.5;
  if (w.unseen > loseAfter) {
    const before = w.level;
    w.level -= 1;
    w.heat = 0;
    w.unseen = 2.5;
    onLevelChange(game, before);
  }
}
