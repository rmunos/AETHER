/**
 * AETHER // Modules 05-07
 *  05 Somatic sub-bass: 24-60 Hz with 2nd/3rd harmonics; steady, pulse, heartbeat or breath-coupled swell
 *  06 Sound textures: ocean surf paced by the breath (as in the Hemi-Sync tapes), pink-noise cavern with
 *     drifting vowel resonances, rain, wind
 *  07 Close-up & ritual: whisper, crackle, wood taps, frame drum, overtone chant — rendered binaurally close
 *     to the head (near-field cues) through renderer slots 9-11
 */
(function (global) {
  'use strict';
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const TAU = Math.PI * 2;

  function pinkBuffer(ctx, seconds, channels) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(channels, len, ctx.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      const fade = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < fade; i++) d[i] = d[i] * (i / fade) + d[len - fade + i] * (1 - i / fade);
    }
    return buf;
  }

  // ==========================================================================================
  // 05 — Somatic sub-bass
  // ==========================================================================================
  class SomaticModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.p = engine.params.sub;
      const ctx = this.ctx;
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(engine.dryBus);
      this.lp1 = ctx.createBiquadFilter();
      this.lp2 = ctx.createBiquadFilter();
      [this.lp1, this.lp2].forEach((f) => { f.type = 'lowpass'; f.Q.value = 0.707; });
      this.pulse = ctx.createGain();
      this.pulse.gain.value = 0.85;
      this.lp1.connect(this.lp2);
      this.lp2.connect(this.pulse);
      this.pulse.connect(this.bus);
      this.oscs = [1, 2, 3].map((h) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(this.lp1);
        o.start();
        return { o, g, h };
      });
      this._retune(true);
    }

    _retune(immediate) {
      const now = this.ctx.currentTime;
      const tc = immediate ? 0.001 : 0.08;
      const f0 = this.p.freq;
      const w = this.p.warmth;
      const gains = [0.85, 0.35 + w * 0.55, 0.15 + w * 0.45];
      this.oscs.forEach((o, i) => {
        o.o.frequency.setTargetAtTime(f0 * o.h, now, tc);
        o.g.gain.setTargetAtTime(gains[i], now, tc);
      });
      const cut = Math.min(220, f0 * (3.2 + w * 2.5));
      this.lp1.frequency.setTargetAtTime(cut, now, tc);
      this.lp2.frequency.setTargetAtTime(cut, now, tc);
    }

    update(key) {
      const now = this.ctx.currentTime;
      this.bus.gain.setTargetAtTime(this.p.enabled ? this.p.gain * 0.65 : 0, now, 0.08);
      if (key === 'freq' || key === 'warmth' || key === 'enabled') this._retune(false);
    }

    tick(now, elapsed, isBg, b) {
      const p = this.p;
      if (!p.enabled) return;
      let v = 0.85;
      if (p.pattern === 'pulse') {
        v = 0.55 + 0.45 * Math.sin(elapsed * p.pulse * TAU);
      } else if (p.pattern === 'heartbeat') {
        const bps = clamp(p.pulse, 0.6, 1.6); // beats per second (36-96 BPM)
        const ph = (elapsed * bps) % 1;
        const lub = Math.exp(-ph / 0.06) * (ph < 0.4 ? 1 : 0);
        const dub = ph > 0.28 ? 0.7 * Math.exp(-(ph - 0.28) / 0.07) : 0;
        v = 0.12 + 1.1 * Math.max(lub, dub);
      } else if (p.pattern === 'breath') {
        const lung = b ? b.lung : 0.5;
        v = 0.3 + 0.7 * (1 - lung); // grows as you breathe out, softens as you breathe in
      }
      this.pulse.gain.setTargetAtTime(v, now, p.pattern === 'heartbeat' ? 0.008 : isBg ? 0.06 : 0.03);
    }
  }

  // ==========================================================================================
  // 06 — Sound textures
  // ==========================================================================================
  const VOWELS = [[300, 870], [500, 1000], [730, 1090], [530, 1840], [270, 2290]];
  function vowel(pos) {
    const n = VOWELS.length;
    const x = ((pos % n) + n) % n;
    const i = Math.floor(x), j = (i + 1) % n;
    const t = 0.5 - 0.5 * Math.cos((x - i) * Math.PI);
    return [VOWELS[i][0] + (VOWELS[j][0] - VOWELS[i][0]) * t, VOWELS[i][1] + (VOWELS[j][1] - VOWELS[i][1]) * t];
  }

