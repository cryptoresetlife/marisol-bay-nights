// Low-poly people: a vertex-coloured body with swinging arms and legs, a held weapon, and animation for
// walking, running, aiming, punching, sitting in a car and lying knocked out.
import * as THREE from 'three';
import { GeometryBatch, placeMatrix } from '../world/geometry.js';
import { pickOne } from '../core/rng.js';

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const gunMaterial = new THREE.MeshStandardMaterial({ color: '#1c1f24', roughness: 0.4, metalness: 0.6 });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673c', '#6b4226'];
const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#1a535c', '#ff9f1c', '#2ec4b6', '#e71d36', '#f15bb5', '#9b5de5', '#00bbf9', '#fee440', '#ffffff', '#c3f0ca', '#ffafcc'];
const PANTS = ['#2b2d42', '#3d5a80', '#8d99ae', '#f4f1de', '#6b705c', '#264653', '#e9c46a', '#1d3557'];
const HAIR = ['#1b1b1b', '#3b2416', '#6f4e37', '#c9a227', '#a52a2a', '#dcdcdc', '#2b1d0e'];

export const LOOKS = {
  dez: { skin: '#8d5524', shirt: '#ff7a3d', pants: '#24324f', hair: '#141414', shoes: '#f5f5f5', style: 'short', accent: '#ffd166', shades: true },
  lupe: { skin: '#c68642', shirt: '#ff4fa3', pants: '#1d3557', hair: '#2b1d0e', shoes: '#ffffff', style: 'long' },
  cop: { skin: null, shirt: '#1f3a68', pants: '#14213d', hair: '#1b1b1b', shoes: '#111111', style: 'cap', hat: '#14213d' },
  swat: { skin: null, shirt: '#22262e', pants: '#1a1d23', hair: '#111', shoes: '#111111', style: 'helmet', hat: '#111317', vest: '#2f3540' },
  gang: { skin: null, shirt: '#ff5f5f', pants: '#1b1b1b', hair: '#1b1b1b', shoes: '#ffffff', style: 'bandana', hat: '#ff2e4d' },
  vance: { skin: '#ffdbac', shirt: '#f4f1e8', pants: '#f4f1e8', hair: '#c0c0c0', shoes: '#4a2f1d', style: 'short', accent: '#d4af37' },
  guard: { skin: null, shirt: '#111111', pants: '#111111', hair: '#111', shoes: '#111111', style: 'short' },
};

export function randomLook(rng = Math.random) {
  const long = rng() < 0.45;
  return { skin: pickOne(rng, SKIN), shirt: pickOne(rng, SHIRTS), pants: pickOne(rng, PANTS), hair: pickOne(rng, HAIR), shoes: pickOne(rng, ['#ffffff', '#222222', '#8b5a2b', '#e63946']), style: long ? 'long' : rng() < 0.2 ? 'cap' : 'short', hat: pickOne(rng, SHIRTS), shorts: rng() < 0.35 };
}

function fill(look, rng = Math.random) {
  return { ...look, skin: look.skin || pickOne(rng, SKIN) };
}

export function buildCharacterModel(lookIn) {
  const look = fill(lookIn);
  const root = new THREE.Group();
  const body = new GeometryBatch();
  body.mesh(box(0.46, 0.62, 0.26), placeMatrix(0, 1.26, 0), look.shirt);
  body.mesh(box(0.56, 0.14, 0.28), placeMatrix(0, 1.5, 0), look.shirt); // shoulders
  body.mesh(box(0.2, 0.05, 0.03), placeMatrix(0, 1.73, 0.14), '#3a2418'); // mouth shadow
  body.mesh(box(0.05, 0.07, 0.04), placeMatrix(0, 1.76, 0.15), look.skin); // nose
  if (look.vest) body.mesh(box(0.5, 0.42, 0.3), placeMatrix(0, 1.3, 0), look.vest);
  if (look.accent) body.mesh(box(0.47, 0.06, 0.27), placeMatrix(0, 1.05, 0), look.accent);
  body.mesh(box(0.42, 0.14, 0.24), placeMatrix(0, 0.9, 0), look.pants);
  body.mesh(box(0.12, 0.08, 0.12), placeMatrix(0, 1.6, 0), look.skin);
  body.mesh(box(0.26, 0.28, 0.27), placeMatrix(0, 1.77, 0), look.skin);
  body.mesh(box(0.27, 0.06, 0.05), placeMatrix(0, 1.81, 0.13), look.shades ? '#0d0d10' : '#1a1a1a'); // brows or shades
  if (look.style === 'long') {
    body.mesh(box(0.29, 0.1, 0.3), placeMatrix(0, 1.94, -0.01), look.hair);
    body.mesh(box(0.29, 0.36, 0.08), placeMatrix(0, 1.74, -0.15), look.hair);
  } else if (look.style === 'cap') {
    body.mesh(box(0.29, 0.1, 0.3), placeMatrix(0, 1.95, 0), look.hat || '#222');
    body.mesh(box(0.27, 0.03, 0.14), placeMatrix(0, 1.91, 0.2), look.hat || '#222');
  } else if (look.style === 'helmet') {
    body.mesh(box(0.32, 0.16, 0.33), placeMatrix(0, 1.94, 0), look.hat);
  } else if (look.style === 'bandana') {
    body.mesh(box(0.29, 0.09, 0.29), placeMatrix(0, 1.94, 0), look.hat);
    body.mesh(box(0.06, 0.06, 0.14), placeMatrix(0, 1.9, -0.18), look.hat);
  } else {
    body.mesh(box(0.28, 0.08, 0.29), placeMatrix(0, 1.94, -0.005), look.hair);
  }
  const bodyMesh = new THREE.Mesh(body.build(), material);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  const limb = (parts, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const b = new GeometryBatch();
    for (const [w, h, d, py, pz, color] of parts) b.mesh(box(w, h, d), placeMatrix(0, py, pz), color);
    const m = new THREE.Mesh(b.build(), material);
    m.castShadow = true;
    pivot.add(m);
    root.add(pivot);
    return pivot;
  };
  const legColor = look.shorts ? look.skin : look.pants;
  const legParts = [[0.17, 0.4, 0.19, -0.2, 0, look.pants], [0.16, 0.42, 0.18, -0.6, 0, legColor], [0.17, 0.08, 0.27, -0.84, 0.04, look.shoes]];
  const legL = limb(legParts, -0.11, 0.88);
  const legR = limb(legParts, 0.11, 0.88);
  const armParts = [[0.13, 0.3, 0.14, -0.14, 0, look.shirt], [0.11, 0.3, 0.12, -0.43, 0, look.skin], [0.12, 0.1, 0.13, -0.62, 0.01, look.skin]];
  const armL = limb(armParts, -0.3, 1.52);
  const armR = limb(armParts, 0.3, 1.52);
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
  model.armL.rotation.set(-s * 0.9, 0, 0.05);
  if (aiming) model.armR.rotation.set(-Math.PI / 2 + 0.05, 0, 0);
  else if (punch > 0) model.armR.rotation.set(-Math.PI / 2 * Math.sin(punch * Math.PI), 0, 0);
  else model.armR.rotation.set(s * 0.9, 0, -0.05);
  if (aiming) model.armL.rotation.set(-Math.PI / 2 + 0.25, 0.5, 0);
  model.root.position.y = Math.abs(Math.cos(model.phase)) * 0.05 * run;
}

function easeOut(t) { return 1 - (1 - t) * (1 - t); }
