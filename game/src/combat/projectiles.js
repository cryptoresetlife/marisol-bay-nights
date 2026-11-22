// Bullets: instant hit traces against people, cars and buildings, plus the glowing tracer streaks they
// leave behind (thin additive bars, so they read even at a distance).
import * as THREE from 'three';
import { raycastBoxes } from '../systems/collisions.js';

const MAX_TRACERS = 96;
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);
const dirV = new THREE.Vector3();
const mid = new THREE.Vector3();
const scl = new THREE.Vector3();

export function createTracers(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_TRACERS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < MAX_TRACERS; i++) { mesh.setMatrixAt(i, hidden); mesh.setColorAt(i, new THREE.Color('#ffd27a')); }
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, life: new Float32Array(MAX_TRACERS), next: 0 };
}

export function drawTracer(tracers, a, b, color = [1.8, 1.4, 0.6]) {
  const i = tracers.next;
  tracers.next = (i + 1) % MAX_TRACERS;
  dirV.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = dirV.length() || 1;
  // only the last stretch of the bullet path glows, like a streak
  const streak = Math.min(len, 9 + Math.random() * 7);
  dirV.divideScalar(len);
  mid.set(b.x - dirV.x * streak / 2, b.y - dirV.y * streak / 2, b.z - dirV.z * streak / 2);
  q.setFromUnitVectors(zAxis, dirV);
  m4.compose(mid, q, scl.set(0.045, 0.045, streak));
  tracers.mesh.setMatrixAt(i, m4);
  tracers.mesh.setColorAt(i, new THREE.Color(color[0] / 1.8, color[1] / 1.8, color[2] / 1.8));
  tracers.mesh.instanceMatrix.needsUpdate = true;
  tracers.mesh.instanceColor.needsUpdate = true;
  tracers.life[i] = 0.08;
}

export function updateTracers(tracers, dt) {
  let changed = false;
  for (let i = 0; i < MAX_TRACERS; i++) {
    if (tracers.life[i] <= 0) continue;
    tracers.life[i] -= dt;
    if (tracers.life[i] <= 0) { tracers.mesh.setMatrixAt(i, hidden); changed = true; }
  }
  if (changed) tracers.mesh.instanceMatrix.needsUpdate = true;
}

// Ray against an upright cylinder standing at (cx, cy, cz).
function rayCylinder(o, d, cx, cy, cz, r, h) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return -1;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return -1;
  const y = o.y + d.y * t;
  return y >= cy && y <= cy + h ? t : -1;
}

// Ray against a car's oriented box, in the car's local frame.
function rayVehicle(o, d, v) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const ox = o.x - v.pos.x, oz = o.z - v.pos.z, oy = o.y - v.pos.y;
  const lox = ox * c - oz * s, loz = ox * s + oz * c;
  const ldx = d.x * c - d.z * s, ldz = d.x * s + d.z * c;
  const hx = v.type.wid / 2, hz = v.type.len / 2;
  let tmin = 0, tmax = Infinity;
  for (const [oo, dd, lo, hi] of [[lox, ldx, -hx, hx], [oy, d.y, 0.25, v.type.roof + 0.05], [loz, ldz, -hz, hz]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

// First thing a bullet from `origin` along unit `dir` hits within `range`.
export function traceShot(game, origin, dir, range, shooter) {
  let best = { t: raycastBoxes(game.city.collisions, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range), kind: 'world', ref: null };
  if (best.t === Infinity) best = { t: range, kind: 'none', ref: null };
  const test = (t, kind, ref) => { if (t >= 0 && t < best.t) best = { t, kind, ref }; };
  for (const ped of game.peds) if (!ped.down && !ped.inVehicle) test(rayCylinder(origin, dir, ped.pos.x, ped.pos.y, ped.pos.z, 0.4, 1.9), 'ped', ped);
  for (const g of game.hostiles) if (g !== shooter && !g.dead && !g.inVehicle) test(rayCylinder(origin, dir, g.pos.x, g.pos.y, g.pos.z, 0.42, 1.9), 'gunman', g);
  const p = game.player;
  if (shooter !== p && p.alive && !p.vehicle) test(rayCylinder(origin, dir, p.pos.x, p.pos.y, p.pos.z, 0.42, 1.9), 'player', p);
  for (const v of game.vehicles) {
    if (shooter && shooter.vehicle === v) continue;
    const dx = v.pos.x - origin.x, dz = v.pos.z - origin.z;
    if (dx * dx + dz * dz > (range + 6) * (range + 6)) continue;
    test(rayVehicle(origin, dir, v), 'vehicle', v);
  }
  const point = new THREE.Vector3(origin.x + dir.x * best.t, origin.y + dir.y * best.t, origin.z + dir.z * best.t);
  return { ...best, point };
}
