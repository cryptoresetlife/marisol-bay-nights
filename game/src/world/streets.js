// Ground surfaces: asphalt with lane paint, intersections, zebra crossings, raised sidewalks, plazas,
// lawns, the Flamingo Park lake, the harbour quay and the grassland around the city.
import * as THREE from 'three';
import { GRID, CITY_MIN, CITY_MAX } from './roads.js';
import { blockDistrict } from './districts.js';
import { blockRect, landmarkInBlock } from './landmarks.js';
import { CURB_HEIGHT, BEACH_START_X, QUAY_START_Z, QUAY_EDGE_Z } from './terrain.js';
import { GeometryBatch, batchMesh } from './geometry.js';
import { makeRoadTexture, makeIntersectionTexture, makeCrosswalkTexture, makeSidewalkTexture, makeGrassTexture, makeQuayTexture } from './textures.js';

export function buildStreetSurfaces(scene) {
  const road = new GeometryBatch();
  const cross = new GeometryBatch();
  const zebra = new GeometryBatch();
  const walk = new GeometryBatch();
  const grass = new GeometryBatch();
  const curb = new GeometryBatch();
  const quay = new GeometryBatch();
  const H = GRID.halfRoad, n = GRID.count, P = GRID.pitch;
  const y = 0.01;
  const lakes = [];

  for (let a = 0; a < n; a++) {
    const c = GRID.origin + a * P;
    for (let b = 0; b < n - 1; b++) {
      const s0 = GRID.origin + b * P + H, s1 = GRID.origin + (b + 1) * P - H;
      // avenue segment (constant x = c), texture runs along z
      road.flat(c - H, s0, c + H, s1, y, '#ffffff', { uvRect: [[0, s1 / 32], [1, s1 / 32], [1, s0 / 32], [0, s0 / 32]] });
      // street segment (constant z = c), texture runs along x
      road.flat(s0, c - H, s1, c + H, y, '#ffffff', { uvRect: [[1, s0 / 32], [1, s1 / 32], [0, s1 / 32], [0, s0 / 32]] });
      for (const s of [s0, s1 - 3.4]) {
        zebra.flat(c - H + 0.5, s + 0.2, c + H - 0.5, s + 3.2, y + 0.01, '#ffffff', { uvRect: [[0, 0], [1, 0], [1, 1], [0, 1]] });
        zebra.flat(s + 0.2, c - H + 0.5, s + 3.2, c + H - 0.5, y + 0.01, '#ffffff', { uvRect: [[0, 1], [0, 0], [1, 0], [1, 1]] });
      }
    }
    for (let b = 0; b < n; b++) {
      const c2 = GRID.origin + b * P;
      cross.flat(c - H, c2 - H, c + H, c2 + H, y, '#ffffff', { tileU: 16, tileV: 16 });
    }
  }

  // sidewalk rings, block interiors and curbs
  for (let bj = 0; bj < n - 1; bj++) {
    for (let bi = 0; bi < n - 1; bi++) {
      const r = blockRect(bi, bj);
      const o = { x0: r.x0 + H, z0: r.z0 + H, x1: r.x1 - H, z1: r.z1 - H };
      const i = { x0: r.x0 + 13, z0: r.z0 + 13, x1: r.x1 - 13, z1: r.z1 - 13 };
      const yy = CURB_HEIGHT;
      walk.flat(o.x0, o.z0, o.x1, i.z0, yy, '#ffffff', { tileU: 4, tileV: 4 });
      walk.flat(o.x0, i.z1, o.x1, o.z1, yy, '#ffffff', { tileU: 4, tileV: 4 });
      walk.flat(o.x0, i.z0, i.x0, i.z1, yy, '#ffffff', { tileU: 4, tileV: 4 });
      walk.flat(i.x1, i.z0, o.x1, i.z1, yy, '#ffffff', { tileU: 4, tileV: 4 });
      const style = blockDistrict(bi, bj).style;
      if (style === 'park' || style === 'villa') grass.flat(i.x0, i.z0, i.x1, i.z1, yy + 0.002, '#ffffff', { tileU: 12, tileV: 12 });
      else if (style === 'industrial') quay.flat(i.x0, i.z0, i.x1, i.z1, yy + 0.002, '#ffffff', { tileU: 10, tileV: 10 });
      else walk.flat(i.x0, i.z0, i.x1, i.z1, yy + 0.002, '#e8e2d6', { tileU: 4, tileV: 4 });
      curb.box(r.cx, 0, o.z0 + 0.15, o.x1 - o.x0, yy, 0.3, '#b9b4aa');
      curb.box(r.cx, 0, o.z1 - 0.15, o.x1 - o.x0, yy, 0.3, '#b9b4aa');
      curb.box(o.x0 + 0.15, 0, r.cz, 0.3, yy, o.z1 - o.z0, '#b9b4aa');
      curb.box(o.x1 - 0.15, 0, r.cz, 0.3, yy, o.z1 - o.z0, '#b9b4aa');
      if (style === 'park' && (bi + bj) % 2 === 1 && !landmarkInBlock(bi, bj)) lakes.push({ x: r.cx, z: r.cz, r: 22 });
    }
  }

  // outer sidewalks on the city edge, the beach promenade and the quay
  const E = CITY_MAX + H, W = CITY_MIN - H;
  walk.flat(W - 6, W - 6, E, W, CURB_HEIGHT, '#ffffff', { tileU: 4, tileV: 4 });
  walk.flat(W - 6, W, W, QUAY_START_Z, CURB_HEIGHT, '#ffffff', { tileU: 4, tileV: 4 });
  walk.flat(BEACH_START_X, W - 6, BEACH_START_X + 7, QUAY_START_Z, CURB_HEIGHT, '#f3e6d2', { tileU: 4, tileV: 4 });
  quay.flat(W - 6, QUAY_START_Z, BEACH_START_X + 7, QUAY_EDGE_Z, CURB_HEIGHT, '#ffffff', { tileU: 10, tileV: 10 });
  curb.box((W - 6 + BEACH_START_X + 7) / 2, -1.2, QUAY_EDGE_Z - 0.3, BEACH_START_X + 13 - W, 1.4, 0.6, '#8d8a84');
  grass.flat(-1400, -1400, BEACH_START_X + 7, W - 6, -0.02, '#d8ffd0', { tileU: 14, tileV: 14 });
  grass.flat(-1400, W - 6, W - 6, 360, -0.02, '#d8ffd0', { tileU: 14, tileV: 14 });

  const group = new THREE.Group();
  group.name = 'streets';
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, ...extra });
  group.add(batchMesh(road, std(makeRoadTexture()), { castShadow: false }));
  group.add(batchMesh(cross, std(makeIntersectionTexture()), { castShadow: false }));
  group.add(batchMesh(zebra, std(makeCrosswalkTexture(), { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), { castShadow: false }));
  group.add(batchMesh(walk, std(makeSidewalkTexture()), { castShadow: false }));
  group.add(batchMesh(grass, std(makeGrassTexture()), { castShadow: false }));
  group.add(batchMesh(quay, std(makeQuayTexture()), { castShadow: false }));
  group.add(batchMesh(curb, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { castShadow: false }));

  for (const lake of lakes) {
    const mat = new THREE.MeshStandardMaterial({ color: '#2fb5c8', roughness: 0.1, metalness: 0.2 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(lake.r, 40), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(lake.x, CURB_HEIGHT + 0.03, lake.z);
    m.receiveShadow = true;
    group.add(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(lake.r, lake.r + 1.4, 40), new THREE.MeshStandardMaterial({ color: '#d9cfb8', roughness: 0.9 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(lake.x, CURB_HEIGHT + 0.035, lake.z);
    group.add(rim);
  }
  scene.add(group);
  return { group, lakes };
}
