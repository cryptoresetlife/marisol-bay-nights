// Damage rules: bullets and fists against people, gunmen, Dez and cars; crash damage; armour soaking hits;
// cars that smoke, catch fire and blow up; and the blast radius hurting everything around it.
import { knockDownPedestrian, scarePedestrians } from '../characters/pedestrians.js';
import { emitBlood, emitSmoke, emitFire, emitSparks } from '../fx/particles.js';
import { spawnExplosion } from '../fx/explosions.js';
import { shakeCamera } from '../core/camera.js';

export function damagePlayer(game, amount, cause = 'shot') {
  const p = game.player;
  if (!p.alive || p.invulnerable > 0 || game.godMode) return;
  if (p.armor > 0) {
    const soak = Math.min(p.armor, amount * 0.7);
    p.armor -= soak;
    amount -= soak;
  }
  p.health -= amount;
  p.lastDamage = game.time;
  game.events.emit('playerDamaged', { amount, cause });
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    game.events.emit('playerDied', { cause });
  }
}

export function damageGunman(game, g, amount, source, dir) {
  if (g.dead) return;
  g.health -= amount;
  g.alerted = true;
  g.hurtT = 0.25;
  emitBlood(game.fx, g.pos.x, g.pos.y + 1.2, g.pos.z);
  if (g.health <= 0) {
    g.dead = true;
    g.deadTimer = 25;
    if (dir) g.vel.set(dir.x * 3, 0, dir.z * 3);
    game.events.emit('gunmanKilled', { gunman: g, source });
  }
}

export function damageVehicle(game, v, amount) {
  if (v.destroyed) return;
  v.health -= amount;
  if (v.health <= 0 && v.burning <= 0) {
    v.health = 0;
    v.burning = 5.5;
    game.events.emit('vehicleOnFire', { vehicle: v });
  }
}

export function installDamageRules(game) {
  const ev = game.events;
  ev.on('bulletHit', ({ kind, ref, point, damage, shooter, dir, melee }) => {
    if (kind === 'ped') {
      emitBlood(game.fx, point.x, point.y + (melee ? 1.3 : 0), point.z);
      knockDownPedestrian(game, ref, melee ? damage * 0.6 : damage * 1.6, shooter.pos.x, shooter.pos.z, melee ? 'punch' : 'shot');
      if (melee && !ref.dead) ref.downTimer = 1.6;
      ev.emit('pedAttacked', { ped: ref, shooter, melee });
    } else if (kind === 'gunman') {
      damageGunman(game, ref, damage * (melee ? 0.7 : 1), shooter, dir);
      ev.emit('gunmanAttacked', { gunman: ref, shooter, melee });
    } else if (kind === 'player') {
      if (!game.godMode) emitBlood(game.fx, point.x, point.y + 1.2, point.z);
      damagePlayer(game, damage * (shooter.damageScale || 1), 'shot');
      shakeCamera(game, 0.12);
    } else if (kind === 'vehicle') {
      emitSparks(game.fx, point.x, point.y, point.z, 6, '#fff2c0');
      damageVehicle(game, ref, damage * 1.1);
      if (shooter.kind === 'player') ev.emit('vehicleShot', { vehicle: ref });
      // shooting a car with someone in it hurts them a little
      if (ref === game.player.vehicle && shooter.kind !== 'player') damagePlayer(game, damage * 0.25, 'shot');
    }
  });
  ev.on('damageVehicle', ({ vehicle, amount }) => damageVehicle(game, vehicle, amount));
  ev.on('playerHurt', ({ amount, cause }) => damagePlayer(game, amount, cause));
  ev.on('vehicleImpact', ({ vehicle, other, impact }) => {
    const dmg = Math.max(0, impact - 3) * 9;
    damageVehicle(game, vehicle, dmg);
    if (other) damageVehicle(game, other, dmg * 0.9);
    const pv = game.player.vehicle;
    if (pv && (vehicle === pv || other === pv)) {
      shakeCamera(game, Math.min(0.6, impact * 0.03));
      if (impact > 14) damagePlayer(game, (impact - 14) * 1.5, 'crash');
    }
    if (impact > 6) emitSparks(game.fx, vehicle.pos.x, vehicle.pos.y + 0.6, vehicle.pos.z, Math.min(20, impact | 0));
  });
  ev.on('blast', ({ x, z, radius, damage, source }) => {
    scarePedestrians(game, x, z, 60);
    for (const ped of game.peds) {
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) knockDownPedestrian(game, ped, damage * (1 - d / radius), x, z, 'explosion');
    }
    for (const g of game.hostiles) {
      const d = Math.hypot(g.pos.x - x, g.pos.z - z);
      if (d < radius) damageGunman(game, g, damage * (1 - d / radius), source, { x: (g.pos.x - x) / (d || 1), z: (g.pos.z - z) / (d || 1) });
    }
    const p = game.player;
    const d = Math.hypot(p.pos.x - x, p.pos.z - z);
    if (d < radius) damagePlayer(game, damage * 0.5 * (1 - d / radius), 'explosion');
  });
}

// Smoke when battered, flames when wrecked, then the bang.
export function updateVehicleDamage(game, dt) {
  for (const v of game.vehicles) {
    if (v.destroyed) {
      v.wreckTimer += dt;
      if (v.wreckTimer < 14 && Math.random() < dt * 6) emitSmoke(game.fx, v.pos.x, v.pos.y + 1.2, v.pos.z, 0.9, 1);
      continue;
    }
    const hp = v.health / v.maxHealth;
    const fx = Math.sin(v.yaw) * v.type.len * 0.38, fz = Math.cos(v.yaw) * v.type.len * 0.38;
    if (hp < 0.45 && Math.random() < dt * (hp < 0.25 ? 12 : 5)) emitSmoke(game.fx, v.pos.x + fx, v.pos.y + 1, v.pos.z + fz, hp < 0.25 ? 0.8 : 0.2, 1);
    if (v.burning > 0) {
      v.burning -= dt;
      emitFire(game.fx, v.pos.x + fx, v.pos.y + 1, v.pos.z + fz, 2, 1.2);
      if (v.burning <= 0) {
        v.destroyed = true;
        spawnExplosion(game, v.pos.x, v.pos.y, v.pos.z, { source: v.lastAttacker });
        game.events.emit('vehicleExploded', { vehicle: v });
        if (game.player.vehicle === v) game.events.emit('playerHurt', { amount: 200, cause: 'explosion' });
      }
    }
  }
}
