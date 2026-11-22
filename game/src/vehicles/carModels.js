// Vehicle types of Marisol Bay and their low-poly models: a bevelled side profile extruded across the
// width, a glass cabin with a painted roof, wheels that steer and spin, lamps, and police light bars.
import * as THREE from 'three';
import { makeGlowTexture } from '../world/textures.js';

export const VEHICLE_TYPES = {
  marlin: { name: 'Marlin GT', len: 4.5, wid: 1.95, belt: 0.78, roof: 1.17, cabin: [-1.15, -0.55, 0.25, 0.95], nose: 0.6, tail: 0.85, maxSpeed: 66, accel: 15, brake: 24, steer: 1.95, grip: 9, mass: 1.2, health: 900, colors: ['#e63946', '#ffb703', '#2ec4b6', '#f72585', '#ffffff'], spoiler: true },
  coupe: { name: 'Stingray Coupe', len: 4.3, wid: 1.85, belt: 0.86, roof: 1.3, cabin: [-1.2, -0.7, 0.35, 0.95], nose: 0.7, tail: 0.85, maxSpeed: 56, accel: 12, brake: 20, steer: 1.85, grip: 8.5, mass: 1.25, health: 900, colors: ['#4361ee', '#ff006e', '#8338ec', '#fb5607', '#3a86ff', '#06d6a0'] },
  sedan: { name: 'Bayline Sedan', len: 4.6, wid: 1.85, belt: 0.92, roof: 1.45, cabin: [-1.35, -0.9, 0.55, 1.1], nose: 0.82, tail: 0.92, maxSpeed: 47, accel: 9.5, brake: 18, steer: 1.6, grip: 8, mass: 1.4, health: 1000, colors: ['#f1faee', '#a8dadc', '#457b9d', '#e9c46a', '#d62828', '#6c757d', '#2a9d8f', '#f4a261'] },
  taxi: { name: 'Marisol Cab', len: 4.6, wid: 1.85, belt: 0.92, roof: 1.45, cabin: [-1.35, -0.9, 0.55, 1.1], nose: 0.82, tail: 0.92, maxSpeed: 47, accel: 9.5, brake: 18, steer: 1.6, grip: 8, mass: 1.4, health: 1000, colors: ['#ffd60a'], taxiSign: true },
  pickup: { name: 'Gator Pickup', len: 5.0, wid: 2.0, belt: 1.05, roof: 1.78, cabin: [-0.35, -0.15, 0.95, 1.35], nose: 1.0, tail: 1.05, maxSpeed: 44, accel: 9.5, brake: 16, steer: 1.4, grip: 7, mass: 1.8, health: 1300, colors: ['#bc4749', '#386641', '#f2e8cf', '#264653', '#e76f51'], bed: true },
  van: { name: 'Pelican Van', len: 5.0, wid: 2.0, belt: 1.05, roof: 2.15, cabin: [-2.45, -2.45, 1.35, 1.95], nose: 0.95, tail: 1.05, maxSpeed: 38, accel: 7, brake: 14, steer: 1.25, grip: 6.5, mass: 2.0, health: 1400, colors: ['#ffffff', '#e9ecef', '#90e0ef', '#ffd6a5'], boxy: true },
  roadster: { name: 'Riptide Roadster', len: 4.2, wid: 1.85, belt: 0.8, roof: 1.12, cabin: [-0.2, 0.2, 0.5, 0.95], nose: 0.62, tail: 0.8, maxSpeed: 60, accel: 13.5, brake: 21, steer: 1.95, grip: 8.5, mass: 1.1, health: 800, colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'], convertible: true },
  police: { name: 'MBPD Interceptor', len: 4.7, wid: 1.9, belt: 0.92, roof: 1.42, cabin: [-1.35, -0.9, 0.55, 1.1], nose: 0.8, tail: 0.9, maxSpeed: 60, accel: 13.5, brake: 22, steer: 1.85, grip: 9, mass: 1.5, health: 1300, colors: ['#111827'], police: true },
  tactical: { name: 'MBPD Tactical', len: 5.4, wid: 2.2, belt: 1.2, roof: 2.35, cabin: [-2.6, -2.6, 1.35, 2.0], nose: 1.1, tail: 1.2, maxSpeed: 46, accel: 9, brake: 18, steer: 1.3, grip: 7.5, mass: 3.0, health: 2600, colors: ['#1d2b44'], police: true, boxy: true },
};

export const CIVILIAN_TYPES = ['sedan', 'sedan', 'sedan', 'coupe', 'taxi', 'pickup', 'van', 'roadster', 'marlin', 'sedan', 'coupe', 'taxi'];

const geoCache = new Map();
const shared = {
  glass: new THREE.MeshStandardMaterial({ color: '#16222c', roughness: 0.1, metalness: 0.6 }),
  tire: new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: 0.3, metalness: 0.8 }),
  dark: new THREE.MeshStandardMaterial({ color: '#202429', roughness: 0.7 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#dfe3e6', roughness: 0.25, metalness: 0.9 }),
  white: new THREE.MeshStandardMaterial({ color: '#f5f6f7', roughness: 0.4, metalness: 0.2 }),
  taxiSign: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffcc33', emissiveIntensity: 0.4 }),
};

function bodyShape(t) {
  const L = t.len / 2;
  const s = new THREE.Shape();
  const bottom = 0.32;
  s.moveTo(-L, bottom);
  s.lineTo(-L, t.belt - 0.12);
  s.lineTo(-L + 0.18, t.belt);
  s.lineTo(L - 0.45, t.belt - (t.belt - t.nose) * 0.25);
  s.lineTo(L - 0.05, t.nose);
  s.lineTo(L, bottom + 0.05);
  s.lineTo(-L, bottom);
  return s;
}

function extrude(shape, width, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function typeGeometry(key) {
  if (geoCache.has(key)) return geoCache.get(key);
  const t = VEHICLE_TYPES[key];
  const body = extrude(bodyShape(t), t.wid, 0.07);
  const [zr, zr2, zf2, zf] = t.cabin;
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(zr, t.belt - 0.02);
  cabinShape.lineTo(zr2, t.roof);
  cabinShape.lineTo(zf2, t.roof);
  cabinShape.lineTo(zf, t.belt - 0.02);
  cabinShape.lineTo(zr, t.belt - 0.02);
  const cabin = extrude(cabinShape, t.wid * (t.boxy ? 0.97 : 0.86), 0.03);
  const roofGeo = new THREE.BoxGeometry(t.wid * (t.boxy ? 0.99 : 0.88), 0.07, Math.max(0.2, zf2 - zr2 + 0.08));
  roofGeo.translate(0, t.roof + 0.02, (zr2 + zf2) / 2);
  const out = { body, cabin, roof: roofGeo };
  geoCache.set(key, out);
  return out;
}

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8);
rimGeo.rotateZ(Math.PI / 2);
const lampGeo = new THREE.BoxGeometry(0.42, 0.14, 0.08);
const archGeo = new THREE.CircleGeometry(0.47, 16, 0, Math.PI);

export function buildCarModel(key, color) {
  const t = VEHICLE_TYPES[key];
  const g = typeGeometry(key);
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.45 });
  const body = new THREE.Mesh(g.body, paint);
  body.castShadow = true;
  group.add(body);
  if (!t.convertible) {
    const cabin = new THREE.Mesh(g.cabin, shared.glass);
    cabin.castShadow = true;
    group.add(cabin);
    const roofMat = t.police && !t.boxy ? shared.white : paint;
    group.add(new THREE.Mesh(g.roof, roofMat));
  } else {
    const ws = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.84, 0.36, 0.06), shared.glass);
    ws.position.set(0, t.belt + 0.16, t.cabin[3] - 0.2);
    ws.rotation.x = -0.5;
    group.add(ws);
    const seats = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.7, 0.4, 0.9), shared.dark);
    seats.position.set(0, t.belt, t.cabin[1] - 0.2);
    group.add(seats);
  }
  if (t.police && !t.boxy) {
    // white doors over the black body
    const doors = new THREE.Mesh(new THREE.BoxGeometry(t.wid + 0.02, 0.42, 1.9), shared.white);
    doors.position.set(0, t.belt - 0.26, -0.1);
    group.add(doors);
  }
  if (t.spoiler) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.9, 0.06, 0.32), paint);
    sp.position.set(0, t.belt + 0.28, -t.len / 2 + 0.2);
    group.add(sp);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.1), shared.dark);
      post.position.set(s * t.wid * 0.35, t.belt + 0.13, -t.len / 2 + 0.22);
      group.add(post);
    }
  }
  if (t.bed) {
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 2.2), paint);
      wall.position.set(s * (t.wid / 2 - 0.08), t.belt + 0.18, -1.35);
      group.add(wall);
    }
  }
  if (t.taxiSign) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), shared.taxiSign);
    sign.position.set(0, t.roof + 0.17, (t.cabin[1] + t.cabin[2]) / 2);
    group.add(sign);
    const check = new THREE.Mesh(new THREE.BoxGeometry(t.wid + 0.02, 0.1, 2.6), shared.dark);
    check.position.set(0, t.belt - 0.2, 0);
    group.add(check);
  }

  const headMat = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4cc', emissiveIntensity: 0.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#7a0d12', emissive: '#ff1a1a', emissiveIntensity: 0.3 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(lampGeo, headMat);
    h.position.set(s * t.wid * 0.33, t.nose - 0.08, t.len / 2 - 0.02);
    group.add(h);
    const tl = new THREE.Mesh(lampGeo, tailMat);
    tl.position.set(s * t.wid * 0.33, t.belt - 0.14, -t.len / 2 - 0.01);
    group.add(tl);
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.96, 0.16, 0.12), shared.dark);
  bumper.position.set(0, 0.42, t.len / 2 + 0.02);
  group.add(bumper);
  const rear = bumper.clone();
  rear.position.z = -t.len / 2 - 0.02;
  group.add(rear);

  const wheels = [];
  const wz = t.len / 2 - 0.85;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    // dark wheel well painted on the body side behind each tyre
    const arch = new THREE.Mesh(archGeo, shared.dark);
    arch.position.set(sx * (t.wid / 2 + 0.005), 0.42, sz * wz);
    arch.rotation.y = sx * Math.PI / 2;
    group.add(arch);
    const pivot = new THREE.Group();
    pivot.position.set(sx * (t.wid / 2 - 0.06), 0.36, sz * wz);
    const tire = new THREE.Mesh(wheelGeo, shared.tire);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, shared.rim);
    tire.add(rim);
    pivot.add(tire);
    group.add(pivot);
    wheels.push({ pivot, tire, front: sz > 0 });
  }

  let lightbar = null;
  if (t.police) {
    const red = new THREE.MeshBasicMaterial({ color: '#ff2030', toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: '#2060ff', toneMapped: false });
    const barY = t.roof + 0.12, barZ = t.boxy ? t.cabin[2] - 0.3 : (t.cabin[1] + t.cabin[2]) / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), shared.dark);
    base.position.set(0, barY - 0.07, barZ);
    group.add(base);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.26), red);
    r.position.set(-0.3, barY, barZ);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.26), blue);
    b.position.set(0.3, barY, barZ);
    group.add(r, b);
    // halo sprites so the flashing reads in daylight too
    const halo = (color, x) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      s.position.set(x, barY + 0.05, barZ);
      s.scale.set(2.6, 2.6, 1);
      group.add(s);
      return s;
    };
    lightbar = { red, blue, y: barY, z: barZ, redGlow: halo('#ff2a3a', -0.35), blueGlow: halo('#2a6bff', 0.35) };
    if (t.boxy) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(t.wid + 0.02, 0.25, t.len * 0.9), new THREE.MeshStandardMaterial({ color: '#e8eef5' }));
      stripe.position.set(0, t.belt - 0.1, 0);
      group.add(stripe);
    }
  }
  return { group, paint, headMat, tailMat, wheels, lightbar, type: t };
}
