// Neon Bay — keyboard and mouse state. One object owns every key and the
// mouse position/aim, so the game loop never touches DOM events directly.
export function makeInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys hit since the last poll
  const mouse = { x: 640, y: 400, down: false, clicked: false, wx: 0, wy: 0 };
  let scale = 1, offX = 0, offY = 0;

  const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

  function onKeyDown(e) {
    const k = keyName(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  }
  function onKeyUp(e) { keys.delete(keyName(e)); }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  }
  function onMouseDown(e) {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; onMouseMove(e); }
  }
  function onMouseUp(e) { if (e.button === 0) mouse.down = false; }
  function onBlur() { keys.clear(); mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys, mouse,
    down(k) { return keys.has(k); },
    // True once per physical press; consumed at the end of each frame.
    hit(k) { return pressed.has(k); },
    anyHit(...ks) { return ks.some((k) => pressed.has(k)); },
    endFrame() { pressed.clear(); mouse.clicked = false; },
    setView(s, ox, oy) { scale = s; offX = ox; offY = oy; },
    // Mouse position in world coordinates, given the camera.
    aimWorld(camX, camY) {
      return { x: camX + (mouse.x - offX) / scale, y: camY + (mouse.y - offY) / scale };
    },
  };
}
