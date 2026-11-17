// Neon Bay — all sound is synthesized with WebAudio: no audio files.
// A small step sequencer plays a moody synthwave loop, and one-shot
// helpers cover gunshots, punches, pickups, sirens and the engine hum.
export function makeAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;
  let started = false;

  // A-minor synthwave: bass roots and a sparse lead, 8 steps a bar.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const LEAD = [220, 0, 261.63, 0, 329.63, 0, 246.94, 293.66];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
    } catch { ctx = null; return false; }
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  function playStep() {
    if (!ctx || muted) return;
    const i = step % 8;
    const bass = BASS[i];
    if (bass) tone(bass, 0.32, 'triangle', 0.5);
    const lead = LEAD[i];
    if (lead) tone(lead, 0.22, 'square', 0.10);
    if (step % 16 === 8) tone(440, 0.5, 'sine', 0.06, 0, 220);
    step++;
  }

  return {
    get muted() { return muted; },
    // Call from a user gesture; browsers block audio before one.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!started) {
        started = true;
        musicTimer = setInterval(playStep, 240);
      }
    },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
    },
    gunshot() { noiseBurst(0.14, 0.5, 2400); tone(180, 0.08, 'square', 0.25, 0, 60); },
    enemyShot() { noiseBurst(0.1, 0.22, 1600); },
    punch() { noiseBurst(0.08, 0.35, 900); tone(120, 0.07, 'sine', 0.3, 0, 70); },
    reload() { tone(500, 0.06, 'square', 0.15); tone(700, 0.06, 'square', 0.15, 0.09); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, 0.08); },
    cash() { tone(880, 0.1, 'sine', 0.25); tone(1174, 0.1, 'sine', 0.25, 0.09); tone(1568, 0.18, 'sine', 0.25, 0.18); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, i * 0.09)); },
    busted() { [392, 370, 349, 311].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.15, i * 0.16)); },
    door() { tone(300, 0.08, 'square', 0.15, 0, 180); },
    crash() { noiseBurst(0.2, 0.4, 700); },
    setEngine(speed01, on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.05 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, t, 0.1);
    },
    setSiren(on, t) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.035 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(Math.sin(t * 4) > 0 ? 750 : 950, ctx.currentTime, 0.05);
    },
    stop() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; started = false; },
  };
}
