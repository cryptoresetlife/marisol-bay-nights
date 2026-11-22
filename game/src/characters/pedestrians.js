// Pedestrians: locals strolling the sidewalk loops around each block, crossing at the zebras, beachgoers on
// the promenade, people who scatter from gunfire and speeding cars, and bodies knocked down in the street.
import * as THREE from 'three';
import { buildCharacterModel, animateCharacter, randomLook } from './characterModel.js';
import { GRID } from '../world/roads.js';
import { blockRect } from '../world/landmarks.js';
import { groundHeight, BEACH_START_X } from '../world/terrain.js';
import { resolveCircle } from '../systems/collisions.js';
import { wrapAngle } from '../core/rng.js';

const WALK = 1.45, RUN = 5.6, SIDEWALK = 10.5;
const MAX_PEDS = 42;
// From each block corner (NW, NE, SE, SW) the zebras lead to: [block step x, block step z, corner reached].
const CROSSINGS = [
  [[0, -1, 3], [-1, 0, 1]],
  [[0, -1, 2], [1, 0, 0]],
  [[0, 1, 1], [1, 0, 3]],
  [[0, 1, 0], [-1, 0, 2]],
];

function cornerOf(bi, bj, k) {
  const r = blockRect(bi, bj);
  const xs = [r.x0 + SIDEWALK, r.x1 - SIDEWALK, r.x1 - SIDEWALK, r.x0 + SIDEWALK];
  const zs = [r.z0 + SIDEWALK, r.z0 + SIDEWALK, r.z1 - SIDEWALK, r.z1 - SIDEWALK];
  return { x: xs[k], z: zs[k] };
}

export function spawnPedestrian(game, x, z, { look = null, state = 'walk', loop = null } = {}) {
  const model = buildCharacterModel(look || randomLook());
  game.engine.scene.add(model.root);
  const ped = {
    kind: 'ped', model, pos: new THREE.Vector3(x, groundHeight(x, z), z), yaw: Math.random() * 6,
    speed: 0, state, loop, target: null, health: 45, down: false, downTimer: 0, dead: false,
    fleeFrom: null, fleeTimer: 0, vel: new THREE.Vector3(), radius: 0.32, idleTimer: 0,
  };
  if (loop) ped.target = cornerOf(loop.bi, loop.bj, loop.corner);
  game.peds.push(ped);
  return ped;
}

export function removePedestrian(game, ped) {
  game.engine.scene.remove(ped.model.root);
  const i = game.peds.indexOf(ped);
  if (i >= 0) game.peds.splice(i, 1);
  ped.removed = true;
}

export function spawnPedestrians(game, count) {
  const p = game.player.pos;
  for (let n = 0; n < count; n++) {
    if (p.x > BEACH_START_X - 30 && Math.random() < 0.5) { spawnBeachgoer(game); continue; }
    const bi = Math.max(0, Math.min(GRID.count - 2, Math.floor((p.x - GRID.origin) / GRID.pitch) + Math.floor(Math.random() * 5) - 2));
    const bj = Math.max(0, Math.min(GRID.count - 2, Math.floor((p.z - GRID.origin) / GRID.pitch) + Math.floor(Math.random() * 5) - 2));
    const corner = Math.floor(Math.random() * 4);
    const a = cornerOf(bi, bj, corner), b = cornerOf(bi, bj, (corner + 1) % 4);
    const t = Math.random();
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    if (Math.hypot(x - p.x, z - p.z) < 25) continue;
    spawnPedestrian(game, x, z, { loop: { bi, bj, corner: (corner + 1) % 4, cw: true } });
  }
}

function spawnBeachgoer(game) {
  const p = game.player.pos;
  const z = p.z + (Math.random() - 0.5) * 200;
  const onSand = Math.random() < 0.5;
  const x = onSand ? 340 + Math.random() * 40 : BEACH_START_X + 3.5;
  const ped = spawnPedestrian(game, x, z, { state: onSand ? 'idle' : 'stroll' });
  ped.strollDir = Math.random() < 0.5 ? 1 : -1;
  ped.yaw = onSand ? Math.random() * 6 : (ped.strollDir > 0 ? 0 : Math.PI);
}

export function knockDownPedestrian(game, ped, damage, fromX, fromZ, cause = 'hit') {
  if (ped.dead) return;
  ped.health -= damage;
  const dx = ped.pos.x - fromX, dz = ped.pos.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  ped.vel.set((dx / d) * Math.min(12, damage * 0.25), 0, (dz / d) * Math.min(12, damage * 0.25));
  ped.down = true;
  ped.downTimer = 3 + Math.random() * 2;
  if (ped.health <= 0) { ped.dead = true; ped.downTimer = 30; game.events.emit('pedKilled', { ped, cause }); }
  else game.events.emit('pedHurt', { ped, cause });
}

export function scarePedestrians(game, x, z, radius) {
  for (const ped of game.peds) {
    if (ped.down || ped.state === 'scripted') continue;
    if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) {
      ped.state = 'flee';
      ped.fleeFrom = { x, z };
      ped.fleeTimer = 7 + Math.random() * 5;
      if (Math.random() < 0.3) game.events.emit('scream', { x: ped.pos.x, z: ped.pos.z });
    }
  }
}

