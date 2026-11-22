// Street furniture and greenery: palm trees, park trees, street lamps with night glow, traffic signals whose
// lamps follow the light phases, rooftop billboards, flamingo statues and the Dockyards' containers and cranes.
import * as THREE from 'three';
import { GRID, DIR_X, DIR_Z, rightOf, trafficLightState } from './roads.js';
import { blockDistrict } from './districts.js';
import { blockRect } from './landmarks.js';
import { CURB_HEIGHT, QUAY_START_Z, QUAY_EDGE_Z, BEACH_START_X } from './terrain.js';
import { GeometryBatch, batchMesh, placeMatrix } from './geometry.js';
import { makeSignTexture, makeGlowTexture } from './textures.js';
import { addCollisionBox } from '../systems/collisions.js';
import { randRange, pickOne } from '../core/rng.js';

export function buildPalmGeometry() {
  const b = new GeometryBatch();
  const segs = 7, height = 9;
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs, t1 = (k + 1) / segs;
    const bend = (t) => 0.9 * t * t;
    const g = new THREE.CylinderGeometry(0.22 - t1 * 0.08, 0.26 - t0 * 0.08, height / segs, 7);
    const m = placeMatrix(bend((t0 + t1) / 2), (t0 + t1) / 2 * height, 0, 0, 0, -0.12 * (t0 + t1));
    b.mesh(g, m, k % 2 ? '#8a6a48' : '#7a5c3d');
  }
  const top = new THREE.Vector3(0.9, height, 0);
  for (let f = 0; f < 9; f++) {
    const frond = new THREE.PlaneGeometry(4.6, 1.1, 6, 1);
    const p = frond.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + 2.3; // 0 .. 4.6 along the frond
      const taper = Math.sin(Math.min(1, x / 4.6) * Math.PI) * 0.9 + 0.1;
      p.setXYZ(i, x, -0.09 * x * x, p.getY(i) * taper);
    }
    frond.computeVertexNormals();
    const yaw = (f / 9) * Math.PI * 2 + (f % 2) * 0.2;
    b.mesh(frond, placeMatrix(top.x, top.y, top.z, 0, yaw, 0.35 - (f % 3) * 0.12), f % 2 ? '#2f8f3a' : '#3fa447');
  }
  for (let c = 0; c < 3; c++) b.mesh(new THREE.SphereGeometry(0.16, 6, 4), placeMatrix(top.x + Math.cos(c * 2) * 0.25, top.y - 0.3, Math.sin(c * 2) * 0.25), '#5a3d1e');
  return b.build();
}

function buildTreeGeometry() {
  const b = new GeometryBatch();
  b.mesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), placeMatrix(0, 1.5, 0), '#6b4f35');
  b.mesh(new THREE.IcosahedronGeometry(2.4, 1), placeMatrix(0, 4.4, 0, 0, 0, 0, 1, 0.85, 1), '#3f9b45');
  b.mesh(new THREE.IcosahedronGeometry(1.6, 1), placeMatrix(0.9, 5.4, 0.4), '#4fb052');
  return b.build();
}

function buildLampGeometry() {
  const b = new GeometryBatch();
  b.mesh(new THREE.CylinderGeometry(0.09, 0.14, 7.5, 6), placeMatrix(0, 3.75, 0), '#5b6670');
  b.mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), placeMatrix(0, 7.4, 1.05), '#5b6670');
  b.mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), placeMatrix(0, 7.3, 2.0), '#3d464e');
  return b.build();
}

function buildSignalGeometry() {
  const b = new GeometryBatch();
  b.mesh(new THREE.CylinderGeometry(0.12, 0.15, 6, 6), placeMatrix(0, 3, 0), '#3b4249');
  b.mesh(new THREE.BoxGeometry(0.16, 0.16, 5.6), placeMatrix(0, 5.9, 2.8), '#3b4249');
  b.mesh(new THREE.BoxGeometry(0.55, 1.6, 0.45), placeMatrix(0, 5.4, 4.6), '#1d2226');
  return b.build();
}

