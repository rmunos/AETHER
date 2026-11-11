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
        palette: 'water_bowl',  // 'water_bowl' | 'water_drops' | 'crackle' | 'whisper' | 'tapping' | 'rich8d' | 'shamanic'
        trajectory: 'bifurcation_random', // 'bifurcation_random' | 'bifurcation5m' | 'orbit8d' | 'zenith_arch' | 'helix3d' | 'infinity' | 'peripersonal' | 'radial' | 'mixed' | 'circle' | 'spiral' | 'torus'
        count: 2,               // 1..8 active moving 3D sources
        baseFreq: 174,          // 36..320 Hz base fundamental pitch (174 Hz warm singing bowl & crystal harp register)
        gain: 0.85,
        speed: 0.16,
        spiral: 0.0,            // 0..3 Toroidal Spiral Speed around head (0 = No Spiraling / Pure Vertical Turning, >0 = Helical Spiral revolutions)
        pulse: 0.50,            // Drops <-> Moving Inhale/Exhale & Harmonic Sound Crossfader (0 = 100% Drops Only, 1 = 100% Moving Sound Only / 0% Drops)
        rate: 3.2,              // 0.2..10 events/s for 3D Water Drops & ASMR Triggers emitted from moving sources
        auricle: 0.90,          // 0..1 Ear Auricle (Pinna) Notch, Blauert Bands, Cranial Head-Shadow & ITD/ILD Depth
        elevation: 0.85,        // 0..1 3D Vertical Elevation Range (0 = Flat Horizontal, 1 = Full -75° Floor <-> +85° Zenith)
        collapse: 0.0,          // 0 = completely off, 1 = full in-cranial phase core
        asymmetry: 0.80,
        tuning: 'octaves',
        manualPos: null         // {x, y, z} when user drags on 3D canvas
      },
      chaos: {
        enabled: false,
        palette: 'hybrid',      // 'hybrid' | 'metallic' | 'liquid' | 'plucked' | 'subglitch' | 'breath'
        rhythm: 'avalanche',    // 'avalanche' | 'lorenz' | 'polyrhythm' | 'elastic' | 'stochastic'
        scale: 'pentatonic',    // 'chromatic12' | 'dorian' | 'lydian' | 'pentatonic' | 'phrygian'
        gain: 0.65,
        r: 3.74,
        rate: 3.8,
        register: 0.45,         // 0 = deep sub/low, 0.45 = wide multi-octave, 1 = high crystalline
        morph: 0.72
      },
      pac: {
        enabled: false,
        gain: 0.55,
        baseFreq: 110.0,        // 55..432 Hz selectable base carrier frequency (aligned in harmonic unison with 110 Hz spatial root)
        harmonics: 0.45,        // 0 = pure fundamental sine, 1 = rich singing bowl / tanpura drone
        theta: 6.0,
        gamma: 40.0,
        depth: 0.70,
        breath: 0.65
      },
      fractal: {
        enabled: false,
        gain: 0.40,
        speed: 0.06,
        depth: 0.65,
        center: 220
      },
      sub: {
        enabled: false,
        gain: 0.50,
        freq: 34.0,
        pulse: 1.6,
        warmth: 0.45
      },
      ganzfeld: {
        enabled: false,
        gain: 0.30,
        color: 0.62,
        sweep: 0.55
      },
      asmr: {
        enabled: false,
        gain: 0.50,
        palette: 'crackle',   // 'whisper' | 'crackle' | 'tapping' | 'shamanic' | 'throat'
        proximity: 0.25,      // 0.05 (intimate 5cm) .. 1.0 (ambient room)
        rate: 3.5,            // 0.5 .. 8.0 events/s
        resonance: 0.65       // 0..1 filter Q / tingle brightness / overtone purity
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
      spatialRipples: [],  // {x, y, z, time, voiceIndex, palette} for 3D Water Drops & ASMR triggers
      spatialVoices: [],   // {x, y, z, freq, index, normAmp}
      shepardVoices: []    // {octavePos, freq, amp}
    };

    this.tuningRatios = {
      octaves: [1, 1, 2, 2, 3, 3, 4, 4],
      just: [1, 5 / 4, 3 / 2, 2, 5 / 2, 3, 4, 6],
      golden: [1, 3 / 2, 2, 3, 4, 6, 8, 12],
      overtone: [1, 2, 3, 4, 5, 6, 7, 8],
      quartal: [1, 4 / 3, 3 / 2, 2, 8 / 3, 3, 4, 6]
    };

    this.nodes = {};
    this.chaosTimer = null;
  }

  async init() {
    if (this.ctx) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    // Use 'playback' latency hint for glitch-free, underrun-proof buffer depth on Android background
    this.ctx = new AudioCtx({ latencyHint: 'playback' });
    this.ctx.onstatechange = () => {
      if (this.ctx && this.ctx.state === 'suspended' && this.isRunning) {
        this.ctx.resume().catch(() => {});
      }
    };
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

    // High-density diffused cathedral convolver (optimized buffer for glitch-free mobile playback)
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this._createCathedralImpulse(2.2, 2.6);

    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 1.0;

    // Cathedral Shimmer: high-Q passive resonators tuned to just-intonation intervals (C5..G6)
    // excited exclusively by the reverb send, then diffused by the convolver -> a celestial "singing halo"
    // that never generates autonomous tones and stays 100% silent when sub-bass / dry modules play.
    this.shimmerGain = this.ctx.createGain();
    this.shimmerGain.gain.value = this._shimmerLevel(this.params.reverbMix);

    this.shimmerVoices = [];
    const shimmerFreqs = [523.25, 654.06, 784.88, 1046.50, 1308.13, 1569.75];
    shimmerFreqs.forEach((f, i) => {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 24;

      const g = this.ctx.createGain();
      g.gain.value = 0.35;

      const pan = this.ctx.createStereoPanner();
      pan.pan.value = i % 2 === 0 ? -0.65 : 0.65;

      this.reverbSendGain.connect(bp);
      bp.connect(g);
      g.connect(pan);
      pan.connect(this.shimmerGain);

      this.shimmerVoices.push({ bp, g, pan, rate: 0.03 + i * 0.015, phase: i * 1.2 });
    });

    this.shimmerGain.connect(this.reverbNode);

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

    // Build all 7 synthesis modules
    this._setupSpatialModule();
    this._setupChaosModule();
    this._setupPACModule();
    this._setupFractalModule();
    this._setupSubBassModule();
    this._setupGanzfeldModule();
    this._setupASMRModule();
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
   * MODULE 1: Unified 8D Binaural Auricle (Pinna) & Spatial ASMR Engine
   * Combines 1-8 moving 3D sources with:
   *  - Rich Continuous Moving Voices (Singing Bowls, Flowing Stream, Silk Brush, Whisper Formants, 8D Harmonic Pad, Tibetan Overtones)
   *  - Spatialized 3D Event Emitters (Minnaert Water Droplets, Silk Crackles, Bamboo/Wood/Glass Taps, Shamanic Frame Drum & Rattle)
   *  - Anthropometric Ear Auricle (Pinna) Filter Chain:
   *      1. Blauert Front/Back Directional Bands (3.65 kHz frontal presence vs 1.05 kHz posterior neck band)
   *      2. Concha Cavity Funnel Resonance (4.5 kHz)
   *      3. Direction-Dependent Pinna Antihelix Spectral Notch (sweeping 5.1 kHz to 11.5 kHz with 3D elevation & azimuth)
   *      4. Pinna Rim Rear Cartilage Shadow
   *  - Explicit Binaural Interaural Time Difference (ITD 0..720 us + Doppler), Contralateral Cranial Head-Shadow Low-Pass,
   *    Near-Field Spherical ILD, KEMAR HRTF PannerNode, and 8D Early-Reflection Room Externalizer.
   */
  _setupSpatialModule() {
    const bus = this.ctx.createGain();
    const initialGain = this.params.spatial.enabled ? this.params.spatial.gain * 0.72 : 0.0001;
    bus.gain.value = initialGain;
    bus.connect(this.spatialDryBus);

    // 8D Early Lateral Reflection Externalizer (projects sound outside the skull without muddying the center)
    const extSend = this.ctx.createGain();
    extSend.gain.value = 0.16 * (this.params.spatial.auricle ?? 0.9);
    const extFilter = this.ctx.createBiquadFilter();
    extFilter.type = 'bandpass';
    extFilter.frequency.value = 1400;
    extFilter.Q.value = 0.7;

    const extDelayL = this.ctx.createDelay(0.05);
    const extDelayR = this.ctx.createDelay(0.05);
    extDelayL.delayTime.value = 0.0165; // 16.5 ms left wall early reflection
    extDelayR.delayTime.value = 0.0235; // 23.5 ms right wall early reflection

    const extPanL = this.ctx.createStereoPanner();
    const extPanR = this.ctx.createStereoPanner();
    extPanL.pan.value = -0.92;
    extPanR.pan.value = 0.92;

    bus.connect(extSend);
    extSend.connect(extFilter);
    extFilter.connect(extDelayL);
    extFilter.connect(extDelayR);
    extDelayL.connect(extPanR); // Cross-lateral reflection
    extDelayR.connect(extPanL);
    extPanL.connect(this.spatialDryBus);
    extPanR.connect(this.spatialDryBus);

    // Shared 5-second pink-velvet noise buffer for continuous stream/whisper/silk textures & auricle air cues
    const rate = this.ctx.sampleRate;
    const noiseLen = rate * 5;
    const pinnaNoiseBuf = this.ctx.createBuffer(1, noiseLen, rate);
    const noiseData = pinnaNoiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      noiseData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.15;
      b6 = white * 0.115926;
    }

    // Short 4ms water/tap surface-impact micro-transient buffer (for crisp auricle localization of drops & taps)
    const clickLen = Math.floor(rate * 0.004);
    const clickBuf = this.ctx.createBuffer(1, clickLen, rate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) {
      cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (rate * 0.0008));
    }

    const baseFreq = this.params.spatial.baseFreq;
    const ratios = this.tuningRatios[this.params.spatial.tuning] || this.tuningRatios.octaves;
    const voices = [];

    // 1. Warm Pure Integer Harmonic Wave (exact integer harmonics 1f, 2f, 3f, 4f, 5f, 6f, 8f)
    // 2. High Pinna-Localization Pure Integer Harmonic Wave (harmonics 6f..48f across 1-8.5 kHz for razor-sharp 3D ITD & Ear-Auricle localization)
    let warmHarmonicWave = null;
    let pinnaHarmonicWave = null;
    if (typeof this.ctx.createPeriodicWave === 'function') {
      const real = new Float32Array(9);
      const imag = new Float32Array(9);
      imag[1] = 1.00;  // 1f Fundamental
      imag[2] = 0.52;  // 2f Octave
      imag[3] = 0.30;  // 3f Twelfth (Perfect 5th)
      imag[4] = 0.18;  // 4f Double Octave
      imag[5] = 0.10;  // 5f Pure Major Third
      imag[6] = 0.06;  // 6f Perfect Fifth
      imag[8] = 0.03;  // 8f Triple Octave
      warmHarmonicWave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });

      const pReal = new Float32Array(49);
      const pImag = new Float32Array(49);
      pImag[6] = 0.35;   // ~1.04 kHz (Posterior Blauert Back-of-Neck cue)
      pImag[8] = 0.30;   // ~1.39 kHz
      pImag[10] = 0.26;  // ~1.74 kHz
      pImag[12] = 0.22;  // ~2.09 kHz
      pImag[16] = 0.20;  // ~2.78 kHz
      pImag[20] = 0.18;  // ~3.48 kHz (Frontal Blauert Front-of-Face cue)
      pImag[24] = 0.16;  // ~4.18 kHz (Below-Chin Notch & Concha Funnel cue)
      pImag[28] = 0.14;  // ~4.87 kHz (Concha Cavity resonance)
      pImag[32] = 0.12;  // ~5.57 kHz
      pImag[36] = 0.10;  // ~6.26 kHz (Ear-level Pinna Antihelix Notch)
      pImag[42] = 0.08;  // ~7.31 kHz
      pImag[48] = 0.07;  // ~8.35 kHz (Blauert Overhead Zenith +85° Sky cue)
      pinnaHarmonicWave = this.ctx.createPeriodicWave(pReal, pImag, { disableNormalization: false });
    }

    for (let i = 0; i < 8; i++) {
      const freq = baseFreq * ratios[i];

      // A. Continuous Generators kept at 0.0 on harmonic modes (replaced by Pure Integer Harmonic 3D Acoustic Pulses!)
      const osc = this.ctx.createOscillator();
      const bodyOsc = this.ctx.createOscillator();
      const overtoneOsc = this.ctx.createOscillator();
      const bodyFilter = this.ctx.createBiquadFilter();
      const toneGain = this.ctx.createGain();
      const bodyGain = this.ctx.createGain();
      const overtoneGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      toneGain.gain.value = 0.0;

      bodyOsc.type = 'sine';
      bodyOsc.frequency.value = freq * 2.0; // Pure 2:1 Octave
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.value = Math.min(2600, freq * 4.5);
      bodyGain.gain.value = 0.0;

      overtoneOsc.type = 'sine';
      overtoneOsc.frequency.value = Math.min(4800, freq * 3.0);
      overtoneGain.gain.value = 0.0;

      // Broadband Texture (Strictly 0.0 on Singing Bowl / Water Drop / Harmonic modes so there is ZERO white noise or wind!)
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = pinnaNoiseBuf;
      noiseSrc.loop = true;

      const formantF1 = this.ctx.createBiquadFilter();
      formantF1.type = 'bandpass';
      formantF1.frequency.value = 680 + (i % 4) * 180;
      formantF1.Q.value = 2.2;

      const formantF2 = this.ctx.createBiquadFilter();
      formantF2.type = 'bandpass';
      formantF2.frequency.value = 1950 + (i % 4) * 380;
      formantF2.Q.value = 2.4;

      const formantGain = this.ctx.createGain();
      formantGain.gain.value = 0.0;

      const noiseBand = this.ctx.createBiquadFilter();
      noiseBand.type = 'bandpass';
      noiseBand.frequency.value = 4800 + (i % 3) * 1100;
      noiseBand.Q.value = 1.1;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.0;

      // Continuous Moving Source Master Gain (controlled by 'pulse' / Continuous Moving Source slider)
      const pulseGain = this.ctx.createGain();
      // Discrete 3D Trigger Input (Water Drops, Crackles, Bamboo Taps, Drum Hits inject here!)
      const triggerInput = this.ctx.createGain();
      triggerInput.gain.value = 1.15;

      const preAuricle = this.ctx.createGain();
      preAuricle.gain.value = 1.0;

      // B. Anthropometric Ear Auricle (Pinna) & Vertical Elevation 6-Stage Spectral Filter Chain
      // 1. Torso / Chest Cavity vs. Overhead Weightlessness Low-Shelf (320 Hz: +6 dB Below Chin vs -5.5 dB Above Crown)
      const torsoFilter = this.ctx.createBiquadFilter();
      torsoFilter.type = 'lowshelf';
      torsoFilter.frequency.value = 320;
      torsoFilter.gain.value = 0.0;

      // 2. Blauert Front/Back Directional Band Filter (3650 Hz Front vs 1050 Hz Behind Neck)
      const blauertFilter = this.ctx.createBiquadFilter();
      blauertFilter.type = 'peaking';
      blauertFilter.frequency.value = 3650;
      blauertFilter.Q.value = 1.5;
      blauertFilter.gain.value = 4.0;

      // 3. Concha Cavity Funnel Resonance (4500 Hz boost when facing front/side)
      const conchaFilter = this.ctx.createBiquadFilter();
      conchaFilter.type = 'peaking';
      conchaFilter.frequency.value = 4500;
      conchaFilter.Q.value = 1.8;
      conchaFilter.gain.value = 3.5;

      // 4. Pinna Antihelix Spectral Notch (sweeps 4.25 kHz Below Chin -> 6.8 kHz Ear Level -> 11.2 kHz Overhead Zenith)
      const elevFilter = this.ctx.createBiquadFilter();
      elevFilter.type = 'peaking';
      elevFilter.frequency.value = 6800;
      elevFilter.Q.value = 4.6;
      elevFilter.gain.value = -12.0;

      // 5. Blauert Overhead Zenith Peak Filter (8600 Hz scapha/antihelix resonance when source is Above Head +Y)
      const zenithFilter = this.ctx.createBiquadFilter();
      zenithFilter.type = 'peaking';
      zenithFilter.frequency.value = 8600;
      zenithFilter.Q.value = 2.2;
      zenithFilter.gain.value = 0.0;

      // 6. Pinna Rim Rear Cartilage Shadow & Distance Air Absorption Low-Pass
      const shadowFilter = this.ctx.createBiquadFilter();
      shadowFilter.type = 'lowpass';
      shadowFilter.frequency.value = 12000;
      shadowFilter.Q.value = 0.85;

      const voiceGain = this.ctx.createGain();

      // C. Dual Binaural Cranial Head-Shadow + Woodworth ITD Delay + Near-Field ILD + KEMAR HRTF
      const itdDelayL = this.ctx.createDelay(0.02);
      const itdDelayR = this.ctx.createDelay(0.02);
      itdDelayL.delayTime.value = 0.0002;
      itdDelayR.delayTime.value = 0.0002;

      const headShadowL = this.ctx.createBiquadFilter();
      const headShadowR = this.ctx.createBiquadFilter();
      headShadowL.type = 'lowpass';
      headShadowR.type = 'lowpass';
      headShadowL.frequency.value = 15000;
      headShadowR.frequency.value = 15000;
      headShadowL.Q.value = 0.707;
      headShadowR.Q.value = 0.707;

      const earGainL = this.ctx.createGain();
      const earGainR = this.ctx.createGain();
      earGainL.gain.value = 0.65;
      earGainR.gain.value = 0.65;

      const earPanL = this.ctx.createStereoPanner();
      const earPanR = this.ctx.createStereoPanner();
      earPanL.pan.value = -1.0;
      earPanR.pan.value = 1.0;

      // Parallel KEMAR HRTF PannerNode for diffuse-field pinna convolution
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.75;
      panner.maxDistance = 25;
      panner.rolloffFactor = 0.48;

      const hrtfGain = this.ctx.createGain();
      hrtfGain.gain.value = 0.16;

      const isActive = i < this.params.spatial.count;
      const weight = 0.42 / Math.pow(i + 1, 0.22);
      voiceGain.gain.value = isActive ? weight : 0;
      pulseGain.gain.value = isActive ? (this.params.spatial.pulse ?? 0.70) : 0;

      // Connect Continuous Generators -> pulseGain -> preAuricle
      osc.connect(toneGain);
      toneGain.connect(pulseGain);

      bodyOsc.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(pulseGain);

      overtoneOsc.connect(overtoneGain);
      overtoneGain.connect(pulseGain);

      noiseSrc.connect(formantF1);
      noiseSrc.connect(formantF2);
      formantF1.connect(formantGain);
      formantF2.connect(formantGain);
      formantGain.connect(pulseGain);

      noiseSrc.connect(noiseBand);
      noiseBand.connect(noiseGain);
      noiseGain.connect(pulseGain);

      pulseGain.connect(preAuricle);
      triggerInput.connect(preAuricle);

      // Connect Auricle & Vertical Elevation Filter Chain
      preAuricle.connect(torsoFilter);
      torsoFilter.connect(blauertFilter);
      blauertFilter.connect(conchaFilter);
      conchaFilter.connect(elevFilter);
      elevFilter.connect(zenithFilter);
      zenithFilter.connect(shadowFilter);
      shadowFilter.connect(voiceGain);

      // Connect Binaural Cranial Shadow + ITD Branch (Left & Right Ears)
      voiceGain.connect(itdDelayL);
      itdDelayL.connect(headShadowL);
      headShadowL.connect(earGainL);
      earGainL.connect(earPanL);
      earPanL.connect(bus);

      voiceGain.connect(itdDelayR);
      itdDelayR.connect(headShadowR);
      headShadowR.connect(earGainR);
      earGainR.connect(earPanR);
      earPanR.connect(bus);

      // Connect parallel KEMAR HRTF Branch
      voiceGain.connect(hrtfGain);
      hrtfGain.connect(panner);
      panner.connect(bus);

      osc.start();
      bodyOsc.start();
      overtoneOsc.start();
      noiseSrc.start(0, (i * 0.61) % 4.5);

      voices.push({
        osc,
        bodyOsc,
        overtoneOsc,
        bodyFilter,
        toneGain,
        bodyGain,
        overtoneGain,
        formantF1,
        formantF2,
        formantGain,
        noiseBand,
        noiseGain,
        pulseGain,
        triggerInput,
        preAuricle,
        torsoFilter,
        blauertFilter,
        conchaFilter,
        elevFilter,
        zenithFilter,
        shadowFilter,
        voiceGain,
        itdDelayL,
        itdDelayR,
        headShadowL,
        headShadowR,
        earGainL,
        earGainR,
        panner,
        hrtfGain,
        index: i,
        freq,
        weight,
        throatHarmonicIdx: i * 2
      });
      this.telemetry.spatialVoices.push({
        x: 0,
        y: 0,
        z: -1,
        dist: 1,
        geomType: 'orbit8d',
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

    this.nodes.spatial = {
      bus,
      extSend,
      pinnaNoiseBuf,
      clickBuf,
      voices,
      warmHarmonicWave,
      pinnaHarmonicWave,
      coreOscL,
      coreOscR,
      coreGainL,
      coreGainR,
      nextTriggerTime: 0,
      nextHarmonicChimeTime: 0,
      nextShamanicTime: 0,
      nextOvertoneStepTime: 0,
      lastTriggeredVoice: 0
    };

    this._applySpatialPaletteVoicing(this.params.spatial.palette || 'water_bowl');
  }

  /**
   * Configures voice timbres for the selected 8D Sound & ASMR Palette
   * On harmonic modes ('water_bowl', 'water_drops', 'rich8d', 'tapping'), the continuous droning oscillators are
   * completely silenced (0.0) and replaced by Pure Integer Harmonic 3D Acoustic Pulses (`_triggerPureHarmonic3DOnVoice`)!
   */
  _applySpatialPaletteVoicing(palette) {
    if (!this.nodes.spatial || !this.ctx) return;
    const now = this.ctx.currentTime;
    const voices = this.nodes.spatial.voices;
    const baseFreq = this.params.spatial.baseFreq || 174;
    const ratios = this.tuningRatios[this.params.spatial.tuning] || this.tuningRatios.octaves;

    voices.forEach((v, i) => {
      const f = baseFreq * ratios[i];
      v.freq = f;
      v.osc.type = 'sine';
      v.bodyOsc.type = 'sine';
      v.osc.frequency.setTargetAtTime(f, now, 0.06);
      v.bodyOsc.frequency.setTargetAtTime(f * 2.0, now, 0.06);

      if (palette === 'rebal') {
        // Monroe Gateway REBAL (Resonant Energy Balloon):
        // Continuous Moving 3D Inhale / Exhale Vocal Formant Breath + Pure Integer Harmonic Resonant Tuning Choir!
        // All gains pass through `v.pulseGain`, which rises and falls with the Inhale/Exhale breath envelope (never a static drone).
        if (this.nodes.spatial.warmHarmonicWave && typeof v.osc.setPeriodicWave === 'function') {
          v.osc.setPeriodicWave(this.nodes.spatial.warmHarmonicWave);
        }
        if (this.nodes.spatial.pinnaHarmonicWave && typeof v.overtoneOsc.setPeriodicWave === 'function') {
          v.overtoneOsc.setPeriodicWave(this.nodes.spatial.pinnaHarmonicWave);
        }
        v.toneGain.gain.setTargetAtTime(0.15, now, 0.05);
        v.bodyGain.gain.setTargetAtTime(0.08, now, 0.05);
        v.overtoneGain.gain.setTargetAtTime(0.08, now, 0.05);
        v.formantF1.Q.setTargetAtTime(5.6, now, 0.05);
        v.formantF2.Q.setTargetAtTime(5.0, now, 0.05);
        v.formantGain.gain.setTargetAtTime(0.36, now, 0.06);
        v.noiseGain.gain.setTargetAtTime(0.20, now, 0.06);
      } else if (palette === 'water_bowl' || palette === 'water_drops' || palette === 'tapping' || palette === 'rich8d') {
        // Silence continuous droning oscillators — replaced by Pure Integer Harmonic 3D Acoustic Pulses!
        v.toneGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.bodyGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.overtoneGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.formantF1.Q.setTargetAtTime(4.2, now, 0.05);
        v.formantF2.Q.setTargetAtTime(3.8, now, 0.05);
        v.formantGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.noiseGain.gain.setTargetAtTime(0.0, now, 0.03);
      } else if (palette === 'crackle') {
        // Soft Binaural Silk Brush
        v.toneGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.bodyGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.overtoneGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.formantF1.Q.setTargetAtTime(4.2, now, 0.05);
        v.formantF2.Q.setTargetAtTime(3.8, now, 0.05);
        v.formantGain.gain.setTargetAtTime(0.10, now, 0.06);
        v.noiseGain.gain.setTargetAtTime(0.12, now, 0.06);
      } else if (palette === 'whisper') {
        // Soft 8D Whispered Vocal Formants
        v.toneGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.bodyGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.overtoneGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.formantF1.Q.setTargetAtTime(4.2, now, 0.05);
        v.formantF2.Q.setTargetAtTime(3.8, now, 0.05);
        v.formantGain.gain.setTargetAtTime(0.24, now, 0.06);
        v.noiseGain.gain.setTargetAtTime(0.14, now, 0.06);
      } else if (palette === 'shamanic') {
        // Pure Integer Harmonic Overtone Drone (zero white noise)
        v.toneGain.gain.setTargetAtTime(0.18, now, 0.06);
        v.bodyGain.gain.setTargetAtTime(0.10, now, 0.06);
        v.overtoneOsc.type = 'sine';
        v.overtoneOsc.frequency.setTargetAtTime(Math.min(4800, f * 3.0), now, 0.06);
        v.overtoneGain.gain.setTargetAtTime(0.08, now, 0.06);
        v.formantF1.Q.setTargetAtTime(4.2, now, 0.05);
        v.formantF2.Q.setTargetAtTime(3.8, now, 0.05);
        v.formantGain.gain.setTargetAtTime(0.0, now, 0.03);
        v.noiseGain.gain.setTargetAtTime(0.0, now, 0.03);
      }
    });
  }

  /**
   * Emits a 3D Phase-Synchronized REBAL (Resonant Energy Balloon) Vibrant Energy Pulse on Voice `v`
   * inspired by Robert Monroe's Gateway Experience:
   * - During INHALE (`rebalCycle >= 0.50`, Feet ▼ -> Whole Body -> Filling Head ▲):
   *   - As energy rises through the body (`w < 0.70`), emits an ascending Just-Intonation Harmonic Chakra Pulse
   *     with an upward bio-energy shimmer + rising vocal breath sparkle.
   *   - As energy crosses & fills the head (`w >= 0.70`), emits a luminous Golden Cranial Chord + Hemi-Sync theta bell.
   * - During EXHALE (`rebalCycle < 0.50`, Head -> Crown Fountain ▲ -> 2/4 Torus Spiral 🌀 -> Feet ▼):
   *   - At the Crown (`u < 0.16`), emits a radiant overhead fountain burst (+85° Sky ▲).
   *   - Along the spinning 3D Torus (`u >= 0.16`), emits crisp Pure Harmonic 3D Toroidal Beacons + Turning Breath Vortex
   *     grains whose pitch and spectral band descend smoothly from Crown (+85°) around the body down to the Feet (-75°)!
   */
  _triggerRebalEnergyOnVoice(v, now, rebalCycle, dropLevel = 0.7, continuousLevel = 0.7) {
    if (!this.ctx || !v || !v.preAuricle) return;
    const dest = v.preAuricle;
    const baseF = Math.max(48, Math.min(440, this.params.spatial.baseFreq || 144));
    const harmAmp = Math.max(0.38, continuousLevel * 0.85 + dropLevel * 0.25);
    const vortexAmp = Math.max(0.25, dropLevel * 0.75 + continuousLevel * 0.20);

    // Record visual ripple at the exact 3D position of Voice v for the 3D radar canvas
    const tv = this.telemetry.spatialVoices[v.index];
    if (tv) {
      this.telemetry.spatialRipples.push({
        x: tv.x,
        y: tv.y,
        z: tv.z,
        time: now,
        voiceIndex: v.index,
        palette: 'rebal'
      });
      if (this.telemetry.spatialRipples.length > 28) {
        this.telemetry.spatialRipples.shift();
      }
    }

    if (rebalCycle >= 0.50) {
      // =========================================================================
      // INSPIRATION / INHALE PHASE (Feet ▼ -> Rising Through Body -> Filling Head ▲)
      // =========================================================================
      const w = (rebalCycle - 0.50) * 2.0; // 0..1 progress of Inhale
      if (w < 0.70) {
        // Stage I1: Ascending through the physical body core (Feet -> Pelvis -> Heart -> Throat -> Head)
        const c = w / 0.70; // 0 (Feet) -> 1 (Entering Head)
        // Ascending Just-Intonation Harmonic Ladder (Root -> Maj2 -> Maj3 -> 4th -> 5th -> Maj6 -> Maj7 -> Octave)
        const ladder = [1.0, 1.125, 1.25, 1.3333, 1.5, 1.6667, 1.875, 2.0];
        const stepIdx = Math.min(ladder.length - 1, Math.floor(c * ladder.length));
        const fStart = baseF * ladder[stepIdx];
        const fEnd = fStart * 1.045; // Subtle upward energy lift during each pulse

        // 1. Warm Ascending Integer Harmonic Pulse (1f..8f)
        const bodyOsc = this.ctx.createOscillator();
        const bodyEnv = this.ctx.createGain();
        if (this.nodes.spatial.warmHarmonicWave && typeof bodyOsc.setPeriodicWave === 'function') {
          bodyOsc.setPeriodicWave(this.nodes.spatial.warmHarmonicWave);
        } else {
          bodyOsc.type = 'sine';
        }
        bodyOsc.frequency.setValueAtTime(fStart, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(fEnd, now + 0.36);

        bodyEnv.gain.setValueAtTime(0.0001, now);
        bodyEnv.gain.linearRampToValueAtTime(0.58 * harmAmp, now + 0.006);
        bodyEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.42);

        bodyOsc.connect(bodyEnv);
        bodyEnv.connect(dest);
        bodyOsc.start(now);
        bodyOsc.stop(now + 0.44);

        // 2. Crisp Upper-Harmonic Pinna Elevation Pluck (6f..48f across 1-8.5 kHz so the ear tracks the vertical climb!)
        const pinnaOsc = this.ctx.createOscillator();
        const pinnaEnv = this.ctx.createGain();
        if (this.nodes.spatial.pinnaHarmonicWave && typeof pinnaOsc.setPeriodicWave === 'function') {
          pinnaOsc.setPeriodicWave(this.nodes.spatial.pinnaHarmonicWave);
          pinnaOsc.frequency.setValueAtTime(fStart, now);
          pinnaOsc.frequency.exponentialRampToValueAtTime(fEnd, now + 0.085);
        } else {
          pinnaOsc.type = 'sine';
          pinnaOsc.frequency.setValueAtTime(Math.min(5200, fStart * 8.0), now);
        }
        pinnaEnv.gain.setValueAtTime(0.0001, now);
        pinnaEnv.gain.linearRampToValueAtTime(0.32 * harmAmp, now + 0.003);
        pinnaEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.095);

        pinnaOsc.connect(pinnaEnv);
        pinnaEnv.connect(dest);
        pinnaOsc.start(now);
        pinnaOsc.stop(now + 0.105);

        // 3. Upward "Inspire" Prana Breath Rush Grain (sweeps upward with body elevation)
        const rushDur = 0.095;
        const rushLen = Math.floor(this.ctx.sampleRate * rushDur);
        const rushBuf = this.ctx.createBuffer(1, rushLen, this.ctx.sampleRate);
        const rd = rushBuf.getChannelData(0);
        for (let i = 0; i < rushLen; i++) {
          rd[i] = (Math.random() * 2 - 1) * Math.sin((i / rushLen) * Math.PI);
        }
        const rushSrc = this.ctx.createBufferSource();
        rushSrc.buffer = rushBuf;
        const rushBP = this.ctx.createBiquadFilter();
        rushBP.type = 'bandpass';
        const fLow = 1100 + c * 2200;
        rushBP.frequency.setValueAtTime(fLow, now);
        rushBP.frequency.exponentialRampToValueAtTime(fLow * 1.45, now + rushDur);
        rushBP.Q.value = 3.2;
        const rushGain = this.ctx.createGain();
        rushGain.gain.value = 0.34 * vortexAmp;
        rushSrc.connect(rushBP);
        rushBP.connect(rushGain);
        rushGain.connect(dest);
        rushSrc.start(now);
        rushSrc.stop(now + rushDur + 0.01);
      } else {
        // Stage I2: Crossing & Filling the Head with Vibrant Golden Energy (w in 0.70..1.00)
        const chordRatios = [2.0, 2.5, 3.0, 4.0]; // Pure Just-Intonation Luminous Major Triad + Double Octave
        const fChord = baseF * chordRatios[v.index % chordRatios.length];

        // 1. Radiant Cranial Harmonic Bloom
        const headOsc = this.ctx.createOscillator();
        const headEnv = this.ctx.createGain();
        if (this.nodes.spatial.warmHarmonicWave && typeof headOsc.setPeriodicWave === 'function') {
          headOsc.setPeriodicWave(this.nodes.spatial.warmHarmonicWave);
        } else {
          headOsc.type = 'sine';
        }
        headOsc.frequency.setValueAtTime(fChord, now);

        // Subtle Hemi-Sync Theta Shimmer Partner (+4.5 Hz Focus-10 beat inside the head)
        const hemiOsc = this.ctx.createOscillator();
        hemiOsc.type = 'sine';
        hemiOsc.frequency.setValueAtTime(fChord + 4.5, now);
        const hemiGain = this.ctx.createGain();
        hemiGain.gain.value = 0.35;

        headEnv.gain.setValueAtTime(0.0001, now);
        headEnv.gain.linearRampToValueAtTime(0.56 * harmAmp, now + 0.010);
        headEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.62);

        headOsc.connect(headEnv);
        hemiOsc.connect(hemiGain);
        hemiGain.connect(headEnv);
        headEnv.connect(dest);
        headOsc.start(now);
        hemiOsc.start(now);
        headOsc.stop(now + 0.64);
        hemiOsc.stop(now + 0.64);

        // 2. Crystalline Crown Sparkle (Pinna Harmonic Wave)
        const sparkOsc = this.ctx.createOscillator();
        const sparkEnv = this.ctx.createGain();
        if (this.nodes.spatial.pinnaHarmonicWave && typeof sparkOsc.setPeriodicWave === 'function') {
          sparkOsc.setPeriodicWave(this.nodes.spatial.pinnaHarmonicWave);
          sparkOsc.frequency.setValueAtTime(fChord, now);
        } else {
          sparkOsc.type = 'sine';
          sparkOsc.frequency.setValueAtTime(Math.min(6400, fChord * 4.0), now);
        }
        sparkEnv.gain.setValueAtTime(0.0001, now);
        sparkEnv.gain.linearRampToValueAtTime(0.30 * harmAmp, now + 0.003);
        sparkEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);
        sparkOsc.connect(sparkEnv);
        sparkEnv.connect(dest);
        sparkOsc.start(now);
        sparkOsc.stop(now + 0.12);
      }
    } else {
      // =========================================================================
      // EXPIRATION / EXHALE PHASE (Crown Fountain ▲ -> 2/4 Torus Spiral 🌀 -> Feet ▼)
      // =========================================================================
      const u = rebalCycle * 2.0; // 0..1 progress of Exhale
      if (u < 0.16) {
        // Stage E1: Crown Fountain Burst (+85° Top of Head ▲)
        const p = u / 0.16;
        const fCrown = baseF * (2.0 + 0.5 * p); // Soaring Octave -> 12th fountain

        const fountOsc = this.ctx.createOscillator();
        const fountEnv = this.ctx.createGain();
        if (this.nodes.spatial.warmHarmonicWave && typeof fountOsc.setPeriodicWave === 'function') {
          fountOsc.setPeriodicWave(this.nodes.spatial.warmHarmonicWave);
        } else {
          fountOsc.type = 'sine';
        }
        fountOsc.frequency.setValueAtTime(fCrown, now);
        fountOsc.frequency.exponentialRampToValueAtTime(fCrown * 1.12, now + 0.22);

        fountEnv.gain.setValueAtTime(0.0001, now);
        fountEnv.gain.linearRampToValueAtTime(0.60 * harmAmp, now + 0.004);
        fountEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.38);

        fountOsc.connect(fountEnv);
        fountEnv.connect(dest);
        fountOsc.start(now);
        fountOsc.stop(now + 0.40);

        // Overhead Zenith Pinna Burst (excites the 8.6 kHz Zenith Scapha Peak & 11 kHz Pinna Notch!)
        const zenOsc = this.ctx.createOscillator();
        const zenEnv = this.ctx.createGain();
        if (this.nodes.spatial.pinnaHarmonicWave && typeof zenOsc.setPeriodicWave === 'function') {
          zenOsc.setPeriodicWave(this.nodes.spatial.pinnaHarmonicWave);
          zenOsc.frequency.setValueAtTime(fCrown, now);
        } else {
          zenOsc.type = 'sine';
          zenOsc.frequency.setValueAtTime(Math.min(7200, fCrown * 6.0), now);
        }
        zenEnv.gain.setValueAtTime(0.0001, now);
        zenEnv.gain.linearRampToValueAtTime(0.38 * harmAmp, now + 0.003);
        zenEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.095);
        zenOsc.connect(zenEnv);
        zenEnv.connect(dest);
        zenOsc.start(now);
        zenOsc.stop(now + 0.105);
      } else {
        // Stage E2 & E3: Splitting in 2 or 4 directions & turning down the 3D Torus to merge at the Feet ▼
        const t = Math.min(1.0, (u - 0.16) / 0.84); // 0 (Crown Split) -> 1 (Merged at Feet)
        // Each of the 4 toroidal streams carries a pure harmonic ratio (Octave, 6th, 5th, Maj 3rd)
        // that glides gently downward by an octave as the torus descends from Crown (+85°) to Feet (-75°)!
        const branchIntervals = [2.0, 1.6667, 1.5, 1.25];
        const branchMult = branchIntervals[v.index % branchIntervals.length];
        const elevPitchScale = 1.15 - 0.55 * t; // High overhead at start of torus -> deep grounded root at feet
        const fTorus = Math.max(48, baseF * branchMult * elevPitchScale);

        // 1. Pure Integer Harmonic 3D Toroidal Beacon (crisp 3.5ms onset for ITD lock + warm 460ms harmonic tail)
        const torOsc = this.ctx.createOscillator();
        const torEnv = this.ctx.createGain();
        if (this.nodes.spatial.warmHarmonicWave && typeof torOsc.setPeriodicWave === 'function') {
          torOsc.setPeriodicWave(this.nodes.spatial.warmHarmonicWave);
        } else {
          torOsc.type = 'sine';
        }
        torOsc.frequency.setValueAtTime(fTorus, now);
        torOsc.frequency.exponentialRampToValueAtTime(fTorus * 0.97, now + 0.42);

        torEnv.gain.setValueAtTime(0.0001, now);
        torEnv.gain.linearRampToValueAtTime(0.62 * harmAmp, now + 0.004);
        torEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.46);

        torOsc.connect(torEnv);
        torEnv.connect(dest);
        torOsc.start(now);
        torOsc.stop(now + 0.48);

        // 2. Pinna & Blauert 3D Localization Pluck (6f..48f across 1-8.5 kHz so Front/Right/Back/Left & Elevation are razor-sharp!)
        const pinnaOsc = this.ctx.createOscillator();
        const pinnaEnv = this.ctx.createGain();
        if (this.nodes.spatial.pinnaHarmonicWave && typeof pinnaOsc.setPeriodicWave === 'function') {
          pinnaOsc.setPeriodicWave(this.nodes.spatial.pinnaHarmonicWave);
          pinnaOsc.frequency.setValueAtTime(fTorus, now);
        } else {
          pinnaOsc.type = 'sine';
          pinnaOsc.frequency.setValueAtTime(Math.min(5400, fTorus * 8.0), now);
        }
        pinnaEnv.gain.setValueAtTime(0.0001, now);
        pinnaEnv.gain.linearRampToValueAtTime(0.38 * harmAmp, now + 0.003);
        pinnaEnv.gain.exponentialRampToValueAtTime(0.0005, now + 0.090);

        pinnaOsc.connect(pinnaEnv);
        pinnaEnv.connect(dest);
        pinnaOsc.start(now);
        pinnaOsc.stop(now + 0.10);

        // 3. Toroidal Turning Vortex Breath Grain ("Expire" energy swirl around the body)
        const swirlDur = 0.090;
        const swirlLen = Math.floor(this.ctx.sampleRate * swirlDur);
        const swirlBuf = this.ctx.createBuffer(1, swirlLen, this.ctx.sampleRate);
        const sd = swirlBuf.getChannelData(0);
        for (let i = 0; i < swirlLen; i++) {
          sd[i] = (Math.random() * 2 - 1) * Math.sin((i / swirlLen) * Math.PI);
        }
        const swirlSrc = this.ctx.createBufferSource();
        swirlSrc.buffer = swirlBuf;
        const swirlBP = this.ctx.createBiquadFilter();
        swirlBP.type = 'bandpass';
        const fSwirl = Math.max(700, 4200 * (1.0 - 0.68 * t));
        swirlBP.frequency.setValueAtTime(fSwirl, now);
        swirlBP.frequency.exponentialRampToValueAtTime(Math.max(520, fSwirl * 0.72), now + swirlDur);
        swirlBP.Q.value = 2.8;
        const swirlGain = this.ctx.createGain();
        swirlGain.gain.value = 0.36 * vortexAmp;
        swirlSrc.connect(swirlBP);
        swirlBP.connect(swirlGain);
        swirlGain.connect(dest);
        swirlSrc.start(now);
        swirlSrc.stop(now + swirlDur + 0.01);
      }
    }
  }

  /**
   * Emits a 100% Pure Integer Harmonic 3D Acoustic Pluck / Bell Note (`n * f0` for integer `n = 1, 2, 3, 4, 5, 6, 8..48`)
   * directly into `v.preAuricle` so it passes through the full 6-stage Ear Auricle + Elevation + Cranial Shadow + ITD + HRTF chain!
   * - Because every partial is an exact integer multiple of `f0` (Moving Source Base Pitch), it sounds 100% pure & consonant.
   * - Because each pulse has a crisp 4ms acoustic pluck onset + upper integer harmonics spanning 1-8.5 kHz that decay over 95ms
   *   into a warm 500ms fundamental tail, the human ear locks onto its 3D Left/Right ITD, Front/Back Blauert bands, and
   *   Up/Down Pinna Elevation Notch with maximum 3D precision!
   */
  _triggerPureHarmonic3DOnVoice(v, now, level = 1.0) {
    if (!this.ctx || !v || !v.preAuricle) return;
    const f0 = Math.max(40, Math.min(880, v.freq || this.params.spatial.baseFreq || 174));
    const dest = v.preAuricle;

    // Record visual ripple at the exact 3D position of Voice v for the 3D radar canvas
    const tv = this.telemetry.spatialVoices[v.index];
    if (tv) {
      this.telemetry.spatialRipples.push({
        x: tv.x,
        y: tv.y,
        z: tv.z,
        time: now,
        voiceIndex: v.index,
        palette: 'harmonic'
      });
      if (this.telemetry.spatialRipples.length > 28) {
        this.telemetry.spatialRipples.shift();
      }
    }

    // Layer 1: Warm Pure Integer Harmonic Body (1f, 2f, 3f, 4f, 5f, 6f, 8f)
    const bodyOsc = this.ctx.createOscillator();
    const bodyEnv = this.ctx.createGain();
    if (this.nodes.spatial.warmHarmonicWave && typeof bodyOsc.setPeriodicWave === 'function') {
      bodyOsc.setPeriodicWave(this.nodes.spatial.warmHarmonicWave);
    } else {
      bodyOsc.type = 'sine';
    }
    bodyOsc.frequency.setValueAtTime(f0, now);

    const bodyDur = 0.52;
    const bodyPeak = 0.62 * level;
    bodyEnv.gain.setValueAtTime(0.0001, now);
    bodyEnv.gain.linearRampToValueAtTime(bodyPeak, now + 0.005); // Crisp, click-free 5ms acoustic onset for ITD lock
    bodyEnv.gain.exponentialRampToValueAtTime(0.0005, now + bodyDur);

    bodyOsc.connect(bodyEnv);
    bodyEnv.connect(dest);
    bodyOsc.start(now);
    bodyOsc.stop(now + bodyDur + 0.015);

    // Layer 2: Upper Integer Harmonic Pinna-Localization Pluck (6f..48f across 1-8.5 kHz, 95ms natural string/bell pluck decay)
    // Gives the Ear Auricle (Blauert 1.05/3.65 kHz, Concha 4.5 kHz, Pinna Notch 4.2-11 kHz, Zenith 8.6 kHz) full pure-harmonic energy!
    const pinnaOsc = this.ctx.createOscillator();
    const pinnaEnv = this.ctx.createGain();
    if (this.nodes.spatial.pinnaHarmonicWave && typeof pinnaOsc.setPeriodicWave === 'function') {
      pinnaOsc.setPeriodicWave(this.nodes.spatial.pinnaHarmonicWave);
      pinnaOsc.frequency.setValueAtTime(f0, now);
    } else {
      pinnaOsc.type = 'sine';
      pinnaOsc.frequency.setValueAtTime(Math.min(4800, f0 * 8.0), now);
    }

    const pinnaDur = 0.095;
    const pinnaPeak = 0.36 * level;
    pinnaEnv.gain.setValueAtTime(0.0001, now);
    pinnaEnv.gain.linearRampToValueAtTime(pinnaPeak, now + 0.003); // 3ms pluck transient
    pinnaEnv.gain.exponentialRampToValueAtTime(0.0005, now + pinnaDur);

    pinnaOsc.connect(pinnaEnv);
    pinnaEnv.connect(dest);
    pinnaOsc.start(now);
    pinnaOsc.stop(now + pinnaDur + 0.01);
  }

  /**
   * Emits a 3D spatialized event (Water Drop, Silk Crackle, Bamboo/Wood/Glass Tap, Whisper Puff, Shamanic Drum, or 8D Chime)
   * directly into Moving 3D Voice `v.triggerInput` so it passes through `v`'s exact 3D Auricle + Cranial Shadow + ITD + HRTF pipeline!
   */
  _triggerSpatialEventOnVoice(v, now, palette, auricle) {
    if (!this.ctx || !v || !v.triggerInput) return;
    const dest = v.triggerInput;

    // Record visual ripple at the exact 3D position of Voice v for the 3D radar canvas
    const tv = this.telemetry.spatialVoices[v.index];
    if (tv) {
      this.telemetry.spatialRipples.push({
        x: tv.x,
        y: tv.y,
        z: tv.z,
        time: now,
        voiceIndex: v.index,
        palette
      });
      if (this.telemetry.spatialRipples.length > 28) {
        this.telemetry.spatialRipples.shift();
      }
    }

    if (palette === 'water_bowl' || palette === 'water_drops') {
      // Minnaert Acoustic Bubble Physics: Water droplet hitting water surface entrains a microscopic air bubble
      // whose resonant frequency chirps rapidly UPWARD (f0 -> 2.2*f0) over 18-32 ms!
      const dropPool = [440, 528, 594, 660, 792, 880, 1056, 1188, 1320];
      const f0 = dropPool[(v.index * 3 + Math.floor(Math.random() * dropPool.length)) % dropPool.length] * (0.92 + Math.random() * 0.16);
      const chirpDur = 0.022 + Math.random() * 0.014;
      const decayDur = 0.055 + Math.random() * 0.035;

      // 1. Primary Upward-Chirping Bubble Sine
      const dropOsc = this.ctx.createOscillator();
      const dropGain = this.ctx.createGain();
      dropOsc.type = 'sine';
      dropOsc.frequency.setValueAtTime(f0, now);
      dropOsc.frequency.setValueAtTime(f0 * 1.04, now + 0.004);
      dropOsc.frequency.exponentialRampToValueAtTime(f0 * (2.05 + Math.random() * 0.35), now + chirpDur);

      dropGain.gain.setValueAtTime(0.001, now);
      dropGain.gain.linearRampToValueAtTime(0.78, now + 0.0025);
      dropGain.gain.exponentialRampToValueAtTime(0.001, now + decayDur);

      dropOsc.connect(dropGain);
      dropGain.connect(dest);
      dropOsc.start(now);
      dropOsc.stop(now + decayDur + 0.005);

      // 2. Crisp Surface-Tension Plink Transient (3.2-6.5 kHz so the Ear Auricle Notch pinpoints the drop's 3D angle!)
      if (this.nodes.spatial.clickBuf) {
        const clickSrc = this.ctx.createBufferSource();
        clickSrc.buffer = this.nodes.spatial.clickBuf;
        const clickBP = this.ctx.createBiquadFilter();
        clickBP.type = 'bandpass';
        clickBP.frequency.value = 3400 + Math.random() * 2800;
        clickBP.Q.value = 2.2;
        const clickGain = this.ctx.createGain();
        clickGain.gain.value = 0.42;
        clickSrc.connect(clickBP);
        clickBP.connect(clickGain);
        clickGain.connect(dest);
        clickSrc.start(now);
      }

      // 3. Secondary Satellite Rebound Micro-Droplet (50% of drops produce a smaller high-pitched splash 35-70 ms later)
      if (Math.random() < 0.52) {
        const t2 = now + 0.034 + Math.random() * 0.038;
        const f2 = f0 * (1.42 + Math.random() * 0.25);
        const subDropOsc = this.ctx.createOscillator();
        const subDropGain = this.ctx.createGain();
        subDropOsc.type = 'sine';
        subDropOsc.frequency.setValueAtTime(f2, t2);
        subDropOsc.frequency.exponentialRampToValueAtTime(f2 * 2.15, t2 + 0.018);

        subDropGain.gain.setValueAtTime(0.001, t2);
        subDropGain.gain.linearRampToValueAtTime(0.42, t2 + 0.002);
        subDropGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.038);

        subDropOsc.connect(subDropGain);
        subDropGain.connect(dest);
        subDropOsc.start(t2);
        subDropOsc.stop(t2 + 0.042);
      }
    } else if (palette === 'crackle') {
      // 1. Tactile Binaural Silk Brush Stroke
      const brushDur = 0.075 + Math.random() * 0.055;
      const brushLen = Math.floor(this.ctx.sampleRate * brushDur);
      const brushBuf = this.ctx.createBuffer(1, brushLen, this.ctx.sampleRate);
      const bd = brushBuf.getChannelData(0);
      for (let i = 0; i < brushLen; i++) {
        bd[i] = (Math.random() * 2 - 1) * Math.sin((i / brushLen) * Math.PI);
      }
      const brushSrc = this.ctx.createBufferSource();
      brushSrc.buffer = brushBuf;
      const brushBP = this.ctx.createBiquadFilter();
      brushBP.type = 'bandpass';
      brushBP.frequency.value = 2200 + Math.random() * 3400;
      brushBP.Q.value = 1.5;
      const brushGain = this.ctx.createGain();
      brushGain.gain.value = 0.45;
      brushSrc.connect(brushBP);
      brushBP.connect(brushGain);
      brushGain.connect(dest);
      brushSrc.start(now);
      brushSrc.stop(now + brushDur + 0.01);

      // 2. 3-5 Crisp Close-Ear Micro-Crackle Pops
      const count = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        const t = now + k * (0.012 + Math.random() * 0.020);
        const len = Math.floor(this.ctx.sampleRate * 0.010);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2800 + Math.random() * 4800;
        f.Q.value = 1.8;
        const g = this.ctx.createGain();
        g.gain.value = 0.65 + Math.random() * 0.30;
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.start(t);
        src.stop(t + 0.014);
      }
    } else if (palette === 'tapping') {
      // Multi-Modal Hollow Bamboo, Rosewood & Crystal Glass Taps with Double-Tap Motifs
      const offsets = Math.random() < 0.42 ? [0, 0.068 + Math.random() * 0.025] : [0];
      const tapPool = [460, 580, 740, 920, 1160, 1420];
      offsets.forEach((off, idx) => {
        const t0 = now + off;
        const vel = idx === 0 ? 1.0 : 0.72;
        const tapFreq = tapPool[Math.floor(Math.random() * tapPool.length)];

        // Mode 1: Hollow Bamboo Fundamental
        const osc1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(tapFreq * 1.22, t0);
        osc1.frequency.exponentialRampToValueAtTime(tapFreq, t0 + 0.012);
        g1.gain.setValueAtTime(0.68 * vel, t0);
        g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.068);
        osc1.connect(g1);
        g1.connect(dest);
        osc1.start(t0);
        osc1.stop(t0 + 0.072);

        // Mode 2: Woody Inharmonic Cavity Mode (2.32x)
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(tapFreq * 2.32, t0);
        g2.gain.setValueAtTime(0.36 * vel, t0);
        g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.030);
        osc2.connect(g2);
        g2.connect(dest);
        osc2.start(t0);
        osc2.stop(t0 + 0.034);

        // Mode 3: Fingernail / Knuckle High-Frequency Transient (for pinna notch localization)
        if (this.nodes.spatial.clickBuf) {
          const clickSrc = this.ctx.createBufferSource();
          clickSrc.buffer = this.nodes.spatial.clickBuf;
          const clickBP = this.ctx.createBiquadFilter();
          clickBP.type = 'bandpass';
          clickBP.frequency.value = 3800 + Math.random() * 2400;
          clickBP.Q.value = 1.8;
          const clickGain = this.ctx.createGain();
          clickGain.gain.value = 0.45 * vel;
          clickSrc.connect(clickBP);
          clickBP.connect(clickGain);
          clickGain.connect(dest);
          clickSrc.start(t0);
        }
      });
    } else if (palette === 'whisper') {
      // Soft Intimate Whispered Consonant Puff ("shh" / "haa" sibilant breath grain)
      const puffDur = 0.14 + Math.random() * 0.10;
      const puffLen = Math.floor(this.ctx.sampleRate * puffDur);
      const puffBuf = this.ctx.createBuffer(1, puffLen, this.ctx.sampleRate);
      const pd = puffBuf.getChannelData(0);
      for (let i = 0; i < puffLen; i++) {
        pd[i] = (Math.random() * 2 - 1) * Math.sin((i / puffLen) * Math.PI);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = puffBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2600 + Math.random() * 2200, now);
      bp.frequency.exponentialRampToValueAtTime(1600 + Math.random() * 1400, now + puffDur);
      bp.Q.value = 2.0;
      const g = this.ctx.createGain();
      g.gain.value = 0.48;
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(now);
      src.stop(now + puffDur + 0.01);
    } else if (palette === 'shamanic') {
      // 1. Shamanic Skin-Frame Drum + 2x Warm Drumhead Body
      const drumOsc = this.ctx.createOscillator();
      const drumBody = this.ctx.createOscillator();
      const drumLP = this.ctx.createBiquadFilter();
      const drumGain = this.ctx.createGain();
      const bodyGain = this.ctx.createGain();

      drumOsc.type = 'sine';
      drumOsc.frequency.setValueAtTime(94, now);
      drumOsc.frequency.exponentialRampToValueAtTime(46, now + 0.14);

      drumBody.type = 'triangle';
      drumBody.frequency.setValueAtTime(188, now);
      drumBody.frequency.exponentialRampToValueAtTime(92, now + 0.11);

      drumLP.type = 'lowpass';
      drumLP.frequency.value = 420;

      drumGain.gain.setValueAtTime(0.88, now);
      drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      bodyGain.gain.setValueAtTime(0.42, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      drumOsc.connect(drumLP);
      drumBody.connect(bodyGain);
      bodyGain.connect(drumLP);
      drumLP.connect(drumGain);
      drumGain.connect(dest);
      drumOsc.start(now);
      drumBody.start(now);
      drumOsc.stop(now + 0.20);
      drumBody.stop(now + 0.13);

      // 2. Off-beat Seed-Pod Rattle (high-frequency shaker so the ear auricle localizes the drum in 3D!)
      const rattleTime = now + 0.075 + (Math.random() - 0.5) * 0.015;
      const rattleLen = Math.floor(this.ctx.sampleRate * 0.048);
      const rattleBuf = this.ctx.createBuffer(1, rattleLen, this.ctx.sampleRate);
      const rd = rattleBuf.getChannelData(0);
      for (let i = 0; i < rattleLen; i++) {
        rd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.012));
      }
      const rattleSrc = this.ctx.createBufferSource();
      rattleSrc.buffer = rattleBuf;
      const rattleBP = this.ctx.createBiquadFilter();
      rattleBP.type = 'bandpass';
      rattleBP.frequency.value = 4200 + Math.random() * 2200;
      rattleBP.Q.value = 1.4;
      const rattleGain = this.ctx.createGain();
      rattleGain.gain.value = 0.52;
      rattleSrc.connect(rattleBP);
      rattleBP.connect(rattleGain);
      rattleGain.connect(dest);
      rattleSrc.start(rattleTime);
      rattleSrc.stop(rattleTime + 0.052);
    } else {
      // 'rich8d': Delicate Crystal Harmonic Bell Beacon on the moving 8D chord source
      const chimeFreq = Math.min(3600, v.freq * (Math.random() < 0.5 ? 2 : 3));
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(chimeFreq, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.32, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(g);
      g.connect(dest);
      osc.start(now);
      osc.stop(now + 0.19);
    }
  }

  /**
   * Returns a synchronized random variation index (0..5) for each 6-stage cycle of 'bifurcation_random'
   * Never repeats the same variation twice in a row, and keeps all paired voices (Right & Left) 100% locked.
   */
  _getBifurcationVariation(cycleIdx) {
    if (!this._bifurcationSeed) {
      this._bifurcationSeed = Math.floor(Math.random() * 100000) + 1337;
    }
    let prev = Math.floor(this._bifurcationSeed) % 6;
    if (cycleIdx <= 0) return prev;
    for (let c = 1; c <= cycleIdx; c++) {
      const h = Math.abs(Math.sin(c * 12.9898 + this._bifurcationSeed * 78.233) * 43758.5453);
      const step = 1 + (Math.floor(h) % 5); // 1..5 offset guarantees next variation != prev
      prev = (prev + step) % 6;
    }
    return prev;
  }

  /**
   * Computes 3D (x, y, z) spherical coordinates for source `i` according to selected 3D / 8D geometry
   * Includes full vertical elevation (-75° Below Chin/Floor <-> +85° Overhead Crown/Zenith)
   * and tunable Toroidal Spiral Speed (`spiral`: 0 = Pure Turning with No Spiraling, >0 = Helical Spiraling around the head)
   */
  _computeSpatialTrajectory(i, count, elapsed, speed, asym, trajectoryMode, elevRange = 0.85, spiral = 0.0) {
    let geom = trajectoryMode;
    if (trajectoryMode === 'mixed') {
      const modes = ['bifurcation_random', 'orbit8d', 'zenith_arch', 'helix3d'];
      geom = modes[i % modes.length];
    }

    const phaseOffset = (i * Math.PI * 2) / Math.max(1, count);
    const theta = elapsed * speed * Math.PI * 2 + phaseOffset;
    const elevScale = Math.max(0, Math.min(1, elevRange));
    const spiralTurns = Math.max(0, spiral !== undefined ? spiral : 0.0);

    let x = 0, y = 0, z = -1;
    let splitFactor = 1.0;
    let stageLabel = '';

    if (geom === 'rebal') {
      // MONROE GATEWAY REBAL (Resonant Energy Balloon) — 5-Stage Breath-Synchronized 3D Toroidal Loop:
      // - EXHALE PHASE (rebalCycle in [0.00 .. 0.50]):
      //   1. Starts in the Head, fountains UP through the Top of the Head (Crown Zenith ▲ +85°).
      //   2. Splits into `count` (2 = Left/Right, 4 = Front/Right/Back/Left) symmetric directions.
      //   3. Turns downward around the outside of the body along a 3D Torus cocoon (with tunable `spiralTurns`:
      //      0 = Pure vertical torus turning with NO horizontal spiraling; >0 = Spiraling around the head at `spiralTurns` rev/loop)
      //      and merges back together at the Feet (Floor ▼ -75°).
      // - INHALE PHASE (rebalCycle in [0.50 .. 1.00]):
      //   4. Merged stream enters at the Feet (Floor ▼ -75°) and rises straight UP through the core of the whole body (x~0, z~0).
      //   5. Crosses into the Head, filling up the entire cranium with vibrant resonant energy before repeating!
      const R = 2.4 + 2.2 * asym; // ~3.5m - 4.6m toroidal cocoon radius around the body
      const effElev = Math.max(0.35, elevScale);
      const rebalCycle = (elapsed * speed * 0.75) % 1.0;
      const nBranches = Math.max(2, count);
      // For 2 branches, align to Right (+90°) and Left (-90°) for maximum binaural separation; for 4+, space evenly around 360°
      const branchAz = nBranches === 2
        ? (i % 2 === 0 ? Math.PI * 0.5 : -Math.PI * 0.5)
        : (i * Math.PI * 2) / nBranches;

      if (rebalCycle < 0.50) {
        // =========================================================
        // EXPIRATION / EXHALE ▼ (0.00 .. 0.50 -> u in 0.00 .. 1.00)
        // =========================================================
        const u = rebalCycle * 2.0;
        const startPoloidal = 0.07 * Math.PI;
        const endPoloidal = 0.93 * Math.PI;
        const crownY = R * 0.92 * Math.cos(startPoloidal) * effElev;
        const crownR = R * Math.sin(startPoloidal);

        if (u < 0.16) {
          // Stage E1: Head -> Fountain Up Through Top of Head (Crown ▲ +85°) & Begin 2/4-Way Split
          const p = u / 0.16; // 0..1
          const bloom = p > 0.55 ? (p - 0.55) / 0.45 : 0.0;
          const rOut = crownR * bloom;
          x = rOut * Math.sin(branchAz);
          z = -rOut * Math.cos(branchAz);
          y = (0.24 * effElev) + (crownY - 0.24 * effElev) * Math.sin(p * Math.PI * 0.5);
          splitFactor = bloom * 0.75;
          stageLabel = p < 0.55
            ? 'EXHALE ▼ [1/5] HEAD → FOUNTAIN UP CROWN ▲'
            : `EXHALE ▼ [2/5] CROWN ▲ → SPLIT ${nBranches} DIRECTIONS`;
        } else if (u < 0.86) {
          // Stage E2: 2 or 4 Streams Turning Downward Around Outside of Body Along a 3D Torus
          const t = (u - 0.16) / 0.70; // 0..1
          const poloidal = startPoloidal + t * (endPoloidal - startPoloidal);
          const horizR = R * Math.sin(poloidal);
          y = R * 0.92 * Math.cos(poloidal) * effElev;
          // Tunable horizontal spiraling around the head (`spiralTurns = 0` => pure vertical torus turning with NO spiraling!)
          const torusTurn = t * Math.PI * 2.0 * spiralTurns;
          const az = branchAz + torusTurn;
          x = horizR * Math.sin(az);
          z = -horizR * Math.cos(az);
          splitFactor = Math.min(1.0, Math.sin(poloidal) * 1.25);
          const modeTag = spiralTurns <= 0.02 ? 'TORUS LOOP (JUST TURNING)' : `TORUS SPIRAL (${spiralTurns.toFixed(1)}x 🌀)`;
          stageLabel = t < 0.50
            ? `EXHALE ▼ [2/5] ${nBranches}-WAY ${modeTag}`
            : `EXHALE ▼ [3/5] TURNING DOWN TORUS → TOWARD FEET ▼`;
        } else {
          // Stage E3: Converge & Merge Back Together Under the Feet (Floor ▼ -75°)
          const m = (u - 0.86) / 0.14; // 0..1
          const remR = R * Math.sin(endPoloidal) * (1.0 - m);
          const az = branchAz + Math.PI * 2.0 * spiralTurns * (1.0 + m * 0.15);
          x = remR * Math.sin(az);
          z = -remR * Math.cos(az);
          y = -R * 0.92 * (Math.cos(startPoloidal) + (1.0 - Math.cos(startPoloidal)) * m) * effElev;
          splitFactor = (1.0 - m) * 0.25;
          stageLabel = 'EXHALE ▼ [3/5] MERGE AT FEET ▼ (ROOT CONVERGENCE)';
        }
      } else {
        // =========================================================
        // INSPIRATION / INHALE ▲ (0.50 .. 1.00 -> w in 0.00 .. 1.00)
        // =========================================================
        const w = (rebalCycle - 0.50) * 2.0;
        if (w < 0.70) {
          // Stage I1: Merged Stream Enters Through Feet ▼ & Rises Straight Up Through Whole Body to Head ▲
          const c = w / 0.70; // 0 (Feet) -> 1 (Center of Head)
          y = -R * 0.92 * effElev * (1.0 - c);
          if (spiralTurns <= 0.02) {
            // No spiraling: rises straight up the central vertical axis of the body
            x = 0;
            z = -0.10 * Math.sin(c * Math.PI);
          } else {
            const rCore = 0.11 * Math.sin(c * Math.PI);
            const coreSpin = c * Math.PI * 2.0 * spiralTurns;
            x = rCore * Math.sin(coreSpin);
            z = -rCore * Math.cos(coreSpin);
          }
          splitFactor = 0.0; // Merged into ONE core body column!
          stageLabel = c < 0.48
            ? 'INHALE ▲ [4/5] FEET ▼ → RISING UP CORE BODY'
            : 'INHALE ▲ [4/5] HEART & THROAT → ENTERING HEAD ▲';
        } else {
          // Stage I2: Crosses the Head & Fills Up the Entire Cranium with Vibrant Energy ✨
          const h = (w - 0.70) / 0.30; // 0..1
          const rHead = 0.22 * Math.sin(h * Math.PI); // Swells to 22cm cranial halo then focuses at top of skull
          const headSpin = branchAz + h * Math.PI * 2.0 * Math.max(0.25, spiralTurns);
          x = rHead * Math.sin(headSpin);
          z = -rHead * Math.cos(headSpin);
          y = 0.24 * effElev * Math.sin(h * Math.PI * 0.5);
          splitFactor = 0.32 * Math.sin(h * Math.PI);
          stageLabel = 'INHALE ▲ [5/5] FILLING HEAD WITH VIBRANT ENERGY ✨';
        }
      }
    } else if (geom === 'bifurcation5m' || geom === 'bifurcation_random') {
      // 6-Stage Choreographed 5m Split & Merge Journeys (Classic + 6 Random Evolving Variations):
      // Every variation starts inside the Head (0,0,0), travels out to 5m, duplicates into two symmetric branches
      // along 5m spherical arcs (Left/Right, Top Zenith ▲, Floor ▼, Front, Back), merges at a 5m pole,
      // duplicates again, and returns in a straight line to merge inside the Head (0,0,0)!
      const R = 5.0;
      const side = i % 2 === 0 ? 1 : -1; // +1 = Right / Upper branch, -1 = Left / Lower branch
      const pairIdx = Math.floor(i / 2);
      const totalPairs = Math.max(1, Math.floor(count / 2));
      const pairOffset = totalPairs > 1 ? (pairIdx / totalPairs) * 0.35 : 0;
      const continuousStage = (elapsed * speed * 0.90) + pairOffset;
      const cycleIdx = Math.floor(continuousStage / 6.0);
      const totalPhase = continuousStage % 6.0;
      const stage = Math.floor(totalPhase);
      const u = totalPhase - stage; // 0..1 progress within current stage
      const halfPi = Math.PI * 0.5;
      const effElev = Math.max(0.25, elevScale);

      const varIdx = geom === 'bifurcation5m' ? 0 : this._getBifurcationVariation(cycleIdx);

      if (varIdx === 0) {
        // VARIATION 1 (CLASSIC): Head -> 5m Front -> Split L/R -> Meet 5m Top ▲ -> Merge Down to 5m Back -> Split L/R -> Straight to Head
        if (stage === 0) {
          x = 0; y = 0; z = -R * u;
          splitFactor = 0.0;
          stageLabel = 'V1 [1/6] HEAD → 5m FRONT (MERGED)';
        } else if (stage === 1) {
          const a = u * halfPi;
          x = side * R * Math.sin(a); y = 0; z = -R * Math.cos(a);
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V1 [2/6] DUPLICATE → 5m ARC L/R';
        } else if (stage === 2) {
          const phi = u * halfPi;
          x = side * R * Math.cos(phi); y = R * Math.sin(phi) * effElev; z = 0;
          splitFactor = Math.cos(phi);
          stageLabel = 'V1 [3/6] ASCEND L/R → MEET TOP ▲ (5m)';
        } else if (stage === 3) {
          const psi = u * halfPi;
          x = 0; y = R * Math.cos(psi) * effElev; z = R * Math.sin(psi);
          splitFactor = 0.0;
          stageLabel = 'V1 [4/6] MERGE TOP → DESCEND BACK ▼ (5m)';
        } else if (stage === 4) {
          const a = u * halfPi;
          x = side * R * Math.sin(a); y = 0; z = R * Math.cos(a);
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V1 [5/6] DUPLICATE BACK → 5m ARC L/R';
        } else {
          x = side * R * (1.0 - u); y = 0; z = 0;
          splitFactor = 1.0 - u;
          stageLabel = 'V1 [6/6] STRAIGHT LINE L/R → MERGE IN HEAD';
        }
      } else if (varIdx === 1) {
        // VARIATION 2 (CROWN ZENITH): Head -> 5m Top ▲ -> Split L/R Down -> Meet 5m Floor ▼ -> Merge Up to 5m Front -> Split L/R -> Straight to Head
        if (stage === 0) {
          x = 0; y = R * u * effElev; z = 0;
          splitFactor = 0.0;
          stageLabel = 'V2 [1/6] HEAD → 5m TOP ZENITH ▲ (MERGED)';
        } else if (stage === 1) {
          const phi = u * halfPi;
          x = side * R * Math.sin(phi); y = R * Math.cos(phi) * effElev; z = 0;
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V2 [2/6] SPLIT AT TOP ▲ → DESCEND L/R (5m)';
        } else if (stage === 2) {
          const phi = u * halfPi;
          x = side * R * Math.cos(phi); y = -R * Math.sin(phi) * effElev; z = 0;
          splitFactor = Math.cos(phi);
          stageLabel = 'V2 [3/6] DIVE L/R → MEET FLOOR ▼ (5m)';
        } else if (stage === 3) {
          const psi = u * halfPi;
          x = 0; y = -R * Math.cos(psi) * effElev; z = -R * Math.sin(psi);
          splitFactor = 0.0;
          stageLabel = 'V2 [4/6] MERGE FLOOR ▼ → RISE 5m FRONT';
        } else if (stage === 4) {
          const a = u * halfPi;
          x = side * R * Math.sin(a); y = 0; z = -R * Math.cos(a);
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V2 [5/6] DUPLICATE FRONT → 5m ARC L/R';
        } else {
          x = side * R * (1.0 - u); y = 0; z = 0;
          splitFactor = 1.0 - u;
          stageLabel = 'V2 [6/6] STRAIGHT LINE L/R → MERGE IN HEAD';
        }
      } else if (varIdx === 2) {
        // VARIATION 3 (VERTICAL SPLIT): Head -> 5m Back -> Split UP ▲ & DOWN ▼ -> Meet 5m Front -> Split L/R -> Meet 5m Top ▲ -> Straight Down into Head
        if (stage === 0) {
          x = 0; y = 0; z = R * u;
          splitFactor = 0.0;
          stageLabel = 'V3 [1/6] HEAD → 5m BEHIND NECK (MERGED)';
        } else if (stage === 1) {
          const phi = u * halfPi;
          x = 0; y = side * R * Math.sin(phi) * effElev; z = R * Math.cos(phi);
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V3 [2/6] VERTICAL SPLIT → UP ▲ & DOWN ▼ (5m)';
        } else if (stage === 2) {
          const phi = u * halfPi;
          x = 0; y = side * R * Math.cos(phi) * effElev; z = -R * Math.sin(phi);
          splitFactor = Math.cos(phi);
          stageLabel = 'V3 [3/6] CONVERGE UP/DOWN → 5m FRONT';
        } else if (stage === 3) {
          const a = u * halfPi;
          x = side * R * Math.sin(a); y = 0; z = -R * Math.cos(a);
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V3 [4/6] DUPLICATE FRONT → 5m ARC L/R';
        } else if (stage === 4) {
          const phi = u * halfPi;
          x = side * R * Math.cos(phi); y = R * Math.sin(phi) * effElev; z = 0;
          splitFactor = Math.cos(phi);
          stageLabel = 'V3 [5/6] ASCEND L/R → MERGE TOP ▲ (5m)';
        } else {
          x = 0; y = R * (1.0 - u) * effElev; z = 0;
          splitFactor = 0.0;
          stageLabel = 'V3 [6/6] STRAIGHT DOWN CROWN ▲ → HEAD';
        }
      } else if (varIdx === 3) {
        // VARIATION 4 (BILATERAL BURST): Head -> Split Straight L/R to 5m -> Arc to 5m Front -> Merge & Arch Over Top ▲ to 5m Back -> Split 180° to Front -> Straight to Head
        if (stage === 0) {
          x = side * R * u; y = 0; z = 0;
          splitFactor = Math.min(1.0, u * 3.0);
          stageLabel = 'V4 [1/6] SPLIT IN HEAD → STRAIGHT 5m L/R';
        } else if (stage === 1) {
          const a = u * halfPi;
          x = side * R * Math.cos(a); y = 0; z = -R * Math.sin(a);
          splitFactor = Math.cos(a);
          stageLabel = 'V4 [2/6] 5m ARC L/R → MEET 5m FRONT';
        } else if (stage === 2) {
          const phi = u * halfPi;
          x = 0; y = R * Math.sin(phi) * effElev; z = -R * Math.cos(phi);
          splitFactor = 0.0;
          stageLabel = 'V4 [3/6] MERGE FRONT → ARCH TO TOP ▲ (5m)';
        } else if (stage === 3) {
          const phi = u * halfPi;
          x = 0; y = R * Math.cos(phi) * effElev; z = R * Math.sin(phi);
          splitFactor = 0.0;
          stageLabel = 'V4 [4/6] OVERHEAD DOME ▲ → 5m BACK';
        } else if (stage === 4) {
          const a = u * Math.PI;
          x = side * R * Math.sin(a); y = 0; z = R * Math.cos(a);
          splitFactor = Math.sin(a);
          stageLabel = 'V4 [5/6] SPLIT BACK → 360° HALO TO FRONT';
        } else {
          x = 0; y = 0; z = -R * (1.0 - u);
          splitFactor = 0.0;
          stageLabel = 'V4 [6/6] STRAIGHT FROM 5m FRONT → HEAD';
        }
      } else if (varIdx === 4) {
        // VARIATION 5 (ABYSS TO SKY): Head -> 5m Floor ▼ -> Split L/R Up -> Meet 5m Top ▲ -> Merge Down to 5m Front -> Split 180° to 5m Back -> Straight to Head
        if (stage === 0) {
          x = 0; y = -R * u * effElev; z = 0;
          splitFactor = 0.0;
          stageLabel = 'V5 [1/6] HEAD → 5m FLOOR ▼ (MERGED)';
        } else if (stage === 1) {
          const phi = u * halfPi;
          x = side * R * Math.sin(phi); y = -R * Math.cos(phi) * effElev; z = 0;
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V5 [2/6] SPLIT FLOOR ▼ → RISE L/R (5m)';
        } else if (stage === 2) {
          const phi = u * halfPi;
          x = side * R * Math.cos(phi); y = R * Math.sin(phi) * effElev; z = 0;
          splitFactor = Math.cos(phi);
          stageLabel = 'V5 [3/6] CLIMB L/R → MEET TOP ▲ (5m)';
        } else if (stage === 3) {
          const psi = u * halfPi;
          x = 0; y = R * Math.cos(psi) * effElev; z = -R * Math.sin(psi);
          splitFactor = 0.0;
          stageLabel = 'V5 [4/6] MERGE TOP ▲ → DESCEND 5m FRONT';
        } else if (stage === 4) {
          const a = u * Math.PI;
          x = side * R * Math.sin(a); y = 0; z = -R * Math.cos(a);
          splitFactor = Math.sin(a);
          stageLabel = 'V5 [5/6] SPLIT FRONT → 5m ARC TO BACK';
        } else {
          x = 0; y = 0; z = R * (1.0 - u);
          splitFactor = 0.0;
          stageLabel = 'V5 [6/6] STRAIGHT FROM 5m BACK → HEAD';
        }
      } else {
        // VARIATION 6 (DIAGONAL GREAT-CIRCLE): Head -> 5m Front -> Diagonal Split (R+Up ▲ / L+Down ▼) -> Meet 5m Back -> Merge to 5m Top ▲ -> Split L/R -> Straight to Head
        const diag = Math.SQRT1_2; // 0.7071
        if (stage === 0) {
          x = 0; y = 0; z = -R * u;
          splitFactor = 0.0;
          stageLabel = 'V6 [1/6] HEAD → 5m FRONT (MERGED)';
        } else if (stage === 1) {
          const a = u * halfPi;
          const rad = R * Math.sin(a);
          x = side * rad * diag;
          y = side * rad * diag * effElev;
          z = -R * Math.cos(a);
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V6 [2/6] DIAGONAL SPLIT (R+SKY ▲ / L+FLOOR ▼)';
        } else if (stage === 2) {
          const a = u * halfPi;
          const rad = R * Math.cos(a);
          x = side * rad * diag;
          y = side * rad * diag * effElev;
          z = R * Math.sin(a);
          splitFactor = Math.cos(a);
          stageLabel = 'V6 [3/6] DIAGONAL ARCS → MEET 5m BACK';
        } else if (stage === 3) {
          const psi = u * halfPi;
          x = 0; y = R * Math.sin(psi) * effElev; z = R * Math.cos(psi);
          splitFactor = 0.0;
          stageLabel = 'V6 [4/6] MERGE BACK → CLIMB TOP ▲ (5m)';
        } else if (stage === 4) {
          const phi = u * halfPi;
          x = side * R * Math.sin(phi); y = R * Math.cos(phi) * effElev; z = 0;
          splitFactor = Math.min(1.0, u * 4.0);
          stageLabel = 'V6 [5/6] SPLIT TOP ▲ → DESCEND 5m L/R';
        } else {
          x = side * R * (1.0 - u); y = 0; z = 0;
          splitFactor = 1.0 - u;
          stageLabel = 'V6 [6/6] STRAIGHT LINE L/R → MERGE IN HEAD';
        }
      }
    } else if (geom === 'orbit8d') {
      // 8D Spherical Orbit: Full 360° horizontal sweep coupled with true Spherical Elevation (phi in [-70°, +78°])
      // As phi rises toward +78° (Zenith), cos(phi) pulls x,z inward so the sound physically arches OVER the top of the skull!
      const dir = i % 2 === 0 ? 1 : -1;
      const az = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      const elevWave = Math.sin(az * 1.5 + i * 1.1); // Incommensurate 3:2 spherical weave
      const phi = elevWave * (1.32 * elevScale); // Up to +-76 degrees vertical angle!
      const r = 0.50 + 0.85 * asym * (0.82 + 0.18 * Math.cos(az * 2));
      const horizR = r * Math.cos(phi);
      x = horizR * Math.sin(az);
      z = -horizR * Math.cos(az);
      y = r * Math.sin(phi);
    } else if (geom === 'zenith_arch') {
      // Over-the-Head Zenith Dome Arch: Sweeps from Left Ear -> Straight Over Crown (+85° Zenith) -> Right Ear -> Under Chin (-75° Floor)
      // while slowly rotating the arch plane around the listener!
      const dir = i % 2 === 0 ? 1 : -1;
      const archAngle = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      const planeAz = elapsed * speed * 0.28 * Math.PI * 2 + (i * Math.PI) / Math.max(1, count);
      const r = 0.55 + 0.75 * asym;
      const lateral = r * Math.cos(archAngle);
      x = lateral * Math.cos(planeAz);
      z = -lateral * Math.sin(planeAz);
      y = r * Math.sin(archAngle) * (0.25 + 0.90 * elevScale);
    } else if (geom === 'helix3d') {
      // 3D Vertical Helix / DNA Spiral: Climbs smoothly from Floor (-75°) up to Sky Zenith (+82°) and back while orbiting 360°
      const dir = i % 2 === 0 ? 1 : -1;
      const az = elapsed * speed * Math.PI * 2 * 1.6 * dir + phaseOffset;
      const climbWave = Math.sin(elapsed * speed * Math.PI * 2 * 0.45 + i * 1.4);
      const phi = climbWave * (1.38 * elevScale); // -79° to +79°
      const r = 0.55 + 0.75 * asym;
      const horizR = r * Math.cos(phi);
      x = horizR * Math.sin(az);
      z = -horizR * Math.cos(az);
      y = r * Math.sin(phi);
    } else if (geom === 'peripersonal') {
      // Intimate Peripersonal ASMR Halo: orbits 12cm - 32cm from the head, lingering close to Left & Right ear canals + vertical ear-to-crown sweep
      const dir = i % 2 === 0 ? 1 : -1;
      const a = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      const s = Math.sin(a);
      const r = 0.16 + 0.22 * asym;
      x = Math.sign(s) * Math.pow(Math.abs(s), 0.72) * r;
      z = -Math.cos(a) * r * 0.85;
      y = Math.sin(a * 1.5 + i) * 0.26 * elevScale;
    } else if (geom === 'infinity') {
      // Figure-8 / Lemniscate (∞) passing directly through the center of the head (0,0,0)!
      const lobeRadius = 1.0 + 1.15 * asym;
      const u = lobeRadius * Math.sin(theta);
      const v = lobeRadius * 0.58 * Math.sin(2 * theta);

      const axisAngle = (i * Math.PI) / Math.max(1, count);
      x = u * Math.cos(axisAngle) - v * Math.sin(axisAngle);
      z = -u * Math.sin(axisAngle) - v * Math.cos(axisAngle);
      y = Math.sin(theta) * Math.cos(theta) * 1.25 * elevScale * (i % 2 === 0 ? 1 : -1);
    } else if (geom === 'radial') {
      // Far-Horizon Excursion: starts near the ear/head, travels VERY FAR OUT (up to 11m) in one direction, and returns!
      const rayAngle = (i * Math.PI * 2) / Math.max(1, count) + elapsed * 0.05 * (i % 2 === 0 ? 1 : -1);
      const maxHorizonDist = 3.5 + 8.0 * asym;
      const excursion = Math.pow(0.5 - 0.5 * Math.cos(theta), 1.65);
      const r = 0.15 + maxHorizonDist * excursion;

      x = r * Math.sin(rayAngle);
      z = -r * Math.cos(rayAngle);
      y = (r * 0.32) * Math.sin(theta + i) * elevScale;
    } else if (geom === 'circle') {
      // Pure 360° Circular Halo around perimeter of the head
      const dir = i % 2 === 0 ? 1 : -1;
      const r = 0.65 + 0.90 * asym;
      const a = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      x = r * Math.sin(a);
      z = -r * Math.cos(a);
      y = Math.sin(a + i) * 0.75 * elevScale;
    } else if (geom === 'spiral') {
      // Breathing Spiral: spirals inward from far horizon straight through center of skull and back out
      const breathCycle = 0.5 - 0.5 * Math.cos(theta * 0.35);
      const r = (0.08 + 4.8 * asym) * breathCycle;
      const fastAngle = theta * 2.0;
      x = r * Math.sin(fastAngle);
      z = -r * Math.cos(fastAngle);
      y = Math.cos(theta * 0.35) * 1.15 * elevScale;
    } else {
      // 'torus': Counter-rotating 3D toroidal knot
      const dir = i % 2 === 0 ? 1 : -1 * (0.5 + asym * 0.7);
      const angle = elapsed * speed * Math.PI * 2 * dir + phaseOffset;
      const elevAngle = elapsed * speed * 1.618 * Math.PI + i * 0.9;
      const r = 0.4 + (0.6 + 0.9 * asym) * (0.5 + 0.5 * Math.cos(elevAngle));
      x = r * Math.sin(angle);
      z = -r * Math.cos(angle);
      y = Math.sin(elevAngle) * (0.5 + 0.95 * elevScale);
    }

    return { x, y, z, geomType: geom, splitFactor, stageLabel };
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
   * Multi-Harmonic Binaural Carrier Drone + Ethereal Silk Shimmer (25-75 Hz) gated by Theta Peaks + 0.1 Hz Vagal Breath
   */
  _setupPACModule() {
    // Dedicated dry bus for binaural beats (100% dry, ZERO reverb cross-talk between Left and Right)
    const binBus = this.ctx.createGain();
    binBus.gain.value = this.params.pac.enabled ? this.params.pac.gain * 0.88 : 0;
    binBus.connect(this.dryBus);

    // Reverb-send bus for the ambient PAC Silk Shimmer only
    const pacBus = this.ctx.createGain();
    pacBus.gain.value = this.params.pac.enabled ? this.params.pac.gain * 0.45 : 0;
    pacBus.connect(this.dryBus);
    pacBus.connect(this.reverbSendGain);

    const bus = binBus; // backward compatibility handle

    // 1. Multi-Harmonic Binaural Carrier Pairs (1x Fundamental, 2x Octave, 3x Perfect 5th, 4x Double Octave)
    // Left ear receives a pure integer harmonic series of its own fundamental: fL_k = k * (carrier - theta/2).
    // Right ear receives a pure integer harmonic series of its own fundamental: fR_k = k * (carrier + theta/2).
    // Because every partial in the Left ear is an exact integer multiple of fL_0 (and likewise in Right for fR_0),
    // listening to a single ear alone produces a 100% phase-locked, steady harmonic tone with ZERO monaural beating!
    const carrierFreq = this.params.pac.baseFreq || 136.0;
    const halfTheta = (this.params.pac.theta || 6.0) / 2;
    const harmonicsAmt = this.params.pac.harmonics !== undefined ? this.params.pac.harmonics : 0.45;

    const harmRatios = [1.0, 2.0, 3.0, 4.0];
    const harmBaseGains = [1.0, 0.42, 0.22, 0.10]; // Fundamental is 1.0 (loud, crystal-clear carrier)

    const fL0 = Math.max(20, carrierFreq - halfTheta);
    const fR0 = Math.max(20, carrierFreq + halfTheta);

    const binOscsL = [];
    const binOscsR = [];
    const binGainsL = [];
    const binGainsR = [];

    const binBusL = this.ctx.createGain();
    const binBusR = this.ctx.createGain();

    for (let k = 0; k < harmRatios.length; k++) {
      const r = harmRatios[k];
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      oscL.type = 'sine';
      oscR.type = 'sine';

      const fL = fL0 * r;
      const fR = fR0 * r;
      oscL.frequency.value = fL;
      oscR.frequency.value = fR;

      const gL = this.ctx.createGain();
      const gR = this.ctx.createGain();
      const hScale = k === 0 ? 1.0 : harmonicsAmt;
      const initialGain = harmBaseGains[k] * hScale;
      gL.gain.value = initialGain;
      gR.gain.value = initialGain;

      oscL.connect(gL);
      oscR.connect(gR);
      gL.connect(binBusL);
      gR.connect(binBusR);

      oscL.start();
      oscR.start();

      binOscsL.push(oscL);
      binOscsR.push(oscR);
      binGainsL.push(gL);
      binGainsR.push(gR);
    }

    // Warm independent filters for left and right channels to shape overtones without stereo bleed
    const binFilterL = this.ctx.createBiquadFilter();
    const binFilterR = this.ctx.createBiquadFilter();
    binFilterL.type = 'lowpass';
    binFilterR.type = 'lowpass';
    binFilterL.frequency.value = Math.min(8000, carrierFreq * 6.0);
    binFilterR.frequency.value = Math.min(8000, carrierFreq * 6.0);
    binFilterL.Q.value = 0.7;
    binFilterR.Q.value = 0.7;

    binBusL.connect(binFilterL);
    binBusR.connect(binFilterR);

    // Hard-panned StereoPannerNodes (-1.0 Left, +1.0 Right) guarantee 100% stereo channel isolation
    // while outputting a true 2-channel stereo signal into binGain -> binBus -> dryBus.
    const binPanL = this.ctx.createStereoPanner();
    const binPanR = this.ctx.createStereoPanner();
    binPanL.pan.value = -1.0; // Strictly 100% Left ear
    binPanR.pan.value = 1.0;  // Strictly 100% Right ear

    const binGain = this.ctx.createGain();
    binGain.gain.value = 0.85;

    binFilterL.connect(binPanL);
    binFilterR.connect(binPanR);
    binPanL.connect(binGain);
    binPanR.connect(binGain);
    binGain.connect(binBus);

    // 2. PAC Silk Crystalline Shimmer (Nested onto Theta peaks)
    // Instead of a harsh buzzing WaveShaper, we use lush golden-ratio celestial partials
    // with smooth sinusoidal 40Hz micro-flutter for an ethereal, silky neural shimmer.
    const pacCarrier1 = this.ctx.createOscillator();
    const pacCarrier2 = this.ctx.createOscillator();
    const pacCarrier3 = this.ctx.createOscillator();
    pacCarrier1.type = 'sine';
    pacCarrier2.type = 'triangle';
    pacCarrier3.type = 'sine';
    pacCarrier1.frequency.value = carrierFreq * 2.0;
    pacCarrier2.frequency.value = carrierFreq * 3.236; // golden-ratio overtone
    pacCarrier3.frequency.value = carrierFreq * 5.0;

    const c1Gain = this.ctx.createGain();
    const c2Gain = this.ctx.createGain();
    const c3Gain = this.ctx.createGain();
    c1Gain.gain.value = 0.38;
    c2Gain.gain.value = 0.24;
    c3Gain.gain.value = 0.14;

    const pacFilter = this.ctx.createBiquadFilter();
    pacFilter.type = 'bandpass';
    pacFilter.frequency.value = Math.min(5000, carrierFreq * 3.5);
    pacFilter.Q.value = 1.6;

    // Smooth sinusoidal Gamma flutter (silky micro-flutter at 25-75 Hz, zero harsh buzz)
    const gammaOsc = this.ctx.createOscillator();
    gammaOsc.type = 'sine';
    gammaOsc.frequency.value = this.params.pac.gamma || 40.0;

    const gammaDepthNode = this.ctx.createGain();
    gammaDepthNode.gain.value = 0.32; // gentle, musical 32% modulation depth

    const gammaPulseNode = this.ctx.createGain();
    gammaPulseNode.gain.value = 0.68; // base level

    gammaOsc.connect(gammaDepthNode);
    gammaDepthNode.connect(gammaPulseNode.gain);

    const pacModGain = this.ctx.createGain();
    pacModGain.gain.value = 0.0; // gated by Theta peaks

    pacCarrier1.connect(c1Gain);
    pacCarrier2.connect(c2Gain);
    pacCarrier3.connect(c3Gain);
    c1Gain.connect(pacFilter);
    c2Gain.connect(pacFilter);
    c3Gain.connect(pacFilter);
    pacFilter.connect(gammaPulseNode);
    gammaPulseNode.connect(pacModGain);
    pacModGain.connect(pacBus);

    pacCarrier1.start();
    pacCarrier2.start();
    pacCarrier3.start();
    gammaOsc.start();

    this.nodes.pac = {
      bus,
      binBus,
      pacBus,
      binOscsL,
      binOscsR,
      binOscL: binOscsL[0],
      binOscR: binOscsR[0],
      binGainsL,
      binGainsR,
      binFilter: binFilterL,
      binFilterL,
      binFilterR,
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
   * MODULE 5: Infrasound & Somatic Sub-Bass (Vestibular & Vagal)
  /**
   * MODULE 5: Infrasound & Vestibular Sub-Bass
   * Pure low somatic tone (24-50 Hz) + Missing-Fundamental Psychoacoustic Harmonics (2*f0, 3*f0)
   * so the deep sub-bass pulse is both physically felt and clearly audible on all headphones & speakers.
   */
  _setupSubBassModule() {
    const bus = this.ctx.createGain();
    bus.gain.value = this.params.sub.enabled ? this.params.sub.gain * 0.65 : 0.0001;
    bus.connect(this.dryBus);

    const f0 = this.params.sub.freq;
    const warmth = this.params.sub.warmth;

    // Pure low-frequency sine oscillators:
    // 1. Fundamental f0 (24-45 Hz deep somatic/vestibular tone)
    // 2. 2nd Harmonic 2*f0 (octave bass reinforcement, 48-90 Hz)
    // 3. 3rd Harmonic 3*f0 (missing-fundamental warmth, 72-135 Hz, audible on all transducers)
    const subOsc1 = this.ctx.createOscillator();
    const subOsc2 = this.ctx.createOscillator();
    const subOsc3 = this.ctx.createOscillator();

    subOsc1.type = 'sine';
    subOsc2.type = 'sine';
    subOsc3.type = 'sine';

    subOsc1.frequency.value = f0;
    subOsc2.frequency.value = f0 * 2;
    subOsc3.frequency.value = f0 * 3;

    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();
    const gain3 = this.ctx.createGain();

    // Cascaded 2-pole lowpass filters (24 dB/octave attenuation)
    // Passes the fundamental + 2nd & 3rd missing-fundamental harmonics smoothly while blocking any harshness
    const lp1 = this.ctx.createBiquadFilter();
    lp1.type = 'lowpass';
    lp1.frequency.value = Math.min(220, f0 * (3.2 + warmth * 2.5));
    lp1.Q.value = 0.707;

    const lp2 = this.ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = Math.min(220, f0 * (3.2 + warmth * 2.5));
    lp2.Q.value = 0.707;

    const pulseGain = this.ctx.createGain();
    pulseGain.gain.value = 0.85;

    subOsc1.connect(gain1);
    subOsc2.connect(gain2);
    subOsc3.connect(gain3);

    gain1.connect(lp1);
    gain2.connect(lp1);
    gain3.connect(lp1);
    lp1.connect(lp2);
    lp2.connect(pulseGain);
    pulseGain.connect(bus);

    subOsc1.start();
    subOsc2.start();
    subOsc3.start();

    this.nodes.sub = {
      bus,
      subOsc1,
      subOsc2,
      subOsc3,
      gain1,
      gain2,
      gain3,
      lp1,
      lp2,
      pulseGain
    };

    this._updateSubWarmth(warmth);
  }

  // Smooth, deep missing-fundamental warmth audible on both subwoofers and standard headphones
  _updateSubWarmth(w) {
    if (!this.nodes.sub || !this.ctx) return;
    const now = this.ctx.currentTime;
    const n = this.nodes.sub;
    const f0 = this.params.sub.freq;

    // Fundamental remains solid low sub-bass
    const g1 = 0.85;
    // 2nd harmonic (octave, ~68 Hz) & 3rd harmonic (~102 Hz) reconstruct the missing fundamental in the cochlea
    const g2 = 0.35 + w * 0.55;
    const g3 = 0.15 + w * 0.45;

    n.gain1.gain.setTargetAtTime(g1, now, 0.05);
    n.gain2.gain.setTargetAtTime(g2, now, 0.05);
    if (n.gain3) {
      n.gain3.gain.setTargetAtTime(g3, now, 0.05);
    }

    const cutoff = Math.min(220, f0 * (3.2 + w * 2.5));
    n.lp1.frequency.setTargetAtTime(cutoff, now, 0.05);
    n.lp2.frequency.setTargetAtTime(cutoff, now, 0.05);
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
   * MODULE 7: 3D Binaural ASMR & Shamanic Ritual Trance
   * Intimate peripersonal micro-triggers (whisper, silk crackle, bamboo taps)
   * + 4.5 Hz Shamanic Theta Drum & Tibetan Overtone Singing (110 Hz Megalith)
   */
  _setupASMRModule() {
    const asmrBus = this.ctx.createGain();
    asmrBus.gain.value = this.params.asmr.enabled ? this.params.asmr.gain * 0.85 : 0.0001;
    asmrBus.connect(this.dryBus);

    const asmrReverbSend = this.ctx.createGain();
    asmrReverbSend.gain.value = 0.0;
    asmrReverbSend.connect(this.reverbSendGain);

    // Intimate Near-Field Stereo Panner (simulates sounds orbiting within 5-15 cm of the ear canal)
    const asmrPanner = this.ctx.createStereoPanner();
    asmrPanner.pan.value = 0.0;
    asmrPanner.connect(asmrBus);
    asmrPanner.connect(asmrReverbSend);

    // 1. Whisper Engine: rich binaural breath noise through dual vocal formants & crisp sibilant air band
    const rate = this.ctx.sampleRate;
    const noiseLen = rate * 4;
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, rate);
    const data = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.16;
      b6 = white * 0.115926;
    }

    const whisperSource = this.ctx.createBufferSource();
    whisperSource.buffer = noiseBuf;
    whisperSource.loop = true;

    const whisperF1 = this.ctx.createBiquadFilter();
    whisperF1.type = 'bandpass';
    whisperF1.frequency.value = 750;
    whisperF1.Q.value = 2.0;

    const whisperF2 = this.ctx.createBiquadFilter();
    whisperF2.type = 'bandpass';
    whisperF2.frequency.value = 2150;
    whisperF2.Q.value = 2.4;

    const whisperAirFilter = this.ctx.createBiquadFilter();
    whisperAirFilter.type = 'bandpass';
    whisperAirFilter.frequency.value = 4800;
    whisperAirFilter.Q.value = 1.2;

    const whisperGain = this.ctx.createGain();
    whisperGain.gain.value = 0.0;

    whisperSource.connect(whisperF1);
    whisperSource.connect(whisperF2);
    whisperSource.connect(whisperAirFilter);
    whisperF1.connect(whisperGain);
    whisperF2.connect(whisperGain);
    whisperAirFilter.connect(whisperGain);
    whisperGain.connect(asmrPanner);
    whisperSource.start();

    // 2. Throat Singing Drone & Resonant Overtone Whistle (110 Hz Megalithic Chamber Resonance)
    const throatDrone = this.ctx.createOscillator();
    throatDrone.type = 'sawtooth';
    throatDrone.frequency.value = 110.0; // 110 Hz Megalithic chamber fundamental

    const throatSub = this.ctx.createOscillator();
    throatSub.type = 'triangle';
    throatSub.frequency.value = 55.0; // Deep sub-octave chest resonance

    // Warm low-pass on the chest drone so raw sawtooth buzz doesn't mask the overtone flute
    const throatBodyLP = this.ctx.createBiquadFilter();
    throatBodyLP.type = 'lowpass';
    throatBodyLP.frequency.value = 240.0;
    throatBodyLP.Q.value = 1.4;

    const throatSubGain = this.ctx.createGain();
    throatSubGain.gain.value = 0.42;

    // Formant cavity filter + harmonic-locked pure whistle oscillator for crystal-clear Khöömei overtones
    const throatFilter = this.ctx.createBiquadFilter();
    throatFilter.type = 'bandpass';
    throatFilter.frequency.value = 660; // Start at 6th harmonic (660 Hz)
    throatFilter.Q.value = 18.0;

    const throatOvertoneGain = this.ctx.createGain();
    throatOvertoneGain.gain.value = 3.5; // Compensates narrow bandpass insertion loss

    const throatWhistleOsc = this.ctx.createOscillator();
    throatWhistleOsc.type = 'sine';
    throatWhistleOsc.frequency.value = 660;

    const throatWhistleGain = this.ctx.createGain();
    throatWhistleGain.gain.value = 0.22;

    const throatGain = this.ctx.createGain();
    throatGain.gain.value = 0.0;

    throatDrone.connect(throatFilter);
    throatFilter.connect(throatOvertoneGain);
    throatOvertoneGain.connect(throatGain);

    throatWhistleOsc.connect(throatWhistleGain);
    throatWhistleGain.connect(throatGain);

    throatDrone.connect(throatBodyLP);
    throatSub.connect(throatBodyLP);
    throatBodyLP.connect(throatSubGain);
    throatSubGain.connect(throatGain);

    throatGain.connect(asmrPanner);

    throatDrone.start();
    throatSub.start();
    throatWhistleOsc.start();

    this.nodes.asmr = {
      bus: asmrBus,
      reverbSend: asmrReverbSend,
      panner: asmrPanner,
      noiseBuf,
      whisperF1,
      whisperF2,
      whisperGain,
      whisperAirFilter,
      throatGain,
      throatDrone,
      throatFilter,
      throatOvertoneGain,
      throatWhistleOsc,
      throatWhistleGain,
      nextEventTime: 0,
      nextDrumTime: 0,
      throatHarmonicIndex: 0,
      nextThroatStepTime: 0,
      tapEar: false
    };
  }

  _triggerShamanicHit(now, resonance) {
    if (!this.ctx || !this.nodes.asmr) return;
    const bus = this.nodes.asmr.panner;

    // 1. Shamanic Skin-Frame Drum (Fundamental + 2x Warm Drumhead Body so it is clearly audible on all speakers)
    const drumOsc = this.ctx.createOscillator();
    const drumBodyOsc = this.ctx.createOscillator();
    const drumGain = this.ctx.createGain();
    const drumBodyGain = this.ctx.createGain();
    const drumFilter = this.ctx.createBiquadFilter();

    drumOsc.type = 'sine';
    drumOsc.frequency.setValueAtTime(92, now);
    drumOsc.frequency.exponentialRampToValueAtTime(46, now + 0.14);

    drumBodyOsc.type = 'triangle';
    drumBodyOsc.frequency.setValueAtTime(184, now);
    drumBodyOsc.frequency.exponentialRampToValueAtTime(92, now + 0.11);

    drumFilter.type = 'lowpass';
    drumFilter.frequency.setValueAtTime(280 + resonance * 260, now);

    drumGain.gain.setValueAtTime(0.95, now);
    drumGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    drumBodyGain.gain.setValueAtTime(0.45, now);
    drumBodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    drumOsc.connect(drumFilter);
    drumBodyOsc.connect(drumBodyGain);
    drumBodyGain.connect(drumFilter);
    drumFilter.connect(drumGain);
    drumGain.connect(bus);

    drumOsc.start(now);
    drumBodyOsc.start(now);
    drumOsc.stop(now + 0.20);
    drumBodyOsc.stop(now + 0.14);

    // 2. Off-beat Seed-Pod Rattle (crisp organic shaker burst)
    const rattleDelay = 0.08 + (Math.random() - 0.5) * 0.015;
    const rattleTime = now + rattleDelay;
    const rattleBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.05), this.ctx.sampleRate);
    const d = rattleBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.012));
    }
    const rattleSource = this.ctx.createBufferSource();
    rattleSource.buffer = rattleBuf;

    const rattleFilter = this.ctx.createBiquadFilter();
    rattleFilter.type = 'bandpass';
    rattleFilter.frequency.value = 3200 + resonance * 2800;
    rattleFilter.Q.value = 1.4;

    const rattleGain = this.ctx.createGain();
    rattleGain.gain.value = 0.45 + resonance * 0.30;

    rattleSource.connect(rattleFilter);
    rattleFilter.connect(rattleGain);
    rattleGain.connect(bus);

    rattleSource.start(rattleTime);
    rattleSource.stop(rattleTime + 0.055);
  }

  _triggerASMRCrackle(now, resonance) {
    if (!this.ctx || !this.nodes.asmr) return;
    const bus = this.nodes.asmr.bus;
    const prox = this.params.asmr.proximity;

    // 1. Soft Binaural Silk Brush Stroke (60-110 ms tactile noise grain panned close to Left or Right ear)
    const earPan = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.5) * (1.0 - prox * 0.35);
    const grainPanner = this.ctx.createStereoPanner();
    grainPanner.pan.value = earPan;
    grainPanner.connect(bus);
    grainPanner.connect(this.nodes.asmr.reverbSend);

    const brushDur = 0.065 + Math.random() * 0.055;
    const brushLen = Math.floor(this.ctx.sampleRate * brushDur);
    const brushBuf = this.ctx.createBuffer(1, brushLen, this.ctx.sampleRate);
    const bd = brushBuf.getChannelData(0);
    for (let i = 0; i < brushLen; i++) {
      const env = Math.sin((i / brushLen) * Math.PI);
      bd[i] = (Math.random() * 2 - 1) * env;
    }
    const brushSrc = this.ctx.createBufferSource();
    brushSrc.buffer = brushBuf;

    const brushFilter = this.ctx.createBiquadFilter();
    brushFilter.type = 'bandpass';
    brushFilter.frequency.value = 1800 + resonance * 2600 + Math.random() * 900;
    brushFilter.Q.value = 1.6;

    const brushGain = this.ctx.createGain();
    brushGain.gain.value = 0.32 + resonance * 0.25;

    brushSrc.connect(brushFilter);
    brushFilter.connect(brushGain);
    brushGain.connect(grainPanner);
    brushSrc.start(now);
    brushSrc.stop(now + brushDur + 0.01);

    // 2. Crisp Micro-Crackle Impulses (3 to 5 delicate close-mic pops)
    const count = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < count; k++) {
      const t = now + k * (0.012 + Math.random() * 0.022);
      const len = Math.floor(this.ctx.sampleRate * 0.012);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2400 + Math.random() * 3800 * (0.4 + resonance * 0.6);
      f.Q.value = 2.0;

      const g = this.ctx.createGain();
      g.gain.value = 0.55 + Math.random() * 0.35;

      src.connect(f);
      f.connect(g);
      g.connect(grainPanner);

      src.start(t);
      src.stop(t + 0.015);
    }
  }

  _triggerASMRTapping(now, resonance) {
    if (!this.ctx || !this.nodes.asmr) return;
    const bus = this.nodes.asmr.bus;
    const prox = this.params.asmr.proximity;

    // Alternate or lightly randomize Left/Right ear for crisp 3D binaural hollow bamboo/wood tapping
    this.nodes.asmr.tapEar = !this.nodes.asmr.tapEar;
    const earSign = this.nodes.asmr.tapEar ? -1 : 1;
    const tapPanner = this.ctx.createStereoPanner();
    tapPanner.pan.value = earSign * (0.82 - prox * 0.35);
    tapPanner.connect(bus);
    tapPanner.connect(this.nodes.asmr.reverbSend);

    // Double-tap motif 35% of the time for natural organic finger-tapping cadence
    const tapOffsets = Math.random() < 0.35 ? [0, 0.065 + Math.random() * 0.025] : [0];
    const freqs = [480, 640, 820, 1080, 1320];

    tapOffsets.forEach((offset, idx) => {
      const t0 = now + offset;
      const vel = idx === 0 ? 1.0 : 0.68;
      const tapFreq = freqs[Math.floor(Math.random() * freqs.length)] * (0.9 + resonance * 0.25);

      // Mode 1: Hollow Bamboo Fundamental Resonator
      const osc1 = this.ctx.createOscillator();
      const g1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(tapFreq * 1.18, t0);
      osc1.frequency.exponentialRampToValueAtTime(tapFreq, t0 + 0.012);

      g1.gain.setValueAtTime(0.55 * vel, t0);
      g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);

      osc1.connect(g1);
      g1.connect(tapPanner);
      osc1.start(t0);
      osc1.stop(t0 + 0.07);

      // Mode 2: Woody Inharmonic Cavity Mode (2.32x ratio)
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(tapFreq * 2.32, t0);

      g2.gain.setValueAtTime(0.28 * vel * (0.5 + resonance * 0.5), t0);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.028);

      osc2.connect(g2);
      g2.connect(tapPanner);
      osc2.start(t0);
      osc2.stop(t0 + 0.032);
    });
  }

  /**
   * 60 Hz Real-Time Frame Update for Continuous Modulation, 3D HRTF Orbits & Chaos Scheduling
   */
  tick() {
    if (!this.ctx || !this.isRunning) return;

    const now = this.ctx.currentTime;
    const elapsed = now - this.startTime;
    const isBg = typeof document !== 'undefined' && document.hidden;

    // 1. Global 0.1 Hz Coherent Breath Oscillator (10-second cycle = 6 breaths/min)
    this.telemetry.breathPhase = (elapsed * 0.1 * Math.PI * 2) % (Math.PI * 2);
    this.telemetry.breathValue = Math.sin(this.telemetry.breathPhase);

    // 2. Update MODULE 1: Unified 8D Binaural Auricle (Pinna), Cranial Head-Shadow, ITD/ILD & Spatial ASMR / Water Drops
    if (this.nodes.spatial) {
      if (!this.params.spatial.enabled) {
        if (!this.nodes.spatial._isMuted) {
          for (let i = 0; i < this.nodes.spatial.voices.length; i++) {
            this.nodes.spatial.voices[i].voiceGain.gain.setTargetAtTime(0, now, 0.04);
            this.nodes.spatial.voices[i].pulseGain.gain.setTargetAtTime(0, now, 0.04);
            this.telemetry.spatialVoices[i].activeEnergy = 0;
          }
          this.nodes.spatial._isMuted = true;
        }
      } else {
        this.nodes.spatial._isMuted = false;
        const speed = this.params.spatial.speed;
        const asym = this.params.spatial.asymmetry;
        const rawCount = Math.max(1, Math.min(8, Math.round(this.params.spatial.count || 2)));
        const trajectory = this.params.spatial.trajectory || 'bifurcation_random';
        const palette = this.params.spatial.palette || 'water_bowl';
        const isRebalMode = trajectory === 'rebal';
        const isBifurcationMode = trajectory === 'bifurcation5m' || trajectory === 'bifurcation_random' || isRebalMode;
        // Ensure at least 2 voices when using 5m Split & Merge or REBAL so directional splitting is always active
        const count = isBifurcationMode ? Math.max(2, rawCount) : rawCount;
        const rebalCycle = (elapsed * speed * 0.75) % 1.0;

        // When REBAL is active, synchronize the global 0.1 Hz Breath telemetry (INHALE ▲ / EXHALE ▼) directly to the REBAL breath loop!
        if (isRebalMode || palette === 'rebal') {
          if (rebalCycle < 0.50) {
            const u = rebalCycle * 2.0; // 0..1 Exhale progress -> breathPhase in (PI/2 .. 3*PI/2) (cos < 0 => EXHALE ▼)
            this.telemetry.breathPhase = Math.PI * 0.501 + u * Math.PI * 0.998;
          } else {
            const w = (rebalCycle - 0.50) * 2.0; // 0..1 Inhale progress -> breathPhase in (3*PI/2 .. 5*PI/2) (cos > 0 => INHALE ▲)
            this.telemetry.breathPhase = (Math.PI * 1.501 + w * Math.PI * 0.998) % (Math.PI * 2);
          }
          this.telemetry.breathValue = Math.sin(this.telemetry.breathPhase);
        }

        // Crossfade Balance (`pulse` in 0..1):
        //  0.00 = 100% Pure 3D Water Drops / ASMR Triggers Only (0% Continuous Moving Harmonic Pad)
        //  0.50 = Balanced 3D Water Drops + Moving Harmonic Pad
        //  1.00 = 100% Pure Moving Harmonic Pad Only (0% Water Drops / Triggers)
        const mix = Math.max(0, Math.min(1, this.params.spatial.pulse !== undefined ? this.params.spatial.pulse : 0.50));
        const continuousLevel = mix <= 0.02 ? 0.0 : Math.sin(mix * Math.PI * 0.5);
        const dropLevel = mix >= 0.98 ? 0.0 : Math.cos(mix * Math.PI * 0.5) * 1.40;
        const triggerRate = this.params.spatial.rate !== undefined ? this.params.spatial.rate : 3.2;
        const auricle = this.params.spatial.auricle !== undefined ? this.params.spatial.auricle : 0.90;
        const elevRange = this.params.spatial.elevation !== undefined ? this.params.spatial.elevation : 0.85;
        const spiral = this.params.spatial.spiral !== undefined ? this.params.spatial.spiral : 0.0;
        const manualPos = this.params.spatial.manualPos;
        const voices = this.nodes.spatial.voices;
        const spatTc = isBg ? 0.065 : 0.025;

        // Overtone singing harmonic step for 'shamanic' palette on moving 3D voices
        if (palette === 'shamanic' && now >= this.nodes.spatial.nextOvertoneStepTime) {
          const harmonics = [4, 5, 6, 7, 8, 9, 10, 12];
          for (let i = 0; i < count; i++) {
            const v = voices[i];
            v.throatHarmonicIdx = (v.throatHarmonicIdx + 1 + Math.floor(Math.random() * 2)) % harmonics.length;
            const h = harmonics[v.throatHarmonicIdx];
            v.overtoneOsc.frequency.setTargetAtTime(Math.min(7200, v.freq * h), now, 0.08);
          }
          this.nodes.spatial.nextOvertoneStepTime = now + (1.1 + Math.random() * 1.3);
        }

        // Schedule 3D Spatialized Water Drops & Pure Integer Harmonic 3D Acoustic Pulses!
        // Note: In 'rebal' mode, setting `pulse = 1.0` (`dropLevel <= 0.02`) completely removes all drops/plucks so ONLY the Moving 3D Inhale/Exhale sounds play!
        const effectiveRate = Math.max(0.4, triggerRate || 3.2);
        const curSplit =
          isBifurcationMode && this.telemetry.spatialVoices[0] && this.telemetry.spatialVoices[0].splitFactor !== undefined
            ? this.telemetry.spatialVoices[0].splitFactor
            : 1.0;
        const isMergedBifurcation = isBifurcationMode && curSplit < 0.12;

        if (palette === 'shamanic' && dropLevel > 0.01) {
          const drumPeriod = 1.0 / Math.max(1.0, effectiveRate);
          if (now >= this.nodes.spatial.nextShamanicTime) {
            const vIdx = isMergedBifurcation ? 0 : this.nodes.spatial.lastTriggeredVoice % count;
            this.nodes.spatial.lastTriggeredVoice = (vIdx + 1) % count;
            this._triggerSpatialEventOnVoice(voices[vIdx], now, palette, auricle);
            if (continuousLevel > 0.02) {
              this._triggerPureHarmonic3DOnVoice(voices[vIdx], now, continuousLevel);
            }
            this.nodes.spatial.nextShamanicTime = now + drumPeriod;
          }
        } else if (now >= this.nodes.spatial.nextTriggerTime) {
          const vIdx = isMergedBifurcation ? 0 : this.nodes.spatial.lastTriggeredVoice % count;
          this.nodes.spatial.lastTriggeredVoice = (vIdx + 1) % count;

          if (palette === 'rebal') {
            // In REBAL mode, drops are ONLY triggered if the user blends in Drops (`dropLevel > 0.02`).
            // At 100% Moving Inhale/Exhale (`dropLevel === 0`), zero drops are emitted!
            if (dropLevel > 0.02) {
              this._triggerSpatialEventOnVoice(voices[vIdx], now, 'water_drops', auricle);
            }
          } else {
            if (dropLevel > 0.01) {
              this._triggerSpatialEventOnVoice(voices[vIdx], now, palette, auricle);
            }
            if (continuousLevel > 0.01) {
              // Pure Integer Harmonic 3D Pluck (slight 18ms offset when blended with water drop so both transients are crystal clear)
              const hOffset = dropLevel > 0.05 ? 0.018 : 0.0;
              this._triggerPureHarmonic3DOnVoice(voices[vIdx], now + hOffset, continuousLevel);
            }
          }

          // When split into 2 or 4 branches, step cleanly across all branches so the 3D torus/arcs are distinctly localized
          const splitCadenceBoost = isRebalMode && !isMergedBifurcation
            ? (1.15 + 0.35 * count * curSplit)
            : (isBifurcationMode && !isMergedBifurcation ? (1.0 + 0.75 * curSplit) : 1.0);
          const dt = (1.0 / (effectiveRate * splitCadenceBoost)) * (0.80 + Math.random() * 0.40);
          this.nodes.spatial.nextTriggerTime = now + dt;
        }

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

          let x, y, z, geomType, splitFactor = 1.0, stageLabel = '';
          if (manualPos && i === 0) {
            x = manualPos.x;
            y = manualPos.y;
            z = manualPos.z;
            geomType = 'manual';
          } else {
            const pos = this._computeSpatialTrajectory(i, count, elapsed, speed, asym, trajectory, elevRange, spiral);
            x = pos.x;
            y = pos.y;
            z = pos.z;
            geomType = pos.geomType;
            splitFactor = pos.splitFactor !== undefined ? pos.splitFactor : 1.0;
            stageLabel = pos.stageLabel || '';
          }

          // Keep each voice locked to its pure consonant integer harmonic frequencies (or breath-swept pitch in 'rebal' mode)
          if (palette !== 'rebal') {
            v.osc.frequency.setTargetAtTime(v.freq, now, spatTc);
            v.bodyOsc.frequency.setTargetAtTime(v.freq * 2.0, now, spatTc);
          }
          if (isBifurcationMode) {
            const mergeGainScale = 0.68 + 0.32 * splitFactor;
            v.voiceGain.gain.setTargetAtTime(v.weight * mergeGainScale, now, 0.04);
          } else {
            v.voiceGain.gain.setTargetAtTime(v.weight, now, 0.04);
          }

          if (v.panner.positionX) {
            v.panner.positionX.setTargetAtTime(x, now, spatTc);
            v.panner.positionY.setTargetAtTime(y, now, spatTc);
            v.panner.positionZ.setTargetAtTime(z, now, spatTc);
          } else {
            v.panner.setPosition(x, y, z);
          }

          const dist = Math.sqrt(x * x + y * y + z * z);
          const safeDist = Math.max(0.16, dist);

          // Normalized directional cosines:
          // sinTheta in [-1..+1]: -1 = hard Left ear, +1 = hard Right ear
          // frontness in [-1..+1]: +1 = directly in front of face (-Z), -1 = directly behind neck (+Z)
          // elevNorm in [-1..+1]: +1 = directly above crown (+Y, +90°), -1 = directly below chin/floor (-Y, -90°)
          const sinTheta = Math.max(-1, Math.min(1, x / safeDist));
          const frontness = Math.max(-1, Math.min(1, -z / safeDist));
          const elevNorm = Math.max(-1, Math.min(1, y / safeDist));
          const distAirDamp = 1 / (1 + Math.max(0, dist - 0.5) * 0.14);

          // 1. Blauert Front vs. Back Directional Band Filter:
          // Front (z < 0): boosts 3650 Hz frontal presence band.
          // Back (z > 0): shifts to 1050 Hz posterior Blauert band so the brain unmistakably perceives "behind the neck"!
          if (frontness >= 0) {
            v.blauertFilter.frequency.setTargetAtTime(3650, now, spatTc);
            v.blauertFilter.gain.setTargetAtTime(frontness * 6.5 * auricle, now, spatTc);
          } else {
            v.blauertFilter.frequency.setTargetAtTime(1050, now, spatTc);
            v.blauertFilter.gain.setTargetAtTime((-frontness) * 5.8 * auricle, now, spatTc);
          }

          // 2. Outer Ear Concha Cavity Funnel Resonance (4.5 kHz):
          const conchaDb = (frontness >= -0.2 ? (frontness + 0.4) * 4.5 : frontness * 4.0) * auricle;
          v.conchaFilter.gain.setTargetAtTime(conchaDb, now, spatTc);

          // 3. Anthropometric Vertical Elevation Cues (3-stage Pinna Notch + Zenith Peak + Torso/Chest Shelf):
          // (a) Pinna Antihelix Notch sweeps from 4,250 Hz (-90° Below Chin) -> 6,800 Hz (0° Ear Level) -> 11,100 Hz (+90° Zenith)
          const notchFreq = Math.max(4100, Math.min(11800, 6800 * Math.pow(2, 0.68 * elevNorm) + 600 * Math.abs(sinTheta)));
          v.elevFilter.frequency.setTargetAtTime(notchFreq, now, spatTc);
          v.elevFilter.Q.setTargetAtTime(4.0 + 2.5 * auricle, now, spatTc);
          v.elevFilter.gain.setTargetAtTime(-13.5 * auricle, now, spatTc);

          // (b) Blauert Overhead Zenith Peak (8.6 kHz scapha resonance blooms up to +9.5 dB when source is Above Crown y > 0)
          const zenithDb = (elevNorm >= 0 ? elevNorm * 9.5 : elevNorm * 4.5) * auricle;
          v.zenithFilter.gain.setTargetAtTime(zenithDb, now, spatTc);

          // (c) Torso / Chest Cavity vs. Overhead Weightlessness (320 Hz low-shelf: +6.5 dB Below Chin vs -5.5 dB Above Crown)
          const torsoDb = (-elevNorm * 6.0) * auricle;
          v.torsoFilter.gain.setTargetAtTime(torsoDb, now, spatTc);

          // Sweep the high-frequency Auricle Velvet Air band (4.5 kHz .. 9.2 kHz) with elevation so the Pinna Notch & Zenith Peak are always vivid
          v.noiseBand.frequency.setTargetAtTime(6400 + elevNorm * 2400, now, spatTc);

          // 4. Pinna Rim Rear Cartilage Shadow & Vertical Shoulder Shadow Low-Pass:
          // Wide open in front & overhead (up to 15.5 kHz); shadowed behind neck or below torso
          const elevOpen = 1.0 + 0.22 * elevNorm;
          const baseShadow = frontness >= 0
            ? (5800 + frontness * 9200) * elevOpen
            : 5500 * Math.pow(0.28 + 0.45 * (1 - auricle), -frontness) * elevOpen;
          v.shadowFilter.frequency.setTargetAtTime(Math.max(650, Math.min(16500, baseShadow * distAirDamp)), now, spatTc);

          // 5. Woodworth Spherical Head Interaural Time Difference (ITD 0..680 us) — no radial Doppler delay so 0..5m motion never pitch-bends like a siren!
          const absSin = Math.abs(sinTheta);
          const woodworth = (absSin + Math.asin(absSin)) / (1 + Math.PI * 0.5); // 0..1
          const itdSec = 0.00068 * (0.4 + 0.6 * auricle) * woodworth;
          const delayL = 0.00008 + (sinTheta > 0 ? itdSec : 0);
          const delayR = 0.00008 + (sinTheta < 0 ? itdSec : 0);
          v.itdDelayL.delayTime.setTargetAtTime(delayL, now, spatTc);
          v.itdDelayR.delayTime.setTargetAtTime(delayR, now, spatTc);

          // 6. Contralateral Cranial Head-Shadow Low-Pass (Near ear = 16 kHz crystal clear; Far ear = shadowed down to ~850 Hz by skull):
          const shadowExp = 0.35 + 0.65 * auricle;
          const cutoffL = sinTheta <= 0
            ? 16000 * distAirDamp
            : Math.max(780, 15500 * Math.pow(0.055, Math.pow(sinTheta, 0.85) * shadowExp) * distAirDamp);
          const cutoffR = sinTheta >= 0
            ? 16000 * distAirDamp
            : Math.max(780, 15500 * Math.pow(0.055, Math.pow(-sinTheta, 0.85) * shadowExp) * distAirDamp);
          v.headShadowL.frequency.setTargetAtTime(cutoffL, now, spatTc);
          v.headShadowR.frequency.setTargetAtTime(cutoffR, now, spatTc);

          // 7. Near-Field Spherical ILD & Ear-Canal Proximity Gain:
          // True distance from source (x,y,z) to Left Ear (-0.09,0,0) and Right Ear (+0.09,0,0)
          const dL = Math.sqrt((x + 0.09) * (x + 0.09) + y * y + z * z + 0.012);
          const dR = Math.sqrt((x - 0.09) * (x - 0.09) + y * y + z * z + 0.012);
          const distAtten = 1 / (1 + 0.16 * Math.pow(Math.max(0, dist - 0.20), 0.92));
          const panAngle = (sinTheta + 1) * (Math.PI * 0.25); // 0 (Left) .. PI/2 (Right)
          const nearRatioL = Math.min(1.65, 0.45 / dL);
          const nearRatioR = Math.min(1.65, 0.45 / dR);
          const gL = Math.cos(panAngle) * (0.75 + 0.35 * nearRatioL * auricle) * distAtten;
          const gR = Math.sin(panAngle) * (0.75 + 0.35 * nearRatioR * auricle) * distAtten;
          v.earGainL.gain.setTargetAtTime(gL, now, spatTc);
          v.earGainR.gain.setTargetAtTime(gR, now, spatTc);

          // 8. Continuous Moving Texture Harmonics & Formants:
          let contMod = continuousLevel;
          if (palette === 'rebal') {
            // Monroe Gateway REBAL Moving 3D Inhale / Exhale Breath + Resonant Tuning Harmonic Choir:
            // - On EXHALE ▼ (rebalCycle < 0.50, u in 0..1): Crown Fountain ("HAAA" 690/2280 Hz) -> Turning Torus -> Feet ("OOO" 295/760 Hz)
            // - On INHALE ▲ (rebalCycle >= 0.50, w in 0..1): Feet ("OOO" 295/760 Hz) -> Body Core ("AHH" 620/1320 Hz) -> Filling Head ("EEE" 430/2640 Hz)
            const baseF = Math.max(48, Math.min(440, this.params.spatial.baseFreq || 144));
            const chordRatios = [1.0, 1.25, 1.5, 2.0];
            const branchRatio = chordRatios[i % chordRatios.length];
            const airFlutter = 0.84 + 0.16 * Math.sin(elapsed * (10.5 + i * 1.9));

            if (rebalCycle < 0.50) {
              const u = rebalCycle * 2.0; // 0..1 Exhale progress
              // Downward harmonic & vocal-breath glide from Crown (+85°) around the body down to the Feet (-75°)
              const fExhale = Math.max(44, baseF * branchRatio * (1.60 - 0.75 * u));
              v.osc.frequency.setTargetAtTime(fExhale, now, spatTc);
              v.bodyOsc.frequency.setTargetAtTime(fExhale * 2.0, now, spatTc);
              v.overtoneOsc.frequency.setTargetAtTime(fExhale, now, spatTc);

              const f1 = 295 + 395 * Math.pow(1.0 - u, 0.90);
              const f2 = 760 + 1520 * Math.pow(1.0 - u, 1.20);
              v.formantF1.frequency.setTargetAtTime(f1, now, spatTc);
              v.formantF2.frequency.setTargetAtTime(f2, now, spatTc);

              const exhaleEnv = Math.sin(Math.pow(u, 0.72) * Math.PI);
              // Rotating 3D spotlight across the 2 or 4 branches so each turning stream is distinctly localized in 3D!
              const branchSpotlight = 0.38 + 0.62 * Math.pow(0.5 + 0.5 * Math.sin(u * Math.PI * 4.0 - (i * Math.PI * 2) / Math.max(2, count)), 1.4);
              contMod = continuousLevel * exhaleEnv * branchSpotlight * airFlutter * 1.35;
            } else {
              const w = (rebalCycle - 0.50) * 2.0; // 0..1 Inhale progress
              // Upward harmonic & vocal-breath glide from Feet (-75°) up through the whole body into the Head (0°..+25°)
              const fInhale = Math.max(44, baseF * (w < 0.70 ? 1.0 : branchRatio) * (0.85 + 0.95 * Math.pow(w, 1.10)));
              v.osc.frequency.setTargetAtTime(fInhale, now, spatTc);
              v.bodyOsc.frequency.setTargetAtTime(fInhale * 2.0, now, spatTc);
              v.overtoneOsc.frequency.setTargetAtTime(fInhale, now, spatTc);

              const f1 = 295 + 340 * Math.sin(w * Math.PI * 0.82);
              const f2 = 760 + 1880 * Math.pow(w, 1.15);
              v.formantF1.frequency.setTargetAtTime(f1, now, spatTc);
              v.formantF2.frequency.setTargetAtTime(f2, now, spatTc);

              const inhaleEnv = Math.sin(Math.pow(w, 0.85) * Math.PI);
              const chakraPulse = 0.82 + 0.18 * Math.sin(w * Math.PI * 10.0 + i * 0.7);
              contMod = continuousLevel * inhaleEnv * chakraPulse * airFlutter * 1.35;
            }
          } else if (palette === 'water_bowl' || palette === 'rich8d' || palette === 'tapping') {
            v.formantF1.frequency.setTargetAtTime(Math.min(4800, v.freq * 2.0), now, 0.08);
            v.formantF2.frequency.setTargetAtTime(Math.min(6400, v.freq * 3.0), now, 0.08);
            if (palette === 'water_bowl' || palette === 'rich8d') {
              const bowlShimmer = 0.88 + 0.12 * Math.sin(elapsed * 1.15 + i * 1.5);
              contMod = continuousLevel * bowlShimmer;
            }
          } else {
            const [f1, f2] = this._vowelFormants(elapsed * (0.38 + i * 0.09) + i * 1.3);
            const fScale = palette === 'whisper' ? 1.25 : palette === 'water_drops' ? 1.45 : 1.1;
            v.formantF1.frequency.setTargetAtTime(f1 * fScale, now, 0.06);
            v.formantF2.frequency.setTargetAtTime(f2 * fScale, now, 0.06);
            if (palette === 'whisper') {
              const syllable = 0.60 + 0.40 * Math.sin(elapsed * 2.4 + i) * Math.cos(elapsed * 3.9 - i);
              contMod = continuousLevel * syllable;
            } else if (palette === 'water_drops') {
              const streamRipple = 0.72 + 0.28 * Math.sin(elapsed * 4.5 + i * 1.7) * Math.cos(elapsed * 7.1);
              contMod = continuousLevel * streamRipple;
            }
          }
          v.pulseGain.gain.setTargetAtTime(contMod, now, spatTc);
          v.triggerInput.gain.setTargetAtTime(dropLevel, now, spatTc);

          const activeEnergy = Math.max(0.25, contMod + (dropLevel > 0 ? 0.35 : 0));
          const tv = this.telemetry.spatialVoices[i];
          tv.x = x;
          tv.y = y;
          tv.z = z;
          tv.dist = dist;
          tv.geomType = geomType;
          tv.splitFactor = splitFactor;
          tv.stageLabel = stageLabel;
          tv.activeEnergy = activeEnergy;

          // Store trail point for 3D geometric path visualization (skip in background to save CPU)
          if (!isBg) {
            tv.trail.push({ x, y, z });
            if (tv.trail.length > 56) {
              tv.trail.shift();
            }
          }
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
      if (!this.params.pac.enabled) {
        this.nodes.pac.pacModGain.gain.setTargetAtTime(0, now, 0.04);
        this.nodes.pac.binGain.gain.setTargetAtTime(0, now, 0.04);
        this.telemetry.gammaEnvelope = 0;
      } else {
        const baseFreq = this.params.pac.baseFreq || 136.0;
        const fTheta = this.params.pac.theta;
        const pacDepth = this.params.pac.depth;
        const breathDepth = this.params.pac.breath;

        // Slow Phase Rhythm (1.5 .. 12 Hz): Theta wave & sharp positive-peak gate
        const thetaPhase = (elapsed * fTheta * Math.PI * 2) % (Math.PI * 2);
        const thetaWave = 0.5 + 0.5 * Math.cos(thetaPhase); // 0 .. 1 sinusoidal rhythm
        // Gate Gamma bursts strictly on the positive crests of the Theta wave (0 in troughs, 1 at crest)
        const thetaPeakGate = Math.pow(Math.max(0, Math.cos(thetaPhase)), 2.6);

        // 0.1 Hz Coherent Breath Swell (10-second cycle: 5s Inhale ▲, 5s Exhale ▼)
        const breathNorm = 0.5 + 0.5 * this.telemetry.breathValue; // 0 = Exhale trough, 1 = Inhale peak
        const breathAmp = (1.0 - breathDepth * 0.40) + breathDepth * 0.60 * Math.pow(breathNorm, 1.2);

        // Vagal Filter Bloom: On Inhale, opens up to reveal rich glowing harmonics; on Exhale, warms down into deep grounding bass
        const pacCutoff = Math.min(8500, baseFreq * (2.2 + breathNorm * (2.0 + breathDepth * 4.0)));
        const binCutoff = Math.min(8000, baseFreq * (3.0 + breathNorm * (2.0 + breathDepth * 4.0)));

        this.nodes.pac.pacFilter.frequency.setTargetAtTime(pacCutoff, now, isBg ? 0.08 : 0.03);
        if (this.nodes.pac.binFilterL) {
          this.nodes.pac.binFilterL.frequency.setTargetAtTime(binCutoff, now, isBg ? 0.08 : 0.03);
          this.nodes.pac.binFilterR.frequency.setTargetAtTime(binCutoff, now, isBg ? 0.08 : 0.03);
        } else if (this.nodes.pac.binFilter) {
          this.nodes.pac.binFilter.frequency.setTargetAtTime(binCutoff, now, isBg ? 0.08 : 0.03);
        }

        // PAC Silk Shimmer Gate: Ethereal golden-ratio celestial shimmer gated onto Theta crests
        const gammaBurstTarget = pacDepth <= 0.005
          ? 0.0
          : pacDepth * thetaPeakGate * 0.75 * breathAmp;

        // Multi-Harmonic Binaural Carrier Breath Swell:
        // Slow 10-second gentle tidal breath swell (zero fast monaural AM pulsation)
        const binBreathMod = (1.0 - breathDepth * 0.15) + breathDepth * 0.20 * breathNorm;
        const binTarget = 0.85 * binBreathMod;

        const pacTc = isBg ? 0.050 : 0.015;
        const binTc = isBg ? 0.060 : 0.022;

        this.nodes.pac.pacModGain.gain.setTargetAtTime(gammaBurstTarget, now, pacTc);
        this.nodes.pac.binGain.gain.setTargetAtTime(binTarget, now, binTc);

        this.telemetry.thetaPhase = thetaPhase;
        this.telemetry.gammaEnvelope = gammaBurstTarget;
        this.telemetry.pacIndex = pacDepth;
      }
    }

    // 5. Update MODULE 4: Fractal Shepard-Risset Voices (Harmonious Just-Intonation Multi-Scale 1/f Cascade)
    if (this.nodes.fractal) {
      if (!this.params.fractal.enabled) {
        if (!this.nodes.fractal._isMuted) {
          for (let i = 0; i < this.nodes.fractal.voices.length; i++) {
            const v = this.nodes.fractal.voices[i];
            v.gain.gain.setTargetAtTime(0, now, 0.04);
            v.thirdGain.gain.setTargetAtTime(0, now, 0.04);
            v.fifthGain.gain.setTargetAtTime(0, now, 0.04);
          }
          this.nodes.fractal._isMuted = true;
        }
      } else {
        this.nodes.fractal._isMuted = false;
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

          const fTc = isBg ? 0.060 : 0.025;
          v.osc.frequency.setTargetAtTime(freq, now, fTc);
          v.thirdOsc.frequency.setTargetAtTime(Math.min(8000, freq * thirdRatio), now, fTc);
          v.fifthOsc.frequency.setTargetAtTime(Math.min(8000, freq * fifthRatio), now, fTc);

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

          v.gain.gain.setTargetAtTime(rootAmp * 0.19, now, fTc);
          v.thirdGain.gain.setTargetAtTime(thirdAmp, now, fTc);
          v.fifthGain.gain.setTargetAtTime(fifthAmp, now, fTc);

          // Gentle stereo breathing
          const panPos = Math.max(-0.9, Math.min(0.9, Math.sin(v.octavePos * Math.PI * 2 + fDepth * wRoot * 0.9) * 0.65));
          v.pan.pan.setTargetAtTime(panPos, now, isBg ? 0.080 : 0.04);

          this.telemetry.shepardVoices[i].octavePos = v.octavePos;
          this.telemetry.shepardVoices[i].freq = freq;
          this.telemetry.shepardVoices[i].amp = rootAmp + (thirdAmp + fifthAmp) * 2.5;
          this.telemetry.shepardVoices[i].ripple = fDepth * wRoot;
        }
      }
    }

    // 6. Update MODULE 5: Infrasound & Sub-Bass Pulse
    if (this.nodes.sub) {
      if (!this.params.sub.enabled) {
        this.nodes.sub.pulseGain.gain.setTargetAtTime(0, now, 0.04);
      } else {
        const pulseHz = this.params.sub.pulse;
        const pulseMod = 0.55 + 0.45 * Math.sin(elapsed * pulseHz * Math.PI * 2);
        this.nodes.sub.pulseGain.gain.setTargetAtTime(pulseMod, now, isBg ? 0.055 : 0.025);
      }
    }

    // 7. Update MODULE 6: Ganzfeld Cavern Vowel-Formant Sweeps (independent L/R morphing)
    if (this.nodes.ganzfeld) {
      if (!this.params.ganzfeld.enabled) {
        this.nodes.ganzfeld.directGain.gain.setTargetAtTime(0, now, 0.04);
        this.nodes.ganzfeld.sweepGain.gain.setTargetAtTime(0, now, 0.04);
      } else {
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
    }

    // 8. Update MODULE 7: 3D Binaural ASMR & Shamanic Ritual Trance
    if (this.nodes.asmr) {
      if (!this.params.asmr.enabled) {
        if (!this.nodes.asmr._isMuted) {
          this.nodes.asmr.bus.gain.setTargetAtTime(0, now, 0.04);
          this.nodes.asmr.whisperGain.gain.setTargetAtTime(0, now, 0.04);
          this.nodes.asmr.throatGain.gain.setTargetAtTime(0, now, 0.04);
          this.nodes.asmr._isMuted = true;
        }
      } else {
        this.nodes.asmr._isMuted = false;
        const targetBus = this.params.asmr.gain * 0.60;
        this.nodes.asmr.bus.gain.setTargetAtTime(targetBus, now, 0.05);

        const pal = this.params.asmr.palette;
        const prox = this.params.asmr.proximity;
        const res = this.params.asmr.resonance;

        // Dynamic 3D Peripersonal Orbit: shifts from ear to ear at close proximity
        const orbitSpeed = pal === 'whisper' ? 0.18 : 0.35;
        const panVal = Math.sin(elapsed * orbitSpeed) * (1.0 - prox * 0.35);
        this.nodes.asmr.panner.pan.setTargetAtTime(panVal, now, 0.06);

        // Near-field sounds are intimately dry; reverb increases with distance
        const revSendLevel = prox * 0.35 * this._reverbSendLevel(this.params.reverbMix);
        this.nodes.asmr.reverbSend.gain.setTargetAtTime(revSendLevel, now, 0.08);

        // Archetype-specific sound updates:
        if (pal === 'whisper') {
          this.nodes.asmr.throatGain.gain.setTargetAtTime(0, now, 0.04);
          // Morph vowel formants slowly + syllabic cadence so it sounds like an intimate binaural whisper
          const syllableMod = 0.55 + 0.45 * Math.sin(elapsed * 2.2) * Math.cos(elapsed * 3.7);
          const breathNorm = 0.5 + 0.5 * this.telemetry.breathValue;
          const wLvl = (0.55 + 0.85 * Math.pow(breathNorm, 1.1)) * syllableMod;
          this.nodes.asmr.whisperGain.gain.setTargetAtTime(wLvl, now, 0.04);
          const [f1, f2] = this._vowelFormants(elapsed * 0.42);
          if (this.nodes.asmr.whisperF1) {
            this.nodes.asmr.whisperF1.frequency.setTargetAtTime(f1 * 1.25, now, 0.06);
            this.nodes.asmr.whisperF2.frequency.setTargetAtTime(f2 * 1.15, now, 0.06);
          }
          const fAir = 3200 + res * 3800;
          this.nodes.asmr.whisperAirFilter.frequency.setTargetAtTime(fAir, now, 0.05);
        } else if (pal === 'throat') {
          this.nodes.asmr.whisperGain.gain.setTargetAtTime(0, now, 0.04);
          this.nodes.asmr.throatGain.gain.setTargetAtTime(0.85, now, 0.04);
          // Overtone singing harmonic step scheduler
          if (now >= this.nodes.asmr.nextThroatStepTime) {
            const harmonics = [4, 5, 6, 7, 8, 9, 10, 12];
            const baseDrone = 110.0;
            const h = harmonics[this.nodes.asmr.throatHarmonicIndex % harmonics.length];
            const overtoneFreq = baseDrone * h;
            this.nodes.asmr.throatFilter.frequency.setTargetAtTime(overtoneFreq, now, 0.08);
            this.nodes.asmr.throatFilter.Q.setTargetAtTime(14 + res * 22, now, 0.08);
            if (this.nodes.asmr.throatWhistleOsc) {
              this.nodes.asmr.throatWhistleOsc.frequency.setTargetAtTime(overtoneFreq, now, 0.08);
              this.nodes.asmr.throatWhistleGain.gain.setTargetAtTime(0.14 + res * 0.22, now, 0.08);
            }
            this.nodes.asmr.throatHarmonicIndex = (this.nodes.asmr.throatHarmonicIndex + 1 + Math.floor(Math.random() * 2)) % harmonics.length;
            this.nodes.asmr.nextThroatStepTime = now + (1.2 + Math.random() * 1.5);
          }
        } else if (pal === 'shamanic') {
          this.nodes.asmr.whisperGain.gain.setTargetAtTime(0, now, 0.04);
          this.nodes.asmr.throatGain.gain.setTargetAtTime(0, now, 0.04);
          // 4.5 Hz Shamanic Drum Cadence (~270 BPM, Theta ASSR)
          const drumPeriod = 1.0 / 4.5;
          if (now >= this.nodes.asmr.nextDrumTime) {
            this._triggerShamanicHit(now, res);
            this.nodes.asmr.nextDrumTime = now + drumPeriod;
          }
        } else {
          // 'crackle' or 'tapping'
          this.nodes.asmr.whisperGain.gain.setTargetAtTime(0, now, 0.04);
          this.nodes.asmr.throatGain.gain.setTargetAtTime(0, now, 0.04);
          if (now >= this.nodes.asmr.nextEventTime) {
            if (pal === 'crackle') {
              this._triggerASMRCrackle(now, res);
            } else {
              this._triggerASMRTapping(now, res);
            }
            const rate = Math.max(0.5, this.params.asmr.rate);
            const dt = (1.0 / rate) * (0.6 + Math.random() * 0.8);
            this.nodes.asmr.nextEventTime = now + dt;
          }
        }
      }
    }

    // 9. Cathedral Shimmer: slowly breathing choir resonators in the reverb tail
    if (this.shimmerVoices && !isBg && this.params.reverbMix > 0.02) {
      this.shimmerVoices.forEach((v) => {
        const a = 0.5 + 0.5 * Math.sin(elapsed * v.rate * Math.PI * 2 + v.phase);
        v.g.gain.setTargetAtTime(0.15 + 0.85 * a * a, now, 0.2);
      });
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

  _checkAllModulesDisabled() {
    return !this.params.spatial.enabled &&
           !this.params.chaos.enabled &&
           !this.params.pac.enabled &&
           !this.params.fractal.enabled &&
           !this.params.sub.enabled &&
           !this.params.ganzfeld.enabled &&
           !this.params.asmr.enabled;
  }

  updateModule(mod, key, val) {
    if (!this.params[mod]) return;
    this.params[mod][key] = val;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Bulletproof zero-bleed master bus muting when all 6 modules are disabled
    if (key === 'enabled') {
      const allOff = this._checkAllModulesDisabled();
      if (allOff) {
        this.dryBus.gain.setTargetAtTime(0, now, 0.03);
        this.spatialDryBus.gain.setTargetAtTime(0, now, 0.03);
        this.reverbSendGain.gain.setTargetAtTime(0, now, 0.03);
        this.reverbReturn.gain.setTargetAtTime(0, now, 0.03);
      } else {
        this.dryBus.gain.setTargetAtTime(this._dryLevel(this.params.reverbMix), now, 0.04);
        this.spatialDryBus.gain.setTargetAtTime(1.0, now, 0.04);
        this.reverbSendGain.gain.setTargetAtTime(this._reverbSendLevel(this.params.reverbMix), now, 0.04);
        this.reverbReturn.gain.setTargetAtTime(1.0, now, 0.04);
      }
    }

    if (mod === 'spatial') {
      const targetBus = this.params.spatial.enabled ? this.params.spatial.gain * 0.72 : 0;
      this.nodes.spatial.bus.gain.setTargetAtTime(targetBus, now, 0.05);

      if (key === 'palette') {
        this._applySpatialPaletteVoicing(val);
        this.nodes.spatial.nextTriggerTime = 0;
        this.nodes.spatial.nextShamanicTime = 0;
        this.nodes.spatial.nextOvertoneStepTime = 0;
      } else if (key === 'auricle') {
        if (this.nodes.spatial.extSend) {
          this.nodes.spatial.extSend.gain.setTargetAtTime(0.16 * val, now, 0.05);
        }
      } else if (key === 'collapse') {
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
        const base = this.params.spatial.baseFreq;
        this.nodes.spatial.coreOscL.frequency.setTargetAtTime(base, now, 0.1);
        this.nodes.spatial.coreOscR.frequency.setTargetAtTime(base, now, 0.1);
        this._applySpatialPaletteVoicing(this.params.spatial.palette || 'water_bowl');
        const ratios = this.tuningRatios[this.params.spatial.tuning] || this.tuningRatios.octaves;
        this.nodes.spatial.voices.forEach((v, i) => {
          this.telemetry.spatialVoices[i].freq = base * ratios[i];
        });
      } else if (key === 'trajectory' || key === 'count') {
        this.telemetry.spatialVoices.forEach((tv) => {
          tv.trail = [];
        });
      }
    } else if (mod === 'chaos') {
      const targetBus = this.params.chaos.enabled ? this.params.chaos.gain * 0.45 : 0;
      this.nodes.chaos.bus.gain.setTargetAtTime(targetBus, now, 0.05);
    } else if (mod === 'pac') {
      const targetBinBus = this.params.pac.enabled ? this.params.pac.gain * 0.88 : 0;
      const targetPacBus = this.params.pac.enabled ? this.params.pac.gain * 0.45 : 0;
      if (this.nodes.pac.binBus) {
        this.nodes.pac.binBus.gain.setTargetAtTime(targetBinBus, now, 0.05);
      }
      if (this.nodes.pac.pacBus) {
        this.nodes.pac.pacBus.gain.setTargetAtTime(targetPacBus, now, 0.05);
      }
      if (this.params.pac.enabled && this.nodes.pac.binGain) {
        this.nodes.pac.binGain.gain.setTargetAtTime(0.85, now, 0.04);
      }
      if (this.nodes.pac.bus && this.nodes.pac.bus !== this.nodes.pac.binBus) {
        this.nodes.pac.bus.gain.setTargetAtTime(targetBinBus, now, 0.05);
      }
      if (key === 'baseFreq' || key === 'theta') {
        const c = this.params.pac.baseFreq || 136.0;
        const half = (this.params.pac.theta || 6.0) / 2;
        const fL0 = Math.max(20, c - half);
        const fR0 = Math.max(20, c + half);
        const harmRatios = [1.0, 2.0, 3.0, 4.0];
        this.nodes.pac.carrierFreq = c;
        if (this.nodes.pac.binOscsL) {
          for (let k = 0; k < harmRatios.length; k++) {
            const r = harmRatios[k];
            const fL = fL0 * r;
            const fR = fR0 * r;
            this.nodes.pac.binOscsL[k].frequency.setTargetAtTime(fL, now, 0.05);
            this.nodes.pac.binOscsR[k].frequency.setTargetAtTime(fR, now, 0.05);
          }
        }
        if (this.nodes.pac.binFilterL) {
          this.nodes.pac.binFilterL.frequency.setTargetAtTime(Math.min(8000, c * 6.0), now, 0.05);
          this.nodes.pac.binFilterR.frequency.setTargetAtTime(Math.min(8000, c * 6.0), now, 0.05);
        }
        if (this.nodes.pac.pacCarrier1) {
          this.nodes.pac.pacCarrier1.frequency.setTargetAtTime(c * 2.0, now, 0.05);
          this.nodes.pac.pacCarrier2.frequency.setTargetAtTime(c * 3.236, now, 0.05);
          this.nodes.pac.pacCarrier3.frequency.setTargetAtTime(c * 5.0, now, 0.05);
        }
      } else if (key === 'harmonics') {
        const hAmt = Math.max(0, Math.min(1, val));
        const harmBaseGains = [1.0, 0.42, 0.22, 0.10];
        if (this.nodes.pac.binGainsL) {
          for (let k = 1; k < this.nodes.pac.binGainsL.length; k++) {
            const g = harmBaseGains[k] * hAmt;
            this.nodes.pac.binGainsL[k].gain.setTargetAtTime(g, now, 0.04);
            this.nodes.pac.binGainsR[k].gain.setTargetAtTime(g, now, 0.04);
          }
        }
      } else if (key === 'gamma') {
        if (this.nodes.pac.gammaOsc) {
          this.nodes.pac.gammaOsc.frequency.setTargetAtTime(val, now, 0.015);
        }
      }
    } else if (mod === 'fractal') {
      const targetBus = this.params.fractal.enabled ? this.params.fractal.gain * 0.42 : 0;
      this.nodes.fractal.bus.gain.setTargetAtTime(targetBus, now, 0.05);
    } else if (mod === 'sub') {
      const targetBus = this.params.sub.enabled ? this.params.sub.gain * 0.65 : 0;
      this.nodes.sub.bus.gain.setTargetAtTime(targetBus, now, 0.05);
      if (this.params.sub.enabled && this.nodes.sub.pulseGain) {
        this.nodes.sub.pulseGain.gain.setTargetAtTime(0.85, now, 0.04);
      }
      if (key === 'freq') {
        const f0 = val;
        this.nodes.sub.subOsc1.frequency.setTargetAtTime(f0, now, 0.08);
        this.nodes.sub.subOsc2.frequency.setTargetAtTime(f0 * 2, now, 0.08);
        if (this.nodes.sub.subOsc3) {
          this.nodes.sub.subOsc3.frequency.setTargetAtTime(f0 * 3, now, 0.08);
        }
        this._updateSubWarmth(this.params.sub.warmth);
      } else if (key === 'warmth') {
        this._updateSubWarmth(val);
      }
    } else if (mod === 'ganzfeld') {
      const targetBus = this.params.ganzfeld.enabled ? this.params.ganzfeld.gain * 0.35 : 0;
      this.nodes.ganzfeld.bus.gain.setTargetAtTime(targetBus, now, 0.05);
      if (key === 'color') {
        this.nodes.ganzfeld.colorFilter.frequency.setTargetAtTime(this._colorToFreq(val), now, 0.1);
      } else if (key === 'sweep') {
        const g = this.nodes.ganzfeld;
        g.directGain.gain.setTargetAtTime(this._cavernDirect(val), now, 0.1);
        g.sweepGain.gain.setTargetAtTime(this._cavernWet(val), now, 0.1);
        const q = this._cavernQ(val);
        [g.cavernL1, g.cavernL2, g.cavernR1, g.cavernR2].forEach((f) => f.Q.setTargetAtTime(q, now, 0.1));
      }
    } else if (mod === 'asmr') {
      const targetBus = this.params.asmr.enabled ? this.params.asmr.gain * 0.85 : 0;
      if (this.nodes.asmr && this.nodes.asmr.bus) {
        this.nodes.asmr.bus.gain.setTargetAtTime(targetBus, now, 0.05);
      }
      if (key === 'palette' && this.nodes.asmr) {
        this.nodes.asmr.nextEventTime = 0;
        this.nodes.asmr.nextDrumTime = 0;
        this.nodes.asmr.nextThroatStepTime = 0;
        if (val !== 'whisper' && this.nodes.asmr.whisperGain) {
          this.nodes.asmr.whisperGain.gain.setTargetAtTime(0, now, 0.03);
        }
        if (val !== 'throat' && this.nodes.asmr.throatGain) {
          this.nodes.asmr.throatGain.gain.setTargetAtTime(0, now, 0.03);
        }
      }
    }
  }
}

window.ConsciousnessAudioEngine = ConsciousnessAudioEngine;
