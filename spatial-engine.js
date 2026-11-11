/**
 * AETHER // MODULE 1 — High-Precision 3D Binaural Spatializer & REBAL Energy Torus
 *
 * Implements an explicit, psychoacoustically validated dual-ear binaural engine:
 *  1. Left / Right Localization:
 *     - Exact spherical Woodworth ITD (Interaural Time Difference): 0 to 660 µs delay
 *     - Acoustic Head Shadow ILD (Interaural Level Difference): up to -18 dB high-frequency attenuation
 *     - Contralateral head-shadow low-pass filter (20 kHz down to 1.6 kHz)
 *     - Dedicated ChannelMerger(2) ensuring 100% pure stereo channel isolation
 *  2. Front / Back Discrimination:
 *     - Front (+Z < 0): concha resonance boost (+3.5 dB at 3.6 kHz), open air up to 18 kHz
 *     - Back (+Z > 0): pinna flap obstruction filter (steep 2nd-order low-pass down to 3.5 kHz, -8 dB notch at 7 kHz)
 *  3. Up (Zenith / Crown) vs. Down (Ground / Feet):
 *     - Up (+Y > 0): open-sky zenith brilliance (+8 dB at 8 kHz), low-frequency chest decoupling (-6 dB),
 *       vocal formant ascent ("oo" -> "aa" -> "ee"), and Pratt pitch-height elevation lift (+2 semitones)
 *     - Down (-Y < 0): torso/jaw acoustic shadow (low-pass down to 1.8 kHz), chest cavity resonance (+8 dB at 180 Hz),
 *       dark "oo/om" vowel formant, and grounded pitch anchoring (-2 semitones)
 *  4. Monroe Gateway REBAL Apple-Torus Trajectory:
 *     - Exhale (0 -> 50% cycle): Energy bursts out of the crown (+Y), arcs HIGH above the head (+1.5m),
 *       splits left & right, spirals DOWN outside the body passing ear level to below the feet (-Y).
 *     - Inhale (50 -> 100% cycle): Merged energy enters the soles of the feet, rises straight UP the body core
 *       through the spine into the cranium, building in luminance and radiance!
 */

