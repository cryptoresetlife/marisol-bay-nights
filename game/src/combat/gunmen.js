// Armed NPCs: Coral Kings gangsters, Vance's guards and officers on foot. They spot Dez, close to fighting
// range, strafe, fire in bursts with distance-based accuracy, try to cuff him at one star, and drop when shot.
import * as THREE from 'three';
import { buildCharacterModel, animateCharacter, setHeldWeapon, LOOKS } from '../characters/characterModel.js';
import { fireWeapon } from './weapons.js';
import { resolveCircle, hasLineOfSight } from '../systems/collisions.js';
import { pushOutOfVehicles } from '../characters/player.js';
import { groundHeight } from '../world/terrain.js';
import { wrapAngle } from '../core/rng.js';

const FACTION_LOOK = { gang: LOOKS.gang, police: LOOKS.cop, swat: LOOKS.swat, guard: LOOKS.guard, boss: LOOKS.vance };

export function spawnGunman(game, x, z, { faction = 'gang', weapon = 'pistol', health = 100, aggressive = true, look = null, name = null, accuracy = 1, holdPosition = false } = {}) {
  const model = buildCharacterModel(look || FACTION_LOOK[faction]);
  setHeldWeapon(model, weapon);
  game.engine.scene.add(model.root);
  const g = {
    kind: 'gunman', faction, weapon, model, name,
    pos: new THREE.Vector3(x, groundHeight(x, z), z), vel: new THREE.Vector3(), yaw: Math.random() * 6,
    health, maxHealth: health, dead: false, deadTimer: 0, alerted: aggressive,
    fireCooldown: 1 + Math.random(), burst: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0,
    speed: 0, radius: 0.36, accuracy, holdPosition, hurtT: 0, arrestT: 0, damageScale: faction === 'swat' ? 1.2 : 0.8,
    lastSeen: -99, seesPlayer: false,
  };
  game.hostiles.push(g);
  return g;
}

export function removeGunman(game, g) {
  game.engine.scene.remove(g.model.root);
  const i = game.hostiles.indexOf(g);
  if (i >= 0) game.hostiles.splice(i, 1);
  g.removed = true;
}

const from = new THREE.Vector3();
const dir = new THREE.Vector3();

function wantsToFight(game, g) {
  if (g.faction === 'police' || g.faction === 'swat') return game.wanted.level > 0;
  return g.alerted;
}

export function updateGunmen(game, dt) {
  const p = game.player;
  const target = p.vehicle ? p.vehicle.pos : p.pos;
  for (let i = game.hostiles.length - 1; i >= 0; i--) {
    const g = game.hostiles[i];
    if (g.removeMe) { removeGunman(game, g); continue; }
    if (g.dead) {
      g.deadTimer -= dt;
      g.pos.x += g.vel.x * dt; g.pos.z += g.vel.z * dt;
      g.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
      animateCharacter(g.model, { down: true }, dt);
      g.model.root.position.copy(g.pos);
      if (g.deadTimer <= 0 || Math.hypot(g.pos.x - target.x, g.pos.z - target.z) > 220) removeGunman(game, g);
      continue;
    }
    g.speed = 0;
    const dx = target.x - g.pos.x, dz = target.z - g.pos.z;
    const dist = Math.hypot(dx, dz);
    const fighting = wantsToFight(game, g) && p.alive;
    if (dist > 260 && !g.mission) { removeGunman(game, g); continue; }
    g.seesPlayer = dist < 75 && hasLineOfSight(game.city.collisions, g.pos.x, g.pos.y + 1.6, g.pos.z, target.x, target.y + 1.2, target.z);
    if (g.seesPlayer) g.lastSeen = game.time;
    if (!g.alerted && g.seesPlayer && dist < 22 && g.faction !== 'police') g.alerted = true;
    if (fighting) {
      const face = Math.atan2(dx, dz);
      g.yaw += wrapAngle(face - g.yaw) * Math.min(1, dt * 9);
      const arresting = (g.faction === 'police') && game.wanted.level === 1 && !p.vehicle;
      let move = 0, side = 0;
      if (arresting) {
        move = dist > 1.4 ? 1 : 0;
        if (dist < 1.9) {
          g.arrestT += dt;
          if (g.arrestT > 1.6) game.events.emit('playerArrested', { by: g });
        } else g.arrestT = 0;
      } else if (!g.holdPosition) {
        if (!g.seesPlayer) move = 1;
        else if (dist > 20) move = 1;
        else if (dist < 6) move = -0.6;
        g.strafeT -= dt;
        if (g.strafeT <= 0) { g.strafe = -g.strafe; g.strafeT = 1.2 + Math.random() * 2; }
        side = g.seesPlayer ? g.strafe * 0.6 : 0;
      }
      const speed = arresting ? 5.2 : 3.8;
      const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
      g.pos.x += (fx * move + -fz * side) * speed * dt;
      g.pos.z += (fz * move + fx * side) * speed * dt;
      g.speed = Math.abs(move) * speed + Math.abs(side) * speed;
      // shoot in bursts when there is a clear line
      g.fireCooldown -= dt;
      if (!arresting && g.seesPlayer && g.fireCooldown <= 0 && dist < 70) {
        const wDelay = g.weapon === 'smg' || g.weapon === 'rifle' ? 0.11 : 0.45;
        from.set(g.pos.x + fx * 0.6, g.pos.y + 1.45, g.pos.z + fz * 0.6);
        const moving = p.vehicle ? Math.min(1, Math.hypot(p.vehicle.vel.x, p.vehicle.vel.z) / 25) : Math.min(1, p.speed / 7);
        const miss = (0.5 + dist * 0.035 + moving * 0.9) / g.accuracy;
        dir.set(target.x + (Math.random() - 0.5) * miss * 2 - from.x, target.y + 1.1 + (Math.random() - 0.5) * miss - from.y, target.z + (Math.random() - 0.5) * miss * 2 - from.z).normalize();
        fireWeapon(game, g, from, dir, g.weapon, g.accuracy);
        g.burst += 1;
        if (g.burst >= (wDelay < 0.2 ? 5 : 2)) { g.burst = 0; g.fireCooldown = 0.9 + Math.random() * 1.2; }
        else g.fireCooldown = wDelay;
      }
    }
    resolveCircle(game.city.collisions, g.pos, g.radius, 0.5);
    pushOutOfVehicles(game, g);
    g.pos.y = groundHeight(g.pos.x, g.pos.z);
    g.model.root.position.copy(g.pos);
    g.model.root.rotation.y = g.yaw;
    animateCharacter(g.model, { speed: g.speed, aiming: fighting && g.seesPlayer && !(g.faction === 'police' && game.wanted.level === 1) }, dt);
  }
}

export function alertGunmenNear(game, x, z, radius, faction = null) {
  for (const g of game.hostiles) {
    if (faction && g.faction !== faction) continue;
    if (Math.hypot(g.pos.x - x, g.pos.z - z) < radius) g.alerted = true;
  }
}
