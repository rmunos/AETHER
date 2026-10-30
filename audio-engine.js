/**
 * AETHER // Psychoacoustic & Neurophenomenological WebAudio Engine
 * Real-time synthesis for:
 *  1. Hyper-Spatial "Impossible Geometry" (8-voice 3D HRTF + In-Cranial Phase Collapse)
 *  2. Predictive-Coding "Edge of Chaos" (Logistic Map + Bayesian Surprise Formant Droplets)
 *  3. Cross-Frequency Phase-Amplitude Coupling (Theta-Gamma PAC + Binaural + 0.1 Hz Breath)
 *  4. Fractal & Scale-Invariant Landscape (8-octave Shepard-Risset + Weierstrass 1/f Modulation)
 *  5. Infrasound & Somatic Sub-Bass (Vestibular Pulse + Missing-Fundamental Harmonics)
 *  6. Auditory Ganzfeld & Stochastic Resonance (Decorrelated 3D Pink/Brown Noise Cavern)
 */

class ConsciousnessAudioEngine {
  constructor() {
    this.ctx = null;
    this.isRunning = false;
    this.startTime = 0;

    // Master & spatial reverb nodes
    this.masterGain = null;
    this.compressor = null;
    this.analyserL = null;
    this.analyserR = null;
    this.analyserMaster = null;
    this.reverbNode = null;
    this.reverbSendGain = null;
    this.dryBus = null;

    // Parameters state
    this.params = {
      masterGain: 0.70,
      reverbMix: 0.55,

      spatial: {
        enabled: true,
        trajectory: 'infinity', // 'infinity' | 'radial' | 'mixed' | 'circle' | 'spiral' | 'torus'
        count: 2,               // 1..8 active 3D sources
        baseFreq: 82,           // 36..320 Hz base fundamental pitch
        gain: 0.80,
        speed: 0.18,
        pulse: 0.0,             // 0 = completely smooth continuous sound, 1 = rhythmic pulse
        collapse: 0.0,          // 0 = completely off, 1 = full in-cranial phase core
        asymmetry: 0.85,
        tuning: 'octaves',
        manualPos: null         // {x, y, z} when user drags on 3D canvas
      },
      chaos: {
        enabled: true,
        palette: 'hybrid',      // 'hybrid' | 'metallic' | 'liquid' | 'plucked' | 'subglitch' | 'breath'
        rhythm: 'avalanche',    // 'avalanche' | 'lorenz' | 'polyrhythm' | 'elastic' | 'stochastic'
        scale: 'chromatic12',   // 'chromatic12' | 'dorian' | 'lydian' | 'pentatonic' | 'phrygian'
        gain: 0.65,
        r: 3.74,
        rate: 3.8,
        register: 0.45,         // 0 = deep sub/low, 0.45 = wide multi-octave, 1 = high crystalline
        morph: 0.72
      },
      pac: {
        enabled: true,
        gain: 0.55,
        baseFreq: 136.0,        // 55..432 Hz selectable base carrier frequency
        theta: 6.0,
        gamma: 40.0,
        depth: 0.75,
        breath: 0.60
      },
      fractal: {
        enabled: false,
        gain: 0.40,
        speed: 0.06,
        depth: 0.65,
        center: 220
      },
      sub: {
        enabled: true,
        gain: 0.50,
        freq: 34.0,
        pulse: 1.6,
        warmth: 0.45
      },
      ganzfeld: {
        enabled: true,
        gain: 0.30,
        color: 0.62,
        sweep: 0.55
      }
    };

    // Internal synthesis state & telemetry for visualizers
    this.telemetry = {
      breathPhase: 0,      // 0..2PI (0.1 Hz)
      breathValue: 0,      // -1..1
      thetaPhase: 0,
      gammaEnvelope: 0,
      pacIndex: 0.75,
      bayesianSurprise: 1.85,
      lastChaosX: 0.412,
      chaosHistory: [],
      chaosBins: new Array(16).fill(1), // Laplace smoothed histogram for Bayesian surprise
      recentDroplets: [],
      spatialVoices: [],   // {x, y, z, freq, index, normAmp}
      shepardVoices: []    // {octavePos, freq, amp}
    };

    this.tuningRatios = {
      octaves: [1, 1.5, 2, 2.5, 3, 4, 5, 6],
      just: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2],
      golden: [1, 1.27202, 1.61803, 2.05817, 2.61803, 3.33019, 4.23607, 5.38836],
      overtone: [1, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75],
      quartal: [1, 4 / 3, 3 / 2, 16 / 9, 9 / 4, 8 / 3, 3.0, 16 / 5]
    };

