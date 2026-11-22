// Explosions: a fireball, smoke column and sparks, a flash of light, a shockwave that throws cars and
// people, chain reactions through nearby wrecks, and camera shake by distance.
import * as THREE from 'three';
import { emitFire, emitSmoke, emitSparks } from './particles.js';
import { shakeCamera } from '../core/camera.js';

export function createExplosionLight(scene) {
  const light = new THREE.PointLight('#ffb35c', 0, 60, 1.6);
  light.position.set(0, -100, 0);
  scene.add(light);
  return { light, t: 0 };
}

export function spawnExplosion(game, x, y, z, { radius = 9, damage = 260, source = null } = {}) {
  const fx = game.fx;
  for (let k = 0; k < 46; k++) emitFire(fx, x, y + 0.5, z, 1, 2.6);
  for (let k = 0; k < 4; k++) emitSmoke(fx, x, y + 1.5, z, 0.85, 6);
  emitSparks(fx, x, y + 1, z, 40, '#ffc14d');
  const boom = game.explosionLight;
  boom.light.position.set(x, y + 3, z);
  boom.t = 0.6;
  const cam = game.engine.camera.position;
  const d = Math.hypot(cam.x - x, cam.z - z);
  shakeCamera(game, Math.max(0, 1.6 - d / 40));
  game.events.emit('explosion', { x, y, z, dist: d });

  for (const v of game.vehicles) {
    const dv = Math.hypot(v.pos.x - x, v.pos.z - z);
    if (dv > radius || dv < 0.01) continue;
    const k = 1 - dv / radius;
    v.vel.x += ((v.pos.x - x) / dv) * 14 * k;
    v.vel.z += ((v.pos.z - z) / dv) * 14 * k;
    v.liftVel += 7 * k;
    v.yawRate += (Math.random() - 0.5) * 4 * k;
    if (!v.destroyed) game.events.emit('damageVehicle', { vehicle: v, amount: damage * k, source });
  }
  game.events.emit('blast', { x, z, radius, damage, source });
}

export function updateExplosionLight(game, dt) {
  const boom = game.explosionLight;
  if (boom.t <= 0) { boom.light.intensity = 0; return; }
  boom.t -= dt;
  boom.light.intensity = Math.max(0, boom.t / 0.6) * 900;
}
