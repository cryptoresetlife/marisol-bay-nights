// Synthesised sound effects with WebAudio: gunshots per weapon, explosions, crashes, footsteps, horns,
// screams, UI clicks, police sirens that wail louder as cruisers close in, and a soft city ambience.
export function createAudio() {
  return { ctx: null, master: null, sfx: null, music: null, noise: null, siren: null, ambience: null, unlocked: false };
}

export function unlockAudio(audio, settings) {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  audio.master.connect(comp).connect(ctx.destination);
  audio.sfx = ctx.createGain(); audio.sfx.connect(audio.master);
  audio.music = ctx.createGain(); audio.music.connect(audio.master);
  const len = ctx.sampleRate * 2;
  audio.noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = audio.noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  audio.unlocked = true;
  applyVolumes(audio, settings);
  startAmbience(audio);
}

export function applyVolumes(audio, settings) {
  if (!audio.ctx) return;
  audio.master.gain.value = settings.volume;
  audio.music.gain.value = settings.music * 0.55;
}

function noiseSource(audio, duration) {
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.noise;
  src.loop = duration > 1.9;
  src.start(audio.ctx.currentTime, Math.random() * 1.5);
  src.stop(audio.ctx.currentTime + duration + 0.05);
  return src;
}

function env(audio, gainValue, attack, decay) {
  const g = audio.ctx.createGain();
  const t = audio.ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

const falloff = (d) => 1 / (1 + Math.max(0, d) / 14);

const GUN_SOUND = {
  pistol: { cut: 2600, decay: 0.16, gain: 0.7, thump: 140 },
  smg: { cut: 3400, decay: 0.09, gain: 0.5, thump: 180 },
  shotgun: { cut: 1500, decay: 0.38, gain: 1.0, thump: 90 },
  rifle: { cut: 3000, decay: 0.2, gain: 0.8, thump: 120 },
};

export function playGunshot(audio, weapon, dist = 0) {
  if (!audio.ctx) return;
  const s = GUN_SOUND[weapon] || GUN_SOUND.pistol;
  const vol = s.gain * falloff(dist);
  if (vol < 0.02) return;
  const src = noiseSource(audio, s.decay + 0.1);
  const f = audio.ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = s.cut * (dist > 40 ? 0.5 : 1);
  const g = env(audio, vol, 0.002, s.decay);
  src.connect(f).connect(g).connect(audio.sfx);
  const o = audio.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(s.thump, audio.ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, audio.ctx.currentTime + 0.12);
  const og = env(audio, vol * 0.8, 0.002, 0.12);
  o.connect(og).connect(audio.sfx);
  o.start(); o.stop(audio.ctx.currentTime + 0.2);
}

export function playExplosion(audio, dist = 0) {
  if (!audio.ctx) return;
  const vol = 1.3 * falloff(dist * 0.5);
  const src = noiseSource(audio, 2);
  const f = audio.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1800, audio.ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(120, audio.ctx.currentTime + 1.6);
  const g = env(audio, vol, 0.01, 1.8);
  src.connect(f).connect(g).connect(audio.sfx);
  const o = audio.ctx.createOscillator();
  o.frequency.setValueAtTime(70, audio.ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(28, audio.ctx.currentTime + 1);
  const og = env(audio, vol, 0.01, 1.1);
  o.connect(og).connect(audio.sfx);
  o.start(); o.stop(audio.ctx.currentTime + 1.2);
}

export function playImpact(audio, strength = 1, dist = 0) {
  if (!audio.ctx) return;
  const vol = Math.min(1, 0.15 + strength * 0.05) * falloff(dist);
  if (vol < 0.03) return;
  const src = noiseSource(audio, 0.4);
  const f = audio.ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900;
  src.connect(f).connect(env(audio, vol, 0.003, 0.3)).connect(audio.sfx);
  const o = audio.ctx.createOscillator();
  o.type = 'square'; o.frequency.value = 180 + Math.random() * 160;
  const bp = audio.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 6;
  o.connect(bp).connect(env(audio, vol * 0.25, 0.002, 0.25)).connect(audio.sfx);
  o.start(); o.stop(audio.ctx.currentTime + 0.3);
}

export function playFootstep(audio, run) {
  if (!audio.ctx) return;
  const src = noiseSource(audio, 0.08);
  const f = audio.ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 300; f.Q.value = 1.5;
  src.connect(f).connect(env(audio, run ? 0.16 : 0.09, 0.003, 0.06)).connect(audio.sfx);
}

export function playHorn(audio, dist = 0) {
  if (!audio.ctx) return;
  const vol = 0.18 * falloff(dist);
  if (vol < 0.02) return;
  for (const fr of [392, 494]) {
    const o = audio.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = fr;
    const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1500;
    const g = audio.ctx.createGain();
    const t = audio.ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + 0.4); g.gain.linearRampToValueAtTime(0, t + 0.45);
    o.connect(f).connect(g).connect(audio.sfx);
    o.start(t); o.stop(t + 0.5);
  }
}

export function playScream(audio, dist = 0) {
  if (!audio.ctx) return;
  const vol = 0.12 * falloff(dist);
  if (vol < 0.02) return;
  const o = audio.ctx.createOscillator();
  o.type = 'sawtooth';
  const t = audio.ctx.currentTime;
  const base = 500 + Math.random() * 300;
  o.frequency.setValueAtTime(base, t);
  o.frequency.linearRampToValueAtTime(base * 1.5, t + 0.15);
  o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.6);
  const f = audio.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
  o.connect(f).connect(env(audio, vol, 0.03, 0.6)).connect(audio.sfx);
  o.start(t); o.stop(t + 0.7);
}

