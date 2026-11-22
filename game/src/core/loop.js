// The frame loop: a requestAnimationFrame driver with a clamped time step and a frame counter.
export function startLoop(update) {
  const loop = { running: true, frame: 0, elapsed: 0, fps: 60 };
  let last = performance.now();
  const tick = (now) => {
    if (!loop.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    loop.elapsed += dt;
    loop.frame += 1;
    loop.fps = loop.fps * 0.95 + (1 / dt) * 0.05;
    update(dt, loop);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return loop;
}

export function stopLoop(loop) {
  loop.running = false;
}
