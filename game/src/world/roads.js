// The road grid of Marisol Bay: intersections, lanes, traffic-light phases and shortest paths between corners.
export const GRID = {
  count: 8,          // roads per axis (8 avenues running north-south, 8 streets running east-west)
  pitch: 90,         // metres between road centrelines
  origin: -315,      // world coordinate of the first road
  halfRoad: 8,       // half the asphalt width
  sidewalkOuter: 13, // sidewalk runs from the kerb at 8 m to 13 m from the centreline
  laneOffset: 2.1,   // driving lane centre, right of the centreline
  parkOffset: 6.1,   // parking lane centre
  stopGap: 4.0,      // stop line distance beyond the kerb line of the crossing road (behind the zebra)
};

export const DIR_X = [1, 0, -1, 0]; // 0 east, 1 south, 2 west, 3 north
export const DIR_Z = [0, 1, 0, -1];
export const DIR_YAW = [Math.PI / 2, 0, -Math.PI / 2, Math.PI]; // yaw that faces each direction
export const LIGHT_CYCLE = 24;

export function buildRoadNetwork() {
  const nodes = [];
  const n = GRID.count;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const links = [
        i < n - 1 ? j * n + i + 1 : -1,
        j < n - 1 ? (j + 1) * n + i : -1,
        i > 0 ? j * n + i - 1 : -1,
        j > 0 ? (j - 1) * n + i : -1,
      ];
      const degree = links.filter((l) => l >= 0).length;
      nodes.push({
        id: j * n + i, i, j,
        x: GRID.origin + i * GRID.pitch,
        z: GRID.origin + j * GRID.pitch,
        links,
        hasLights: degree >= 3,
        lightOffset: (i * 7 + j * 11) % LIGHT_CYCLE,
      });
    }
  }
  return { nodes, time: 0 };
}

export function nodeIndex(i, j) {
  if (i < 0 || j < 0 || i >= GRID.count || j >= GRID.count) return -1;
  return j * GRID.count + i;
}

export function rightOf(d) {
  return { x: -DIR_Z[d], z: DIR_X[d] };
}

// 'G', 'Y' or 'R' for traffic on the given axis ('EW' for directions 0/2, 'NS' for 1/3).
export function trafficLightState(roads, node, dir) {
  if (!node.hasLights) return 'G';
  const p = (roads.time + node.lightOffset) % LIGHT_CYCLE;
  const ew = dir === 0 || dir === 2;
  const phase = ew ? p : (p + LIGHT_CYCLE / 2) % LIGHT_CYCLE;
  if (phase < 9) return 'G';
  if (phase < 11.5) return 'Y';
  return 'R';
}

export function updateTrafficLights(roads, dt) {
  roads.time = (roads.time + dt) % (LIGHT_CYCLE * 1000);
}

// Lane entry point just past an intersection when leaving `node` in direction `d`.
export function laneExitPoint(node, d, offset = GRID.laneOffset) {
  const r = rightOf(d);
  const k = GRID.halfRoad + GRID.stopGap;
  return { x: node.x + DIR_X[d] * k + r.x * offset, z: node.z + DIR_Z[d] * k + r.z * offset };
}

// Stop-line point before entering `node` while travelling in direction `d`.
export function laneStopPoint(node, d, offset = GRID.laneOffset) {
  const r = rightOf(d);
  const k = GRID.halfRoad + GRID.stopGap;
  return { x: node.x - DIR_X[d] * k + r.x * offset, z: node.z - DIR_Z[d] * k + r.z * offset };
}

export function nearestNode(roads, x, z) {
  const i = Math.round((x - GRID.origin) / GRID.pitch);
  const j = Math.round((z - GRID.origin) / GRID.pitch);
  const ci = Math.max(0, Math.min(GRID.count - 1, i));
  const cj = Math.max(0, Math.min(GRID.count - 1, j));
  return roads.nodes[nodeIndex(ci, cj)];
}

// Nearest road centreline: axis 'NS' for an avenue (constant x), 'EW' for a street (constant z).
export function nearestRoad(x, z) {
  const fi = (x - GRID.origin) / GRID.pitch;
  const fj = (z - GRID.origin) / GRID.pitch;
  const i = Math.max(0, Math.min(GRID.count - 1, Math.round(fi)));
  const j = Math.max(0, Math.min(GRID.count - 1, Math.round(fj)));
  const dx = Math.abs(x - (GRID.origin + i * GRID.pitch));
  const dz = Math.abs(z - (GRID.origin + j * GRID.pitch));
  const inX = z >= GRID.origin - GRID.halfRoad && z <= GRID.origin + (GRID.count - 1) * GRID.pitch + GRID.halfRoad;
  const inZ = x >= GRID.origin - GRID.halfRoad && x <= GRID.origin + (GRID.count - 1) * GRID.pitch + GRID.halfRoad;
  if ((dx <= dz && inX) || !inZ) return { axis: 'NS', index: i, dist: dx };
  return { axis: 'EW', index: j, dist: dz };
}

export function isOnRoad(x, z) {
  return nearestRoad(x, z).dist < GRID.halfRoad;
}

// Breadth-first path over the grid; returns node ids from start to goal inclusive.
export function findRoadPath(roads, startId, goalId) {
  if (startId === goalId) return [startId];
  const prev = new Int32Array(roads.nodes.length).fill(-2);
  prev[startId] = -1;
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goalId) break;
    for (const next of roads.nodes[cur].links) {
      if (next >= 0 && prev[next] === -2) { prev[next] = cur; queue.push(next); }
    }
  }
  const path = [];
  for (let at = goalId; at >= 0; at = prev[at]) path.push(at);
  return path.reverse();
}

export function directionBetween(a, b) {
  if (b.i > a.i) return 0;
  if (b.j > a.j) return 1;
  if (b.i < a.i) return 2;
  return 3;
}

export const CITY_MIN = GRID.origin;
export const CITY_MAX = GRID.origin + (GRID.count - 1) * GRID.pitch;
