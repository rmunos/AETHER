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

  // Musical material: stream roots form an open major chord over the tonal centre
  const STREAM_RATIOS = [1, 1.5, 2, 2.5, 3, 4];
  const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2]; // just pentatonic (+ octave)

  const PALETTES = ['breath', 'choir', 'water', 'bowl', 'chimes'];
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
      this.wave = this._harmonicWave(32, 1.0);
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

    _harmonicWave(n, tilt) {
      const real = new Float32Array(n + 1);
      const imag = new Float32Array(n + 1);
      for (let h = 1; h <= n; h++) imag[h] = 1 / Math.pow(h, tilt);
      return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    }

    // ---------------------------------------------------------------- per-stream generator graph
    _buildStream(k) {
      const ctx = this.ctx;
      const s = { k, nextGrain: 0, lastPos: { x: 0, y: 0, z: -1.5, w: 0 } };
      s.out = ctx.createGain();
      s.out.gain.value = 0;
      s.out.connect(this.renderer.input(this.slots[k]));

      // breath / air (pink noise through formant-like resonances)
      s.noise = ctx.createBufferSource();
      s.noise.buffer = this.noiseBuf;
      s.noise.loop = true;
      s.nHP = ctx.createBiquadFilter();
      s.nHP.type = 'highpass';
      s.nHP.frequency.value = 140;
      s.nF1 = ctx.createBiquadFilter();
      s.nF1.type = 'bandpass';
      s.nF1.frequency.value = 600;
      s.nF1.Q.value = 1.4;
      s.nF2 = ctx.createBiquadFilter();
      s.nF2.type = 'bandpass';
      s.nF2.frequency.value = 1500;
      s.nF2.Q.value = 2.0;
      s.nAir = ctx.createBiquadFilter();
      s.nAir.type = 'bandpass';
      s.nAir.frequency.value = 4500;
      s.nAir.Q.value = 0.8;
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

      // harmonic source (overtone selector / vowel formants / warm body)
      s.osc = ctx.createOscillator();
      s.osc.setPeriodicWave(this.wave);
      s.osc.frequency.value = this._root() * STREAM_RATIOS[k];
      s.vib = ctx.createOscillator();
      s.vib.frequency.value = 4.6 + 0.37 * k;
      s.vibDepth = ctx.createGain();
      s.vibDepth.gain.value = 0;
      s.vib.connect(s.vibDepth);
      s.vibDepth.connect(s.osc.detune);
      s.sel = ctx.createBiquadFilter(); // overtone selector (moves with height)
      s.sel.type = 'bandpass';
      s.sel.frequency.value = 800;
      s.sel.Q.value = 11;
      s.selG = ctx.createGain(); s.selG.gain.value = 0;
      s.vF1 = ctx.createBiquadFilter();
      s.vF1.type = 'bandpass';
      s.vF1.frequency.value = 500;
      s.vF1.Q.value = 5;
      s.vF2 = ctx.createBiquadFilter();
      s.vF2.type = 'bandpass';
      s.vF2.frequency.value = 1200;
      s.vF2.Q.value = 7;
      s.vG1 = ctx.createGain(); s.vG1.gain.value = 0;
      s.vG2 = ctx.createGain(); s.vG2.gain.value = 0;
      s.body = ctx.createBiquadFilter();
      s.body.type = 'lowpass';
      s.body.frequency.value = 400;
      s.body.Q.value = 0.5;
      s.bodyG = ctx.createGain(); s.bodyG.gain.value = 0;
      s.harmVCA = ctx.createGain();
      s.harmVCA.gain.value = 0;
      s.osc.connect(s.sel); s.sel.connect(s.selG); s.selG.connect(s.harmVCA);
      s.osc.connect(s.vF1); s.vF1.connect(s.vG1); s.vG1.connect(s.harmVCA);
      s.osc.connect(s.vF2); s.vF2.connect(s.vG2); s.vG2.connect(s.harmVCA);
      s.osc.connect(s.body); s.body.connect(s.bodyG); s.bodyG.connect(s.harmVCA);
      s.harmVCA.connect(s.out);

      // one-shot grains (sparkles, droplets, strikes, bursts)
      s.grains = ctx.createGain();
      s.grains.gain.value = 1;
      s.grains.connect(s.out);

      const t = ctx.currentTime;
      s.noise.start(t, Math.random() * 5);
      s.osc.start(t);
      s.vib.start(t);
      return s;
    }

    _root() {
      return this.engine.params.root || 108;
    }

    _applyPalette(initial) {
      const p = this.params;
      const now = this.ctx.currentTime;
      const choir = p.palette === 'choir';
      this.streams.forEach((s, k) => {
        s.nextGrain = 0;
        s.osc.frequency.setTargetAtTime(this._root() * STREAM_RATIOS[k], now, initial ? 0.001 : 0.08);
        s.vibDepth.gain.setTargetAtTime(choir ? 9 : 2.5, now, 0.1);
        s.sel.Q.setTargetAtTime(p.palette === 'breath' ? 11 : 6, now, 0.1);
        s.vF1.Q.value = 5;
        s.vF2.Q.value = 8;
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

    _modulate(s, k, pos, res, t, gate) {
      const p = this.params;
      const pal = p.palette;
      const root = this._root() * STREAM_RATIOS[k];
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
          harmLvl = 0.45 + 0.35 * (1 - st.p);
        } else if (st.stage === 'inhale') {
          const a = Math.pow(Math.sin(Math.PI * st.p), 0.9);
          breathLvl = balloon ? 0.32 + 0.12 * a : 0.12 + 0.75 * a;
          harmLvl = 0.3 + 0.7 * st.p;
          bright = clamp(0.25 + 0.75 * st.p, b, 1);
        } else if (st.stage === 'holdIn') {
          breathLvl = 0.06;
          harmLvl = 0.85;
        } else {
          breathLvl = 0.04;
          harmLvl = 0.25;
        }
        if (balloon) {
          const swell = 0.75 + 0.25 * this.breath.state(this.breath.phase).lung;
          breathLvl *= swell;
          harmLvl *= swell;
        }
      }
      // palette-specific gains
      let gBreath = 0, gSel = 0, gV1 = 0, gV2 = 0, gBody = 0;
      if (pal === 'breath') {
        gBreath = 0.55 * breathLvl;
        gSel = 1.0;
        gBody = 0.07;
      } else if (pal === 'choir') {
        gBreath = 0.12 * breathLvl;
        gV1 = 0.9; gV2 = 0.55; gBody = 0.1;
      } else if (pal === 'water') {
        gBreath = 0.22 * (0.5 + 0.5 * breathLvl);
        harmLvl = 0;
      } else if (pal === 'bowl') {
        gBreath = 0.03;
        harmLvl = 0;
      } else {
        gBreath = 0.06 * breathLvl;
        harmLvl = 0;
      }
      // filters follow height: dark & low under the feet, bright & high above the head
      const f1 = pal === 'water' ? 900 + 2600 * bright : 380 + 520 * bright;
      const f2 = pal === 'water' ? 2400 + 3000 * bright : 950 + 1750 * bright;
      const fAir = 2400 + 5200 * bright;
      const sel = clamp(180 * Math.pow(3600 / 180, bright), 120, 4200);
      const selGain = gSel * 3.2 * Math.pow(Math.max(1, sel / root), 0.55);
      // vowel: "oo" below -> "ah" at ear level -> "ee" above
      const v1 = bright < 0.5 ? lerp(320, 720, bright * 2) : lerp(720, 330, (bright - 0.5) * 2);
      const v2 = bright < 0.5 ? lerp(780, 1150, bright * 2) : lerp(1150, 2350, (bright - 0.5) * 2);

      const R = (prm, v) => prm.linearRampToValueAtTime(v, t);
      R(s.nF1.frequency, f1);
      R(s.nF2.frequency, f2);
      R(s.nAir.frequency, fAir);
      R(s.nG3.gain, pal === 'water' ? 0.15 : 0.12 + 0.45 * bright);
      R(s.breathVCA.gain, gBreath * gate);
      R(s.sel.frequency, sel);
      R(s.selG.gain, selGain);
      R(s.vF1.frequency, v1);
      R(s.vF2.frequency, v2);
      R(s.vG1.gain, gV1 * 2.2);
      R(s.vG2.gain, gV2 * 2.8);
      R(s.body.frequency, root * (1.5 + 2 * bright));
      R(s.bodyG.gain, gBody);
      R(s.harmVCA.gain, 0.42 * harmLvl * gate);
      return { breathLvl, harmLvl, bright };
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

    _nearestHarmonic(root, f) {
      return root * Math.max(1, Math.round(f / root));
    }

    _grain(s, k, t, pos, info, res) {
      const pal = this.params.palette;
      const root = this._root() * STREAM_RATIOS[k];
      const b = info.bright;
      if (this.params.trajectory === 'test') {
        this._noiseBurst(s.grains, t, 0.16, 2500, 0.35, 0.9);
        return 0.25;
      }
      if (pal === 'breath' || pal === 'choir') {
        const target = 600 * Math.pow(9, b) * (Math.random() < 0.5 ? 1 : 1.5);
        const f = this._nearestHarmonic(root, target);
        this._ping(s.grains, t, f, 0.05 + 0.05 * Math.random(), 0.003, 0.08 + 0.18 * Math.random());
        const rate = pal === 'choir' ? 0.6 : 1.2 + 9 * Math.pow(info.energy, 2);
        return -Math.log(1 - Math.random() * 0.97) / rate;
      }
      if (pal === 'water') {
        // Minnaert bubble: exponentially rising sine, pitch follows height
        const ctx = this.ctx;
        const f0 = (500 + 2200 * b) * Math.pow(1.6, Math.random() - 0.5);
        const dur = clamp(0.06 * (1500 / f0), 0.02, 0.09);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * (1.35 + 0.4 * Math.random()), t + dur);
        const g = ctx.createGain();
        const lvl = 0.12 + 0.12 * Math.random();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(lvl, t + 0.0008);
        g.gain.setTargetAtTime(0, t + 0.001, dur / 3);
        o.connect(g);
        g.connect(s.grains);
        o.start(t);
        o.stop(t + dur * 2.5);
        const rate = 3 + 10 * info.energy;
        return -Math.log(1 - Math.random() * 0.97) / rate;
      }
      if (pal === 'bowl') {
        const f0 = root * 2;
        [[1, 0.5, 5.5, 0.55], [2.71, 0.2, 3.0, 1.1], [5.15, 0.08, 1.6, 0], [8.43, 0.035, 0.8, 0]].forEach(([r, a, d, beat]) => {
          this._ping(s.grains, t, f0 * r, a * 0.6, 0.004, d);
          if (beat) this._ping(s.grains, t, f0 * r + beat, a * 0.4, 0.004, d * 0.9);
        });
        this._noiseBurst(s.grains, t, 0.012, 2500, 0.7, 0.2);
        return 5 + Math.random() * 4;
      }
      // chimes: just-pentatonic glass, register follows height
      const oct = b < 0.33 ? 2 : b < 0.66 ? 4 : 8;
      const f = this._root() * oct * PENTA[Math.floor(Math.random() * PENTA.length)];
      const lvl = 0.08 + 0.05 * Math.random();
      [[1, 1, 1.3], [2.0, 0.3, 0.6], [3.01, 0.12, 0.35], [4.2, 0.05, 0.2]].forEach(([r, a, d]) => this._ping(s.grains, t, f * r, lvl * a, 0.0015, d));
      return 0.35 + -Math.log(1 - Math.random() * 0.97) * 0.7;
    }

    _bloom(s, k, t) {
      // soft chord swell as the energy leaves the crown
      const root = this._root();
      [4, 5, 6, 8].forEach((h, i) => this._ping(s.grains, t + i * 0.03, root * h, 0.035, 0.12, 1.4));
    }

    _ground(s, t) {
      const root = this._root();
      this._ping(s.grains, t, root / 2, 0.22, 0.05, 0.6);
      this._ping(s.grains, t, root, 0.1, 0.04, 0.5);
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
          if (stageNow === 'exhale' && (p.palette === 'breath' || p.palette === 'choir')) this._bloom(this.streams[0], 0, tSched);
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
      this.renderer.setConfig({ cue: p.cue, pinna: Math.min(1.3, 0.5 + 0.5 * p.cue), er: 0.25 + 1.1 * p.room, reverb: 0.08 + 0.55 * p.room, roomSize: 0.8 + 0.6 * p.room });
      // measured ear models: the same slider scales the fine spectral structure (1 = as measured)
      if (this.renderer.setEarCue && Math.abs(this.renderer.earK - p.cue) > 0.01) {
        clearTimeout(this._cueTimer);
        this._cueTimer = setTimeout(() => this.renderer.setEarCue(p.cue).catch(() => {}), 120);
      }
    }
  }

  Spatial3DModule.PALETTES = PALETTES;
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
