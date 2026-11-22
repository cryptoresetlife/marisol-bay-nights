// Side activities: taxi fares (press T in a Marisol Cab to go on duty, pick up, drop off, beat the meter)
// and twenty hidden Lucky Gecko statuettes worth cash.
import * as THREE from 'three';
import { spawnPedestrian, removePedestrian } from '../characters/pedestrians.js';
import { createMarker, removeMarker } from './markers.js';
import { showEvent, showBanner } from '../ui/hud.js';
import { addMoney } from '../economy/money.js';
import { wasKeyPressed } from '../core/input.js';
import { doorPoint, vehicleSpeed } from '../vehicles/vehicle.js';
import { LANDMARKS, landmarkCurb } from '../world/landmarks.js';
import { GRID } from '../world/roads.js';
import { groundHeight } from '../world/terrain.js';
import { createRng } from '../core/rng.js';

export const GECKO_SPOTS = [
  [338, -200], [355, 40], [372, 280], [540, -45], [-160, -100], [-120, -110], [-300, 342], [-140, 338],
  [-45, 0], [225, -225], [-45, 225], [135, 315], [-315, -315], [315, -330], [-225, 45], [90, -135],
  [180, 135], [-270, -225], [270, 45], [-90, -315],
];

export function createSideJobs() {
  return { taxi: null, collected: new Set(), geckos: [], raceBest: null, taxiFares: 0 };
}

export function buildGeckos(game) {
  const geo = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#39ff88', emissive: '#18c95a', emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.3 });
  const body = new THREE.CapsuleGeometry(0.12, 0.45, 4, 8);
  body.rotateX(Math.PI / 2);
  const tail = new THREE.ConeGeometry(0.07, 0.5, 6);
  tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -0.45);
  const head = new THREE.SphereGeometry(0.14, 8, 6);
  head.translate(0, 0.02, 0.33);
  for (const [k, [x, z]] of GECKO_SPOTS.entries()) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(body, mat), new THREE.Mesh(tail, mat), new THREE.Mesh(head, mat));
    g.position.set(x, groundHeight(x, z) + 0.8, z);
    g.visible = !game.sideJobs.collected.has(k);
    geo.add(g);
    game.sideJobs.geckos.push({ id: k, mesh: g, x, z });
  }
  game.engine.scene.add(geo);
}

function updateGeckos(game, dt) {
  const sj = game.sideJobs;
  const pos = game.player.vehicle ? game.player.vehicle.pos : game.player.pos;
  for (const g of sj.geckos) {
    if (sj.collected.has(g.id)) { g.mesh.visible = false; continue; }
    g.mesh.rotation.y += dt * 1.8;
    g.mesh.position.y = groundHeight(g.x, g.z) + 0.8 + Math.sin(game.time * 2 + g.id) * 0.15;
    if (Math.hypot(pos.x - g.x, pos.z - g.z) < 2) {
      sj.collected.add(g.id);
      addMoney(game, 250, 'gecko');
      showEvent(game, `Lucky Gecko found · ${sj.collected.size} / ${GECKO_SPOTS.length}`, '#39ff88');
      if (sj.collected.size === GECKO_SPOTS.length) { addMoney(game, 5000, 'gecko'); showBanner(game, 'ALL GECKOS FOUND', '+$5,000 bonus', '#39ff88', 4); }
    }
  }
}

const rng = createRng(77);

function randomCurb(game, minD, maxD) {
  const p = game.player.vehicle.pos;
  for (let k = 0; k < 40; k++) {
    const lm = LANDMARKS[Math.floor(rng() * LANDMARKS.length)];
    let c = landmarkCurb(lm);
    if (rng() < 0.6) {
      const i = Math.floor(rng() * GRID.count), j = Math.floor(rng() * (GRID.count - 1));
      c = { x: GRID.origin + i * GRID.pitch + 10.5, z: GRID.origin + j * GRID.pitch + 45 };
    }
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d > minD && d < maxD) return c;
  }
  return { x: p.x + 150, z: p.z };
}

