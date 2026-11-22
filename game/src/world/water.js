// The sea and Sunset Beach: animated water, sand sloping into the surf, foam, umbrellas and towels,
// lifeguard towers, sailboats in the bay and The Pier with its Ferris wheel.
import * as THREE from 'three';
import { SHORE_X, PIER, WATER_LEVEL, QUAY_EDGE_Z, BEACH_START_X, groundHeight } from './terrain.js';
import { GeometryBatch, batchMesh, placeMatrix } from './geometry.js';
import { makeWaterNormalTexture, makeSandTexture, makePlankTexture } from './textures.js';
import { addCollisionBox } from '../systems/collisions.js';
import { randRange, pickOne } from '../core/rng.js';

export function buildSeaAndBeach(scene, collisions, rng) {
  const group = new THREE.Group();
  group.name = 'sea';

  const normal = makeWaterNormalTexture();
  normal.repeat.set(220, 220);
  const seaMat = new THREE.MeshStandardMaterial({ color: '#1593b5', roughness: 0.06, metalness: 0.25, normalMap: normal, normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.94 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(1200, WATER_LEVEL, 0);
  sea.receiveShadow = true;
  group.add(sea);

  // sand: a strip of quads following the beach profile down below the waterline
  const sand = new GeometryBatch();
  const xs = [BEACH_START_X + 6, 340, 350, 365, 380, 392, 405, 430, 470];
  for (let k = 0; k < xs.length - 1; k++) {
    const x0 = xs[k], x1 = xs[k + 1];
    const y0 = groundHeight(x0, 0), y1 = groundHeight(x1, 0);
    const z0 = -1400, z1 = QUAY_EDGE_Z + 2;
    sand.quad([x0, y0, z1], [x1, y1, z1], [x1, y1, z0], [x0, y0, z0], [0, 1, 0],
      [[x0 / 6, z1 / 6], [x1 / 6, z1 / 6], [x1 / 6, z0 / 6], [x0 / 6, z0 / 6]], k > 4 ? '#c9b48a' : '#ffffff');
  }
  group.add(batchMesh(sand, new THREE.MeshStandardMaterial({ map: makeSandTexture(), vertexColors: true, roughness: 1 }), { castShadow: false }));

  // shallow turquoise band and surf foam
  const shallowMat = new THREE.MeshBasicMaterial({ color: '#5fe0d6', transparent: true, opacity: 0.35, depthWrite: false });
  const shallow = new THREE.Mesh(new THREE.PlaneGeometry(40, 2800), shallowMat);
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.set(SHORE_X + 20, WATER_LEVEL + 0.03, -400);
  group.add(shallow);
  const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 2800), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(SHORE_X + 1, WATER_LEVEL + 0.05, -400);
  group.add(foam);

  // umbrellas, towels and lifeguard towers on the sand
  const umb = new GeometryBatch();
  const stripes = ['#ff5f7a', '#ffd166', '#3fc1c9', '#ff9f1c', '#9b5de5', '#06d6a0', '#f15bb5'];
  for (let z = -300; z < 320; z += randRange(rng, 9, 16)) {
    const x = randRange(rng, 342, 378);
    const y = groundHeight(x, z);
    const c = pickOne(rng, stripes);
    umb.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), placeMatrix(x, y + 1.2, z), '#eeeeee');
    const canopy = new THREE.ConeGeometry(1.7, 0.7, 8, 1, true);
    umb.mesh(canopy, placeMatrix(x, y + 2.5, z, 0.12, rng() * 6, 0), c);
    umb.mesh(new THREE.BoxGeometry(0.9, 0.03, 1.9), placeMatrix(x + 1.6, y + 0.03, z + randRange(rng, -1, 1), 0, rng(), 0), pickOne(rng, stripes));
  }
  for (const z of [-250, -130, 60, 200]) {
    const x = 366, y = groundHeight(x, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) umb.mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), placeMatrix(x + dx, y + 1.3, z + dz), '#f5f5f5');
    umb.box(x, y + 2.6, z, 2.8, 2.2, 2.8, '#ff6f91', { roofColor: '#ffd166' });
    umb.mesh(new THREE.ConeGeometry(2.2, 1.1, 4), placeMatrix(x, y + 5.35, z, 0, Math.PI / 4, 0), '#3fc1c9');
    addCollisionBox(collisions, x - 1.5, z - 1.5, x + 1.5, z + 1.5, 6, 'pole');
  }
  group.add(batchMesh(umb, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide })));

  group.add(buildPier(collisions));
  const wheel = buildFerrisWheel();
  group.add(wheel.group);

  const boats = [];
  for (let k = 0; k < 7; k++) {
    const boat = buildSailboat(pickOne(rng, ['#ffffff', '#f2f6ff', '#ffe9e0']));
    boat.position.set(randRange(rng, 460, 760), WATER_LEVEL, randRange(rng, -420, 380));
    boat.rotation.y = rng() * 6;
    group.add(boat);
    boats.push({ mesh: boat, phase: rng() * 6, speed: randRange(rng, 0.6, 1.6) });
  }

  // invisible walls at the waterline
  addCollisionBox(collisions, SHORE_X + 4, -3000, 3000, PIER.z0, 3, 'water');
  addCollisionBox(collisions, SHORE_X + 4, PIER.z1, 3000, 3000, 3, 'water');
  addCollisionBox(collisions, PIER.x1, PIER.z0 - 1, 3000, PIER.z1 + 1, 3, 'water');
  addCollisionBox(collisions, -3000, QUAY_EDGE_Z, SHORE_X + 4, 3000, 3, 'water');

  scene.add(group);
  return { group, seaMat, normal, foamMat, wheel, boats };
}