function instanced(geometry, material, matrices, { castShadow = true, colors = null } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c)));
  mesh.count = matrices.length;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function buildProps(scene, roads, collisions, rng, yards) {
  const group = new THREE.Group();
  group.name = 'props';
  const palms = [], trees = [], lamps = [], lampHeads = [], signals = [], heads = [], flamingos = [];
  const half = GRID.halfRoad;

  const addPalm = (x, z, s = 1) => {
    palms.push(placeMatrix(x, CURB_HEIGHT, z, 0, rng() * Math.PI * 2, 0, s * randRange(rng, 0.85, 1.2)));
    addCollisionBox(collisions, x - 0.3, z - 0.3, x + 0.3, z + 0.3, 8, 'pole');
  };

  for (let bj = 0; bj < GRID.count - 1; bj++) {
    for (let bi = 0; bi < GRID.count - 1; bi++) {
      const r = blockRect(bi, bj);
      const d = blockDistrict(bi, bj);
      // street lamps on two sides of every block, facing the road
      const off = half + 0.9;
      for (let t = 18; t < GRID.pitch - 10; t += 28) {
        const spots = [
          [r.x0 + t, r.z0 + off, Math.PI], [r.x0 + t, r.z1 - off, 0],
          [r.x0 + off, r.z0 + t, -Math.PI / 2], [r.x1 - off, r.z0 + t, Math.PI / 2],
        ];
        for (const [x, z, yaw] of spots) {
          lamps.push(placeMatrix(x, CURB_HEIGHT, z, 0, yaw, 0));
          lampHeads.push({ x: x + Math.sin(yaw) * 2.0, z: z + Math.cos(yaw) * 2.0 });
          addCollisionBox(collisions, x - 0.2, z - 0.2, x + 0.2, z + 0.2, 7, 'pole');
        }
      }
      if (d.style === 'deco' || d.style === 'villa' || bi === 6) {
        for (let t = 8; t < GRID.pitch - 4; t += 14) {
          if (Math.abs(t - 45) < 6) continue;
          addPalm(r.x1 - 11, r.z0 + t);
          if (d.style === 'villa') addPalm(r.x0 + t, r.z1 - 11);
        }
      }
      if (d.style === 'park') {
        for (let k = 0; k < 16; k++) {
          const x = randRange(rng, r.x0 + 16, r.x1 - 16), z = randRange(rng, r.z0 + 16, r.z1 - 16);
          if (Math.hypot(x - r.cx, z - r.cz) < 26) continue;
          if (rng() < 0.5) addPalm(x, z, 0.9);
          else { trees.push(placeMatrix(x, CURB_HEIGHT, z, 0, rng() * 6, 0, randRange(rng, 0.8, 1.3))); addCollisionBox(collisions, x - 0.4, z - 0.4, x + 0.4, z + 0.4, 6, 'pole'); }
        }
        for (let k = 0; k < 5; k++) flamingos.push(placeMatrix(r.cx + Math.cos(k * 1.3) * 24, CURB_HEIGHT, r.cz + Math.sin(k * 1.3) * 24, 0, k * 1.1, 0, 1.1));
      }
    }
  }
  for (const y of yards) if (rng() < 0.7) addPalm(y.x, y.z, 0.8);
  // promenade palms along Sunset Beach
  for (let z = -330; z < QUAY_START_Z; z += 12) addPalm(BEACH_START_X + 3.5, z + randRange(rng, -1, 1));

  // traffic signals: one head per approach, hung over the driving lane
  for (const node of roads.nodes) {
    if (!node.hasLights) continue;
    for (let d = 0; d < 4; d++) {
      const back = node.links[(d + 2) % 4];
      if (back < 0) continue; // nobody approaches from that side
      const r = rightOf(d);
      const px = node.x - DIR_X[d] * 10 + r.x * 9.6, pz = node.z - DIR_Z[d] * 10 + r.z * 9.6;
      const yaw = Math.atan2(-r.x, -r.z);
      signals.push(placeMatrix(px, CURB_HEIGHT, pz, 0, yaw, 0));
      heads.push({ node, dir: d, x: px - r.x * 4.6, z: pz - r.z * 4.6, yaw: Math.atan2(-DIR_X[d], -DIR_Z[d]) });
      addCollisionBox(collisions, px - 0.2, pz - 0.2, px + 0.2, pz + 0.2, 6, 'pole');
    }
  }

  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const vcSolid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  group.add(instanced(buildPalmGeometry(), vc, palms));
  group.add(instanced(buildTreeGeometry(), vcSolid, trees));
  group.add(instanced(buildLampGeometry(), vcSolid, lamps));
  group.add(instanced(buildSignalGeometry(), vcSolid, signals));
  const flamingoGeo = buildFlamingoGeometry();
  group.add(instanced(flamingoGeo, vcSolid, flamingos));

  // lamp heads glow at night; light pools fake the light on the sidewalk
  const glowTex = makeGlowTexture();
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: '#ffd7a0', transparent: true, opacity: 0, map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const poolMat = new THREE.MeshBasicMaterial({ color: '#ffb866', transparent: true, opacity: 0, map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowGeo = new THREE.PlaneGeometry(1.6, 1.6);
  const poolGeo = new THREE.PlaneGeometry(9, 9);
  poolGeo.rotateX(-Math.PI / 2);
  const glowM = lampHeads.map((h) => placeMatrix(h.x, CURB_HEIGHT + 7.05, h.z, -Math.PI / 2, 0, 0));
  const poolM = lampHeads.map((h) => placeMatrix(h.x, 0.08, h.z));
  group.add(instanced(glowGeo, lampGlowMat, glowM, { castShadow: false }));
  group.add(instanced(poolGeo, poolMat, poolM, { castShadow: false }));

  // signal lamps: red / amber / green per head, recoloured when the phase changes
  const lampGeo = new THREE.CircleGeometry(0.17, 10);
  const lampSets = ['R', 'Y', 'G'].map((state, k) => {
    const mats = heads.map((h) => {
      const fx = Math.sin(h.yaw) * 0.24, fz = Math.cos(h.yaw) * 0.24;
      return placeMatrix(h.x + fx, CURB_HEIGHT + 5.9 - k * 0.5, h.z + fz, 0, h.yaw, 0);
    });
    const mesh = instanced(lampGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), mats, { castShadow: false, colors: heads.map(() => '#222') });
    group.add(mesh);
    return { state, mesh };
  });

  const billboards = buildBillboards(group, collisions);
  // a few real lights that hop to the street lamps nearest the camera after dark
  const lampLights = [];
  for (let k = 0; k < 6; k++) {
    const l = new THREE.PointLight('#ffc68a', 0, 30, 1.4);
    l.position.set(0, -50, 0);
    group.add(l);
    lampLights.push(l);
  }
  scene.add(group);
  return { group, heads, lampSets, lampGlowMat, poolMat, billboards, lastPhase: '', lampHeads, lampLights, lampTimer: 0 };
}

export function updateLampLights(props, focus, night, dt) {
  props.lampTimer -= dt;
  if (props.lampTimer <= 0) {
    props.lampTimer = 0.3;
    const near = props.lampHeads
      .map((h) => ({ h, d: (h.x - focus.x) ** 2 + (h.z - focus.z) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, props.lampLights.length);
    near.forEach(({ h }, i) => props.lampLights[i].position.set(h.x, CURB_HEIGHT + 6.6, h.z));
  }
  for (const l of props.lampLights) l.intensity = night * 45;
}

const LAMP_ON = { R: new THREE.Color(3, 0.2, 0.15), Y: new THREE.Color(3, 2, 0.2), G: new THREE.Color(0.2, 3, 0.8) };
const LAMP_OFF = { R: new THREE.Color(0.18, 0.04, 0.04), Y: new THREE.Color(0.18, 0.14, 0.03), G: new THREE.Color(0.03, 0.15, 0.06) };

export function updateSignalLamps(props, roads) {
  const key = props.heads.map((h) => trafficLightState(roads, h.node, h.dir)).join('');
  if (key === props.lastPhase) return;
  props.lastPhase = key;
  for (const set of props.lampSets) {
    props.heads.forEach((h, i) => set.mesh.setColorAt(i, key[i] === set.state ? LAMP_ON[set.state] : LAMP_OFF[set.state]));
    set.mesh.instanceColor.needsUpdate = true;
  }
}

export function setStreetLightLevel(props, night) {
  props.lampGlowMat.opacity = night;
  props.poolMat.opacity = night * 0.45;
}

function buildFlamingoGeometry() {
  const b = new GeometryBatch();
  b.mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), placeMatrix(0, 0.6, 0), '#e86a8f');
  b.mesh(new THREE.SphereGeometry(0.42, 10, 8), placeMatrix(0, 1.4, 0, 0, 0, 0, 1.4, 0.8, 0.8), '#ff7aa8');
  b.mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), placeMatrix(0.45, 1.85, 0, 0, 0, -0.4), '#ff7aa8');
  b.mesh(new THREE.SphereGeometry(0.15, 8, 6), placeMatrix(0.62, 2.3, 0), '#ff8ab3');
  b.mesh(new THREE.ConeGeometry(0.06, 0.25, 5), placeMatrix(0.8, 2.25, 0, 0, 0, -1.7), '#222');
  return b.build();
}