    this.nodes = {};
    this.chaosTimer = null;
  }

  async init() {
    if (this.ctx) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    this.startTime = this.ctx.currentTime;

    // Create Master Bus, Safety Limiter, Analysers & Algorithmic Cathedral Reverb
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0001;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.015;
    this.compressor.release.value = 0.25;

    this.dryBus = this.ctx.createGain();
    this.dryBus.gain.value = 1.0;

    // Separate always-dry bus for the 3D HRTF module (never ducked by the cathedral space)
    this.spatialDryBus = this.ctx.createGain();
    this.spatialDryBus.gain.value = 1.0;

    this.reverbSendGain = this.ctx.createGain();
    this.reverbSendGain.gain.value = this._reverbSendLevel(this.params.reverbMix);

    // High-density diffused cathedral convolver
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this._createCathedralImpulse(6.5, 2.4);

    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 1.0;

    // ACTIVE CATHEDRAL SHIMMER HALO GENERATOR:
    // Authentic ambient shimmer (Strymon / Eno / Eventide) combines a diffused hall space
    // with a celestial, breathing just-intonation crystal choir (C5, G5, C6, E6, G6, B6).
    // Driven by multi-octave harmonic sine oscillators with slow organic chorusing & pitch-drift,
    // smoothed directly into the stereo cathedral field.
    this.shimmerGain = this.ctx.createGain();
    this.shimmerGain.gain.value = this._shimmerLevel(this.params.reverbMix);

    this.shimmerFilter = this.ctx.createBiquadFilter();
    this.shimmerFilter.type = 'lowpass';
    this.shimmerFilter.frequency.value = 4800;

    this.shimmerVoices = [];
    const shimmerNotes = [
      { f: 523.25, pan: -0.75, rate: 0.045, depth: 1.8 },  // C5 (Root)
      { f: 654.06, pan: 0.65,  rate: 0.038, depth: 1.4 },  // E5 (Major 3rd)
      { f: 784.88, pan: -0.55, rate: 0.052, depth: 2.1 },  // G5 (Perfect 5th)
      { f: 1046.50, pan: 0.75, rate: 0.033, depth: 2.4 },  // C6 (Octave)
      { f: 1308.13, pan: -0.65, rate: 0.041, depth: 2.8 }, // E6 (High 3rd)
      { f: 1569.75, pan: 0.55, rate: 0.029, depth: 3.2 }   // G6 (High 5th)
    ];

    shimmerNotes.forEach((note, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const pan = this.ctx.createStereoPanner();

      osc.type = 'sine';
      osc.frequency.value = note.f;
      g.gain.value = 0.0;
      pan.pan.value = note.pan;

      osc.connect(g);
      g.connect(pan);
      pan.connect(this.shimmerFilter);
      osc.start();

      this.shimmerVoices.push({
        osc,
        g,
        baseFreq: note.f,
        rate: note.rate,
        depth: note.depth,
        phase: i * 1.15
      });
    });

    this.shimmerFilter.connect(this.shimmerGain);
    this.shimmerGain.connect(this.reverbNode);
    // Also feed a direct clean shimmer branch so the celestial sheen is bright & crystal-clear
    this.cleanShimmerGain = this.ctx.createGain();
    this.cleanShimmerGain.gain.value = 0.45;
    this.shimmerGain.connect(this.cleanShimmerGain);
    this.cleanShimmerGain.connect(this.compressor);

    // Stereo Split Analysers for Lissajous & Spectrum
    const splitter = this.ctx.createChannelSplitter(2);
    this.analyserL = this.ctx.createAnalyser();
    this.analyserR = this.ctx.createAnalyser();
    this.analyserMaster = this.ctx.createAnalyser();
    this.analyserL.fftSize = 1024;
    this.analyserR.fftSize = 1024;
    this.analyserMaster.fftSize = 2048;
    this.analyserMaster.smoothingTimeConstant = 0.82;

    this.dryBus.gain.value = this._dryLevel(this.params.reverbMix);
    this.dryBus.connect(this.compressor);
    this.spatialDryBus.connect(this.compressor);
    this.reverbSendGain.connect(this.reverbNode);
    this.shimmerGain.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbReturn);
    this.reverbReturn.connect(this.compressor);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyserMaster);
    this.analyserMaster.connect(this.ctx.destination);

    this.masterGain.connect(splitter);
    splitter.connect(this.analyserL, 0);
    splitter.connect(this.analyserR, 1);

    // Configure 3D Listener at origin facing forward (-Z), up (+Y)
    if (this.ctx.listener.positionX) {
      this.ctx.listener.positionX.value = 0;
      this.ctx.listener.positionY.value = 0;
      this.ctx.listener.positionZ.value = 0;
      this.ctx.listener.forwardX.value = 0;
      this.ctx.listener.forwardY.value = 0;
      this.ctx.listener.forwardZ.value = -1;
      this.ctx.listener.upX.value = 0;
      this.ctx.listener.upY.value = 1;
      this.ctx.listener.upZ.value = 0;
    } else if (this.ctx.listener.setPosition) {
      this.ctx.listener.setPosition(0, 0, 0);
      if (this.ctx.listener.setOrientation) {
        this.ctx.listener.setOrientation(0, 0, -1, 0, 1, 0);
      }
    }

    // Build all 6 synthesis modules
    this._setupSpatialModule();
    this._setupChaosModule();
    this._setupPACModule();
    this._setupFractalModule();
    this._setupSubBassModule();
    this._setupGanzfeldModule();
  }

  async start() {
    if (!this.ctx) {
      await this.init();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.isRunning = true;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.params.masterGain, now, 0.4);
  }

  stop() {
    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0.0001, now, 0.25);
    this.isRunning = false;
  }

  /**
   * Generates a lush stereo velvet-noise + shimmer diffused impulse response
   */
  _createCathedralImpulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let lpL = 0;
    let lpR = 0;
    // Pre-delay (~35 ms) so the tail is perceived as a large distant space, separate from the dry sound
    const preDelay = Math.floor(rate * 0.035);
    for (let i = 0; i < length; i++) {
      if (i < preDelay) {
        left[i] = 0;
        right[i] = 0;
        continue;
      }
      const t = (i - preDelay) / rate;
      const env = Math.pow(1 - i / length, decay) * (1 - Math.exp(-t * 14));
      // Progressive darkening: bright early reflections, warm late tail
      const damp = 0.35 + 0.55 * (i / length);
      const whiteL = Math.random() * 2 - 1;
      const whiteR = Math.random() * 2 - 1;
      lpL = lpL * damp + whiteL * (1 - damp);
      lpR = lpR * damp + whiteR * (1 - damp);
      left[i] = lpL * env * 0.55;
      right[i] = lpR * env * 0.55;
    }
    return impulse;
  }

  // Cathedral Shimmer Space mapping (0..1): wet send, shimmer choir, and gentle dry ducking
  _reverbSendLevel(mix) {
    return mix * 1.6;
  }

  _shimmerLevel(mix) {
    // Responsive curve: clearly present from 20% upward, rich and celestial at 50-100%
    return Math.pow(mix, 1.2) * 1.5;
  }

  _dryLevel(mix) {
    return 1.0 - mix * 0.5;
  }

  /**
   * MODULE 1: Hyper-Spatial "Impossible Geometry"
   * Configurable 1-8 HRTF 3D sources with steady non-oscillating low-to-mid pitch,
   * selectable 3D geometries (Figure-8 through head, Far-Horizon ray, Circle, Mixed),
   * Front/Back Pinna Shadowing, Elevation Filtering & strictly cancellable In-Cranial Core
   */
  _setupSpatialModule() {
    const bus = this.ctx.createGain();
    const initialGain = this.params.spatial.enabled ? this.params.spatial.gain * 0.52 : 0.0001;
    bus.gain.value = initialGain;
    // Connect 100% DRY so no centered reverb tail ever bleeds into the middle of the head
    bus.connect(this.spatialDryBus);

    // Shared steady pink-filtered air buffer for subtle pinna localization cues on low notes
    const rate = this.ctx.sampleRate;
    const noiseLen = rate * 4;
    const pinnaNoiseBuf = this.ctx.createBuffer(1, noiseLen, rate);
    const noiseData = pinnaNoiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < noiseLen; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + w * 0.08;
      b1 = 0.95 * b1 + w * 0.12;
      b2 = 0.80 * b2 + w * 0.20;
      noiseData[i] = (b0 + b1 + b2) * 0.18;
    }

    const baseFreq = this.params.spatial.baseFreq;
    const ratios = this.tuningRatios[this.params.spatial.tuning] || this.tuningRatios.octaves;
    const voices = [];

    for (let i = 0; i < 8; i++) {
      const osc = this.ctx.createOscillator();
      const bodyOsc = this.ctx.createOscillator();
      const bodyFilter = this.ctx.createBiquadFilter();
      const bodyGain = this.ctx.createGain();

      const noiseSrc = this.ctx.createBufferSource();
      const noiseBand = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();

      // Front/Back Pinna Shadow Filter (opens in front z<0, shadows behind head z>0)
      const shadowFilter = this.ctx.createBiquadFilter();
      // Elevation Pinna Cue Filter (7.2 kHz boost above head y>0, notch below y<0)
      const elevFilter = this.ctx.createBiquadFilter();

      const voiceGain = this.ctx.createGain();
      const pulseGain = this.ctx.createGain();
      const panner = this.ctx.createPanner();

      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.35;
      panner.maxDistance = 25;
      panner.rolloffFactor = 1.55;

      const freq = baseFreq * ratios[i];
      // Pure steady sine fundamental (no detuned beating!)
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Warm sawtooth harmonic body at the EXACT same frequency (zero beating oscillation)
      bodyOsc.type = 'sawtooth';
      bodyOsc.frequency.value = freq;
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.value = Math.min(3200, freq * 8);
      bodyGain.gain.value = 0.42;

      // Subtle steady airy pinna cue so even a 40 Hz bass source can be localized in 3D space
      noiseSrc.buffer = pinnaNoiseBuf;
      noiseSrc.loop = true;
      noiseBand.type = 'bandpass';
      noiseBand.frequency.value = 2800 + (i % 4) * 900;
      noiseBand.Q.value = 1.8;
      noiseGain.gain.value = 0.08;

      shadowFilter.type = 'lowpass';
      shadowFilter.frequency.value = 6000;
      shadowFilter.Q.value = 0.9;

      elevFilter.type = 'peaking';
      elevFilter.frequency.value = 7000;
      elevFilter.Q.value = 1.8;
      elevFilter.gain.value = 0;

      const isActive = i < this.params.spatial.count;
      const weight = 0.28 / Math.pow(i + 1, 0.25);
      voiceGain.gain.value = isActive ? weight : 0;
      pulseGain.gain.value = isActive ? 1.0 : 0;

      osc.connect(shadowFilter);
      bodyOsc.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(shadowFilter);

      noiseSrc.connect(noiseBand);
      noiseBand.connect(noiseGain);
      noiseGain.connect(shadowFilter);

      shadowFilter.connect(elevFilter);
      elevFilter.connect(voiceGain);
      voiceGain.connect(pulseGain);
      pulseGain.connect(panner);
      panner.connect(bus);

      osc.start();
      bodyOsc.start();
      noiseSrc.start(0, (i * 0.53) % 3.5);

      voices.push({
        osc,
        bodyOsc,
        bodyFilter,
        noiseBand,
        shadowFilter,
        elevFilter,
        voiceGain,
        pulseGain,
        panner,
        index: i,
        freq,
        weight
      });
      this.telemetry.spatialVoices.push({
        x: 0,
        y: 0,
        z: -1,
        dist: 1,
        geomType: 'infinity',
        trail: [],
        freq,
        index: i,
        normAmp: weight,
        activeEnergy: isActive ? 1.0 : 0
      });
    }

    // In-Cranial Phase-Inverted Core (strictly 0 when collapse == 0)
    const coreOscL = this.ctx.createOscillator();
    const coreOscR = this.ctx.createOscillator();
    const coreGainL = this.ctx.createGain();
    const coreGainR = this.ctx.createGain();
    const corePanL = this.ctx.createStereoPanner();
    const corePanR = this.ctx.createStereoPanner();

    coreOscL.type = 'sine';
    coreOscR.type = 'sine';
    coreOscL.frequency.value = baseFreq;
    coreOscR.frequency.value = baseFreq;

    corePanL.pan.value = -1;
    corePanR.pan.value = 1;

    const coreLevel = this.params.spatial.collapse <= 0.005 ? 0 : this.params.spatial.collapse * 0.16;
    coreGainL.gain.value = coreLevel;
    coreGainR.gain.value = -coreLevel;

    coreOscL.connect(coreGainL);
    coreGainL.connect(corePanL);
    corePanL.connect(bus);

    coreOscR.connect(coreGainR);
    coreGainR.connect(corePanR);
    corePanR.connect(bus);

    coreOscL.start();
    coreOscR.start();

    this.nodes.spatial = { bus, voices, coreOscL, coreOscR, coreGainL, coreGainR };
  }

  /**
   * Computes 3D (x, y, z) coordinates for source `i` according to selected geometry
   */
  _computeSpatialTrajectory(i, count, elapsed, speed, asym, trajectoryMode) {
    // In 'mixed' mode, assign distinct geometries to each source
    let geom = trajectoryMode;
    if (trajectoryMode === 'mixed') {
      const modes = ['infinity', 'radial', 'circle'];
      geom = modes[i % modes.length];
    }

    const phaseOffset = (i * Math.PI * 2) / Math.max(1, count);
    const theta = elapsed * speed * Math.PI * 2 + phaseOffset;

    let x = 0, y = 0, z = -1;

    if (geom === 'infinity') {
      // Figure-8 / Lemniscate (∞) passing directly through the center of the head (0,0,0)!
      // At theta = 0 and theta = PI, sin(theta) = 0 and sin(2*theta) = 0 -> (x,y,z) = (0,0,0)!
      const lobeRadius = 1.1 + 1.15 * asym;
      const u = lobeRadius * Math.sin(theta);
      const v = lobeRadius * 0.58 * Math.sin(2 * theta);

      // Rotate each source's Figure-8 axis around the head so multiple sources weave through (0,0,0)
      const axisAngle = (i * Math.PI) / Math.max(1, count);
      x = u * Math.cos(axisAngle) - v * Math.sin(axisAngle);
      z = -u * Math.sin(axisAngle) - v * Math.cos(axisAngle);
      // Elevation also passes through 0 at the head center
      y = Math.sin(theta) * Math.cos(theta) * 0.85 * asym * (i % 2 === 0 ? 1 : -1);
    } else if (geom === 'radial') {
      // Far-Horizon Excursion: starts near the ear/head, travels VERY FAR OUT (up to 11m) in one direction, and returns!
      const rayAngle = (i * Math.PI * 2) / Math.max(1, count) + elapsed * 0.05 * (i % 2 === 0 ? 1 : -1);
      const maxHorizonDist = 3.5 + 8.0 * asym; // up to 11.5 meters away!
      // Smooth excursion 0.15m -> maxHorizonDist -> 0.15m
      const excursion = Math.pow(0.5 - 0.5 * Math.cos(theta), 1.65);
      const r = 0.15 + maxHorizonDist * excursion;

      x = r * Math.sin(rayAngle);
      z = -r * Math.cos(rayAngle);
      y = (r * 0.18) * Math.sin(rayAngle + i) * asym;
    } else if (geom === 'circle') {
      // Pure 360° Circular Halo around perimeter of the head
      const dir = i % 2 === 0 ? 1 : -1;
      const r = 0.75 + 0.95 * asym;
      const a = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      x = r * Math.sin(a);
      z = -r * Math.cos(a);
      y = Math.sin(a + i) * 0.45 * asym;
    } else if (geom === 'spiral') {
      // Breathing Spiral: spirals inward from far horizon (5.5m) straight through center of skull (0m) and back out
      const breathCycle = 0.5 - 0.5 * Math.cos(theta * 0.35);
      const r = (0.02 + 5.2 * asym) * breathCycle;
      const fastAngle = theta * 2.0;
      x = r * Math.sin(fastAngle);
      z = -r * Math.cos(fastAngle);
      y = Math.cos(theta * 0.35) * 0.7 * asym;
    } else {
      // 'torus': Counter-rotating 3D toroidal knot
      const dir = i % 2 === 0 ? 1 : -1 * (0.5 + asym * 0.7);
      const angle = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      const elevAngle = elapsed * speed * 1.618 * Math.PI + i * 0.9;
      const r = 0.4 + (0.6 + 0.9 * asym) * (0.5 + 0.5 * Math.cos(elevAngle));
      x = r * Math.sin(angle);
      z = -r * Math.cos(angle);
      y = Math.sin(elevAngle) * (0.4 + 0.85 * asym);
    }

    return { x, y, z, geomType: geom };
  }

  /**
   * MODULE 2: Predictive-Coding "Edge of Chaos"
   * Multi-archetype synthesis constrained to real 12-TET musical notes across multiple octaves,
   * with an Edge-of-Chaos Motif & Anti-Repetition Engine that breaks patterns before habituation.
   */
  _setupChaosModule() {
    const bus = this.ctx.createGain();
    bus.gain.value = this.params.chaos.enabled ? this.params.chaos.gain * 0.52 : 0.0001;
    bus.connect(this.dryBus);
    bus.connect(this.reverbSendGain);

    // Short noise burst buffer for modal pluck & microclick transients
    const rate = this.ctx.sampleRate;
    const burstLen = Math.floor(rate * 0.15);
    const burstBuf = this.ctx.createBuffer(1, burstLen, rate);
    const bd = burstBuf.getChannelData(0);
    for (let i = 0; i < burstLen; i++) {
      bd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (rate * 0.018));
    }

    this.chaosScales = {
      chromatic12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      dorian: [0, 2, 3, 5, 7, 9, 10],
      lydian: [0, 2, 4, 6, 7, 9, 11],
      pentatonic: [0, 2, 5, 7, 10],
      phrygian: [0, 1, 4, 5, 7, 8, 10]
    };
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    this.nodes.chaos = {
      bus,
      burstBuf,
      nextEventTime: 0,
      henonX: 0.21,
      henonY: 0.15,
      avalancheRemaining: 0,
      avalancheStep: 0,
      polyClocks: [0, 0, 0],
      lastStreamIdx: 0,
      elasticPhase: 0,
      // Edge-of-Chaos Melodic Motif & Anti-Habituation Pattern Memory
      motif: [50, 57, 53, 62, 55], // Initial 5-note motif in real MIDI notes (D3, A3, F3, D4, G3)
      motifStep: 0,
      lastMidi: 50,
      noteUsage: {},   // Tracks recent usage of each MIDI note (with decay)
      bigramUsage: {}  // Tracks recent (prevMidi -> nextMidi) transitions to prevent looping
    };
  }

  _midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _midiToName(midi) {
    const m = Math.round(midi);
    const name = this.noteNames[((m % 12) + 12) % 12];
    const oct = Math.floor(m / 12) - 1;
    return `${name}${oct}`;
  }

  /**
   * Selects the next real 12-TET MIDI note across multiple octaves.
   * Forms short musical patterns/motifs, and uses the Edge-of-Chaos attractor + transition memory
   * to mutate the motif as soon as any pattern or interval repeats more than 1-2 times.
   */
  _selectNextChaosNote(x, y, r, reg, morph) {
    const ch = this.nodes.chaos;
    const scaleKey = this.params.chaos.scale || 'chromatic12';
    const scaleIntervals = this.chaosScales[scaleKey] || this.chaosScales.chromatic12;
    const rootNote = 2; // Root on D (D1=26, D2=38, D3=50, D4=62, D5=74)

    // Build pool of valid 12-TET MIDI notes across 3 to 4.5 octaves based on Register & Morph
    const minMidi = Math.round(28 + reg * 32); // e.g., E1 (28) to C4 (60)
    const octaveSpan = Math.round(24 + morph * 24); // 2 to 4 octaves wide!
    const maxMidi = Math.min(96, minMidi + octaveSpan);

    const validNotes = [];
    for (let m = minMidi; m <= maxMidi; m++) {
      const relSemitone = ((m - rootNote) % 12 + 12) % 12;
      if (scaleIntervals.includes(relSemitone)) {
        validNotes.push(m);
      }
    }
    if (validNotes.length === 0) validNotes.push(50);

    // Decay historical usage counts so old notes eventually become fresh again
    Object.keys(ch.noteUsage).forEach((k) => {
      ch.noteUsage[k] *= 0.88;
      if (ch.noteUsage[k] < 0.05) delete ch.noteUsage[k];
    });
    Object.keys(ch.bigramUsage).forEach((k) => {
      ch.bigramUsage[k] *= 0.85;
      if (ch.bigramUsage[k] < 0.05) delete ch.bigramUsage[k];
    });

    // Advance motif step
    ch.motifStep = (ch.motifStep + 1) % ch.motif.length;
    let candidateMidi = ch.motif[ch.motifStep];

    // Snap candidate into current register/scale if user changed scale or register slider
    if (!validNotes.includes(candidateMidi)) {
      const idx = Math.floor(x * validNotes.length) % validNotes.length;
      candidateMidi = validNotes[idx];
      ch.motif[ch.motifStep] = candidateMidi;
    }

    const bigramKey = `${ch.lastMidi}->${candidateMidi}`;
    const recentBigramCount = ch.bigramUsage[bigramKey] || 0;
    const recentNoteCount = ch.noteUsage[candidateMidi] || 0;

    // Edge-of-Chaos Anti-Repetition Rule:
    // At low r (r < 3.4), patterns can repeat 3-4 times.
    // At Edge of Chaos (r ~ 3.55 - 3.85), as soon as a transition repeats > 1.2 times
    // (i.e. after playing once or twice!), OR when the chaotic map bifurcates, mutate the note!
    const chaosNorm = Math.max(0, Math.min(1, (r - 2.8) / 1.19)); // 0..1
    const maxAllowedRepeats = 3.2 - chaosNorm * 2.2; // ~1.2 repeats at r=3.74

    let mutated = false;
    const shouldBifurcate =
      recentBigramCount > maxAllowedRepeats ||
      recentNoteCount > maxAllowedRepeats + 0.6 ||
      candidateMidi === ch.lastMidi ||
      (x > 1.0 - chaosNorm * 0.55 && y > 0.45);

    if (shouldBifurcate) {
      mutated = true;
      // Score all valid 12-TET notes across the multi-octave pool:
      // Chaotic attractor drives the target position, while recent usage repels repetition!
      let bestMidi = validNotes[0];
      let bestScore = -Infinity;

      for (let i = 0; i < validNotes.length; i++) {
        const m = validNotes[i];
        if (m === ch.lastMidi && validNotes.length > 1) continue;

        const normPos = i / Math.max(1, validNotes.length - 1);
        // Chaotic target blends x and y across octaves
        const targetPos = (x * 0.65 + y * 0.35 + (ch.motifStep * 0.19)) % 1.0;
        const distScore = 1.0 - Math.abs(normPos - targetPos);

        const nUse = ch.noteUsage[m] || 0;
        const bUse = ch.bigramUsage[`${ch.lastMidi}->${m}`] || 0;
        // Favor musical intervals (3rds, 4ths, 5ths, octaves, semitones) while strongly penalizing repetition
        const interval = Math.abs(m - ch.lastMidi);
        const consonantBonus = [1, 2, 3, 4, 5, 7, 8, 9, 10, 12, 14, 15, 19, 24].includes(interval) ? 0.25 : 0;

        const score = distScore * 1.4 + consonantBonus - nUse * 1.35 - bUse * 2.1;
        if (score > bestScore) {
          bestScore = score;
          bestMidi = m;
        }
      }

      candidateMidi = bestMidi;
      ch.motif[ch.motifStep] = candidateMidi;

      // Occasionally evolve motif length between 4, 5, 6, or 7 notes so the meter never loops statically
      if (y > 0.78 && chaosNorm > 0.5) {
        const targetLen = 4 + Math.floor(x * 4); // 4..7 notes
        while (ch.motif.length < targetLen) {
          const pick = validNotes[Math.floor(((x + y) * validNotes.length)) % validNotes.length];
          ch.motif.push(pick);
        }
        if (ch.motif.length > targetLen) {
          ch.motif.length = targetLen;
          ch.motifStep = ch.motifStep % targetLen;
        }
      }
    }

    // Record transition & note usage
    ch.noteUsage[candidateMidi] = (ch.noteUsage[candidateMidi] || 0) + 1.0;
    ch.bigramUsage[`${ch.lastMidi}->${candidateMidi}`] =
      (ch.bigramUsage[`${ch.lastMidi}->${candidateMidi}`] || 0) + 1.0;
    ch.lastMidi = candidateMidi;

    return {
      midi: candidateMidi,
      freq: this._midiToFreq(candidateMidi),
      noteName: this._midiToName(candidateMidi),
      mutated
    };
  }

  _computeNextChaosInterval(now, elapsed) {
    const ch = this.nodes.chaos;
    const rate = Math.max(0.5, this.params.chaos.rate);
    const baseStep = 1.0 / rate;
    const rhythmMode = this.params.chaos.rhythm || 'avalanche';
    const x = this.telemetry.lastChaosX;

    if (rhythmMode === 'avalanche') {
      // Scale-free neuronal avalanche: rapid cascading flurries separated by deep contemplative pauses
      if (ch.avalancheRemaining > 0) {
        ch.avalancheRemaining--;
        ch.avalancheStep++;
        // Accelerating or decelerating micro-cascade (45ms to 160ms between notes in a burst)
        const cascadeFactor = x > 0.5 ? Math.pow(0.82, ch.avalancheStep) : Math.pow(1.18, ch.avalancheStep);
        return Math.max(0.045, Math.min(0.24, baseStep * 0.28 * cascadeFactor));
      } else {
        // Trigger a new avalanche of 2 to 7 events after a deep silence
        ch.avalancheRemaining = 2 + Math.floor(x * 5.5);
        ch.avalancheStep = 0;
        const silenceDuration = baseStep * (1.6 + ((x * 1.618) % 1) * 2.8);
        return silenceDuration;
      }
    } else if (rhythmMode === 'lorenz') {
      // Strange-attractor syncopated groove: quantizes chaotic states to shifting rhythmic subdivisions
      const subdivisions = [0.25, 0.333, 0.5, 0.75, 1.0, 1.5, 2.0];
      const idx = Math.floor(((x + Math.abs(ch.henonY)) * 3.7) % subdivisions.length);
      return Math.max(0.05, baseStep * subdivisions[idx]);
    } else if (rhythmMode === 'polyrhythm') {
      // 3 interlocking streams at Golden-Ratio & Prime intervals (1 : 1.61803 : 2.333)
      const ratios = [1.0, 1.618034, 2.33333];
      let minTime = Infinity;
      let nextStream = 0;
      for (let s = 0; s < 3; s++) {
        if (ch.polyClocks[s] <= now) {
          ch.polyClocks[s] = now + baseStep * ratios[s];
        }
        if (ch.polyClocks[s] < minTime) {
          minTime = ch.polyClocks[s];
          nextStream = s;
        }
      }
      ch.lastStreamIdx = nextStream;
      const dt = Math.max(0.04, minTime - now);
      ch.polyClocks[nextStream] = minTime + baseStep * ratios[nextStream];
      return dt;
    } else if (rhythmMode === 'elastic') {
      // Elastic bouncing-ball time gravity: smooth exponential accelerando & ritardando cycles
      ch.elasticPhase = (ch.elasticPhase + 0.14) % (Math.PI * 2);
      const stretch = Math.pow(0.55 - 0.45 * Math.cos(ch.elasticPhase), 1.85);
      return Math.max(0.042, baseStep * (0.12 + 2.2 * stretch));
    } else {
      // 'stochastic': Logistic map directly controls periodicity (periodic at r<3.4, chaotic at r>3.7)
      return Math.max(0.05, baseStep * (0.25 + x * 1.5));
    }
  }

  _triggerChaosDroplet(now) {
    if (!this.ctx || !this.params.chaos.enabled || !this.isRunning) return;

    const ch = this.nodes.chaos;
    const r = this.params.chaos.r;
    const morph = this.params.chaos.morph;
    const reg = this.params.chaos.register !== undefined ? this.params.chaos.register : 0.45;
    const palette = this.params.chaos.palette || 'hybrid';

    // 1. Advance Coupled Logistic + Hénon Strange Attractor
    let x = this.telemetry.lastChaosX;
    x = r * x * (1 - x);
    if (x <= 0.001 || x >= 0.999) x = 0.314159;
    this.telemetry.lastChaosX = x;

    // Coupled 2D Hénon attractor step for multi-dimensional timbral & spatial variation
    const nextHenonX = 1.0 - 1.28 * ch.henonX * ch.henonX + ch.henonY;
    const nextHenonY = 0.32 * ch.henonX;
    ch.henonX = Math.max(-1.5, Math.min(1.5, nextHenonX));
    ch.henonY = Math.max(-1.5, Math.min(1.5, nextHenonY));
    const y = ((ch.henonX + 1.5) / 3.0 + x * 0.618) % 1.0;

    // 2. Compute Bayesian Surprise (bits)
    const binIdx = Math.min(15, Math.floor(x * 16));
    const totalCount = this.telemetry.chaosBins.reduce((a, b) => a + b, 0);
    const prob = this.telemetry.chaosBins[binIdx] / totalCount;
    const surpriseBits = -Math.log2(prob);
    for (let i = 0; i < 16; i++) {
      this.telemetry.chaosBins[i] *= 0.96;
    }
    this.telemetry.chaosBins[binIdx] += 1.0;
    this.telemetry.bayesianSurprise = this.telemetry.bayesianSurprise * 0.7 + surpriseBits * 0.3;

    // 3. Select Sonic Archetype
    const archetypes = ['metallic', 'liquid', 'plucked', 'subglitch', 'breath'];
    let archetype = palette;
    if (palette === 'hybrid') {
      // Strange attractor state selects archetype so the brain can never predict the sound family
      const archIdx = Math.floor(((x * 5 + y * 3) * 1.7) % archetypes.length);
      archetype = archetypes[archIdx];
    }

    // 4. Select Real 12-TET Musical Note across Multi-Octave Span with Motif Pattern-Breaking
    const noteInfo = this._selectNextChaosNote(x, y, r, reg, morph);
    let midi = noteInfo.midi;
    if (this.params.chaos.rhythm === 'polyrhythm') {
      // Separate polyrhythmic streams by exact octaves (+/- 12 semitones) so they stay in 12-TET
      midi = Math.max(24, Math.min(96, midi + (ch.lastStreamIdx - 1) * 12));
    }
    let freq = this._midiToFreq(midi);
    let noteName = this._midiToName(midi);
    const mutated = noteInfo.mutated;

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.95, Math.min(0.95, (y * 2 - 1) * 0.9)), now);
    panner.connect(ch.bus);

    // 5. Synthesize according to selected Archetype (all tuned to exact 12-TET musical pitch!)
    if (archetype === 'metallic') {
      // Harmonic-Tuned 2-Operator FM Bell / Singing Bowl (retains clear 12-TET fundamental pitch)
      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const env = this.ctx.createGain();

      // Exact integer/fifth harmonic ratios (1, 2, 3, 1.5, 4) so the bell rings at a true musical note!
      const fmRatios = [2.0, 3.0, 1.5, 4.0, 1.0];
      const ratio = fmRatios[Math.floor((y * 10) % fmRatios.length)];

      carrier.type = 'sine';
      modulator.type = 'sine';
      carrier.frequency.setValueAtTime(freq, now);
      modulator.frequency.setValueAtTime(freq * ratio, now);

      const modIndex = freq * (0.5 + morph * 2.2);
      const decay = 0.55 + (1 - x) * 1.35;
      modGain.gain.setValueAtTime(modIndex, now);
      modGain.gain.exponentialRampToValueAtTime(0.05, now + decay * 0.55);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.22, now + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(env);
      env.connect(panner);

      carrier.start(now);
      modulator.start(now);
      carrier.stop(now + decay + 0.05);
      modulator.stop(now + decay + 0.05);

    } else if (archetype === 'plucked') {
      // Modal Wood Marimba / Koto Pluck / Bowed Glass Resonator tuned to exact 12-TET note
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = ch.burstBuf;

      const osc = this.ctx.createOscillator();
      const mode1 = this.ctx.createBiquadFilter();
      const mode2 = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // High-Q modal resonators at exact 12-TET fundamental and octave/fifth overtone (2x or 3x)
      mode1.type = 'bandpass';
      mode1.frequency.setValueAtTime(freq, now);
      mode1.Q.value = 14 + morph * 16;

      mode2.type = 'bandpass';
      mode2.frequency.setValueAtTime(Math.min(9000, freq * (y > 0.5 ? 2.0 : 3.0)), now);
      mode2.Q.value = 12 + morph * 12;

      const attack = 0.004 + (1 - morph) * 0.018;
      const decay = 0.25 + y * 0.55;

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.28, now + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

      noiseSrc.connect(mode1);
      noiseSrc.connect(mode2);
      osc.connect(mode1);
      mode1.connect(env);
      mode2.connect(env);
      env.connect(panner);

      noiseSrc.start(now);
      osc.start(now);
      osc.stop(now + attack + decay + 0.04);

    } else if (archetype === 'subglitch') {
      // Deep 12-TET Sub-Bass Note (Octave 1 or 2) + Octave-Tuned Crystalline Micro-Ping
      const subOsc = this.ctx.createOscillator();
      const clickOsc = this.ctx.createOscillator();
      const subEnv = this.ctx.createGain();
      const clickEnv = this.ctx.createGain();

      // Fold MIDI note into deep bass register (MIDI 28..47 = E1..B2)
      const bassMidi = 28 + ((midi - 28) % 24 + 24) % 24;
      const targetSubFreq = this._midiToFreq(bassMidi);
      const startSubFreq = targetSubFreq * 2.0; // Drops cleanly from 1 octave above onto exact 12-TET bass note!
      const dropDur = 0.38 + (1 - x) * 0.50;

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(startSubFreq, now);
      subOsc.frequency.exponentialRampToValueAtTime(targetSubFreq, now + 0.065);

      subEnv.gain.setValueAtTime(0.0001, now);
      subEnv.gain.linearRampToValueAtTime(0.32, now + 0.008);
      subEnv.gain.exponentialRampToValueAtTime(0.0001, now + dropDur);

      // High octave-tuned crystalline micro-ping (exact 4 octaves above bass note)
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(targetSubFreq * 16, now);
      clickEnv.gain.setValueAtTime(0.14, now);
      clickEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

      subOsc.connect(subEnv);
      clickOsc.connect(clickEnv);
      subEnv.connect(panner);
      clickEnv.connect(panner);

      subOsc.start(now);
      clickOsc.start(now);
      subOsc.stop(now + dropDur + 0.04);
      clickOsc.stop(now + 0.025);
      freq = targetSubFreq;
      noteName = this._midiToName(bassMidi);

    } else if (archetype === 'breath') {
      // Reverse Envelope Swell & Overtone Bloom on exact 12-TET note + pure 5th/octave
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const formant = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * (y > 0.5 ? 1.5 : 2.0), now);

      formant.type = 'bandpass';
      formant.Q.value = 4.0 + morph * 5.0;
      formant.frequency.setValueAtTime(Math.min(4800, freq * 2), now);
      formant.frequency.exponentialRampToValueAtTime(Math.min(6400, freq * 4), now + 0.5);

      // Slow reverse-like swell attack followed by gentle release
      const swellAttack = 0.30 + (1 - x) * 0.50;
      const release = 0.16 + y * 0.22;

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.22, now + swellAttack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + swellAttack + release);

      osc1.connect(formant);
      osc2.connect(formant);
      formant.connect(env);
      env.connect(panner);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + swellAttack + release + 0.05);
      osc2.stop(now + swellAttack + release + 0.05);

    } else {
      // 'liquid': Liquid Formant Vowel on exact 12-TET note (with optional semitone/fifth grace-note inflection)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const formant1 = this.ctx.createBiquadFilter();
      const formant2 = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      // Optional 12-TET grace-note slide (2 or 5 semitones) that lands squarely on the exact 12-TET note `freq`!
      const graceSemitones = morph > 0.5 ? (y > 0.5 ? -2 : 2) : 0;
      const startFreq = this._midiToFreq(midi + graceSemitones);
      osc1.frequency.setValueAtTime(startFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.07);
      osc2.frequency.setValueAtTime(freq * 2.0, now);

      formant1.type = 'bandpass';
      formant1.Q.value = 5.5 + morph * 7.5;
      formant1.frequency.setValueAtTime(320 + x * 1400, now);
      formant1.frequency.exponentialRampToValueAtTime(480 + y * 1900, now + 0.35);

      formant2.type = 'bandpass';
      formant2.Q.value = 6.0;
      formant2.frequency.setValueAtTime(900 + (1 - x) * 2100, now);

      const attack = 0.012 + (1 - morph) * 0.025;
      const decay = 0.28 + (1 - x) * 0.48;

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.24, now + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

      osc1.connect(formant1);
      osc2.connect(formant1);
      osc1.connect(formant2);
      formant1.connect(env);
      formant2.connect(env);
      env.connect(panner);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + attack + decay + 0.05);
      osc2.stop(now + attack + decay + 0.05);
    }

    // Log event with exact 12-TET note name, archetype, and pattern-mutation flag
    this.telemetry.recentDroplets.push({
      x,
      y,
      midi,
      freq,
      noteName,
      mutated,
      archetype,
      surprise: surpriseBits,
      birth: performance.now()
    });
    if (this.telemetry.recentDroplets.length > 55) {
      this.telemetry.recentDroplets.shift();
    }
  }

  /**
   * MODULE 3: Cross-Frequency Phase-Amplitude Coupled (PAC) Audio
   * Selectable Base Carrier + True Audio-Rate Gamma Bursts (25-75 Hz) gated by Theta Peaks + 0.1 Hz Breath Bloom
   */
  _setupPACModule() {
    const bus = this.ctx.createGain();
    bus.gain.value = this.params.pac.enabled ? this.params.pac.gain * 0.48 : 0.0001;
    bus.connect(this.dryBus);
    bus.connect(this.reverbSendGain);

    // 1. Binaural Beat Carrier Pair (baseFreq +/- theta/2) + Warm Harmonic Body
    const carrierFreq = this.params.pac.baseFreq || 136.0;
    const halfTheta = this.params.pac.theta / 2;

    const binOscL = this.ctx.createOscillator();
    const binOscR = this.ctx.createOscillator();
    const binBodyL = this.ctx.createOscillator();
    const binBodyR = this.ctx.createOscillator();
    const binBodyGain = this.ctx.createGain();
    const binFilter = this.ctx.createBiquadFilter();
    const binPanL = this.ctx.createStereoPanner();
    const binPanR = this.ctx.createStereoPanner();
    const binGain = this.ctx.createGain();

    binOscL.type = 'sine';
    binOscR.type = 'sine';
    binBodyL.type = 'triangle';
    binBodyR.type = 'triangle';

    binOscL.frequency.value = Math.max(20, carrierFreq - halfTheta);
    binOscR.frequency.value = Math.max(20, carrierFreq + halfTheta);
    binBodyL.frequency.value = Math.max(20, carrierFreq - halfTheta);
    binBodyR.frequency.value = Math.max(20, carrierFreq + halfTheta);

    binBodyGain.gain.value = 0.22;
    binFilter.type = 'lowpass';
    binFilter.frequency.value = carrierFreq * 3.5;
    binFilter.Q.value = 1.2;

    binPanL.pan.value = -1;
    binPanR.pan.value = 1;
    binGain.gain.value = 0.42;

    binOscL.connect(binPanL);
    binOscR.connect(binPanR);
    binBodyL.connect(binBodyGain);
    binBodyR.connect(binBodyGain);
    binBodyGain.connect(binFilter);
    binFilter.connect(binGain);

    binPanL.connect(binGain);
    binPanR.connect(binGain);
    binGain.connect(bus);

    binOscL.start();
    binOscR.start();
    binBodyL.start();
    binBodyR.start();

    // 2. Harmonic Shimmer Carriers for Nested Gamma PAC Bursts (2x, 3x, 4x of Base Carrier)
    const pacCarrier1 = this.ctx.createOscillator();
    const pacCarrier2 = this.ctx.createOscillator();
    const pacCarrier3 = this.ctx.createOscillator();
    const c1Gain = this.ctx.createGain();
    const c2Gain = this.ctx.createGain();
    const c3Gain = this.ctx.createGain();
    const pacFilter = this.ctx.createBiquadFilter();

    // Audio-rate Gamma Pulse Gate (modulated at 48kHz sample rate by gammaOsc + gammaShaper!)
    const gammaPulseNode = this.ctx.createGain();
    // Theta-peak & Breath envelope gate
    const pacModGain = this.ctx.createGain();

    pacCarrier1.type = 'sine';
    pacCarrier2.type = 'triangle';
    pacCarrier3.type = 'sine';
    pacCarrier1.frequency.value = carrierFreq * 2.0;
    pacCarrier2.frequency.value = carrierFreq * 3.0;
    pacCarrier3.frequency.value = carrierFreq * 4.0;

    c1Gain.gain.value = 0.48;
    c2Gain.gain.value = 0.34;
    c3Gain.gain.value = 0.22;

    pacFilter.type = 'lowpass';
    pacFilter.frequency.value = Math.min(8000, carrierFreq * 6.0);
    pacFilter.Q.value = 2.4;

    // 3. True Audio-Rate Gamma Oscillator (25..75 Hz) + Raised-Cosine Pulse WaveShaper
    const gammaOsc = this.ctx.createOscillator();
    gammaOsc.type = 'sine';
    gammaOsc.frequency.value = this.params.pac.gamma || 40.0;

    const gammaShaper = this.ctx.createWaveShaper();
    const curveLen = 2048;
    const pulseCurve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
      const x = (i / (curveLen - 1)) * 2 - 1; // -1 .. +1
      // Sharp raised pulse: 0 in the negative half-cycle, crisp peak of 1.0 at crest
      pulseCurve[i] = Math.pow(Math.max(0, (x + 1) * 0.5), 3.2);
    }
    gammaShaper.curve = pulseCurve;

    // Base gain is 0 so audio-rate gammaShaper (0..1) directly multiplies the carrier at 25-75 Hz!
    gammaPulseNode.gain.value = 0.0;
    gammaOsc.connect(gammaShaper);
    gammaShaper.connect(gammaPulseNode.gain);

    pacModGain.gain.value = 0.35;

    pacCarrier1.connect(c1Gain);
    pacCarrier2.connect(c2Gain);
    pacCarrier3.connect(c3Gain);
    c1Gain.connect(pacFilter);
    c2Gain.connect(pacFilter);
    c3Gain.connect(pacFilter);

    pacFilter.connect(gammaPulseNode);
    gammaPulseNode.connect(pacModGain);
    pacModGain.connect(bus);

    pacCarrier1.start();
    pacCarrier2.start();
    pacCarrier3.start();
    gammaOsc.start();

    this.nodes.pac = {
      bus,
      binOscL,
      binOscR,
      binBodyL,
      binBodyR,
      binFilter,
      binGain,
      pacCarrier1,
      pacCarrier2,
      pacCarrier3,
      pacFilter,
      gammaOsc,
      gammaPulseNode,
      pacModGain,
      carrierFreq
    };
  }

  /**
   * MODULE 4: Fractal & Scale-Invariant Shepard-Risset Landscape
   * 8 octave-locked voices with Pure Just-Intonation Celestial Harmonics (Root 1:1, Major 3rd 5:4, Perfect 5th 3:2)
   * and Multi-Scale 1/f Weierstrass Harmonic Arpeggiation & Breathing
   */
  _setupFractalModule() {
    const bus = this.ctx.createGain();
    bus.gain.value = this.params.fractal.enabled ? this.params.fractal.gain * 0.42 : 0.0001;
    bus.connect(this.dryBus);
    bus.connect(this.reverbSendGain);

    const voices = [];
    for (let i = 0; i < 8; i++) {
      // 1. Primary Shepard octave fundamental oscillator (Pure Root 1:1)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // 2. Pure Just-Intonation Major 3rd (5:4) / Major 9th (9:8) Celestial Branch
      const thirdOsc = this.ctx.createOscillator();
      const thirdGain = this.ctx.createGain();

      // 3. Pure Just-Intonation Perfect 5th (3:2) Celestial Branch
      const fifthOsc = this.ctx.createOscillator();
      const fifthGain = this.ctx.createGain();

      const pan = this.ctx.createStereoPanner();

      // All pure warm sine waves — zero harsh filters or whistling wind!
      osc.type = 'sine';
      thirdOsc.type = 'sine';
      fifthOsc.type = 'sine';

      const octavePos = i / 8; // 0..1 across 8-octave span
      osc.frequency.value = 220;
      thirdOsc.frequency.value = 275; // 5/4 Major 3rd
      fifthOsc.frequency.value = 330; // 3/2 Perfect 5th

      gain.gain.value = 0.0;
      thirdGain.gain.value = 0.0;
      fifthGain.gain.value = 0.0;
      pan.pan.value = Math.sin((i / 8) * Math.PI * 2) * 0.6;

      osc.connect(gain);
      thirdOsc.connect(thirdGain);
      fifthOsc.connect(fifthGain);

      gain.connect(pan);
      thirdGain.connect(pan);
      fifthGain.connect(pan);

      pan.connect(bus);

      osc.start();
      thirdOsc.start();
      fifthOsc.start();

      voices.push({ osc, gain, thirdOsc, thirdGain, fifthOsc, fifthGain, pan, octavePos });
      this.telemetry.shepardVoices.push({ octavePos, freq: 220, amp: 0, ripple: 0 });
    }

    this.nodes.fractal = { bus, voices, lastUpdateTime: this.ctx.currentTime };
  }

  /**
   * MODULE 5: Infrasound & Somatic Sub-Bass
   * Deep sub-bass (24-60 Hz) + psychoacoustic equal-loudness compensated missing-fundamental harmonics (2f0..5f0)
   * with analog tape/tube saturation that transforms timbre without blowing up volume!
   */
  _setupSubBassModule() {
    const bus = this.ctx.createGain();
    bus.gain.value = this.params.sub.enabled ? this.params.sub.gain * 0.45 : 0.0001;
    bus.connect(this.dryBus);

    const f0 = this.params.sub.freq;
    const warmth = this.params.sub.warmth;

    // 5 harmonic voices: 1x (fundamental), 2x (octave), 3x (5th), 4x (2nd octave), 5x (major 3rd)
    const subOscs = [];
    const subGains = [];
    const ratios = [1, 2, 3, 4, 5];

    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : (i % 2 === 1 ? 'sine' : 'triangle');
      osc.frequency.value = f0 * ratios[i];
      g.gain.value = 0.0;
      osc.connect(g);
      osc.start();
      subOscs.push(osc);
      subGains.push(g);
    }

    // Warm analog saturation waveshaper
    const saturator = this.ctx.createWaveShaper();
    const curveLen = 1024;
    const satCurve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
      const x = (i / (curveLen - 1)) * 2 - 1; // -1..1
      // Smooth hyperbolic tangent soft-clipping for warm tube saturation
      satCurve[i] = Math.tanh(x * 1.5) / Math.tanh(1.5);
    }
    saturator.curve = satCurve;

    // Harmonic lowpass to tame extreme high-frequency fizz
    const warmthFilter = this.ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.value = Math.min(1200, f0 * 10);
    warmthFilter.Q.value = 1.0;

    const pulseGain = this.ctx.createGain();
    pulseGain.gain.value = 0.8;

    // Connect voices:
    // Fundamental (osc 0) bypasses saturation for ultra-clean sub pressure
    subGains[0].connect(pulseGain);
    // Harmonics 2..5 route through soft-saturator and lowpass filter for rich organic overtone warmth
    for (let i = 1; i < 5; i++) {
      subGains[i].connect(saturator);
    }
    saturator.connect(warmthFilter);
    warmthFilter.connect(pulseGain);
    pulseGain.connect(bus);

    this.nodes.sub = {
      bus,
      subOscs,
      subGains,
      ratios,
      warmthFilter,
      pulseGain
    };

    this._updateSubWarmth(warmth);
  }

  // Equal-loudness compensated harmonic distribution:
  // At warmth = 0: 100% pure deep fundamental sine wave, 0% harmonics
  // As warmth -> 1.0: fundamental stays grounded while 2nd, 3rd, 4th, and 5th harmonics blossom,
  // with loudness compensation so overall volume stays balanced while the timbre completely transforms!
  _updateSubWarmth(w) {
    if (!this.nodes.sub || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gains = this.nodes.sub.subGains;
    const f0 = this.params.sub.freq;

    // Fundamental rebalances slightly so adding upper harmonics doesn't overpower the listener
    const f0Gain = 0.95 * (1.0 - w * 0.35);
    // Harmonics scaled by equal-loudness curves (higher harmonics need less power to be clearly heard):
    const h2Gain = w * 0.42;  // 2f0 (octave body)
    const h3Gain = Math.pow(w, 1.2) * 0.26; // 3f0 (warm 5th overtone)
    const h4Gain = Math.pow(w, 1.4) * 0.16; // 4f0 (clarity 2nd octave)
    const h5Gain = Math.pow(w, 1.6) * 0.10; // 5f0 (rich major 3rd sheen)

    gains[0].gain.setTargetAtTime(f0Gain, now, 0.05);
    gains[1].gain.setTargetAtTime(h2Gain, now, 0.05);
    gains[2].gain.setTargetAtTime(h3Gain, now, 0.05);
    gains[3].gain.setTargetAtTime(h4Gain, now, 0.05);
    gains[4].gain.setTargetAtTime(h5Gain, now, 0.05);

    // Warmth filter opens up from warm muffled bass to bright overtone clarity
    const filterFreq = Math.min(1800, f0 * (3.5 + w * 8.5));
    this.nodes.sub.warmthFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);
  }

  /**
   * MODULE 6: Auditory Ganzfeld & Stochastic Resonance
   * Decorrelated stereo 1/f Pink & 1/f^2 Brown noise + dual sweeping resonant cavern filters
   */
  _setupGanzfeldModule() {
    const bus = this.ctx.createGain();
    bus.gain.value = this.params.ganzfeld.enabled ? this.params.ganzfeld.gain * 0.35 : 0.0001;
    bus.connect(this.dryBus);
    bus.connect(this.reverbSendGain);

    // Create 6-second seamless stereo decorrelated Pink/Brown noise buffer
    const rate = this.ctx.sampleRate;
    const len = rate * 6;
    const noiseBuf = this.ctx.createBuffer(2, len, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuf.getChannelData(ch);
      // Paul Kellet's refined pink noise filter + brown integrator blend
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
        data[i] = pink;
      }
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;

    // Color lowpass filter (shifts between 1/f Pink and 1/f^2 Brown warmth)
    const colorFilter = this.ctx.createBiquadFilter();
    colorFilter.type = 'lowpass';
    colorFilter.frequency.value = this._colorToFreq(this.params.ganzfeld.color);

    // Cavern Formant Sweep: two vocal-tract-like formant pairs (F1 + F2) per ear, fed from the
    // FULL-BAND pink noise (pre color filter) so the formants stay audible even with deep brown color.
    // Left and right morph independently through vowel shapes (oo → oh → ah → eh → ee), creating a
    // slowly "breathing / whispering cave" that moves around the head.
    const sweepAmt = this.params.ganzfeld.sweep;
    const makeFormant = (freq) => {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = this._cavernQ(sweepAmt);
      return f;
    };
    const cavernL1 = makeFormant(300);
    const cavernL2 = makeFormant(870);
    const cavernR1 = makeFormant(730);
    const cavernR2 = makeFormant(1090);

    const panL = this.ctx.createStereoPanner();
    const panR = this.ctx.createStereoPanner();
    panL.pan.value = -0.85;
    panR.pan.value = 0.85;

    const directGain = this.ctx.createGain();
    const sweepGain = this.ctx.createGain();
    directGain.gain.value = this._cavernDirect(sweepAmt);
    sweepGain.gain.value = this._cavernWet(sweepAmt);

    noiseSource.connect(colorFilter);
    colorFilter.connect(directGain);
    directGain.connect(bus);

    noiseSource.connect(cavernL1);
    noiseSource.connect(cavernL2);
    noiseSource.connect(cavernR1);
    noiseSource.connect(cavernR2);
    cavernL1.connect(panL);
    cavernL2.connect(panL);
    cavernR1.connect(panR);
    cavernR2.connect(panR);
    panL.connect(sweepGain);
    panR.connect(sweepGain);
    sweepGain.connect(bus);

    noiseSource.start();

    this.nodes.ganzfeld = {
      bus, colorFilter, directGain, sweepGain, panL, panR,
      cavernL1, cavernL2, cavernR1, cavernR2
    };
  }

  // Cavern Formant Sweep mapping (0..1)
  _cavernQ(s) {
    return 2.5 + s * 9.5; // narrower, more vocal resonances as sweep increases
  }

  _cavernDirect(s) {
    return 0.75 * (1.0 - s * 0.8); // broadband noise fades back so the formants come forward
  }

  _cavernWet(s) {
    return s * 3.2; // compensates the energy loss of narrow bandpass filters
  }

  // Vowel formant table (F1, F2 in Hz): oo, oh, ah, eh, ee
  _vowelFormants(pos) {
    const V = [[300, 870], [500, 1000], [730, 1090], [530, 1840], [270, 2290]];
    const n = V.length;
    const x = ((pos % n) + n) % n;
    const i = Math.floor(x);
    const j = (i + 1) % n;
    const t = 0.5 - 0.5 * Math.cos((x - i) * Math.PI); // smooth cosine morph
    return [V[i][0] + (V[j][0] - V[i][0]) * t, V[i][1] + (V[j][1] - V[i][1]) * t];
  }

  _colorToFreq(color) {
    // 0 = bright pink (4500 Hz), 1 = deep brown cavern (180 Hz)
    return 4500 * Math.pow(180 / 4500, color);
  }

  /**
   * 60 Hz Real-Time Frame Update for Continuous Modulation, 3D HRTF Orbits & Chaos Scheduling
   */
  tick() {
    if (!this.ctx || !this.isRunning) return;

    const now = this.ctx.currentTime;
    const elapsed = now - this.startTime;

    // 1. Global 0.1 Hz Coherent Breath Oscillator (10-second cycle = 6 breaths/min)
    this.telemetry.breathPhase = (elapsed * 0.1 * Math.PI * 2) % (Math.PI * 2);
    this.telemetry.breathValue = Math.sin(this.telemetry.breathPhase);

    // 2. Update MODULE 1: 3D HRTF Trajectories (Figure-8 ∞, Far-Horizon Excursion, Circle, Mixed)
    if (this.nodes.spatial) {
      const speed = this.params.spatial.speed;
      const asym = this.params.spatial.asymmetry;
      const count = Math.max(1, Math.min(8, Math.round(this.params.spatial.count || 2)));
      const trajectory = this.params.spatial.trajectory || 'infinity';
      const pulseDepth = this.params.spatial.pulse || 0;
      const manualPos = this.params.spatial.manualPos;
      const voices = this.nodes.spatial.voices;

      for (let i = 0; i < voices.length; i++) {
        const v = voices[i];

        // Completely mute inactive sources above selected count
        if (i >= count) {
          v.voiceGain.gain.setTargetAtTime(0, now, 0.02);
          v.pulseGain.gain.setTargetAtTime(0, now, 0.02);
          this.telemetry.spatialVoices[i].activeEnergy = 0;
          this.telemetry.spatialVoices[i].trail = [];
          continue;
        }

        v.voiceGain.gain.setTargetAtTime(v.weight, now, 0.04);

        let x, y, z, geomType;
        if (manualPos && i === 0) {
          x = manualPos.x;
          y = manualPos.y;
          z = manualPos.z;
          geomType = 'manual';
        } else {
          const pos = this._computeSpatialTrajectory(i, count, elapsed, speed, asym, trajectory);
          x = pos.x;
          y = pos.y;
          z = pos.z;
          geomType = pos.geomType;
        }

        if (v.panner.positionX) {
          v.panner.positionX.setTargetAtTime(x, now, 0.025);
          v.panner.positionY.setTargetAtTime(y, now, 0.025);
          v.panner.positionZ.setTargetAtTime(z, now, 0.025);
        } else {
          v.panner.setPosition(x, y, z);
        }

        const dist = Math.sqrt(x * x + y * y + z * z);

        // Psychoacoustic Front/Back Pinna Shadowing & Air Absorption with distance:
        // In WebAudio, z < 0 is in front of the listener; z > 0 is behind the listener's head.
        const frontness = dist > 0.05 ? Math.max(-1, Math.min(1, -z / dist)) : 0;
        const distAirDamp = 1 / (1 + dist * 0.18); // Far-horizon high-frequency air absorption
        const baseShadow = frontness >= 0
          ? 3400 + frontness * 5800   // Front: bright pinna cues
          : 3400 * Math.pow(0.30, -frontness); // Behind head: pinna cartilage shadow
        v.shadowFilter.frequency.setTargetAtTime(Math.max(450, baseShadow * distAirDamp), now, 0.03);

        // Psychoacoustic Elevation Notch/Peak:
        const elevGainDb = Math.max(-1, Math.min(1, y)) * 9.5;
        v.elevFilter.gain.setTargetAtTime(elevGainDb, now, 0.03);

        // Envelope: when pulseDepth == 0 (default), sound is 100% smooth & continuous (zero oscillation!)
        let activeEnergy = 1.0;
        if (pulseDepth > 0.01) {
          const wave = 0.5 + 0.5 * Math.sin(elapsed * (1.5 + pulseDepth * 3.5) * Math.PI * 2 + (i * Math.PI * 2) / count);
          activeEnergy = (1 - pulseDepth) + pulseDepth * Math.pow(wave, 2.0) * 1.4;
        }

        v.pulseGain.gain.setTargetAtTime(activeEnergy, now, 0.025);

        const tv = this.telemetry.spatialVoices[i];
        tv.x = x;
        tv.y = y;
        tv.z = z;
        tv.dist = dist;
        tv.geomType = geomType;
        tv.activeEnergy = activeEnergy;

        // Store trail point for 3D geometric path visualization
        tv.trail.push({ x, y, z });
        if (tv.trail.length > 56) {
          tv.trail.shift();
        }
      }
    }

    // 3. Update MODULE 2: Chaos Multi-Archetype & Rhythm Scheduler
    if (this.nodes.chaos && this.params.chaos.enabled) {
      if (now >= this.nodes.chaos.nextEventTime) {
        this._triggerChaosDroplet(now);
        const dt = this._computeNextChaosInterval(now, elapsed);
        this.nodes.chaos.nextEventTime = now + dt;
      }
    }

    // 4. Update MODULE 3: Cross-Frequency Phase-Amplitude Coupling (PAC)
    if (this.nodes.pac) {
      const baseFreq = this.params.pac.baseFreq || 136.0;
      const fTheta = this.params.pac.theta;
      const pacDepth = this.params.pac.depth;
      const breathDepth = this.params.pac.breath;

      // Slow Phase Rhythm (1.5 .. 12 Hz): Theta wave & sharp positive-peak gate
      const thetaPhase = (elapsed * fTheta * Math.PI * 2) % (Math.PI * 2);
      const thetaWave = Math.cos(thetaPhase);
      // Gate Gamma bursts strictly on the positive crests of the Theta wave (0 in troughs, 1 at crest)
      const thetaPeakGate = Math.pow(Math.max(0, thetaWave), 2.4);

      // 0.1 Hz Coherent Breath Swell (10-second cycle: 5s Inhale ▲, 5s Exhale ▼)
      const breathNorm = 0.5 + 0.5 * this.telemetry.breathValue; // 0 = Exhale trough, 1 = Inhale peak
      // At breathDepth=0 -> steady 1.0; at breathDepth=1 -> swells from 0.10 (Exhale whisper) to 1.35 (Inhale peak)
      const breathAmp = (1.0 - breathDepth * 0.90) + breathDepth * 1.25 * Math.pow(breathNorm, 1.4);

      // Harmonic Filter Bloom synchronized with the 10-second breath
      const pacCutoff = breathDepth <= 0.01
        ? Math.min(9500, baseFreq * 6.5)
        : Math.min(10000, baseFreq * (1.4 + (1.0 - breathDepth) * 5.0 + breathDepth * 10.5 * Math.pow(breathNorm, 1.6)));
      const binCutoff = breathDepth <= 0.01
        ? Math.min(4800, baseFreq * 3.5)
        : Math.min(5500, baseFreq * (1.2 + (1.0 - breathDepth) * 2.3 + breathDepth * 4.2 * breathNorm));

      this.nodes.pac.pacFilter.frequency.setTargetAtTime(pacCutoff, now, 0.03);
      this.nodes.pac.binFilter.frequency.setTargetAtTime(binCutoff, now, 0.03);

      // PAC Coupling Index (0% = pure binaural wave, no Gamma bursts; 100% = intense Theta-peak-locked Gamma bursts)
      const gammaBurstTarget = pacDepth <= 0.005
        ? 0.0
        : pacDepth * thetaPeakGate * 0.92 * breathAmp;

      // Binaural carrier also pulses deeper with Theta as PAC Coupling Index approaches 100%
      const binThetaMod = (1.0 - pacDepth * 0.50) + pacDepth * 0.50 * (0.25 + 0.75 * thetaPeakGate);
      const binTarget = 0.42 * binThetaMod * breathAmp;

      this.nodes.pac.pacModGain.gain.setTargetAtTime(gammaBurstTarget, now, 0.006);
      this.nodes.pac.binGain.gain.setTargetAtTime(binTarget, now, 0.015);

      this.telemetry.thetaPhase = thetaPhase;
      this.telemetry.gammaEnvelope = gammaBurstTarget;
      this.telemetry.pacIndex = pacDepth;
    }

    // 5. Update MODULE 4: Fractal Shepard-Risset Voices (Harmonious Just-Intonation Multi-Scale 1/f Cascade)
    if (this.nodes.fractal) {
      const dt = Math.min(0.1, now - this.nodes.fractal.lastUpdateTime);
      this.nodes.fractal.lastUpdateTime = now;

      const speed = this.params.fractal.speed; // octaves per second
      const centerFreq = this.params.fractal.center;
      const fDepth = this.params.fractal.depth; // 0 = pure octave Shepard, 1 = full celestial multi-scale triad cascade

      const voices = this.nodes.fractal.voices;
      for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        v.octavePos = (v.octavePos + speed * dt * 0.125 + 1.0) % 1.0;

        // Raised-cosine bell envelope across 8-octave span
        const bell = 0.5 - 0.5 * Math.cos(v.octavePos * Math.PI * 2);
        const baseOctaveOffset = (v.octavePos - 0.5) * 5.2; // Warm 5.2-octave span around center

        // Keep all 8 voices in 100% pure octave alignment (zero eerie microtonal detuning!)
        const freq = Math.max(32, Math.min(6400, centerFreq * Math.pow(2, baseOctaveOffset)));

        // Pure Just-Intonation Celestial Triad ratios: Root (1:1), Major 3rd (5:4) / Major 9th (9:8), Perfect 5th (3:2)
        const thirdRatio = i % 2 === 0 ? 1.25 : 1.125;
        const fifthRatio = 1.5;

        v.osc.frequency.setTargetAtTime(freq, now, 0.025);
        v.thirdOsc.frequency.setTargetAtTime(Math.min(8000, freq * thirdRatio), now, 0.025);
        v.fifthOsc.frequency.setTargetAtTime(Math.min(8000, freq * fifthRatio), now, 0.025);

        // Scale-Invariant Multi-Scale 1/f Weierstrass Harmonic Blossoming:
        // Low octaves breathe slowly (~0.26 Hz); mid octaves weave medium waves (~0.85 Hz); high octaves shimmer gently (~2.2 Hz)
        const scaleRateHz = 0.26 * Math.pow(1.82, v.octavePos * 3.6);
        const basePhase = elapsed * scaleRateHz * Math.PI * 2 + i * 0.785;

        // 4-scale 1/f Weierstrass wave for Root (0 deg), Major 3rd (120 deg), and Perfect 5th (240 deg)
        const wRoot =
          0.52 * Math.sin(basePhase) +
          0.26 * Math.sin(basePhase * 2.0 + 0.8) +
          0.14 * Math.sin(basePhase * 4.0 + 1.9) +
          0.08 * Math.sin(basePhase * 8.0 + 0.4);

        const wThird =
          0.52 * Math.sin(basePhase + 2.094) +
          0.26 * Math.sin(basePhase * 2.0 + 2.894) +
          0.14 * Math.sin(basePhase * 4.0 + 3.994) +
          0.08 * Math.sin(basePhase * 8.0 + 2.494);

        const wFifth =
          0.52 * Math.sin(basePhase + 4.188) +
          0.26 * Math.sin(basePhase * 2.0 + 4.988) +
          0.14 * Math.sin(basePhase * 4.0 + 6.088) +
          0.08 * Math.sin(basePhase * 8.0 + 4.588);

        const rootPulse = Math.pow(0.5 + 0.5 * wRoot, 1.8);
        const thirdPulse = Math.pow(0.5 + 0.5 * wThird, 2.0);
        const fifthPulse = Math.pow(0.5 + 0.5 * wFifth, 2.0);

        // At fDepth=0 -> smooth pure octave glide; as fDepth->1 -> lush multi-scale Root / Major-3rd / Perfect-5th arpeggio cascade
        const rootAmp = bell * ((1.0 - fDepth * 0.55) + fDepth * 0.95 * rootPulse);
        const thirdAmp = fDepth <= 0.005 ? 0.0 : bell * fDepth * thirdPulse * 0.14;
        const fifthAmp = fDepth <= 0.005 ? 0.0 : bell * fDepth * fifthPulse * 0.16;

        v.gain.gain.setTargetAtTime(rootAmp * 0.19, now, 0.025);
        v.thirdGain.gain.setTargetAtTime(thirdAmp, now, 0.025);
        v.fifthGain.gain.setTargetAtTime(fifthAmp, now, 0.025);

        // Gentle stereo breathing
        const panPos = Math.max(-0.9, Math.min(0.9, Math.sin(v.octavePos * Math.PI * 2 + fDepth * wRoot * 0.9) * 0.65));
        v.pan.pan.setTargetAtTime(panPos, now, 0.04);

        this.telemetry.shepardVoices[i].octavePos = v.octavePos;
        this.telemetry.shepardVoices[i].freq = freq;
        this.telemetry.shepardVoices[i].amp = rootAmp + (thirdAmp + fifthAmp) * 2.5;
        this.telemetry.shepardVoices[i].ripple = fDepth * wRoot;
      }
    }

    // 6. Update MODULE 5: Infrasound & Sub-Bass Pulse
    if (this.nodes.sub) {
      const pulseHz = this.params.sub.pulse;
      const pulseMod = 0.55 + 0.45 * Math.sin(elapsed * pulseHz * Math.PI * 2);
      this.nodes.sub.pulseGain.gain.setTargetAtTime(pulseMod, now, 0.025);
    }

    // 7. Update MODULE 6: Ganzfeld Cavern Vowel-Formant Sweeps (independent L/R morphing)
    if (this.nodes.ganzfeld) {
      const g = this.nodes.ganzfeld;
      const s = this.params.ganzfeld.sweep;
      // Morph speed grows slightly with sweep depth (one full vowel cycle every ~45s → ~20s)
      const rate = 0.11 + s * 0.14;
      const [l1, l2] = this._vowelFormants(elapsed * rate);
      const [r1, r2] = this._vowelFormants(elapsed * rate * 0.77 + 2.3);
      g.cavernL1.frequency.setTargetAtTime(l1, now, 0.06);
      g.cavernL2.frequency.setTargetAtTime(l2, now, 0.06);
      g.cavernR1.frequency.setTargetAtTime(r1, now, 0.06);
      g.cavernR2.frequency.setTargetAtTime(r2, now, 0.06);
      // The two caverns slowly drift around the head
      g.panL.pan.setTargetAtTime(-0.85 + 0.5 * s * Math.sin(elapsed * 0.09), now, 0.1);
      g.panR.pan.setTargetAtTime(0.85 - 0.5 * s * Math.sin(elapsed * 0.07 + 1.2), now, 0.1);
    }

    // 8. Cathedral Shimmer: organic breathing & subtle choral pitch-drift
    if (this.shimmerVoices && this.params.reverbMix > 0.01) {
      const mix = this.params.reverbMix;
      for (let i = 0; i < this.shimmerVoices.length; i++) {
        const v = this.shimmerVoices[i];
        // Slow organic breath wave (4-8 second period per voice)
        const breath = 0.5 + 0.5 * Math.sin(elapsed * v.rate * Math.PI * 2 + v.phase);
        // Subtle celestial micro-drift (±1.5 Hz)
        const drift = Math.sin(elapsed * (v.rate * 1.8) * Math.PI * 2 + v.phase) * v.depth;
        v.osc.frequency.setTargetAtTime(v.baseFreq + drift, now, 0.08);

        // Vocal swell envelope
        const voiceGain = Math.pow(breath, 1.6) * 0.12 * Math.min(1.0, mix * 1.4);
        v.g.gain.setTargetAtTime(voiceGain, now, 0.08);
      }
    } else if (this.shimmerVoices) {
      for (let i = 0; i < this.shimmerVoices.length; i++) {
        this.shimmerVoices[i].g.gain.setTargetAtTime(0, now, 0.05);
      }
    }
  }

  /**
   * Parameter Update API for UI Controls & Presets
   */
  setMasterGain(val) {
    this.params.masterGain = val;
    if (this.ctx && this.isRunning) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  setReverbMix(val) {
    this.params.reverbMix = val;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.reverbSendGain.gain.setTargetAtTime(this._reverbSendLevel(val), now, 0.08);
      this.shimmerGain.gain.setTargetAtTime(this._shimmerLevel(val), now, 0.08);
      this.dryBus.gain.setTargetAtTime(this._dryLevel(val), now, 0.08);
    }
  }

  updateModule(mod, key, val) {
    if (!this.params[mod]) return;
    this.params[mod][key] = val;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    if (mod === 'spatial') {
      const targetBus = this.params.spatial.enabled ? this.params.spatial.gain * 0.52 : 0.0001;
      this.nodes.spatial.bus.gain.setTargetAtTime(targetBus, now, 0.08);

      if (key === 'collapse') {
        this.nodes.spatial.coreGainL.gain.cancelScheduledValues(now);
        this.nodes.spatial.coreGainR.gain.cancelScheduledValues(now);
        if (val <= 0.005) {
          this.nodes.spatial.coreGainL.gain.setValueAtTime(0, now);
          this.nodes.spatial.coreGainR.gain.setValueAtTime(0, now);
        } else {
          const lvl = val * 0.16;
          this.nodes.spatial.coreGainL.gain.setTargetAtTime(lvl, now, 0.06);
          this.nodes.spatial.coreGainR.gain.setTargetAtTime(-lvl, now, 0.06);
        }
      } else if (key === 'tuning' || key === 'baseFreq') {
        const ratios = this.tuningRatios[this.params.spatial.tuning] || this.tuningRatios.octaves;
        const base = this.params.spatial.baseFreq;
        this.nodes.spatial.coreOscL.frequency.setTargetAtTime(base, now, 0.1);
        this.nodes.spatial.coreOscR.frequency.setTargetAtTime(base, now, 0.1);
        this.nodes.spatial.voices.forEach((v, i) => {
          const f = base * ratios[i];
          v.freq = f;
          v.osc.frequency.setTargetAtTime(f, now, 0.1);
          v.bodyOsc.frequency.setTargetAtTime(f, now, 0.1);
          v.bodyFilter.frequency.setTargetAtTime(Math.min(3200, f * 8), now, 0.1);
          this.telemetry.spatialVoices[i].freq = f;
        });
      } else if (key === 'trajectory' || key === 'count') {
        this.telemetry.spatialVoices.forEach((tv) => {
          tv.trail = [];
        });
      }
    } else if (mod === 'chaos') {
      const targetBus = this.params.chaos.enabled ? this.params.chaos.gain * 0.45 : 0.0001;
      this.nodes.chaos.bus.gain.setTargetAtTime(targetBus, now, 0.08);
    } else if (mod === 'pac') {
      const targetBus = this.params.pac.enabled ? this.params.pac.gain * 0.48 : 0.0001;
      this.nodes.pac.bus.gain.setTargetAtTime(targetBus, now, 0.08);
      if (key === 'baseFreq' || key === 'theta') {
        const c = this.params.pac.baseFreq || 136.0;
        const half = (this.params.pac.theta || 6.0) / 2;
        this.nodes.pac.carrierFreq = c;
        this.nodes.pac.binOscL.frequency.setTargetAtTime(Math.max(20, c - half), now, 0.06);
        this.nodes.pac.binOscR.frequency.setTargetAtTime(Math.max(20, c + half), now, 0.06);
        this.nodes.pac.binBodyL.frequency.setTargetAtTime(Math.max(20, c - half), now, 0.06);
        this.nodes.pac.binBodyR.frequency.setTargetAtTime(Math.max(20, c + half), now, 0.06);
        this.nodes.pac.pacCarrier1.frequency.setTargetAtTime(c * 2.0, now, 0.06);
        this.nodes.pac.pacCarrier2.frequency.setTargetAtTime(c * 3.0, now, 0.06);
        this.nodes.pac.pacCarrier3.frequency.setTargetAtTime(c * 4.0, now, 0.06);
      } else if (key === 'gamma') {
        this.nodes.pac.gammaOsc.frequency.setTargetAtTime(val, now, 0.015);
      }
    } else if (mod === 'fractal') {
      const targetBus = this.params.fractal.enabled ? this.params.fractal.gain * 0.42 : 0.0001;
      this.nodes.fractal.bus.gain.setTargetAtTime(targetBus, now, 0.12);
    } else if (mod === 'sub') {
      const targetBus = this.params.sub.enabled ? this.params.sub.gain * 0.45 : 0.0001;
      this.nodes.sub.bus.gain.setTargetAtTime(targetBus, now, 0.08);
      if (key === 'freq') {
        const f0 = val;
        this.nodes.sub.subOscs.forEach((osc, i) => {
          osc.frequency.setTargetAtTime(f0 * this.nodes.sub.ratios[i], now, 0.08);
        });
        this.nodes.sub.warmthFilter.frequency.setTargetAtTime(Math.min(1800, f0 * (3.5 + this.params.sub.warmth * 8.5)), now, 0.08);
      } else if (key === 'warmth') {
        this._updateSubWarmth(val);
      }
    } else if (mod === 'ganzfeld') {
      const targetBus = this.params.ganzfeld.enabled ? this.params.ganzfeld.gain * 0.35 : 0.0001;
      this.nodes.ganzfeld.bus.gain.setTargetAtTime(targetBus, now, 0.08);
      if (key === 'color') {
        this.nodes.ganzfeld.colorFilter.frequency.setTargetAtTime(this._colorToFreq(val), now, 0.1);
      } else if (key === 'sweep') {
        const g = this.nodes.ganzfeld;
        g.directGain.gain.setTargetAtTime(this._cavernDirect(val), now, 0.1);
        g.sweepGain.gain.setTargetAtTime(this._cavernWet(val), now, 0.1);
        const q = this._cavernQ(val);
        [g.cavernL1, g.cavernL2, g.cavernR1, g.cavernR2].forEach((f) => f.Q.setTargetAtTime(q, now, 0.1));
      }
    }
  }
}

window.ConsciousnessAudioEngine = ConsciousnessAudioEngine;
