// Civilian traffic: cars spawned on lanes around the player that keep to the right-hand lane, stop for red
// lights and for whatever is in front of them, turn at intersections, honk, panic at gunfire, and parked
// cars along the kerbs that can be stolen.
import { GRID, DIR_X, DIR_Z, DIR_YAW, laneExitPoint, laneStopPoint, rightOf, trafficLightState, nearestNode } from '../world/roads.js';
import { CIVILIAN_TYPES } from './carModels.js';
import { createVehicle, removeVehicle } from './vehicle.js';
import { steerToward, scanAhead } from './driver.js';
import { randomLook } from '../characters/characterModel.js';
import { clamp } from '../core/rng.js';

const SPAWN_MIN = 70, SPAWN_MAX = 190, DESPAWN = 240;
const CRUISE = 12.5;

export function spawnTraffic(game, count = 1) {
  for (let k = 0; k < count; k++) spawnTrafficCar(game);
}

function randomSegmentNear(game, minD, maxD) {
  const roads = game.city.roads;
  const p = game.player.pos;
  for (let tries = 0; tries < 30; tries++) {
    const node = roads.nodes[Math.floor(Math.random() * roads.nodes.length)];
    const d = Math.floor(Math.random() * 4);
    const next = node.links[d];
    if (next < 0) continue;
    const to = roads.nodes[next];
    const s = 0.15 + Math.random() * 0.7;
    const x = node.x + (to.x - node.x) * s, z = node.z + (to.z - node.z) * s;
    const dist = Math.hypot(x - p.x, z - p.z);
    if (dist < minD || dist > maxD) continue;
    return { node, to, d, s };
  }
  return null;
}

function spotFree(game, x, z, r = 9) {
  return !game.vehicles.some((v) => Math.hypot(v.pos.x - x, v.pos.z - z) < r);
}

export function spawnTrafficCar(game, { near = null, type = null } = {}) {
  const seg = near || randomSegmentNear(game, SPAWN_MIN, SPAWN_MAX);
  if (!seg) return null;
  const a = laneExitPoint(seg.node, seg.d), b = laneStopPoint(seg.to, seg.d);
  const x = a.x + (b.x - a.x) * seg.s, z = a.z + (b.z - a.z) * seg.s;
  if (!spotFree(game, x, z)) return null;
  const key = type || CIVILIAN_TYPES[Math.floor(Math.random() * CIVILIAN_TYPES.length)];
  const v = createVehicle(game, key, { x, z, yaw: DIR_YAW[seg.d] });
  v.driver = { look: randomLook() };
  v.ai = { mode: 'traffic', next: seg.to.id, dir: seg.d, waypoints: [{ ...b, stop: seg.to.id, dir: seg.d }], blocked: 0, panic: 0, stall: 0 };
  const sp = CRUISE * 0.7;
  v.vel.x = DIR_X[seg.d] * sp; v.vel.z = DIR_Z[seg.d] * sp;
  return v;
}

export function spawnParkedCar(game) {
  const seg = randomSegmentNear(game, 50, 160);
  if (!seg) return null;
  const a = laneExitPoint(seg.node, seg.d, GRID.parkOffset), b = laneStopPoint(seg.to, seg.d, GRID.parkOffset);
  const x = a.x + (b.x - a.x) * seg.s, z = a.z + (b.z - a.z) * seg.s;
  if (!spotFree(game, x, z, 7)) return null;
  const key = CIVILIAN_TYPES[Math.floor(Math.random() * CIVILIAN_TYPES.length)];
  return createVehicle(game, key, { x, z, yaw: DIR_YAW[seg.d], parked: true });
}

// Appends the turn through `node` and the run to the next stop line.
function planNextLeg(game, ai, nodeId, dir) {
  const roads = game.city.roads;
  const node = roads.nodes[nodeId];
  const options = [];
  for (let nd = 0; nd < 4; nd++) {
    if (nd === (dir + 2) % 4 || node.links[nd] < 0) continue;
    options.push(nd, nd === dir ? nd : -1); // straight is twice as likely
  }
  const choices = options.filter((o) => o >= 0);
  const nd = choices.length ? choices[Math.floor(Math.random() * choices.length)] : (dir + 2) % 4;
  const start = laneStopPoint(node, dir);
  const exit = laneExitPoint(node, nd);
  if (nd !== dir) {
    const r1 = rightOf(dir), r2 = rightOf(nd);
    const cx = node.x + (r1.x + r2.x) * GRID.laneOffset, cz = node.z + (r1.z + r2.z) * GRID.laneOffset;
    for (const t of [0.3, 0.55, 0.8]) {
      const u = 1 - t;
      ai.waypoints.push({ x: u * u * start.x + 2 * u * t * cx + t * t * exit.x, z: u * u * start.z + 2 * u * t * cz + t * t * exit.z, turn: true });
    }
  }
  ai.waypoints.push({ ...exit, turn: nd !== dir });
  const to = roads.nodes[node.links[nd]];
  ai.waypoints.push({ ...laneStopPoint(to, nd), stop: to.id, dir: nd });
  ai.next = to.id;
  ai.dir = nd;
}

