// Coastline and ground height: the sand that slopes into the sea, the quay, and the raised deck of The Pier.
import { isOnRoad } from './roads.js';

export const BEACH_START_X = 323;  // east kerb of Tidewater Drive; the promenade and sand begin here
export const SHORE_X = 392;        // waterline on Sunset Beach
export const QUAY_START_Z = 323;   // south kerb of Harbor Way
export const QUAY_EDGE_Z = 346;    // concrete quay edge on the bay
export const WORLD_WEST = -348;
export const WORLD_NORTH = -348;
export const WATER_LEVEL = -0.7;
export const PIER = { x0: 372, x1: 560, z0: -52, z1: -38, deck: 0.55 };

export function isOnPier(x, z) {
  return x >= PIER.x0 && x <= PIER.x1 && z >= PIER.z0 && z <= PIER.z1;
}

export function isWater(x, z) {
  if (isOnPier(x, z)) return false;
  return x > SHORE_X || z > QUAY_EDGE_Z;
}

export const CURB_HEIGHT = 0.12;

export function groundHeight(x, z) {
  if (isOnPier(x, z)) {
    const ramp = Math.min(1, Math.max(0, (x - PIER.x0) / 10));
    return sandHeight(x) * (1 - ramp) + PIER.deck * ramp;
  }
  if (x > BEACH_START_X + 6) return sandHeight(x);
  if (x > -323 && z > -323 && x < BEACH_START_X && z < QUAY_EDGE_Z && !isOnRoad(x, z)) return CURB_HEIGHT;
  return 0;
}

function sandHeight(x) {
  if (x < 350) return 0.02;
  return 0.02 - (x - 350) * 0.011;
}
