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
 *   inhale  : the energy rises from the soles up the front of the body (about 35 cm in front of it, so that the
 *             ears hear it climb from below to the face) and enters the head;
 *   exhale  : it leaves the crown upwards (fountain, leaning slightly forward), arcs over, flows down around the
 *             body on the outside of an apple-shaped torus, curls under the feet and re-enters through the soles;
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

  const MAX_STREAMS = 4; // one stream per direction: front, right, back, left
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

  // Sounds keep the same pitch and timbre wherever they are: only the position moves, so the ears' own
  // direction cues do the work. Pitched palettes hold fixed chord notes, harmonics of (tonal centre / 2):
  // stream k plays CHORD[k] (2 streams = root + fifth, 4 = a major chord).
  const CHORD = [4, 6, 5, 8, 3, 2];
  const HARP_NOTES = [4, 5, 6, 8, 10, 12];
  const CHIME_NOTES = [4, 5, 6, 8, 10, 12];

  // Each stream has a direction (0 front, 1 right, 2 back, 3 left: the cardinal direction it flows down on) and a
  // sound tied to it, so the four streams can be told apart and followed. Palette 'quad' (default) gives each
  // direction its own kind of sound; the single-sound palettes vary a fixed detail per direction.
  const DIR_NAMES = ['front', 'right', 'back', 'left'];
  const QUAD_KINDS = ['breath', 'waves', 'voice', 'harp'];
  const QUAD_LABELS = ['breath', 'water', 'voice', 'harp'];
  const QUAD_TRIM = { breath: 1.0, waves: 1.0, voice: 1.0, harp: 1.0 }; // loudness match between the four kinds (measured: within 1 dB)
  // Level trims per palette after the v6.5 reverb calibration (until v6.4 an over-loud room reverb carried the level)
  const PALETTE_TRIM = { quad: 1.5, breath: 1.5, waves: 1.68, choir: 1.41, harp: 3.2, water: 9.0, bowl: 2.0, chimes: 7.8 };
  const TEST_TRIM = 3.3;
  const DIR_NOTE = [4, 6, 3, 5]; // chord note per direction (harmonics of root/2): front 2x, right 3x, back 1.5x, left 2.5x root
  const BREATH_VOWEL = [[0, 0], [-260, 900], [-250, -420], [-120, 500]]; // F1/F2 offsets: "haa", "hee", "hoo", "heh"
  const WAVE_VARIANT = [
    { cut: 1.0, foam: 0.7 }, // front: smooth wash
    { cut: 1.5, foam: 1.6 }, // right: bubbling
    { cut: 0.5, foam: 0.35 }, // back: deep surf
    { cut: 1.25, foam: 2.4 } // left: spray
  ];

  // REBAL inhale path in front of the body and forward lean of the fountain jet (metres)
  const INHALE_FWD = 0.36;
  const INHALE_SWAY = 0.22; // lateral sway amplitude for innerSwirl = 1
  const SPIRAL_COIL = 0.34; // radius of the rising coil in the spiral pattern
  const JET_LEAN = 0.25;

  const PALETTES = ['quad', 'breath', 'waves', 'choir', 'harp', 'water', 'bowl', 'chimes'];
  const TRAJECTORIES = ['rebal', 'orbit', 'vertical', 'sphere', 'test', 'manual'];
  const REBAL_MODES = ['program', 'fountain', 'spiral', 'balloon'];
  const PALETTE_ALIASES = { four: 'quad', directions: 'quad', energy: 'breath', rebal: 'breath', drops: 'water', water_drops: 'water', wave: 'waves', surf: 'waves', whisper: 'breath', crackle: 'chimes', tapping: 'chimes' };
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

  /** interior weight along the outer path: inside the head at the start, outside after the crown */
  function exhaleInterior(s) {
    return 1 - smooth(0.0, 0.16, s) + 0.06 * smooth(0.9, 1.0, s);
  }
  /** interior weight during the inhale: outside (localisable) until the energy enters the head */
  function inhaleInterior(p) {
    return 0.06 + 0.94 * smooth(0.8, 0.97, p);
  }
  /** envelope of the excursion away from the body axis during the inhale (0 at the soles and at the crown) */
  function inhaleEnv(p) {
    return smooth(0, 0.14, p) * (1 - smooth(0.78, 1.0, p));
  }
  function inhaleY(p) {
    return Y_FEET + (Y_CROWN - Y_FEET) * (p * p * (3 - 2 * p));
  }
  function inhaleOffset(p) {
    return INHALE_FWD * inhaleEnv(p);
  }
  function inhaleSway(p, swirl) {
    return INHALE_SWAY * swirl * Math.sin(TAU * 1.25 * p) * inhaleEnv(p);
  }
  /** common forward lean of the fountain jet (all streams), metres in front of the body axis */
  function jetLean(s) {
    return JET_LEAN * smooth(0.02, 0.16, s) * (1 - smooth(0.3, 0.55, s));
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
      out.z = -m.r * Math.cos(az) - jetLean(s); // a slight forward lean: directly overhead is ambiguous to the ear
      out.y = m.y;
      out.w = exhaleInterior(s);
      out.path = 'outer';
      out.s = s;
      out.az = az;
      return out;
    }
    if (st.stage === 'inhale') {
      // On the body axis every point below the head is straight down from the ears (elevation -90 deg), so a
      // rise along the spine cannot be heard. The energy therefore rises a little in front of the body, sweeping
      // from below (-85 deg) to the face (~0 deg), then enters the head.
      const p = st.p;
      const y = inhaleY(p);
      let az = az0;
      if (mode === 'spiral') {
        const r = SPIRAL_COIL * inhaleEnv(p);
        az = az0 + turns * TAU + 1.5 * TAU * p; // keeps turning the same way, coiling up around the body
        out.x = r * Math.sin(az);
        out.z = -r * Math.cos(az);
      } else {
        out.x = inhaleSway(p, opts.innerSwirl || 0);
        out.z = -inhaleOffset(p);
      }
      out.y = y;
      out.w = inhaleInterior(p);
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
    out.w = inhaleInterior(0);
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
      this.foamBuf = this._foamBuffer(6);
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
      p.intensity = clamp(p.intensity !== undefined ? p.intensity : 0.6, 0, 1);
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
      // glottal-like source spectrum: all harmonics, falling ~8 dB per octave (warm, not buzzy)
      const n = 48;
      const real = new Float32Array(n + 1);
      const imag = new Float32Array(n + 1);
      for (let h = 1; h <= n; h++) imag[h] = Math.pow(h, -1.35);
      return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    }

    /**
     * Foam: thousands of tiny bubbles (exponentially rising sine chirps, 1-5 kHz) and fizz (short bursts of
     * bright noise) at random times and pitches, as in breaking waves. Loops seamlessly.
     */
    _foamBuffer(seconds) {
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * seconds);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const grains = Math.floor(650 * seconds);
      for (let g = 0; g < grains; g++) {
        const start = Math.floor(Math.random() * len);
        const amp = Math.pow(Math.random(), 2.2);
        if (Math.random() < 0.55) {
          const f0 = 1000 * Math.pow(5, Math.random());
          const dur = Math.floor(sr * (0.003 + 0.012 * Math.random()));
          let ph = 0;
          for (let i = 0; i < dur; i++) {
            const t = i / dur;
            ph += (2 * Math.PI * f0 * (1 + 0.5 * t)) / sr;
            d[(start + i) % len] += amp * 0.5 * Math.sin(ph) * Math.exp(-5 * t) * Math.min(1, i / 8);
          }
        } else {
          const dur = Math.floor(sr * (0.001 + 0.006 * Math.random()));
          let prev = 0;
          for (let i = 0; i < dur; i++) {
            const w = Math.random() * 2 - 1;
            d[(start + i) % len] += amp * 0.35 * (w - prev) * Math.exp((-4 * i) / dur);
            prev = w;
          }
        }
      }
      let e = 0;
      for (let i = 0; i < len; i++) e += d[i] * d[i];
      const gn = 0.1 / Math.sqrt(e / len + 1e-12);
      for (let i = 0; i < len; i++) d[i] *= gn;
      return buf;
    }

    // ---------------------------------------------------------------- per-stream generator graph
    _buildStream(k) {
      const ctx = this.ctx;
      const s = { k, nextGrain: 0, lastPos: { x: 0, y: 0, z: -1.5, w: 0 }, ih: 0, dir: k % 4, dirTuned: -1 };
      s.out = ctx.createGain();
      s.out.gain.value = 0;
      s.out.connect(this.renderer.input(this.slots[k]));
      const filt = (type, f, q, gain) => {
        const b = ctx.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        b.Q.value = q;
        if (gain !== undefined) b.gain.value = gain;
        return b;
      };
      const amp = (v) => {
        const g = ctx.createGain();
        g.gain.value = v;
        return g;
      };

      // ---- breath: pink noise -> soft vocal-tract resonances + air band + high air (6-14 kHz: the ear's
      //      elevation and front/back cues live there). The spectrum depends only on inhale/exhale, never on height.
      s.noise = ctx.createBufferSource();
      s.noise.buffer = this.noiseBuf;
      s.noise.loop = true;
      s.nHP = filt('highpass', 120, 0.7);
      s.nF1 = filt('bandpass', 620, 1.1);
      s.nF2 = filt('bandpass', 1250, 1.4);
      s.nAir = filt('bandpass', 3800, 0.7);
      s.nHi = filt('highpass', 6500, 0.6);
      s.nG1 = amp(1.0); s.nG2 = amp(0.7); s.nG3 = amp(0.45); s.nG4 = amp(0.28);
      s.breathVCA = amp(0);
      s.noise.connect(s.nHP);
      [[s.nF1, s.nG1], [s.nF2, s.nG2], [s.nAir, s.nG3], [s.nHi, s.nG4]].forEach(([f, g]) => {
        s.nHP.connect(f);
        f.connect(g);
        g.connect(s.breathVCA);
      });
      // turbulence: a slow, irregular flutter of the breath level
      s.flutter = amp(1);
      s.breathVCA.connect(s.flutter);
      s.flutter.connect(s.out);
      s.lfos = [[1.7 + 0.13 * k, 0.09], [4.3 + 0.21 * k, 0.05]].map(([f, depth]) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const d = amp(depth);
        o.connect(d);
        d.connect(s.flutter.gain);
        return o;
      });

      // ---- water waves: low-passed noise (the body of the wave) + bubbly foam
      s.wLP = filt('lowpass', 1500, 0.5);
      s.wBody = amp(0);
      s.nHP.connect(s.wLP);
      s.wLP.connect(s.wBody);
      s.foam = ctx.createBufferSource();
      s.foam.buffer = this.foamBuf;
      s.foam.loop = true;
      s.fHP = filt('highpass', 900, 0.6);
      s.foamG = amp(0);
      s.foam.connect(s.fHP);
      s.fHP.connect(s.foamG);
      s.waveVCA = amp(0);
      s.wBody.connect(s.waveVCA);
      s.foamG.connect(s.waveVCA);
      s.waveVCA.connect(s.out);

      // ---- choir: a fixed chord note per stream, chorus of three detuned voices with their own vibrato,
      //      low-pass and fixed vowel formants ("ah")
      s.vMix = amp(0.42);
      s.voices = [-7, 1, 8].map((cents, v) => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this.wave);
        o.frequency.value = (this._root() / 2) * DIR_NOTE[k % 4];
        o.detune.value = cents + (Math.random() - 0.5) * 3;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.3 + 0.55 * v + 0.17 * k + Math.random() * 0.3;
        const depth = amp(6);
        lfo.connect(depth);
        depth.connect(o.detune);
        o.connect(s.vMix);
        return { o, lfo, depth };
      });
      s.vLP = filt('lowpass', 2600, 0.6);
      s.vF1 = filt('peaking', 650, 3.0, 9);
      s.vF2 = filt('peaking', 1080, 4.5, 8);
      s.vF3 = filt('peaking', 2450, 5.0, 3);
      s.vHP = filt('highpass', 85, 0.7);
      s.harmVCA = amp(0);
      s.vMix.connect(s.vLP);
      s.vLP.connect(s.vF1);
      s.vF1.connect(s.vF2);
      s.vF2.connect(s.vF3);
      s.vF3.connect(s.vHP);
      s.vHP.connect(s.harmVCA);
      s.harmVCA.connect(s.out);

      // ---- one-shot grains (harp notes, droplets, bowl strikes, chimes, test bursts)
      s.grains = amp(1);
      s.grains.connect(s.out);

      const t = ctx.currentTime;
      s.noise.start(t, (0.37 + 0.97 * k) % 5.5); // different offsets: the streams stay uncorrelated
      s.foam.start(t, (0.81 + 1.31 * k) % 5.5);
      s.voices.forEach(({ o, lfo }) => { o.start(t); lfo.start(t); });
      s.lfos.forEach((o) => o.start(t));
      return s;
    }

    _root() {
      return this.engine.params.root || 108;
    }

    /** fixed chord note of a stream, set by its direction */
    _note(s) {
      return (this._root() / 2) * DIR_NOTE[(s && s.dir) || 0];
    }

    /** direction of stream k: the cardinal direction it flows down on (REBAL), or a fixed order otherwise */
    _dirIndex(k, n, cycle) {
      if (this.params.trajectory !== 'rebal') return k % 4;
      const az = baseAzimuth(k, n, cycle);
      return ((Math.round(az / (Math.PI / 2)) % 4) + 4) % 4;
    }

    /** the kind of sound a stream makes */
    _kind(s) {
      const pal = this.params.palette;
      return pal === 'quad' ? QUAD_KINDS[s.dir || 0] : pal;
    }

    _tuneVoices(s, immediate) {
      const now = this.ctx.currentTime;
      const vib = this._kind(s) === 'choir' || this._kind(s) === 'voice' ? 9 : 4;
      s.voices.forEach(({ o, depth }) => {
        o.frequency.setTargetAtTime(this._note(s), now, immediate ? 0.001 : 0.08);
        depth.gain.setTargetAtTime(vib, now, immediate ? 0.001 : 0.1);
      });
      s.dirTuned = s.dir;
    }

    _applyPalette(initial) {
      this.streams.forEach((s) => {
        s.nextGrain = 0;
        this._tuneVoices(s, initial);
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
    /**
     * Levels follow the breath; spectra follow only inhale vs exhale (and the wave's swell and break), never the
     * height: a sound whose pitch or vowel changed with height would compete with the ears' own elevation cues.
     */
    _modulate(s, k, pos, res, t, gate) {
      const p = this.params;
      const pal = p.palette;
      const isRebal = p.trajectory === 'rebal';
      const st = isRebal && pos.st ? pos.st : this.breath.state(this.breath.phase);
      const stage = st.stage;
      const sp = st.p;
      let lvl, wave, foam, cut;
      if (stage === 'exhale') {
        const a = (1 - Math.exp(-9 * sp)) * (1 - 0.5 * sp);
        lvl = 0.3 + 0.7 * a;
        wave = 0.95 - 0.5 * sp;
        foam = 0.25 + 0.75 * Math.exp(-5 * sp) * Math.min(1, sp * 25); // the wave breaks at the crown
        cut = 3600 - 2300 * sp;
      } else if (stage === 'inhale') {
        const a = Math.pow(Math.sin(Math.PI * sp), 0.8);
        lvl = 0.28 + 0.62 * Math.max(a, sp * 0.7);
        wave = 0.35 + 0.6 * sp * sp * (3 - 2 * sp); // the wave swells as it rises
        foam = 0.15 + 0.3 * sp;
        cut = 800 + 2200 * sp;
      } else if (stage === 'holdIn') {
        lvl = 0.25; wave = 0.9; foam = 0.3; cut = 3000;
      } else {
        lvl = 0.22; wave = 0.4; foam = 0.15; cut = 1200;
      }
      if (isRebal && res.mode === 'balloon') {
        // continuous field: envelopes compressed towards a steady level, swelling with the listener's breath
        const swell = 0.8 + 0.2 * this.breath.state(this.breath.phase).lung;
        lvl = (0.45 + 0.35 * lvl) * swell;
        wave = (0.5 + 0.4 * wave) * swell;
      }
      // inhale vs exhale timbre, smoothed over ~0.15 s
      s.ih += ((stage === 'inhale' ? 1 : 0) - s.ih) * 0.15;
      const ih = s.ih;
      if (s.dirTuned !== s.dir) this._tuneVoices(s, false);
      const d = s.dir || 0;
      const kind = this._kind(s);
      const trim = pal === 'quad' ? QUAD_TRIM[kind] || 1 : 1;

      let gBreath = 0, gWave = 0, gVoice = 0;
      if (kind === 'breath') gBreath = 1.2 * lvl;
      else if (kind === 'waves') { gBreath = 0.1 * lvl; gWave = 0.9; }
      else if (kind === 'choir' || kind === 'voice') { gBreath = 0.08 * lvl; gVoice = 0.5 * (0.35 + 0.65 * lvl); }
      else if (kind === 'harp') gBreath = (pal === 'quad' ? 0.12 : 0.2) * lvl;
      else if (kind === 'water') gBreath = 0.2 * (0.5 + 0.5 * lvl);
      else if (kind === 'bowl') gBreath = 0.03;
      else gBreath = 0.06 * lvl;
      gBreath *= trim; gWave *= trim; gVoice *= trim;
      if (p.trajectory === 'test') { gBreath = 0; gWave = 0; gVoice = 0; } // localisation check: bursts only
      const wv = WAVE_VARIANT[d];
      const vw = BREATH_VOWEL[d];

      const R = (prm, v) => prm.linearRampToValueAtTime(v, t);
      // breath: "haa" on the exhale, a thinner, airier "hhh" on the inhale; a fixed vowel colour per direction
      R(s.nF1.frequency, lerp(620, 950, ih) + vw[0] * (1 - 0.5 * ih));
      R(s.nF2.frequency, lerp(1250, 2100, ih) + vw[1] * (1 - 0.5 * ih));
      R(s.nAir.frequency, lerp(3800, 5200, ih));
      R(s.nG1.gain, lerp(1.0, 0.5, ih));
      R(s.nG2.gain, lerp(0.7, 0.85, ih));
      R(s.nG3.gain, lerp(0.45, 0.75, ih));
      R(s.nG4.gain, lerp(0.28, 0.45, ih));
      R(s.breathVCA.gain, gBreath * gate);
      // water waves: swell on the inhale, break and wash on the exhale
      R(s.wLP.frequency, Math.min(9000, cut * wv.cut));
      R(s.wBody.gain, wave);
      R(s.foamG.gain, 1.4 * foam * wv.foam);
      R(s.waveVCA.gain, gWave * gate);
      R(s.harmVCA.gain, gVoice * gate);
      return { lvl, energy: clamp(lvl, 0, 1) };
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

    /** harmonic tone with decaying partials (partial n: amplitude amps[n-1], time constant decay / n^tilt) */
    _tone(dest, t, f, lvl, decay, amps, tilt, attack, beat) {
      const ctx = this.ctx;
      const fmax = Math.min(ctx.sampleRate * 0.45, 9000);
      const g = ctx.createGain();
      g.gain.value = lvl;
      g.connect(dest);
      amps.forEach((a, i) => {
        const n = i + 1;
        const fn = f * n;
        if (!a || fn > fmax) return;
        const tau = decay / Math.pow(n, tilt);
        const add = (freq, ampl) => {
          const o = ctx.createOscillator();
          o.frequency.value = freq;
          const e = ctx.createGain();
          e.gain.setValueAtTime(0, t);
          e.gain.linearRampToValueAtTime(ampl, t + attack);
          e.gain.setTargetAtTime(0, t + attack, tau);
          o.connect(e);
          e.connect(g);
          o.start(t);
          o.stop(t + attack + tau * 7);
        };
        add(fn, a);
        if (beat && n <= beat.length && beat[n - 1]) add(fn + beat[n - 1], a * 0.6);
      });
      return g;
    }

    _pluck(dest, t, f, lvl, decay) {
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
      const quad = this.params.palette === 'quad';
      const pal = this._kind(s);
      if (this.params.trajectory === 'test') {
        this._noiseBurst(s.grains, t, 0.16, 2500, 0.35, 0.9);
        return 0.25;
      }
      const expo = (rate) => -Math.log(1 - Math.random() * 0.97) / rate;
      const half = this._root() / 2;
      if (pal === 'breath' || pal === 'waves' || pal === 'choir' || pal === 'voice') return 1.0; // continuous sounds only
      if (pal === 'harp') {
        if (quad) {
          // the harp stream of the four: chord notes in a free order, dense enough to follow its path
          const h = HARP_NOTES[Math.floor(Math.random() * HARP_NOTES.length)];
          this._pluck(s.grains, t, half * h, (0.1 + 0.04 * Math.random()) * QUAD_TRIM.harp, 0.8 + 0.5 * Math.random());
          return 0.22 + 0.22 * Math.random() + 0.15 * (1 - info.energy);
        }
        // one harp per stream, each on its own chord note (or its octave): four distinct pitches
        const f = this._note(s) * (Math.random() < 0.35 ? 2 : 1);
        this._pluck(s.grains, t, f, 0.07 + 0.03 * Math.random(), 0.8 + 0.5 * Math.random());
        return 0.28 + 0.3 * Math.random() + 0.25 * (1 - info.energy);
      }
      if (pal === 'water') {
        // natural droplets: Minnaert bubble chirps at random pitches
        const ctx = this.ctx;
        const f0 = 900 * Math.pow(4, Math.random());
        const dur = clamp(0.06 * (1500 / f0), 0.02, 0.09);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * (1.35 + 0.35 * Math.random()), t + dur);
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
        this._tone(s.grains, t, this._note(s), 0.32, 6.0, [1, 0.3, 0.1], 0.9, 0.006, [0.6, 0.9, 0]);
        this._noiseBurst(s.grains, t, 0.018, 700, 0.7, 0.12);
        return 5 + Math.random() * 4;
      }
      // soft chimes (celesta): harmonic partials only
      const f = 2 * half * CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];
      this._tone(s.grains, t, f, 0.06 + 0.04 * Math.random(), 1.3, [1, 0.22, 0.06], 1.0, 0.0025);
      return 0.4 + expo(1.4);
    }

    _bloom(s, k, t) {
      // pitched palettes only: a soft harp arpeggio as the energy leaves the crown
      const half = this._root() / 2;
      [4, 5, 6, 8, 10].forEach((h, i) => this._pluck(s.grains, t + i * 0.075, half * h, 0.045, 1.1));
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
        const trim = p.trajectory === 'test' ? TEST_TRIM : PALETTE_TRIM[p.palette] || 1;
        s.out.gain.linearRampToValueAtTime(p.gain * norm * nearComp * trim, tSched);
        this.renderer.setPosition(this.slots[k], pos.x, pos.y, pos.z, pos.w, tSched);
        s.dir = this._dirIndex(k, n, res.st ? res.st.cycle : 0);
        const info = this._modulate(s, k, pos, res, tSched, gate);
        if (pos.st && pos.st.stage === 'exhale') info.energy = clamp(1.1 - pos.st.p, 0.2, 1);
        // grains for the window (lastGrain, tSched]
        if (!Number.isFinite(s.nextGrain) || s.nextGrain < now - 0.5 || s.nextGrain === 0) s.nextGrain = now + 0.05 + 0.13 * k;
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
          if (stageNow === 'exhale' && (p.palette === 'choir' || p.palette === 'harp')) this._bloom(this.streams[0], 0, tSched);
          if (stageNow === 'inhale' && this.prevStage !== 'inhale' && (p.palette === 'choir' || p.palette === 'harp')) this._ground(this.streams[0], tSched);
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
        streams: res.streams.map((q, k) => ({ x: q.x, y: q.y, z: q.z, w: q.w, dir: this.streams[k].dir, label: p.palette === 'quad' ? QUAD_LABELS[this.streams[k].dir] : null }))
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
        return { x: lerp(s.x, q.x, u), y: lerp(s.y, q.y, u), z: lerp(s.z, q.z, u), w: lerp(s.w, q.w, u), dir: s.dir, label: s.label };
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
      if (key === 'room' || key === 'cue' || key === 'intensity' || key === 'enabled') this.applyRendererConfig();
      if (key === 'enabled' && !p.enabled) this.streams.forEach((s) => this._muteStream(s, now, 0.08));
    }

    _muteStream(s, now, tc) {
      holdAt(s.out.gain, now);
      s.out.gain.setTargetAtTime(0, now, tc);
      s.on = false;
    }

    applyRendererConfig() {
      const p = this.params;
      this.renderer.setConfig({ cue: p.cue, pinna: Math.min(1.3, 0.5 + 0.5 * p.cue), er: 0.18 + 0.8 * p.room, reverb: 0.08 + 0.55 * p.room, roomSize: 0.8 + 0.6 * p.room, exaggerate: p.intensity });
      // measured ear models: the same slider scales the fine spectral structure (1 = as measured)
      if (this.renderer.setEarCue && Math.abs(this.renderer.earK - p.cue) > 0.01) {
        clearTimeout(this._cueTimer);
        this._cueTimer = setTimeout(() => this.renderer.setEarCue(p.cue).catch(() => {}), 120);
      }
    }
  }

  Spatial3DModule.PALETTES = PALETTES;
  Spatial3DModule.CHORD = CHORD;
  Spatial3DModule.QUAD = { DIR_NAMES, QUAD_KINDS, QUAD_LABELS, DIR_NOTE };
  Spatial3DModule.TRAJECTORIES = TRAJECTORIES;
  Spatial3DModule.REBAL_MODES = REBAL_MODES;
  Spatial3DModule.Y_CROWN = Y_CROWN;
  Spatial3DModule.Y_FEET = Y_FEET;
  Spatial3DModule.MAX_STREAMS = MAX_STREAMS;
  Spatial3DModule.LOOKAHEAD = LOOKAHEAD;
  Spatial3DModule.TEST_POINTS = TEST_POINTS;
  Spatial3DModule.geometry = { meridianAt, rebalPosition, exhaleInterior, inhaleInterior, inhaleY, inhaleOffset, inhaleSway, inhaleEnv, jetLean, baseAzimuth, windFrac, MERIDIAN, Y_CROWN, Y_FEET };

  global.Spatial3DModule = Spatial3DModule;
  global.AetherBreathClock = BreathClock;
})(typeof window !== 'undefined' ? window : globalThis);
