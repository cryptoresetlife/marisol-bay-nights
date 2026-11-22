// Paints the map of Marisol Bay once into an offscreen canvas: sea, beach, district tints, parks, lakes,
// building footprints, roads and the pier. The minimap and the big map both draw from it.
import { GRID } from '../world/roads.js';
import { blockDistrict } from '../world/districts.js';
import { blockRect } from '../world/landmarks.js';
import { SHORE_X, BEACH_START_X, QUAY_START_Z, QUAY_EDGE_Z, PIER } from '../world/terrain.js';

export const MAP_BOUNDS = { minX: -380, minZ: -380, maxX: 620, maxZ: 420, scale: 2 };

export function worldToMap(x, z) {
  return { x: (x - MAP_BOUNDS.minX) * MAP_BOUNDS.scale, y: (z - MAP_BOUNDS.minZ) * MAP_BOUNDS.scale };
}

const TINT = {
  villa: '#f3e3d3', mid: '#e9e2d4', tower: '#dfe3e8', park: '#9fd88c', deco: '#f7dde6', industrial: '#ddd6c7', brick: '#efdccd',
};

export function paintCityMap(city) {
  const S = MAP_BOUNDS.scale;
  const W = (MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * S, H = (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) * S;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const rect = (x0, z0, x1, z1, color) => {
    const a = worldToMap(x0, z0), b = worldToMap(x1, z1);
    ctx.fillStyle = color;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  };
  // sea with a soft gradient toward the shore
  const g = ctx.createLinearGradient(worldToMap(SHORE_X, 0).x, 0, W, 0);
  g.addColorStop(0, '#5cc6e8'); g.addColorStop(1, '#2a7fc0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  rect(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, SHORE_X, QUAY_EDGE_Z, '#cfe0b8');
  rect(BEACH_START_X, MAP_BOUNDS.minZ, SHORE_X, QUAY_EDGE_Z, '#f6e3b0');
  rect(MAP_BOUNDS.minX, QUAY_START_Z, BEACH_START_X + 7, QUAY_EDGE_Z, '#c9c6bd');
  for (let bj = 0; bj < GRID.count - 1; bj++) {
    for (let bi = 0; bi < GRID.count - 1; bi++) {
      const r = blockRect(bi, bj);
      const d = blockDistrict(bi, bj);
      rect(r.x0 + 8, r.z0 + 8, r.x1 - 8, r.z1 - 8, '#d9d4c8');
      rect(r.x0 + 13, r.z0 + 13, r.x1 - 13, r.z1 - 13, TINT[d.style] || '#e9e2d4');
    }
  }
  for (const lake of city.lakes) {
    const p = worldToMap(lake.x, lake.z);
    ctx.fillStyle = '#5cc6e8';
    ctx.beginPath(); ctx.arc(p.x, p.y, lake.r * S, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of city.collisions.boxes) {
    if (b.tag !== 'building') continue;
    rect(b.minX, b.minZ, b.maxX, b.maxZ, b.maxY > 60 ? '#9aa6b5' : '#b9b2a6');
  }
  // roads
  const n = GRID.count;
  for (let k = 0; k < n; k++) {
    const c0 = GRID.origin + k * GRID.pitch;
    const lo = GRID.origin - GRID.halfRoad, hi = GRID.origin + (n - 1) * GRID.pitch + GRID.halfRoad;
    rect(c0 - GRID.halfRoad, lo, c0 + GRID.halfRoad, hi, '#4b5059');
    rect(lo, c0 - GRID.halfRoad, hi, c0 + GRID.halfRoad, '#4b5059');
  }
  for (let k = 0; k < n; k++) {
    const c0 = GRID.origin + k * GRID.pitch;
    const lo = GRID.origin, hi = GRID.origin + (n - 1) * GRID.pitch;
    rect(c0 - 0.4, lo, c0 + 0.4, hi, '#f2c230');
    rect(lo, c0 - 0.4, hi, c0 + 0.4, '#f2c230');
  }
  rect(PIER.x0, PIER.z0, PIER.x1, PIER.z1, '#b98a5a');
  return c;
}
