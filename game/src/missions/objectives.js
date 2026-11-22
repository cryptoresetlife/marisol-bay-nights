// Mission step types: talk, go to a place (on foot, by car or against the clock), spawn and steal cars, pick
// up and drop off a passenger, raise or lose the wanted level, tail a car unseen, clear out a gang, hold an
// area during a robbery, chase down a getaway car, and hand out rewards.
import { getLandmark, landmarkDoor, landmarkCurb } from '../world/landmarks.js';
import { createVehicle } from '../vehicles/vehicle.js';
import { planRoute, followRoute, scanAhead } from '../vehicles/driver.js';
import { spawnPedestrian } from '../characters/pedestrians.js';
import { LOOKS, randomLook } from '../characters/characterModel.js';
import { spawnGunman } from '../combat/gunmen.js';
import { giveWeapon, WEAPONS } from '../combat/weapons.js';
import { setWantedLevel } from '../police/wanted.js';
import { playDialogue } from '../ui/dialogue.js';
import { showEvent } from '../ui/hud.js';
import { createMarker, removeMarker, moveMarker } from './markers.js';
import { doorPoint, vehicleSpeed } from '../vehicles/vehicle.js';
import { nearestNode } from '../world/roads.js';

export function resolvePoint(spec) {
  if (spec.landmark) {
    const lm = getLandmark(spec.landmark);
    const p = spec.curb ? landmarkCurb(lm) : landmarkDoor(lm);
    const [ox, oz] = spec.offset || [0, 0];
    return { x: p.x + ox, z: p.z + oz };
  }
  return { x: spec.x, z: spec.z };
}

const playerPos = (game) => (game.player.vehicle ? game.player.vehicle.pos : game.player.pos);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function target(game, run, x, z, opts = {}) {
  if (run.state.marker) removeMarker(game, run.state.marker);
  run.state.marker = createMarker(game, x, z, { color: '#ffd23f', radius: opts.radius || 2.6, height: opts.height || 70 });
  game.missionBlips = [{ x, z, glyph: '★', color: '#ffd23f', kind: 'target' }];
}

