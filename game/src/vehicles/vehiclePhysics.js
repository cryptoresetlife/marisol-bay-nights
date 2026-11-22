// Arcade car handling: engine and brakes, rolling drag, tyre grip that lets go under the handbrake for
// drifts, speed-sensitive steering, bounces off walls and other cars, and impact damage.
import { resolveCircle } from '../systems/collisions.js';
import { groundHeight } from '../world/terrain.js';
import { clamp } from '../core/rng.js';

export function stepVehiclePhysics(game, v, dt) {
  const t = v.type;
  const c = v.controls;
  let fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let rx = -fz, rz = fx;
  let vF = v.vel.x * fx + v.vel.z * fz;
  let vS = v.vel.x * rx + v.vel.z * rz;
  const disabled = v.destroyed || (v.health <= 0);
  const thr = disabled ? 0 : c.throttle;
  v.braking = false;

  if (thr > 0) {
    if (vF < -0.5) { vF = Math.min(0, vF + t.brake * dt); v.braking = true; }
    else vF += t.accel * thr * Math.max(0, 1 - (vF / t.maxSpeed) ** 2) * dt;
  } else if (thr < 0) {
    if (vF > 0.5) { vF = Math.max(0, vF - t.brake * -thr * dt); v.braking = true; }
    else vF = Math.max(-t.maxSpeed * 0.32, vF + t.accel * 0.6 * thr * dt);
  } else {
    const roll = (disabled ? 6 : 1.6) * dt;
    vF = Math.abs(vF) <= roll ? 0 : vF - Math.sign(vF) * roll;
  }
  vF -= vF * 0.08 * dt;
  if (c.handbrake && !disabled) {
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), 5 * dt);
    v.braking = true;
  }
  const grip = c.handbrake ? 1.3 : t.grip * (disabled ? 0.6 : 1);
  vS *= Math.exp(-grip * dt);

  const speedFactor = clamp(vF / 7, -1, 1);
  const highSpeedDamp = 1 - 0.5 * Math.min(1, Math.abs(vF) / t.maxSpeed);
  let targetYaw = -(disabled ? 0 : c.steer) * t.steer * speedFactor * highSpeedDamp;
  if (c.handbrake) targetYaw *= 1.45;
  v.yawRate += (targetYaw - v.yawRate) * Math.min(1, dt * 7);
  v.yaw += v.yawRate * dt;

  fx = Math.sin(v.yaw); fz = Math.cos(v.yaw);
  rx = -fz; rz = fx;
  v.vel.x = fx * vF + rx * vS;
  v.vel.z = fz * vF + rz * vS;
  v.forwardSpeed = vF;
  v.slip = Math.abs(vS);
  v.pos.x += v.vel.x * dt;
  v.pos.z += v.vel.z * dt;

  collideWithWorld(game, v);
  const gy = groundHeight(v.pos.x, v.pos.z);
  // tiny suspension: settle onto the ground, pop up over kerbs, fly after explosions
  v.liftVel -= 22 * dt;
  v.lift += v.liftVel * dt;
  if (v.lift < 0) { v.lift = 0; v.liftVel = 0; }
  v.pos.y += (gy - v.pos.y) * Math.min(1, dt * 14);
}

const circle = { x: 0, z: 0 };

function collideWithWorld(game, v) {
  const t = v.type;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const r = t.wid / 2;
  const reach = t.len / 2 - r;
  let mx = 0, mz = 0, nx = 0, nz = 0, hits = 0;
  for (const k of [-1, 0, 1]) {
    circle.x = v.pos.x + fx * reach * k;
    circle.z = v.pos.z + fz * reach * k;
    const ox = circle.x, oz = circle.z;
    const n = resolveCircle(game.city.collisions, circle, r, 0.6);
    if (n) {
      mx += circle.x - ox; mz += circle.z - oz;
      nx += n.nx; nz += n.nz; hits++;
    }
  }
  if (!hits) return;
  v.pos.x += mx / hits;
  v.pos.z += mz / hits;
  const len = Math.hypot(nx, nz) || 1;
  nx /= len; nz /= len;
  const vn = v.vel.x * nx + v.vel.z * nz;
  if (vn < 0) {
    v.vel.x -= 1.35 * vn * nx;
    v.vel.z -= 1.35 * vn * nz;
    v.vel.x *= 0.82; v.vel.z *= 0.82;
    const impact = -vn;
    // glancing blows spin the car a little
    v.yawRate += (Math.random() - 0.5) * impact * 0.04;
    if (impact > 3) game.events.emit('vehicleImpact', { vehicle: v, impact, x: v.pos.x, z: v.pos.z, wall: true });
  }
}

// Pairwise pushes and impulses between cars, approximated as three circles each.
export function resolveVehicleContacts(game) {
  const list = game.vehicles;
  for (let a = 0; a < list.length; a++) {
    const A = list[a];
    for (let b = a + 1; b < list.length; b++) {
      const B = list[b];
      const dx0 = B.pos.x - A.pos.x, dz0 = B.pos.z - A.pos.z;
      const reachSum = (A.type.len + B.type.len) / 2 + 0.5;
      if (dx0 * dx0 + dz0 * dz0 > reachSum * reachSum) continue;
      contactPair(game, A, B);
    }
  }
}

function circlesOf(v, out) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const r = v.type.wid / 2;
  const reach = v.type.len / 2 - r;
  out[0] = v.pos.x - fx * reach; out[1] = v.pos.z - fz * reach;
  out[2] = v.pos.x; out[3] = v.pos.z;
  out[4] = v.pos.x + fx * reach; out[5] = v.pos.z + fz * reach;
  return r;
}

const ca = new Float64Array(6), cb = new Float64Array(6);

function contactPair(game, A, B) {
  const ra = circlesOf(A, ca), rb = circlesOf(B, cb);
  let best = null;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const dx = cb[j * 2] - ca[i * 2], dz = cb[j * 2 + 1] - ca[i * 2 + 1];
      const d = Math.hypot(dx, dz);
      const pen = ra + rb - d;
      if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: d > 1e-4 ? dx / d : 1, nz: d > 1e-4 ? dz / d : 0 };
    }
  }
  if (!best) return;
  const ma = A.type.mass * (A.parked ? 1.6 : 1), mb = B.type.mass * (B.parked ? 1.6 : 1);
  const wa = mb / (ma + mb), wb = ma / (ma + mb);
  A.pos.x -= best.nx * best.pen * wa; A.pos.z -= best.nz * best.pen * wa;
  B.pos.x += best.nx * best.pen * wb; B.pos.z += best.nz * best.pen * wb;
  const rvx = B.vel.x - A.vel.x, rvz = B.vel.z - A.vel.z;
  const vn = rvx * best.nx + rvz * best.nz;
  if (vn >= 0) return;
  const j = -(1.3 * vn) / (1 / ma + 1 / mb);
  A.vel.x -= (j / ma) * best.nx; A.vel.z -= (j / ma) * best.nz;
  B.vel.x += (j / mb) * best.nx; B.vel.z += (j / mb) * best.nz;
  A.yawRate += (Math.random() - 0.5) * 0.6; B.yawRate += (Math.random() - 0.5) * 0.6;
  const impact = -vn;
  if (impact > 2.5) game.events.emit('vehicleImpact', { vehicle: A, other: B, impact, x: (A.pos.x + B.pos.x) / 2, z: (A.pos.z + B.pos.z) / 2 });
}
