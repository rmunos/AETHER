/**
 * AETHER // Modules 02-04
 *  02 Edge-of-chaos melody (logistic map + Hénon attractor, anti-repetition motif memory, events placed in 3-D)
 *  03 Binaural beat & θ–γ shimmer (every partial pair beats at the same rate; breath-coupled swell)
 *  04 Shepard–Risset horizon (8 voices exactly one octave apart, raised-cosine spectral envelope)
 */
(function (global) {
  'use strict';
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const TAU = Math.PI * 2;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = (f) => {
    const m = Math.round(69 + 12 * Math.log2(f / 440));
    return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  };

  // ==========================================================================================
  // 02 — Edge of chaos
  // ==========================================================================================
  const SCALES = {
    pentatonic: [0, 2, 4, 7, 9],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 4, 5, 7, 8, 10],
    chromatic12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };
  const ARCHETYPES = ['metallic', 'liquid', 'plucked', 'subglitch', 'breath'];

  class ChaosModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.p = engine.params.chaos;
      const ctx = this.ctx;
      this.bus = ctx.createGain(); // stereo (non-3-D) path
      this.bus.gain.value = 0;
      this.bus.connect(engine.dryBus);
      this.bus.connect(engine.reverbSendGain);
      this.hallSend = ctx.createGain(); // 3-D path also feeds the hall a little
      this.hallSend.gain.value = 0.35;
      this.hallSend.connect(engine.reverbSendGain);
      this.slots = [6, 7, 8];
      this.slotIdx = 0;
      this.slotGain = this.slots.map((s) => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(engine.renderer.input(s));
        g.connect(this.hallSend);
        return g;
      });
      const len = Math.floor(ctx.sampleRate * 0.15);
      this.burst = ctx.createBuffer(1, len, ctx.sampleRate);
      const bd = this.burst.getChannelData(0);
      for (let i = 0; i < len; i++) bd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
      this.next = 0;
      this.hx = 0.21; this.hy = 0.15;
      this.aval = 0; this.avalStep = 0;
      this.poly = [0, 0, 0]; this.stream = 0; this.elastic = 0;
      this.motif = [0, 7, 4, 12, 9];
      this.motifStep = 0;
      this.last = 0;
      this.noteUse = {};
      this.bigram = {};
    }

    _gainTarget() {
      return this.p.enabled ? this.p.gain : 0;
    }

    update(key) {
      const now = this.ctx.currentTime;
      const g = this._gainTarget();
      this.bus.gain.setTargetAtTime(this.p.space3d ? 0 : g * 0.5, now, 0.05);
      this.slotGain.forEach((sg) => sg.gain.setTargetAtTime(this.p.space3d ? g * 0.9 : 0, now, 0.05));
      if (key === 'enabled' && this.p.enabled) this.next = 0;
    }

    _pool() {
      const sc = SCALES[this.p.scale] || SCALES.pentatonic;
      const reg = this.p.register !== undefined ? this.p.register : 0.45;
      const lo = Math.round(-12 + reg * 30);
      const hi = lo + Math.round(22 + this.p.morph * 18);
      const pool = [];
      for (let n = lo; n <= hi; n++) if (sc.includes(((n % 12) + 12) % 12)) pool.push(n);
      return pool.length ? pool : [0];
    }

    _selectNote(x, y) {
      const pool = this._pool();
      const r = this.p.r;
      Object.keys(this.noteUse).forEach((k) => { this.noteUse[k] *= 0.88; if (this.noteUse[k] < 0.05) delete this.noteUse[k]; });
      Object.keys(this.bigram).forEach((k) => { this.bigram[k] *= 0.85; if (this.bigram[k] < 0.05) delete this.bigram[k]; });
      this.motifStep = (this.motifStep + 1) % this.motif.length;
      let cand = this.motif[this.motifStep];
      if (!pool.includes(cand)) { cand = pool[Math.floor(x * pool.length) % pool.length]; this.motif[this.motifStep] = cand; }
      const chaosNorm = clamp((r - 2.8) / 1.19, 0, 1);
      const maxRep = 3.2 - chaosNorm * 2.2;
      let mutated = false;
      if ((this.bigram[`${this.last}>${cand}`] || 0) > maxRep || (this.noteUse[cand] || 0) > maxRep + 0.6 || cand === this.last || (x > 1 - chaosNorm * 0.55 && y > 0.45)) {
        mutated = true;
        let best = pool[0], bestS = -Infinity;
        const target = (x * 0.65 + y * 0.35 + this.motifStep * 0.19) % 1;
        pool.forEach((m, i) => {
          if (m === this.last && pool.length > 1) return;
          const pos = i / Math.max(1, pool.length - 1);
          const iv = Math.abs(m - this.last);
          const cons = [2, 3, 4, 5, 7, 8, 9, 12, 14, 16, 19, 24].includes(iv) ? 0.25 : 0;
          const sc = (1 - Math.abs(pos - target)) * 1.4 + cons - (this.noteUse[m] || 0) * 1.35 - (this.bigram[`${this.last}>${m}`] || 0) * 2.1;
          if (sc > bestS) { bestS = sc; best = m; }
        });
        cand = best;
        this.motif[this.motifStep] = cand;
        if (y > 0.78 && chaosNorm > 0.5) {
          const tl = 4 + Math.floor(x * 4);
          while (this.motif.length < tl) this.motif.push(pool[Math.floor((x + y) * pool.length) % pool.length]);
          if (this.motif.length > tl) { this.motif.length = tl; this.motifStep %= tl; }
        }
      }
      this.noteUse[cand] = (this.noteUse[cand] || 0) + 1;
      this.bigram[`${this.last}>${cand}`] = (this.bigram[`${this.last}>${cand}`] || 0) + 1;
      this.last = cand;
      return { n: cand, mutated };
    }

    _interval(now, x) {
      const base = 1 / Math.max(0.3, this.p.rate);
      switch (this.p.rhythm) {
        case 'lorenz': {
          const sub = [0.25, 0.333, 0.5, 0.75, 1, 1.5, 2];
          return Math.max(0.05, base * sub[Math.floor(((x + Math.abs(this.hy)) * 3.7) % sub.length)]);
        }
        case 'polyrhythm': {
          const ratios = [1, 1.618034, 2.33333];
          let min = Infinity, s = 0;
          for (let i = 0; i < 3; i++) {
            if (this.poly[i] <= now) this.poly[i] = now + base * ratios[i];
            if (this.poly[i] < min) { min = this.poly[i]; s = i; }
          }
          this.stream = s;
          const dt = Math.max(0.04, min - now);
          this.poly[s] = min + base * ratios[s];
          return dt;
        }
        case 'elastic': {
          this.elastic = (this.elastic + 0.14) % TAU;
          return Math.max(0.042, base * (0.12 + 2.2 * Math.pow(0.55 - 0.45 * Math.cos(this.elastic), 1.85)));
        }
        case 'stochastic':
          return Math.max(0.05, base * (0.25 + x * 1.5));
        default: // avalanche
          if (this.aval > 0) {
            this.aval--;
            this.avalStep++;
            const f = x > 0.5 ? Math.pow(0.82, this.avalStep) : Math.pow(1.18, this.avalStep);
            return clamp(base * 0.28 * f, 0.05, 0.24);
          }
          this.aval = 2 + Math.floor(x * 5.5);
          this.avalStep = 0;
          return base * (1.6 + ((x * 1.618) % 1) * 2.8);
      }
    }

    _dest(x, y) {
      if (!this.p.space3d) {
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = clamp((y * 2 - 1) * 0.9, -0.95, 0.95);
        pan.connect(this.bus);
        return pan;
      }
      // place the event on a sphere: azimuth from the Hénon state, elevation from the logistic state
      const i = this.slotIdx;
      this.slotIdx = (this.slotIdx + 1) % this.slots.length;
      const az = (y * 2 - 1) * Math.PI;
      const el = (x - 0.5) * 1.6;
      const d = 1.4 + 1.2 * ((x + y) % 1);
      const t = this.ctx.currentTime + 0.02;
      const r = this.engine.renderer;
      r.setPosition(this.slots[i], d * Math.cos(el) * Math.sin(az), d * Math.sin(el), -d * Math.cos(el) * Math.cos(az), 0, t);
      const g = this.ctx.createGain();
      g.connect(this.slotGain[i]);
      return g;
    }

    _trigger(now) {
      const ctx = this.ctx;
      const p = this.p;
      let x = this.engine.telemetry.lastChaosX;
      x = p.r * x * (1 - x);
      if (x <= 0.001 || x >= 0.999) x = 0.314159;
      this.engine.telemetry.lastChaosX = x;
      const nx = 1 - 1.28 * this.hx * this.hx + this.hy;
      this.hy = clamp(0.32 * this.hx, -1.5, 1.5);
      this.hx = clamp(nx, -1.5, 1.5);
      const y = ((this.hx + 1.5) / 3 + x * 0.618) % 1;
      const tel = this.engine.telemetry;
      const bin = Math.min(15, Math.floor(x * 16));
      const tot = tel.chaosBins.reduce((a, b) => a + b, 0);
      const surprise = -Math.log2(tel.chaosBins[bin] / tot);
      for (let i = 0; i < 16; i++) tel.chaosBins[i] *= 0.96;
      tel.chaosBins[bin] += 1;
      tel.bayesianSurprise = tel.bayesianSurprise * 0.7 + surprise * 0.3;

      const arch = p.palette === 'hybrid' ? ARCHETYPES[Math.floor(((x * 5 + y * 3) * 1.7) % 5)] : p.palette;
      const sel = this._selectNote(x, y);
      let n = sel.n;
      if (p.rhythm === 'polyrhythm') n += (this.stream - 1) * 12;
      const root = this.engine.params.root;
      let f = root * Math.pow(2, n / 12);
      const dest = this._dest(x, y);
      const env = ctx.createGain();
      env.connect(dest);
      const morph = p.morph;
      let end = now + 1;
      if (arch === 'metallic') {
        const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
        const ratio = [2, 3, 1.5, 4, 1][Math.floor((y * 10) % 5)];
        car.frequency.value = f;
        mod.frequency.value = f * ratio;
        const dec = 0.8 + (1 - x) * 1.6;
        mg.gain.setValueAtTime(f * (0.4 + morph * 1.8), now);
        mg.gain.exponentialRampToValueAtTime(f * 0.02, now + dec * 0.6);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.2, now + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, now + dec);
        mod.connect(mg); mg.connect(car.frequency); car.connect(env);
        car.start(now); mod.start(now); end = now + dec + 0.05; car.stop(end); mod.stop(end);
      } else if (arch === 'plucked') {
        const src = ctx.createBufferSource();
        src.buffer = this.burst;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const m1 = ctx.createBiquadFilter(), m2 = ctx.createBiquadFilter();
        m1.type = 'bandpass'; m1.frequency.value = f; m1.Q.value = 14 + morph * 16;
        m2.type = 'bandpass'; m2.frequency.value = Math.min(9000, f * (y > 0.5 ? 2 : 3)); m2.Q.value = 12 + morph * 12;
        const atk = 0.004 + (1 - morph) * 0.015, dec = 0.35 + y * 0.7;
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.3, now + atk);
        env.gain.exponentialRampToValueAtTime(0.0001, now + atk + dec);
        src.connect(m1); src.connect(m2); osc.connect(m1); m1.connect(env); m2.connect(env);
        src.start(now); osc.start(now); end = now + atk + dec + 0.05; osc.stop(end);
      } else if (arch === 'subglitch') {
        const sub = ctx.createOscillator(), click = ctx.createOscillator(), ce = ctx.createGain();
        while (f > root * 0.75) f /= 2;
        while (f < root * 0.37) f *= 2;
        const dec = 0.5 + (1 - x) * 0.6;
        sub.frequency.setValueAtTime(f * 2, now);
        sub.frequency.exponentialRampToValueAtTime(f, now + 0.07);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.34, now + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, now + dec);
        click.frequency.value = f * 16;
        ce.gain.setValueAtTime(0.08, now);
        ce.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        sub.connect(env); click.connect(ce); ce.connect(dest);
        sub.start(now); click.start(now); end = now + dec + 0.05; sub.stop(end); click.stop(now + 0.03);
      } else if (arch === 'breath') {
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), fm = ctx.createBiquadFilter();
        o1.type = 'sawtooth'; o1.frequency.value = f;
        o2.frequency.value = f * (y > 0.5 ? 1.5 : 2);
        fm.type = 'bandpass'; fm.Q.value = 4 + morph * 5;
        fm.frequency.setValueAtTime(Math.min(4800, f * 2), now);
        fm.frequency.exponentialRampToValueAtTime(Math.min(6400, f * 4), now + 0.6);
        const sw = 0.35 + (1 - x) * 0.5, rel = 0.25 + y * 0.3;
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(0.2, now + sw);
        env.gain.exponentialRampToValueAtTime(0.0001, now + sw + rel);
        o1.connect(fm); o2.connect(fm); fm.connect(env);
        o1.start(now); o2.start(now); end = now + sw + rel + 0.05; o1.stop(end); o2.stop(end);
      } else { // liquid
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
        o1.type = 'sawtooth'; o2.type = 'triangle';
        const grace = morph > 0.5 ? (y > 0.5 ? -2 : 2) : 0;
        o1.frequency.setValueAtTime(f * Math.pow(2, grace / 12), now);
        o1.frequency.exponentialRampToValueAtTime(f, now + 0.07);
        o2.frequency.value = f * 2;
        f1.type = 'bandpass'; f1.Q.value = 5.5 + morph * 7.5;
        f1.frequency.setValueAtTime(320 + x * 1400, now);
        f1.frequency.exponentialRampToValueAtTime(480 + y * 1900, now + 0.35);
        f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.value = 900 + (1 - x) * 2100;
        const atk = 0.012 + (1 - morph) * 0.025, dec = 0.3 + (1 - x) * 0.5;
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.22, now + atk);
        env.gain.exponentialRampToValueAtTime(0.0001, now + atk + dec);
        o1.connect(f1); o2.connect(f1); o1.connect(f2); f1.connect(env); f2.connect(env);
        o1.start(now); o2.start(now); end = now + atk + dec + 0.05; o1.stop(end); o2.stop(end);
      }
      tel.recentDroplets.push({ x, y, freq: f, noteName: noteName(f), mutated: sel.mutated, archetype: arch, surprise, birth: performance.now() });
      if (tel.recentDroplets.length > 55) tel.recentDroplets.shift();
    }

    tick(now) {
      if (!this.p.enabled || !this.engine.isRunning) return;
      if (now >= this.next) {
        this._trigger(now + 0.01);
        this.next = now + this._interval(now, this.engine.telemetry.lastChaosX);
      }
    }
  }

  // ==========================================================================================
  // 03 — Binaural beat & θ–γ shimmer
  // ==========================================================================================
  const HARM_GAINS = [1.0, 0.42, 0.22, 0.1];

  class BinauralBeatModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.p = engine.params.pac;
      const ctx = this.ctx;
      this.binBus = ctx.createGain();
      this.binBus.gain.value = 0;
      this.binBus.connect(engine.dryBus);
      this.shimBus = ctx.createGain();
      this.shimBus.gain.value = 0;
      this.shimBus.connect(engine.dryBus);
      this.shimBus.connect(engine.reverbSendGain);
      const merger = ctx.createChannelMerger(2);
      merger.connect(this.binBus);
      this.swell = [ctx.createGain(), ctx.createGain()];
      this.lp = [ctx.createBiquadFilter(), ctx.createBiquadFilter()];
      this.oscs = [[], []];
      this.gains = [[], []];
      for (let ch = 0; ch < 2; ch++) {
        this.lp[ch].type = 'lowpass';
        this.lp[ch].Q.value = 0.7;
        this.lp[ch].connect(this.swell[ch]);
        this.swell[ch].connect(merger, 0, ch);
        for (let k = 0; k < 4; k++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(this.lp[ch]);
          o.start();
          this.oscs[ch].push(o);
          this.gains[ch].push(g);
        }
      }
      // θ-gated shimmer: overtones of the carrier, amplitude-modulated at the γ rate
      this.shimOsc = [2, 3, 5].map((h) => {
        const o = ctx.createOscillator();
        o.type = h === 3 ? 'triangle' : 'sine';
        o.start();
        return { o, h };
      });
      this.shimFilter = ctx.createBiquadFilter();
      this.shimFilter.type = 'bandpass';
      this.shimFilter.Q.value = 1.6;
      [0.38, 0.24, 0.14].forEach((a, i) => {
        const g = ctx.createGain();
        g.gain.value = a;
        this.shimOsc[i].o.connect(g);
        g.connect(this.shimFilter);
      });
      this.gamma = ctx.createOscillator();
      this.gammaDepth = ctx.createGain();
      this.gammaDepth.gain.value = 0.32;
      this.am = ctx.createGain();
      this.am.gain.value = 0.68;
      this.gamma.connect(this.gammaDepth);
      this.gammaDepth.connect(this.am.gain);
      this.gate = ctx.createGain();
      this.gate.gain.value = 0;
      this.shimFilter.connect(this.am);
      this.am.connect(this.gate);
      this.gate.connect(this.shimBus);
      this.gamma.start();
      this._retune(true);
    }

    _retune(immediate) {
      const now = this.ctx.currentTime;
      const tc = immediate ? 0.001 : 0.05;
      const c = this.p.baseFreq || this.engine.params.root;
      const half = (this.p.theta || 6) / 2;
      const h = clamp(this.p.harmonics !== undefined ? this.p.harmonics : 0.35, 0, 1);
      for (let k = 0; k < 4; k++) {
        // each partial pair beats at exactly theta Hz: (k+1)c -/+ theta/2
        this.oscs[0][k].frequency.setTargetAtTime((k + 1) * c - half, now, tc);
        this.oscs[1][k].frequency.setTargetAtTime((k + 1) * c + half, now, tc);
        const g = HARM_GAINS[k] * (k === 0 ? 1 : h);
        this.gains[0][k].gain.setTargetAtTime(g, now, tc);
        this.gains[1][k].gain.setTargetAtTime(g, now, tc);
      }
      this.shimOsc.forEach(({ o, h: m }) => o.frequency.setTargetAtTime(c * m, now, tc));
      this.gamma.frequency.setTargetAtTime(this.p.gamma || 40, now, 0.02);
    }

    update(key) {
      const now = this.ctx.currentTime;
      const on = this.p.enabled;
      this.binBus.gain.setTargetAtTime(on ? this.p.gain * 0.75 : 0, now, 0.08);
      this.shimBus.gain.setTargetAtTime(on ? this.p.gain * 0.4 : 0, now, 0.08);
      if (['baseFreq', 'theta', 'harmonics', 'gamma', 'enabled'].includes(key)) this._retune(false);
    }

    tick(now, elapsed, isBg, b) {
      const p = this.p;
      const tel = this.engine.telemetry;
      if (!p.enabled) {
        tel.gammaEnvelope = 0;
        return;
      }
      const c = p.baseFreq || this.engine.params.root;
      const th = (elapsed * p.theta * TAU) % TAU;
      const crest = Math.pow(Math.max(0, Math.cos(th)), 2.6);
      const lung = b ? b.lung : 0.5;
      const bd = p.breath;
      const breathAmp = 1 - bd * 0.4 + bd * 0.6 * Math.pow(lung, 1.2);
      const tc = isBg ? 0.06 : 0.02;
      this.shimFilter.frequency.setTargetAtTime(Math.min(8500, c * (2.2 + lung * (2 + bd * 4))), now, tc);
      const cut = Math.min(8000, c * (3 + lung * (2 + bd * 4)));
      this.lp[0].frequency.setTargetAtTime(cut, now, tc);
      this.lp[1].frequency.setTargetAtTime(cut, now, tc);
      const swell = 0.85 * (1 - bd * 0.15 + bd * 0.2 * lung);
      this.swell[0].gain.setTargetAtTime(swell, now, tc);
      this.swell[1].gain.setTargetAtTime(swell, now, tc);
      const g = p.depth <= 0.005 ? 0 : p.depth * crest * 0.75 * breathAmp;
      this.gate.gain.setTargetAtTime(g, now, isBg ? 0.05 : 0.015);
      tel.thetaPhase = th;
      tel.gammaEnvelope = g;
      tel.pacIndex = p.depth;
    }
  }

  // ==========================================================================================
  // 04 — Shepard–Risset horizon
  // ==========================================================================================
  const SHEPARD_VOICES = 8; // one octave apart, spanning 8 octaves

  class ShepardModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.p = engine.params.fractal;
      const ctx = this.ctx;
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(engine.dryBus);
      this.bus.connect(engine.reverbSendGain);
      this.offset = 0; // position of the glissando, in octaves
      this.voices = [];
      engine.telemetry.shepardVoices = [];
      for (let i = 0; i < SHEPARD_VOICES; i++) {
        const v = { i };
        v.pan = ctx.createStereoPanner();
        v.pan.connect(this.bus);
        v.parts = [1, 1.25, 1.5].map(() => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          g.gain.value = 0;
          o.connect(g);
          g.connect(v.pan);
          o.start();
          return { o, g };
        });
        this.voices.push(v);
        engine.telemetry.shepardVoices.push({ octavePos: i / SHEPARD_VOICES, freq: 0, amp: 0, ripple: 0 });
      }
      this.lastT = this.ctx.currentTime;
    }

    update() {
      const now = this.ctx.currentTime;
      this.bus.gain.setTargetAtTime(this.p.enabled ? this.p.gain * 0.5 : 0, now, 0.08);
    }

    tick(now, elapsed, isBg) {
      const p = this.p;
      const dt = Math.min(0.1, now - this.lastT);
      this.lastT = now;
      if (!p.enabled) return;
      this.offset += p.speed * dt; // octaves per second
      const center = p.center || this.engine.params.root * 2;
      const fLow = center / Math.pow(2, SHEPARD_VOICES / 2);
      const depth = p.depth;
      const tc = isBg ? 0.06 : 0.03;
      for (let i = 0; i < SHEPARD_VOICES; i++) {
        const v = this.voices[i];
        const pos = (((i + this.offset) % SHEPARD_VOICES) + SHEPARD_VOICES) % SHEPARD_VOICES / SHEPARD_VOICES; // 0..1
        const f = fLow * Math.pow(2, pos * SHEPARD_VOICES);
        const bell = 0.5 - 0.5 * Math.cos(pos * TAU); // raised cosine over log-frequency
        const rate = 0.18 * Math.pow(2, pos * 3);
        const ph = elapsed * rate * TAU + i * 0.785;
        const w = (o) => 0.52 * Math.sin(ph + o) + 0.26 * Math.sin(2 * ph + 0.8 + o) + 0.14 * Math.sin(4 * ph + 1.9 + o) + 0.08 * Math.sin(8 * ph + 0.4 + o);
        const amps = [
          bell * (1 - depth * 0.5 + depth * 0.5 * Math.pow(0.5 + 0.5 * w(0), 1.8)) * 0.16,
          depth <= 0.005 ? 0 : bell * depth * Math.pow(0.5 + 0.5 * w(2.094), 2) * 0.1,
          depth <= 0.005 ? 0 : bell * depth * Math.pow(0.5 + 0.5 * w(4.188), 2) * 0.12
        ];
        v.parts.forEach((pt, k) => {
          const ratio = k === 0 ? 1 : k === 1 ? (i % 2 ? 1.125 : 1.25) : 1.5;
          pt.o.frequency.setTargetAtTime(Math.min(9000, f * ratio), now, tc);
          pt.g.gain.setTargetAtTime(amps[k], now, tc);
        });
        v.pan.pan.setTargetAtTime(Math.sin(pos * TAU + elapsed * 0.05) * 0.7, now, 0.1);
        const tv = this.engine.telemetry.shepardVoices[i];
        tv.octavePos = pos;
        tv.freq = f;
        tv.amp = amps[0] / 0.16 + (amps[1] + amps[2]) * 2.5;
        tv.ripple = depth * w(0);
      }
    }
  }

  global.AetherModules = Object.assign(global.AetherModules || {}, { ChaosModule, BinauralBeatModule, ShepardModule, SCALES, noteName });
})(typeof window !== 'undefined' ? window : globalThis);
