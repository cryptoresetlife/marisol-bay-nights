// A vehicle in the world: its model, position, velocity, controls, health, driver and AI, and the
// per-frame sync of wheels, body roll, lamps, siren lights and damage smoke onto the model.
import * as THREE from 'three';
import { VEHICLE_TYPES, buildCarModel } from './carModels.js';
import { groundHeight } from '../world/terrain.js';

let nextId = 1;

export function createVehicle(game, typeKey, { x, z, yaw = 0, color = null, parked = false } = {}) {
  const type = VEHICLE_TYPES[typeKey];
  const paint = color || type.colors[Math.floor(Math.random() * type.colors.length)];
  const model = buildCarModel(typeKey, paint);
  const v = {
    id: nextId++,
    typeKey, type, model, mesh: model.group, color: paint,
    pos: new THREE.Vector3(x, groundHeight(x, z), z),
    yaw, vel: { x: 0, z: 0 }, yawRate: 0, forwardSpeed: 0,
    controls: { throttle: 0, steer: 0, handbrake: false },
    steerAngle: 0, wheelSpin: 0, roll: 0, pitch: 0, lift: 0, liftVel: 0, flip: 0,
    health: type.health, maxHealth: type.health,
    driver: null, passenger: null, ai: null, parked,
    siren: false, sirenPhase: Math.random() * 6,
    burning: 0, destroyed: false, wreckTimer: 0,
    lastImpact: 0, braking: false,
    radius: type.wid / 2,
    isPolice: !!type.police,
  };
  v.mesh.position.copy(v.pos);
  v.mesh.rotation.y = yaw;
  game.engine.scene.add(v.mesh);
  game.vehicles.push(v);
  return v;
}

export function removeVehicle(game, v) {
  game.engine.scene.remove(v.mesh);
  const i = game.vehicles.indexOf(v);
  if (i >= 0) game.vehicles.splice(i, 1);
  v.removed = true;
}

export function vehicleForward(v) {
  return { x: Math.sin(v.yaw), z: Math.cos(v.yaw) };
}

export function vehicleRight(v) {
  return { x: -Math.cos(v.yaw), z: Math.sin(v.yaw) };
}

export function vehicleSpeed(v) {
  return Math.hypot(v.vel.x, v.vel.z);
}

// Point beside the driver's door, where a person gets in or is pulled out.
export function doorPoint(v, side = 1) {
  const r = vehicleRight(v), f = vehicleForward(v);
  const s = side * (v.type.wid / 2 + 0.7);
  return { x: v.pos.x - r.x * s + f.x * 0.3, z: v.pos.z - r.z * s + f.z * 0.3 };
}

export function syncVehicleMesh(v, dt, night, time) {
  const m = v.mesh;
  m.position.set(v.pos.x, v.pos.y + v.lift, v.pos.z);
  // body leans against the turn and squats under acceleration
  const targetRoll = v.destroyed ? 0 : THREE.MathUtils.clamp(v.yawRate * v.forwardSpeed * 0.006, -0.09, 0.09);
  v.roll += (targetRoll - v.roll) * Math.min(1, dt * 6);
  const targetPitch = v.destroyed ? 0 : -v.controls.throttle * 0.025 + (v.braking ? 0.03 : 0);
  v.pitch += (targetPitch - v.pitch) * Math.min(1, dt * 5);
  m.rotation.set(v.pitch, v.yaw, v.roll + v.flip, 'YXZ');
  v.steerAngle += (v.controls.steer * -0.5 - v.steerAngle) * Math.min(1, dt * 10);
  v.wheelSpin += v.forwardSpeed * dt / 0.36;
  for (const w of v.model.wheels) {
    if (w.front) w.pivot.rotation.y = v.steerAngle;
    w.tire.rotation.x = v.wheelSpin;
  }
  const lights = v.destroyed ? 0 : 1;
  v.model.headMat.emissiveIntensity = lights * (0.35 + night * 3.5);
  v.model.tailMat.emissiveIntensity = lights * (v.braking ? 3 : 0.25 + night * 1.2);
  if (v.model.lightbar) {
    const on = v.siren && !v.destroyed;
    const phase = Math.floor((time + v.sirenPhase) * 6) % 2;
    v.model.lightbar.red.color.setScalar(0).setRGB(on && phase ? 4 : 0.35, on && phase ? 0.2 : 0.02, 0.02);
    v.model.lightbar.blue.color.setRGB(0.02, on && !phase ? 0.5 : 0.04, on && !phase ? 5 : 0.4);
    v.model.lightbar.redGlow.material.opacity = on && phase ? 0.95 : 0;
    v.model.lightbar.blueGlow.material.opacity = on && !phase ? 0.95 : 0;
  }
  if (v.destroyed && !v.charred) {
    v.charred = true;
    v.model.paint.color.set('#2a2624');
    v.model.paint.metalness = 0;
    v.model.paint.roughness = 1;
  }
}
