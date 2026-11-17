// Synthesised sound only: every effect and the music loop are built with the
// Web Audio API. No audio files, no network, nothing loaded from anywhere.
class SoundEngine {
  constructor() {
    this.ctx = null; this.muted = false; this.musicOn = true;
    this._engineOsc = null; this._engineGain = null;
    this._sirenOsc = null; this._sirenGain = null; this._sirenStep = 0;
    this._musicStep = 0; this._musicTimer = null;
  }
  ensure() {
    if (this.muted) return;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) { /* audio unavailable: the game stays silent, never crashes */ }
  }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
      src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(t);
    } catch (e) { /* ignore */ }
  }
  shot() { this.noise(0.14, 0.3, 2400); this.tone(160, 0.09, 'square', 0.12, 55); }
  punch() { this.noise(0.08, 0.2, 700); }
  crash() { this.noise(0.25, 0.35, 500); this.tone(90, 0.2, 'sawtooth', 0.12, 40); }
  pickup() { this.tone(660, 0.09, 'sine', 0.12); setTimeout(() => this.tone(990, 0.12, 'sine', 0.12), 70); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.14), i * 90)); }
  busted() { this.tone(220, 0.5, 'sawtooth', 0.14, 110); }
  click() { this.tone(880, 0.04, 'square', 0.06); }
  setEngine(speed01) {
    if (!this.ctx || this.muted) return;
    try {
      if (!this._engineOsc) {
        this._engineOsc = this.ctx.createOscillator();
        this._engineGain = this.ctx.createGain();
        this._engineOsc.type = 'sawtooth';
        this._engineOsc.frequency.value = 60;
        this._engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        this._engineOsc.connect(f); f.connect(this._engineGain); this._engineGain.connect(this.ctx.destination);
        this._engineOsc.start();
      }
      this._engineOsc.frequency.value = 55 + speed01 * 160;
      this._engineGain.gain.value = speed01 > 0.02 ? 0.035 + speed01 * 0.03 : 0;
    } catch (e) { /* ignore */ }
  }
  setSiren(on) {
    if (!this.ctx || this.muted) { if (this._sirenGain) this._sirenGain.gain.value = 0; return; }
    try {
      if (!this._sirenOsc) {
        this._sirenOsc = this.ctx.createOscillator();
        this._sirenGain = this.ctx.createGain();
        this._sirenOsc.type = 'triangle'; this._sirenOsc.frequency.value = 700;
        this._sirenGain.gain.value = 0;
        this._sirenOsc.connect(this._sirenGain); this._sirenGain.connect(this.ctx.destination);
        this._sirenOsc.start();
      }
      this._sirenStep += 1;
      if (on) {
        this._sirenOsc.frequency.value = this._sirenStep % 2 ? 720 : 960;
        this._sirenGain.gain.value = 0.028;
      } else this._sirenGain.gain.value = 0;
    } catch (e) { /* ignore */ }
  }
  startMusic() {
    if (this._musicTimer || !this.musicOn) return;
    // Neon-night bassline: 112 BPM, 8th-note steps, A minor groove.
    const bass = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4, 55, 0, 55, 65.4, 98, 82.4, 73.4, 65.4];
    const lead = [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 220, 0, 0, 392, 0, 329.6, 0, 0];
    this._musicTimer = setInterval(() => {
      if (this.muted || !this.musicOn || !this.ctx) return;
      const i = this._musicStep % 16;
      if (bass[i]) this.tone(bass[i], 0.22, 'triangle', 0.09);
      if (lead[i] && this._musicStep % 32 >= 16) this.tone(lead[i], 0.18, 'sine', 0.05);
      if (this._musicStep % 2 === 0) this.noise(0.03, 0.03, 6000);
      this._musicStep += 1;
    }, 268);
  }
  toggleMute() { this.muted = !this.muted; if (this.muted && this._engineGain) this._engineGain.gain.value = 0; return this.muted; }
}

export const sound = new SoundEngine();