(function () {
  const MAX_VOICES = 4;
  const SPEED_OF_SOUND = 343; // m/s
  const HEAD_RADIUS = 0.0875; // average human head radius (8.75 cm)
  const LOOKAHEAD = 0.12;

  // REBAL body geometry (metres, listener's ears at origin [0, 0, 0])
  const REBAL_CROWN_Y = 0.22;   // top of the head
  const REBAL_FEET_Y = -1.65;   // ground/feet level

  const PALETTES = ['energy', 'bowl', 'drops', 'chimes'];
  const TRAJECTORIES = ['rebal', 'orbit', 'vertical', 'sphere', 'manual'];

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

  // Consonant sacred ratios (Root 108 Hz foundation: Root, 5th, Octave, 12th)
  const REBAL_ROOT = 108.0;
  const REBAL_RATIOS = [1.0, 1.5, 2.0, 3.0];
  const BOWL_FREQS = [216.0, 270.0, 324.0, 432.0];
  const CHIME_FREQS = [540.0, 648.0, 756.0, 864.0, 1080.0, 1296.0, 1512.0, 1728.0];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

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

    _normalizeParams() {
      const p = this.params;
      if (PALETTE_ALIASES[p.palette]) p.palette = PALETTE_ALIASES[p.palette];
      if (!PALETTES.includes(p.palette)) p.palette = 'energy';
      if (TRAJECTORY_ALIASES[p.trajectory]) p.trajectory = TRAJECTORY_ALIASES[p.trajectory];
      if (!TRAJECTORIES.includes(p.trajectory)) p.trajectory = 'rebal';
      p.count = clamp(Math.round(p.count || 2), 1, MAX_VOICES);
      p.gain = clamp(p.gain !== undefined ? p.gain : 0.85, 0, 1);
      p.speed = clamp(p.speed !== undefined ? p.speed : 0.1, 0.02, 0.5);
      p.distance = clamp(p.distance !== undefined ? p.distance : 1.8, 0.5, 4);
      p.room = clamp(p.room !== undefined ? p.room : 0.15, 0, 1); // pristine direct sound default
      p.spiral = clamp(p.spiral !== undefined ? p.spiral : 0, 0, 2);
    }

    _build() {
      const ctx = this.ctx;
      const p = this.params;

      // Master output of spatial module
      this.out = ctx.createGain();
      this.out.gain.value = p.enabled ? p.gain : 0;

      // Stereo bus summing all 3D voices
      this.sumL = ctx.createGain();
      this.sumR = ctx.createGain();
      this.merger = ctx.createChannelMerger(2);

      this.sumL.connect(this.merger, 0, 0); // Left channel
      this.sumR.connect(this.merger, 0, 1); // Right channel
      this.merger.connect(this.out);
      this.out.connect(this.engine.spatialDryBus);

      // Clean, subtle early-reflection room for externalization
      this.roomIn = ctx.createGain();
      this.roomIn.gain.value = p.room * 0.25;
      this.room = ctx.createConvolver();
      this.room.normalize = false;
      this.room.buffer = this._createRoomImpulse(0.5);
      this.roomIn.connect(this.room);
      this.room.connect(this.out);

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

      // Voice core input (all sound generators for this source feed into here)
      v.input = ctx.createGain();
      v.input.gain.value = 0;

      // 1. Distance Attenuation & Air Absorption
      v.distGain = ctx.createGain();
      v.distGain.gain.value = 1.0;
      v.airLP = ctx.createBiquadFilter();
      v.airLP.type = 'lowpass';
      v.airLP.frequency.value = 18000;
      v.airLP.Q.value = 0.5;

      // 2. Front vs. Back Spectral Shaping (Pinna Obstruction)
      v.frontBackLP = ctx.createBiquadFilter();
      v.frontBackLP.type = 'lowpass';
      v.frontBackLP.frequency.value = 18000;
      v.frontBackLP.Q.value = 0.707;

      v.frontPeak = ctx.createBiquadFilter();
      v.frontPeak.type = 'peaking';
      v.frontPeak.frequency.value = 3600;
      v.frontPeak.Q.value = 1.2;
      v.frontPeak.gain.value = 0;

      v.backNotch = ctx.createBiquadFilter();
      v.backNotch.type = 'peaking';
      v.backNotch.frequency.value = 7200;
      v.backNotch.Q.value = 2.0;
      v.backNotch.gain.value = 0;

      // 3. Up (Zenith) vs. Down (Floor / Feet) Elevation Shaping
      v.zenithShelf = ctx.createBiquadFilter();
      v.zenithShelf.type = 'highshelf';
      v.zenithShelf.frequency.value = 7500;
      v.zenithShelf.gain.value = 0;

      v.torsoLP = ctx.createBiquadFilter();
      v.torsoLP.type = 'lowpass';
      v.torsoLP.frequency.value = 18000;
      v.torsoLP.Q.value = 0.707;

      v.chestBoost = ctx.createBiquadFilter();
      v.chestBoost.type = 'lowshelf';
      v.chestBoost.frequency.value = 200;
      v.chestBoost.gain.value = 0;

      // Chain common processing
      v.input.connect(v.distGain);
      v.distGain.connect(v.airLP);
      v.airLP.connect(v.frontBackLP);
      v.frontBackLP.connect(v.frontPeak);
      v.frontPeak.connect(v.backNotch);
      v.backNotch.connect(v.zenithShelf);
      v.zenithShelf.connect(v.torsoLP);
      v.torsoLP.connect(v.chestBoost);

      // 4. Dedicated Dual-Ear Binaural Branches (Guaranteed Left/Right Separation)
      // Left Ear Branch:
      v.leftDelay = ctx.createDelay(0.01);
      v.leftDelay.delayTime.value = 0;
      v.leftShadowLP = ctx.createBiquadFilter();
      v.leftShadowLP.type = 'lowpass';
      v.leftShadowLP.frequency.value = 18000;
      v.leftShadowLP.Q.value = 0.707;
      v.leftGain = ctx.createGain();
      v.leftGain.gain.value = 1.0;

      v.chestBoost.connect(v.leftDelay);
      v.leftDelay.connect(v.leftShadowLP);
      v.leftShadowLP.connect(v.leftGain);
      v.leftGain.connect(this.sumL);

      // Right Ear Branch:
      v.rightDelay = ctx.createDelay(0.01);
      v.rightDelay.delayTime.value = 0;
      v.rightShadowLP = ctx.createBiquadFilter();
      v.rightShadowLP.type = 'lowpass';
      v.rightShadowLP.frequency.value = 18000;
      v.rightShadowLP.Q.value = 0.707;
      v.rightGain = ctx.createGain();
      v.rightGain.gain.value = 1.0;

      v.chestBoost.connect(v.rightDelay);
      v.rightDelay.connect(v.rightShadowLP);
      v.rightShadowLP.connect(v.rightGain);
      v.rightGain.connect(this.sumR);

      // Room send (subtle, natural)
      v.chestBoost.connect(this.roomIn);

      // 5. Sound Generators: Breath-Voice & Harmonics (for 'energy' palette)
      v.osc = ctx.createOscillator();
      v.osc.setPeriodicWave(this.voiceWave);
      v.osc.frequency.value = REBAL_ROOT * REBAL_RATIOS[i];

      v.vib = ctx.createOscillator();
      v.vib.frequency.value = 4.8 + i * 0.4;
      v.vibDepth = ctx.createGain();
      v.vibDepth.gain.value = 4;
      v.vib.connect(v.vibDepth);
      v.vibDepth.connect(v.osc.detune);

      v.toneGain = ctx.createGain();
      v.toneGain.gain.value = 0;

      // Vocal Formants ("oo" -> "aa" -> "ee")
      v.formant1 = ctx.createBiquadFilter();
      v.formant1.type = 'bandpass';
      v.formant1.frequency.value = 450;
      v.formant1.Q.value = 6;
      v.formant2 = ctx.createBiquadFilter();
      v.formant2.type = 'bandpass';
      v.formant2.frequency.value = 1100;
      v.formant2.Q.value = 9;

      const f1Gain = ctx.createGain();
      f1Gain.gain.value = 0.9;
      const f2Gain = ctx.createGain();
      f2Gain.gain.value = 0.6;

      v.osc.connect(v.formant1);
      v.formant1.connect(f1Gain);
      f1Gain.connect(v.toneGain);

      v.osc.connect(v.formant2);
      v.formant2.connect(f2Gain);
      f2Gain.connect(v.toneGain);

      // Fundamental warm body
      v.warmth = ctx.createBiquadFilter();
      v.warmth.type = 'lowpass';
      v.warmth.frequency.value = 300;
      v.warmthGain = ctx.createGain();
      v.warmthGain.gain.value = 0.28;
      v.osc.connect(v.warmth);
      v.warmth.connect(v.warmthGain);
      v.warmthGain.connect(v.toneGain);
      v.toneGain.connect(v.input);

      // Organic breath air flow
      v.noise = ctx.createBufferSource();
      v.noise.buffer = this.noiseBuf;
      v.noise.loop = true;
      v.airBP = ctx.createBiquadFilter();
      v.airBP.type = 'bandpass';
      v.airBP.frequency.value = 1800;
      v.airBP.Q.value = 0.8;
      v.airGain = ctx.createGain();
      v.airGain.gain.value = 0;

      v.noise.connect(v.airBP);
      v.airBP.connect(v.airGain);
      v.airGain.connect(v.input);

      const t = ctx.currentTime;
      v.osc.start(t);
      v.vib.start(t);
      v.noise.start(t, Math.random() * 2.0);

      return v;
    }

    _createNoiseBuffer(seconds) {
      const rate = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    _createVoiceWave() {
      // Harmonic series with natural 1/n rolloff (rich in upper partials for pinna decoding)
      const N = 40;
      const real = new Float32Array(N + 1);
      const imag = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) {
        imag[n] = 1.0 / Math.pow(n, 1.05);
      }
      return this.ctx.createPeriodicWave(real, imag);
    }

    _createRoomImpulse(seconds) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        // Early reflections
        for (let k = 0; k < 10; k++) {
          const tMs = 4 + Math.pow(Math.random(), 1.4) * 32;
          const idx = Math.floor((tMs / 1000) * rate);
          const amp = (0.4 - 0.25 * (tMs / 36)) * (Math.random() < 0.5 ? -1 : 1);
          if (idx < len) d[idx] += amp;
        }
        // Soft diffuse tail
        let lp = 0;
        const start = Math.floor(0.015 * rate);
        for (let i = start; i < len; i++) {
          const t = (i - start) / rate;
          const env = Math.exp(-t / 0.12);
          lp = lp * 0.4 + (Math.random() * 2 - 1) * 0.6;
          d[i] += lp * env * 0.18;
        }
      }
      return buf;
    }

    _applyPalette() {
      const now = this.ctx.currentTime;
      const isEnergy = this.params.palette === 'energy';
      this.voices.forEach((v, i) => {
        v.nextEvt = 0;
        v.osc.frequency.setTargetAtTime(REBAL_ROOT * REBAL_RATIOS[i], now, 0.05);
        if (!isEnergy) {
          v.toneGain.gain.setTargetAtTime(0, now, 0.1);
          v.airGain.gain.setTargetAtTime(0, now, 0.1);
        }
      });
    }

    // ---------------------------------------------------------------------------------------------
    // Trajectories: REBAL Apple-Torus, Orbit, Vertical, Sphere, Manual
    // ---------------------------------------------------------------------------------------------
    _rebalPosition(i, n, cycle, cycleIdx) {
      const R = clamp(this.params.distance * 1.1, 1.2, 3.8); // torus horizontal width
      const crownY = REBAL_CROWN_Y;
      const feetY = REBAL_FEET_Y;

      if (cycle < 0.50) {
        // =========================================================
        // EXHALE ▼ (cycle 0.00 .. 0.50 -> u in 0.00 .. 1.00)
        // 1. Fountains UP out of top of head (+0.22m) up to apex (+1.5m)
        // 2. Arcs over the top arch and spirals DOWN wide around the body (passing ear level y=0)
        // 3. Curves underneath the feet (-1.9m) and sweeps into the soles of the feet (-1.65m)
        // =========================================================
        const u = cycle / 0.50; // 0..1
        const pol = u * Math.PI; // 0..PI
        const horizR = R * Math.sin(pol);
        // Dipole torus curve: climbs strongly UP first (+1.45m), then goes DOWN to -1.9m
        const y = 0.22 + 1.25 * Math.sin(pol) - 2.05 * Math.pow(u, 1.35);

        // Branch azimuth: 2 branches split Left (-90°) & Right (+90°); 4 branches split evenly
        let branchAz;
        if (n === 1) branchAz = (cycleIdx % 2 === 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        else if (n === 2) branchAz = (i === 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
        else branchAz = [Math.PI * 0.5, -Math.PI * 0.5, 0, Math.PI][i % 4];

        const spiralAngle = this.params.spiral * Math.PI * 2 * u;
        const totalAz = branchAz + spiralAngle;
        const x = horizR * Math.sin(totalAz);
        const z = -horizR * Math.cos(totalAz);

        return { x, y, z, phase: 'exhale', u };
      }

      // =========================================================
      // INHALE ▲ (cycle 0.50 .. 1.00 -> u in 0.00 .. 1.00)
      // Enters soles of feet (-1.65m), rises straight UP the body core
      // (spine/throat) into the head (+0.1m .. +0.22m), filling the cranium!
      // =========================================================
      const u = (cycle - 0.50) / 0.50; // 0..1
      if (u < 0.80) {
        // Ascending spine from feet to head (x=0, z=0)
        const s = u / 0.80;
        const y = lerp(feetY, crownY - 0.08, s);
        return { x: 0, y, z: -0.05, phase: 'inhale', u };
      }

      // Filling head with energy: glowing resonant swirl inside the skull
      const w = (u - 0.80) / 0.20;
      const swirlAz = (w * 2.5 + i / n) * Math.PI * 2;
      const r = 0.08 * (1 - w * 0.5);
      return { x: r * Math.sin(swirlAz), y: crownY + 0.04 * w, z: -r * Math.cos(swirlAz), phase: 'inhale', u };
    }

    _rebalLabel(phase, u) {
      if (phase === 'exhale') {
        if (u < 0.12) return 'EXHALE ▼ · Bursting out crown of head ▲';
        if (u < 0.35) return 'EXHALE ▼ · Fountaining high overhead & splitting outward';
        if (u < 0.72) return 'EXHALE ▼ · Spiraling down outside your body';
        return 'EXHALE ▼ · Curving underneath the feet';
      }
      if (u < 0.15) return 'INHALE ▲ · Entering soles of the feet ▼';
      if (u < 0.80) return 'INHALE ▲ · Rising up spine & body core ▲';
      return 'INHALE ▲ · Filling head with radiant resonance ✨';
    }

    _position(i, n, t) {
      const p = this.params;
      const R = p.distance;
      const TAU = Math.PI * 2;
      const P = t;

      switch (p.trajectory) {
        case 'orbit': {
          // Horizontal ear-level orbit: sweeps Left, Front, Right, Back
          const th = TAU * (P + i / n);
          const el = 0.10 * Math.sin(TAU * 0.35 * P + i * 1.5);
          return {
            x: R * Math.cos(el) * Math.sin(th),
            y: R * Math.sin(el),
            z: -R * Math.cos(el) * Math.cos(th)
          };
        }
        case 'vertical': {
          // Vertical loop: Front -> Zenith (Above) -> Back -> Nadir (Below)
          const ph = TAU * (P + i / (2 * n));
          const planeAz = [0, Math.PI * 0.5, Math.PI * 0.25, -Math.PI * 0.25][i % 4];
          const horiz = R * Math.cos(ph);
          return {
            x: horiz * Math.sin(planeAz),
            y: R * Math.sin(ph),
            z: -horiz * Math.cos(planeAz)
          };
        }
        case 'sphere': {
          // Full 3D sphere wander
          const az = TAU * (P + i / n) + 0.8 * Math.sin(TAU * 0.5 * P + i);
          const el = 0.25 + 0.9 * Math.sin(TAU * 0.7 * P + i * 2);
          const r = R * (0.85 + 0.25 * Math.sin(TAU * 0.3 * P));
          return {
            x: r * Math.cos(el) * Math.sin(az),
            y: r * Math.sin(el),
            z: -r * Math.cos(el) * Math.cos(az)
          };
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
    // Real-Time 60 FPS Audio & Spatial Modulation Update
    // ---------------------------------------------------------------------------------------------
    tick(now, elapsed, isBg) {
      const p = this.params;
      if (!p.enabled) {
        this.telemetry.spatialVoices.forEach((tv) => { tv.active = false; tv.activeEnergy = 0; });
        this.telemetry.spatialStage.active = false;
        return;
      }

      // Smooth phase accumulator (speed changes never cause jumps)
      const dtTick = clamp(now - (this.lastNow || now), 0, 0.25);
      this.lastNow = now;
      this.phase = (this.phase || 0) + dtTick * p.speed;
      const t = this.phase;

      const traj = p.trajectory;
      const isManual = traj === 'manual';
      const n = isManual ? 1 : p.count;
      const tc = isBg ? 0.08 : 0.025; // responsive, glitch-free audio param time constant
      const isEnergy = p.palette === 'energy';

      // REBAL cycle
      let cycle = 0;
      let cycleIdx = 0;
      if (traj === 'rebal') {
        cycleIdx = Math.floor(t);
        cycle = t - cycleIdx;
        if (cycleIdx !== this.lastCycleIdx) {
          if (this.lastCycleIdx >= 0) this._crownBurst(now);
          this.lastCycleIdx = cycleIdx;
        }
      }

      let stage = null;
      for (let i = 0; i < MAX_VOICES; i++) {
        const v = this.voices[i];
        const tv = this.telemetry.spatialVoices[i];
        const active = i < n;

        // Voice active gain
        v.input.gain.setTargetAtTime(active ? (1.0 / Math.sqrt(n)) * 0.95 : 0, now, 0.15);
        tv.active = active;
        if (!active) {
          tv.activeEnergy = 0;
          if (tv.trail.length) tv.trail = [];
          continue;
        }

        // Compute 3D Coordinates
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
        const d = Math.max(0.08, Math.sqrt(x * x + y * y + z * z));
        const horizDist = Math.max(0.04, Math.sqrt(x * x + z * z));

        // Azimuth theta: -PI (back-left) .. 0 (front) .. +PI (back-right)
        const az = Math.atan2(x, -z);
        // Elevation phi: -PI/2 (floor) .. 0 (ear) .. +PI/2 (zenith)
        const elevRad = Math.atan2(y, horizDist);
        const elevNorm = clamp(elevRad / (Math.PI * 0.5), -1, 1);
        const frontNorm = clamp(-z / d, -1, 1); // +1 = Front, -1 = Back

        // =========================================================================
        // 1. DISTANCE ATTENUATION & HIGH-FREQUENCY AIR ROLLOFF
        // =========================================================================
        const distAtten = 1.0 / (1.0 + 0.45 * Math.max(0, d - 1.0));
        v.distGain.gain.setTargetAtTime(distAtten, now, tc);
        const airFreq = clamp(19000 / (1.0 + 0.3 * Math.max(0, d - 1.0)), 6000, 20000);
        v.airLP.frequency.setTargetAtTime(airFreq, now, tc);

        // =========================================================================
        // 2. FRONT vs. BACK DISCRIMINATION (Pinna Diffraction & Obstruction)
        // =========================================================================
        if (frontNorm >= 0) {
          // Front: Crisp presence and concha boost
          v.frontBackLP.frequency.setTargetAtTime(19000, now, tc);
          v.frontPeak.gain.setTargetAtTime(3.8 * frontNorm, now, tc);
          v.backNotch.gain.setTargetAtTime(0, now, tc);
        } else {
          // Back: Pinna physically shadows high frequencies!
          const backWeight = -frontNorm; // 0..1
          const backCutoff = lerp(18000, 3200, Math.pow(backWeight, 0.8));
          v.frontBackLP.frequency.setTargetAtTime(backCutoff, now, tc);
          v.frontPeak.gain.setTargetAtTime(0, now, tc);
          v.backNotch.gain.setTargetAtTime(-8.5 * backWeight, now, tc);
        }

        // =========================================================================
        // 3. UP (Zenith) vs. DOWN (Floor / Feet) ELEVATION
        // =========================================================================
        if (elevNorm >= 0) {
          // Zenith / Overhead: Open sky high-shelf lift + chest cut
          v.zenithShelf.gain.setTargetAtTime(8.5 * elevNorm, now, tc);
          v.torsoLP.frequency.setTargetAtTime(19000, now, tc);
          v.chestBoost.gain.setTargetAtTime(-6.0 * elevNorm, now, tc);
        } else {
          // Floor / Feet: Torso and jaw shadow highs, boost deep chest warmth
          const downWeight = -elevNorm; // 0..1
          v.zenithShelf.gain.setTargetAtTime(-4.0 * downWeight, now, tc);
          const torsoCutoff = lerp(18000, 1600, Math.pow(downWeight, 0.75));
          v.torsoLP.frequency.setTargetAtTime(torsoCutoff, now, tc);
          v.chestBoost.gain.setTargetAtTime(8.5 * downWeight, now, tc);
        }

        // =========================================================================
        // 4. GUARANTEED DUAL-EAR ITD & ILD (Left / Right Separation)
        // =========================================================================
        // Woodworth formula for spherical head delay:
        const sinAz = Math.sin(Math.abs(az));
        const maxItd = (HEAD_RADIUS / SPEED_OF_SOUND) * (sinAz + Math.abs(az)); // up to 0.66 ms

        let leftDelayTime = 0;
        let rightDelayTime = 0;
        let leftShadowFreq = 19000;
        let rightShadowFreq = 19000;
        let leftGainVal = 1.0;
        let rightGainVal = 1.0;

        if (x > 0) {
          // Sound is to the RIGHT (+X):
          // Right ear is ipsilateral (near): 0 delay, full bandwidth, 0 dB
          // Left ear is contralateral (far): delayed by ITD, shadowed, attenuated by up to -18 dB
          const lat = clamp(x / horizDist, 0, 1);
          leftDelayTime = maxItd * lat;
          leftShadowFreq = lerp(19000, 1500, Math.pow(lat, 0.7));
          leftGainVal = Math.pow(1.0 - 0.75 * lat, 1.3); // down to 0.12 (-18.4 dB)
          rightGainVal = 1.0 + 0.15 * lat; // subtle head-facing lift
        } else if (x < 0) {
          // Sound is to the LEFT (-X):
          // Left ear is ipsilateral (near)
          // Right ear is contralateral (far)
          const lat = clamp(-x / horizDist, 0, 1);
          rightDelayTime = maxItd * lat;
          rightShadowFreq = lerp(19000, 1500, Math.pow(lat, 0.7));
          rightGainVal = Math.pow(1.0 - 0.75 * lat, 1.3);
          leftGainVal = 1.0 + 0.15 * lat;
        }

        v.leftDelay.delayTime.setTargetAtTime(leftDelayTime, now, tc);
        v.rightDelay.delayTime.setTargetAtTime(rightDelayTime, now, tc);
        v.leftShadowLP.frequency.setTargetAtTime(leftShadowFreq, now, tc);
        v.rightShadowLP.frequency.setTargetAtTime(rightShadowFreq, now, tc);
        v.leftGain.gain.setTargetAtTime(leftGainVal, now, tc);
        v.rightGain.gain.setTargetAtTime(rightGainVal, now, tc);

        // =========================================================================
        // 5. PALETTE AUDIO MODULATION & ENERGY SWELL
        // =========================================================================
        let energy = 0.65;
        if (isEnergy) {
          let airLevel = 0.5;
          let pitchMult = 1.0;

          if (traj === 'rebal' && !(p.manualPos && i === 0)) {
            const u = pos.u;
            const inhale = pos.phase === 'inhale';
            if (!inhale) {
              // Exhale: starts explosive at crown, energetic arc over top, smooth flow down
              energy = 1.0 - 0.5 * u;
              airLevel = (1.0 - Math.exp(-u * 8)) * Math.pow(1 - u, 0.6) * 1.2;
              pitchMult = 1.0 + 0.20 * Math.max(0, y / 1.5); // ascends with apex height
            } else {
              // Inhale: starts deep and quiet at feet, builds straight up spine to third eye
              energy = 0.4 + 0.6 * Math.pow(u, 1.5);
              airLevel = Math.pow(u, 1.2) * 1.1;
              pitchMult = 0.85 + 0.35 * Math.pow(u, 1.3); // deep pitch rising up the body
            }
          } else {
            // General breath wave
            const breathPh = (elapsed * 0.1 * Math.PI * 2) % (Math.PI * 2);
            const slope = Math.cos(breathPh + i * 0.7);
            energy = 0.55 + 0.42 * Math.sin(breathPh + i * 0.7);
            airLevel = Math.pow(Math.abs(slope), 1.2) * 0.9;
            pitchMult = 1.0 + 0.12 * elevNorm;
          }

          // Pitch tracking & elevation coupling (Pratt effect)
          const targetFreq = REBAL_ROOT * REBAL_RATIOS[i] * pitchMult;
          v.osc.frequency.setTargetAtTime(targetFreq, now, 0.06);

          // Vocal Formant sweep with elevation ("oo" [below] -> "aa" [ear] -> "ee" [above])
          const normH = clamp((elevNorm + 1) * 0.5, 0, 1);
          const f1 = lerp(320, 680, normH);
          const f2 = lerp(850, 2400, normH);
          v.formant1.frequency.setTargetAtTime(f1, now, 0.08);
          v.formant2.frequency.setTargetAtTime(f2, now, 0.08);

          v.toneGain.gain.setTargetAtTime(0.68 * (0.35 + 0.65 * energy), now, 0.08);
          v.airGain.gain.setTargetAtTime(0.48 * airLevel, now, 0.05);
        }

        tv.activeEnergy = energy;

        // Schedule vibrant energy sparkles / bowls / drops / chimes
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

    // ---------------------------------------------------------------------------------------------
    // Acoustic Sparkles, Bowls, Drops & Chimes (Pinpoint Transients for Auditory Localization)
    // ---------------------------------------------------------------------------------------------
    _scheduleEvents(v, i, n, now, energy, pos) {
      const palette = this.params.palette;
      if (v.nextEvt === 0 || v.nextEvt < now - 0.5) {
        v.nextEvt = now + 0.04 + i * (palette === 'bowl' ? 1.2 : 0.15);
      }

      let guard = 0;
      while (v.nextEvt < now + LOOKAHEAD && guard++ < 24) {
        const t = Math.max(v.nextEvt, now + 0.005);
        let dt;
        if (palette === 'energy') {
          // Vibrant energy sparkle: high-frequency grains that give pinpoint directional ITD/ILD
          const rate = 3 + 14 * energy * energy;
          this._sparkle(v, t, 0.5 + 0.5 * energy);
          dt = (-Math.log(1 - Math.random() * 0.98) / rate);
        } else if (palette === 'bowl') {
          this._bowl(v, t, i);
          this._ripple(pos, t, i);
          dt = 4.8 + Math.random() * 3.5;
        } else if (palette === 'drops') {
          this._drop(v, t);
          if (Math.random() < 0.2) this._drop(v, t + 0.06 + Math.random() * 0.07);
          this._ripple(pos, t, i);
          dt = 0.16 + (-Math.log(1 - Math.random() * 0.97)) * 0.28;
        } else {
          this._chime(v, t);
          this._ripple(pos, t, i);
          dt = 0.3 + (-Math.log(1 - Math.random() * 0.97)) * 0.6;
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
      g.gain.linearRampToValueAtTime(level, t + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      src.start(t, Math.random() * 2.0, dur + 0.015);
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

    _sparkle(v, t, level) {
      if (Math.random() < 0.6) {
        // High-frequency burst across 4-12 kHz (activates human pinna elevation decoding)
        const f = 3800 * Math.pow(12000 / 3800, Math.random());
        this._noiseBurst(v.input, t, 0.005 + Math.random() * 0.012, 'bandpass', f, 1.8 + Math.random() * 1.5, 0.28 * level);
      } else {
        // Harmonic glass chime glint
        const harm = [12, 16, 18, 20, 24, 27, 32][Math.floor(Math.random() * 7)];
        this._ping(v.input, t, REBAL_ROOT * harm, 0.07 * level, 0.035 + Math.random() * 0.05);
      }
    }

    _crownBurst(now) {
      if (this.params.palette !== 'energy') return;
      const n = this.params.count;
      for (let k = 0; k < 24; k++) {
        const v = this.voices[k % n];
        const t = now + 0.01 + Math.pow(Math.random(), 1.5) * 0.45;
        this._sparkle(v, t, 1.25);
      }
      const tv = this.telemetry.spatialVoices[0];
      this._ripple({ x: 0, y: REBAL_CROWN_Y, z: 0 }, now, 0);
      tv.burstTime = now;
    }

    _bowl(v, t, i) {
      const f0 = BOWL_FREQS[i % BOWL_FREQS.length];
      const partials = [
        [1.0, 0.55, 6.0, 0.6],
        [2.71, 0.22, 3.2, 1.2],
        [5.15, 0.09, 1.7, 0],
        [8.43, 0.04, 0.8, 0]
      ];
      partials.forEach(([ratio, amp, tau, beat]) => {
        this._ping(v.input, t, f0 * ratio, amp, tau, 0.003);
        if (beat > 0) this._ping(v.input, t, f0 * ratio + beat, amp * 0.7, tau * 0.9, 0.003);
      });
      this._noiseBurst(v.input, t, 0.01, 'lowpass', 3200, 0.7, 0.28);
      this._noiseBurst(v.input, t, 0.003, 'highpass', 6500, 0.7, 0.1);
    }

    _drop(v, t) {
      const ctx = this.ctx;
      const f0 = 700 * Math.pow(3.5, Math.random());
      const dur = clamp(0.045 * (1500 / f0), 0.02, 0.09);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.4 + Math.random() * 0.6), t + dur);
      const g = ctx.createGain();
      const lvl = 0.25 + Math.random() * 0.2;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl, t + 0.0006);
      g.gain.setTargetAtTime(0, t + 0.0012, dur / 3);
      o.connect(g);
      g.connect(v.input);
      o.start(t);
      o.stop(t + dur * 2.0);
      this._noiseBurst(v.input, t, 0.0025, 'highpass', 3000, 0.7, lvl * 0.4);
    }

    _chime(v, t) {
      let idx;
      do { idx = Math.floor(Math.random() * CHIME_FREQS.length); } while (idx === this.lastChime && CHIME_FREQS.length > 1);
      this.lastChime = idx;
      const f = CHIME_FREQS[idx];
      const lvl = 0.15 + Math.random() * 0.08;
      [[1, 1, 1.4], [2, 0.32, 0.7], [3, 0.12, 0.4], [4.2, 0.05, 0.2]].forEach(([r, a, tau]) => {
        this._ping(v.input, t, f * r, lvl * a, tau, 0.0012);
      });
      this._noiseBurst(v.input, t, 0.0025, 'bandpass', 7500, 1.2, lvl * 0.65);
    }

    update(key, val) {
      const now = this.ctx.currentTime;
      this._normalizeParams();
      const p = this.params;
      this.out.gain.setTargetAtTime(p.enabled ? p.gain : 0, now, 0.05);

      if (key === 'room') {
        this.roomIn.gain.setTargetAtTime(p.room * 0.25, now, 0.06);
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

  window.Spatial3DModule = Spatial3DModule;
})();
