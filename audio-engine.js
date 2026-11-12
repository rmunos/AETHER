/**
 * AETHER // Real-time WebAudio engine (core)
 *
 *  01 3D sound space & REBAL ........ spatial-engine.js (+ binaural-renderer.js)
 *  02 Edge-of-chaos melody .......... modules-a.js
 *  03 Binaural beat & θ–γ shimmer ... modules-a.js
 *  04 Shepard–Risset horizon ........ modules-a.js
 *  05 Somatic sub-bass .............. modules-b.js
 *  06 Sound textures (surf, cavern, rain, wind) ... modules-b.js
 *  07 Close-up & ritual (whisper, taps, drum, overtone chant) ... modules-b.js
 *
 * Signal flow: modules -> dryBus / reverb send (hall + shimmer) -> mixBus -> limiter -> master -> output.
 *              binaural renderer -> spatialBus (+ natural room reverb) -> mixBus.
 * Renderer slots: 0-5 Module 01 streams, 6-8 chaos events, 9-11 close-up & ritual, 12 ear-model calibration.
 */
class ConsciousnessAudioEngine {
  constructor() {
    this.ctx = null;
    this.isRunning = false;
    this.offline = false;
    this.nodes = {};
    this.params = {
      masterGain: 0.65,
      reverbMix: 0.4,
      root: 108, // tonal centre (Hz): every module is tuned to it
      breath: { rate: 6, inhale: 0.45, holdIn: 0, holdOut: 0 },
      spatial: {
        enabled: true, palette: 'breath', trajectory: 'rebal', rebalMode: 'program', count: 2, gain: 0.9,
        speed: 0.08, distance: 1.9, room: 0.45, cue: 1.0, turns: 1.25, twist: 0, innerSwirl: 0.5, intensity: 0.6,
        fountainBreaths: 6, spiralBreaths: 6, renderer: 'structural', earModel: null, manualPos: null
      },
      chaos: { enabled: false, palette: 'hybrid', rhythm: 'avalanche', scale: 'pentatonic', gain: 0.55, r: 3.74, rate: 2.6, register: 0.45, morph: 0.6, space3d: true },
      pac: { enabled: false, gain: 0.45, baseFreq: 108, harmonics: 0.35, theta: 6.0, gamma: 40, depth: 0.5, breath: 0.6 },
      fractal: { enabled: false, gain: 0.4, speed: 0.04, depth: 0.55, center: 216 },
      sub: { enabled: false, gain: 0.45, freq: 27, pattern: 'breath', pulse: 1.0, warmth: 0.45 },
      ganzfeld: { enabled: false, gain: 0.35, texture: 'surf', color: 0.55, sweep: 0.5 },
      asmr: { enabled: false, gain: 0.5, palette: 'whisper', proximity: 0.3, rate: 3.0, resonance: 0.6 }
    };
    this.telemetry = {
      breathPhase: 0, breathValue: 0, breathStage: 'inhale', breathP: 0, breathCycle: 0,
      thetaPhase: 0, gammaEnvelope: 0, pacIndex: 0, bayesianSurprise: 0, lastChaosX: 0.412,
      chaosBins: new Array(16).fill(1), recentDroplets: [], spatialRipples: [], spatialVoices: [], shepardVoices: []
    };
  }

  static get MODULES() {
    return ['spatial', 'chaos', 'pac', 'fractal', 'sub', 'ganzfeld', 'asmr'];
  }

  async init(ctxOverride) {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = ctxOverride || new AudioCtx({ latencyHint: 'playback' });
    this.offline = !!ctxOverride;
    const ctx = this.ctx;
    if (!this.offline) {
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended' && this.isRunning) ctx.resume().catch(() => {});
      };
    }
    this.startTime = ctx.currentTime;

