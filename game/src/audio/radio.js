// The car radio: three original stations sequenced live with WebAudio synths (synthwave on KBAY 99.1,
// salsa on Coral 104.5, lo-fi on Wave 88.3), DJ chatter as subtitles, and R to change station.
import { playDialogue } from '../ui/dialogue.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const STATIONS = [
  {
    name: 'KBAY 99.1 · Sunset FM', bpm: 104, style: 'synth',
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    dj: [
      "You're locked to KBAY 99.1, Sunset FM. The sound of Marisol Bay after dark.",
      'Traffic update: Tidewater Drive is jammed again. Take Pelican Ave, or take your chances.',
      'This one goes out to everybody stuck on Sunrise Blvd. Breathe, baby. Just breathe.',
      'Weather is hot, the bay is glassy and the night is young. Stay golden, Marisol.',
    ],
  },
  {
    name: 'Coral 104.5 · Salsa Caliente', bpm: 190, style: 'salsa',
    chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [65, 69, 72]],
    dj: [
      'Coral one-oh-four-point-five! Salsa Caliente, from the Pier all the way up to Palm Heights.',
      'Dance first, pay your parking tickets later. That is the Coral way.',
      'Shout-out to Tiki Taco on the Strip. Lupe, save me a fish taco!',
    ],
  },
  {
    name: 'Wave 88.3 · Lo-Fi Lagoon', bpm: 78, style: 'lofi',
    chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]],
    dj: [
      "Wave 88.3, Lo-Fi Lagoon. Slow down. The ocean isn't going anywhere.",
      'Warm night, windows down, coffee in the cupholder. You know the vibe.',
      'Somebody tell Sterling Vance the beach is not for sale.',
    ],
  },
  { name: 'Radio Off', style: 'off' },
];

export function createRadio() {
  return { station: 0, playing: false, step: 0, nextTime: 0, timer: null, djTimer: 25, crackle: null };
}

export function radioLabel(radio) {
  return STATIONS[radio.station].style === 'off' ? 'Radio off' : '♪ ' + STATIONS[radio.station].name;
}

export function changeStation(game, dir = 1) {
  const r = game.radio;
  r.station = (r.station + dir + STATIONS.length) % STATIONS.length;
  r.step = 0;
  r.djTimer = 6;
  game.events.emit('radioChanged', { name: STATIONS[r.station].name });
}

export function updateRadio(game, dt) {
  const r = game.radio;
  const audio = game.audio;
  const want = !!game.player.vehicle && game.mode === 'play' && STATIONS[r.station].style !== 'off' && audio.ctx;
  if (want && !r.playing) {
    r.playing = true;
    r.nextTime = audio.ctx.currentTime + 0.05;
    r.timer = setInterval(() => schedule(game), 25);
  } else if (!want && r.playing) {
    r.playing = false;
    clearInterval(r.timer);
  }
  if (r.playing) {
    r.djTimer -= dt;
    if (r.djTimer <= 0) {
      r.djTimer = 40 + Math.random() * 25;
      const st = STATIONS[r.station];
      if (!game.dialogue.current) playDialogue(game, [['DJ', st.dj[Math.floor(Math.random() * st.dj.length)]]], null, 0);
    }
  }
}

function schedule(game) {
  const r = game.radio;
  const audio = game.audio;
  const st = STATIONS[r.station];
  if (!audio.ctx || st.style === 'off') return;
  const stepDur = 60 / st.bpm / 4;
  while (r.nextTime < audio.ctx.currentTime + 0.12) {
    playStep(audio, st, r.step, r.nextTime, stepDur);
    r.nextTime += stepDur * (st.style === 'lofi' && r.step % 2 === 0 ? 1.18 : st.style === 'lofi' ? 0.82 : 1);
    r.step = (r.step + 1) % 64;
  }
}

function tone(audio, type, freq, t, dur, vol, cutoff = 4000, attack = 0.005, pitchDrop = 0) {
  const ctx = audio.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (pitchDrop) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * pitchDrop), t + dur);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(audio.music);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseHit(audio, t, dur, vol, type, freq) {
  const ctx = audio.ctx;
  const s = ctx.createBufferSource(); s.buffer = audio.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(audio.music);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
}

const kick = (a, t) => tone(a, 'sine', 150, t, 0.28, 0.9, 800, 0.002, 0.3);
const snare = (a, t) => { noiseHit(a, t, 0.16, 0.35, 'bandpass', 1900); tone(a, 'triangle', 210, t, 0.1, 0.25); };
const hat = (a, t, open = false) => noiseHit(a, t, open ? 0.14 : 0.04, 0.12, 'highpass', 7500);

function playStep(audio, st, step, t, sd) {
  const bar = Math.floor(step / 16) % 4;
  const s = step % 16;
  const chord = st.chords[bar];
  if (st.style === 'synth') {
    if (s % 4 === 0) kick(audio, t);
    if (s % 8 === 4) snare(audio, t);
    if (s % 2 === 1) hat(audio, t, s === 15);
    if (s % 2 === 0) tone(audio, 'sawtooth', midi(chord[0] - 24 + (s % 8 === 6 ? 12 : 0)), t, sd * 1.8, 0.22, 700);
    const arp = chord[(s * 2 + (s >> 2)) % chord.length] + 12;
    tone(audio, 'square', midi(arp), t, sd * 0.9, 0.06, 2400);
    if (s === 0) for (const n of chord) tone(audio, 'sawtooth', midi(n), t, sd * 15, 0.05, 1100, 0.4);
    if (bar === 3 && s >= 12) tone(audio, 'triangle', midi(chord[2] + 24 - (15 - s)), t, sd, 0.05, 3000);
  } else if (st.style === 'salsa') {
    const clave = [0, 3, 6, 10, 12];
    if (clave.includes((step % 32) >> 1) && step % 2 === 0) tone(audio, 'sine', 2500, t, 0.05, 0.12, 6000);
    if (s % 4 === 0) tone(audio, 'square', 560, t, 0.09, 0.05, 3000);
    if ([2, 3, 6, 7, 10, 14, 15].includes(s)) tone(audio, 'sine', s % 4 === 3 ? 320 : 210, t, 0.14, 0.18, 1500, 0.002, 0.7);
    if (s === 6 || s === 12) tone(audio, 'triangle', midi(chord[0] - 24 + (s === 12 ? 7 : 0)), t, sd * 5, 0.32, 900);
    if ([0, 3, 4, 6, 8, 11, 12, 14].includes(s)) for (const n of chord) tone(audio, 'triangle', midi(n + 12), t, sd * 1.4, 0.05, 3500);
    if (s === 0 && bar % 2 === 0) for (const n of chord) tone(audio, 'sawtooth', midi(n), t, sd * 12, 0.025, 1500, 0.05);
  } else if (st.style === 'lofi') {
    if (s === 0 || s === 7 || s === 10) kick(audio, t);
    if (s === 4 || s === 12) { noiseHit(audio, t, 0.2, 0.2, 'bandpass', 1500); }
    if (s % 2 === 0) hat(audio, t);
    if (s === 0 || s === 8) for (const n of chord) tone(audio, 'sine', midi(n), t, sd * 7, 0.1, 1800, 0.02);
    if (s % 4 === 0) tone(audio, 'sine', midi(chord[0] - 24), t, sd * 3.5, 0.3, 500);
    if ([3, 6, 11, 14].includes(s)) tone(audio, 'triangle', midi(chord[(s + bar) % chord.length] + 12), t, sd * 2, 0.05, 2000);
    noiseHit(audio, t, 0.02, 0.025, 'highpass', 3000);
  }
}
