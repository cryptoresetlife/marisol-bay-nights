// Roadblocks from three stars: two cruisers parked nose to nose across the road ahead of Dez, striped
// barriers and officers taking cover behind them, announced over the police radio.
import * as THREE from 'three';
import { spawnPoliceCruiser } from './police.js';
import { spawnGunman } from '../combat/gunmen.js';
import { nearestNode, DIR_X, DIR_Z, GRID } from '../world/roads.js';
import { streetNameAt } from '../world/districts.js';
import { makeStripeTexture } from '../world/textures.js';

export function createRoadblocks() {
  return { active: null, timer: 8 };
}

function travelDirection(game) {
  const v = game.player.vehicle;
  const yaw = v ? v.yaw : game.player.yaw;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let best = 0, bd = -2;
  for (let d = 0; d < 4; d++) {
    const dot = DIR_X[d] * fx + DIR_Z[d] * fz;
    if (dot > bd) { bd = dot; best = d; }
  }
  return best;
}

export function placeRoadblock(game, { x, z, axis } = {}) {
  const roads = game.city.roads;
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  if (x === undefined) {
    const d = travelDirection(game);
    let node = nearestNode(roads, p.x, p.z);
    for (let k = 0; k < 2 && node.links[d] >= 0; k++) node = roads.nodes[node.links[d]];
    if (Math.hypot(node.x - p.x, node.z - p.z) < 70) return null;
    // block the road just before that intersection, facing the player
    x = node.x - DIR_X[d] * (GRID.halfRoad + 14);
    z = node.z - DIR_Z[d] * (GRID.halfRoad + 14);
    axis = d % 2 === 0 ? 'EW' : 'NS';
  }
  const across = axis === 'EW' ? { x: 0, z: 1 } : { x: 1, z: 0 };
  const along = axis === 'EW' ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const cars = [];
  for (const s of [-1, 1]) {
    const yaw = Math.atan2(across.x, across.z) + (s > 0 ? 0.35 : Math.PI - 0.35);
    const v = spawnPoliceCruiser(game, { x: x + across.x * s * 3.6, z: z + across.z * s * 3.6, yaw, mode: 'roadblock' });
    v.ai.state = 'roadblock';
    v.siren = true;
    v.ai.deployed = true;
    cars.push(v);
  }
  const barriers = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: makeStripeTexture('#ff3b30', '#ffffff'), roughness: 0.6 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(across.x ? 3.2 : 0.25, 0.5, across.z ? 3.2 : 0.25), mat);
    b.position.set(x + across.x * s * 7.4 + along.x * 2.5, 0.75, z + across.z * s * 7.4 + along.z * 2.5);
    barriers.add(b);
    for (const leg of [-1.2, 1.2]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: '#333' }));
      l.position.set(b.position.x + across.x * leg, 0.4, b.position.z + across.z * leg);
      barriers.add(l);
    }
  }
  game.engine.scene.add(barriers);
  const cops = [];
  for (let k = 0; k < 3; k++) {
    const off = (k - 1) * 3.5;
    cops.push(spawnGunman(game, x + across.x * off - along.x * 3.5, z + across.z * off - along.z * 3.5, {
      faction: game.wanted.level >= 5 ? 'swat' : 'police', weapon: k === 1 ? 'shotgun' : 'pistol', holdPosition: true, accuracy: 0.85,
    }));
  }
  const block = { x, z, cars, barriers, cops, age: 0 };
  game.roadblocks.active = block;
  game.events.emit('dispatch', { text: `Dispatch: roadblock set up on ${streetNameAt(x, z)}` });
  return block;
}

export function updateRoadblocks(game, dt) {
  const rb = game.roadblocks;
  const p = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  if (rb.active) {
    rb.active.age += dt;
    const d = Math.hypot(rb.active.x - p.x, rb.active.z - p.z);
    if (rb.active.age > 80 && d > 140 || game.wanted.level === 0 && d > 120) {
      game.engine.scene.remove(rb.active.barriers);
      for (const v of rb.active.cars) if (v.ai) v.ai.state = 'leave';
      rb.active = null;
    }
    return;
  }
  if (game.wanted.level < 3) return;
  rb.timer -= dt;
  if (rb.timer <= 0) {
    rb.timer = 30;
    placeRoadblock(game);
  }
}
