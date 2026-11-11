/**
 * AETHER // MODULE 1 — 3D Sound Space & REBAL Energy Torus
 *
 * A deliberately simple, high-quality binaural spatializer.
 *
 * Design principles (what actually makes a sound easy to localize in 3D over headphones):
 *  1. ONE consistent spatial cue chain per source. The browser's measured HRTF (PannerNode 'HRTF')
 *     already contains the interaural time/level differences AND the pinna spectral cues. We do NOT stack
 *     hand-made ITD delays / stereo panners / notch filters in parallel with it (that smears and
 *     contradicts the cues and was the main reason the old engine localized poorly).
 *  2. Broadband, transient-rich sources. Elevation is decoded from the 4–12 kHz spectrum, so every
 *     sound here carries energy up there (breath air, sparkle grains, mallet/drop/chime transients).
 *  3. Physically plausible externalization: a floor reflection (second HRTF image mirrored below the
 *     floor, delayed by the true path difference) plus a short, decorrelated early-reflection room.
 *     The direct-to-room ratio also gives a natural distance cue.
 *  4. Gentle, congruent extra cues only: a mild high-shelf "open sky" lift above / darkening below,
 *     a mild frontal presence band, and diotic in-head rendering when the source passes through the head.
 *
 * Public interface used by ConsciousnessAudioEngine:
 *    new Spatial3DModule(engine)  -> builds the graph into engine.spatialDryBus
 *    module.tick(now, elapsed, isBg)
 *    module.update(key, val)
 *
 * Telemetry written for the visualizer:
 *    engine.telemetry.spatialVoices[i] = { index, x, y, z, dist, active, activeEnergy, trail[] }
 *    engine.telemetry.spatialStage     = { active, phase: 'exhale'|'inhale', u, label, energy }
 *    engine.telemetry.spatialRipples   = [{ x, y, z, time, voiceIndex }]
 */

