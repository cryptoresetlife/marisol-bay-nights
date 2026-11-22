// The engine note of the car Dez is driving: two detuned oscillators through a filter, pitched by a
// simulated rev counter that climbs through the gears, plus tyre squeal when the car slides.
import { vehicleSpeed } from '../vehicles/vehicle.js';

export function createEngineSound() {
  return { nodes: null, rpm: 0, gear: 1 };
}

function build(audio) {
  const ctx = audio.ctx;
  const a = ctx.createOscillator(); a.type = 'sawtooth';
  const b = ctx.createOscillator(); b.type = 'square';
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
  const g = ctx.createGain(); g.gain.value = 0;
  a.connect(f); b.connect(f); f.connect(g).connect(audio.sfx);
  a.start(); b.start();
  const sq = ctx.createBufferSource(); sq.buffer = audio.noise; sq.loop = true;
  const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2400; sf.Q.value = 8;
  const sg = ctx.createGain(); sg.gain.value = 0;
  sq.connect(sf).connect(sg).connect(audio.sfx);
  sq.start();
  return { a, b, f, g, sg };
}

export function updateEngineSound(game, es, dt) {
  const audio = game.audio;
  const v = game.player.vehicle;
  if (!audio.ctx) return 0;
  if (!es.nodes) es.nodes = build(audio);
  const n = es.nodes;
  const t = audio.ctx.currentTime;
  if (!v || v.destroyed || game.mode !== 'play') {
    n.g.gain.setTargetAtTime(0, t, 0.1);
    n.sg.gain.setTargetAtTime(0, t, 0.05);
    es.rpm = 0;
    return 0;
  }
  // fake gearbox: rpm sweeps up within each gear band
  const ratio = Math.min(1, vehicleSpeed(v) / v.type.maxSpeed);
  const gears = 5;
  const gear = Math.min(gears, 1 + Math.floor(ratio * gears));
  const inGear = ratio * gears - (gear - 1);
  const target = 0.18 + inGear * 0.72 + Math.abs(v.controls.throttle) * 0.1;
  es.rpm += (target - es.rpm) * Math.min(1, dt * 8);
  const base = (v.type.mass > 1.8 ? 32 : 46) + es.rpm * 120;
  n.a.frequency.setTargetAtTime(base, t, 0.04);
  n.b.frequency.setTargetAtTime(base * 0.5 + 1.5, t, 0.04);
  n.f.frequency.setTargetAtTime(300 + es.rpm * 1400 + Math.abs(v.controls.throttle) * 500, t, 0.05);
  n.g.gain.setTargetAtTime(0.05 + Math.abs(v.controls.throttle) * 0.05, t, 0.08);
  const slip = Math.min(1, Math.max(0, (v.slip || 0) - 3) / 8);
  n.sg.gain.setTargetAtTime(slip * 0.12, t, 0.05);
  return es.rpm;
}
