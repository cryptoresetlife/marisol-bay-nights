// City blocks to buildings: towers downtown, pastel art-deco hotels on the Ocean Strip, villas with tile
// roofs in Palm Heights, brick walk-ups in Southside and warehouses in the Dockyards, with storefronts,
// awnings, neon shop signs and landmark buildings. Every footprint also becomes a collision box.
import * as THREE from 'three';
import { GRID } from './roads.js';
import { blockDistrict } from './districts.js';
import { LANDMARKS, blockRect, landmarkInBlock, landmarkDoor } from './landmarks.js';
import { GeometryBatch, batchMesh, placeMatrix } from './geometry.js';
import { makeFacadeTexture, makeStripeTexture, makeSignTexture } from './textures.js';
import { addCollisionBox } from '../systems/collisions.js';
import { randRange, randInt, pickOne } from '../core/rng.js';

const TILE = {
  glass: [24, 28.8], deco: [27.2, 26.4], mid: [25.6, 28], villa: [28, 27.2], brick: [24, 25.6], industrial: [40, 36],
};
const PALETTE = {
  deco: ['#ffb7c9', '#a8f0d8', '#c9b6ff', '#ffd3a5', '#9fe3ff', '#fff1a8', '#ff9fb0', '#b8f5c0'],
  villa: ['#fff3e6', '#ffe0ec', '#e6fff4', '#fff7c9', '#e8f0ff', '#ffd9c2'],
  mid: ['#f3e3c7', '#e9edf2', '#f7d9c4', '#dbe7e0', '#f0d7d0', '#fde2b8'],
  glass: ['#d6ecff', '#c9f2ec', '#e2ddff', '#ffe8d0', '#e8f4ff', '#bfd9f2'],
  brick: ['#e8b49a', '#d99c84', '#f1c9a5', '#cf9f8c', '#e4c1a1'],
  industrial: ['#c9c2b4', '#b8c4c9', '#d6c8a8', '#a9b8a0'],
};
export const NEON_COLORS = ['#ff4fd8', '#5ff2ff', '#ffe14d', '#7dffb0', '#ff7b2e', '#b48bff', '#ff5f7a'];
const SHOP_NAMES = [
  'CASA CUBANO', 'LUCKY GECKO', 'SURF SHACK', 'NEON FLAMINGO', 'CORAL CAFE', 'MANGO MART', 'STARFISH DINER',
  'LIME & SALT', 'GATOR BITES', 'SALSA SOL', 'ISLAND INK', 'VINYL VIBE', 'HURRICANE GYM', 'BAYVIEW BOOKS',
  'PALMETTO PHARMACY', 'RETRO ROLLERS', 'MOJO JUICE', 'PINK PELICAN', 'SUNBEAM HOTEL', 'MANATEE MOTEL',
  'PASTEL PALMS INN', 'BLUE MARLIN BAR', 'CAFE TROPICAL', 'SEASHELL SPA', 'TROPIC THUNDER', 'OCEAN BREEZE',
];
const HOTEL_NAMES = ['SUNBEAM', 'MANATEE', 'PASTEL PALMS', 'THE CORALINE', 'HOTEL FLORA', 'AQUA VISTA', 'EL DORADO', 'BREAKERS'];