function buildPier(collisions) {
  const b = new GeometryBatch();
  const { x0, x1, z0, z1, deck } = PIER;
  const w = z1 - z0;
  b.box((x0 + x1) / 2 + 5, deck - 0.3, (z0 + z1) / 2, x1 - x0 - 10, 0.3, w, '#ffffff', { tileW: 0, tileH: 0 });
  const posts = new GeometryBatch();
  for (let x = x0 + 12; x < x1; x += 8) {
    for (const z of [z0 + 0.6, z1 - 0.6]) {
      posts.mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), placeMatrix(x, deck - 2.3, z), '#5b4330');
      posts.box(x, deck, z, 0.18, 1.1, 0.18, '#f4efe6');
    }
  }
  posts.box((x0 + x1) / 2 + 5, deck + 1.0, z0 + 0.6, x1 - x0 - 10, 0.12, 0.12, '#f4efe6');
  posts.box((x0 + x1) / 2 + 5, deck + 1.0, z1 - 0.6, x1 - x0 - 10, 0.12, 0.12, '#f4efe6');
  // little arcade huts at the far end
  for (const [hx, c] of [[470, '#ff6f91'], [490, '#3fc1c9'], [510, '#ffd166']]) {
    posts.box(hx, deck, z0 + 2.8, 6, 3.2, 3.5, c, { roofColor: '#fff3e0' });
    addCollisionBox(collisions, hx - 3, z0 + 1, hx + 3, z0 + 4.6, 4, 'building');
  }
  const g = new THREE.Group();
  const plank = makePlankTexture();
  plank.repeat.set(1, 1);
  const deckMat = new THREE.MeshStandardMaterial({ map: plank, vertexColors: true, roughness: 0.85 });
  const deckGeo = b.build();
  // planks repeat across the deck
  const uv = deckGeo.attributes.uv, pos = deckGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.receiveShadow = true;
  g.add(deckMesh);
  g.add(batchMesh(posts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  addCollisionBox(collisions, x0 + 8, z0 - 1, x1, z0 + 0.2, 2.5, 'rail');
  addCollisionBox(collisions, x0 + 8, z1 - 0.2, x1, z1 + 1, 2.5, 'rail');
  return g;
}

function buildFerrisWheel() {
  const group = new THREE.Group();
  const hub = new THREE.Group();
  const R = 22, cx = 535, cz = (PIER.z0 + PIER.z1) / 2, cy = PIER.deck + R + 3;
  const frame = new GeometryBatch();
  frame.mesh(new THREE.TorusGeometry(R, 0.35, 6, 48), placeMatrix(0, 0, -1.2), '#f4f4f4');
  frame.mesh(new THREE.TorusGeometry(R, 0.35, 6, 48), placeMatrix(0, 0, 1.2), '#f4f4f4');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    frame.mesh(new THREE.BoxGeometry(0.25, R, 0.25), placeMatrix(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, 0, 0, a - Math.PI / 2), '#e8e8e8');
  }
  hub.add(batchMesh(frame, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 })));
  const cars = [];
  const carColors = ['#ff5f7a', '#ffd166', '#3fc1c9', '#9b5de5', '#06d6a0', '#ff9f1c'];
  const carGeo = new THREE.BoxGeometry(2.2, 2, 2.2);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const car = new THREE.Mesh(carGeo, new THREE.MeshStandardMaterial({ color: carColors[k % carColors.length], roughness: 0.5 }));
    car.position.set(Math.cos(a) * R, Math.sin(a) * R - 1.4, 0);
    hub.add(car);
    cars.push(car);
  }
  // neon rim lights for the night
  const rimMat = new THREE.MeshBasicMaterial({ color: '#ff4fd8', toneMapped: false, transparent: true, opacity: 0.25 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.4, 0.18, 4, 64), rimMat);
  hub.add(rim);
  hub.position.set(cx, cy, cz);
  hub.rotation.y = Math.PI / 2;
  group.add(hub);
  const legs = new GeometryBatch();
  const spread = 10, len = Math.hypot(cy, spread);
  const tilt = Math.atan2(spread, cy);
  for (const s of [-1, 1]) {
    legs.mesh(new THREE.BoxGeometry(0.6, len, 0.6), placeMatrix(cx + s * 3, cy / 2, cz - spread / 2, tilt, 0, 0), '#dcdcdc');
    legs.mesh(new THREE.BoxGeometry(0.6, len, 0.6), placeMatrix(cx + s * 3, cy / 2, cz + spread / 2, -tilt, 0, 0), '#dcdcdc');
  }
  group.add(batchMesh(legs, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 })));
  return { group, hub, cars, rimMat };
}