const BILLBOARDS = [
  { text: 'VANCE REALTY · BUILDING TOMORROW', fg: '#ffd86b', bg: 'rgba(25,35,60,0.95)', x: -180, z: -100, yaw: 0.6 },
  { text: 'KBAY 99.1 SUNSET FM', fg: '#ff4fd8', bg: 'rgba(30,10,40,0.95)', x: 100, z: 60, yaw: -0.5 },
  { text: 'FIZZ-O · TASTE THE COAST', fg: '#5ff2ff', bg: 'rgba(10,30,45,0.95)', x: -40, z: 180, yaw: 0.2 },
  { text: 'MARLIN GT · OWN THE NIGHT', fg: '#ff7b2e', bg: 'rgba(40,15,5,0.95)', x: 190, z: -190, yaw: -0.8 },
];

function buildBillboards(group, collisions) {
  const out = [];
  for (const bb of BILLBOARDS) {
    const tex = makeSignTexture(bb.text, { fg: bb.fg, bg: bb.bg, w: 1024, h: 256, font: 'bold 120px "Trebuchet MS", sans-serif' });
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85), side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), mat);
    const y = 34;
    board.position.set(bb.x, y, bb.z);
    board.rotation.y = bb.yaw;
    group.add(board);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, y, 0.5), new THREE.MeshStandardMaterial({ color: '#59616a' }));
    legs.position.set(bb.x, y / 2, bb.z);
    group.add(legs);
    out.push(mat);
  }
  return out;
}