export function buildBuildings(scene, collisions, rng) {
  const batches = {};
  const batchFor = (style) => (batches[style] ||= new GeometryBatch());
  const trim = new GeometryBatch();
  const awnings = new GeometryBatch();
  const roofTiles = new GeometryBatch();
  const signs = [];
  const yards = [];
  let shopIndex = 0;

  for (let bj = 0; bj < GRID.count - 1; bj++) {
    for (let bi = 0; bi < GRID.count - 1; bi++) {
      const district = blockDistrict(bi, bj);
      if (district.style === 'park') continue;
      const r = blockRect(bi, bj);
      const inner = { x0: r.x0 + 13.5, z0: r.z0 + 13.5, x1: r.x1 - 13.5, z1: r.z1 - 13.5 };
      const lm = landmarkInBlock(bi, bj);
      let lots = [];
      if (lm) {
        const [a, b] = splitForLandmark(inner, lm.side);
        buildLandmark(lm, a, batchFor, trim, signs, collisions, rng);
        lots = subdivide(b, district.style === 'villa' ? 2 : 1, district.style === 'villa' ? 2 : 1, 5);
      } else {
        lots = lotsFor(district.style, inner, rng);
      }
      for (const lot of lots) {
        const fronts = frontSides(lot, inner);
        const ctx = { batchFor, trim, awnings, roofTiles, signs, yards, collisions, rng, fronts, district };
        if (district.style === 'villa') buildVilla(lot, ctx);
        else if (district.style === 'industrial') buildWarehouse(lot, ctx);
        else buildTowerish(lot, ctx, () => SHOP_NAMES[shopIndex++ % SHOP_NAMES.length]);
      }
    }
  }

  const group = new THREE.Group();
  group.name = 'buildings';
  const nightMaterials = [];
  for (const [style, batch] of Object.entries(batches)) {
    const tex = makeFacadeTexture(style);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map, emissiveMap: tex.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0,
      vertexColors: true, roughness: style === 'glass' ? 0.35 : 0.82, metalness: style === 'glass' ? 0.35 : 0.0,
    });
    nightMaterials.push(mat);
    group.add(batchMesh(batch, mat));
  }
  group.add(batchMesh(trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 })));
  group.add(batchMesh(roofTiles, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  const stripe = makeStripeTexture('#ffffff', '#8f8f8f');
  group.add(batchMesh(awnings, new THREE.MeshStandardMaterial({ map: stripe, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
  const signGroup = buildSignMeshes(signs);
  group.add(signGroup.group);
  scene.add(group);
  return { group, nightMaterials, signMaterials: signGroup.materials, yards, signs };
}

function subdivide(rect, nx, nz, gap) {
  const lots = [];
  const w = (rect.x1 - rect.x0 - gap * (nx - 1)) / nx;
  const d = (rect.z1 - rect.z0 - gap * (nz - 1)) / nz;
  for (let a = 0; a < nx; a++) {
    for (let b = 0; b < nz; b++) {
      const x0 = rect.x0 + a * (w + gap), z0 = rect.z0 + b * (d + gap);
      lots.push({ x0, z0, x1: x0 + w, z1: z0 + d });
    }
  }
  return lots;
}

function lotsFor(style, inner, rng) {
  if (style === 'villa') return subdivide(inner, 3, 3, 4);
  if (style === 'industrial') return subdivide(inner, 1, 2, 8);
  if (style === 'tower') return rng() < 0.3 ? subdivide(inner, 1, 1, 0) : subdivide(inner, 2, 2, 5);
  if (style === 'deco') return rng() < 0.5 ? subdivide(inner, 2, 2, 4) : subdivide(inner, 2, 3, 4);
  return subdivide(inner, 2, rng() < 0.5 ? 2 : 3, 4);
}

function splitForLandmark(inner, side) {
  const depth = 30;
  if (side === 'E') return [{ ...inner, x0: inner.x1 - depth }, { ...inner, x1: inner.x1 - depth - 5 }];
  if (side === 'W') return [{ ...inner, x1: inner.x0 + depth }, { ...inner, x0: inner.x0 + depth + 5 }];
  if (side === 'S') return [{ ...inner, z0: inner.z1 - depth }, { ...inner, z1: inner.z1 - depth - 5 }];
  return [{ ...inner, z1: inner.z0 + depth }, { ...inner, z0: inner.z0 + depth + 5 }];
}

// Which sides of a lot face the street (touch the block's inner edge).
function frontSides(lot, inner) {
  const s = [];
  if (Math.abs(lot.x1 - inner.x1) < 0.6) s.push([1, 0]);
  if (Math.abs(lot.x0 - inner.x0) < 0.6) s.push([-1, 0]);
  if (Math.abs(lot.z1 - inner.z1) < 0.6) s.push([0, 1]);
  if (Math.abs(lot.z0 - inner.z0) < 0.6) s.push([0, -1]);
  return s;
}

function facadePoint(lot, dir, out = 0) {
  const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
  const hw = (lot.x1 - lot.x0) / 2, hd = (lot.z1 - lot.z0) / 2;
  return { x: cx + dir[0] * (hw + out), z: cz + dir[1] * (hd + out), width: dir[0] ? lot.z1 - lot.z0 : lot.x1 - lot.x0, yaw: Math.atan2(dir[0], dir[1]) };
}

function addStorefront(lot, dir, ctx, color, signText, signColor) {
  const f = facadePoint(lot, dir, 0.25);
  const w = f.width - 3;
  const along = dir[0] ? [0, 1] : [1, 0];
  // dark shop glass band
  const gx = dir[0] ? 0.5 : w, gz = dir[0] ? w : 0.5;
  ctx.trim.box(f.x, 0, f.z, gx, 3.6, gz, '#22313d', { roofColor: '#30414e' });
  // awning sloping out over the sidewalk
  const m = placeMatrix(f.x + dir[0] * 1.2, 4.1, f.z + dir[1] * 1.2, 0, f.yaw, 0);
  const geo = new THREE.BoxGeometry(w, 0.12, 2.6);
  geo.rotateX(0.32);
  ctx.awnings.mesh(geo, m, color);
  if (signText) {
    ctx.signs.push({ text: signText, color: signColor, x: f.x + dir[0] * 0.15, y: 5.6, z: f.z + dir[1] * 0.15, yaw: f.yaw, w: Math.min(11, w * 0.8), h: 2.4 });
  }
  return along;
}

function roofClutter(ctx, x0, z0, x1, z1, y, rng) {
  const n = randInt(rng, 1, 4);
  for (let k = 0; k < n; k++) {
    const w = randRange(rng, 1.5, 3.5), d = randRange(rng, 1.5, 3.5);
    const x = randRange(rng, x0 + w, x1 - w), z = randRange(rng, z0 + d, z1 - d);
    ctx.trim.box(x, y, z, w, randRange(rng, 1, 2.2), d, '#b9bfc4', { roofColor: '#9aa1a6' });
  }
  // parapet
  const t = 0.4;
  ctx.trim.box((x0 + x1) / 2, y, z0 + t / 2, x1 - x0, 0.9, t, '#d9d4cc');
  ctx.trim.box((x0 + x1) / 2, y, z1 - t / 2, x1 - x0, 0.9, t, '#d9d4cc');
  ctx.trim.box(x0 + t / 2, y, (z0 + z1) / 2, t, 0.9, z1 - z0, '#d9d4cc');
  ctx.trim.box(x1 - t / 2, y, (z0 + z1) / 2, t, 0.9, z1 - z0, '#d9d4cc');
}

function buildTowerish(lot, ctx, nextShop) {
  const { rng, district } = ctx;
  let style = district.style === 'tower' ? 'glass' : district.style;
  if (style === 'mid' && rng() < 0.35) style = 'glass';
  const color = pickOne(rng, PALETTE[style]);
  const [tw, th] = TILE[style];
  const w = lot.x1 - lot.x0, d = lot.z1 - lot.z0;
  const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
  let h = randRange(rng, district.minH, district.maxH);
  if (district.style === 'tower' && w > 50) h *= 0.75;
  h = Math.round(h / (th / 8)) * (th / 8) + 0.4;
  const batch = ctx.batchFor(style);
  const roof = '#8c9197';
  if (h > 70) {
    const h1 = Math.round(h * 0.62);
    batch.box(cx, 0, cz, w, h1, d, color, { tileW: tw, tileH: th, roofColor: roof });
    const w2 = w * 0.72, d2 = d * 0.72;
    batch.box(cx, h1, cz, w2, h - h1, d2, color, { tileW: tw, tileH: th, roofColor: roof });
    ctx.trim.box(cx, h, cz, w2 * 0.5, 4, d2 * 0.5, '#e8eef2', { roofColor: '#c9d0d6' });
    if (rng() < 0.5) ctx.trim.box(cx, h + 4, cz, 0.6, 14, 0.6, '#cfd6dc');
    roofClutter(ctx, cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h1, rng);
  } else {
    batch.box(cx, 0, cz, w, h, d, color, { tileW: tw, tileH: th, roofColor: roof });
    roofClutter(ctx, cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, rng);
  }
  if (style === 'deco') {
    // art-deco fin and cornice in a bolder shade
    const accent = new THREE.Color(color).offsetHSL(0, 0.1, -0.12).getStyle();
    for (const dir of ctx.fronts.slice(0, 1)) {
      const f = facadePoint(lot, dir, 0.6);
      ctx.trim.box(f.x, 4.5, f.z, dir[0] ? 1.2 : 2.2, h - 2, dir[0] ? 2.2 : 1.2, accent);
      ctx.signs.push({ text: pickOne(rng, HOTEL_NAMES), color: pickOne(rng, NEON_COLORS), x: f.x + dir[0] * 0.75, y: h * 0.62, z: f.z + dir[1] * 0.75, yaw: f.yaw, w: 9, h: 2.4 });
    }
    // cornice band around the top, as four strips so it never covers the roof
    ctx.trim.box(cx, h - 1.4, cz - d / 2 - 0.2, w + 0.8, 1.2, 0.4, accent);
    ctx.trim.box(cx, h - 1.4, cz + d / 2 + 0.2, w + 0.8, 1.2, 0.4, accent);
    ctx.trim.box(cx - w / 2 - 0.2, h - 1.4, cz, 0.4, 1.2, d, accent);
    ctx.trim.box(cx + w / 2 + 0.2, h - 1.4, cz, 0.4, 1.2, d, accent);
  }
  for (const dir of ctx.fronts) {
    const shop = rng() < 0.8 ? nextShop() : null;
    addStorefront(lot, dir, ctx, pickOne(rng, ['#ff6f91', '#3fc1c9', '#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#f78c6b']), shop, pickOne(rng, NEON_COLORS));
  }
  addCollisionBox(ctx.collisions, lot.x0, lot.z0, lot.x1, lot.z1, h, 'building');
}

function buildVilla(lot, ctx) {
  const { rng } = ctx;
  const color = pickOne(rng, PALETTE.villa);
  const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
  const w = (lot.x1 - lot.x0) * randRange(rng, 0.62, 0.8), d = (lot.z1 - lot.z0) * randRange(rng, 0.6, 0.78);
  const floors = rng() < 0.6 ? 2 : 1;
  const h = floors * 3.4 + 0.3;
  const [tw, th] = TILE.villa;
  ctx.batchFor('villa').box(cx, 0, cz, w, h, d, color, { tileW: tw, tileH: th, roofColor: '#c7643f' });
  // terracotta hip roof
  const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  ctx.roofTiles.mesh(roofGeo, placeMatrix(cx, h + 1.25, cz, 0, 0, 0, w * 1.1 * 1.0, 2.5, d * 1.1), pickOne(rng, ['#d0693e', '#c45a35', '#e07a4a']));
  // garden wall and maybe a pool
  if (rng() < 0.45) {
    const px = lot.x0 + 3.5, pz = lot.z0 + 3;
    ctx.trim.box(px + 2, 0, pz + 1.5, 4.6, 0.12, 3.6, '#4fd1e8', { roofColor: '#47c9e6' });
  }
  ctx.yards.push({ x: lot.x0 + 1.5, z: lot.z1 - 1.5 }, { x: lot.x1 - 1.5, z: lot.z0 + 1.5 });
  addCollisionBox(ctx.collisions, cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h + 2, 'building');
}

function buildWarehouse(lot, ctx) {
  const { rng } = ctx;
  const color = pickOne(rng, PALETTE.industrial);
  const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
  const w = lot.x1 - lot.x0, d = lot.z1 - lot.z0;
  const h = randRange(rng, 8, 13);
  const [tw, th] = TILE.industrial;
  ctx.batchFor('industrial').box(cx, 0, cz, w, h, d, color, { tileW: tw, tileH: th, roofColor: '#7d8a8f' });
  const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI);
  roofGeo.rotateZ(Math.PI / 2);
  roofGeo.rotateY(Math.PI / 2);
  ctx.trim.mesh(roofGeo, placeMatrix(cx, h, cz, 0, 0, 0, w / 2, 2.2, d), '#8e9aa0');
  for (const dir of ctx.fronts) {
    const f = facadePoint(lot, dir, 0.2);
    for (let k = -1; k <= 1; k += 2) {
      const off = k * f.width * 0.22;
      ctx.trim.box(f.x + (dir[0] ? 0 : off), 0, f.z + (dir[0] ? off : 0), dir[0] ? 0.4 : 6, 5.2, dir[0] ? 6 : 0.4, '#5c6870');
    }
  }
  addCollisionBox(ctx.collisions, lot.x0, lot.z0, lot.x1, lot.z1, h, 'building');
}

function buildLandmark(lm, lot, batchFor, trim, signs, collisions, rng) {
  const door = landmarkDoor(lm);
  const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
  const w = lot.x1 - lot.x0, d = lot.z1 - lot.z0;
  const tall = lm.height > 60;
  const style = tall ? 'glass' : lm.id === 'hospital' || lm.id === 'bank' ? 'mid' : lm.id === 'safehouse' ? 'deco' : 'brick';
  const [tw, th] = TILE[style];
  const batch = batchFor(style);
  if (tall) {
    const fw = w * 0.85, fd = d * 0.85;
    batch.box(cx, 0, cz, fw, lm.height * 0.7, fd, '#9fb3c8', { tileW: tw, tileH: th });
    batch.box(cx, lm.height * 0.7, cz, fw * 0.7, lm.height * 0.3, fd * 0.7, '#9fb3c8', { tileW: tw, tileH: th });
    trim.box(cx, lm.height, cz, fw * 0.5, 6, fd * 0.5, '#e8c15a', { roofColor: '#f4d27a' });
    trim.box(cx, lm.height + 6, cz, 0.8, 22, 0.8, '#f4d27a');
    const out = door.dx ? fw / 2 + 0.3 : fd / 2 + 0.3;
    signs.push({ text: lm.sign, color: lm.signColor, x: cx + door.dx * out, y: lm.height * 0.7 - 6, z: cz + door.dz * out, yaw: Math.atan2(door.dx, door.dz), w: 22, h: 5.5 });
    addCollisionBox(collisions, cx - fw / 2, cz - fd / 2, cx + fw / 2, cz + fd / 2, lm.height, 'building');
  } else {
    batch.box(cx, 0, cz, w, lm.height, d, lm.color, { tileW: tw, tileH: th, roofColor: '#8c9197' });
    roofClutter({ trim }, lot.x0, lot.z0, lot.x1, lot.z1, lm.height, rng);
    const out = door.dx ? w / 2 + 0.3 : d / 2 + 0.3;
    const fx = cx + door.dx * out, fz = cz + door.dz * out;
    trim.box(fx, 0, fz, door.dx ? 0.5 : 10, 3.8, door.dx ? 10 : 0.5, '#1f2a33');
    signs.push({ text: lm.sign, color: lm.signColor, x: fx + door.dx * 0.2, y: Math.min(lm.height - 1.6, 6.2), z: fz + door.dz * 0.2, yaw: Math.atan2(door.dx, door.dz), w: 13, h: 3 });
    if (lm.id === 'tikiTaco') {
      // thatched kiosk roof and tiki torches
      const g = new THREE.ConeGeometry(1, 1, 8);
      trim.mesh(g, placeMatrix(fx + door.dx * 3, 3.8, fz + door.dz * 3, 0, 0, 0, 6, 2.4, 6), '#c8a052');
    }
    addCollisionBox(collisions, lot.x0, lot.z0, lot.x1, lot.z1, lm.height, 'building');
  }
}

function buildSignMeshes(signs) {
  const group = new THREE.Group();
  const materials = [];
  const geo = new THREE.PlaneGeometry(1, 1);
  for (const s of signs) {
    const tex = makeSignTexture(s.text, { fg: s.color });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) });
    materials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.yaw;
    m.scale.set(s.w, s.h, 1);
    group.add(m);
  }
  return { group, materials };
}

export function landmarkList() {
  return LANDMARKS;
}
