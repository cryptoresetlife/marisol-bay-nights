// Keyboard and mouse state: held keys, keys pressed this frame, mouse look deltas and buttons.
export function createInput(canvas) {
  const input = {
    down: new Set(),
    pressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    buttons: [false, false, false],
    clicked: [false, false, false],
    wheel: 0,
    locked: false,
    lastX: null,
    lastY: null,
    enabled: true,
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.down.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.down.delete(e.code));
  window.addEventListener('blur', () => input.down.clear());

  canvas.addEventListener('mousedown', (e) => {
    input.buttons[e.button] = true;
    input.clicked[e.button] = true;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    if (input.enabled && !input.locked && canvas.requestPointerLock) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* headless */ }
    }
  });
  window.addEventListener('mouseup', (e) => { input.buttons[e.button] = false; });
  window.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    } else if (input.buttons[0] || input.buttons[2]) {
      if (input.lastX !== null) {
        input.mouseDX += e.clientX - input.lastX;
        input.mouseDY += e.clientY - input.lastY;
      }
    }
    input.lastX = e.clientX;
    input.lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { input.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });

  return input;
}

export function isKeyDown(input, ...codes) {
  return codes.some((c) => input.down.has(c));
}

export function wasKeyPressed(input, ...codes) {
  return codes.some((c) => input.pressed.has(c));
}

export function endInputFrame(input) {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.clicked[0] = input.clicked[1] = input.clicked[2] = false;
  input.wheel = 0;
}

export function releasePointer() {
  if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
}
