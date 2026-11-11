/**
 * AETHER // Psychoacoustic & Neurophenomenological WebAudio Engine
 * Real-time synthesis for:
 *  1. 3D Sound Space & REBAL Energy Torus (measured HRTF + floor reflection + room; see spatial-engine.js)
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
        palette: 'energy',      // 'energy' | 'bowl' | 'drops' | 'chimes'
        trajectory: 'orbit',    // 'rebal' | 'orbit' | 'vertical' | 'sphere' | 'manual'
        count: 2,               // 1..4 moving sources
        gain: 0.8,
        speed: 0.1,             // cycles per second (REBAL: breaths per second)
        distance: 1.8,          // metres
        room: 0.45,             // 0 = anechoic, 1 = strong floor reflection + early-reflection room
        spiral: 0.0,            // REBAL torus twist (0 = pure vertical loop)
        manualPos: null         // {x, y, z} while the user drags on the canvas
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
   * MODULE 1: 3D Sound Space & REBAL Energy Torus
   * Implemented in spatial-engine.js (measured-HRTF binaural spatializer with floor reflection,
   * early-reflection room and breath-coupled REBAL toroidal trajectory).
   */
  _setupSpatialModule() {
    this.nodes.spatial = new window.Spatial3DModule(this);
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

    // 2. Update MODULE 1: 3D Sound Space & REBAL Energy Torus (see spatial-engine.js)
    if (this.nodes.spatial) {
      this.nodes.spatial.tick(now, elapsed, isBg);
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
      if (this.nodes.spatial) this.nodes.spatial.update(key, val);
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
