// Builds Marisol Bay: the road network, street surfaces, buildings, props, sea, beach, pier, sky and the
// hills on the horizon, and returns everything the simulation needs to look up.
import * as THREE from 'three';
import { buildRoadNetwork } from './roads.js';
import { buildStreetSurfaces } from './streets.js';
import { buildBuildings } from './buildings.js';
import { buildProps, buildDockyardProps } from './props.js';
import { buildSeaAndBeach } from './water.js';
import { buildSky } from './sky.js';
import { createDayNight } from './daynight.js';
import { createCollisionWorld, addCollisionBox } from '../systems/collisions.js';
import { createRng, randRange } from '../core/rng.js';
import { WORLD_WEST, WORLD_NORTH } from './terrain.js';
import { makeSignTexture } from './textures.js';

export function buildCity(scene, { shadows = true } = {}) {
  const rng = createRng(1985);
  const roads = buildRoadNetwork();
  const collisions = createCollisionWorld();
  const streets = buildStreetSurfaces(scene);
  const buildings = buildBuildings(scene, collisions, rng);
  const props = buildProps(scene, roads, collisions, rng, buildings.yards);
  buildDockyardProps(scene, collisions, rng);
  const sea = buildSeaAndBeach(scene, collisions, rng);
  buildHorizonHills(scene, rng);
  const sky = buildSky(scene);
  const dayNight = createDayNight(scene, sky, { shadows });
  // the edge of the map: scrub and hills to the west and north
  addCollisionBox(collisions, -3000, -3000, WORLD_WEST, 3000, 10, 'edge');
  addCollisionBox(collisions, -3000, -3000, 3000, WORLD_NORTH, 10, 'edge');
  return { roads, collisions, streets, buildings, props, sea, sky, dayNight, lakes: streets.lakes };
}

function buildHorizonHills(scene, rng) {
  const geo = new THREE.ConeGeometry(1, 1, 7, 1);
  const mat = new THREE.MeshStandardMaterial({ color: '#6f9a63', roughness: 1, flatShading: true });
  const group = new THREE.Group();
  for (let k = 0; k < 26; k++) {
    const a = Math.PI * 0.55 + (k / 26) * Math.PI * 1.05; // west and north arc
    const r = randRange(rng, 700, 1000);
    const m = new THREE.Mesh(geo, mat);
    const h = randRange(rng, 60, 170);
    m.scale.set(randRange(rng, 160, 280), h, randRange(rng, 140, 240));
    m.position.set(Math.cos(a) * r, h / 2 - 4, -Math.abs(Math.sin(a)) * r * 0.9 + 80);
    m.rotation.y = rng() * 6;
    group.add(m);
  }
  // the hillside letters that greet everyone driving west
  const letters = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 46),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('MARISOL BAY', { fg: '#ffffff', bg: null, w: 1024, h: 180, font: 'bold 150px Impact, "Arial Black", sans-serif' }), transparent: true, depthWrite: false }),
  );
  letters.position.set(-640, 58, -60);
  letters.rotation.set(0, Math.PI / 2, 0);
  const hill = new THREE.Mesh(geo, mat);
  hill.scale.set(330, 120, 260);
  hill.position.set(-700, 56, -60);
  group.add(hill, letters);
  scene.add(group);
}
