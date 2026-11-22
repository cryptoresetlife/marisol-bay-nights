// Marisol Bay PD: cruisers dispatched by wanted level that route through the grid, chase with sirens and
// lights, overtake stalled traffic, ram the getaway car, and drop officers to fight on foot; tactical vans
// at five stars; the Eagle One helicopter with its searchlight from four stars.
import * as THREE from 'three';
import { createVehicle, removeVehicle, vehicleSpeed, doorPoint } from '../vehicles/vehicle.js';
import { steerToward, scanAhead, planRoute, followRoute } from '../vehicles/driver.js';
import { spawnGunman } from '../combat/gunmen.js';
import { DIR_YAW, laneExitPoint, laneStopPoint } from '../world/roads.js';
import { randomLook } from '../characters/characterModel.js';
import { makeBeamTexture } from '../world/textures.js';
import { hasLineOfSight } from '../systems/collisions.js';
import { clamp } from '../core/rng.js';

const UNITS_BY_LEVEL = [0, 1, 2, 3, 4, 6];

export function createPoliceForce() {
  return { spawnTimer: 0, heli: null, patrolTimer: 4 };
}

function spawnPointAway(game, minD, maxD) {
  const roads = game.city.roads;
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  let best = null;
  for (let k = 0; k < 40; k++) {
    const node = roads.nodes[Math.floor(Math.random() * roads.nodes.length)];
    const d = Math.floor(Math.random() * 4);
    if (node.links[d] < 0) continue;
    const to = roads.nodes[node.links[d]];
    const a = laneExitPoint(node, d), b = laneStopPoint(to, d);
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    const dist = Math.hypot(x - p.x, z - p.z);
    if (dist < minD || dist > maxD) continue;
    if (game.vehicles.some((v) => Math.hypot(v.pos.x - x, v.pos.z - z) < 8)) continue;
    // prefer spots the player can't see right now
    const hidden = !hasLineOfSight(game.city.collisions, x, 2, z, p.x, 2, p.z);
    best = { x, z, yaw: DIR_YAW[d] };
    if (hidden) break;
  }
  return best;
}

export function spawnPoliceCruiser(game, { x, z, yaw, type = 'police', mode = 'pursuit' } = {}) {
  if (x === undefined) {
    const s = spawnPointAway(game, 90, 170);
    if (!s) return null;
    ({ x, z, yaw } = s);
  }
  const v = createVehicle(game, type, { x, z, yaw });
  v.driver = { look: null, police: true };
  v.siren = mode === 'pursuit';
  v.ai = { mode: 'police', state: mode, route: [], routeT: 0, stuckT: 0, reverseT: 0, crew: type === 'tactical' ? 3 : 2, deployed: false };
  return v;
}

export function deployOfficers(game, v) {
  if (v.ai.deployed) return;
  v.ai.deployed = true;
  const swat = v.typeKey === 'tactical' || game.wanted.level >= 5;
  for (let k = 0; k < v.ai.crew; k++) {
    const door = doorPoint(v, k % 2 ? -1 : 1);
    spawnGunman(game, door.x + (k > 1 ? 1.2 : 0), door.z, {
      faction: swat ? 'swat' : 'police', weapon: swat ? 'rifle' : (game.wanted.level >= 3 && k === 0 ? 'shotgun' : 'pistol'),
      health: swat ? 180 : 100, accuracy: swat ? 1.25 : 0.9,
    });
  }
  v.controls.throttle = 0;
  v.controls.handbrake = true;
}

