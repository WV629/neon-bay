// Neon Bay — particles, tracers, muzzle flashes, floating score text and
// screen shake. Purely cosmetic: the game never reads these back.
export function makeEffects() {
  const particles = [];
  const tracers = [];
  const floats = [];
  let shake = 0;

  return {
    addShake(amount) { shake = Math.min(14, shake + amount); },
    burst(x, y, color, n = 10, speed = 120, life = 0.5, size = 3) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: size * (0.6 + Math.random() * 0.8) });
      }
    },
    blood(x, y) { this.burst(x, y, '#c0392b', 12, 90, 0.6, 3); },
    sparks(x, y) { this.burst(x, y, '#facc15', 8, 160, 0.35, 2); },
    smoke(x, y) { this.burst(x, y, '#94a3b8', 3, 30, 1.1, 6); },
    muzzle(x, y, angle) {
      tracers.push({ x1: x, y1: y, x2: x + Math.cos(angle) * 26, y2: y + Math.sin(angle) * 26, life: 0.06, max: 0.06, color: '#fde68a', width: 4 });
      this.burst(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, '#fbbf24', 4, 60, 0.12, 2);
    },
    tracer(x1, y1, x2, y2) {
      tracers.push({ x1, y1, x2, y2, life: 0.09, max: 0.09, color: '#fef08a', width: 2 });
    },
    floatText(x, y, text, color = '#facc15') {
      floats.push({ x, y, text, color, life: 1.4, max: 1.4 });
    },
    update(dt) {
      shake = Math.max(0, shake - dt * 26);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) tracers.splice(i, 1);
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.life -= dt; f.y -= 34 * dt;
        if (f.life <= 0) floats.splice(i, 1);
      }
    },
    offset() {
      if (shake <= 0.2) return { x: 0, y: 0 };
      return { x: (Math.random() - 0.5) * shake, y: (Math.random() - 0.5) * shake };
    },
    draw(ctx) {
      for (const t of tracers) {
        ctx.globalAlpha = Math.max(0, t.life / t.max);
        ctx.strokeStyle = t.color; ctx.lineWidth = t.width;
        ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px system-ui, sans-serif';
      for (const f of floats) {
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
