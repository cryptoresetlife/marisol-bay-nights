// Vehicle types of Marisol Bay and their procedural models: a rounded side profile with real wheel arches
// extruded across the width, a painted cabin with inset side windows, windscreen and B-pillars, bumpers,
// grille, number plates, mirrors, door seams, multi-spoke rims, lamps, and police livery with light bars.
// Each car is a handful of batched meshes (paint, trim, glass, lamps, wheels) so traffic stays cheap.
import * as THREE from 'three';
import { makeGlowTexture } from '../world/textures.js';
import { GeometryBatch, placeMatrix } from '../world/geometry.js';

export const VEHICLE_TYPES = {
  marlin: { name: 'Marlin GT', len: 4.5, wid: 1.95, belt: 0.8, roof: 1.17, cabin: [-1.15, -0.55, 0.25, 0.95], nose: 0.58, tail: 0.85, maxSpeed: 66, accel: 15, brake: 24, steer: 1.95, grip: 9, mass: 1.2, health: 900, colors: ['#e63946', '#ffb703', '#2ec4b6', '#f72585', '#ffffff'], spoiler: true, wheelR: 0.34 },
  coupe: { name: 'Stingray Coupe', len: 4.3, wid: 1.85, belt: 0.86, roof: 1.3, cabin: [-1.2, -0.7, 0.35, 0.95], nose: 0.68, tail: 0.85, maxSpeed: 56, accel: 12, brake: 20, steer: 1.85, grip: 8.5, mass: 1.25, health: 900, colors: ['#4361ee', '#ff006e', '#8338ec', '#fb5607', '#3a86ff', '#06d6a0'] },
  sedan: { name: 'Bayline Sedan', len: 4.6, wid: 1.85, belt: 0.92, roof: 1.45, cabin: [-1.35, -0.9, 0.55, 1.1], nose: 0.8, tail: 0.92, maxSpeed: 47, accel: 9.5, brake: 18, steer: 1.6, grip: 8, mass: 1.4, health: 1000, colors: ['#f1faee', '#a8dadc', '#457b9d', '#e9c46a', '#d62828', '#6c757d', '#2a9d8f', '#f4a261'], bPillar: true },
  taxi: { name: 'Marisol Cab', len: 4.6, wid: 1.85, belt: 0.92, roof: 1.45, cabin: [-1.35, -0.9, 0.55, 1.1], nose: 0.8, tail: 0.92, maxSpeed: 47, accel: 9.5, brake: 18, steer: 1.6, grip: 8, mass: 1.4, health: 1000, colors: ['#ffd60a'], taxiSign: true, bPillar: true },
  pickup: { name: 'Gator Pickup', len: 5.0, wid: 2.0, belt: 1.05, roof: 1.78, cabin: [-0.35, -0.15, 0.95, 1.35], nose: 0.98, tail: 1.05, maxSpeed: 44, accel: 9.5, brake: 16, steer: 1.4, grip: 7, mass: 1.8, health: 1300, colors: ['#bc4749', '#386641', '#f2e8cf', '#264653', '#e76f51'], bed: true, wheelR: 0.4 },
  van: { name: 'Pelican Van', len: 5.0, wid: 2.0, belt: 1.05, roof: 2.15, cabin: [-2.45, -2.45, 1.35, 1.95], nose: 0.95, tail: 1.05, maxSpeed: 38, accel: 7, brake: 14, steer: 1.25, grip: 6.5, mass: 2.0, health: 1400, colors: ['#ffffff', '#e9ecef', '#90e0ef', '#ffd6a5'], boxy: true, wheelR: 0.38 },
  roadster: { name: 'Riptide Roadster', len: 4.2, wid: 1.85, belt: 0.8, roof: 1.12, cabin: [-0.2, 0.2, 0.5, 0.95], nose: 0.6, tail: 0.8, maxSpeed: 60, accel: 13.5, brake: 21, steer: 1.95, grip: 8.5, mass: 1.1, health: 800, colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'], convertible: true, wheelR: 0.34 },
  police: { name: 'MBPD Interceptor', len: 4.7, wid: 1.9, belt: 0.92, roof: 1.42, cabin: [-1.35, -0.9, 0.55, 1.1], nose: 0.8, tail: 0.9, maxSpeed: 60, accel: 13.5, brake: 22, steer: 1.85, grip: 9, mass: 1.5, health: 1300, colors: ['#111827'], police: true, bPillar: true },
  tactical: { name: 'MBPD Tactical', len: 5.4, wid: 2.2, belt: 1.2, roof: 2.35, cabin: [-2.6, -2.6, 1.35, 2.0], nose: 1.1, tail: 1.2, maxSpeed: 46, accel: 9, brake: 18, steer: 1.3, grip: 7.5, mass: 3.0, health: 2600, colors: ['#1d2b44'], police: true, boxy: true, wheelR: 0.42 },
};

export const CIVILIAN_TYPES = ['sedan', 'sedan', 'sedan', 'coupe', 'taxi', 'pickup', 'van', 'roadster', 'marlin', 'sedan', 'coupe', 'taxi'];

const shared = {
  glass: new THREE.MeshStandardMaterial({ color: '#0e1a24', roughness: 0.05, metalness: 0.85, side: THREE.DoubleSide }),
  trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 }),
  tire: new THREE.MeshStandardMaterial({ color: '#151619', roughness: 0.92 }),
  rim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.85 }),
  taxiSign: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffcc33', emissiveIntensity: 0.5 }),
};
const DARK = '#1b1e22', BLACK = '#0a0b0d', CHROME = '#e4e8ec', PLATE = '#f2f0e6', AMBER = '#ff9a1f';
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const geoCache = new Map();