export const OBJECTIVES = {
  talk: {
    begin(game, run, step) { playDialogue(game, step.lines, () => { run.state.done = true; }, 2); },
    update(game, run) { return run.state.done ? 'done' : null; },
  },

  spawnVehicle: {
    begin(game, run, step) {
      const p = resolvePoint(step.at);
      const v = createVehicle(game, step.vehicle, { x: p.x, z: p.z, yaw: step.yaw || 0, color: step.color, parked: !!step.parked });
      v.mission = true;
      v.noEnter = !!step.noEnter;
      if (step.driver) v.driver = { look: randomLook() };
      run.named[step.name] = v;
      run.spawned.vehicles.push(v);
    },
    update() { return 'done'; },
  },

  enter: {
    begin(game, run, step) { const v = run.named[step.vehicle]; target(game, run, v.pos.x, v.pos.z, { radius: 3, height: 40 }); },
    update(game, run, step) {
      const v = run.named[step.vehicle];
      if (v.destroyed || v.health <= 0) return 'fail:The car was wrecked.';
      moveMarker(run.state.marker, v.pos.x, v.pos.z);
      game.missionBlips = [{ x: v.pos.x, z: v.pos.z, glyph: '★', color: '#ffd23f', kind: 'target' }];
      return game.player.vehicle === v ? 'done' : null;
    },
  },

  pickup: {
    begin(game, run, step) {
      const p = resolvePoint(step.at);
      const ped = spawnPedestrian(game, p.x, p.z, { look: LOOKS[step.look], state: 'scripted' });
      ped.health = 9999;
      run.named[step.name] = ped;
      run.spawned.peds.push(ped);
      target(game, run, p.x, p.z, { radius: 5 });
    },
    update(game, run, step) {
      const ped = run.named[step.name];
      const v = game.player.vehicle;
      if (ped.state === 'scripted' || ped.state === 'idle') {
        if (!v) { run.objective = 'Get a car first, then pick up Lupe'; return null; }
        run.objective = step.text;
        if (Math.hypot(v.pos.x - ped.pos.x, v.pos.z - ped.pos.z) < 11 && vehicleSpeed(v) < 3) {
          ped.state = 'goto';
          ped.target = doorPoint(v, -1);
          ped.runTo = false;
          run.objective = 'Wait for Lupe to get in';
        }
      } else if (ped.state === 'goto') {
        if (!v) { ped.state = 'scripted'; return null; }
        ped.target = doorPoint(v, -1);
        if (Math.hypot(ped.target.x - ped.pos.x, ped.target.z - ped.pos.z) < 1.2) {
          ped.state = 'riding';
          ped.inVehicle = true;
          ped.model.root.visible = false;
          run.companion = ped;
          return 'done';
        }
      }
      return null;
    },
  },

  dropoff: {
    begin(game, run, step) {
      const ped = run.named[step.name];
      const v = game.player.vehicle;
      const door = v ? doorPoint(v, -1) : { x: game.player.pos.x + 1, z: game.player.pos.z };
      ped.pos.set(door.x, ped.pos.y, door.z);
      ped.inVehicle = false;
      ped.model.root.visible = true;
      ped.state = 'goto';
      ped.target = resolvePoint(step.to);
      run.companion = null;
      run.state.t = 0;
    },
    update(game, run, step, dt) { run.state.t += dt; return run.state.t > 1.2 ? 'done' : null; },
  },

  goto: {
    begin(game, run, step) {
      const p = resolvePoint(step.to);
      run.state.p = p;
      run.state.time = step.timeLimit || 0;
      target(game, run, p.x, p.z, { radius: step.radius || (step.inVehicle ? 5 : 2.6) });
    },
    update(game, run, step, dt) {
      const pv = game.player.vehicle;
      if (typeof step.inVehicle === 'string') {
        const need = run.named[step.inVehicle];
        if (need.destroyed || need.health <= 0) return 'fail:The car was wrecked.';
        if (pv !== need) { run.objective = `Get back in the ${need.type.name}`; return null; }
      } else if (step.inVehicle && !pv) { run.objective = 'Get a vehicle'; return null; }
      if (step.onFoot && pv) { run.objective = 'Get out of the car'; return null; }
      run.objective = step.text;
      if (step.timeLimit) {
        run.state.time -= dt;
        run.counter = `Time left ${fmtTime(Math.max(0, run.state.time))}`;
        if (run.state.time <= 0) return 'fail:Out of time.';
      }
      const pos = playerPos(game);
      const r = (step.radius || (step.inVehicle ? 5 : 2.6)) + 0.5;
      return Math.hypot(pos.x - run.state.p.x, pos.z - run.state.p.z) < r ? 'done' : null;
    },
  },

  wanted: {
    begin(game, run, step) { setWantedLevel(game, step.level); if (step.dispatch) game.events.emit('dispatch', { text: step.dispatch }); },
    update() { return 'done'; },
  },

  loseWanted: {
    begin(game, run) { game.missionBlips = []; if (run.state.marker) removeMarker(game, run.state.marker); },
    update(game, run) {
      run.counter = game.wanted.searching ? 'Police are searching...' : 'Police have eyes on you';
      return game.wanted.level === 0 ? 'done' : null;
    },
  },

  give: {
    begin(game, run, step) {
      giveWeapon(game.player, step.weapon, step.ammo);
      game.player.current = step.weapon;
      showEvent(game, `Picked up: ${WEAPONS[step.weapon].name}`, '#ffd166');
    },
    update() { return 'done'; },
  },

  reveal: {
    begin(game) { game.story.revealedHQ = true; showEvent(game, 'Coral Kings Warehouse marked on your map', '#ff5f7a'); },
    update() { return 'done'; },
  },

  follow: {
    begin(game, run, step) {
      const v = run.named[step.vehicle];
      const dest = resolvePoint(step.dest);
      // plan from the intersection ahead of the van so it never starts with a U-turn
      run.state.route = [{ x: v.pos.x + Math.sin(v.yaw) * 12, z: v.pos.z + Math.cos(v.yaw) * 12 }, ...planRoute(game, v.pos.x, v.pos.z, dest.x, dest.z, undefined, v.yaw)];
      run.state.blocked = 0;
      run.state.dest = dest;
      run.state.lost = 0; run.state.close = 0;
      v.ai = { mode: 'mission' };
      if (run.state.marker) removeMarker(game, run.state.marker);
      run.state.marker = createMarker(game, v.pos.x, v.pos.z, { color: '#4fc3ff', radius: 1.6, height: 8 });
    },
    update(game, run, step, dt) {
      const v = run.named[step.vehicle];
      if (v.destroyed || v.attackedByPlayer) return 'fail:They noticed the attack and called it off.';
      const gap = scanAhead(game, v, 12);
      run.state.blocked = gap < 6 ? run.state.blocked + dt : Math.max(0, run.state.blocked - dt);
      // after a few seconds stuck behind something, the driver squeezes past it
      const speed = gap < 10 && run.state.blocked < 3 ? Math.max(0, (gap - 4) * 1.5) : 12;
      if (run.state.blocked > 6) run.state.blocked = 0;
      const left = followRoute(v, run.state.route, speed, 6);
      moveMarker(run.state.marker, v.pos.x, v.pos.z);
      game.missionBlips = [{ x: v.pos.x, z: v.pos.z, glyph: '▲', color: '#4fc3ff', kind: 'target' }];
      const d = Math.hypot(playerPos(game).x - v.pos.x, playerPos(game).z - v.pos.z);
      run.counter = `Distance ${Math.round(d)} m ${d < 18 ? '· TOO CLOSE' : d > 100 ? '· LOSING THEM' : ''}`;
      run.state.lost = d > 115 ? run.state.lost + dt : 0;
      run.state.close = d < 15 ? run.state.close + dt : Math.max(0, run.state.close - dt * 0.5);
      if (run.state.lost > 8) return 'fail:You lost the courier van.';
      if (run.state.close > 3) return 'fail:The driver spotted you.';
      if (run.state.route.length <= 1 && left < 7) { v.controls.throttle = 0; v.controls.handbrake = true; return 'done'; }
      return null;
    },
  },

  killAll: {
    begin(game, run, step) {
      game.missionAllowsGunfire = !!step.allowGunfire;
      run.state.enemies = step.spawns.map((s) => spawnGunman(game, s.x, s.z, { faction: step.faction || 'gang', weapon: s.weapon || 'pistol', health: 100, aggressive: false, accuracy: 0.85 }));
      if (step.boss) {
        const b = spawnGunman(game, step.boss.x, step.boss.z, { faction: 'boss', weapon: 'rifle', health: 520, aggressive: false, name: step.boss.name, accuracy: 1.1 });
        run.state.enemies.push(b);
        run.state.boss = b;
      }
      for (const g of run.state.enemies) { g.mission = true; run.spawned.gunmen.push(g); }
      if (run.state.marker) removeMarker(game, run.state.marker);
      game.missionBlips = [];
    },
    update(game, run, step) {
      const alive = run.state.enemies.filter((g) => !g.dead).length;
      const total = run.state.enemies.length;
      run.counter = `${step.label}: ${total - alive} / ${total}`;
      if (run.state.boss && !run.state.boss.dead) run.counter += ` · ${run.state.boss.name} ${Math.ceil(run.state.boss.health / run.state.boss.maxHealth * 100)}%`;
      const p = playerPos(game);
      for (const g of run.state.enemies) if (!g.alerted && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 40) g.alerted = true;
      return alive === 0 ? 'done' : null;
    },
  },

  hold: {
    begin(game, run, step) {
      const p = resolvePoint(step.at);
      run.state.p = p;
      run.state.left = step.duration;
      game.missionAllowsGunfire = !!step.allowGunfire;
      target(game, run, p.x, p.z, { radius: step.radius, height: 30 });
      if (step.alarm) { setWantedLevel(game, 2); game.events.emit('dispatch', { text: 'Dispatch: silent alarm tripped at Bayfront Savings' }); }
    },
    update(game, run, step, dt) {
      const pos = playerPos(game);
      const inside = Math.hypot(pos.x - run.state.p.x, pos.z - run.state.p.z) < step.radius;
      if (inside) run.state.left -= dt;
      run.objective = inside ? step.text : 'Get back to the lobby!';
      run.counter = `Vault ${Math.min(100, Math.round((1 - run.state.left / step.duration) * 100))}%`;
      return run.state.left <= 0 ? 'done' : null;
    },
  },

  chase: {
    begin(game, run, step) {
      const p = resolvePoint(step.at);
      const v = createVehicle(game, step.vehicle, { x: p.x, z: p.z, yaw: step.yaw || 0, color: step.color });
      v.mission = true; v.noEnter = true;
      v.driver = { look: LOOKS.gang };
      v.health = v.maxHealth = 1400;
      v.ai = { mode: 'mission' };
      run.named[step.name] = v;
      run.spawned.vehicles.push(v);
      run.state.route = [];
      run.state.far = 0;
      if (run.state.marker) removeMarker(game, run.state.marker);
      run.state.marker = createMarker(game, v.pos.x, v.pos.z, { color: '#ff5f7a', radius: 1.6, height: 8 });
    },
    update(game, run, step, dt) {
      const v = run.named[step.name];
      if (v.health <= 0 || v.destroyed) { v.driver = null; return 'done'; }
      if (run.state.route.length <= 1) {
        // flee toward a corner of the city away from Dez
        const p = playerPos(game);
        const nodes = game.city.roads.nodes;
        let best = nodes[0], bd = -1;
        for (let k = 0; k < 6; k++) {
          const n = nodes[Math.floor(Math.random() * nodes.length)];
          const d = Math.hypot(n.x - p.x, n.z - p.z);
          if (d > bd) { bd = d; best = n; }
        }
        run.state.route = planRoute(game, v.pos.x, v.pos.z, best.x, best.z, undefined, v.yaw);
        if (!run.state.route.length) run.state.route = [{ x: nearestNode(game.city.roads, v.pos.x, v.pos.z).x, z: v.pos.z }];
      }
      followRoute(v, run.state.route, 27, 9);
      moveMarker(run.state.marker, v.pos.x, v.pos.z);
      game.missionBlips = [{ x: v.pos.x, z: v.pos.z, glyph: '✖', color: '#ff5f7a', kind: 'target' }];
      run.counter = `Getaway car ${Math.ceil(v.health / v.maxHealth * 100)}%`;
      const d = Math.hypot(playerPos(game).x - v.pos.x, playerPos(game).z - v.pos.z);
      run.state.far = d > 240 ? run.state.far + dt : 0;
      return run.state.far > 6 ? 'fail:Rook got away.' : null;
    },
  },
};

export function cleanupStep(game, run) {
  if (run.state.marker) removeMarker(game, run.state.marker);
  game.missionBlips = [];
  run.counter = '';
}
