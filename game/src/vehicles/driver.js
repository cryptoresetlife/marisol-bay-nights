// AI driving: pure-pursuit steering toward a point, speed control, obstacle scanning ahead of the
// bumper, and road-graph routes that police, racers and mission cars follow across the city.
import { clamp } from '../core/rng.js';
import { findRoadPath, nearestNode, GRID, directionBetween, rightOf, DIR_X, DIR_Z } from '../world/roads.js';

export function steerToward(v, tx, tz, targetSpeed, { gain = 1.9, reverseOk = true } = {}) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const rx = -fz, rz = fx;
  const dx = tx - v.pos.x, dz = tz - v.pos.z;
  const lz = dx * fx + dz * fz, lx = dx * rx + dz * rz;
  const angle = Math.atan2(lx, lz);
  const c = v.controls;
  if (reverseOk && lz < -2 && Math.abs(angle) > 2.3 && Math.hypot(dx, dz) < 14) {
    // target is right behind: back up with opposite lock
    c.steer = -Math.sign(lx || 1);
    c.throttle = -0.7;
    c.handbrake = false;
    return angle;
  }
  c.steer = clamp(angle * gain, -1, 1);
  const turnSlow = 1 - Math.min(0.6, Math.abs(angle) * 0.5);
  const want = targetSpeed * turnSlow;
  const err = want - v.forwardSpeed;
  c.throttle = clamp(err * 0.45, -1, 1);
  c.handbrake = false;
  return angle;
}

// Closest thing in front of the car: other cars, people or the player. Returns the gap in metres.
export function scanAhead(game, v, range, halfWidth = 1.7) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const rx = -fz, rz = fx;
  let best = Infinity;
  const consider = (x, z, extra) => {
    const dx = x - v.pos.x, dz = z - v.pos.z;
    const lz = dx * fx + dz * fz;
    if (lz <= 0 || lz > range + extra) return;
    const lx = dx * rx + dz * rz;
    if (Math.abs(lx) < halfWidth + extra * 0.3) best = Math.min(best, lz - extra);
  };
  for (const o of game.vehicles) if (o !== v) consider(o.pos.x, o.pos.z, o.type.len / 2 + v.type.len / 2);
  for (const p of game.peds) if (!p.down && !p.inVehicle) consider(p.pos.x, p.pos.z, v.type.len / 2);
  if (!game.player.vehicle && game.player.alive) consider(game.player.pos.x, game.player.pos.z, v.type.len / 2);
  return best;
}

// Waypoints along the road grid from near (x, z) to near (tx, tz), on the right-hand lane.
export function planRoute(game, x, z, tx, tz, lane = GRID.laneOffset, heading = null) {
  const roads = game.city.roads;
  let a = nearestNode(roads, x, z);
  const b = nearestNode(roads, tx, tz);
  let noFirst = -1;
  if (heading !== null) {
    // start from the intersection in front of the car and never U-turn there
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let d = 0, best = -2;
    for (let k = 0; k < 4; k++) { const dot = DIR_X[k] * fx + DIR_Z[k] * fz; if (dot > best) { best = dot; d = k; } }
    if ((a.x - x) * fx + (a.z - z) * fz < 0 && a.links[d] >= 0) a = roads.nodes[a.links[d]];
    noFirst = (d + 2) % 4;
  }
  const ids = findRoadPath(roads, a.id, b.id, noFirst);
  const pts = [];
  for (let k = 0; k < ids.length; k++) {
    const n = roads.nodes[ids[k]];
    if (k < ids.length - 1) {
      const d = directionBetween(n, roads.nodes[ids[k + 1]]);
      const r = rightOf(d);
      pts.push({ x: n.x + r.x * lane, z: n.z + r.z * lane });
    } else pts.push({ x: n.x, z: n.z });
  }
  pts.push({ x: tx, z: tz });
  return pts;
}

export function followRoute(v, route, targetSpeed, reach = 7) {
  while (route.length > 1 && Math.hypot(route[0].x - v.pos.x, route[0].z - v.pos.z) < reach) route.shift();
  const wp = route[0];
  if (!wp) return Infinity;
  steerToward(v, wp.x, wp.z, targetSpeed);
  return Math.hypot(wp.x - v.pos.x, wp.z - v.pos.z);
}