function drivePursuit(game, v, dt) {
  const ai = v.ai;
  const p = game.player;
  const target = p.vehicle ? p.vehicle : null;
  const tpos = target ? target.pos : p.pos;
  const dist = Math.hypot(tpos.x - v.pos.x, tpos.z - v.pos.z);
  const targetSpeed = target ? vehicleSpeed(target) : p.speed;
  v.siren = true;
  // officers get out once Dez is on foot or the car is boxed in
  if ((!target && dist < 26) || (target && targetSpeed < 3 && dist < 16)) {
    deployOfficers(game, v);
    return;
  }
  const los = dist < 60 && hasLineOfSight(game.city.collisions, v.pos.x, 1.2, v.pos.z, tpos.x, 1.2, tpos.z);
  let speed;
  if (los) {
    const lead = Math.min(1.2, dist / 25);
    let tx = tpos.x, tz = tpos.z;
    if (target) { tx += target.vel.x * lead; tz += target.vel.z * lead; }
    speed = dist < 14 ? targetSpeed + 7 : Math.min(v.type.maxSpeed * 0.95, targetSpeed + dist * 0.6 + 8);
    steerToward(v, tx, tz, speed);
    ai.route = [];
  } else {
    ai.routeT -= dt;
    if (ai.routeT <= 0 || ai.route.length === 0) { ai.route = planRoute(game, v.pos.x, v.pos.z, tpos.x, tpos.z, 0, v.yaw); ai.routeT = 2.5; }
    speed = Math.min(v.type.maxSpeed * 0.8, 34);
    followRoute(v, ai.route, speed, 9);
  }
  // swing out around traffic that is in the way
  const gap = scanAhead(game, v, 9 + Math.abs(v.forwardSpeed) * 0.5, 1.4);
  if (gap < 12 && !(target && dist < 14)) {
    v.controls.steer = clamp(v.controls.steer - 0.75, -1, 1);
    if (gap < 4) v.controls.throttle = Math.min(v.controls.throttle, 0.3);
  }
  // unstick by reversing
  if (ai.reverseT > 0) {
    ai.reverseT -= dt;
    v.controls.throttle = -1;
    v.controls.steer = -v.controls.steer || 1;
  } else if (Math.abs(v.forwardSpeed) < 1.2 && v.controls.throttle > 0.3) {
    ai.stuckT += dt;
    if (ai.stuckT > 1.6) { ai.reverseT = 1.1; ai.stuckT = 0; }
  } else ai.stuckT = 0;
}

function driveAway(game, v, dt) {
  const ai = v.ai;
  v.siren = false;
  if (!ai.route.length) {
    const p = game.player.pos;
    const s = spawnPointAway(game, 220, 400) || { x: p.x + 300, z: p.z };
    ai.route = planRoute(game, v.pos.x, v.pos.z, s.x, s.z);
  }
  followRoute(v, ai.route, 13);
}

export function updatePolice(game, dt) {
  const level = game.wanted.level;
  const force = game.police;
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  let pursuing = 0, tactical = 0;
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    if (v.ai?.mode !== 'police') continue;
    const dist = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
    if (v.destroyed || !v.driver) { if (dist > 200) removeVehicle(game, v); continue; }
    if (level > 0 && v.ai.state !== 'roadblock') v.ai.state = 'pursuit';
    if (level === 0 && v.ai.state === 'pursuit') { v.ai.state = 'leave'; v.ai.route = []; }
    if (v.ai.state === 'pursuit') {
      if (!v.ai.deployed) { pursuing++; if (v.typeKey === 'tactical') tactical++; drivePursuit(game, v, dt); }
      else if (dist > 70 && level > 0) { v.ai.deployed = false; v.ai.crew = 0; } // empty car rejoins the chase
    } else if (v.ai.state === 'leave') {
      driveAway(game, v, dt);
      if (dist > 210) removeVehicle(game, v);
    } else if (v.ai.state === 'roadblock') {
      v.controls.throttle = 0; v.controls.handbrake = true; v.siren = level > 0;
      if (dist > 300) removeVehicle(game, v);
    }
  }
  // dispatch more units up to the level's quota
  force.spawnTimer -= dt;
  if (level > 0 && pursuing < UNITS_BY_LEVEL[level] && force.spawnTimer <= 0) {
    const type = level >= 5 && tactical < 2 ? 'tactical' : 'police';
    spawnPoliceCruiser(game, { type });
    force.spawnTimer = level >= 4 ? 1.5 : 3;
  }
  // a patrol car now and then, even with a clean record
  force.patrolTimer -= dt;
  if (level === 0 && force.patrolTimer <= 0) {
    force.patrolTimer = 25;
    const s = spawnPointAway(game, 80, 160);
    if (s && !game.vehicles.some((v) => v.ai?.mode === 'police')) {
      const v = spawnPoliceCruiser(game, { ...s, mode: 'leave' });
      if (v) { v.ai.state = 'leave'; v.driver.look = randomLook(); }
    }
  }
  updateHelicopter(game, dt, level);
  // officers lose interest once the stars are gone
  if (level === 0) {
    for (const g of game.hostiles) if ((g.faction === 'police' || g.faction === 'swat') && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) > 60) g.removeMe = true;
  }
}