function resnap(game, v) {
  const roads = game.city.roads;
  const node = nearestNode(roads, v.pos.x, v.pos.z);
  let best = 0, bestDot = -2;
  for (let d = 0; d < 4; d++) {
    if (node.links[d] < 0) continue;
    const dot = DIR_X[d] * Math.sin(v.yaw) + DIR_Z[d] * Math.cos(v.yaw);
    if (dot > bestDot) { bestDot = dot; best = d; }
  }
  const to = roads.nodes[node.links[best]];
  v.ai.waypoints = [{ ...laneExitPoint(node, best) }, { ...laneStopPoint(to, best), stop: to.id, dir: best }];
  v.ai.next = to.id;
  v.ai.dir = best;
}

export function driveTrafficCar(game, v, dt) {
  const ai = v.ai;
  if (ai.stall > 0) { ai.stall -= dt; v.controls.throttle = 0; v.controls.handbrake = true; return; }
  let wp = ai.waypoints[0];
  if (!wp) { resnap(game, v); return; }
  let dist = Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z);
  if (dist > 30) { resnap(game, v); return; }
  // consume reached waypoints; a stop line opens up the next leg
  const reach = wp.turn ? 3.2 : 2.2;
  if (dist < reach || (wp.stop === undefined && passed(v, wp))) {
    if (wp.stop !== undefined) planNextLeg(game, ai, wp.stop, wp.dir);
    ai.waypoints.shift();
    wp = ai.waypoints[0];
    dist = Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z);
  }
  const panicking = ai.panic > 0;
  if (panicking) ai.panic -= dt;
  let target = panicking ? CRUISE * 1.6 : CRUISE;
  if (wp.turn) target = Math.min(target, 7.5);
  // traffic light ahead
  if (wp.stop !== undefined && !panicking) {
    const node = game.city.roads.nodes[wp.stop];
    const light = trafficLightState(game.city.roads, node, wp.dir);
    if (light === 'R' || (light === 'Y' && dist > 9)) target = Math.min(target, Math.sqrt(Math.max(0, dist - 0.8) * 9));
    if (light === 'G' && ai.waypoints.length > 1 && dist < 12) target = Math.min(target, 9);
  }
  // keep a gap to whatever is ahead
  const gap = scanAhead(game, v, 6 + Math.abs(v.forwardSpeed) * 1.3);
  if (gap < Infinity) {
    target = Math.min(target, Math.max(0, (gap - 2.2) * 1.3));
    if (gap < 3 && Math.abs(v.forwardSpeed) < 1) ai.blocked += dt; else ai.blocked = Math.max(0, ai.blocked - dt);
    if (ai.blocked > 3.5) { game.events.emit('horn', { vehicle: v }); ai.blocked = 0.5; }
  } else ai.blocked = 0;
  // look a little past the waypoint for smoother lines
  let tx = wp.x, tz = wp.z;
  const after = ai.waypoints[1];
  if (after && dist < 6) { tx = wp.x * 0.5 + after.x * 0.5; tz = wp.z * 0.5 + after.z * 0.5; }
  steerToward(v, tx, tz, target, { gain: 2.1, reverseOk: false });
  if (target < 0.5 && v.forwardSpeed < 2) { v.controls.throttle = v.forwardSpeed > 0.2 ? -0.6 : 0; v.controls.handbrake = v.forwardSpeed < 0.3; }
}

function passed(v, wp) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  return (wp.x - v.pos.x) * fx + (wp.z - v.pos.z) * fz < -0.5;
}

export function updateTraffic(game, dt) {
  const p = game.player.pos;
  let moving = 0, parked = 0;
  for (let i = game.vehicles.length - 1; i >= 0; i--) {
    const v = game.vehicles[i];
    const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
    const owned = v === game.player.vehicle || v.mission || v.ai?.mode === 'police' || v.ai?.mode === 'race';
    if (!owned && d > DESPAWN) { removeVehicle(game, v); continue; }
    if (v.ai?.mode === 'traffic' && v.driver) { moving++; if (!v.destroyed) driveTrafficCar(game, v, dt); }
    else if (v.parked) parked++;
    if (!v.driver && v !== game.player.vehicle && !v.parked && v.ai?.mode !== 'police' && v.ai?.mode !== 'race') {
      v.controls.throttle = 0; v.controls.steer = 0; v.controls.handbrake = Math.abs(v.forwardSpeed) < 3;
    }
  }
  const want = Math.round(game.settings.trafficDensity * 26);
  if (moving < want && Math.random() < 0.5) spawnTrafficCar(game);
  if (parked < 10 && Math.random() < 0.2) spawnParkedCar(game);
}

export function panicTrafficNear(game, x, z, radius = 45) {
  for (const v of game.vehicles) {
    if (v.ai?.mode === 'traffic' && Math.hypot(v.pos.x - x, v.pos.z - z) < radius) v.ai.panic = 6 + Math.random() * 4;
  }
}

export function stallVehicle(v, seconds) {
  if (v.ai?.mode === 'traffic') v.ai.stall = Math.max(v.ai.stall, clamp(seconds, 0, 4));
}