    // ---- master chain
    this.mixBus = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.3;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.offline ? this.params.masterGain : 0.0001;
    // final safety stage: transparent below 0.8, smooth saturation up to full scale (no hard digital clipping)
    this.softClip = ctx.createWaveShaper();
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 4 - 2;
      const ax = Math.abs(x);
      curve[i] = Math.sign(x) * (ax <= 0.8 ? ax : 0.8 + 0.2 * Math.tanh((ax - 0.8) / 0.2));
    }
    this.softClip.curve = curve;
    this.softClip.oversample = '2x';
    // a WaveShaper maps the input range [-1, 1] onto the whole curve: halve the signal so the curve spans [-2, 2]
    this.clipPre = ctx.createGain();
    this.clipPre.gain.value = 0.5;
    this.mixBus.connect(this.limiter);
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.clipPre);
    this.clipPre.connect(this.softClip);
    this.analyserMaster = ctx.createAnalyser();
    this.analyserMaster.fftSize = 2048;
    this.analyserMaster.smoothingTimeConstant = 0.82;
    this.softClip.connect(this.analyserMaster);
    this.analyserMaster.connect(ctx.destination);
    const split = ctx.createChannelSplitter(2);
    this.analyserL = ctx.createAnalyser();
    this.analyserR = ctx.createAnalyser();
    this.analyserL.fftSize = 1024;
    this.analyserR.fftSize = 1024;
    this.softClip.connect(split);
    split.connect(this.analyserL, 0);
    split.connect(this.analyserR, 1);

    // ---- dry bus + hall reverb with a shimmer of resonators tuned to the tonal centre
    this.dryBus = ctx.createGain();
    this.dryBus.connect(this.mixBus);
    this.reverbSendGain = ctx.createGain();
    this.reverbNode = ctx.createConvolver();
    this.reverbNode.normalize = false;
    this.reverbNode.buffer = this._impulse(3.6, 3.0, 0.028, 0.9);
    this.reverbReturn = ctx.createGain();
    this.reverbSendGain.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbReturn);
    this.reverbReturn.connect(this.mixBus);
    this.shimmerGain = ctx.createGain();
    this.shimmerGain.connect(this.reverbNode);
    this.shimmerVoices = [5, 6, 7.5, 10, 12, 15].map((h, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = this.params.root * h;
      bp.Q.value = 28;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      const pan = ctx.createStereoPanner();
      pan.pan.value = i % 2 ? 0.6 : -0.6;
      this.reverbSendGain.connect(bp);
      bp.connect(g);
      g.connect(pan);
      pan.connect(this.shimmerGain);
      return { bp, g, h, rate: 0.031 + 0.013 * i, phase: i * 1.3 };
    });
    this.setReverbMix(this.params.reverbMix);

    // ---- binaural renderer + natural room for spatialised sources
    this.renderer = new window.AetherBinaural.BinauralRenderer(ctx, { sources: 13 });
    await this.renderer.init();
    this.spatialBus = ctx.createGain();
    this.spatialBus.connect(this.mixBus);
    this.renderer.output.connect(this.spatialBus);
    this.roomVerb = ctx.createConvolver();
    this.roomVerb.normalize = false;
    this.roomVerb.buffer = this._impulse(1.5, 1.15, 0.03, 0.55);
    this.renderer.reverbSend.connect(this.roomVerb);
    this.roomVerb.connect(this.spatialBus);

    // ---- shared breath clock
    this.breath = new window.AetherBreathClock(this.params.breath);
    this.breath.advance(ctx.currentTime);

    // ---- modules
    this.nodes.spatial = new window.Spatial3DModule(this);
    this.nodes.spatial.applyRendererConfig();
    const M = window.AetherModules;
    this.nodes.chaos = new M.ChaosModule(this);
    this.nodes.pac = new M.BinauralBeatModule(this);
    this.nodes.fractal = new M.ShepardModule(this);
    this.nodes.sub = new M.SomaticModule(this);
    this.nodes.ganzfeld = new M.TextureModule(this);
    this.nodes.asmr = new M.RitualModule(this);
    for (const key of ConsciousnessAudioEngine.MODULES) this.nodes[key].update('init');
  }

  /** Stereo impulse response: early reflections + decorrelated exponentially decaying noise with HF damping. */
  _impulse(seconds, rt60, preDelay, level) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    const pre = Math.floor(rate * preDelay);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let k = 0; k < 10; k++) {
        const t = preDelay * 0.4 + Math.pow(Math.random(), 1.3) * 0.07;
        const i = Math.floor(t * rate);
        if (i < len) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - 0.3 * (t / 0.08)) * level;
      }
      let lp = 0;
      let e = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / rate;
        const env = Math.exp((-6.91 * t) / rt60) * (1 - Math.exp(-t / 0.02));
        const damp = Math.min(0.93, 0.25 + 0.68 * (t / rt60)); // brighter early, darker late
        lp = lp * damp + (Math.random() * 2 - 1) * (1 - damp);
        d[i] += lp * env * level;
        e += d[i] * d[i];
      }
      const norm = 1 / Math.sqrt(e / rate + 1e-9) * 0.18;
      for (let i = 0; i < len; i++) d[i] *= norm;
    }
    return buf;
  }

  async start() {
    if (!this.ctx) await this.init();
    if (this.ctx.state === 'suspended' && !this.offline) await this.ctx.resume();
    this.isRunning = true;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.params.masterGain, now, 0.6);
  }

  stop() {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.35);
    this.isRunning = false;
  }

  tick() {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;
    const elapsed = now - this.startTime;
    const isBg = typeof document !== 'undefined' && document.hidden;
    // breath clock runs LOOKAHEAD ahead (spatial scheduling); everything else reads the phase heard now
    this.breath.advance(now + window.Spatial3DModule.LOOKAHEAD);
    const bNow = this.breath.state(this.breath.phaseAt(now));
    const t = this.telemetry;
    t.breathStage = bNow.stage;
    t.breathP = bNow.p;
    t.breathCycle = bNow.cycle;
    t.breathValue = 2 * bNow.lung - 1;
    t.breathLung = bNow.lung;
    t.breathPhase = this.breath.phaseAt(now);
    for (const key of ConsciousnessAudioEngine.MODULES) {
      const m = this.nodes[key];
      if (m) m.tick(now, elapsed, isBg, bNow);
    }
    if (this.shimmerVoices && !isBg && this.params.reverbMix > 0.02) {
      this.shimmerVoices.forEach((v) => {
        const a = 0.5 + 0.5 * Math.sin(elapsed * v.rate * Math.PI * 2 + v.phase);
        v.g.gain.setTargetAtTime(0.12 + 0.6 * a * a, now, 0.3);
      });
    }
  }

  // ------------------------------------------------------------------ parameter API
  setMasterGain(val) {
    this.params.masterGain = val;
    if (this.ctx && this.isRunning) this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
  }

  setReverbMix(val) {
    this.params.reverbMix = val;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.reverbSendGain.gain.setTargetAtTime(val * 1.4, now, 0.08);
    this.shimmerGain.gain.setTargetAtTime(Math.pow(val, 1.3) * 0.9, now, 0.08);
    this.dryBus.gain.setTargetAtTime(1 - val * 0.35, now, 0.08);
  }

  setRoot(hz) {
    this.params.root = hz;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.shimmerVoices.forEach((v) => v.bp.frequency.setTargetAtTime(hz * v.h, now, 0.2));
    for (const key of ConsciousnessAudioEngine.MODULES) {
      const m = this.nodes[key];
      if (m && m.update) m.update('root', hz);
    }
  }

  setBreath(key, val) {
    this.params.breath[key] = val;
  }

  updateModule(mod, key, val) {
    if (!this.params[mod]) return;
    this.params[mod][key] = val;
    if (!this.ctx) return;
    const m = this.nodes[mod];
    if (m && m.update) m.update(key, val);
  }
}

window.ConsciousnessAudioEngine = ConsciousnessAudioEngine;
