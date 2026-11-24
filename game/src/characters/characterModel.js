// Procedural people: a tapered torso, rounded head with eyes, ears and a choice of hairstyles, segmented
// arms and legs built from capsules with hands and shoes, clothes from a wide palette (tees, open jackets,
// shorts, caps, vests), a held weapon, and animation for walking, running, aiming, punching, sitting in a
// car and lying knocked out. Each body part is one vertex-coloured batched mesh.
import * as THREE from 'three';
import { GeometryBatch, placeMatrix } from '../world/geometry.js';
import { pickOne } from '../core/rng.js';

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
const gunMaterial = new THREE.MeshStandardMaterial({ color: '#1c1f24', roughness: 0.4, metalness: 0.6 });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8);
const sphere = (r, ws = 12, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const dome = (r) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const tube = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673c', '#6b4226'];
const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#1a535c', '#ff9f1c', '#2ec4b6', '#e71d36', '#f15bb5', '#9b5de5', '#00bbf9', '#fee440', '#ffffff', '#c3f0ca', '#ffafcc', '#f8f4e3', '#ff8fab'];
const JACKETS = ['#22223b', '#4a4e69', '#9a8c98', '#e0b1cb', '#3d405b', '#81b29a', '#f2cc8f', '#264653', '#bb3e03'];
const PANTS = ['#2b2d42', '#3d5a80', '#8d99ae', '#f4f1de', '#6b705c', '#264653', '#e9c46a', '#1d3557', '#5c677d'];
const HAIR = ['#1b1b1b', '#3b2416', '#6f4e37', '#c9a227', '#a52a2a', '#dcdcdc', '#2b1d0e', '#e8c07d'];
const SHOES = ['#ffffff', '#222222', '#8b5a2b', '#e63946', '#3a86ff', '#f1f1f1'];

export const LOOKS = {
  dez: { skin: '#8d5524', shirt: '#ff7a3d', pants: '#24324f', hair: '#141414', shoes: '#f5f5f5', style: 'short', accent: '#ffd166', shades: true, beard: true },
  lupe: { skin: '#c68642', shirt: '#ff4fa3', pants: '#1d3557', hair: '#2b1d0e', shoes: '#ffffff', style: 'long' },
  cop: { skin: null, shirt: '#1f3a68', pants: '#14213d', hair: '#1b1b1b', shoes: '#111111', style: 'cap', hat: '#14213d', badge: true, longSleeves: true },
  swat: { skin: null, shirt: '#22262e', pants: '#1a1d23', hair: '#111', shoes: '#111111', style: 'helmet', hat: '#111317', vest: '#2f3540', longSleeves: true },
  gang: { skin: null, shirt: '#ff5f5f', pants: '#1b1b1b', hair: '#1b1b1b', shoes: '#ffffff', style: 'bandana', hat: '#ff2e4d' },
  vance: { skin: '#ffdbac', shirt: '#f4f1e8', pants: '#f4f1e8', hair: '#c0c0c0', shoes: '#4a2f1d', style: 'short', accent: '#d4af37', jacket: '#f4f1e8', longSleeves: true },
  guard: { skin: null, shirt: '#111111', pants: '#111111', hair: '#111', shoes: '#111111', style: 'short', longSleeves: true, shades: true },
};

export function randomLook(rng = Math.random) {
  const roll = rng();
  const style = roll < 0.35 ? 'long' : roll < 0.5 ? 'cap' : roll < 0.6 ? 'afro' : roll < 0.68 ? 'bald' : roll < 0.76 ? 'bun' : 'short';
  return {
    skin: pickOne(rng, SKIN), shirt: pickOne(rng, SHIRTS), pants: pickOne(rng, PANTS), hair: pickOne(rng, HAIR), shoes: pickOne(rng, SHOES),
    style, hat: pickOne(rng, SHIRTS), shorts: rng() < 0.35, jacket: rng() < 0.25 ? pickOne(rng, JACKETS) : null,
    shades: rng() < 0.3, beard: style !== 'long' && style !== 'bun' && rng() < 0.25, build: 0.92 + rng() * 0.18,
  };
}

function fill(look, rng = Math.random) {
  return { ...look, skin: look.skin || pickOne(rng, SKIN) };
}

function buildHead(b, look) {
  const y = 1.77;
  b.mesh(tube(0.06, 0.07, 0.12, 8), placeMatrix(0, 1.62, 0), look.skin); // neck
  b.mesh(sphere(0.135), placeMatrix(0, y, 0.005, 0, 0, 0, 1, 1.13, 1.05), look.skin);
  b.mesh(sphere(0.06, 8, 6), placeMatrix(0, y - 0.07, 0.04, 0, 0, 0, 1.4, 0.8, 1.3), look.skin); // jaw
  for (const sx of [-1, 1]) {
    b.mesh(sphere(0.03, 6, 5), placeMatrix(sx * 0.133, y, -0.005, 0, 0, 0, 0.6, 1.2, 1), look.skin); // ears
    if (!look.shades) {
      b.mesh(sphere(0.022, 6, 5), placeMatrix(sx * 0.05, y + 0.02, 0.122), '#f8f8f2');
      b.mesh(sphere(0.012, 5, 4), placeMatrix(sx * 0.05, y + 0.02, 0.138), '#1d140e');
    }
    b.mesh(box(0.06, 0.014, 0.02), placeMatrix(sx * 0.05, y + 0.06, 0.128, 0, 0, sx * -0.12), look.hair === '#dcdcdc' ? '#9a9a9a' : '#1d140e'); // brows
  }
  if (look.shades) {
    b.mesh(box(0.25, 0.05, 0.03), placeMatrix(0, y + 0.02, 0.13), '#0c0d10');
    b.mesh(box(0.012, 0.012, 0.2), placeMatrix(0.13, y + 0.025, 0.04), '#0c0d10');
    b.mesh(box(0.012, 0.012, 0.2), placeMatrix(-0.13, y + 0.025, 0.04), '#0c0d10');
  }
  b.mesh(box(0.035, 0.05, 0.04), placeMatrix(0, y - 0.01, 0.145, -0.3), look.skin); // nose
  b.mesh(box(0.07, 0.014, 0.02), placeMatrix(0, y - 0.07, 0.128), '#7a3b2e'); // mouth
  if (look.beard) b.mesh(sphere(0.1, 10, 6, ), placeMatrix(0, y - 0.075, 0.035, 0, 0, 0, 1.25, 0.65, 1.0), look.hair);

  const hairY = y + 0.02;
  switch (look.style) {
    case 'long':
      b.mesh(dome(0.148), placeMatrix(0, hairY, -0.005, 0, 0, 0, 1, 1.05, 1.05), look.hair);
      b.mesh(tube(0.13, 0.15, 0.32, 10), placeMatrix(0, y - 0.12, -0.05, 0, 0, 0, 1, 1, 0.7), look.hair);
      break;
    case 'cap':
      b.mesh(dome(0.148), placeMatrix(0, hairY + 0.01, 0), look.hat || '#222');
      b.mesh(tube(0.11, 0.11, 0.015, 12), placeMatrix(0, hairY + 0.01, 0.12, 0, 0, 0, 1, 1, 1.1), look.hat || '#222');
      break;
    case 'helmet':
      b.mesh(dome(0.17), placeMatrix(0, hairY - 0.01, 0, 0, 0, 0, 1, 1, 1.05), look.hat);
      b.mesh(box(0.3, 0.06, 0.04), placeMatrix(0, y + 0.04, 0.15), '#3d4450');
      break;
    case 'bandana':
      b.mesh(dome(0.147), placeMatrix(0, hairY, 0), look.hat);
      b.mesh(box(0.08, 0.1, 0.03), placeMatrix(0, y + 0.0, -0.16, 0.3), look.hat);
      break;
    case 'afro':
      b.mesh(sphere(0.19, 12, 9), placeMatrix(0, y + 0.08, -0.02, 0, 0, 0, 1, 0.9, 1), look.hair);
      break;
    case 'bun':
      b.mesh(dome(0.147), placeMatrix(0, hairY, -0.005), look.hair);
      b.mesh(sphere(0.07, 8, 6), placeMatrix(0, y + 0.13, -0.1), look.hair);
      break;
    case 'bald':
      break;
    default:
      b.mesh(dome(0.145), placeMatrix(0, hairY + 0.005, -0.01, -0.12, 0, 0, 1, 0.8, 1.02), look.hair);
  }
}

function buildTorso(b, look) {
  // an open jacket wraps the torso and leaves a strip of shirt showing down the front
  b.mesh(tube(0.24, 0.19, 0.56, 12), placeMatrix(0, 1.27, 0, 0, 0, 0, 1, 1, 0.58), look.jacket || look.shirt);
  if (look.jacket) b.mesh(box(0.13, 0.5, 0.03), placeMatrix(0, 1.29, 0.118, -0.06), look.shirt);
  b.mesh(sphere(0.25, 12, 8), placeMatrix(0, 1.48, 0, 0, 0, 0, 1.1, 0.42, 0.62), look.jacket || look.shirt); // shoulders
  b.mesh(tube(0.075, 0.08, 0.04, 10), placeMatrix(0, 1.57, 0), look.jacket || look.shirt); // collar
  if (look.vest) b.mesh(box(0.48, 0.44, 0.32), placeMatrix(0, 1.3, 0), look.vest);
  if (look.badge) b.mesh(box(0.06, 0.07, 0.02), placeMatrix(-0.1, 1.38, 0.125), '#e0b43c');
  b.mesh(tube(0.205, 0.2, 0.08, 12), placeMatrix(0, 0.99, 0, 0, 0, 0, 1, 1, 0.62), look.accent || '#2a2522'); // belt
  b.mesh(tube(0.2, 0.18, 0.16, 12), placeMatrix(0, 0.88, 0, 0, 0, 0, 1, 1, 0.66), look.pants); // hips
}

export function buildCharacterModel(lookIn) {
  const look = fill(lookIn);
  const root = new THREE.Group();
  const body = new GeometryBatch();
  buildTorso(body, look);
  buildHead(body, look);
  const bodyMesh = new THREE.Mesh(body.build(), material);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);
  if (look.build) root.scale.set(look.build, 1, look.build);

  const limb = (build, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const b = new GeometryBatch();
    build(b);
    const m = new THREE.Mesh(b.build(), material);
    m.castShadow = true;
    pivot.add(m);
    root.add(pivot);
    return pivot;
  };
  const sleeve = look.jacket || look.shirt;
  const forearm = look.longSleeves || look.jacket ? sleeve : look.skin;
  const shin = look.shorts ? look.skin : look.pants;
  const leg = (b) => {
    b.mesh(capsule(0.085, 0.28), placeMatrix(0, -0.2, 0), look.pants);
    if (look.shorts) b.mesh(tube(0.095, 0.092, 0.08, 10), placeMatrix(0, -0.36, 0), look.pants);
    b.mesh(capsule(0.07, 0.3), placeMatrix(0, -0.58, 0), shin);
    b.mesh(capsule(0.065, 0.14), placeMatrix(0, -0.84, 0.05, Math.PI / 2, 0, 0, 1.15, 1, 0.9), look.shoes);
    b.mesh(box(0.13, 0.03, 0.24), placeMatrix(0, -0.895, 0.05), '#e8e4da'); // sole
  };
  const arm = (b) => {
    b.mesh(capsule(0.07, 0.18), placeMatrix(0, -0.13, 0), sleeve);
    b.mesh(capsule(0.056, 0.22), placeMatrix(0, -0.42, 0), forearm);
    b.mesh(sphere(0.06, 8, 6), placeMatrix(0, -0.6, 0.01, 0, 0, 0, 0.85, 1.2, 1), look.skin);
  };
  const legL = limb(leg, -0.105, 0.88);
  const legR = limb(leg, 0.105, 0.88);
  const armL = limb(arm, -0.29, 1.5);
  const armR = limb(arm, 0.29, 1.5);
  const gun = new THREE.Mesh(box(0.07, 0.12, 0.34), gunMaterial);
  gun.position.set(0, -0.58, 0.12);
  gun.visible = false;
  armR.add(gun);
  return { root, legL, legR, armL, armR, gun, phase: Math.random() * 6, look, fallen: 0 };
}

