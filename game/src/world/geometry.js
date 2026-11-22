// Geometry batching: collects coloured boxes, quads and transformed meshes into one BufferGeometry,
// so a whole district of buildings or props draws in a single call.
import * as THREE from 'three';

const tmpColor = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();

export class GeometryBatch {
  constructor() {
    this.pos = []; this.nor = []; this.uv = []; this.col = [];
  }

  get vertexCount() { return this.pos.length / 3; }

  quad(a, b, c, d, n, uvs, color) {
    tmpColor.set(color);
    const verts = [a, b, c, a, c, d];
    const uvIdx = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const v = verts[k];
      this.pos.push(v[0], v[1], v[2]);
      this.nor.push(n[0], n[1], n[2]);
      const u = uvs[uvIdx[k]];
      this.uv.push(u[0], u[1]);
      this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  // Axis-aligned box from its base centre. Walls map u along the face and v up the height in facade tiles.
  box(cx, y0, cz, w, h, d, color, { tileW = 0, tileH = 0, roofColor = null, roofUV = [0.004, 0.004], skipBottom = true, wallColors = null } = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
    const tw = tileW || 1e9, th = tileH || 1e9;
    const v0 = tileH ? y0 / th : 0, v1 = tileH ? y1 / th : 0;
    const wallUV = (len) => (tileW ? [[0, v0], [len / tw, v0], [len / tw, v1], [0, v1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const wc = (k) => (wallColors ? wallColors[k] : color);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], wallUV(w), wc(0));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], wallUV(w), wc(1));
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], wallUV(d), wc(2));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], wallUV(d), wc(3));
    const r = roofUV;
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [r, r, r, r], roofColor || color);
    if (!skipBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [r, r, r, r], color);
  }

  // Horizontal rectangle (ground decal) with UVs repeating every `tile` metres.
  flat(x0, z0, x1, z1, y, color, { tileU = 0, tileV = 0, uvRect = null, rotateUV = false } = {}) {
    let uvs;
    if (uvRect) uvs = uvRect;
    else {
      const tu = tileU || (x1 - x0), tv = tileV || (z1 - z0);
      const u0 = x0 / tu, u1 = x1 / tu, w0 = z0 / tv, w1 = z1 / tv;
      uvs = rotateUV ? [[w1, u0], [w1, u1], [w0, u1], [w0, u0]] : [[u0, w1], [u1, w1], [u1, w0], [u0, w0]];
    }
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], uvs, color);
  }

  // Any BufferGeometry, transformed by a matrix and painted one colour (or its own vertex colours).
  mesh(geometry, matrix, color) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = g.attributes.color;
    normalMatrix.getNormalMatrix(matrix);
    if (color !== undefined && color !== null) tmpColor.set(color);
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(tmpV.x, tmpV.y, tmpV.z);
      if (n) { tmpN.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize(); this.nor.push(tmpN.x, tmpN.y, tmpN.z); }
      else this.nor.push(0, 1, 0);
      if (uv) this.uv.push(uv.getX(i), uv.getY(i)); else this.uv.push(0, 0);
      if (c && (color === undefined || color === null)) this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      else this.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const t = new THREE.Vector3();

export function placeMatrix(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  q.setFromEuler(e.set(rx, ry, rz));
  return m4.compose(t.set(x, y, z), q, s.set(sx, sy, sz)).clone();
}

export function batchMesh(batch, material, { castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.Mesh(batch.build(), material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
