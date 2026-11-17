// Particles, floating score text and screen shake — the juice layer.
export class Effects {
  constructor() { this.particles = []; this.texts = []; this.shake = 0; }
  burst(x, y, color, count, speed) {
    for (let i = 0; i < (count || 10); i++) {
      const a = Math.random() * Math.PI * 2, s = (speed || 120) * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3 });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }
  smoke(x, y) { this.burst(x, y, '#888888', 3, 40); }
  blood(x, y) { this.burst(x, y, '#c0392b', 8, 90); }
  muzzle(x, y, angle) {
    this.particles.push({ x: x + Math.cos(angle) * 16, y: y + Math.sin(angle) * 16, vx: Math.cos(angle) * 260, vy: Math.sin(angle) * 260, life: 0.09, max: 0.09, color: '#ffd94d', size: 4 });
  }
  addText(x, y, text, color) { this.texts.push({ x, y, text, color: color || '#fff', life: 1.4 }); }
  addShake(amount) { this.shake = Math.min(18, this.shake + amount); }
  update(dt) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 24 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }
  offset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * this.shake, y: (Math.random() - 0.5) * this.shake };
  }
}