(function () {
  const MAX_VOICES = 4;
  const SPEED_OF_SOUND = 343;
  const EAR_HEIGHT = 1.5;          // listener ears 1.5 m above the floor (floor at y = -1.5)
  const LOOKAHEAD = 0.12;          // seconds of event scheduling lookahead (robust to 20 Hz background ticks)
  const OUTPUT_LEVEL = 0.95;

  // REBAL body geometry (metres, listener's ears at the origin)
  const REBAL_CROWN_Y = 0.14;
  const REBAL_FEET_Y = -1.6;

  const PALETTES = ['energy', 'bowl', 'drops', 'chimes'];
  const TRAJECTORIES = ['rebal', 'orbit', 'vertical', 'sphere', 'manual'];

  // Legacy values from older saved configs / presets
  const PALETTE_ALIASES = {
    rebal: 'energy', whisper: 'energy', rich8d: 'energy',
    water_bowl: 'bowl', shamanic: 'bowl',
    water_drops: 'drops',
    crackle: 'chimes', tapping: 'chimes'
  };
  const TRAJECTORY_ALIASES = {
    orbit8d: 'orbit', circle: 'orbit', spiral: 'orbit', torus: 'orbit', peripersonal: 'orbit',
    zenith_arch: 'vertical', radial: 'vertical',
    helix3d: 'sphere', infinity: 'sphere', mixed: 'sphere', bifurcation5m: 'sphere', bifurcation_random: 'sphere'
  };

  // Energy palette: consonant chord (C3, G3, C4, E4)
  const ENERGY_ROOT = 130.81;
  const ENERGY_RATIOS = [1, 1.5, 2, 2.5];
  // Singing bowls: D minor-pentatonic-ish bowl set
  const BOWL_FREQS = [220.0, 293.66, 329.63, 440.0];
  // Crystal chimes: D major pentatonic, high register
  const CHIME_FREQS = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98, 1760.0];

  // Vowel formants used for the breath-voice ("oo" -> "aa" -> "ee"): brightness follows height
  const VOWEL_OO = [320, 800, 2300];
  const VOWEL_AA = [730, 1150, 2500];
  const VOWEL_EE = [290, 2250, 3000];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  class Spatial3DModule {
    constructor(engine) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.params = engine.params.spatial;
      this.telemetry = engine.telemetry;
      this._normalizeParams();

      this.phase = 0;
      this.lastNow = 0;
      this.lastCycleIdx = -1;
      this.lastChime = -1;

      this._build();
    }

    // ---------------------------------------------------------------------------------------------
    // Parameters
    // ---------------------------------------------------------------------------------------------
    _normalizeParams() {
      const p = this.params;
      if (PALETTE_ALIASES[p.palette]) p.palette = PALETTE_ALIASES[p.palette];
      if (!PALETTES.includes(p.palette)) p.palette = 'energy';
      if (TRAJECTORY_ALIASES[p.trajectory]) p.trajectory = TRAJECTORY_ALIASES[p.trajectory];
      if (!TRAJECTORIES.includes(p.trajectory)) p.trajectory = 'orbit';
      p.count = clamp(Math.round(p.count || 2), 1, MAX_VOICES);
      p.gain = clamp(p.gain !== undefined ? p.gain : 0.8, 0, 1);
      p.speed = clamp(p.speed !== undefined ? p.speed : 0.1, 0.02, 0.5);
      p.distance = clamp(p.distance !== undefined ? p.distance : 1.8, 0.5, 4);
      p.room = clamp(p.room !== undefined ? p.room : 0.45, 0, 1);
      p.spiral = clamp(p.spiral !== undefined ? p.spiral : 0, 0, 2);
    }

    // ---------------------------------------------------------------------------------------------
    // Graph construction
    // ---------------------------------------------------------------------------------------------
    _build() {
      const ctx = this.ctx;
      const p = this.params;

      this.out = ctx.createGain();
      this.out.gain.value = p.enabled ? p.gain * OUTPUT_LEVEL : 0;

      this.sum = ctx.createGain();
      // Remove sub-rumble that only muddies the image
      this.hp = ctx.createBiquadFilter();
      this.hp.type = 'highpass';
      this.hp.frequency.value = 60;
      this.hp.Q.value = 0.7;
      this.sum.connect(this.hp);
      this.hp.connect(this.out);
      this.out.connect(this.engine.spatialDryBus);

      // Shared short early-reflection room (externalization + distance cue)
      this.roomIn = ctx.createGain();
      this.roomIn.gain.value = this._roomSendLevel(p.room);
      this.room = ctx.createConvolver();
      this.room.normalize = false;
      this.room.buffer = this._createRoomImpulse(0.85);
      this.roomIn.connect(this.room);
      this.room.connect(this.sum);

      this.noiseBuf = this._createNoiseBuffer(3);
      this.voiceWave = this._createVoiceWave();

      this.voices = [];
      this.telemetry.spatialVoices = [];
      this.telemetry.spatialRipples = this.telemetry.spatialRipples || [];
      this.telemetry.spatialStage = { active: false, phase: 'exhale', u: 0, label: '', energy: 0 };

      for (let i = 0; i < MAX_VOICES; i++) {
        this.voices.push(this._buildVoice(i));
        this.telemetry.spatialVoices.push({
          index: i, x: 0, y: 0, z: -1, dist: 1, active: false, activeEnergy: 0, trail: [], stageLabel: ''
        });
      }
      this._applyPalette();
    }

    _buildVoice(i) {
      const ctx = this.ctx;
      const v = { index: i, nextEvt: 0 };

      // Voice input: everything this source emits is summed here (voice level / count normalization)
      v.input = ctx.createGain();
      v.input.gain.value = 0;

      // Gentle congruent direction cues (on top of the measured HRTF)
      v.elevShelf = ctx.createBiquadFilter();
      v.elevShelf.type = 'highshelf';
      v.elevShelf.frequency.value = 7000;
      v.elevShelf.gain.value = 0;

      v.frontPeak = ctx.createBiquadFilter();
      v.frontPeak.type = 'peaking';
      v.frontPeak.frequency.value = 3200;
      v.frontPeak.Q.value = 1.1;
      v.frontPeak.gain.value = 0;

      // Air absorption with distance
      v.airLP = ctx.createBiquadFilter();
      v.airLP.type = 'lowpass';
      v.airLP.frequency.value = 18000;
      v.airLP.Q.value = 0.5;

      v.input.connect(v.elevShelf);
      v.elevShelf.connect(v.frontPeak);
      v.frontPeak.connect(v.airLP);

      // A. Direct sound -> measured HRTF
      v.directGain = ctx.createGain();
      v.panner = this._createHrtfPanner();
      v.airLP.connect(v.directGain);
      v.directGain.connect(v.panner);
      v.panner.connect(this.sum);

      // B. In-head (diotic) rendering when the source passes through the head
      v.centerGain = ctx.createGain();
      v.centerGain.gain.value = 0;
      v.airLP.connect(v.centerGain);
      v.centerGain.connect(this.sum);

      // C. Floor reflection: delayed, slightly darker second HRTF image mirrored below the floor
      v.floorDelay = ctx.createDelay(0.05);
      v.floorDelay.delayTime.value = 0.004;
      v.floorLP = ctx.createBiquadFilter();
      v.floorLP.type = 'lowpass';
      v.floorLP.frequency.value = 6500;
      v.floorGain = ctx.createGain();
      v.floorGain.gain.value = 0;
      v.floorPanner = this._createHrtfPanner();
      v.airLP.connect(v.floorDelay);
      v.floorDelay.connect(v.floorLP);
      v.floorLP.connect(v.floorGain);
      v.floorGain.connect(v.floorPanner);
      v.floorPanner.connect(this.sum);

      // D. Room send
      v.airLP.connect(this.roomIn);

      // ---- Sustained layers (used by the 'energy' palette) ----
      // Breath-voice tone: band-limited harmonic wave through 3 vocal formants
      v.osc = ctx.createOscillator();
      v.osc.setPeriodicWave(this.voiceWave);
      v.osc.frequency.value = ENERGY_ROOT * ENERGY_RATIOS[i];
      v.vib = ctx.createOscillator();
      v.vib.frequency.value = 4.6 + i * 0.37;
      v.vibDepth = ctx.createGain();
      v.vibDepth.gain.value = 5; // cents
      v.vib.connect(v.vibDepth);
      v.vibDepth.connect(v.osc.detune);

      v.toneGain = ctx.createGain();
      v.toneGain.gain.value = 0;
      v.formants = [0, 1, 2].map((k) => {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = VOWEL_AA[k];
        bp.Q.value = [5, 9, 12][k];
        const g = ctx.createGain();
        g.gain.value = [1.0, 0.75, 0.45][k];
        v.osc.connect(bp);
        bp.connect(g);
        g.connect(v.toneGain);
        return bp;
      });
      // Warm body under the formants
      v.toneBody = ctx.createBiquadFilter();
      v.toneBody.type = 'lowpass';
      v.toneBody.frequency.value = 500;
      v.toneBodyGain = ctx.createGain();
      v.toneBodyGain.gain.value = 0.12;
      v.osc.connect(v.toneBody);
      v.toneBody.connect(v.toneBodyGain);
      v.toneBodyGain.connect(v.toneGain);
      v.toneGain.connect(v.input);

      // Breath air: band-shaped noise with an airy top
      v.noise = ctx.createBufferSource();
      v.noise.buffer = this.noiseBuf;
      v.noise.loop = true;
      v.airBP = ctx.createBiquadFilter();
      v.airBP.type = 'bandpass';
      v.airBP.frequency.value = 1400;
      v.airBP.Q.value = 0.6;
      v.airTop = ctx.createBiquadFilter();
      v.airTop.type = 'highshelf';
      v.airTop.frequency.value = 5000;
      v.airTop.gain.value = 6;
      v.airGain = ctx.createGain();
      v.airGain.gain.value = 0;
      v.noise.connect(v.airBP);
      v.airBP.connect(v.airTop);
      v.airTop.connect(v.airGain);
      v.airGain.connect(v.input);

      const t = ctx.currentTime;
      v.osc.start(t);
      v.vib.start(t);
      v.noise.start(t, Math.random() * 2.5);
      return v;
    }

    _createHrtfPanner() {
      const p = this.ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1;
      p.maxDistance = 100;
      p.rolloffFactor = 1;
      p.coneInnerAngle = 360;
      p.coneOuterAngle = 360;
      p.coneOuterGain = 1;
      return p;
    }

    _createNoiseBuffer(seconds) {
      const rate = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    _createVoiceWave() {
      // Glottal-like source: all harmonics up to 48 with 1/n^1.1 rolloff (bright enough for pinna cues)
      const N = 48;
      const real = new Float32Array(N + 1);
      const imag = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) imag[n] = 1 / Math.pow(n, 1.1);
      return this.ctx.createPeriodicWave(real, imag);
    }

    /**
     * Short, decorrelated stereo room: discrete early reflections (3–40 ms) + soft 0.6 s tail.
     */
    _createRoomImpulse(seconds) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        // Early reflections
        const taps = 14;
        for (let k = 0; k < taps; k++) {
          const tMs = 3 + Math.pow(Math.random(), 1.3) * 37;
          const idx = Math.floor((tMs / 1000) * rate);
          const amp = (0.55 - 0.35 * (tMs / 40)) * (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.4 * Math.random());
          if (idx < len) d[idx] += amp;
        }
        // Diffuse tail with progressive high-frequency damping
        let lp = 0;
        const start = Math.floor(0.012 * rate);
        for (let i = start; i < len; i++) {
          const t = (i - start) / rate;
          const env = Math.exp(-t / 0.16) * (1 - Math.exp(-t / 0.008));
          const damp = 0.25 + 0.6 * (i / len);
          lp = lp * damp + (Math.random() * 2 - 1) * (1 - damp);
          d[i] += lp * env * 0.32;
        }
      }
      return buf;
    }

    _roomSendLevel(room) {
      return room * 0.42;
    }

    // ---------------------------------------------------------------------------------------------
    // Palette
    // ---------------------------------------------------------------------------------------------
    _applyPalette() {
      const now = this.ctx.currentTime;
      const isEnergy = this.params.palette === 'energy';
      this.voices.forEach((v, i) => {
        v.nextEvt = 0;
        v.osc.frequency.setTargetAtTime(ENERGY_ROOT * ENERGY_RATIOS[i], now, 0.05);
        if (!isEnergy) {
          v.toneGain.gain.setTargetAtTime(0, now, 0.15);
          v.airGain.gain.setTargetAtTime(0, now, 0.15);
        }
      });
    }

    // ---------------------------------------------------------------------------------------------
    // Trajectories
    // ---------------------------------------------------------------------------------------------
    _rebalGeometry() {
      const R = clamp(this.params.distance * 1.1, 0.9, 4.2);
      const yc = (REBAL_CROWN_Y + REBAL_FEET_Y) / 2;
      const half = (REBAL_CROWN_Y - REBAL_FEET_Y) / 2;
      const ay = 1.0 + 0.55 * R;                    // vertical semi-axis: apex well above the head
      const s = half / ay;
      const k = Math.sqrt(1 - s * s);
      const ar = R / (1 + k);
      const rc = k * ar;
      const th0 = Math.PI - Math.asin(s);
      return { R, yc, ay, ar, rc, th0 };
    }

    _rebalBranchAz(i, n, cycleIdx) {
      if (n === 1) return cycleIdx % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
      if (n === 2) return i === 0 ? Math.PI / 2 : -Math.PI / 2;
      if (n === 3) return Math.PI / 2 + (i * 2 * Math.PI) / 3;
      return [Math.PI / 2, -Math.PI / 2, 0, Math.PI][i];
    }

    /**
     * REBAL — Monroe's Resonant Energy Balloon as an apple-shaped torus around the body.
     *  EXHALE (cycle 0 → 0.5): energy fountains UP out of the crown, splits into 1–4 branches, arcs high
     *          over the top, flows DOWN wide around the body, curves under the feet and into the soles.
     *  INHALE (cycle 0.5 → 1): merged energy rises straight UP the body core and fills the head.
     */
    _rebalPosition(i, n, cycle, cycleIdx) {
      const g = this._rebalGeometry();
      if (cycle < 0.5) {
        const u = cycle / 0.5;
        const th = g.th0 - u * 2 * g.th0;
        const r = Math.max(0, g.rc + g.ar * Math.cos(th));
        const y = g.yc + g.ay * Math.sin(th);
        const az = this._rebalBranchAz(i, n, cycleIdx) + this.params.spiral * 2 * Math.PI * u;
        return { x: r * Math.sin(az), y, z: -r * Math.cos(az), phase: 'exhale', u };
      }
      const u = (cycle - 0.5) / 0.5;
      if (u < 0.78) {
        const s = smoothstep(0, 1, u / 0.78);
        return { x: 0, y: lerp(REBAL_FEET_Y - 0.1, 0, s), z: -0.06, phase: 'inhale', u };
      }
      // Filling the head: a tiny swirl inside the cranium
      const w = (u - 0.78) / 0.22;
      const sw = 2 * Math.PI * (w * 1.5 + i / n);
      return { x: 0.05 * Math.sin(sw), y: 0.04 * w, z: -0.05 * Math.cos(sw), phase: 'inhale', u };
    }

    _rebalLabel(phase, u) {
      if (phase === 'exhale') {
        if (u < 0.1) return 'EXHALE ▼ · Energy bursts out of the crown';
        if (u < 0.32) return 'EXHALE ▼ · Fountaining up & over the top';
        if (u < 0.72) return 'EXHALE ▼ · Flowing down around the body';
        return 'EXHALE ▼ · Curving under the feet';
      }
      if (u < 0.12) return 'INHALE ▲ · Entering the soles of the feet';
      if (u < 0.78) return 'INHALE ▲ · Rising up through the body';
      return 'INHALE ▲ · Filling the head with energy';
    }

    _position(i, n, t) {
      const p = this.params;
      const R = p.distance;
      const P = t; // accumulated phase in cycles (speed already integrated)
      const TAU = Math.PI * 2;
      switch (p.trajectory) {
        case 'orbit': {
          const th = TAU * (P + i / n);
          const el = 0.14 * Math.sin(TAU * 0.37 * P + i * 1.9);
          return { x: R * Math.cos(el) * Math.sin(th), y: R * Math.sin(el), z: -R * Math.cos(el) * Math.cos(th) };
        }
        case 'vertical': {
          // Each source loops in its own vertical plane: median (front→above→behind→below), frontal (right→above→left→below), diagonals
          const ph = TAU * (P + i / (2 * n));
          const planeAz = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4][i];
          const horiz = R * Math.cos(ph);
          return { x: horiz * Math.sin(planeAz), y: R * Math.sin(ph), z: -horiz * Math.cos(planeAz) };
        }
        case 'sphere': {
          const az = TAU * (P + i / n) + 0.9 * Math.sin(TAU * 0.53 * P + i * 1.7);
          const el = 0.3 + 0.85 * Math.sin(TAU * 0.71 * P + i * 2.3); // -31° .. +66°
          const r = R * (0.85 + 0.25 * Math.sin(TAU * 0.29 * P + i));
          return { x: r * Math.cos(el) * Math.sin(az), y: r * Math.sin(el), z: -r * Math.cos(el) * Math.cos(az) };
        }
        case 'manual': {
          const m = p.manualPos || this.lastManual || { x: 0.0, y: 0.0, z: -R };
          return { x: m.x, y: m.y, z: m.z };
        }
        default:
          return { x: 0, y: 0, z: -R };
      }
    }

    // ---------------------------------------------------------------------------------------------
    // Real-time update
    // ---------------------------------------------------------------------------------------------
    tick(now, elapsed, isBg) {
      const p = this.params;
      if (!p.enabled) {
        this.telemetry.spatialVoices.forEach((tv) => { tv.active = false; tv.activeEnergy = 0; });
        this.telemetry.spatialStage.active = false;
        return;
      }

      // Integrate speed into a phase accumulator so changing the speed never makes sources jump
      const dtTick = clamp(now - (this.lastNow || now), 0, 0.25);
      this.lastNow = now;
      this.phase = (this.phase || 0) + dtTick * p.speed;
      const t = this.phase;
      const traj = p.trajectory;
      const isManual = traj === 'manual';
      const n = isManual ? 1 : p.count;
      const tc = isBg ? 0.07 : 0.035;
      const isEnergy = p.palette === 'energy';

      // REBAL cycle bookkeeping
      let cycle = 0;
      let cycleIdx = 0;
      if (traj === 'rebal') {
        const ct = t;
        cycleIdx = Math.floor(ct);
        cycle = ct - cycleIdx;
        if (cycleIdx !== this.lastCycleIdx) {
          if (this.lastCycleIdx >= 0) this._crownBurst(now);
          this.lastCycleIdx = cycleIdx;
        }
      }

      // Global "breath" for non-REBAL energy palette: airflow follows the derivative of lung volume
      const breathPh = this.telemetry.breathPhase || 0;

      let stage = null;
      for (let i = 0; i < MAX_VOICES; i++) {
        const v = this.voices[i];
        const tv = this.telemetry.spatialVoices[i];
        const active = i < n;
        v.input.gain.setTargetAtTime(active ? 1 / Math.sqrt(n) : 0, now, 0.2);
        tv.active = active;
        if (!active) {
          tv.activeEnergy = 0;
          if (tv.trail.length) tv.trail = [];
          continue;
        }

        // Position
        let pos;
        if (p.manualPos && i === 0) {
          pos = { x: p.manualPos.x, y: p.manualPos.y, z: p.manualPos.z };
          this.lastManual = pos;
        } else if (traj === 'rebal') {
          pos = this._rebalPosition(i, n, cycle, cycleIdx);
          if (!stage) stage = pos;
        } else {
          pos = this._position(i, n, t);
        }
        const { x, y, z } = pos;
        this._setPosition(v.panner, x, y, z, now, tc);

        const d = Math.sqrt(x * x + y * y + z * z);
        const horiz = Math.sqrt(x * x + z * z);
        const el = Math.atan2(y, Math.max(horiz, 1e-3));
        const en = clamp(el / (Math.PI / 2), -1, 1);

        // Congruent spectral cues
        v.elevShelf.gain.setTargetAtTime(en >= 0 ? 5 * en : 6 * en, now, tc);
        const front = d > 0.05 ? clamp(-z / d, -1, 1) : 0;
        v.frontPeak.gain.setTargetAtTime(2.5 * front, now, tc);
        v.airLP.frequency.setTargetAtTime(19000 / (1 + Math.max(0, d - 1) * 0.35), now, tc);

        // In-head blend
        const inHead = 1 - smoothstep(0.15, 0.5, d);
        v.directGain.gain.setTargetAtTime(1 - 0.8 * inHead, now, tc);
        v.centerGain.gain.setTargetAtTime(0.8 * inHead, now, tc);

        // Floor reflection
        const floorY = -EAR_HEIGHT;
        const aboveFloor = smoothstep(0.05, 0.4, y - floorY);
        if (aboveFloor > 0.001 && p.room > 0.001) {
          const ym = 2 * floorY - y;
          const dr = Math.sqrt(x * x + ym * ym + z * z);
          const delay = clamp((dr - Math.max(d, 0.05)) / SPEED_OF_SOUND, 0.0005, 0.045);
          v.floorDelay.delayTime.setTargetAtTime(delay, now, tc * 2);
          this._setPosition(v.floorPanner, x, ym, z, now, tc);
          v.floorGain.gain.setTargetAtTime(0.55 * p.room * aboveFloor, now, tc);
        } else {
          v.floorGain.gain.setTargetAtTime(0, now, tc);
        }

        // Palette modulation
        let energy = 0.6;
        if (isEnergy) {
          let air;
          let inhale;
          if (traj === 'rebal' && !(p.manualPos && i === 0)) {
            const u = pos.u;
            inhale = pos.phase === 'inhale';
            if (!inhale) {
              air = (1 - Math.exp(-u * 10)) * Math.pow(1 - u, 0.8);
              energy = 1 - 0.55 * u;
            } else {
              air = (1 - Math.exp(-u * 7)) * Math.pow(1 - Math.min(u / 0.85, 1), 0.6);
              energy = 0.45 + 0.55 * Math.pow(u, 1.4);
            }
          } else {
            const slope = Math.cos(breathPh + i * 0.6);
            inhale = slope >= 0;
            air = Math.pow(Math.abs(slope), 1.3);
            energy = 0.55 + 0.4 * Math.sin(breathPh + i * 0.6);
          }
          this._updateBreathVoice(v, now, tc, en, air, inhale, energy);
        }
        tv.activeEnergy = energy;

        // Events (sparkles / bowls / drops / chimes)
        this._scheduleEvents(v, i, n, now, energy, pos);

        tv.x = x; tv.y = y; tv.z = z; tv.dist = d;
        tv.stageLabel = pos.phase ? this._rebalLabel(pos.phase, pos.u) : '';
        if (!isBg) {
          tv.trail.push({ x, y, z });
          if (tv.trail.length > 70) tv.trail.shift();
        }
      }

      const st = this.telemetry.spatialStage;
      if (stage) {
        st.active = true;
        st.phase = stage.phase;
        st.u = stage.u;
        st.label = this._rebalLabel(stage.phase, stage.u);
        st.energy = this.telemetry.spatialVoices[0].activeEnergy;
      } else {
        st.active = false;
      }
    }

    _setPosition(panner, x, y, z, now, tc) {
      if (panner.positionX) {
        panner.positionX.setTargetAtTime(x, now, tc);
        panner.positionY.setTargetAtTime(y, now, tc);
        panner.positionZ.setTargetAtTime(z, now, tc);
      } else if (panner.setPosition) {
        panner.setPosition(x, y, z);
      }
    }

    _updateBreathVoice(v, now, tc, en, air, inhale, energy) {
      // Vowel brightness follows height: below = "oo" (dark), ear level = "aa", above = "ee" (bright)
      const hb = (en + 1) / 2;
      let F;
      if (hb < 0.5) {
        const k = hb / 0.5;
        F = [0, 1, 2].map((j) => lerp(VOWEL_OO[j], VOWEL_AA[j], k));
      } else {
        const k = (hb - 0.5) / 0.5;
        F = [0, 1, 2].map((j) => lerp(VOWEL_AA[j], VOWEL_EE[j], k));
      }
      v.formants.forEach((bp, j) => bp.frequency.setTargetAtTime(F[j], now, 0.08));

      v.toneGain.gain.setTargetAtTime(0.55 * (0.3 + 0.7 * energy), now, 0.12);
      v.vibDepth.gain.setTargetAtTime(3 + 6 * energy, now, 0.2);

      // Breath air: inhale = brighter nasal hiss, exhale = warmer open "haaa"
      const centre = inhale ? 2600 + 1200 * hb : 1000 + 900 * hb;
      v.airBP.frequency.setTargetAtTime(centre, now, 0.1);
      v.airGain.gain.setTargetAtTime(0.42 * air, now, 0.06);
    }

    // ---------------------------------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------------------------------
    _scheduleEvents(v, i, n, now, energy, pos) {
      const palette = this.params.palette;
      if (v.nextEvt === 0 || v.nextEvt < now - 0.5) {
        v.nextEvt = now + 0.05 + i * (palette === 'bowl' ? 1.3 : 0.17);
      }
      let guard = 0;
      while (v.nextEvt < now + LOOKAHEAD && guard++ < 24) {
        const t = Math.max(v.nextEvt, now + 0.005);
        let dt;
        if (palette === 'energy') {
          // Vibrant sparkle: rate rises with energy; inhale merges sources so thin out duplicates
          const rate = 2 + 16 * energy * energy;
          this._sparkle(v, t, 0.5 + 0.5 * energy);
          dt = (-Math.log(1 - Math.random() * 0.98) / rate);
        } else if (palette === 'bowl') {
          this._bowl(v, t, i);
          this._ripple(pos, t, i);
          dt = 5.5 + Math.random() * 4;
        } else if (palette === 'drops') {
          this._drop(v, t);
          if (Math.random() < 0.18) this._drop(v, t + 0.05 + Math.random() * 0.08);
          this._ripple(pos, t, i);
          dt = 0.18 + (-Math.log(1 - Math.random() * 0.97)) * 0.32;
        } else {
          this._chime(v, t);
          this._ripple(pos, t, i);
          dt = 0.35 + (-Math.log(1 - Math.random() * 0.97)) * 0.7;
        }
        v.nextEvt = t + dt;
      }
    }

    _ripple(pos, t, i) {
      const r = this.telemetry.spatialRipples;
      r.push({ x: pos.x, y: pos.y, z: pos.z, time: t, voiceIndex: i });
      if (r.length > 40) r.shift();
    }

    _noiseBurst(dest, t, dur, type, freq, q, level) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.0012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      src.start(t, Math.random() * 2.5, dur + 0.02);
    }

    _ping(dest, t, freq, level, tau, attack = 0.002) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + attack);
      g.gain.setTargetAtTime(0, t + attack, tau);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + attack + tau * 6);
      return o;
    }

    /** Energy sparkle: half broadband noise grains (localization), half harmonic glints (beauty). */
    _sparkle(v, t, level) {
      if (Math.random() < 0.55) {
        const f = 3500 * Math.pow(12000 / 3500, Math.random());
        this._noiseBurst(v.input, t, 0.004 + Math.random() * 0.012, 'bandpass', f, 1.2 + Math.random() * 2, 0.22 * level);
      } else {
        const harm = [12, 15, 16, 18, 20, 24, 27, 30, 32][Math.floor(Math.random() * 9)];
        this._ping(v.input, t, ENERGY_ROOT * harm, 0.05 * level, 0.03 + Math.random() * 0.06);
      }
    }

    /** Burst of energy at the crown when the exhale begins (REBAL). */
    _crownBurst(now) {
      if (this.params.palette !== 'energy') return;
      const n = this.params.count;
      for (let k = 0; k < 22; k++) {
        const v = this.voices[k % n];
        const t = now + 0.01 + Math.pow(Math.random(), 1.6) * 0.45;
        this._sparkle(v, t, 1.1);
      }
      const tv = this.telemetry.spatialVoices[0];
      this._ripple({ x: 0, y: REBAL_CROWN_Y, z: 0 }, now, 0);
      tv.burstTime = now;
    }

    /** Struck singing bowl: real bowl partial ratios with beating pairs + felt-mallet transient. */
    _bowl(v, t, i) {
      const f0 = BOWL_FREQS[i % BOWL_FREQS.length];
      const partials = [
        [1.0, 0.5, 6.0, 0.6],
        [2.71, 0.2, 3.2, 1.1],
        [5.15, 0.085, 1.7, 0],
        [8.43, 0.035, 0.8, 0]
      ];
      partials.forEach(([ratio, amp, tau, beat]) => {
        this._ping(v.input, t, f0 * ratio, amp, tau, 0.004);
        if (beat > 0) this._ping(v.input, t, f0 * ratio + beat, amp * 0.7, tau * 0.9, 0.004);
      });
      this._noiseBurst(v.input, t, 0.012, 'lowpass', 3000, 0.7, 0.25);
      this._noiseBurst(v.input, t, 0.004, 'highpass', 6000, 0.7, 0.08);
    }

    /** Minnaert bubble water drop: rising sine chirp + tiny surface click. */
    _drop(v, t) {
      const ctx = this.ctx;
      const f0 = 650 * Math.pow(4, Math.random());
      const dur = clamp(0.05 * (1500 / f0), 0.025, 0.12);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.35 + Math.random() * 0.7), t + dur);
      const g = ctx.createGain();
      const lvl = 0.22 + Math.random() * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + 0.0008);
      g.gain.setTargetAtTime(0, t + 0.0015, dur / 3);
      o.connect(g);
      g.connect(v.input);
      o.start(t);
      o.stop(t + dur * 2.2);
      this._noiseBurst(v.input, t, 0.003, 'highpass', 2500, 0.7, lvl * 0.35);
    }

    /** Crystal chime: bright harmonic glass ping + strike click. */
    _chime(v, t) {
      let idx;
      do { idx = Math.floor(Math.random() * CHIME_FREQS.length); } while (idx === this.lastChime && CHIME_FREQS.length > 1);
      this.lastChime = idx;
      const f = CHIME_FREQS[idx];
      const lvl = 0.12 + Math.random() * 0.08;
      [[1, 1, 1.4], [2, 0.3, 0.7], [3, 0.12, 0.4], [4.2, 0.05, 0.22]].forEach(([r, a, tau]) => {
        this._ping(v.input, t, f * r, lvl * a, tau, 0.0015);
      });
      this._noiseBurst(v.input, t, 0.003, 'bandpass', 7000, 1.0, lvl * 0.6);
    }

    // ---------------------------------------------------------------------------------------------
    // Parameter updates
    // ---------------------------------------------------------------------------------------------
    update(key, val) {
      const now = this.ctx.currentTime;
      this._normalizeParams();
      const p = this.params;
      this.out.gain.setTargetAtTime(p.enabled ? p.gain * OUTPUT_LEVEL : 0, now, 0.06);

      if (key === 'room') {
        this.roomIn.gain.setTargetAtTime(this._roomSendLevel(p.room), now, 0.08);
      } else if (key === 'palette') {
        this._applyPalette();
      } else if (key === 'trajectory' || key === 'count') {
        if (key === 'trajectory') {
          this.phase = 0;
          this.lastCycleIdx = -1;
        }
        this.telemetry.spatialVoices.forEach((tv) => { tv.trail = []; });
      }
    }
  }

  Spatial3DModule.PALETTES = PALETTES;
  Spatial3DModule.TRAJECTORIES = TRAJECTORIES;
  Spatial3DModule.REBAL_CROWN_Y = REBAL_CROWN_Y;
  Spatial3DModule.REBAL_FEET_Y = REBAL_FEET_Y;
  Spatial3DModule.EAR_HEIGHT = EAR_HEIGHT;

  window.Spatial3DModule = Spatial3DModule;
})();
