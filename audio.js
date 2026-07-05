// ============================================================
// audio.js — procedural sound effects via WebAudio (no assets)
// ============================================================
const AudioSys = (() => {
  let ctx = null, master = null, noiseBuf = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function noise(peak, decay, opts = {}) {
    if (!ctx) return;
    const { freq = 1200, type = 'lowpass', q = 0.8, attack = 0.002, delay = 0 } = opts;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + attack + decay + 0.05);
  }

  function tone(freq, peak, decay, opts = {}) {
    if (!ctx) return;
    const { type = 'square', slideTo = 0, attack = 0.002, delay = 0 } = opts;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }

  return {
    ensure,
    shoot(kind) {
      if (kind === 'rifle') {
        noise(0.5, 0.09, { freq: 2400 });
        tone(150, 0.35, 0.07, { type: 'sawtooth', slideTo: 60 });
      } else if (kind === 'pistol') {
        noise(0.45, 0.11, { freq: 1900 });
        tone(230, 0.3, 0.09, { type: 'square', slideTo: 70 });
      } else { // shotgun + pump clack
        noise(0.75, 0.25, { freq: 850, q: 0.5 });
        tone(95, 0.5, 0.22, { type: 'sawtooth', slideTo: 40 });
        noise(0.18, 0.05, { freq: 2600, type: 'highpass', delay: 0.42 });
        noise(0.15, 0.05, { freq: 2200, type: 'highpass', delay: 0.55 });
      }
    },
    dry() { tone(1600, 0.15, 0.03); },
    reload(stage) {
      if (stage === 0) { noise(0.2, 0.05, { freq: 3000, type: 'highpass' }); tone(700, 0.12, 0.04); }
      else { noise(0.25, 0.06, { freq: 2500, type: 'highpass' }); tone(1000, 0.15, 0.05); }
    },
    switchW() { noise(0.15, 0.06, { freq: 2000 }); tone(500, 0.1, 0.05); },
    hit(head) {
      if (head) tone(1300, 0.35, 0.08, { type: 'triangle', slideTo: 500 });
      else tone(900, 0.22, 0.05, { type: 'triangle' });
    },
    kill() { tone(600, 0.3, 0.15, { type: 'sawtooth', slideTo: 100 }); noise(0.35, 0.2, { freq: 700 }); },
    hurt() { tone(200, 0.4, 0.2, { type: 'sawtooth', slideTo: 60 }); noise(0.25, 0.15, { freq: 500 }); },
    melee() { noise(0.4, 0.12, { freq: 600 }); tone(120, 0.35, 0.12, { type: 'sawtooth', slideTo: 50 }); },
    step() { noise(0.07, 0.05, { freq: 500 + Math.random() * 200 }); },
    jump() { noise(0.1, 0.08, { freq: 800 }); },
    land() { noise(0.18, 0.09, { freq: 400 }); },
    pickup(kind) {
      if (kind === 'health') { tone(500, 0.25, 0.08, { type: 'sine' }); tone(750, 0.25, 0.1, { type: 'sine', delay: 0.07 }); }
      else { tone(400, 0.22, 0.06); tone(600, 0.22, 0.08, { delay: 0.06 }); }
    },
    wave() { tone(220, 0.3, 0.3, { type: 'sawtooth' }); tone(330, 0.3, 0.35, { type: 'sawtooth', delay: 0.15 }); },
    cleared() {
      tone(440, 0.25, 0.15, { type: 'sine' });
      tone(550, 0.25, 0.15, { type: 'sine', delay: 0.12 });
      tone(660, 0.3, 0.25, { type: 'sine', delay: 0.24 });
    },
    enemyShoot() { tone(950, 0.2, 0.12, { type: 'square', slideTo: 250 }); },
  };
})();