export function playUi(audio, kind = 'click') {
  if (!audio.ctx) return;
  const o = audio.ctx.createOscillator();
  o.type = kind === 'deny' ? 'square' : 'triangle';
  const t = audio.ctx.currentTime;
  const tones = { click: [880, 1320], move: [660, 660], buy: [880, 1760], deny: [220, 160], mission: [523, 1046], cash: [1318, 1760], fail: [300, 150], checkpoint: [988, 1480] };
  const [a, b] = tones[kind] || tones.click;
  o.frequency.setValueAtTime(a, t);
  o.frequency.setValueAtTime(b, t + 0.07);
  o.connect(env(audio, kind === 'move' ? 0.05 : 0.14, 0.005, kind === 'mission' || kind === 'fail' ? 0.5 : 0.15)).connect(audio.sfx);
  o.start(t); o.stop(t + 0.6);
}

// Jingle for chapter complete: a rising arpeggio.
export function playFanfare(audio, success = true) {
  if (!audio.ctx) return;
  const notes = success ? [523, 659, 784, 1046, 1318] : [392, 330, 262, 196];
  notes.forEach((fr, i) => {
    const o = audio.ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = fr;
    const g = audio.ctx.createGain();
    const t = audio.ctx.currentTime + i * 0.11;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(audio.sfx);
    o.start(t); o.stop(t + 0.55);
  });
}

function startAmbience(audio) {
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.noise; src.loop = true;
  const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
  const g = audio.ctx.createGain(); g.gain.value = 0.035;
  src.connect(f).connect(g).connect(audio.sfx);
  src.start();
  audio.ambience = g;
}

// One siren voice whose loudness follows the nearest pursuing cruiser.
export function updateSirens(audio, nearestDist, level, time) {
  if (!audio.ctx) return;
  if (!audio.siren) {
    const o = audio.ctx.createOscillator(); o.type = 'sawtooth';
    const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    const g = audio.ctx.createGain(); g.gain.value = 0;
    o.connect(f).connect(g).connect(audio.sfx);
    o.start();
    audio.siren = { o, g };
  }
  const active = nearestDist < 160;
  const vol = active ? 0.07 * falloff(nearestDist * 0.6) * 2.2 : 0;
  const rate = level >= 3 ? 2.6 : 0.45;
  const wave = (Math.sin(time * Math.PI * 2 * rate) + 1) / 2;
  const t = audio.ctx.currentTime;
  audio.siren.o.frequency.setTargetAtTime(650 + wave * 750, t, 0.03);
  audio.siren.g.gain.setTargetAtTime(vol, t, 0.2);
}

export function installSoundEvents(game) {
  const a = game.audio;
  const ev = game.events;
  const camDist = (x, z) => Math.hypot(game.engine.camera.position.x - x, game.engine.camera.position.z - z);
  ev.on('gunfire', ({ weapon, x, z }) => playGunshot(a, weapon, camDist(x, z)));
  ev.on('explosion', ({ dist }) => playExplosion(a, dist));
  ev.on('vehicleImpact', ({ impact, x, z }) => playImpact(a, impact, camDist(x, z)));
  ev.on('footstep', ({ run }) => playFootstep(a, run));
  ev.on('horn', ({ vehicle }) => playHorn(a, camDist(vehicle.pos.x, vehicle.pos.z)));
  ev.on('scream', ({ x, z }) => playScream(a, camDist(x, z)));
  ev.on('punch', () => playImpact(a, 2, 0));
  ev.on('uiClick', () => playUi(a, 'click'));
  ev.on('uiMove', () => playUi(a, 'move'));
  ev.on('uiBuy', () => playUi(a, 'buy'));
  ev.on('uiDeny', () => playUi(a, 'deny'));
  ev.on('checkpoint', () => playUi(a, 'checkpoint'));
  ev.on('money', ({ amount }) => { if (amount > 0) playUi(a, 'cash'); });
  ev.on('dryFire', () => playUi(a, 'deny'));
  ev.on('reload', () => playUi(a, 'move'));
}
