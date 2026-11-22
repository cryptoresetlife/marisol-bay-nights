// Dez, the player: walking, sprinting and jumping relative to the camera, health and body armour,
// the weapon wheel, and driving controls (throttle, steering, handbrake, horn) when behind the wheel.
import * as THREE from 'three';
import { buildCharacterModel, animateCharacter, setHeldWeapon, LOOKS } from './characterModel.js';
import { isKeyDown, wasKeyPressed } from '../core/input.js';
import { resolveCircle } from '../systems/collisions.js';
import { groundHeight } from '../world/terrain.js';
import { wrapAngle } from '../core/rng.js';

export const WALK_SPEED = 3.3;
export const SPRINT_SPEED = 7.2;

export function createPlayer(game, x, z) {
  const model = buildCharacterModel(LOOKS.dez);
  game.engine.scene.add(model.root);
  const player = {
    kind: 'player', model,
    pos: new THREE.Vector3(x, groundHeight(x, z), z),
    vel: new THREE.Vector3(), yaw: Math.PI, velY: 0, onGround: true,
    health: 100, maxHealth: 100, armor: 0,
    vehicle: null, alive: true, aiming: false, firing: false,
    weapons: { fists: { clip: 0, ammo: 0 } }, current: 'fists',
    punchT: 0, fireCooldown: 0, reloadT: 0, speed: 0, stamina: 1,
    lastDamage: 0, invulnerable: 0, stepTimer: 0,
    radius: 0.38,
  };
  return player;
}

export function updatePlayerOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  const rig = game.cameraRig;
  const fx = Math.sin(rig.yaw), fz = Math.cos(rig.yaw);
  const rx = -fz, rz = fx;
  let mx = 0, mz = 0;
  if (game.mode === 'play' && p.alive && !game.cutscene) {
    if (isKeyDown(input, 'KeyW')) { mx += fx; mz += fz; }
    if (isKeyDown(input, 'KeyS')) { mx -= fx; mz -= fz; }
    if (isKeyDown(input, 'KeyD')) { mx += rx; mz += rz; }
    if (isKeyDown(input, 'KeyA')) { mx -= rx; mz -= rz; }
  }
  const len = Math.hypot(mx, mz);
  p.aiming = game.mode === 'play' && p.alive && (input.buttons[2] || (input.buttons[0] && p.current !== 'fists') || !!game.forceAim);
  const sprint = isKeyDown(input, 'ShiftLeft', 'ShiftRight') && !p.aiming && p.stamina > 0.05;
  const speed = len > 0.01 ? (sprint ? SPRINT_SPEED : p.aiming ? 2.4 : WALK_SPEED) : 0;
  p.stamina = Math.min(1, Math.max(0, p.stamina + (sprint && len > 0 ? -0.12 : 0.2) * dt));
  if (len > 0.01) { mx /= len; mz /= len; }
  const accel = Math.min(1, dt * 12);
  p.vel.x += (mx * speed - p.vel.x) * accel;
  p.vel.z += (mz * speed - p.vel.z) * accel;
  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;
  p.speed = Math.hypot(p.vel.x, p.vel.z);

  // facing: along the camera while aiming, otherwise along the movement
  const targetYaw = p.aiming ? rig.yaw : (p.speed > 0.4 ? Math.atan2(p.vel.x, p.vel.z) : p.yaw);
  p.yaw += wrapAngle(targetYaw - p.yaw) * Math.min(1, dt * (p.aiming ? 20 : 10));

  if (game.mode === 'play' && p.onGround && wasKeyPressed(input, 'Space') && p.alive) { p.velY = 5.2; p.onGround = false; }
  p.velY -= 16 * dt;
  p.pos.y += p.velY * dt;
  const gy = groundHeight(p.pos.x, p.pos.z);
  if (p.pos.y <= gy) { p.pos.y = gy; p.velY = 0; p.onGround = true; }

  resolveCircle(game.city.collisions, p.pos, p.radius, p.pos.y + 0.5);
  pushOutOfVehicles(game, p);

  if (p.onGround && p.speed > 1) {
    p.stepTimer -= dt * p.speed;
    if (p.stepTimer <= 0) { p.stepTimer = 1.6; game.events.emit('footstep', { x: p.pos.x, z: p.pos.z, run: p.speed > 5 }); }
  }
  p.punchT = Math.max(0, p.punchT - dt * 3);
  syncPlayerModel(game, dt);
}

export function pushOutOfVehicles(game, who) {
  for (const v of game.vehicles) {
    const dx = who.pos.x - v.pos.x, dz = who.pos.z - v.pos.z;
    if (dx * dx + dz * dz > 16) continue;
    // to the car's local frame, then out of its box
    const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const hx = v.type.wid / 2 + who.radius, hz = v.type.len / 2 + who.radius;
    if (Math.abs(lx) < hx && Math.abs(lz) < hz && who.pos.y < v.pos.y + v.type.roof) {
      const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
      let nlx = lx, nlz = lz;
      if (px < pz) nlx = Math.sign(lx || 1) * hx; else nlz = Math.sign(lz || 1) * hz;
      who.pos.x = v.pos.x + nlx * c + nlz * s;
      who.pos.z = v.pos.z - nlx * s + nlz * c;
    }
  }
}

export function syncPlayerModel(game, dt) {
  const p = game.player;
  const m = p.model;
  if (p.vehicle) {
    m.root.visible = !!p.vehicle.type.convertible;
    if (m.root.visible) {
      m.root.position.set(p.vehicle.pos.x, p.vehicle.pos.y + 0.1, p.vehicle.pos.z);
      m.root.rotation.y = p.vehicle.yaw;
      animateCharacter(m, { seated: true }, dt);
    }
    return;
  }
  m.root.visible = true;
  m.root.position.copy(p.pos);
  m.root.rotation.y = p.yaw;
  setHeldWeapon(m, p.current);
  animateCharacter(m, { speed: p.speed, aiming: p.aiming, punch: p.punchT, down: !p.alive }, dt);
}

// Keyboard to throttle / steering / handbrake for the car Dez is driving.
export function updatePlayerDriving(game, dt) {
  const v = game.player.vehicle;
  const input = game.input;
  const c = v.controls;
  const active = game.mode === 'play' && !game.cutscene;
  const up = active && isKeyDown(input, 'KeyW');
  const down = active && isKeyDown(input, 'KeyS');
  c.throttle = (up ? 1 : 0) - (down ? 1 : 0);
  const steerIn = active ? (isKeyDown(input, 'KeyD') ? 1 : 0) - (isKeyDown(input, 'KeyA') ? 1 : 0) : 0;
  const rate = steerIn === 0 ? 6 : 3.2;
  c.steer += (steerIn - c.steer) * Math.min(1, dt * rate);
  c.handbrake = active && isKeyDown(input, 'Space');
  if (active && wasKeyPressed(input, 'KeyH')) game.events.emit('horn', { vehicle: v });
  game.player.pos.copy(v.pos);
  syncPlayerModel(game, dt);
}