// Level trim after the v6.5 reverb calibration: until v6.4 an over-loud hall/room reverb carried this module's loudness.
  const TEXTURE_TRIM = { surf: 9.0, cavern: 4.5, rain: 7.0, wind: 7.0 };
  const RITUAL_TRIM = { whisper: 1.6, throat: 1.6, shamanic: 2.6, crackle: 2.2, tapping: 2.2 };

  class TextureModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.p = engine.params.ganzfeld;
      const ctx = this.ctx;
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(engine.dryBus);
      this.revSend = ctx.createGain();
      this.revSend.gain.value = 0.5;
      this.bus.connect(this.revSend);
      this.revSend.connect(engine.reverbSendGain);
      this.noise = ctx.createBufferSource();
      this.noise.buffer = pinkBuffer(ctx, 8, 2);
      this.noise.loop = true;
      const split = ctx.createChannelSplitter(2);
      this.noise.connect(split);
      this.ch = [0, 1].map((c) => {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.5;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 30;
        const g = ctx.createGain();
        g.gain.value = 0;
        const f1 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        const f2 = ctx.createBiquadFilter();
        f2.type = 'bandpass';
        const fg = ctx.createGain();
        fg.gain.value = 0;
        split.connect(hp, c);
        hp.connect(lp);
        lp.connect(g);
        split.connect(f1, c);
        split.connect(f2, c);
        f1.connect(fg);
        f2.connect(fg);
        return { lp, hp, g, f1, f2, fg };
      });
      const merger = ctx.createChannelMerger(2);
      this.ch.forEach((c, i) => { c.g.connect(merger, 0, i); c.fg.connect(merger, 0, i); });
      merger.connect(this.bus);
      this.noise.start();
      // rain drops: round-robin panners
      this.dropPans = [-0.8, -0.3, 0.3, 0.8].map((v) => {
        const pn = ctx.createStereoPanner();
        pn.pan.value = v;
        pn.connect(this.bus);
        return pn;
      });
      this.dropIdx = 0;
      this.nextDrop = 0;
    }

    update() {
      const now = this.ctx.currentTime;
      const trim = TEXTURE_TRIM[this.p.texture || 'surf'] || 5;
      this.bus.gain.setTargetAtTime(this.p.enabled ? this.p.gain * 0.6 * trim : 0, now, 0.1);
    }

    _drop(t) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const f0 = 1800 + Math.random() * 3500;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.03);
      const g = ctx.createGain();
      const lvl = 0.02 + 0.05 * Math.random() * Math.random();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + 0.001);
      g.gain.setTargetAtTime(0, t + 0.002, 0.012);
      o.connect(g);
      g.connect(this.dropPans[this.dropIdx]);
      this.dropIdx = (this.dropIdx + 1) % this.dropPans.length;
      o.start(t);
      o.stop(t + 0.1);
    }

    tick(now, elapsed, isBg, b) {
      const p = this.p;
      if (!p.enabled) return;
      const tex = p.texture || 'surf';
      const s = p.sweep;
      const dark = p.color; // 0 bright .. 1 dark
      const tc = isBg ? 0.08 : 0.05;
      const lung = b ? b.lung : 0.5;
      const ch = this.ch;
      if (tex === 'surf') {
        // one wave per breath: drawn back while you breathe in, breaks and washes while you breathe out
        const stage = b ? b.stage : 'exhale';
        const bp = b ? b.p : 0.5;
        ch.forEach((c, i) => {
          const lag = i ? 0.06 : 0; // the wave reaches the two ears slightly apart
          let lvl, cut;
          if (stage === 'exhale' || stage === 'holdOut') {
            const q = clamp((stage === 'holdOut' ? 1 : bp) - lag, 0, 1);
            const crash = Math.min(1, q / 0.12);
            lvl = 0.25 + 0.75 * crash * Math.exp(-2.2 * Math.max(0, q - 0.12));
            cut = 450 + 3200 * crash * Math.exp(-1.6 * Math.max(0, q - 0.1));
          } else {
            lvl = 0.18 + 0.22 * lung;
            cut = 500 + 900 * lung;
          }
          lvl *= 0.55 + 0.45 * s;
          c.g.gain.setTargetAtTime(lvl * 0.9, now, tc);
          c.lp.frequency.setTargetAtTime(cut * (1.25 - 0.6 * dark), now, tc);
          c.fg.gain.setTargetAtTime(0, now, tc);
        });
      } else if (tex === 'cavern') {
        const rate = 0.11 + s * 0.14;
        const [l1, l2] = vowel(elapsed * rate);
        const [r1, r2] = vowel(elapsed * rate * 0.77 + 2.3);
        const q = 2.5 + s * 9.5;
        [[l1, l2], [r1, r2]].forEach(([f1, f2], i) => {
          const c = ch[i];
          c.f1.frequency.setTargetAtTime(f1, now, 0.06);
          c.f2.frequency.setTargetAtTime(f2, now, 0.06);
          c.f1.Q.value = q;
          c.f2.Q.value = q;
          c.fg.gain.setTargetAtTime(s * 3.0, now, 0.1);
          c.g.gain.setTargetAtTime(0.75 * (1 - s * 0.8), now, 0.1);
          c.lp.frequency.setTargetAtTime(4500 * Math.pow(180 / 4500, dark), now, 0.1);
        });
      } else if (tex === 'rain') {
        ch.forEach((c, i) => {
          c.g.gain.setTargetAtTime(0.35 + 0.08 * Math.sin(elapsed * 0.13 + i), now, 0.2);
          c.lp.frequency.setTargetAtTime(7000 - 4000 * dark, now, 0.2);
          c.hp.frequency.setTargetAtTime(500, now, 0.2);
          c.fg.gain.setTargetAtTime(0, now, 0.1);
        });
        const rate = 8 + 50 * s;
        if (this.nextDrop < now) this.nextDrop = now;
        let guard = 0;
        while (this.nextDrop < now + 0.1 && guard++ < 20) {
          this._drop(this.nextDrop + 0.02);
          this.nextDrop += -Math.log(1 - Math.random() * 0.98) / rate;
        }
      } else { // wind
        ch.forEach((c, i) => {
          const gust = 0.5 + 0.3 * Math.sin(elapsed * 0.07 + i * 1.7) + 0.2 * Math.sin(elapsed * 0.19 + i);
          const g = (0.25 + 0.75 * gust * (0.4 + 0.6 * s));
          c.g.gain.setTargetAtTime(0.05, now, 0.2);
          c.f1.frequency.setTargetAtTime((250 + 900 * gust) * (1.2 - 0.6 * dark), now, 0.2);
          c.f1.Q.value = 2.2;
          c.f2.frequency.setTargetAtTime((700 + 1600 * gust) * (1.2 - 0.6 * dark), now, 0.2);
          c.f2.Q.value = 4;
          c.fg.gain.setTargetAtTime(g * 1.6, now, 0.2);
          c.lp.frequency.setTargetAtTime(1200, now, 0.2);
        });
      }
      if (tex !== 'rain') ch.forEach((c) => c.hp.frequency.setTargetAtTime(tex === 'surf' ? 40 : 30, now, 0.2));
    }
  }

  // ==========================================================================================
  // 07 — Close-up & ritual (binaural, near field)
  // ==========================================================================================
  class RitualModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.p = engine.params.asmr;
      const ctx = this.ctx;
      const r = engine.renderer;
      this.slots = [9, 10, 11];
      this.inputs = this.slots.map((s) => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(r.input(s));
        return g;
      });
      this.noiseBuf = pinkBuffer(ctx, 4, 1);
      // continuous voice (whisper / overtone chant) -> slot 9
      this.voice = ctx.createGain();
      this.voice.connect(this.inputs[0]);
      this.wSrc = ctx.createBufferSource();
      this.wSrc.buffer = this.noiseBuf;
      this.wSrc.loop = true;
      this.wF1 = ctx.createBiquadFilter(); this.wF1.type = 'bandpass'; this.wF1.Q.value = 2;
      this.wF2 = ctx.createBiquadFilter(); this.wF2.type = 'bandpass'; this.wF2.Q.value = 2.4;
      this.wAir = ctx.createBiquadFilter(); this.wAir.type = 'bandpass'; this.wAir.Q.value = 1.2;
      this.wGain = ctx.createGain(); this.wGain.gain.value = 0;
      [this.wF1, this.wF2, this.wAir].forEach((f) => { this.wSrc.connect(f); f.connect(this.wGain); });
      this.wGain.connect(this.voice);
      this.wSrc.start();
      const root = engine.params.root;
      this.drone = ctx.createOscillator(); this.drone.type = 'sawtooth'; this.drone.frequency.value = root;
      this.droneSub = ctx.createOscillator(); this.droneSub.type = 'triangle'; this.droneSub.frequency.value = root / 2;
      this.bodyLP = ctx.createBiquadFilter(); this.bodyLP.type = 'lowpass'; this.bodyLP.frequency.value = 260; this.bodyLP.Q.value = 1.2;
      this.bodyG = ctx.createGain(); this.bodyG.gain.value = 0.42;
      this.ot = ctx.createBiquadFilter(); this.ot.type = 'bandpass'; this.ot.frequency.value = root * 6; this.ot.Q.value = 18;
      this.otG = ctx.createGain(); this.otG.gain.value = 3.2;
      this.whistle = ctx.createOscillator(); this.whistle.frequency.value = root * 6;
      this.whG = ctx.createGain(); this.whG.gain.value = 0.18;
      this.tGain = ctx.createGain(); this.tGain.gain.value = 0;
      this.drone.connect(this.ot); this.ot.connect(this.otG); this.otG.connect(this.tGain);
      this.drone.connect(this.bodyLP); this.droneSub.connect(this.bodyLP); this.bodyLP.connect(this.bodyG); this.bodyG.connect(this.tGain);
      this.whistle.connect(this.whG); this.whG.connect(this.tGain);
      this.tGain.connect(this.voice);
      [this.drone, this.droneSub, this.whistle].forEach((o) => o.start());
      this.next = 0;
      this.nextStep = 0;
      this.hIdx = 0;
      this.ear = false;
      this.evSlot = 1;
    }

    _dist() {
      return 0.12 + 1.3 * clamp(this.p.proximity, 0, 1);
    }

    update(key) {
      const now = this.ctx.currentTime;
      const g = this.p.enabled ? this.p.gain * (RITUAL_TRIM[this.p.palette] || 1.6) : 0;
      this.inputs.forEach((i) => i.gain.setTargetAtTime(g, now, 0.06));
      if (key === 'root') {
        const root = this.engine.params.root;
        this.drone.frequency.setTargetAtTime(root, now, 0.1);
        this.droneSub.frequency.setTargetAtTime(root / 2, now, 0.1);
      }
      if (key === 'palette') { this.next = 0; this.nextStep = 0; }
    }

    _place(slotIdx, az, el, d, t) {
      this.engine.renderer.setPosition(this.slots[slotIdx], d * Math.cos(el) * Math.sin(az), d * Math.sin(el), -d * Math.cos(el) * Math.cos(az), 0, t);
    }

    _eventSlot() {
      this.evSlot = this.evSlot === 1 ? 2 : 1;
      return this.evSlot;
    }

    _burst(dest, t, dur, f, q, lvl, shape = 1) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = f;
      flt.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + (shape ? 0.002 : dur * 0.5));
      g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(flt); flt.connect(g); g.connect(dest);
      src.start(t, Math.random() * 3, dur + 0.02);
    }

    _crackle(t, res) {
      const k = this._eventSlot();
      this._place(k, (Math.random() * 2 - 1) * Math.PI, (Math.random() - 0.3) * 0.8, this._dist(), t);
      const dest = this.inputs[k];
      this._burst(dest, t, 0.07 + Math.random() * 0.05, 1800 + res * 2600, 1.6, 0.3, 0);
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this._burst(dest, t + i * (0.012 + Math.random() * 0.02), 0.012, 2400 + Math.random() * 3800 * (0.4 + res * 0.6), 2, 0.5 + Math.random() * 0.3);
    }

    _tap(t, res) {
      const ctx = this.ctx;
      const k = this._eventSlot();
      this.ear = !this.ear;
      const az = (this.ear ? -1 : 1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.6);
      this._place(k, az, (Math.random() - 0.5) * 0.5, this._dist(), t);
      const dest = this.inputs[k];
      const offs = Math.random() < 0.35 ? [0, 0.065 + Math.random() * 0.025] : [0];
      offs.forEach((o, i) => {
        const t0 = t + o;
        const vel = i ? 0.68 : 1;
        const f = [480, 640, 820, 1080, 1320][Math.floor(Math.random() * 5)] * (0.9 + res * 0.25);
        const o1 = ctx.createOscillator(), g1 = ctx.createGain();
        o1.frequency.setValueAtTime(f * 1.18, t0);
        o1.frequency.exponentialRampToValueAtTime(f, t0 + 0.012);
        g1.gain.setValueAtTime(0.5 * vel, t0);
        g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);
        o1.connect(g1); g1.connect(dest); o1.start(t0); o1.stop(t0 + 0.07);
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.value = f * 2.32;
        g2.gain.setValueAtTime(0.25 * vel * (0.5 + res * 0.5), t0);
        g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.028);
        o2.connect(g2); g2.connect(dest); o2.start(t0); o2.stop(t0 + 0.032);
      });
    }

    _drum(t, res, beat) {
      const ctx = this.ctx;
      // frame drum in front-left / front-right, rattle on the opposite side
      const side = beat % 2 ? 1 : -1;
      this._place(1, side * 0.5, -0.1, Math.max(0.7, this._dist()), t);
      this._place(2, -side * 1.2, 0.2, Math.max(0.5, this._dist() * 0.8), t);
      const o = ctx.createOscillator(), b = ctx.createOscillator(), g = ctx.createGain(), bg = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
      b.type = 'triangle'; b.frequency.setValueAtTime(184, t); b.frequency.exponentialRampToValueAtTime(92, t + 0.11);
      lp.type = 'lowpass'; lp.frequency.value = 300 + res * 300;
      g.gain.setValueAtTime(beat % 4 === 0 ? 1.0 : 0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      bg.gain.setValueAtTime(0.45, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(g); g.connect(this.inputs[1]);
      o.start(t); b.start(t); o.stop(t + 0.24); b.stop(t + 0.14);
      this._burst(this.inputs[1], t, 0.012, 1200, 0.8, 0.25);
      this._burst(this.inputs[2], t + 0.08 + (Math.random() - 0.5) * 0.015, 0.05, 3200 + res * 2800, 1.4, 0.35 + res * 0.25);
    }

    tick(now, elapsed, isBg, b) {
      const p = this.p;
      if (!p.enabled) {
        if (!this._muted) {
          this.wGain.gain.setTargetAtTime(0, now, 0.05);
          this.tGain.gain.setTargetAtTime(0, now, 0.05);
          this._muted = true;
        }
        return;
      }
      this._muted = false;
      const pal = p.palette;
      const res = p.resonance;
      const tSched = now + 0.12;
      // continuous voice orbits slowly around the head at the chosen distance
      const orbit = elapsed * (pal === 'whisper' ? 0.16 : 0.07) * TAU;
      this._place(0, orbit, 0.05 * Math.sin(elapsed * 0.3), pal === 'throat' ? Math.max(0.6, this._dist() * 1.5) : this._dist(), tSched);
      if (pal === 'whisper') {
        this.tGain.gain.setTargetAtTime(0, now, 0.05);
        const syl = 0.55 + 0.45 * Math.sin(elapsed * 2.2) * Math.cos(elapsed * 3.7);
        const lung = b ? b.lung : 0.5;
        this.wGain.gain.setTargetAtTime((0.5 + 0.8 * lung) * syl * 0.8, now, 0.04);
        const v = vowel(elapsed * 0.42);
        this.wF1.frequency.setTargetAtTime(v[0] * 1.25, now, 0.06);
        this.wF2.frequency.setTargetAtTime(v[1] * 1.15, now, 0.06);
        this.wAir.frequency.setTargetAtTime(3200 + res * 3800, now, 0.05);
      } else if (pal === 'throat') {
        this.wGain.gain.setTargetAtTime(0.04, now, 0.05);
        this.tGain.gain.setTargetAtTime(0.75, now, 0.05);
        if (now >= this.nextStep) {
          const H = [6, 8, 9, 10, 12, 10, 9, 8];
          const h = H[this.hIdx % H.length];
          const f = this.engine.params.root * h;
          this.ot.frequency.setTargetAtTime(f, now, 0.08);
          this.ot.Q.setTargetAtTime(14 + res * 22, now, 0.08);
          this.whistle.frequency.setTargetAtTime(f, now, 0.08);
          this.whG.gain.setTargetAtTime(0.12 + res * 0.2, now, 0.08);
          this.hIdx = (this.hIdx + 1 + (Math.random() < 0.3 ? 1 : 0)) % H.length;
          this.nextStep = now + 1.4 + Math.random() * 1.4;
        }
      } else {
        this.wGain.gain.setTargetAtTime(0, now, 0.05);
        this.tGain.gain.setTargetAtTime(0, now, 0.05);
        if (pal === 'shamanic') {
          const period = 1 / clamp(p.rate, 1, 8);
          if (this.next < now) { this.next = now + 0.05; this.beat = 0; }
          while (this.next < now + 0.1) {
            this._drum(this.next, res, this.beat++);
            this.next += period;
          }
        } else if (now >= this.next) {
          if (pal === 'crackle') this._crackle(now + 0.03, res);
          else this._tap(now + 0.03, res);
          this.next = now + (1 / Math.max(0.5, p.rate)) * (0.6 + Math.random() * 0.8);
        }
      }
    }
  }

  global.AetherModules = Object.assign(global.AetherModules || {}, { SomaticModule, TextureModule, RitualModule, vowel });
})(typeof window !== 'undefined' ? window : globalThis);