function buildSailboat(color) {
  const b = new GeometryBatch();
  b.mesh(new THREE.BoxGeometry(2.4, 1.0, 8), placeMatrix(0, 0.5, 0), color);
  b.mesh(new THREE.ConeGeometry(1.2, 2.5, 4), placeMatrix(0, 0.5, 5.2, Math.PI / 2, 0, 0, 1, 1, 0.8), color);
  b.mesh(new THREE.CylinderGeometry(0.08, 0.08, 11, 5), placeMatrix(0, 6.5, 0.5), '#dddddd');
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.6, 0.6, 0, 11.5, 0.6, 0, 1.6, -3.6], 3));
  sail.computeVertexNormals();
  b.mesh(sail, placeMatrix(0.05, 0, 0), '#fffdf5');
  return batchMesh(b, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
}

export function updateSea(sea, t, night) {
  sea.normal.offset.set(t * 0.004, t * 0.0025);
  sea.foamMat.opacity = 0.45 + Math.sin(t * 1.3) * 0.2;
  sea.wheel.hub.rotation.z = t * 0.05;
  for (const car of sea.wheel.cars) car.rotation.z = -sea.wheel.hub.rotation.z;
  sea.wheel.rimMat.opacity = 0.25 + night * 0.75;
  for (const b of sea.boats) {
    b.mesh.position.y = WATER_LEVEL + Math.sin(t * b.speed + b.phase) * 0.15;
    b.mesh.rotation.z = Math.sin(t * b.speed * 0.8 + b.phase) * 0.05;
  }
}
