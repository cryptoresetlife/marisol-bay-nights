// Neighbourhoods and street names of Marisol Bay, and lookups from a world position to "Street · District".
import { GRID, nearestRoad } from './roads.js';
import { isOnPier, BEACH_START_X, QUAY_START_Z } from './terrain.js';

export const DISTRICTS = {
  P: { key: 'P', name: 'Palm Heights', style: 'villa', minH: 8, maxH: 16, color: '#f7b2c4' },
  M: { key: 'M', name: 'Midtown', style: 'mid', minH: 22, maxH: 60, color: '#ffd27f' },
  D: { key: 'D', name: 'Downtown', style: 'tower', minH: 45, maxH: 135, color: '#7fd1ff' },
  F: { key: 'F', name: 'Flamingo Park', style: 'park', minH: 0, maxH: 0, color: '#7fe08a' },
  O: { key: 'O', name: 'Ocean Strip', style: 'deco', minH: 12, maxH: 34, color: '#ff9ad5' },
  K: { key: 'K', name: 'Dockyards', style: 'industrial', minH: 8, maxH: 16, color: '#c9b48a' },
  S: { key: 'S', name: 'Southside', style: 'brick', minH: 10, maxH: 26, color: '#ffb38a' },
  B: { key: 'B', name: 'Sunset Beach', style: 'beach', minH: 0, maxH: 0, color: '#ffe7a8' },
  R: { key: 'R', name: 'The Pier', style: 'pier', minH: 0, maxH: 0, color: '#d9a066' },
  H: { key: 'H', name: 'Harbor Front', style: 'quay', minH: 0, maxH: 0, color: '#9fb4c7' },
};

// Blocks between the roads, row by row from the north (bj = 0) to the south, west to east.
const BLOCK_MAP = [
  'PPPMMOO',
  'PPPMMOO',
  'PFFDDDO',
  'PFFDDDO',
  'KKSDDSO',
  'KKSSSSO',
  'KKSSSSO',
];

export const AVENUE_NAMES = [
  'Mangrove Ave', 'Hibiscus Ave', 'Seagrape Ave', 'Grand Ave',
  'Palmetto Ave', 'Marlin Ave', 'Pelican Ave', 'Tidewater Drive',
];
export const STREET_NAMES = [
  'Sunrise Blvd', 'Lantana St', 'Orchid St', 'Bayshore Blvd',
  'Cypress St', 'Jasmine St', 'Anchor St', 'Harbor Way',
];

export function blockDistrict(bi, bj) {
  const row = BLOCK_MAP[Math.max(0, Math.min(6, bj))];
  return DISTRICTS[row[Math.max(0, Math.min(6, bi))]];
}

export function blockOf(x, z) {
  return {
    bi: Math.floor((x - GRID.origin) / GRID.pitch),
    bj: Math.floor((z - GRID.origin) / GRID.pitch),
  };
}

export function districtAt(x, z) {
  if (isOnPier(x, z)) return DISTRICTS.R;
  if (x > BEACH_START_X) return DISTRICTS.B;
  if (z > QUAY_START_Z) return DISTRICTS.H;
  const { bi, bj } = blockOf(x, z);
  return blockDistrict(bi, bj);
}

export function streetNameAt(x, z) {
  if (isOnPier(x, z)) return 'Boardwalk';
  if (x > BEACH_START_X + 8) return 'Sunset Beach';
  const road = nearestRoad(x, z);
  return road.axis === 'NS' ? AVENUE_NAMES[road.index] : STREET_NAMES[road.index];
}

export function locationLabel(x, z) {
  return `${streetNameAt(x, z)} · ${districtAt(x, z).name}`;
}
