// Static collision world: axis-aligned boxes for buildings, walls and props in a spatial hash, with
// circle push-out for cars and people and ray casts for bullets and the camera.
const CELL = 24;

export function createCollisionWorld() {
  return { boxes: [], grid: new Map(), stamp: 0 };
}

const cellKey = (cx, cz) => cx * 73856093 ^ cz * 19349663;

export function addCollisionBox(world, minX, minZ, maxX, maxZ, height = 50, tag = 'wall') {
  const box = { minX, minZ, maxX, maxZ, minY: -5, maxY: height, tag, seen: 0 };
  world.boxes.push(box);
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const k = cellKey(cx, cz);
      if (!world.grid.has(k)) world.grid.set(k, []);
      world.grid.get(k).push(box);
    }
  }
  return box;
}

export function queryBoxes(world, minX, minZ, maxX, maxZ, out = []) {
  out.length = 0;
  world.stamp += 1;
  for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
    for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
      const list = world.grid.get(cellKey(cx, cz));
      if (!list) continue;
      for (const b of list) {
        if (b.seen === world.stamp) continue;
        b.seen = world.stamp;
        if (b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ) out.push(b);
      }
    }
  }
  return out;
}

const scratch = [];

// Pushes a circle at (pos.x, pos.z) out of every box it overlaps; returns the summed push normal.
export function resolveCircle(world, pos, radius, y = 0.5) {
  const hits = queryBoxes(world, pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, scratch);
  let nx = 0, nz = 0, hit = false;
  for (const b of hits) {
    if (y > b.maxY) continue;
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    let dx = pos.x - cx, dz = pos.z - cz;
    let d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    if (d < 1e-5) {
      // centre is inside the box: push out through the nearest face
      const pushes = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z];
      const m = Math.min(...pushes);
      const k = pushes.indexOf(m);
      dx = k === 0 ? -1 : k === 1 ? 1 : 0;
      dz = k === 2 ? -1 : k === 3 ? 1 : 0;
      pos.x += dx * (m + radius);
      pos.z += dz * (m + radius);
    } else {
      dx /= d; dz /= d;
      pos.x += dx * (radius - d);
      pos.z += dz * (radius - d);
    }
    nx += dx; nz += dz; hit = true;
  }
  if (!hit) return null;
  const len = Math.hypot(nx, nz) || 1;
  return { nx: nx / len, nz: nz / len };
}

// Distance along a 3D ray to the first box, or Infinity.
export function raycastBoxes(world, ox, oy, oz, dx, dy, dz, maxDist) {
  const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
  const hits = queryBoxes(world, Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), scratch);
  let best = Infinity;
  for (const b of hits) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, b);
    if (t >= 0 && t < best && t <= maxDist) best = t;
  }
  return best;
}

function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : 0;
}

export function hasLineOfSight(world, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return true;
  return raycastBoxes(world, ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.3;
}

export function pointBlocked(world, x, z, radius = 0.5) {
  const hits = queryBoxes(world, x - radius, z - radius, x + radius, z + radius, scratch);
  return hits.some((b) => b.maxY > 1);
}