// Stacked shipping containers and gantry cranes along the Dockyards quay.
export function buildDockyardProps(scene, collisions, rng) {
  const group = new THREE.Group();
  const mats = [], colors = [];
  const palette = ['#d9463b', '#2a7fb8', '#e3a21a', '#3a9a5b', '#8e44ad', '#e0e0e0', '#1abc9c', '#c0392b'];
  for (let k = 0; k < 26; k++) {
    const x = -320 + (k % 13) * 13.5 + randRange(rng, -0.5, 0.5);
    const z = QUAY_START_Z + 5 + Math.floor(k / 13) * 8.5;
    const stack = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < stack; s++) {
      mats.push(placeMatrix(x, CURB_HEIGHT + 1.3 + s * 2.6, z, 0, 0, 0, 12, 2.6, 2.5));
      colors.push(pickOne(rng, palette));
    }
    addCollisionBox(collisions, x - 6, z - 1.25, x + 6, z + 1.25, stack * 2.6, 'container');
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 });
  group.add(instanced(box, mat, mats, { colors }));
  for (const cx of [-250, -150]) {
    const crane = new GeometryBatch();
    for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) crane.box(cx + dx, 0, QUAY_EDGE_Z - 6 + dz, 1, 30, 1, '#e8b923');
    crane.box(cx, 30, QUAY_EDGE_Z - 6, 14, 2, 10, '#e8b923');
    crane.box(cx, 30, QUAY_EDGE_Z + 10, 2.4, 1.6, 50, '#e8b923');
    crane.box(cx, 32, QUAY_EDGE_Z - 6, 5, 4, 5, '#cf4c3a');
    group.add(batchMesh(crane, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 })));
  }
  scene.add(group);
  return group;
}
