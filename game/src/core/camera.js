// Third-person camera: mouse orbit around the player, over-the-shoulder aiming, a chase view behind cars
// that swings back in line when the mouse rests, speed FOV, wall avoidance and screen shake.
import * as THREE from 'three';
import { raycastBoxes } from '../systems/collisions.js';
import { groundHeight } from '../world/terrain.js';
import { clamp, wrapAngle } from './rng.js';

export function createFollowCamera() {
  return { yaw: Math.PI, pitch: -0.2, dist: 5.2, height: 1.65, shoulder: 0, fov: 62, shake: 0, idle: 0, target: new THREE.Vector3(), lookAhead: 0, cinematic: null };
}

const desired = new THREE.Vector3();
const look = new THREE.Vector3();

export function updateFollowCamera(game, dt) {
  const rig = game.cameraRig;
  const camera = game.engine.camera;
  const input = game.input;
  const sens = game.settings.sensitivity;
  if (game.mode === 'play') {
    rig.yaw -= input.mouseDX * 0.0024 * sens;
    rig.pitch = clamp(rig.pitch - input.mouseDY * 0.002 * sens, -1.15, 0.45);
    if (input.down.has('ArrowLeft')) rig.yaw += dt * 2.2;
    if (input.down.has('ArrowRight')) rig.yaw -= dt * 2.2;
    if (input.down.has('ArrowUp')) rig.pitch = clamp(rig.pitch + dt, -1.15, 0.45);
    if (input.down.has('ArrowDown')) rig.pitch = clamp(rig.pitch - dt, -1.15, 0.45);
  }
  const moved = input.mouseDX !== 0 || input.mouseDY !== 0 || input.down.has('ArrowLeft') || input.down.has('ArrowRight');
  rig.idle = moved ? 0 : rig.idle + dt;

  const p = game.player;
  const v = p.vehicle;
  let dist, height, shoulder, fov = 62;
  if (v) {
    const speed = Math.abs(v.forwardSpeed);
    rig.target.set(v.pos.x, v.pos.y + 1.2 + v.type.roof * 0.4, v.pos.z);
    dist = 6.2 + v.type.len * 0.55 + Math.min(speed, 50) * 0.045;
    height = 0;
    shoulder = 0;
    fov = 64 + Math.min(16, speed * 0.32);
    if (rig.fixedOffset !== undefined) {
      // scripted framing relative to the car (used by the scene presets)
      rig.yaw = v.yaw + rig.fixedOffset;
    } else if (rig.idle > 0.9 && speed > 2) {
      // drift back behind the car (or in front when reversing)
      const behind = v.forwardSpeed >= -1 ? v.yaw : v.yaw + Math.PI;
      rig.yaw += wrapAngle(behind - rig.yaw) * Math.min(1, dt * 2.4);
      rig.pitch += (-0.2 - rig.pitch) * Math.min(1, dt * 1.5);
    }
  } else {
    rig.target.set(p.pos.x, p.pos.y + 1.55, p.pos.z);
    const aiming = p.aiming;
    dist = aiming ? 3.4 : 4.8;
    shoulder = aiming ? 0.95 : 0.4;
    fov = aiming ? 52 : 62;
    height = 0;
  }
  if (rig.distScale) dist *= rig.distScale;
  if (rig.fovOverride) fov = rig.fovOverride;
  rig.dist += (dist - rig.dist) * Math.min(1, dt * 6);
  rig.shoulder += (shoulder - rig.shoulder) * Math.min(1, dt * 8);
  rig.fov += (fov - rig.fov) * Math.min(1, dt * 4);

  const cp = Math.cos(rig.pitch), sp = Math.sin(rig.pitch);
  const fx = Math.sin(rig.yaw) * cp, fz = Math.cos(rig.yaw) * cp;
  const rx = -Math.cos(rig.yaw), rz = Math.sin(rig.yaw);
  const tx = rig.target.x + rx * rig.shoulder, ty = rig.target.y + height, tz = rig.target.z + rz * rig.shoulder;
  // pull the camera in front of any wall between it and the player
  const hit = raycastBoxes(game.city.collisions, tx, ty, tz, -fx, -sp, -fz, rig.dist + 0.3);
  const d = Math.max(0.8, Math.min(rig.dist, hit - 0.35));
  desired.set(tx - fx * d, ty - sp * d, tz - fz * d);
  desired.y = Math.max(desired.y, groundHeight(desired.x, desired.z) + 0.35);
  if (rig.cinematic) {
    desired.copy(rig.cinematic.pos);
    look.copy(rig.cinematic.look);
  } else {
    look.set(tx + fx * 10, ty + sp * 10, tz + fz * 10);
  }
  camera.position.copy(desired);
  if (rig.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * rig.shake;
    camera.position.y += (Math.random() - 0.5) * rig.shake;
    rig.shake = Math.max(0, rig.shake - dt * 2.5);
  }
  camera.lookAt(look);
  if (Math.abs(camera.fov - rig.fov) > 0.05) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
}

export function shakeCamera(game, amount) {
  game.cameraRig.shake = Math.max(game.cameraRig.shake, amount);
}

// Unit vector the camera looks along (where the crosshair points).
export function cameraAimDirection(game, out = new THREE.Vector3()) {
  return game.engine.camera.getWorldDirection(out);
}
