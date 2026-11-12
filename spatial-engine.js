/**
 * AETHER // MODULE 01 — 3D sound space and REBAL (Resonant Energy Balloon)
 *
 * Sound generators + trajectories. Every stream is a mono source rendered by the binaural renderer
 * (binaural-renderer.js) at a scheduled 3-D position. Positions and sound parameters are computed for
 * `now + LOOKAHEAD` and scheduled as linear ramps, so motion stays smooth even with an irregular UI frame rate.
 *
 * Coordinates (metres, head-centred): +x right ear, +y up (crown), -z in front of the nose.
 *
 * REBAL, after the Gateway Experience manual (Discovery #3, "Advanced Focus 10"):
 *   "Create a flow pattern with your breath by letting energy flow out of the top of your head like a
 *    fountain, allowing it to continue flowing gently down and around you, and then reentering your body
 *    through the bottoms of your feet. Then shift the flow pattern into a spiral, winding the energy down
 *    around you and coiling it back up inside you."
 *
 *   inhale  : the energy rises inside the body, from the soles to the crown (heard inside the head);
 *   exhale  : it leaves the crown upwards (fountain), arcs over, flows down around the body on the outside
 *             of an apple-shaped torus, curls under the feet and re-enters through the soles;
 *   spiral  : same torus, but the outer flow winds around you and the inner flow coils back up;
 *   balloon : the streams keep circulating around the torus with staggered phases (the sustained field).
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, v) => {
    const t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
  // Hold an AudioParam at its current value and drop its future automation. Needed before muting: the
  // module schedules linear ramps up to LOOKAHEAD seconds ahead, and a ramp scheduled after a
  // setTargetAtTime(0) would bring the level back and hold it there.
  const holdAt = (prm, t) => {
    if (typeof prm.cancelAndHoldAtTime === 'function') {
      prm.cancelAndHoldAtTime(t);
    } else {
      const v = prm.value;
      prm.cancelScheduledValues(t);
      prm.setValueAtTime(v, t);
    }
  };

  const MAX_STREAMS = 6;
  const LOOKAHEAD = 0.15; // seconds: audio parameters are scheduled this far ahead
  const UPDATE_DT = 0.024; // seconds between scheduled control points

  // Body / torus geometry (head frame, metres)
  const Y_CROWN = 0.13; // top of the head above the ear canals
  const Y_FEET = -1.62; // soles of the feet
  // Meridian (r = horizontal distance from the body axis, y = height) of the outer flow for a 1.9 m balloon:
  // crown -> fountain jet -> apex -> over -> widest beside the body -> under the feet -> into the soles.
  const MERIDIAN = [
    [0.0, 0.13], [0.02, 0.5], [0.12, 0.95], [0.45, 1.28], [1.05, 1.18], [1.62, 0.55],
    [1.9, -0.45], [1.7, -1.35], [1.1, -1.98], [0.4, -2.05], [0.05, -1.78], [0.0, -1.62]
  ];
  const SEG_TIME = [1.0, 1.0, 1.05, 1.05, 1.0, 1.0, 1.0, 1.0, 0.95, 0.85, 0.6]; // relative time per segment
  const BASE_RADIUS = 1.9;

  // Musical material: every pitch is a harmonic of (tonal centre / 2), without the 7th, 9th, 11th...
  // harmonics, so any combination of notes is consonant (octaves, fifths, fourths, thirds, sixths).
  // Height selects the position on this ladder: low under the feet, high above the head.
  const LADDER = [2, 3, 4, 5, 6, 8, 10, 12, 16];
  const VOICE_OFFSETS = [0, 2, 1, 3, 4, 5]; // ladder offset of each stream: root, octave, fifth, tenth, ...
  // Vowels for the voices (F1, F2, F3 in Hz): "oo" under the feet -> "oh" -> "ah" -> "ae" above the head
  const VOWELS = [[300, 870, 2240], [500, 1000, 2500], [730, 1090, 2440], [660, 1700, 2400]];

  const PALETTES = ['breath', 'choir', 'harp', 'water', 'bowl', 'chimes'];
  const TRAJECTORIES = ['rebal', 'orbit', 'vertical', 'sphere', 'test', 'manual'];
  const REBAL_MODES = ['program', 'fountain', 'spiral', 'balloon'];
  const PALETTE_ALIASES = { energy: 'breath', rebal: 'breath', drops: 'water', water_drops: 'water', whisper: 'breath', crackle: 'chimes', tapping: 'chimes' };
  const TRAJECTORY_ALIASES = { orbit8d: 'orbit', circle: 'orbit', zenith_arch: 'vertical', helix3d: 'sphere', infinity: 'sphere', mixed: 'sphere' };

  const TEST_POINTS = [
    { name: 'FRONT', az: 0, el: 0 }, { name: 'RIGHT', az: 90, el: 0 }, { name: 'BEHIND', az: 180, el: 0 },
    { name: 'LEFT', az: -90, el: 0 }, { name: 'ABOVE', az: 0, el: 80 }, { name: 'BELOW', az: 0, el: -60 },
    { name: 'FRONT-RIGHT, UP', az: 45, el: 40 }, { name: 'BEHIND-LEFT, DOWN', az: -135, el: -35 },
    { name: 'FRONT-LEFT', az: -45, el: 0 }, { name: 'BEHIND-RIGHT', az: 135, el: 0 }
  ];

  // ===========================================================================================
  // Breath clock (shared by every module)
  // ===========================================================================================
  class BreathClock {
    constructor(params) {
      this.params = params;
      this.phase = 0; // in breaths (cycles)
      this.t = null;
      this.hist = [];
    }

    durations() {
      const p = this.params || {};
      const cycleT = 60 / clamp(p.rate || 6, 2, 20);
      const holdIn = clamp(p.holdIn || 0, 0, 10);
      const holdOut = clamp(p.holdOut || 0, 0, 10);
      const active = Math.max(2, cycleT - holdIn - holdOut);
      const share = clamp(p.inhale !== undefined ? p.inhale : 0.45, 0.25, 0.65);
      return { inhale: active * share, holdIn, exhale: active * (1 - share), holdOut, cycle: active + holdIn + holdOut };
    }

    advance(t) {
      if (this.t === null) {
        this.t = t;
      } else {
        const dt = clamp(t - this.t, 0, 0.5);
        if (dt > 0) {
          this.phase += dt / this.durations().cycle;
          this.t = t;
        }
      }
      const h = this.hist;
      if (!h.length || t > h[h.length - 1][0]) {
        h.push([t, this.phase]);
        if (h.length > 400) h.shift();
      }
      return this.phase;
    }

    /** breath phase heard at audio time t (the clock itself runs LOOKAHEAD ahead) */
    phaseAt(t) {
      const h = this.hist;
      if (!h.length) return this.phase;
      if (t >= h[h.length - 1][0]) return h[h.length - 1][1];
      for (let i = h.length - 1; i > 0; i--) {
        if (h[i - 1][0] <= t) {
          const [t0, p0] = h[i - 1];
          const [t1, p1] = h[i];
          return p0 + (p1 - p0) * ((t - t0) / Math.max(1e-6, t1 - t0));
        }
      }
      return h[0][1];
    }

    state(phase) {
      const d = this.durations();
      const cycle = Math.floor(phase);
      let tt = (phase - cycle) * d.cycle;
      let stage;
      let p;
      if (tt < d.inhale) {
        stage = 'inhale'; p = tt / d.inhale;
      } else if ((tt -= d.inhale) < d.holdIn) {
        stage = 'holdIn'; p = tt / d.holdIn;
      } else if ((tt -= d.holdIn) < d.exhale) {
        stage = 'exhale'; p = tt / d.exhale;
      } else {
        tt -= d.exhale; stage = 'holdOut'; p = d.holdOut > 0 ? tt / d.holdOut : 1;
      }
      const lung = stage === 'inhale' ? ease(p) : stage === 'holdIn' ? 1 : stage === 'exhale' ? 1 - ease(p) : 0;
      return { cycle, stage, p: clamp(p, 0, 1), lung, d };
    }
  }

  // ===========================================================================================
  // REBAL geometry (pure functions; exported for tests and for the visualiser)
  // ===========================================================================================
  const meridianCache = new Map();

  function scaledMeridian(L) {
    const key = Math.round(L * 100);
    if (meridianCache.has(key)) return meridianCache.get(key);
    const k = L / BASE_RADIUS;
    const vs = 0.55 + 0.45 * k;
    const pts = MERIDIAN.map(([r, y]) => {
      let yy = y;
      if (y > Y_CROWN) yy = Y_CROWN + (y - Y_CROWN) * vs;
      else if (y < Y_FEET) yy = Y_FEET + (y - Y_FEET) * vs;
      return [r * k, yy];
    });
    const cum = [0];
    SEG_TIME.forEach((w) => cum.push(cum[cum.length - 1] + w));
    const res = { pts, cum, total: cum[cum.length - 1] };
    meridianCache.set(key, res);
    if (meridianCache.size > 64) meridianCache.delete(meridianCache.keys().next().value);
    return res;
  }

  // Centripetal Catmull-Rom between p1 and p2
  function catmull(p0, p1, p2, p3, u) {
    const tj = (ti, a, b) => ti + Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) + 1e-9, 0.5);
    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);
    const t = t1 + (t2 - t1) * u;
    const mix = (a, b, ta, tb) => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
    const A1 = mix(p0, p1, t0, t1);
    const A2 = mix(p1, p2, t1, t2);
    const A3 = mix(p2, p3, t2, t3);
    const B1 = mix(A1, A2, t0, t2);
    const B2 = mix(A2, A3, t1, t3);
    return mix(B1, B2, t1, t2);
  }

  /** position on the outer (exhale) meridian, s in [0, 1] (time-uniform per SEG_TIME) */
  function meridianAt(s, L) {
    const m = scaledMeridian(L);
    const P = m.pts;
    const n = P.length;
    const x = clamp(s, 0, 1) * m.total;
    let i = 0;
    while (i < n - 2 && m.cum[i + 1] < x) i++;
    const u = clamp((x - m.cum[i]) / (m.cum[i + 1] - m.cum[i]), 0, 1);
    const get = (j) => {
      if (j < 0) return [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
      if (j > n - 1) return [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]];
      return P[j];
    };
    const q = catmull(get(i - 1), get(i), get(i + 1), get(i + 2), u);
    return { r: Math.max(0, q[0]), y: q[1] };
  }

  /** interior weight along the outer path: inside the head at the start, partly inside at the soles */
  function exhaleInterior(s) {
    return 1 - smooth(0.0, 0.16, s) + 0.3 * smooth(0.9, 1.0, s);
  }
  function inhaleInterior(y) {
    return 0.3 + 0.7 * smooth(Y_FEET, -0.35, y);
  }

  /** fraction of the spiral winding done at exhale progress s: trapezoidal angular speed (gentle start/stop) */
  function windFrac(s) {
    const a = 0.06, b = 0.97, q = 0.15;
    const u = clamp((s - a) / (b - a), 0, 1);
    const A = 1 - q;
    let F;
    if (u < q) F = (u * u) / (2 * q);
    else if (u <= 1 - q) F = q / 2 + (u - q);
    else F = A - ((1 - u) * (1 - u)) / (2 * q);
    return F / A;
  }

  /** azimuth of stream k (0 = front, +pi/2 = right) */
  function baseAzimuth(k, n, cycle) {
    if (n === 1) return (Math.PI / 2) * (cycle % 4) + Math.PI / 2; // rotates 90° per breath: right, back, left, front
    return Math.PI / 2 + (TAU * k) / n;
  }

  /**
   * REBAL position of stream k for breath state st.
   * mode: 'fountain' | 'spiral' | 'balloon'; opts: { L, turns, twist, n, offset }
   * returns { x, y, z, w, path: 'core'|'outer'|'head'|'feet', s }
   */
  function rebalPosition(st, k, mode, opts) {
    const L = opts.L;
    const n = opts.n;
    let az0 = baseAzimuth(k, n, st.cycle) + (opts.rotate || 0);
    const turns = opts.turns || 0;
    const out = { x: 0, y: 0, z: 0, w: 0, path: 'core', s: 0 };
    if (st.stage === 'exhale') {
      const s = st.p;
      const m = meridianAt(s, L);
      let az = az0 + (opts.twist || 0) * TAU * s;
      if (mode === 'spiral') az += turns * TAU * windFrac(s);
      out.x = m.r * Math.sin(az);
      out.z = -m.r * Math.cos(az);
      out.y = m.y;
      out.w = exhaleInterior(s);
      out.path = 'outer';
      out.s = s;
      out.az = az;
      return out;
    }
    if (st.stage === 'inhale') {
      const p = st.p;
      const y = Y_FEET + (Y_CROWN - Y_FEET) * (p * p * (3 - 2 * p));
      let r = 0;
      let az = az0;
      if (mode === 'spiral') {
        r = 0.17 * Math.pow(Math.sin(Math.PI * p), 0.8) * (1 - smooth(0.8, 1.0, p));
        az = az0 + turns * TAU + 2 * TAU * p; // keeps turning the same way, coiling up inside
      } else if (opts.innerSwirl > 0) {
        // gentle swirl around the body axis so the rise inside is heard as movement (small interaural changes)
        r = 0.12 * opts.innerSwirl * Math.pow(Math.sin(Math.PI * p), 0.8) * (1 - smooth(0.85, 1.0, p));
        az = az0 + 1.5 * TAU * p;
      }
      out.x = r * Math.sin(az);
      out.z = -r * Math.cos(az);
      out.y = y;
      out.w = inhaleInterior(y);
      out.path = 'core';
      out.s = p;
      out.az = az;
      return out;
    }
    if (st.stage === 'holdIn') {
      const a = az0 + TAU * 0.6 * st.p;
      out.x = 0.05 * Math.sin(a);
      out.z = -0.05 * Math.cos(a);
      out.y = Y_CROWN - 0.03;
      out.w = 1;
      out.path = 'head';
      return out;
    }
    out.x = 0;
    out.z = 0;
    out.y = Y_FEET;
    out.w = 0.3;
    out.path = 'feet';
    return out;
  }

  // ===========================================================================================
  // Module
  // ===========================================================================================
  class Spatial3DModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.params = engine.params.spatial;
      this.renderer = engine.renderer;
      this.breath = engine.breath;
      this.telemetry = engine.telemetry;
      this._normalize();

      this.phase = 0; // free-running trajectory phase (cycles) for non-REBAL movements
      this.lastSched = 0;
      this.lastTick = null;
      this.grainClock = 0;
      this.prevStage = null;
      this.rebalStart = null;
      this.frames = [];
      this.slots = [];
      for (let i = 0; i < MAX_STREAMS; i++) this.slots.push(i); // renderer slots 0..5
      this.noiseBuf = this._pinkNoise(6);
      this.wave = this._voiceWave();
      this.streams = [];
      for (let k = 0; k < MAX_STREAMS; k++) this.streams.push(this._buildStream(k));
      this.telemetry.spatialVoices = this.streams.map((_, k) => ({ index: k, x: 0, y: 0, z: -1, w: 0, active: false, level: 0 }));
      this.telemetry.spatialStage = { active: false, label: '' };
      this._applyPalette(true);
    }

    _normalize() {
      const p = this.params;
      if (PALETTE_ALIASES[p.palette]) p.palette = PALETTE_ALIASES[p.palette];
      if (!PALETTES.includes(p.palette)) p.palette = 'breath';
      if (TRAJECTORY_ALIASES[p.trajectory]) p.trajectory = TRAJECTORY_ALIASES[p.trajectory];
      if (!TRAJECTORIES.includes(p.trajectory)) p.trajectory = 'rebal';
      if (!REBAL_MODES.includes(p.rebalMode)) p.rebalMode = 'program';
      p.count = clamp(Math.round(p.count || 4), 1, MAX_STREAMS);
      p.gain = clamp(p.gain !== undefined ? p.gain : 0.8, 0, 1.5);
      p.speed = clamp(p.speed !== undefined ? p.speed : 0.08, 0.01, 0.6);
      p.distance = clamp(p.distance !== undefined ? p.distance : 1.9, 0.6, 3.5);
      p.room = clamp(p.room !== undefined ? p.room : 0.45, 0, 1);
      p.cue = clamp(p.cue !== undefined ? p.cue : 1, 0, 2);
      p.turns = clamp(p.turns !== undefined ? p.turns : 1.25, 0, 3);
      p.twist = clamp(p.twist || 0, -1, 1);
      p.innerSwirl = clamp(p.innerSwirl !== undefined ? p.innerSwirl : 0.5, 0, 1);
      p.fountainBreaths = clamp(Math.round(p.fountainBreaths || 6), 1, 40);
      p.spiralBreaths = clamp(Math.round(p.spiralBreaths || 6), 1, 40);
      if (!['structural', 'measured', 'hrtf'].includes(p.renderer)) p.renderer = 'structural';
      if (p.earModel === undefined) p.earModel = null;
    }

    // ---------------------------------------------------------------- buffers & waves
    _pinkNoise(seconds) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      // cross-fade the loop point
      const fade = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < fade; i++) {
        const a = i / fade;
        d[i] = d[i] * a + d[len - fade + i] * (1 - a);
      }
      return buf;
    }

    /** Glottal-like source spectrum: all harmonics, falling ~8 dB per octave (warm, not buzzy). */
    _voiceWave() {
      const n = 48;
      const real = new Float32Array(n + 1);
      const imag = new Float32Array(n + 1);
      for (let h = 1; h <= n; h++) imag[h] = Math.pow(h, -1.35);
      return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    }

    // ---------------------------------------------------------------- per-stream generator graph
    _buildStream(k) {
      const ctx = this.ctx;
      const s = { k, nextGrain: 0, lastPos: { x: 0, y: 0, z: -1.5, w: 0 }, note: -1, base: null, arp: 0 };
      s.out = ctx.createGain();
      s.out.gain.value = 0;
      s.out.connect(this.renderer.input(this.slots[k]));

      // breath / air: pink noise through soft (low-Q) vowel resonances
      s.noise = ctx.createBufferSource();
      s.noise.buffer = this.noiseBuf;
      s.noise.loop = true;
      s.nHP = ctx.createBiquadFilter();
      s.nHP.type = 'highpass';
      s.nHP.frequency.value = 140;
      const bp = (f, q) => {
        const b = ctx.createBiquadFilter();
        b.type = 'bandpass';
        b.frequency.value = f;
        b.Q.value = q;
        return b;
      };
      s.nF1 = bp(600, 1.2);
      s.nF2 = bp(1500, 1.6);
      s.nAir = bp(4500, 0.7);
      s.nG1 = ctx.createGain(); s.nG1.gain.value = 1.0;
      s.nG2 = ctx.createGain(); s.nG2.gain.value = 0.7;
      s.nG3 = ctx.createGain(); s.nG3.gain.value = 0.35;
      s.breathVCA = ctx.createGain();
      s.breathVCA.gain.value = 0;
      s.noise.connect(s.nHP);
      s.nHP.connect(s.nF1); s.nF1.connect(s.nG1); s.nG1.connect(s.breathVCA);
      s.nHP.connect(s.nF2); s.nF2.connect(s.nG2); s.nG2.connect(s.breathVCA);
      s.nHP.connect(s.nAir); s.nAir.connect(s.nG3); s.nG3.connect(s.breathVCA);
      s.breathVCA.connect(s.out);

      // warm voice: three slightly detuned voices (chorus), each with its own vibrato, through a
      // low-pass and three vowel formants. The low harmonics are kept (no narrow band-pass), so the
      // tone stays full and round at every height.
      s.vMix = ctx.createGain();
      s.vMix.gain.value = 0.42;
      s.voices = [-7, 1, 8].map((cents, v) => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this.wave);
        o.frequency.value = this._ladderHz(VOICE_OFFSETS[k]);
        o.detune.value = cents + (Math.random() - 0.5) * 3;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.3 + 0.55 * v + 0.17 * k + Math.random() * 0.3;
        const depth = ctx.createGain();
        depth.gain.value = 6;
        lfo.connect(depth);
        depth.connect(o.detune);
        o.connect(s.vMix);
        return { o, lfo, depth };
      });
      const filt = (type, f, q, gain) => {
        const b = ctx.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        b.Q.value = q;
        if (gain !== undefined) b.gain.value = gain;
        return b;
      };
      s.vLP = filt('lowpass', 2000, 0.6);
      s.vF1 = filt('peaking', 500, 3.0, 9);
      s.vF2 = filt('peaking', 1100, 4.5, 8);
      s.vF3 = filt('peaking', 2450, 5.0, 3);
      s.vHP = filt('highpass', 85, 0.7);
      s.harmVCA = ctx.createGain();
      s.harmVCA.gain.value = 0;
      s.vMix.connect(s.vLP);
      s.vLP.connect(s.vF1);
      s.vF1.connect(s.vF2);
      s.vF2.connect(s.vF3);
      s.vF3.connect(s.vHP);
      s.vHP.connect(s.harmVCA);
      s.harmVCA.connect(s.out);

      // one-shot grains (harp notes, droplets, bowl strikes, chimes, test bursts)
      s.grains = ctx.createGain();
      s.grains.gain.value = 1;
      s.grains.connect(s.out);

      const t = ctx.currentTime;
      s.noise.start(t, Math.random() * 5);
      s.voices.forEach(({ o, lfo }) => { o.start(t); lfo.start(t); });
      return s;
    }

    _root() {
      return this.engine.params.root || 108;
    }

    /** frequency of ladder position i (clamped) */
    _ladderHz(i) {
      const j = clamp(Math.round(i), 0, LADDER.length - 1);
      return (this._root() / 2) * LADDER[j];
    }

    _applyPalette(initial) {
      const p = this.params;
      const now = this.ctx.currentTime;
      const vib = p.palette === 'choir' ? 11 : p.palette === 'breath' ? 6 : 4;
      this.streams.forEach((s) => {
        s.nextGrain = 0;
        s.note = -1; // forces the pitch to be set again (tonal centre may have changed)
        s.base = null;
        s.voices.forEach(({ depth }) => depth.gain.setTargetAtTime(vib, now, initial ? 0.001 : 0.1));
      });
    }

    // ---------------------------------------------------------------- trajectories
    _rebalState(phase) {
      const p = this.params;
      const st = this.breath.state(phase);
      let mode = p.rebalMode;
      let offset = 0;
      let label = '';
      if (mode === 'program') {
        if (this.rebalStart === null) this.rebalStart = Math.floor(phase);
        const c = st.cycle - this.rebalStart;
        const nf = p.fountainBreaths, ns = p.spiralBreaths;
        if (c < nf) {
          mode = 'fountain';
          label = `Fountain ${c + 1}/${nf}`;
        } else if (c < nf + ns) {
          mode = 'spiral';
          label = `Spiral ${c - nf + 1}/${ns}`;
        } else {
          mode = 'balloon';
          offset = smooth(0, 2, phase - (this.rebalStart + nf + ns));
          label = 'Balloon (sustained)';
        }
      } else {
        label = mode === 'fountain' ? 'Fountain' : mode === 'spiral' ? 'Spiral' : 'Balloon (sustained)';
        if (mode === 'balloon') offset = 1;
      }
      return { st, mode, offset, label };
    }

    _streamPositions(t, phase) {
      const p = this.params;
      const n = p.trajectory === 'manual' || p.trajectory === 'test' ? 1 : p.count;
      const L = p.distance;
      const res = { n, streams: [], label: '', stage: null, mode: null, st: null };
      if (p.trajectory === 'rebal') {
        const rs = this._rebalState(phase);
        res.mode = rs.mode;
        res.st = rs.st;
        res.label = rs.label;
        for (let k = 0; k < n; k++) {
          let st = rs.st;
          let rotate = 0;
          if (rs.mode === 'balloon') {
            st = this.breath.state(phase + (rs.offset * k) / n);
            rotate = 0.07 * TAU * phase; // slow drift of the whole field
          }
          const pos = rebalPosition(st, k, rs.mode === 'balloon' ? 'fountain' : rs.mode, {
            L, n, turns: p.turns, twist: p.twist, rotate, innerSwirl: p.innerSwirl
          });
          pos.st = st;
          res.streams.push(pos);
        }
        res.stage = rs.st.stage;
        return res;
      }
      const P = this.phase;
      for (let k = 0; k < n; k++) {
        let x = 0, y = 0, z = -L;
        if (p.trajectory === 'orbit') {
          const th = TAU * (P + k / n);
          const el = 0.12 * Math.sin(TAU * 0.37 * P + k * 1.7);
          x = L * Math.cos(el) * Math.sin(th);
          y = L * Math.sin(el);
          z = -L * Math.cos(el) * Math.cos(th);
        } else if (p.trajectory === 'vertical') {
          const ph = TAU * (P + k / (2 * n));
          const planeAz = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4, Math.PI / 8, -Math.PI / 8][k];
          const horiz = L * Math.cos(ph);
          x = horiz * Math.sin(planeAz);
          y = L * Math.sin(ph);
          z = -horiz * Math.cos(planeAz);
        } else if (p.trajectory === 'sphere') {
          const az = TAU * (0.6 * P + k / n) + 0.9 * Math.sin(TAU * 0.23 * P + k);
          const el = 1.05 * Math.sin(TAU * 0.31 * P + 2.1 * k);
          const r = L * (0.8 + 0.25 * Math.sin(TAU * 0.17 * P + k));
          x = r * Math.cos(el) * Math.sin(az);
          y = r * Math.sin(el);
          z = -r * Math.cos(el) * Math.cos(az);
        } else if (p.trajectory === 'test') {
          const idx = Math.floor(t / 2.6) % TEST_POINTS.length;
          const tp = TEST_POINTS[idx];
          const a = (tp.az * Math.PI) / 180, e = (tp.el * Math.PI) / 180;
          const d = Math.max(1.2, L);
          x = d * Math.cos(e) * Math.sin(a);
          y = d * Math.sin(e);
          z = -d * Math.cos(e) * Math.cos(a);
          res.label = `Localisation check: ${tp.name}`;
          res.testIndex = idx;
        } else if (p.trajectory === 'manual') {
          const m = p.manualPos || this.lastManual || { x: 0, y: 0, z: -L };
          x = m.x; y = m.y; z = m.z;
          this.lastManual = { x, y, z };
          res.label = 'Hold still: drag on the views to move the source';
        }
        res.streams.push({ x, y, z, w: 0, path: 'free', s: 0 });
      }
      return res;
    }

    // ---------------------------------------------------------------- sound modulation
    _brightness(y) {
      return clamp((y + 2.1) / 3.5, 0, 1); // 0 under the feet .. 1 high above the head
    }

    /** ladder position of stream k at brightness b (with hysteresis, so notes do not flicker) */
    _noteIndex(s, k, b, n) {
      let maxOff = 0;
      for (let i = 0; i < n; i++) maxOff = Math.max(maxOff, VOICE_OFFSETS[i]);
      const span = LADDER.length - 1 - maxOff;
      const target = b * span;
      if (s.base === null || Math.abs(target - s.base) > 0.65) s.base = clamp(Math.round(target), 0, span);
      return s.base + VOICE_OFFSETS[k];
    }

    _vowel(b) {
      const x = clamp(b, 0, 1) * (VOWELS.length - 1);
      const i = Math.min(VOWELS.length - 2, Math.floor(x));
      const t = x - i;
      const e = t * t * (3 - 2 * t);
      return [0, 1, 2].map((j) => VOWELS[i][j] + (VOWELS[i + 1][j] - VOWELS[i][j]) * e);
    }

    _modulate(s, k, pos, res, t, gate) {
      const p = this.params;
      const pal = p.palette;
      const b = this._brightness(pos.y);
      const isRebal = p.trajectory === 'rebal';
      const st = pos.st || null;
      const lung = isRebal && st ? st.lung : this.breath.state(this.breath.phase).lung;
      // breath envelope & overall energy
      let breathLvl = 0.35 + 0.25 * lung;
      let harmLvl = 0.55;
      let bright = b;
      if (isRebal && st) {
        const balloon = res.mode === 'balloon';
        if (st.stage === 'exhale') {
          const a = (1 - Math.exp(-10 * st.p)) * (1 - 0.55 * st.p);
          breathLvl = balloon ? 0.32 + 0.12 * a : 0.15 + 0.7 * a;
          harmLvl = 0.5 + 0.35 * (1 - st.p);
        } else if (st.stage === 'inhale') {
          const a = Math.pow(Math.sin(Math.PI * st.p), 0.9);
          breathLvl = balloon ? 0.32 + 0.12 * a : 0.12 + 0.75 * a;
          harmLvl = 0.4 + 0.6 * st.p;
          bright = clamp(0.25 + 0.75 * st.p, b, 1);
        } else if (st.stage === 'holdIn') {
          breathLvl = 0.06;
          harmLvl = 0.85;
        } else {
          breathLvl = 0.04;
          harmLvl = 0.3;
        }
        if (balloon) {
          const swell = 0.75 + 0.25 * this.breath.state(this.breath.phase).lung;
          breathLvl *= swell;
          harmLvl *= swell;
        }
      }
      // palette mix: breath noise and warm voices
      let gBreath = 0, gVoice = 0;
      if (pal === 'breath') { gBreath = 0.5 * breathLvl; gVoice = 0.36 * harmLvl; }
      else if (pal === 'choir') { gBreath = 0.1 * breathLvl; gVoice = 0.5 * harmLvl; }
      else if (pal === 'harp') { gBreath = 0.22 * breathLvl; gVoice = 0.07 * harmLvl; }
      else if (pal === 'water') { gBreath = 0.2 * (0.5 + 0.5 * breathLvl); }
      else if (pal === 'bowl') { gBreath = 0.03; }
      else { gBreath = 0.06 * breathLvl; }
      if (p.trajectory === 'test') { gBreath = 0; gVoice = 0; } // localisation check: bursts only

      // pitch: consonant ladder position from height; glide between notes like a singer
      const idx = this._noteIndex(s, k, bright, res.n);
      if (idx !== s.note) {
        const f = this._ladderHz(idx);
        const glide = s.note < 0 ? 0.001 : pal === 'choir' ? 0.09 : 0.06;
        s.voices.forEach(({ o }) => o.frequency.setTargetAtTime(f, t, glide));
        s.note = idx;
      }
      // timbre follows height: dark "oo" under the feet, open "ah"/"ae" above the head
      const [v1, v2, v3] = this._vowel(bright);
      const lp = 900 + 4300 * Math.pow(bright, 1.2);
      const f1 = pal === 'water' ? 900 + 2600 * bright : 380 + 520 * bright;
      const f2 = pal === 'water' ? 2400 + 3000 * bright : 950 + 1750 * bright;
      const fAir = 3000 + 5000 * bright;

      const R = (prm, v) => prm.linearRampToValueAtTime(v, t);
      R(s.nF1.frequency, f1);
      R(s.nF2.frequency, f2);
      R(s.nAir.frequency, fAir);
      // the air band keeps enough 3-10 kHz energy for the ear's elevation and front/back cues
      R(s.nG3.gain, pal === 'water' ? 0.15 : 0.22 + 0.55 * bright);
      R(s.breathVCA.gain, gBreath * gate);
      R(s.vLP.frequency, lp);
      R(s.vF1.frequency, v1);
      R(s.vF2.frequency, v2);
      R(s.vF3.frequency, v3);
      R(s.harmVCA.gain, gVoice * gate);
      return { breathLvl, harmLvl, bright, idx };
    }

    // ---------------------------------------------------------------- one-shot grains
    _ping(dest, t, f, lvl, attack, decay) {
      const ctx = this.ctx;
      if (f > ctx.sampleRate * 0.45) return;
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + attack);
      g.gain.setTargetAtTime(0, t + attack, decay);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + attack + decay * 7);
    }

    /**
     * Harmonic tone with decaying partials: partial n has amplitude amps[n-1] and time constant decay / n^tilt.
     * Used for harp notes (fast decay of the upper partials), bowls and chimes. Only exact harmonics, so the
     * tone is pitched and consonant, never metallic.
     */
    _tone(dest, t, f, lvl, decay, amps, tilt, attack, beat) {
      const ctx = this.ctx;
      const fmax = Math.min(ctx.sampleRate * 0.45, 9000);
      const g = ctx.createGain();
      g.gain.value = lvl;
      g.connect(dest);
      let end = t;
      amps.forEach((a, i) => {
        const n = i + 1;
        const fn = f * n;
        if (!a || fn > fmax) return;
        const tau = decay / Math.pow(n, tilt);
        const add = (freq, amp) => {
          const o = ctx.createOscillator();
          o.frequency.value = freq;
          const e = ctx.createGain();
          e.gain.setValueAtTime(0, t);
          e.gain.linearRampToValueAtTime(amp, t + attack);
          e.gain.setTargetAtTime(0, t + attack, tau);
          o.connect(e);
          e.connect(g);
          o.start(t);
          o.stop(t + attack + tau * 7);
        };
        add(fn, a);
        if (beat && n <= beat.length && beat[n - 1]) add(fn + beat[n - 1], a * 0.6); // slow beating, as in a bowl
        end = Math.max(end, t + attack + tau * 7);
      });
      return g;
    }

    _pluck(dest, t, f, lvl, decay) {
      // harp-like: partials 1/n^1.5, upper partials die away first, soft finger noise for a clear onset
      const g = this._tone(dest, t, f, lvl, decay, [1, 0.36, 0.19, 0.12, 0.08, 0.06], 0.8, 0.004);
      this._noiseBurst(g, t, 0.01, 2400, 0.9, 0.12);
    }

    _noiseBurst(dest, t, dur, f, q, lvl) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = f;
      flt.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + 0.004);
      g.gain.setValueAtTime(lvl, t + Math.max(0.005, dur - 0.03));
      g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(flt);
      flt.connect(g);
      g.connect(dest);
      src.start(t, Math.random() * 4, dur + 0.05);
    }

    _grain(s, k, t, pos, info, res) {
      const pal = this.params.palette;
      const idx = info.idx;
      if (this.params.trajectory === 'test') {
        this._noiseBurst(s.grains, t, 0.16, 2500, 0.35, 0.9);
        return 0.25;
      }
      const expo = (rate) => -Math.log(1 - Math.random() * 0.97) / rate;
      if (pal === 'breath') {
        // sparse harp notes above the voices: chord tones, never a clash
        const f = this._ladderHz(idx + 2 + Math.floor(Math.random() * 3));
        this._pluck(s.grains, t, f, 0.035 + 0.025 * Math.random(), 0.55 + 0.4 * Math.random());
        return expo(0.25 + 0.9 * info.energy * info.energy);
      }
      if (pal === 'choir') return 1.0; // sustained voices only
      if (pal === 'harp') {
        // arpeggio that climbs while the stream rises and falls while it descends
        const dy = pos.y - s.lastPos.y;
        s.arp = (s.arp + (dy >= 0 ? 1 : -1) + 4) % 4;
        const f = this._ladderHz(Math.max(0, idx - 1) + s.arp);
        this._pluck(s.grains, t, f, 0.075 + 0.025 * Math.random(), 0.75 + 0.45 * Math.random());
        return 0.16 + 0.22 * (1 - info.energy) + 0.04 * Math.random();
      }
      if (pal === 'water') {
        // tuned droplets (Minnaert bubble chirp centred on a chord tone one octave up)
        const ctx = this.ctx;
        const note = 2 * this._ladderHz(idx + 1 + Math.floor(Math.random() * 3));
        const f0 = Math.min(note * 0.82, 5000);
        const dur = clamp(0.06 * (1500 / f0), 0.02, 0.09);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.52, t + dur);
        const g = ctx.createGain();
        const lvl = 0.1 + 0.1 * Math.random();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(lvl, t + 0.0015);
        g.gain.setTargetAtTime(0, t + 0.002, dur / 3);
        o.connect(g);
        g.connect(s.grains);
        o.start(t);
        o.stop(t + dur * 2.5);
        return expo(2.5 + 8 * info.energy);
      }
      if (pal === 'bowl') {
        // warm bowl: harmonic partials with slow beating, felt mallet
        const f0 = this._ladderHz(idx + 2);
        this._tone(s.grains, t, f0, 0.32, 6.0, [1, 0.3, 0.1], 0.9, 0.006, [0.6, 0.9, 0]);
        this._noiseBurst(s.grains, t, 0.018, 700, 0.7, 0.12);
        return 5 + Math.random() * 4;
      }
      // soft chimes (celesta): harmonic partials only, register follows height
      const f = 2 * this._ladderHz(idx + Math.floor(Math.random() * 3));
      this._tone(s.grains, t, f, 0.06 + 0.04 * Math.random(), 1.3, [1, 0.22, 0.06], 1.0, 0.0025);
      return 0.4 + expo(1.4);
    }

    _bloom(s, k, t) {
      // the fountain sprays out of the crown: a soft upward harp arpeggio over a gentle chord swell
      for (let i = 0; i < 5; i++) this._pluck(s.grains, t + i * 0.075, this._ladderHz(4 + i), 0.045, 1.1);
      const root = this._root();
      [4, 5, 6, 8].forEach((h, i) => this._ping(s.grains, t + i * 0.03, root * h / 2, 0.022, 0.14, 1.5));
    }

    _ground(s, t) {
      const root = this._root();
      this._ping(s.grains, t, root / 2, 0.2, 0.05, 0.6);
      this._pluck(s.grains, t, root, 0.07, 0.9);
    }

    // ---------------------------------------------------------------- main update
    tick(now, elapsed, isBg) {
      const p = this.params;
      const tSched = now + LOOKAHEAD;
      const dt = this.lastTick === null ? 0 : clamp(now - this.lastTick, 0, 0.25);
      this.lastTick = now;
      this.phase += dt * p.speed;

      if (!p.enabled) {
        if (!this._muted) {
          this.streams.forEach((s) => this._muteStream(s, now, 0.08));
          this._muted = true;
        }
        this.telemetry.spatialVoices.forEach((v) => { v.active = false; });
        this.telemetry.spatialStage.active = false;
        return;
      }
      this._muted = false;
      if (tSched - this.lastSched < UPDATE_DT) return;
      this.lastSched = tSched;

      const phase = this.breath.phase; // clock already advanced to tSched by the engine
      const res = this._streamPositions(tSched, phase);
      const n = res.n;
      const norm = 1 / Math.sqrt(n);
      const stageNow = res.stage;

      for (let k = 0; k < MAX_STREAMS; k++) {
        const s = this.streams[k];
        const active = k < n;
        const gate = active ? 1 : 0;
        if (!active) {
          if (s.on !== false) this._muteStream(s, now, 0.25);
          continue;
        }
        s.on = true;
        const pos = res.streams[k];
        // keep part of the 1/r distance cue but stop sources near the head from jumping 6-8 dB louder
        const dist = Math.hypot(pos.x, pos.y, pos.z);
        const ext = Math.cos(clamp(pos.w, 0, 1) * Math.PI / 2);
        const nearComp = lerp(1, clamp(Math.pow(dist / 1.0, 0.6), 0.5, 1), ext);
        s.out.gain.linearRampToValueAtTime(p.gain * norm * nearComp, tSched);
        this.renderer.setPosition(this.slots[k], pos.x, pos.y, pos.z, pos.w, tSched);
        const info = this._modulate(s, k, pos, res, tSched, gate);
        info.energy = clamp(0.35 * info.breathLvl + 0.65 * info.harmLvl, 0, 1);
        if (pos.st && pos.st.stage === 'exhale') info.energy = clamp(1.1 - pos.st.p, 0.2, 1);
        // grains for the window (lastGrain, tSched]
        if (s.nextGrain < now - 0.5 || s.nextGrain === 0) s.nextGrain = now + 0.05 + 0.13 * k;
        let guard = 0;
        while (s.nextGrain < tSched && guard++ < 16) {
          const tg = Math.max(s.nextGrain, now + 0.01);
          s.nextGrain = tg + this._grain(s, k, tg, pos, info, res);
        }
        s.lastPos = pos;
      }

      // stage transitions (REBAL): bloom at the crown, grounding at the soles
      if (p.trajectory === 'rebal' && res.st) {
        if (this.prevStage && this.prevStage !== stageNow) {
          if (stageNow === 'exhale' && ['breath', 'choir', 'harp'].includes(p.palette)) this._bloom(this.streams[0], 0, tSched);
          if (stageNow === 'inhale' && this.prevStage !== 'inhale' && p.palette !== 'chimes') this._ground(this.streams[0], tSched);
        }
        this.prevStage = stageNow;
      } else {
        this.prevStage = null;
      }

      // display frame (heard LOOKAHEAD seconds from now)
      this.frames.push({
        t: tSched,
        label: res.label,
        mode: res.mode,
        stage: res.st ? res.st.stage : null,
        p: res.st ? res.st.p : 0,
        cycle: res.st ? res.st.cycle : 0,
        testIndex: res.testIndex,
        streams: res.streams.map((q) => ({ x: q.x, y: q.y, z: q.z, w: q.w }))
      });
      if (this.frames.length > 60) this.frames.shift();
    }

    /** state heard at audio time t (interpolated between scheduled frames) */
    getDisplay(t) {
      const f = this.frames;
      if (!f.length) return null;
      let a = f[0], b = f[0];
      for (let i = f.length - 1; i >= 0; i--) {
        if (f[i].t <= t) { a = f[i]; b = f[Math.min(f.length - 1, i + 1)]; break; }
      }
      const u = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
      const streams = a.streams.map((s, k) => {
        const q = b.streams[k] || s;
        return { x: lerp(s.x, q.x, u), y: lerp(s.y, q.y, u), z: lerp(s.z, q.z, u), w: lerp(s.w, q.w, u) };
      });
      return { label: a.label, mode: a.mode, stage: a.stage, p: lerp(a.p, b.stage === a.stage ? b.p : a.p, u), cycle: a.cycle, testIndex: a.testIndex, streams };
    }

    meridian(steps = 64) {
      const L = this.params.distance;
      const pts = [];
      for (let i = 0; i <= steps; i++) pts.push(meridianAt(i / steps, L));
      return pts;
    }

    update(key, val) {
      const now = this.ctx.currentTime;
      this._normalize();
      const p = this.params;
      if (key === 'palette' || key === 'root') this._applyPalette(false);
      if (key === 'trajectory' || key === 'rebalMode' || key === 'count') {
        this.rebalStart = null;
        this.prevStage = null;
        this.frames.length = 0;
        if (key !== 'count') this.renderer.unprime();
      }
      if (key === 'renderer' || key === 'earModel') {
        if (p.earModel) this.renderer.earModel = p.earModel;
        this.renderer.setMode(p.renderer);
      }
      if (key === 'room' || key === 'cue' || key === 'enabled') this.applyRendererConfig();
      if (key === 'enabled' && !p.enabled) this.streams.forEach((s) => this._muteStream(s, now, 0.08));
    }

    _muteStream(s, now, tc) {
      holdAt(s.out.gain, now);
      s.out.gain.setTargetAtTime(0, now, tc);
      s.on = false;
    }

    applyRendererConfig() {
      const p = this.params;
      this.renderer.setConfig({ cue: p.cue, pinna: Math.min(1.3, 0.5 + 0.5 * p.cue), er: 0.18 + 0.8 * p.room, reverb: 0.08 + 0.55 * p.room, roomSize: 0.8 + 0.6 * p.room });
      // measured ear models: the same slider scales the fine spectral structure (1 = as measured)
      if (this.renderer.setEarCue && Math.abs(this.renderer.earK - p.cue) > 0.01) {
        clearTimeout(this._cueTimer);
        this._cueTimer = setTimeout(() => this.renderer.setEarCue(p.cue).catch(() => {}), 120);
      }
    }
  }

  Spatial3DModule.PALETTES = PALETTES;
  Spatial3DModule.LADDER = LADDER;
  Spatial3DModule.TRAJECTORIES = TRAJECTORIES;
  Spatial3DModule.REBAL_MODES = REBAL_MODES;
  Spatial3DModule.Y_CROWN = Y_CROWN;
  Spatial3DModule.Y_FEET = Y_FEET;
  Spatial3DModule.MAX_STREAMS = MAX_STREAMS;
  Spatial3DModule.LOOKAHEAD = LOOKAHEAD;
  Spatial3DModule.TEST_POINTS = TEST_POINTS;
  Spatial3DModule.geometry = { meridianAt, rebalPosition, exhaleInterior, inhaleInterior, baseAzimuth, windFrac, MERIDIAN, Y_CROWN, Y_FEET };

  global.Spatial3DModule = Spatial3DModule;
  global.AetherBreathClock = BreathClock;
})(typeof window !== 'undefined' ? window : globalThis);
