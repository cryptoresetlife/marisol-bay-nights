// Weapons: fists, the Viper 9 pistol, Hornet SMG, Breaker 12 shotgun and Longshot AR. Firing, spread,
// magazines and reloads, punches, and the Q/E weapon cycle.
import * as THREE from 'three';
import { traceShot, drawTracer } from './projectiles.js';
import { emitMuzzleFlash, emitSparks, emitDust } from '../fx/particles.js';
import { cameraAimDirection, shakeCamera } from '../core/camera.js';
import { wasKeyPressed } from '../core/input.js';
import { shootingAccuracy } from '../systems/progression.js';

export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', melee: true, damage: 22, rate: 2.4, range: 2.0, price: 0 },
  pistol: { id: 'pistol', name: 'Viper 9', damage: 30, rate: 3.6, clip: 15, spread: 0.012, pellets: 1, range: 140, price: 600, ammoPrice: 80, ammoPack: 45, kick: 0.05 },
  smg: { id: 'smg', name: 'Hornet SMG', damage: 17, rate: 11, clip: 32, spread: 0.03, pellets: 1, auto: true, range: 110, price: 1800, ammoPrice: 150, ammoPack: 96, kick: 0.04 },
  shotgun: { id: 'shotgun', name: 'Breaker 12', damage: 14, rate: 1.15, clip: 6, spread: 0.075, pellets: 8, range: 48, price: 2400, ammoPrice: 120, ammoPack: 18, kick: 0.22 },
  rifle: { id: 'rifle', name: 'Longshot AR', damage: 34, rate: 7.5, clip: 30, spread: 0.011, pellets: 1, auto: true, range: 180, price: 4200, ammoPrice: 220, ammoPack: 90, kick: 0.07 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

export function giveWeapon(player, id, ammo = 0) {
  const w = WEAPONS[id];
  if (!player.weapons[id]) player.weapons[id] = { clip: 0, ammo: 0 };
  const slot = player.weapons[id];
  slot.ammo += ammo;
  if (slot.clip === 0 && !w.melee) { const take = Math.min(w.clip, slot.ammo); slot.clip = take; slot.ammo -= take; }
  return slot;
}

export function cycleWeapon(player, dir) {
  const owned = WEAPON_ORDER.filter((id) => player.weapons[id]);
  let i = owned.indexOf(player.current);
  i = (i + dir + owned.length) % owned.length;
  player.current = owned[i];
  player.reloadT = 0;
}

export function totalAmmo(player, id) {
  const s = player.weapons[id];
  return s ? s.clip + s.ammo : 0;
}

const aimDir = new THREE.Vector3();
const origin = new THREE.Vector3();
const dirTmp = new THREE.Vector3();

export function updatePlayerCombat(game, dt) {
  const p = game.player;
  const input = game.input;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  if (game.mode !== 'play' || !p.alive || p.vehicle || game.cutscene) return;
  if (wasKeyPressed(input, 'KeyQ') || input.wheel < 0) cycleWeapon(p, -1);
  if (wasKeyPressed(input, 'KeyE') || input.wheel > 0) cycleWeapon(p, 1);
  for (let k = 1; k <= 5; k++) if (wasKeyPressed(input, 'Digit' + k) && p.weapons[WEAPON_ORDER[k - 1]]) p.current = WEAPON_ORDER[k - 1];
  const w = WEAPONS[p.current];
  const slot = p.weapons[p.current];
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) { const take = Math.min(w.clip - slot.clip, slot.ammo); slot.clip += take; slot.ammo -= take; }
    return;
  }
  if (!w.melee && wasKeyPressed(input, 'KeyR') && slot.clip < w.clip && slot.ammo > 0) { p.reloadT = 1.3; game.events.emit('reload', {}); return; }
  const trigger = w.auto ? input.buttons[0] : input.clicked[0];
  if (!trigger || p.fireCooldown > 0) return;
  p.fireCooldown = 1 / w.rate;
  if (w.melee) { punch(game); return; }
  if (slot.clip <= 0) {
    if (slot.ammo > 0) { p.reloadT = 1.3; game.events.emit('reload', {}); }
    else { game.events.emit('dryFire', {}); p.fireCooldown = 0.3; }
    return;
  }
  slot.clip -= 1;
  cameraAimDirection(game, aimDir);
  // aim point is where the crosshair ray lands; bullets leave from the gun hand
  const cam = game.engine.camera.position;
  const aimHit = traceShot(game, cam, aimDir, 220, p);
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  origin.set(p.pos.x + fx * 0.6 - fz * 0.3, p.pos.y + 1.45, p.pos.z + fz * 0.6 + fx * 0.3);
  const target = aimHit.point;
  fireWeapon(game, p, origin, dirTmp.subVectors(target, origin).normalize(), w.id, game.progression ? shootingAccuracy(game) : 1);
  shakeCamera(game, w.kick);
  game.cameraRig.pitch += w.kick * 0.12;
  if (slot.clip === 0 && slot.ammo > 0) p.reloadT = 1.3;
}

// Fires one trigger pull from any shooter; returns the hits.
export function fireWeapon(game, shooter, from, dir, weaponId, accuracy = 1) {
  const w = WEAPONS[weaponId];
  const hits = [];
  emitMuzzleFlash(game.fx, from.x, from.y, from.z);
  game.events.emit('gunfire', { shooter, weapon: weaponId, x: from.x, z: from.z });
  for (let k = 0; k < w.pellets; k++) {
    const spread = w.spread / accuracy;
    const d = new THREE.Vector3(dir.x + (Math.random() - 0.5) * spread * 2, dir.y + (Math.random() - 0.5) * spread * 2, dir.z + (Math.random() - 0.5) * spread * 2).normalize();
    const hit = traceShot(game, from, d, w.range, shooter);
    drawTracer(game.tracers, from, hit.point, shooter.kind === 'player' ? [1.8, 1.4, 0.6] : [1.6, 0.7, 0.4]);
    if (hit.kind === 'world') { emitSparks(game.fx, hit.point.x, hit.point.y, hit.point.z, 5); emitDust(game.fx, hit.point.x, hit.point.y, hit.point.z, 2); }
    if (hit.kind !== 'world' && hit.kind !== 'none') {
      const falloff = Math.max(0.35, 1 - hit.t / w.range);
      game.events.emit('bulletHit', { kind: hit.kind, ref: hit.ref, point: hit.point, damage: w.damage * falloff, shooter, dir: d });
      hits.push(hit);
    }
  }
  return hits;
}

function punch(game) {
  const p = game.player;
  p.punchT = 1;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const px = p.pos.x + fx * 1.0, pz = p.pos.z + fz * 1.0;
  game.events.emit('punch', { x: px, z: pz });
  const reach = (o) => Math.hypot(o.pos.x - px, o.pos.z - pz) < 1.3;
  for (const ped of game.peds) if (!ped.down && reach(ped)) game.events.emit('bulletHit', { kind: 'ped', ref: ped, point: ped.pos, damage: WEAPONS.fists.damage, shooter: p, melee: true, dir: { x: fx, y: 0, z: fz } });
  for (const g of game.hostiles) if (!g.dead && reach(g)) game.events.emit('bulletHit', { kind: 'gunman', ref: g, point: g.pos, damage: WEAPONS.fists.damage, shooter: p, melee: true, dir: { x: fx, y: 0, z: fz } });
}