const GUN_SIZE = { pistol: [0.07, 0.12, 0.3], smg: [0.08, 0.14, 0.5], shotgun: [0.08, 0.1, 0.85], rifle: [0.08, 0.12, 0.95] };

export function setHeldWeapon(model, weaponId) {
  const size = GUN_SIZE[weaponId];
  model.gun.visible = !!size;
  if (size) {
    model.gun.scale.set(size[0] / 0.07, size[1] / 0.12, size[2] / 0.34);
    model.gun.position.z = size[2] / 2 - 0.05;
  }
}

// state: { speed, aiming, punch (0..1), seated, down }
export function animateCharacter(model, state, dt) {
  const { speed = 0, aiming = false, punch = 0, seated = false, down = false } = state;
  if (down) {
    model.fallen = Math.min(1, model.fallen + dt * 3);
    model.root.rotation.x = -Math.PI / 2 * easeOut(model.fallen);
    model.root.position.y = 0.15 * model.fallen;
    model.armL.rotation.set(-2.6 * model.fallen, 0, 0.3);
    model.armR.rotation.set(-2.4 * model.fallen, 0, -0.3);
    model.legL.rotation.x = 0.1; model.legR.rotation.x = -0.15;
    return;
  }
  if (model.fallen > 0) { model.fallen = 0; model.root.rotation.x = 0; model.root.position.y = 0; }
  if (seated) {
    model.legL.rotation.x = model.legR.rotation.x = -1.4;
    model.armL.rotation.set(-1.1, 0, 0); model.armR.rotation.set(-1.1, 0, 0);
    return;
  }
  const run = Math.min(1, speed / 6.5);
  model.phase += dt * (3.5 + speed * 1.35);
  const amp = Math.min(1, speed / 2.5) * (0.55 + run * 0.4);
  const s = Math.sin(model.phase) * amp;
  model.legL.rotation.x = s;
  model.legR.rotation.x = -s;
  model.armL.rotation.set(-s * 0.9, 0, 0.07);
  if (aiming) model.armR.rotation.set(-Math.PI / 2 + 0.05, 0, 0);
  else if (punch > 0) model.armR.rotation.set(-Math.PI / 2 * Math.sin(punch * Math.PI), 0, 0);
  else model.armR.rotation.set(s * 0.9, 0, -0.07);
  if (aiming) model.armL.rotation.set(-Math.PI / 2 + 0.25, 0.5, 0);
  model.root.position.y = Math.abs(Math.cos(model.phase)) * 0.05 * run;
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
