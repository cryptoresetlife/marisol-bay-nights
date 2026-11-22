// World markers: tall light beams, pulsing ground rings and spinning chevrons that show where a mission
// starts, where to go next, race checkpoints and collectibles.
import * as THREE from 'three';
import { makeBeamTexture } from '../world/textures.js';
import { groundHeight } from '../world/terrain.js';

const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
ringGeo.rotateX(-Math.PI / 2);
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
beamGeo.translate(0, 0.5, 0);
const chevronGeo = new THREE.ConeGeometry(0.7, 1.2, 4);
chevronGeo.rotateX(Math.PI);

export function createMarker(game, x, z, { color = '#ffd23f', radius = 2.4, height = 60, chevron = true } = {}) {
  const group = new THREE.Group();
  const y = groundHeight(x, z) + 0.05;
  group.position.set(x, y, z);
  const beamMat = new THREE.MeshBasicMaterial({ map: makeBeamTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.scale.set(radius * 0.7, height, radius * 0.7);
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.scale.setScalar(radius);
  group.add(ring);
  let chev = null;
  if (chevron) {
    chev = new THREE.Mesh(chevronGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    chev.position.y = 3.2;
    group.add(chev);
  }
  game.engine.scene.add(group);
  const marker = { group, ring, chev, beam, x, z, radius, phase: Math.random() * 6 };
  game.markers.push(marker);
  return marker;
}

export function removeMarker(game, marker) {
  if (!marker) return;
  game.engine.scene.remove(marker.group);
  const i = game.markers.indexOf(marker);
  if (i >= 0) game.markers.splice(i, 1);
}

export function moveMarker(marker, x, z) {
  marker.x = x; marker.z = z;
  marker.group.position.set(x, groundHeight(x, z) + 0.05, z);
}

export function updateMarkers(game, dt) {
  for (const m of game.markers) {
    m.phase += dt;
    const s = 1 + Math.sin(m.phase * 3) * 0.08;
    m.ring.scale.setScalar(m.radius * s);
    if (m.chev) { m.chev.rotation.y += dt * 2; m.chev.position.y = 3.2 + Math.sin(m.phase * 2.5) * 0.3; }
  }
}