function stepToward(ped, tx, tz, speed, dt) {
  const dx = tx - ped.pos.x, dz = tz - ped.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return 0;
  const want = Math.atan2(dx, dz);
  ped.yaw += wrapAngle(want - ped.yaw) * Math.min(1, dt * 8);
  const s = Math.min(speed, d / dt);
  ped.pos.x += Math.sin(ped.yaw) * s * dt;
  ped.pos.z += Math.cos(ped.yaw) * s * dt;
  ped.speed = s;
  return d;
}

function walkLoop(ped, dt) {
  const L = ped.loop;
  const d = stepToward(ped, ped.target.x, ped.target.z, WALK, dt);
  if (d > 0.6) return;
  if (ped.crossing) {
    ped.crossing = false;
  } else if (Math.random() < 0.3) {
    // cross the street to the neighbouring block, continuing the loop over there
    const [di, dj, corner] = CROSSINGS[L.corner][Math.floor(Math.random() * 2)];
    const ni = L.bi + di, nj = L.bj + dj;
    if (ni >= 0 && nj >= 0 && ni < GRID.count - 1 && nj < GRID.count - 1) {
      L.bi = ni; L.bj = nj; L.corner = corner;
      ped.target = cornerOf(L.bi, L.bj, L.corner);
      ped.crossing = true;
      return;
    }
  }
  L.corner = (L.corner + (L.cw ? 1 : 3)) % 4;
  ped.target = cornerOf(L.bi, L.bj, L.corner);
}

export function updatePedestrians(game, dt) {
  const p = game.player.pos;
  for (let i = game.peds.length - 1; i >= 0; i--) {
    const ped = game.peds[i];
    const dist = Math.hypot(ped.pos.x - p.x, ped.pos.z - p.z);
    if (dist > 170 && ped.state !== 'scripted') { removePedestrian(game, ped); continue; }
    ped.speed = 0;
    if (ped.down) {
      ped.pos.x += ped.vel.x * dt; ped.pos.z += ped.vel.z * dt;
      ped.vel.multiplyScalar(Math.max(0, 1 - dt * 4));
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        if (ped.dead) { removePedestrian(game, ped); continue; }
        ped.down = false;
        ped.state = 'flee';
        ped.fleeFrom = { x: p.x, z: p.z };
        ped.fleeTimer = 8;
      }
    } else if (ped.state === 'flee') {
      const fx = ped.pos.x - ped.fleeFrom.x, fz = ped.pos.z - ped.fleeFrom.z;
      const d = Math.hypot(fx, fz) || 1;
      stepToward(ped, ped.pos.x + (fx / d) * 5, ped.pos.z + (fz / d) * 5, RUN, dt);
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) resumeWalking(ped);
    } else if (ped.state === 'walk' && ped.loop) {
      walkLoop(ped, dt);
    } else if (ped.state === 'stroll') {
      ped.pos.z += ped.strollDir * WALK * dt;
      ped.yaw = ped.strollDir > 0 ? 0 : Math.PI;
      ped.speed = WALK;
      if (Math.abs(ped.pos.z - p.z) > 120) ped.strollDir *= -1;
    } else if (ped.state === 'goto' && ped.target) {
      const d = stepToward(ped, ped.target.x, ped.target.z, ped.runTo ? RUN : WALK * 1.4, dt);
      if (d < 0.8) { ped.state = 'idle'; if (ped.onArrive) ped.onArrive(); }
    }
    resolveCircle(game.city.collisions, ped.pos, ped.radius, 0.5);
    ped.pos.y = groundHeight(ped.pos.x, ped.pos.z);
    ped.model.root.position.copy(ped.pos);
    ped.model.root.rotation.y = ped.yaw;
    if (dist < 120) animateCharacter(ped.model, { speed: ped.speed, down: ped.down }, dt);
  }
  const want = Math.round(MAX_PEDS * game.settings.pedDensity);
  if (game.peds.length < want) spawnPedestrians(game, 2);
}

function resumeWalking(ped) {
  ped.state = 'walk';
  const bi = Math.max(0, Math.min(GRID.count - 2, Math.floor((ped.pos.x - GRID.origin) / GRID.pitch)));
  const bj = Math.max(0, Math.min(GRID.count - 2, Math.floor((ped.pos.z - GRID.origin) / GRID.pitch)));
  let best = 0, bd = Infinity;
  for (let k = 0; k < 4; k++) {
    const c = cornerOf(bi, bj, k);
    const d = Math.hypot(c.x - ped.pos.x, c.z - ped.pos.z);
    if (d < bd) { bd = d; best = k; }
  }
  ped.loop = { bi, bj, corner: best, cw: Math.random() < 0.5 };
  ped.target = cornerOf(bi, bj, best);
}

// Speeding cars knock people over.
export function hitPedestriansWithVehicles(game) {
  for (const v of game.vehicles) {
    const speed = Math.hypot(v.vel.x, v.vel.z);
    if (speed < 3.5) continue;
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    for (const ped of game.peds) {
      if (ped.down || ped.inVehicle) continue;
      const dx = ped.pos.x - v.pos.x, dz = ped.pos.z - v.pos.z;
      if (dx * dx + dz * dz > 16) continue;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < v.type.wid / 2 + 0.3 && Math.abs(lz) < v.type.len / 2 + 0.3) {
        knockDownPedestrian(game, ped, speed * 7, v.pos.x, v.pos.z, 'vehicle');
        ped.vel.x += v.vel.x * 0.6; ped.vel.z += v.vel.z * 0.6;
        game.events.emit('vehicleHitPed', { vehicle: v, ped, speed });
      }
    }
  }
}
