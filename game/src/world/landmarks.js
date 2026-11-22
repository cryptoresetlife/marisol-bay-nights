// Named places of Marisol Bay: shops, the hospital, the police station, safehouse and mission spots.
// Each sits on one side of a city block; its door is on the sidewalk in front of that side.
import { GRID } from './roads.js';

export const LANDMARKS = [
  { id: 'tikiTaco', name: 'Tiki Taco', block: [6, 2], side: 'E', sign: 'TIKI TACO', color: '#ffb347', signColor: '#ffe14d', height: 9, icon: 'L' },
  { id: 'safehouse', name: 'Seabreeze Apartments', block: [6, 4], side: 'E', sign: 'SEABREEZE', color: '#a8e6cf', signColor: '#5ff2ff', height: 22, icon: 'H' },
  { id: 'hospital', name: 'Mercy General', block: [3, 1], side: 'S', sign: 'MERCY GENERAL', color: '#f4f7fb', signColor: '#ff5a5a', height: 30, icon: '+' },
  { id: 'police', name: 'MBPD Central Station', block: [3, 5], side: 'N', sign: 'MBPD', color: '#d7dde6', signColor: '#4fa8ff', height: 16, icon: 'P' },
  { id: 'gunShop', name: 'Iron Pelican Arms', block: [5, 4], side: 'W', sign: 'IRON PELICAN ARMS', color: '#8a8f99', signColor: '#ff7b2e', height: 8, icon: 'G' },
  { id: 'sprayNorth', name: 'Fresh Coat', block: [4, 0], side: 'S', sign: 'FRESH COAT', color: '#7ad7f0', signColor: '#ff4fd8', height: 8, icon: 'S' },
  { id: 'spraySouth', name: 'Fresh Coat', block: [1, 4], side: 'E', sign: 'FRESH COAT', color: '#7ad7f0', signColor: '#ff4fd8', height: 8, icon: 'S' },
  { id: 'bank', name: 'Bayfront Savings', block: [4, 3], side: 'W', sign: 'BAYFRONT SAVINGS', color: '#efe3c8', signColor: '#7dffb0', height: 26, icon: '$' },
  { id: 'vanceTower', name: 'Vance Tower', block: [3, 2], side: 'E', sign: 'VANCE', color: '#1f2b3a', signColor: '#ffd86b', height: 180, icon: 'V' },
  { id: 'garage', name: "Lupe's Garage", block: [0, 5], side: 'E', sign: 'LUPE AUTO', color: '#f6c6a0', signColor: '#ffe14d', height: 9, icon: 'W' },
  { id: 'coralHQ', name: 'Coral Kings Warehouse', block: [1, 6], side: 'N', sign: 'CORAL KINGS', color: '#c7b08a', signColor: '#ff5f7a', height: 12, icon: 'C' },
];

const SIDE_DIR = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };

export function blockRect(bi, bj) {
  const x0 = GRID.origin + bi * GRID.pitch, z0 = GRID.origin + bj * GRID.pitch;
  return { x0, z0, x1: x0 + GRID.pitch, z1: z0 + GRID.pitch, cx: x0 + GRID.pitch / 2, cz: z0 + GRID.pitch / 2 };
}

// Door point on the sidewalk and the facing direction of the building front.
export function landmarkDoor(lm) {
  const r = blockRect(lm.block[0], lm.block[1]);
  const [dx, dz] = SIDE_DIR[lm.side];
  const walk = GRID.pitch / 2 - 10.5;
  return { x: r.cx + dx * walk, z: r.cz + dz * walk, dx, dz };
}

// Kerb-side point on the road in front of the landmark, where a car can stop.
export function landmarkCurb(lm) {
  const d = landmarkDoor(lm);
  return { x: d.x + d.dx * 4.6, z: d.z + d.dz * 4.6 };
}

export function getLandmark(id) {
  return LANDMARKS.find((l) => l.id === id);
}

export function landmarkInBlock(bi, bj) {
  return LANDMARKS.find((l) => l.block[0] === bi && l.block[1] === bj) || null;
}