// ---- Eagle One --------------------------------------------------------------------------------

function buildHelicopter() {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#1b2a44', roughness: 0.4, metalness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: '#eef2f7', roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#0e1a24', roughness: 0.1, metalness: 0.7 });
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), body);
  cabin.scale.set(1, 0.9, 1.6);
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), glass);
  nose.position.set(0, 0.2, 1.6);
  nose.scale.set(1, 0.8, 0.9);
  group.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.4, 2.8), white);
  stripe.position.y = -0.2;
  group.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 6), body);
  tail.position.set(0, 0.3, -4.5);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.0), body);
  fin.position.set(0, 1.0, -7.3);
  group.add(fin);
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4), white);
    skid.position.set(s * 1.2, -1.7, 0);
    group.add(skid);
  }
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: '#222' }));
  rotor.position.y = 1.7;
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  const rotorHub = new THREE.Group();
  rotorHub.add(rotor, rotor2);
  group.add(rotorHub);
  const beamMat = new THREE.MeshBasicMaterial({ map: makeBeamTexture(), color: '#fff6d8', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamGeo = new THREE.CylinderGeometry(0.3, 6, 1, 20, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  group.add(beam);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false }));
  red.position.set(0, -0.9, -2);
  group.add(red);
  return { group, rotorHub, beam, beamMat, red };
}

function updateHelicopter(game, dt, level) {
  const force = game.police;
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  if (level >= 4 && !force.heli) {
    const model = buildHelicopter();
    force.heli = { ...model, pos: new THREE.Vector3(p.x - 50, 45, p.z - 50), angle: 0, leaving: false };
    game.engine.scene.add(model.group);
  }
  const h = force.heli;
  if (!h) return;
  if (level < 4) h.leaving = true;
  h.angle += dt * 0.35;
  const goal = h.leaving
    ? new THREE.Vector3(p.x + 400, 90, p.z - 400)
    : new THREE.Vector3(p.x + Math.cos(h.angle) * 26, force.heliAltitude || 34, p.z + Math.sin(h.angle) * 26);
  h.pos.lerp(goal, Math.min(1, dt * 0.8));
  h.group.position.copy(h.pos);
  const look = Math.atan2(p.x - h.pos.x, p.z - h.pos.z);
  h.group.rotation.set(0.12, look, Math.sin(game.time) * 0.05);
  h.rotorHub.rotation.y += dt * 38;
  // searchlight stretches from the belly to the ground at Dez
  const dx = p.x - h.pos.x, dy = (p.y + 0.2) - h.pos.y, dz = p.z - h.pos.z;
  const len = Math.hypot(dx, dy, dz);
  h.beam.scale.set(1, len, 1);
  h.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  h.beam.quaternion.premultiply(h.group.quaternion.clone().invert());
  h.beamMat.opacity = Math.max(0, game.night - 0.2) * 0.4;
  h.red.visible = Math.floor(game.time * 2) % 2 === 0;
  if (h.leaving && Math.hypot(h.pos.x - p.x, h.pos.z - p.z) > 380) {
    game.engine.scene.remove(h.group);
    force.heli = null;
  }
}