function extrude(shape, width, bevel = 0.05) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.rotateY(-Math.PI / 2);
  g.translate((width - bevel * 2) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function wheelRadius(t) { return t.wheelR || 0.36; }
function wheelBase(t) { return t.len / 2 - 0.85; }

// Height of the body's top edge at position x along the car, used to keep arches below the bodywork.
function topAt(t, x) {
  const L = t.len / 2, zf = t.cabin[3];
  if (x > zf) return t.belt + (t.nose - t.belt) * Math.min(1, (x - zf) / Math.max(0.1, L - 0.12 - zf));
  return t.belt;
}

function archRadius(t, x) {
  const r = wheelRadius(t);
  return Math.max(r + 0.02, Math.min(r + 0.09, topAt(t, x) - 0.06 - r));
}

// The outline is drawn shrunk by the extrusion bevel `e`, which grows it back to the true size.
function bodyShape(t, e) {
  const L = t.len / 2 - e, b = 0.3 + e, r = wheelRadius(t), wz = wheelBase(t), zf = t.cabin[3], zr = t.cabin[0];
  const nose = t.nose - e, belt = t.belt - e;
  t = { ...t, nose, belt };
  const s = new THREE.Shape();
  s.moveTo(-L + 0.1, b);
  for (const cx of [-wz, wz]) {
    const ar = archRadius({ ...t, nose: nose + e, belt: belt + e }, cx) + e;
    s.lineTo(cx - ar, b);
    s.absarc(cx, r, ar, Math.PI, 0, true);
    s.lineTo(cx + ar, b);
  }
  s.lineTo(L - 0.12, b);
  s.quadraticCurveTo(L + 0.02, b + 0.02, L, b + 0.16);
  s.lineTo(L, t.nose - 0.1);
  s.quadraticCurveTo(L, t.nose, L - 0.16, t.nose + 0.01);
  s.lineTo(Math.min(L - 0.3, zf + 0.04), t.belt - 0.01);
  s.lineTo(zr, t.belt);
  const rearTop = t.bed ? t.belt : t.belt - 0.03;
  s.lineTo(-L + 0.18, rearTop);
  s.quadraticCurveTo(-L, rearTop, -L, rearTop - 0.16);
  s.lineTo(-L, b + 0.12);
  s.quadraticCurveTo(-L, b, -L + 0.1, b);
  return s;
}

// z along a cabin slope from (z0, belt) to (z1, roof) at height y
function slopeZ(t, z0, z1, y) { return z0 + (z1 - z0) * (y - t.belt) / (t.roof - t.belt); }

function slopedPanel(batch, t, width, za, ya, zb, yb, outward, color, inset = 0.06) {
  const dy = yb - ya, dz = zb - za, len = Math.hypot(dy, dz);
  const rx = Math.atan2(-dy, dz);
  let ny = -dz / len, nz = dy / len;
  if (ny * outward.y + nz * outward.z < 0) { ny = -ny; nz = -nz; }
  batch.mesh(box(width, 0.02, len - inset * 2).rotateX(0), placeMatrix(0, (ya + yb) / 2 + ny * 0.018, (za + zb) / 2 + nz * 0.018, rx), color);
}

function typeGeometry(key) {
  if (geoCache.has(key)) return geoCache.get(key);
  const t = VEHICLE_TYPES[key];
  const L = t.len / 2, W = t.wid, r = wheelRadius(t), wz = wheelBase(t);
  const [zr, zr2, zf2, zf] = t.cabin;
  const paint = new GeometryBatch(), trim = new GeometryBatch(), glass = new GeometryBatch();
  const head = new GeometryBatch(), tail = new GeometryBatch();
  paint.mesh(extrude(bodyShape(t, 0.07), W, 0.07), new THREE.Matrix4(), '#ffffff');
  const cabW = W * (t.boxy ? 0.96 : 0.84);

  if (!t.convertible) {
    const cs = new THREE.Shape();
    cs.moveTo(zr + 0.05, t.belt - 0.06);
    cs.lineTo(zr2 + 0.04, t.roof - 0.05);
    cs.lineTo(zf2 - 0.04, t.roof - 0.05);
    cs.lineTo(zf - 0.05, t.belt - 0.06);
    cs.lineTo(zr + 0.05, t.belt - 0.06);
    paint.mesh(extrude(cs, cabW, 0.05), new THREE.Matrix4(), '#ffffff');
    // side windows inset from the cabin outline, with a B-pillar on four-doors
    const y0 = t.belt + 0.06, y1 = t.roof - 0.07;
    const ws = new THREE.Shape();
    ws.moveTo(slopeZ(t, zr, zr2, y0) + 0.09, y0);
    ws.lineTo(slopeZ(t, zr, zr2, y1) + 0.09, y1);
    ws.lineTo(slopeZ(t, zf, zf2, y1) - 0.09, y1);
    ws.lineTo(slopeZ(t, zf, zf2, y0) - 0.09, y0);
    const wg = new THREE.ShapeGeometry(ws).rotateY(-Math.PI / 2);
    for (const sx of [-1, 1]) glass.mesh(wg, placeMatrix(sx * (cabW / 2 + 0.006), 0, 0), null);
    if (t.bPillar) {
      const mid = (zr2 + zf2) / 2 - 0.1;
      for (const sx of [-1, 1]) paint.mesh(box(0.03, y1 - y0 + 0.04, 0.12), placeMatrix(sx * (cabW / 2 + 0.012), (y0 + y1) / 2, mid), '#ffffff');
    }
    if (t.boxy) {
      // van: windscreen only at the front, solid panels behind the doors
      for (const sx of [-1, 1]) paint.mesh(box(0.03, y1 - y0 + 0.04, Math.max(0.1, zf2 - zr2 - 1.4)), placeMatrix(sx * (cabW / 2 + 0.012), (y0 + y1) / 2, (zr2 + zf2) / 2 - 0.7), '#ffffff');
    }
    slopedPanel(glass, t, cabW - 0.14, zf, t.belt, zf2, t.roof, { y: 1, z: 1 }, null);
    if (zr !== zr2 || !t.boxy) slopedPanel(glass, t, cabW - 0.16, zr, t.belt, zr2, t.roof, { y: 1, z: -1 }, null);
    else glass.mesh(box(cabW - 0.5, (t.roof - t.belt) * 0.45, 0.02), placeMatrix(0, t.roof - (t.roof - t.belt) * 0.35, zr - 0.01), null);
  } else {
    slopedPanel(glass, t, W * 0.8, zf, t.belt, zf - 0.22, t.belt + 0.38, { y: 1, z: 1 }, null, 0.02);
    trim.mesh(box(W * 0.72, 0.12, 1.4), placeMatrix(0, t.belt - 0.02, (zr + zf) / 2 - 0.25), '#3a2a22');
    for (const sx of [-1, 1]) {
      trim.mesh(box(0.42, 0.55, 0.14), placeMatrix(sx * 0.38, t.belt + 0.2, zr - 0.15, -0.15), '#4a3428');
      trim.mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI), placeMatrix(sx * 0.38, t.belt + 0.3, zr - 0.35), CHROME);
    }
  }

  // front: bumper, grille with chrome frame, plate, indicators; rear: bumper, plate, exhausts
  trim.mesh(box(W * 0.98, 0.2, 0.18), placeMatrix(0, 0.42, L - 0.02), DARK);
  trim.mesh(box(W * 0.98, 0.2, 0.18), placeMatrix(0, 0.42, -L + 0.02), DARK);
  trim.mesh(box(W * 0.4, Math.max(0.1, t.nose - 0.62), 0.04), placeMatrix(0, (t.nose + 0.52) / 2 - 0.04, L + 0.005), BLACK);
  trim.mesh(box(W * 0.42, 0.025, 0.05), placeMatrix(0, t.nose - 0.11, L + 0.008), CHROME);
  trim.mesh(box(0.44, 0.11, 0.02), placeMatrix(0, 0.42, L + 0.115), PLATE);
  trim.mesh(box(0.44, 0.11, 0.02), placeMatrix(0, Math.max(0.55, t.belt - 0.32), -L - 0.01), PLATE);
  for (const sx of [-1, 1]) {
    trim.mesh(box(0.12, 0.07, 0.05), placeMatrix(sx * W * 0.45, 0.42, L + 0.1), AMBER);
    trim.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 8).rotateX(Math.PI / 2), placeMatrix(sx * W * 0.28, 0.34, -L - 0.06), CHROME);
    // side skirt, door seams and handle
    trim.mesh(box(0.04, 0.09, Math.max(0.2, 2 * wz - 1.0)), placeMatrix(sx * (W / 2 + 0.01), 0.36, 0), DARK);
    if (!t.convertible) {
      for (const z of t.bPillar ? [zf - 0.05, (zr2 + zf2) / 2 - 0.1, zr + 0.1] : [zf - 0.05, zr + 0.25]) {
        trim.mesh(box(0.012, Math.max(0.2, t.belt - 0.42), 0.014), placeMatrix(sx * (W / 2 + 0.004), (t.belt + 0.4) / 2, z), BLACK);
      }
      trim.mesh(box(0.03, 0.035, 0.16), placeMatrix(sx * (W / 2 + 0.012), t.belt - 0.12, zf - 0.35), CHROME);
      // mirrors
      paint.mesh(box(0.16, 0.1, 0.09), placeMatrix(sx * (cabW / 2 + 0.12), t.belt + 0.1, zf - 0.12), '#ffffff');
      trim.mesh(box(0.02, 0.07, 0.07), placeMatrix(sx * (cabW / 2 + 0.2), t.belt + 0.1, zf - 0.1), BLACK);
    }
    // dark wheel wells behind the tyres
    for (const cz of [-wz, wz]) trim.mesh(box(W - 0.5, archRadius(t, cz), archRadius(t, cz) * 1.9), placeMatrix(0, r + archRadius(t, cz) * 0.5, cz), BLACK);
    head.mesh(box(0.42, 0.13, 0.08), placeMatrix(sx * W * 0.32, t.nose - 0.15, L - 0.005), null);
    head.mesh(box(0.34, 0.03, 0.05), placeMatrix(sx * W * 0.32, t.nose - 0.07, L - 0.03), null);
    tail.mesh(box(0.5, 0.12, 0.06), placeMatrix(sx * W * 0.31, (t.bed ? t.belt : t.belt - 0.03) - 0.2, -L - 0.005), null);
  }
  tail.mesh(box(W * 0.3, 0.05, 0.05), placeMatrix(0, (t.bed ? t.belt : t.belt - 0.03) - 0.2, -L - 0.005), null);

  if (t.spoiler) {
    paint.mesh(box(W * 0.92, 0.05, 0.34), placeMatrix(0, t.belt + 0.3, -L + 0.22, 0.08), '#ffffff');
    for (const sx of [-1, 1]) trim.mesh(box(0.06, 0.3, 0.12), placeMatrix(sx * W * 0.34, t.belt + 0.14, -L + 0.24), DARK);
    trim.mesh(box(W * 0.5, 0.04, 0.3), placeMatrix(0, t.nose - 0.02, L - 0.6), BLACK); // bonnet vent
  }
  if (t.bed) {
    for (const sx of [-1, 1]) paint.mesh(box(0.08, 0.36, -L - zr + 0.1), placeMatrix(sx * (W / 2 - 0.08), t.belt + 0.16, (zr - L) / 2), '#ffffff');
    paint.mesh(box(W - 0.1, 0.36, 0.08), placeMatrix(0, t.belt + 0.16, -L + 0.06), '#ffffff');
    trim.mesh(box(W - 0.24, 0.02, -L - zr - 0.1), placeMatrix(0, t.belt + 0.01, (zr - L) / 2), '#2b2b2b');
    trim.mesh(box(W * 0.8, 0.05, 0.05), placeMatrix(0, t.roof + 0.06, zr2 + 0.2), CHROME);
  }
  if (t.taxiSign) {
    trim.mesh(box(W + 0.02, 0.1, 2.6), placeMatrix(0, t.belt - 0.22, 0), BLACK);
    for (let k = 0; k < 13; k++) trim.mesh(box(W + 0.03, 0.05, 0.1), placeMatrix(0, t.belt - 0.22 + (k % 2 ? 0.025 : -0.025), -1.2 + k * 0.2), '#ffd60a');
  }
  if (t.police) {
    trim.mesh(box(W * 0.7, 0.36, 0.08), placeMatrix(0, 0.58, L + 0.16), BLACK); // push bar
    for (const sx of [-1, 1]) trim.mesh(box(0.06, 0.5, 0.08), placeMatrix(sx * W * 0.3, 0.6, L + 0.12), BLACK);
    trim.mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 4), placeMatrix(-0.4, t.roof + 0.35, zr2 + 0.1), BLACK);
  }
  for (const g of [paint, trim, glass, head, tail]) if (!g.vertexCount) g.mesh(box(0.001, 0.001, 0.001), new THREE.Matrix4(), '#000');
  const out = { paint: paint.build(), trim: trim.build(), glass: glass.build(), head: head.build(), tail: tail.build(), rim: rimGeometry(r) };
  geoCache.set(key, out);
  return out;
}

