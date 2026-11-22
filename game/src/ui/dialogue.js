// Subtitled dialogue: queued lines with the speaker's name in their colour, timed by length, and a callback
// when the exchange ends. Radio DJ chatter uses the same box between story lines.
export const SPEAKERS = {
  Dez: '#ffb36b', Lupe: '#ff7ac8', Vance: '#ffd86b', Marco: '#7df9ff', Rook: '#ff6b6b', Dispatch: '#7cc4ff',
  Nina: '#b48bff', Cabbie: '#ffe14d', DJ: '#7dffb0', Guard: '#cccccc', Racer: '#c77dff',
};

export function createDialogue() {
  return { queue: [], current: null, t: 0, onDone: null, priority: 0 };
}

// lines: [{ who, text }] or [who, text] pairs.
export function playDialogue(game, lines, onDone = null, priority = 1) {
  const d = game.dialogue;
  if (d.current && priority < d.priority) return;
  d.queue = lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1] } : l));
  d.onDone = onDone;
  d.priority = priority;
  nextLine(game);
}

function nextLine(game) {
  const d = game.dialogue;
  d.current = d.queue.shift() || null;
  const el = game.hud.$('hudSubtitle');
  if (!d.current) {
    el.style.display = 'none';
    d.priority = 0;
    const cb = d.onDone;
    d.onDone = null;
    if (cb) cb();
    return;
  }
  d.t = d.current.dur || Math.min(6.5, 1.8 + d.current.text.length * 0.055);
  const color = SPEAKERS[d.current.who] || '#ffffff';
  el.innerHTML = '';
  if (d.current.who) {
    const b = document.createElement('b');
    b.style.color = color;
    b.textContent = d.current.who + ': ';
    el.appendChild(b);
  }
  el.appendChild(document.createTextNode(d.current.text));
  el.style.display = 'block';
}

export function updateDialogue(game, dt) {
  const d = game.dialogue;
  if (!d.current) return;
  d.t -= dt;
  if (d.t <= 0) nextLine(game);
}

export function skipDialogueLine(game) {
  if (game.dialogue.current) game.dialogue.t = 0;
}

export function dialogueActive(game) {
  return !!game.dialogue.current;
}