function newFare(game, taxi) {
  const c = randomCurb(game, 70, 220);
  taxi.fare = { stage: 'pickup', at: c, ped: spawnPedestrian(game, c.x + 1.5, c.z, { state: 'scripted' }) };
  taxi.fare.ped.health = 9999;
  taxi.marker = createMarker(game, c.x, c.z, { color: '#ffe14d', radius: 4 });
}

export function updateSideJobs(game, dt) {
  updateGeckos(game, dt);
  const sj = game.sideJobs;
  const pv = game.player.vehicle;
  const inCab = pv && pv.typeKey === 'taxi';
  if (inCab && !sj.taxi && !game.activeMission && !game.sideActivity && game.mode === 'play' && wasKeyPressed(game.input, 'KeyT')) {
    sj.taxi = { fare: null, marker: null, streak: 0 };
    game.sideActivity = 'taxi';
    showEvent(game, 'Taxi duty: on. Press T to clock off.', '#ffe14d');
    newFare(game, sj.taxi);
    return;
  }
  const taxi = sj.taxi;
  if (!taxi) return;
  if (!inCab || (game.mode === 'play' && wasKeyPressed(game.input, 'KeyT'))) { endTaxi(game, 'Taxi duty: off'); return; }
  const f = taxi.fare;
  const d = Math.hypot(pv.pos.x - f.at.x, pv.pos.z - f.at.z);
  game.missionBlips = [{ x: f.at.x, z: f.at.z, glyph: '$', color: '#ffe14d', kind: 'target' }];
  if (f.stage === 'pickup') {
    game.missionHud = { chapter: 'Side job', title: 'Marisol Cab', objective: 'Pick up the passenger', counter: `Fares today: ${taxi.streak}` };
    if (d < 9 && vehicleSpeed(pv) < 3) {
      f.ped.state = 'goto'; f.ped.target = doorPoint(pv, -1); f.stage = 'boarding';
    }
  } else if (f.stage === 'boarding') {
    f.ped.target = doorPoint(pv, -1);
    if (Math.hypot(f.ped.pos.x - f.ped.target.x, f.ped.pos.z - f.ped.target.z) < 1.3) {
      removePedestrian(game, f.ped);
      removeMarker(game, taxi.marker);
      const dest = randomCurb(game, 220, 520);
      const dist = Math.hypot(dest.x - pv.pos.x, dest.z - pv.pos.z);
      Object.assign(f, { stage: 'ride', at: dest, time: 12 + dist / 9, pay: Math.round(40 + dist * 0.5) });
      taxi.marker = createMarker(game, dest.x, dest.z, { color: '#ffe14d', radius: 5 });
    }
  } else if (f.stage === 'ride') {
    f.time -= dt;
    game.missionHud = { chapter: 'Side job', title: 'Marisol Cab', objective: 'Drive the passenger to the marker', counter: `Meter $${f.pay} · ${Math.max(0, Math.ceil(f.time))}s left` };
    if (d < 7 && vehicleSpeed(pv) < 4) {
      const tip = f.time > 0 ? Math.round(f.pay * 0.5) : 0;
      addMoney(game, f.pay + tip, 'taxi');
      sj.taxiFares++;
      taxi.streak++;
      showEvent(game, tip ? `Fare paid $${f.pay} + $${tip} tip for speed` : `Fare paid $${f.pay}`, '#ffe14d');
      removeMarker(game, taxi.marker);
      newFare(game, taxi);
    }
  }
}

function endTaxi(game, text) {
  const taxi = game.sideJobs.taxi;
  if (taxi.marker) removeMarker(game, taxi.marker);
  if (taxi.fare?.ped && !taxi.fare.ped.removed) removePedestrian(game, taxi.fare.ped);
  game.sideJobs.taxi = null;
  game.sideActivity = null;
  game.missionHud = null;
  game.missionBlips = [];
  showEvent(game, text, '#ffe14d');
}