const rimCache = new Map();
function rimGeometry(r) {
  if (rimCache.has(r)) return rimCache.get(r);
  const b = new GeometryBatch();
  b.mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.265, 16).rotateZ(Math.PI / 2), new THREE.Matrix4(), '#2c3036');
  b.mesh(new THREE.TorusGeometry(r * 0.66, 0.025, 4, 18).rotateY(Math.PI / 2), placeMatrix(0.135, 0, 0), CHROME);
  b.mesh(new THREE.TorusGeometry(r * 0.66, 0.025, 4, 18).rotateY(Math.PI / 2), placeMatrix(-0.135, 0, 0), CHROME);
  for (let k = 0; k < 5; k++) b.mesh(box(0.29, 0.06, r * 1.25), placeMatrix(0, 0, 0, (k / 5) * Math.PI * 2), '#c9ced4');
  b.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8).rotateZ(Math.PI / 2), new THREE.Matrix4(), CHROME);
  const g = b.build();
  rimCache.set(r, g);
  return g;
}

let doorTexture = null;
function policeDoorTexture() {
  if (doorTexture) return doorTexture;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f4f6f8'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#1d3f8f'; x.fillRect(0, 96, 512, 14);
  x.fillStyle = '#d4a017';
  x.beginPath(); x.arc(70, 52, 30, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1d3f8f'; x.font = 'bold 22px "Segoe UI", sans-serif'; x.textAlign = 'center'; x.fillText('MB', 70, 60);
  x.font = 'bold 58px "Trebuchet MS", "Segoe UI", sans-serif'; x.textAlign = 'left'; x.fillText('POLICE', 120, 72);
  doorTexture = new THREE.CanvasTexture(c);
  doorTexture.colorSpace = THREE.SRGBColorSpace;
  doorTexture.anisotropy = 4;
  return doorTexture;
}

export function buildCarModel(key, color) {
  const t = VEHICLE_TYPES[key];
  const g = typeGeometry(key);
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.24, metalness: 0.5 });
  const add = (geo, mat, shadow = false) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; group.add(m); return m; };
  add(g.paint, paint, true);
  add(g.trim, shared.trim, true);
  add(g.glass, shared.glass);
  const headMat = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4cc', emissiveIntensity: 0.4, roughness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#7a0d12', emissive: '#ff1a1a', emissiveIntensity: 0.3, roughness: 0.2 });
  add(g.head, headMat);
  add(g.tail, tailMat);

  if (t.police && !t.boxy) {
    const door = new THREE.MeshStandardMaterial({ map: policeDoorTexture(), roughness: 0.35, metalness: 0.2 });
    const plane = new THREE.PlaneGeometry(2.0, 0.44);
    for (const sx of [-1, 1]) {
      const m = add(plane, door);
      m.rotation.y = sx * Math.PI / 2;
      m.position.set(sx * (t.wid / 2 + 0.015), t.belt - 0.27, -0.12);
    }
  }
  if (t.boxy && t.police) {
    const stripe = add(new THREE.BoxGeometry(t.wid + 0.03, 0.25, t.len * 0.86), new THREE.MeshStandardMaterial({ color: '#e8eef5' }));
    stripe.position.set(0, t.belt - 0.12, -0.1);
  }
  if (t.taxiSign) {
    const sign = add(new THREE.BoxGeometry(0.7, 0.22, 0.3), shared.taxiSign);
    sign.position.set(0, t.roof + 0.17, (t.cabin[1] + t.cabin[2]) / 2);
  }

  const r = wheelRadius(t);
  const tireGeo = tireGeometry(r);
  const wheels = [];
  const wz = wheelBase(t);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (t.wid / 2 - 0.1), r, sz * wz);
    const tire = new THREE.Mesh(tireGeo, shared.tire);
    tire.castShadow = true;
    tire.add(new THREE.Mesh(g.rim, shared.rim));
    pivot.add(tire);
    group.add(pivot);
    wheels.push({ pivot, tire, front: sz > 0 });
  }

  let lightbar = null;
  if (t.police) {
    const red = new THREE.MeshBasicMaterial({ color: '#ff2030', toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: '#2060ff', toneMapped: false });
    const barY = t.roof + 0.12, barZ = t.boxy ? t.cabin[2] - 0.3 : (t.cabin[1] + t.cabin[2]) / 2;
    const base = add(new THREE.BoxGeometry(1.3, 0.08, 0.32), shared.trim);
    base.position.set(0, barY - 0.07, barZ);
    const rr = add(new THREE.BoxGeometry(0.55, 0.15, 0.27), red);
    rr.position.set(-0.33, barY, barZ);
    const bb = add(new THREE.BoxGeometry(0.55, 0.15, 0.27), blue);
    bb.position.set(0.33, barY, barZ);
    // halo sprites so the flashing reads in daylight too
    const halo = (c, x) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      s.position.set(x, barY + 0.05, barZ);
      s.scale.set(3.2, 3.2, 1);
      group.add(s);
      return s;
    };
    lightbar = { red, blue, y: barY, z: barZ, redGlow: halo('#ff2a3a', -0.38), blueGlow: halo('#2a6bff', 0.38) };
  }
  return { group, paint, headMat, tailMat, wheels, lightbar, type: t };
}

const tireCache = new Map();
function tireGeometry(r) {
  if (tireCache.has(r)) return tireCache.get(r);
  // tyre with a rounded sidewall: a lathe profile turned around the axle
  const pts = [];
  const w = 0.13;
  pts.push(new THREE.Vector2(r * 0.68, -w));
  pts.push(new THREE.Vector2(r - 0.05, -w));
  pts.push(new THREE.Vector2(r - 0.01, -w + 0.03));
  pts.push(new THREE.Vector2(r, -w + 0.07));
  pts.push(new THREE.Vector2(r, w - 0.07));
  pts.push(new THREE.Vector2(r - 0.01, w - 0.03));
  pts.push(new THREE.Vector2(r - 0.05, w));
  pts.push(new THREE.Vector2(r * 0.68, w));
  const g = new THREE.LatheGeometry(pts, 20);
  g.rotateZ(Math.PI / 2);
  tireCache.set(r, g);
  return g;
}
