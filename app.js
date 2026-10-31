/**
 * AETHER // Interactive Controller, Presets, Auto-Journey & Multi-Mode Canvas Visualizer
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = new window.ConsciousnessAudioEngine();

  // DOM References
  const powerBtn = document.getElementById('powerBtn');
  const powerBtnText = document.getElementById('powerBtnText');
  const statusOrb = document.getElementById('statusOrb');

  const telemetryState = document.getElementById('telemetryState');
  const telemetrySurprise = document.getElementById('telemetrySurprise');
  const telemetryPAC = document.getElementById('telemetryPAC');
  const telemetryBreath = document.getElementById('telemetryBreath');

  const hudLeft = document.getElementById('hudLeft');
  const hudRight = document.getElementById('hudRight');

  const mechTitle = document.getElementById('mechTitle');
  const mechText = document.getElementById('mechText');

  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const restoreConfigBtn = document.getElementById('restoreConfigBtn');
  const CUSTOM_CONFIG_STORAGE_KEY = 'aether_custom_config_v1';

  const canvas = document.getElementById('neuroCanvas');
  const ctx2d = canvas.getContext('2d');

  let activeVizMode = 'spatial'; // 'spatial' | 'pac' | 'chaos'

  // Phenomenological Presets Definition
  const PRESETS = {
    egoDissolution: {
      name: 'NON-DUAL SPATIAL',
      mechTitle: 'Neuro-Mechanism: Proprioceptive & Parietal De-Anchoring',
      mechText:
        'Consciousness anchors the "observer" at the center of a 3D auditory map. By guiding deep harmonic sources along a Figure-8 (∞) trajectory that passes directly through the center of the skull and out into 3D space, the parietal cortex relaxes its rigid inside/outside ego boundary.',
      reverbMix: 0.45,
      spatial: {
        enabled: true,
        trajectory: 'infinity',
        count: 2,
        baseFreq: 72,
        gain: 0.82,
        speed: 0.18,
        pulse: 0.0,
        collapse: 0.0,
        asymmetry: 0.88,
        tuning: 'octaves'
      },
      chaos: { enabled: true, gain: 0.25, r: 3.68, rate: 2.0, morph: 0.75 },
      pac: { enabled: true, gain: 0.40, theta: 5.5, gamma: 40, depth: 0.65, breath: 0.70 },
      fractal: { enabled: false, gain: 0.30, speed: 0.04, depth: 0.60, center: 220 },
      sub: { enabled: true, gain: 0.42, freq: 34.0, pulse: 1.4, warmth: 0.40 },
      ganzfeld: { enabled: true, gain: 0.24, color: 0.65, sweep: 0.60 }
    },
    dmnQuieting: {
      name: 'DMN SUPPRESSION',
      mechTitle: 'Neuro-Mechanism: Bayesian Surprise & Default Mode Network Quieting',
      mechText:
        'The Default Mode Network (DMN) sustains narrative self-talk when sensory input is either static (boredom) or periodic. Operating at Logistic Map r = 3.76 ("Edge of Chaos"), microtonal formant droplets maximize non-repeating Bayesian surprise without triggering startle, suspending autobiographical rumination.',
      reverbMix: 0.58,
      spatial: {
        enabled: true,
        trajectory: 'mixed',
        count: 3,
        baseFreq: 85,
        gain: 0.50,
        speed: 0.14,
        pulse: 0.0,
        collapse: 0.0,
        asymmetry: 0.75,
        tuning: 'quartal'
      },
      chaos: { enabled: true, gain: 0.75, r: 3.76, rate: 4.8, morph: 0.85 },
      pac: { enabled: true, gain: 0.40, theta: 7.8, gamma: 42, depth: 0.55, breath: 0.50 },
      fractal: { enabled: false, gain: 0.25, speed: 0.03, depth: 0.50, center: 220 },
      sub: { enabled: false, gain: 0.30, freq: 36.0, pulse: 1.5, warmth: 0.35 },
      ganzfeld: { enabled: true, gain: 0.42, color: 0.52, sweep: 0.72 }
    },
    lucidHypnagogia: {
      name: 'LUCID θ–γ PAC',
      mechTitle: 'Neuro-Mechanism: Thalamocortical Theta-Gamma Phase-Amplitude Coupling',
      mechText:
        'In deep meditative and lucid dream states, high-frequency 40 Hz Gamma bursts (conscious lucidity & sensory binding) are nested directly on the peaks of slow 6 Hz Theta oscillations, carried by a 0.1 Hz vagal breath wave. This prevents falling into unconscious sleep while entering deep trance.',
      reverbMix: 0.62,
      spatial: {
        enabled: true,
        trajectory: 'circle',
        count: 2,
        baseFreq: 64,
        gain: 0.55,
        speed: 0.12,
        pulse: 0.0,
        collapse: 0.0,
        asymmetry: 0.65,
        tuning: 'just'
      },
      chaos: { enabled: false, gain: 0.25, r: 3.62, rate: 1.8, morph: 0.50 },
      pac: { enabled: true, gain: 0.82, theta: 6.0, gamma: 40, depth: 0.92, breath: 0.80 },
      fractal: { enabled: false, gain: 0.30, speed: 0.04, depth: 0.50, center: 216 },
      sub: { enabled: true, gain: 0.52, freq: 32.0, pulse: 1.5, warmth: 0.50 },
      ganzfeld: { enabled: true, gain: 0.25, color: 0.70, sweep: 0.45 }
    },
    timelessFractal: {
      name: 'FRACTAL HORIZON',
      mechTitle: 'Neuro-Mechanism: Scale-Invariant 1/f Dynamics & Shepard-Risset Paradox',
      mechText:
        'Combines an 8-octave Shepard-Risset continuous glissando with a multi-scale Weierstrass fractal modulator. Because the acoustic trajectory ascends forever without ever getting higher and exhibits self-similarity across time scales, the brain’s linear time-keeping loop is suspended.',
      reverbMix: 0.75,
      spatial: {
        enabled: true,
        trajectory: 'radial',
        count: 3,
        baseFreq: 96,
        gain: 0.55,
        speed: 0.15,
        pulse: 0.0,
        collapse: 0.0,
        asymmetry: 0.85,
        tuning: 'overtone'
      },
      chaos: { enabled: true, gain: 0.35, r: 3.69, rate: 2.4, morph: 0.60 },
      pac: { enabled: false, gain: 0.40, theta: 6.5, gamma: 40, depth: 0.60, breath: 0.65 },
      fractal: { enabled: true, gain: 0.72, speed: 0.07, depth: 0.85, center: 216 },
      sub: { enabled: true, gain: 0.42, freq: 36.0, pulse: 0.8, warmth: 0.45 },
      ganzfeld: { enabled: true, gain: 0.22, color: 0.58, sweep: 0.50 }
    },
    somaticVagal: {
      name: 'SOMATIC INFRASOUND',
      mechTitle: 'Neuro-Mechanism: Vestibular Otolith & Vagal Sub-Bass Entrainment',
      mechText:
        'Pairs a 30 Hz sub-bass carrier with 2nd/3rd harmonic "missing-fundamental" psychoacoustic warmth and a 1.65 Hz (~100 BPM) trance meter pulse. Stimulates vestibular pathways and vagal afferent fibers to induce grounded somatic awe and temporal absorption.',
      reverbMix: 0.48,
      spatial: {
        enabled: true,
        trajectory: 'spiral',
        count: 2,
        baseFreq: 48,
        gain: 0.65,
        speed: 0.10,
        pulse: 0.0,
        collapse: 0.0,
        asymmetry: 0.70,
        tuning: 'octaves'
      },
      chaos: { enabled: false, gain: 0.20, r: 3.60, rate: 1.5, morph: 0.40 },
      pac: { enabled: true, gain: 0.55, theta: 4.5, gamma: 36, depth: 0.70, breath: 0.85 },
      fractal: { enabled: false, gain: 0.20, speed: -0.04, depth: 0.40, center: 144 },
      sub: { enabled: true, gain: 0.82, freq: 30.0, pulse: 1.65, warmth: 0.68 },
      ganzfeld: { enabled: true, gain: 0.35, color: 0.82, sweep: 0.65 }
    },
    auditoryGanzfeld: {
      name: 'GANZFELD SONIC VOID',
      mechTitle: 'Neuro-Mechanism: Stochastic Resonance & Sensory Deprivation Horizon',
      mechText:
        'Binaurally decorrelated 1/f Pink and 1/f² Brown noise sculpted by dual resonant cavern filters deprives the auditory cortex of directional anchors. Through stochastic resonance, uniform broadband energy lowers the detection threshold for subtle internal neural imagery.',
      reverbMix: 0.80,
      spatial: {
        enabled: true,
        trajectory: 'radial',
        count: 2,
        baseFreq: 60,
        gain: 0.45,
        speed: 0.08,
        pulse: 0.0,
        collapse: 0.0,
        asymmetry: 0.80,
        tuning: 'quartal'
      },
      chaos: { enabled: true, gain: 0.28, r: 3.71, rate: 1.6, morph: 0.80 },
      pac: { enabled: true, gain: 0.48, theta: 5.0, gamma: 40, depth: 0.65, breath: 0.75 },
      fractal: { enabled: true, gain: 0.38, speed: -0.03, depth: 0.70, center: 180 },
      sub: { enabled: true, gain: 0.45, freq: 28.0, pulse: 0.9, warmth: 0.35 },
      ganzfeld: { enabled: true, gain: 0.78, color: 0.68, sweep: 0.85 }
    }
  };

  const presetKeys = Object.keys(PRESETS);

  // Mobile Screen Wake Lock & Background Audio Keep-Alive
  let wakeLock = null;
  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (err) {
        // Silently continue if wake lock is denied or unsupported
      }
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  // Persistent HTML5 Audio for Android Audio Focus & Lock Screen Media Session
  const bgAudio = document.getElementById('bgAudioKeepAlive');

  // Web Worker Ticker: guarantees continuous simulation ticks even with screen locked!
  let bgWorker = null;
  try {
    const workerBlob = new Blob([`
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!timer) {
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 30);
          }
        } else if (e.data === 'stop') {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
      };
    `], { type: 'application/javascript' });
    bgWorker = new Worker(URL.createObjectURL(workerBlob));
    bgWorker.onmessage = function() {
      if (document.hidden && engine.isRunning) {
        engine.tick();
      }
    };
  } catch (err) {
    console.warn('Web Worker ticker unsupported:', err);
  }

  function startBackgroundAudioSession() {
    // 1. Play real HTML5 audio element synchronously to claim Android Audio Focus
    if (bgAudio) {
      bgAudio.currentTime = 0;
      bgAudio.play().catch((err) => {
        console.warn('HTML5 background audio play:', err);
      });
    }

    // 2. Start Web Worker ticker for lock-screen continuous simulation
    if (bgWorker) {
      bgWorker.postMessage('start');
    }

    // 3. Register native Android Media Session
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'AETHER Consciousness Lab',
          artist: 'Remi Lab',
          album: 'Neurophenomenology Soundscapes'
        });
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', async () => {
          if (!engine.isRunning) {
            await toggleAudio();
          } else if (engine.ctx && engine.ctx.state === 'suspended') {
            await engine.ctx.resume().catch(() => {});
          }
          if (bgAudio) bgAudio.play().catch(() => {});
          if (bgWorker) bgWorker.postMessage('start');
          navigator.mediaSession.playbackState = 'playing';
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          if (engine.isRunning) {
            toggleAudio();
          }
          if (bgAudio) bgAudio.pause();
          if (bgWorker) bgWorker.postMessage('stop');
          navigator.mediaSession.playbackState = 'paused';
        });
      } catch (_) {}
    }
  }

  function stopBackgroundAudioSession() {
    try {
      if (bgAudio) {
        bgAudio.pause();
      }
      if (bgWorker) {
        bgWorker.postMessage('stop');
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    } catch (_) {}
  }

  // Toggle Audio Engine Power
  async function toggleAudio() {
    if (!engine.isRunning) {
      // Must be called synchronously inside user gesture before any await
      startBackgroundAudioSession();
      await engine.start();
      await acquireWakeLock();
      powerBtn.classList.add('active');
      powerBtn.setAttribute('aria-pressed', 'true');
      powerBtnText.textContent = 'ENGINE ACTIVE (MUTE)';
      statusOrb.classList.add('live');
      updateTargetStateBadge();
    } else {
      engine.stop();
      releaseWakeLock();
      stopBackgroundAudioSession();
      powerBtn.classList.remove('active');
      powerBtn.setAttribute('aria-pressed', 'false');
      powerBtnText.textContent = 'RESUME AUDIO ENGINE';
      statusOrb.classList.remove('live');
      telemetryState.textContent = 'PAUSED';
    }
  }

  powerBtn.addEventListener('click', toggleAudio);

  // Background fallback interval when Android locks screen or switches tabs
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      if (engine.isRunning) {
        if (bgAudio && bgAudio.paused) {
          bgAudio.play().catch(() => {});
        }
        if (bgWorker) {
          bgWorker.postMessage('start');
        }
      }
    } else {
      if (engine.isRunning) {
        if (engine.ctx && engine.ctx.state === 'suspended') {
          await engine.ctx.resume().catch(() => {});
        }
        await acquireWakeLock();
      }
    }
  });

  // Mobile AudioContext auto-unlock on user touch
  document.addEventListener('touchstart', () => {
    if (engine.isRunning && engine.ctx && engine.ctx.state === 'suspended') {
      engine.ctx.resume().catch(() => {});
    }
  }, { passive: true });

  // Master & Reverb Controls
  const masterGainInput = document.getElementById('masterGain');
  const masterGainVal = document.getElementById('masterGainVal');
  masterGainInput.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    masterGainVal.textContent = `${Math.round(v * 100)}%`;
    engine.setMasterGain(v);
  });

  const reverbMixInput = document.getElementById('reverbMix');
  const reverbMixVal = document.getElementById('reverbMixVal');
  reverbMixInput.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    reverbMixVal.textContent = `${Math.round(v * 100)}%`;
    engine.setReverbMix(v);
  });

  // Helper to bind slider & toggle controls
  function bindSlider(id, mod, key, formatter) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(`${id}Val`);
    if (!el) return;
    el.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (valEl) valEl.textContent = formatter(v);
      engine.updateModule(mod, key, v);
      updateTargetStateBadge();
    });
  }

  function bindToggle(id, mod) {
    const el = document.getElementById(id);
    const card = document.querySelector(`.module-card[data-module="${mod}"]`);
    if (!el) return;
    el.addEventListener('change', (e) => {
      const checked = e.target.checked;
      engine.updateModule(mod, 'enabled', checked);
      if (card) {
        card.classList.toggle('active-module', checked);
      }
      updateTargetStateBadge();
    });
  }

  // Bind Module 1: Spatial
  bindToggle('spatialEnabled', 'spatial');

  const spatialTrajectoryEl = document.getElementById('spatialTrajectory');
  if (spatialTrajectoryEl) {
    spatialTrajectoryEl.addEventListener('change', (e) => {
      engine.updateModule('spatial', 'trajectory', e.target.value);
    });
  }

  bindSlider('spatialCount', 'spatial', 'count', (v) => `${Math.round(v)} ${Math.round(v) === 1 ? 'Source' : 'Sources'}`);
  bindSlider('spatialBaseFreq', 'spatial', 'baseFreq', (v) => {
    const tag = v < 65 ? 'Sub' : v < 130 ? 'Low' : 'Mid';
    return `${Math.round(v)} Hz (${tag})`;
  });
  bindSlider('spatialGain', 'spatial', 'gain', (v) => `${Math.round(v * 100)}%`);
  bindSlider('spatialSpeed', 'spatial', 'speed', (v) => `${v.toFixed(2)} Hz`);
  bindSlider('spatialPulse', 'spatial', 'pulse', (v) => (v <= 0.01 ? '0% (Smooth)' : `${Math.round(v * 100)}%`));
  bindSlider('spatialCollapse', 'spatial', 'collapse', (v) => `${Math.round(v * 100)}%`);
  bindSlider('spatialAsymmetry', 'spatial', 'asymmetry', (v) => `${Math.round(v * 100)}%`);
  document.getElementById('spatialTuning').addEventListener('change', (e) => {
    engine.updateModule('spatial', 'tuning', e.target.value);
  });

  // ==========================================
  // UNIFIED SOLO ENGINE (All 6 Modules)
  // ==========================================
  const ALL_MODULE_KEYS = ['spatial', 'chaos', 'pac', 'fractal', 'sub', 'ganzfeld'];
  let currentSoloMod = null;
  let savedSoloState = null;

  const soloButtons = {
    spatial: { btn: document.getElementById('soloSpatialBtn'), label: '3D', tab: 'spatial' },
    chaos: { btn: document.getElementById('soloChaosBtn'), label: 'CHAOS', tab: 'chaos' },
    pac: { btn: document.getElementById('soloPacBtn'), label: 'PAC', tab: 'pac' },
    fractal: { btn: document.getElementById('soloFractalBtn'), label: 'FRACTAL', tab: 'chaos' },
    sub: { btn: document.getElementById('soloSubBtn'), label: 'SUB', tab: 'chaos' },
    ganzfeld: { btn: document.getElementById('soloGanzfeldBtn'), label: 'GANZFELD', tab: 'chaos' }
  };

  function setModuleActiveUIAndEngine(mod, enabled) {
    const toggle = document.getElementById(`${mod}Enabled`);
    const card = document.querySelector(`.module-card[data-module="${mod}"]`);
    if (toggle) toggle.checked = enabled;
    if (card) card.classList.toggle('active-module', enabled);
    engine.updateModule(mod, 'enabled', enabled);
  }

  function resetAllSoloButtonsUI() {
    Object.entries(soloButtons).forEach(([m, s]) => {
      if (s.btn) {
        s.btn.classList.remove('active');
        s.btn.textContent = `SOLO ${s.label}`;
      }
    });
    currentSoloMod = null;
    savedSoloState = null;
  }

  function toggleSolo(mod) {
    const s = soloButtons[mod];
    if (!s || !s.btn) return;

    if (currentSoloMod === mod) {
      // Unsolo: Restore previous state
      ALL_MODULE_KEYS.forEach((m) => {
        const restoreVal = savedSoloState ? (savedSoloState[m] ?? true) : true;
        setModuleActiveUIAndEngine(m, restoreVal);
      });
      resetAllSoloButtonsUI();
    } else {
      // Soloing a module: if another module was already soloed, keep the original pre-solo snapshot
      if (!savedSoloState) {
        savedSoloState = {};
        ALL_MODULE_KEYS.forEach((m) => {
          savedSoloState[m] = !!engine.params[m]?.enabled;
        });
      }

      // Mute all other modules, enable target module
      ALL_MODULE_KEYS.forEach((m) => {
        setModuleActiveUIAndEngine(m, m === mod);
      });

      // Update button labels & active classes
      Object.entries(soloButtons).forEach(([m, info]) => {
        if (!info.btn) return;
        if (m === mod) {
          info.btn.classList.add('active');
          info.btn.textContent = `UNSOLO ${info.label}`;
        } else {
          info.btn.classList.remove('active');
          info.btn.textContent = `SOLO ${info.label}`;
        }
      });

      // Switch visualizer tab if defined
      if (s.tab) {
        const tabEl = document.querySelector(`.viz-tab[data-viz="${s.tab}"]`);
        if (tabEl) tabEl.click();
      }

      currentSoloMod = mod;
    }
    updateTargetStateBadge();
  }

  // Bind click handlers for all 6 SOLO buttons
  Object.keys(soloButtons).forEach((mod) => {
    const btn = soloButtons[mod].btn;
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSolo(mod);
      });
    }
  });

  // Interactive 3D Canvas Drag-to-Localize (Grab & move 3D sound source around head)
  let isDraggingSpatial = false;
  function updateManual3DFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 (Left) .. +1 (Right)
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 (Front/Top) .. +1 (Back/Bottom)
    const x = nx * 1.45;
    const z = ny * 1.45; // -Z is Front (top of radar), +Z is Behind Head (bottom of radar)
    const dist = Math.sqrt(x * x + z * z);
    const y = Math.cos(dist * Math.PI * 0.7) * 0.65;
    engine.updateModule('spatial', 'manualPos', { x, y, z });
    hudLeft.textContent = `3D Drag: X:${x.toFixed(2)}m Z:${z < 0 ? 'Front' : 'Back'}(${z.toFixed(2)}m)`;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (activeVizMode !== 'spatial') return;
    isDraggingSpatial = true;
    canvas.setPointerCapture(e.pointerId);
    updateManual3DFromEvent(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDraggingSpatial) return;
    updateManual3DFromEvent(e);
  });

  const endSpatialDrag = () => {
    if (!isDraggingSpatial) return;
    isDraggingSpatial = false;
    engine.updateModule('spatial', 'manualPos', null);
    hudLeft.textContent = 'HRTF 3D: Drag canvas to grab source';
  };
  canvas.addEventListener('pointerup', endSpatialDrag);
  canvas.addEventListener('pointercancel', endSpatialDrag);

  // Bind Module 2: Chaos
  bindToggle('chaosEnabled', 'chaos');

  const chaosPaletteEl = document.getElementById('chaosPalette');
  if (chaosPaletteEl) {
    chaosPaletteEl.addEventListener('change', (e) => {
      engine.updateModule('chaos', 'palette', e.target.value);
    });
  }

  const chaosRhythmEl = document.getElementById('chaosRhythm');
  if (chaosRhythmEl) {
    chaosRhythmEl.addEventListener('change', (e) => {
      engine.updateModule('chaos', 'rhythm', e.target.value);
    });
  }

  const chaosScaleEl = document.getElementById('chaosScale');
  if (chaosScaleEl) {
    chaosScaleEl.addEventListener('change', (e) => {
      engine.updateModule('chaos', 'scale', e.target.value);
    });
  }

  bindSlider('chaosGain', 'chaos', 'gain', (v) => `${Math.round(v * 100)}%`);
  bindSlider('chaosR', 'chaos', 'r', (v) => {
    const label = v < 3.45 ? 'Periodic' : v < 3.83 ? 'Edge' : 'Chaotic';
    return `${v.toFixed(2)} (${label})`;
  });
  bindSlider('chaosRate', 'chaos', 'rate', (v) => `${v.toFixed(1)} /s`);
  bindSlider('chaosRegister', 'chaos', 'register', (v) => {
    const label = v < 0.28 ? 'Sub/Low' : v < 0.68 ? 'Wide' : 'High';
    return `${Math.round(v * 100)}% (${label})`;
  });
  bindSlider('chaosMorph', 'chaos', 'morph', (v) => `${Math.round(v * 100)}%`);

  // Bind Module 3: PAC
  bindToggle('pacEnabled', 'pac');
  bindSlider('pacGain', 'pac', 'gain', (v) => `${Math.round(v * 100)}%`);
  bindSlider('pacBaseFreq', 'pac', 'baseFreq', (v) => {
    const tag = v < 65 ? 'Sub-Bass' : v < 115 ? 'Deep Bass' : v < 185 ? 'Low-Mid' : 'Mid';
    return `${Math.round(v)} Hz (${tag})`;
  });
  bindSlider('pacTheta', 'pac', 'theta', (v) => {
    const band = v < 4 ? 'Delta' : v < 8 ? 'Theta' : 'Alpha';
    return `${v.toFixed(1)} Hz (${band})`;
  });
  bindSlider('pacGamma', 'pac', 'gamma', (v) => `${Math.round(v)} Hz`);
  bindSlider('pacDepth', 'pac', 'depth', (v) => `${Math.round(v * 100)}%`);
  bindSlider('pacBreath', 'pac', 'breath', (v) => `${Math.round(v * 100)}%`);

  // Bind Module 4: Fractal
  bindToggle('fractalEnabled', 'fractal');
  bindSlider('fractalGain', 'fractal', 'gain', (v) => `${Math.round(v * 100)}%`);
  bindSlider('fractalSpeed', 'fractal', 'speed', (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} oct/s`);
  bindSlider('fractalDepth', 'fractal', 'depth', (v) => `${Math.round(v * 100)}%`);
  bindSlider('fractalCenter', 'fractal', 'center', (v) => `${Math.round(v)} Hz`);

  // Bind Module 5: Sub-Bass
  bindToggle('subEnabled', 'sub');
  bindSlider('subGain', 'sub', 'gain', (v) => `${Math.round(v * 100)}%`);
  bindSlider('subFreq', 'sub', 'freq', (v) => `${v.toFixed(1)} Hz`);
  bindSlider('subPulse', 'sub', 'pulse', (v) => `${v.toFixed(1)} Hz`);
  bindSlider('subWarmth', 'sub', 'warmth', (v) => `${Math.round(v * 100)}%`);

  // Bind Module 6: Ganzfeld
  bindToggle('ganzfeldEnabled', 'ganzfeld');
  bindSlider('ganzfeldGain', 'ganzfeld', 'gain', (v) => `${Math.round(v * 100)}%`);
  bindSlider('ganzfeldColor', 'ganzfeld', 'color', (v) => `${Math.round(v * 100)}% Brown`);
  bindSlider('ganzfeldSweep', 'ganzfeld', 'sweep', (v) => `${Math.round(v * 100)}%`);

  // Apply Preset or Saved Custom Configuration Object
  function applyConfigObject(p, startIfStopped = true) {
    if (!p) return;

    if (p.mechTitle) mechTitle.textContent = p.mechTitle;
    if (p.mechText) mechText.textContent = p.mechText;
    if (p.name) telemetryState.textContent = p.name;

    if (p.masterGain !== undefined) {
      masterGainInput.value = p.masterGain;
      masterGainVal.textContent = `${Math.round(p.masterGain * 100)}%`;
      engine.setMasterGain(p.masterGain);
    }

    if (p.reverbMix !== undefined) {
      reverbMixInput.value = p.reverbMix;
      reverbMixVal.textContent = `${Math.round(p.reverbMix * 100)}%`;
      engine.setReverbMix(p.reverbMix);
    }

    // Sync UI & Engine for each module
    const syncControl = (id, val, text) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(`${id}Val`);
      if (el) el.value = val;
      if (valEl && text !== undefined) valEl.textContent = text;
    };

    const syncToggle = (id, mod, enabled) => {
      const el = document.getElementById(id);
      const card = document.querySelector(`.module-card[data-module="${mod}"]`);
      if (el) el.checked = enabled;
      if (card) card.classList.toggle('active-module', enabled);
      engine.updateModule(mod, 'enabled', enabled);
    };

    // Reset Solo buttons state when loading a full config
    resetAllSoloButtonsUI();

    // 1. Spatial
    if (p.spatial) {
      syncToggle('spatialEnabled', 'spatial', p.spatial.enabled);
      if (document.getElementById('spatialTrajectory') && p.spatial.trajectory) {
        document.getElementById('spatialTrajectory').value = p.spatial.trajectory;
      }
      if (p.spatial.count !== undefined) {
        syncControl('spatialCount', p.spatial.count, `${p.spatial.count} ${p.spatial.count === 1 ? 'Source' : 'Sources'}`);
      }
      if (p.spatial.baseFreq !== undefined) {
        const tag = p.spatial.baseFreq < 65 ? 'Sub' : p.spatial.baseFreq < 130 ? 'Low' : 'Mid';
        syncControl('spatialBaseFreq', p.spatial.baseFreq, `${Math.round(p.spatial.baseFreq)} Hz (${tag})`);
      }
      syncControl('spatialGain', p.spatial.gain, `${Math.round(p.spatial.gain * 100)}%`);
      syncControl('spatialSpeed', p.spatial.speed, `${p.spatial.speed.toFixed(2)} Hz`);
      if (p.spatial.pulse !== undefined) {
        syncControl('spatialPulse', p.spatial.pulse, p.spatial.pulse <= 0.01 ? '0% (Smooth)' : `${Math.round(p.spatial.pulse * 100)}%`);
      }
      syncControl('spatialCollapse', p.spatial.collapse, `${Math.round(p.spatial.collapse * 100)}%`);
      syncControl('spatialAsymmetry', p.spatial.asymmetry, `${Math.round(p.spatial.asymmetry * 100)}%`);
      if (p.spatial.tuning) {
        document.getElementById('spatialTuning').value = p.spatial.tuning;
      }
      Object.entries(p.spatial).forEach(([k, v]) => {
        if (k !== 'manualPos') engine.updateModule('spatial', k, v);
      });
    }

    // 2. Chaos
    if (p.chaos) {
      syncToggle('chaosEnabled', 'chaos', p.chaos.enabled);
      if (document.getElementById('chaosPalette') && p.chaos.palette) {
        document.getElementById('chaosPalette').value = p.chaos.palette;
      }
      if (document.getElementById('chaosRhythm') && p.chaos.rhythm) {
        document.getElementById('chaosRhythm').value = p.chaos.rhythm;
      }
      if (document.getElementById('chaosScale') && p.chaos.scale) {
        document.getElementById('chaosScale').value = p.chaos.scale;
      }
      syncControl('chaosGain', p.chaos.gain, `${Math.round(p.chaos.gain * 100)}%`);
      const rLabel = p.chaos.r < 3.45 ? 'Periodic' : p.chaos.r < 3.83 ? 'Edge' : 'Chaotic';
      syncControl('chaosR', p.chaos.r, `${p.chaos.r.toFixed(2)} (${rLabel})`);
      syncControl('chaosRate', p.chaos.rate, `${p.chaos.rate.toFixed(1)} /s`);
      if (p.chaos.register !== undefined) {
        const regLabel = p.chaos.register < 0.28 ? 'Sub/Low' : p.chaos.register < 0.68 ? 'Wide' : 'High';
        syncControl('chaosRegister', p.chaos.register, `${Math.round(p.chaos.register * 100)}% (${regLabel})`);
      }
      syncControl('chaosMorph', p.chaos.morph, `${Math.round(p.chaos.morph * 100)}%`);
      Object.entries(p.chaos).forEach(([k, v]) => engine.updateModule('chaos', k, v));
    }

    // 3. PAC
    if (p.pac) {
      syncToggle('pacEnabled', 'pac', p.pac.enabled);
      const band = p.pac.theta < 4 ? 'Delta' : p.pac.theta < 8 ? 'Theta' : 'Alpha';
      syncControl('pacGain', p.pac.gain, `${Math.round(p.pac.gain * 100)}%`);
      if (p.pac.baseFreq !== undefined) {
        const bTag = p.pac.baseFreq < 90 ? 'Sub' : p.pac.baseFreq < 180 ? 'Low' : 'Mid';
        syncControl('pacBaseFreq', p.pac.baseFreq, `${Math.round(p.pac.baseFreq)} Hz (${bTag})`);
      }
      syncControl('pacTheta', p.pac.theta, `${p.pac.theta.toFixed(1)} Hz (${band})`);
      syncControl('pacGamma', p.pac.gamma, `${Math.round(p.pac.gamma)} Hz`);
      syncControl('pacDepth', p.pac.depth, `${Math.round(p.pac.depth * 100)}%`);
      syncControl('pacBreath', p.pac.breath, `${Math.round(p.pac.breath * 100)}%`);
      Object.entries(p.pac).forEach(([k, v]) => engine.updateModule('pac', k, v));
    }

    // 4. Fractal
    if (p.fractal) {
      syncToggle('fractalEnabled', 'fractal', p.fractal.enabled);
      syncControl('fractalGain', p.fractal.gain, `${Math.round(p.fractal.gain * 100)}%`);
      syncControl('fractalSpeed', p.fractal.speed, `${p.fractal.speed >= 0 ? '+' : ''}${p.fractal.speed.toFixed(2)} oct/s`);
      syncControl('fractalDepth', p.fractal.depth, `${Math.round(p.fractal.depth * 100)}%`);
      syncControl('fractalCenter', p.fractal.center, `${Math.round(p.fractal.center)} Hz`);
      Object.entries(p.fractal).forEach(([k, v]) => engine.updateModule('fractal', k, v));
    }

    // 5. Sub
    if (p.sub) {
      syncToggle('subEnabled', 'sub', p.sub.enabled);
      syncControl('subGain', p.sub.gain, `${Math.round(p.sub.gain * 100)}%`);
      syncControl('subFreq', p.sub.freq, `${p.sub.freq.toFixed(1)} Hz`);
      syncControl('subPulse', p.sub.pulse, `${p.sub.pulse.toFixed(1)} Hz`);
      syncControl('subWarmth', p.sub.warmth, `${Math.round(p.sub.warmth * 100)}%`);
      Object.entries(p.sub).forEach(([k, v]) => engine.updateModule('sub', k, v));
    }

    // 6. Ganzfeld
    if (p.ganzfeld) {
      syncToggle('ganzfeldEnabled', 'ganzfeld', p.ganzfeld.enabled);
      syncControl('ganzfeldGain', p.ganzfeld.gain, `${Math.round(p.ganzfeld.gain * 100)}%`);
      syncControl('ganzfeldColor', p.ganzfeld.color, `${Math.round(p.ganzfeld.color * 100)}% Brown`);
      syncControl('ganzfeldSweep', p.ganzfeld.sweep, `${Math.round(p.ganzfeld.sweep * 100)}%`);
      Object.entries(p.ganzfeld).forEach(([k, v]) => engine.updateModule('ganzfeld', k, v));
    }

    if (startIfStopped && !engine.isRunning) {
      toggleAudio();
    }
  }

  function applyPreset(presetKey, startIfStopped = true) {
    const p = PRESETS[presetKey];
    if (!p) return;
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });
    if (restoreConfigBtn) restoreConfigBtn.classList.remove('active');
    applyConfigObject(p, startIfStopped);
  }

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset, true);
    });
  });

  // Save & Restore Custom Hand-Defined Configuration (persisted in localStorage)
  function checkSavedConfigAvailable() {
    try {
      const raw = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
      if (raw && restoreConfigBtn) {
        restoreConfigBtn.disabled = false;
      }
    } catch (_) {
      // Ignore storage access errors
    }
  }
  checkSavedConfigAvailable();

  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const snapshot = {
        name: 'CUSTOM USER CONFIG',
        mechTitle: 'Custom Hand-Tuned Configuration',
        mechText: 'Your personal saved configuration across all 6 psychoacoustic synthesis modules.',
        masterGain: engine.params.masterGain,
        reverbMix: engine.params.reverbMix,
        spatial: { ...engine.params.spatial, manualPos: null },
        chaos: { ...engine.params.chaos },
        pac: { ...engine.params.pac },
        fractal: { ...engine.params.fractal },
        sub: { ...engine.params.sub },
        ganzfeld: { ...engine.params.ganzfeld }
      };
      try {
        localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(snapshot));
      } catch (_) {
        // Fallback in-memory if localStorage is blocked
      }
      window.__savedCustomConfig = snapshot;
      if (restoreConfigBtn) {
        restoreConfigBtn.disabled = false;
      }
      saveConfigBtn.textContent = '✓ Config Saved!';
      setTimeout(() => {
        saveConfigBtn.textContent = '💾 Save Config';
      }, 1600);
    });
  }

  if (restoreConfigBtn) {
    restoreConfigBtn.addEventListener('click', () => {
      let saved = window.__savedCustomConfig || null;
      if (!saved) {
        try {
          const raw = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
          if (raw) saved = JSON.parse(raw);
        } catch (_) {
          saved = null;
        }
      }
      if (!saved) return;

      document.querySelectorAll('.preset-btn').forEach((btn) => btn.classList.remove('active'));
      restoreConfigBtn.classList.add('active');
      applyConfigObject(saved, true);
    });
  }

  function updateTargetStateBadge() {
    if (!engine.isRunning) return;
    const f = engine.params.pac.theta;
    const band = f < 4 ? 'DELTA TRANCE' : f < 8 ? 'THETA-GAMMA PAC' : 'ALPHA FLOW';
    telemetryState.textContent = band;
  }

  // Visualizer Tabs
  document.querySelectorAll('.viz-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.viz-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeVizMode = tab.dataset.viz;

      if (activeVizMode === 'spatial') {
        hudLeft.textContent = 'HRTF Voices: 8 + In-Cranial Core';
        hudRight.textContent = '0.1 Hz Vagal Coherence Guide';
      } else if (activeVizMode === 'pac') {
        hudLeft.textContent = 'Cross-Frequency θ–γ PAC Envelope';
        hudRight.textContent = 'Interaural Binaural Phase Lissajous';
      } else {
        hudLeft.textContent = 'Logistic Chaos & Bayesian Surprise';
        hudRight.textContent = 'Shepard-Risset & FFT Spectrum';
      }
    });
  });

  // Resize Canvas for Retina/HiDPI
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // buffers for real-time audio waveform & spectrum
  const waveBufL = new Float32Array(512);
  const waveBufR = new Float32Array(512);
  const freqBuf = new Uint8Array(512);

  // Main 60 FPS Render & Audio Modulation Loop
  function animate(nowMs) {
    requestAnimationFrame(animate);

    // Step audio engine modulations when foreground is active (bgWorker steps it when screen is locked)
    if (!document.hidden) {
      engine.tick();
    }

    // Update Telemetry Readouts
    telemetrySurprise.textContent = `${engine.telemetry.bayesianSurprise.toFixed(2)} bits`;
    telemetryPAC.textContent = engine.params.pac.enabled ? engine.params.pac.depth.toFixed(2) : '0.00';

    const breathVal = engine.telemetry.breathValue;
    const breathSlope = Math.cos(engine.telemetry.breathPhase);
    telemetryBreath.textContent = breathSlope >= 0 ? 'INHALE ▲' : 'EXHALE ▼';
    telemetryBreath.style.color = breathSlope >= 0 ? '#38bdf8' : '#a78bfa';

    // Render Canvas
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx2d.fillStyle = 'rgba(6, 9, 17, 0.28)';
    ctx2d.fillRect(0, 0, width, height);

    if (activeVizMode === 'spatial') {
      drawSpatialVisualizer(width, height, breathVal, nowMs);
    } else if (activeVizMode === 'pac') {
      drawPACVisualizer(width, height, nowMs);
    } else {
      drawChaosAndFractalVisualizer(width, height, nowMs);
    }
  }

  /**
   * Helper to project 3D (x, y, z) to 2D radar coordinates with smooth compression for far-horizon rays
   */
  function project3DToRadar(x, y, z, cx, cy, scale) {
    const horizDist = Math.sqrt(x * x + z * z);
    // Softly compress distances > 1.8m so 11m far-horizon excursions still fit on screen
    const compressedDist = horizDist <= 1.8
      ? horizDist
      : 1.8 + Math.log1p(horizDist - 1.8) * 0.62;
    const ratio = horizDist > 0.0001 ? compressedDist / horizDist : 1;
    const px = cx + x * ratio * scale;
    const py = cy + z * ratio * scale * 0.88 - y * 14;
    return { px, py, horizDist };
  }

  /**
   * VISUALIZER 1: 3D HRTF Trajectories (Figure-8 ∞, Far-Horizon Ray, Halo) + 0.1 Hz Breath Ring
   */
  function drawSpatialVisualizer(w, h, breathVal, nowMs) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = Math.min(w, h) * 0.21;

    ctx2d.save();

    // Compass Labels for 3D Orientation (Top = Front -Z, Bottom = Behind Head +Z)
    ctx2d.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx2d.font = '10px "JetBrains Mono", monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillText('▲ FRONT OF FACE (-Z // BRIGHT PINNA)', cx, 20);
    ctx2d.fillText('▼ BEHIND NECK (+Z // PINNA SHADOW)', cx, h - 34);
    ctx2d.textAlign = 'left';
    ctx2d.fillText('◀ LEFT EAR', 14, cy + 4);
    ctx2d.textAlign = 'right';
    ctx2d.fillText('RIGHT EAR ▶', w - 14, cy + 4);
    ctx2d.textAlign = 'left';

    // 1. 0.1 Hz Coherent Breathing Guide Ring
    const breathRadius = scale * (0.85 + 0.25 * breathVal);
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, breathRadius, 0, Math.PI * 2);
    ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx2d.lineWidth = 1.8;
    ctx2d.stroke();

    // Outer reference ring
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, scale * 1.45, 0, Math.PI * 2);
    ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx2d.setLineDash([4, 6]);
    ctx2d.stroke();
    ctx2d.setLineDash([]);

    // 2. Listener Cranial Silhouette & Optional In-Cranial Phase-Inverted Core
    const collapse = engine.params.spatial.collapse;
    if (collapse > 0.01) {
      const corePulse = 10 + collapse * 18 + Math.sin(nowMs * 0.008) * 3;
      const coreGrad = ctx2d.createRadialGradient(cx, cy, 1, cx, cy, corePulse * 2.2);
      coreGrad.addColorStop(0, `rgba(167, 139, 250, ${collapse * 0.75})`);
      coreGrad.addColorStop(0.5, `rgba(56, 189, 248, ${collapse * 0.35})`);
      coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx2d.fillStyle = coreGrad;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, corePulse * 2.2, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // Left & Right Ear Cups + Head Outline + Nose Pointer
    ctx2d.strokeStyle = 'rgba(241, 245, 249, 0.55)';
    ctx2d.lineWidth = 1.6;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx2d.stroke();
    // Nose triangle facing UP (-Z)
    ctx2d.beginPath();
    ctx2d.moveTo(cx - 5, cy - 16);
    ctx2d.lineTo(cx, cy - 24);
    ctx2d.lineTo(cx + 5, cy - 16);
    ctx2d.stroke();
    // Ear cups
    ctx2d.fillStyle = 'rgba(56, 189, 248, 0.55)';
    ctx2d.fillRect(cx - 21, cy - 6, 4, 12);
    ctx2d.fillRect(cx + 17, cy - 6, 4, 12);

    // 3. Draw Active 3D HRTF Voices + Geometric Trails
    const activeCount = engine.params.spatial.count || 2;
    const voices = engine.telemetry.spatialVoices.slice(0, activeCount);

    voices.forEach((v) => {
      const energy = v.activeEnergy !== undefined ? v.activeEnergy : 1.0;
      if (energy < 0.01) return;

      const palette = [
        '56, 189, 248',  // Cyan
        '251, 191, 36',  // Amber
        '52, 211, 153',  // Emerald
        '251, 113, 133', // Rose
        '167, 139, 250', // Violet
        '96, 165, 250',  // Sky
        '244, 114, 182', // Pink
        '163, 230, 53'   // Lime
      ];
      const hue = palette[v.index % palette.length];

      // Draw Geometric Trail (shows Figure-8 ∞ through head, Far-Horizon ray, or Circle)
      if (v.trail && v.trail.length > 2) {
        ctx2d.beginPath();
        for (let t = 0; t < v.trail.length; t++) {
          const pt = project3DToRadar(v.trail[t].x, v.trail[t].y, v.trail[t].z, cx, cy, scale);
          if (t === 0) ctx2d.moveTo(pt.px, pt.py);
          else ctx2d.lineTo(pt.px, pt.py);
        }
        ctx2d.strokeStyle = `rgba(${hue}, 0.32)`;
        ctx2d.lineWidth = 2.0;
        ctx2d.stroke();
      }

      const { px, py } = project3DToRadar(v.x, v.y, v.z, cx, cy, scale);
      const dist = v.dist || Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      // Sources shrink slightly when they travel very far out (up to 11m)
      const distScale = 1 / (1 + Math.max(0, dist - 1.2) * 0.14);
      const radius = Math.max(4.5, (8 + energy * 4) * distScale);

      // Connection vector from head center to source
      ctx2d.beginPath();
      ctx2d.moveTo(cx, cy);
      ctx2d.lineTo(px, py);
      ctx2d.strokeStyle = `rgba(${hue}, 0.22)`;
      ctx2d.lineWidth = 1.2;
      ctx2d.stroke();

      // Glowing source orb
      const grad = ctx2d.createRadialGradient(px, py, 1, px, py, radius * 2.6);
      grad.addColorStop(0, `rgba(${hue}, 0.98)`);
      grad.addColorStop(0.45, `rgba(${hue}, 0.42)`);
      grad.addColorStop(1, `rgba(${hue}, 0)`);

      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      ctx2d.arc(px, py, radius * 2.6, 0, Math.PI * 2);
      ctx2d.fill();

      // Label with Source #, Frequency, Distance & Position
      ctx2d.fillStyle = 'rgba(241, 245, 249, 0.92)';
      ctx2d.font = '10px "JetBrains Mono", monospace';
      const locTag = dist < 0.28
        ? 'IN-SKULL'
        : v.z > 0.25
        ? 'BACK'
        : v.z < -0.25
        ? 'FRONT'
        : v.x < 0
        ? 'LEFT'
        : 'RIGHT';
      ctx2d.fillText(
        `S${v.index + 1}: ${Math.round(v.freq)}Hz (${dist.toFixed(1)}m ${locTag})`,
        px + radius + 5,
        py + 3
      );
    });

    ctx2d.restore();
  }

  /**
   * VISUALIZER 2: Theta-Gamma Phase-Amplitude Coupling (PAC) + Binaural Lissajous
   */
  function drawPACVisualizer(w, h, nowMs) {
    const midX = w * 0.54;

    // Left Half: Real-Time Nested Theta-Gamma PAC Wave + 0.1 Hz Breath Swell Envelope
    const baseFreq = engine.params.pac.baseFreq || 136;
    const fTheta = engine.params.pac.theta;
    const fGamma = engine.params.pac.gamma;
    const pacDepth = engine.params.pac.depth;
    const breathDepth = engine.params.pac.breath;
    const breathNorm = 0.5 + 0.5 * engine.telemetry.breathValue;
    const breathAmp = (1.0 - breathDepth * 0.90) + breathDepth * 1.25 * Math.pow(breathNorm, 1.4);
    const tSec = nowMs * 0.001;

    ctx2d.save();
    const plotLeft = 28;
    const plotWidth = midX - 48;
    const cy = h * 0.5;
    const amp = h * 0.27 * Math.min(1.25, Math.max(0.18, breathAmp));

    // Draw 0.1 Hz Breath Swell Halo background bar
    ctx2d.fillStyle = `rgba(56, 189, 248, ${0.03 + 0.10 * breathNorm * breathDepth})`;
    ctx2d.fillRect(plotLeft, cy - amp * 1.05, plotWidth, amp * 2.1);

    ctx2d.beginPath();
    for (let i = 0; i <= plotWidth; i++) {
      const normX = i / plotWidth; // 0.35 seconds window
      const t = tSec + normX * 0.35;
      const thetaWave = Math.cos(t * fTheta * Math.PI * 2);
      const gate = Math.pow(Math.max(0, thetaWave), 2.4);
      const gammaPulse = Math.pow(Math.max(0, (Math.cos(t * fGamma * Math.PI * 2) + 1) * 0.5), 3.2) * 2 - 1;
      const gammaBurst = gammaPulse * gate * pacDepth;

      const y = cy - (thetaWave * 0.52 + gammaBurst * 0.48) * amp;
      if (i === 0) ctx2d.moveTo(plotLeft + i, y);
      else ctx2d.lineTo(plotLeft + i, y);
    }
    ctx2d.strokeStyle = '#fbbf24';
    ctx2d.lineWidth = 2;
    ctx2d.stroke();

    // Draw pure Theta carrier reference
    ctx2d.beginPath();
    for (let i = 0; i <= plotWidth; i++) {
      const normX = i / plotWidth;
      const t = tSec + normX * 0.35;
      const thetaWave = Math.cos(t * fTheta * Math.PI * 2);
      const y = cy - thetaWave * 0.52 * amp;
      if (i === 0) ctx2d.moveTo(plotLeft + i, y);
      else ctx2d.lineTo(plotLeft + i, y);
    }
    ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx2d.lineWidth = 1.5;
    ctx2d.stroke();

    // Telemetry label on PAC plot
    ctx2d.font = '11px "JetBrains Mono", monospace';
    ctx2d.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx2d.fillText(
      `Carrier: ${Math.round(baseFreq)}Hz (±${(fTheta / 2).toFixed(1)}Hz L/R) | γ-Burst: ${Math.round(fGamma)}Hz | PAC Gate: ${Math.round(pacDepth * 100)}% | Breath: ${Math.round(breathAmp * 100)}%`,
      plotLeft,
      h - 14
    );

    // Right Half: Live Stereo Binaural Phase Lissajous (Left vs Right Ear)
    const lissCx = midX + (w - midX) * 0.5;
    const lissCy = h * 0.5;
    const lissRadius = Math.min(w - midX, h) * 0.36;

    ctx2d.beginPath();
    ctx2d.arc(lissCx, lissCy, lissRadius, 0, Math.PI * 2);
    ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx2d.stroke();

    if (engine.analyserL && engine.analyserR && engine.isRunning) {
      engine.analyserL.getFloatTimeDomainData(waveBufL);
      engine.analyserR.getFloatTimeDomainData(waveBufR);

      ctx2d.beginPath();
      for (let i = 0; i < waveBufL.length; i++) {
        const lx = lissCx + waveBufL[i] * lissRadius * 2.2;
        const ry = lissCy + waveBufR[i] * lissRadius * 2.2;
        if (i === 0) ctx2d.moveTo(lx, ry);
        else ctx2d.lineTo(lx, ry);
      }
      ctx2d.strokeStyle = '#38bdf8';
      ctx2d.lineWidth = 1.6;
      ctx2d.stroke();
    }

    ctx2d.restore();
  }

  /**
   * VISUALIZER 3: Edge-of-Chaos Bayesian Surprise Droplets + Shepard-Risset Spectrum
   */
  function drawChaosAndFractalVisualizer(w, h, nowMs) {
    ctx2d.save();

    // 1. Live FFT Spectrum Backdrop
    if (engine.analyserMaster && engine.isRunning) {
      engine.analyserMaster.getByteFrequencyData(freqBuf);
      const barCount = 96;
      const barW = w / barCount;

      ctx2d.beginPath();
      for (let i = 0; i < barCount; i++) {
        const val = freqBuf[i] / 255;
        const bh = val * h * 0.68;
        ctx2d.fillStyle = `rgba(56, 189, 248, ${0.08 + val * 0.25})`;
        ctx2d.fillRect(i * barW, h - bh, barW - 1, bh);
      }
    }

    // 2. Shepard-Risset Rising/Falling Octave Horizon + Multi-Scale Weierstrass Curve
    if (engine.params.fractal.enabled) {
      const fDepth = engine.params.fractal.depth;
      const tSec = nowMs * 0.001;

      // Draw continuous Weierstrass 1/f spectral envelope across the 8-octave horizon
      ctx2d.beginPath();
      for (let px = 0; px <= w; px += 4) {
        const octPos = px / w;
        const bell = 0.5 - 0.5 * Math.cos(octPos * Math.PI * 2);
        const octPhase = octPos * Math.PI * 2;
        const wCurve =
          0.52 * Math.sin(tSec * 0.38 * Math.PI * 2 + octPhase) +
          0.28 * Math.sin(tSec * 1.00 * Math.PI * 2 + octPhase * 2.0 + 1.1) +
          0.15 * Math.sin(tSec * 2.62 * Math.PI * 2 + octPhase * 4.0 + 2.4) +
          0.08 * Math.sin(tSec * 6.85 * Math.PI * 2 + octPhase * 8.0 + 0.7);
        const y = h * (0.82 - bell * 0.52 - fDepth * wCurve * bell * 0.22);
        if (px === 0) ctx2d.moveTo(px, y);
        else ctx2d.lineTo(px, y);
      }
      ctx2d.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx2d.lineWidth = 1.8;
      ctx2d.stroke();

      engine.telemetry.shepardVoices.forEach((sv, idx) => {
        const x = sv.octavePos * w;
        const y = h * (0.82 - Math.min(1.2, sv.amp) * 0.48 - (sv.ripple || 0) * 0.16);
        const r = Math.max(3, 5 + Math.min(1.2, sv.amp) * 9);

        // Primary Shepard Octave Voice
        ctx2d.beginPath();
        ctx2d.arc(x, y, r, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(52, 211, 153, ${0.25 + Math.min(1, sv.amp) * 0.65})`;
        ctx2d.fill();

        // Recursive Self-Similar Harmonic Branch Satellite (visible when fDepth > 0)
        if (fDepth > 0.05) {
          const satAngle = tSec * (1.2 + idx * 0.4) + idx;
          const satDist = r + 6 + fDepth * 14;
          const sx = x + Math.cos(satAngle) * satDist;
          const sy = y + Math.sin(satAngle) * satDist;

          ctx2d.beginPath();
          ctx2d.moveTo(x, y);
          ctx2d.lineTo(sx, sy);
          ctx2d.strokeStyle = `rgba(167, 243, 208, ${fDepth * 0.5})`;
          ctx2d.lineWidth = 1;
          ctx2d.stroke();

          ctx2d.beginPath();
          ctx2d.arc(sx, sy, Math.max(2, r * 0.45 * fDepth), 0, Math.PI * 2);
          ctx2d.fillStyle = `rgba(167, 243, 208, ${0.3 + fDepth * 0.6})`;
          ctx2d.fill();
        }

        ctx2d.font = '10px "JetBrains Mono", monospace';
        ctx2d.fillStyle = 'rgba(167, 243, 208, 0.85)';
        ctx2d.fillText(`${Math.round(sv.freq)}Hz`, x - 14, y - r - 5);
      });
    }

    // 3. Chaos Multi-Archetype Events (Position X = State x_n, Y = Surprise/Pitch, Color = Archetype)
    const archColors = {
      metallic: '251, 191, 36',  // Amber (FM Bell / Singing Bowl)
      liquid: '56, 189, 248',    // Cyan (Liquid Formant / Bio-Call)
      plucked: '52, 211, 153',   // Emerald (Modal Wood / Koto / Glass)
      subglitch: '251, 113, 133',// Rose (Tectonic Sub-Drop / Microclick)
      breath: '167, 139, 250'    // Violet (Reverse Swell / Overtone Chant)
    };
    const archNames = {
      metallic: 'FM-BELL',
      liquid: 'FORMANT',
      plucked: 'MODAL',
      subglitch: 'SUB-DROP',
      breath: 'SWELL'
    };

    const droplets = engine.telemetry.recentDroplets;
    for (let i = 0; i < droplets.length; i++) {
      const d = droplets[i];
      const age = (nowMs - d.birth) / 3600;
      if (age > 1) continue;

      const x = 40 + d.x * (w - 80);
      const y = h * 0.84 - (d.surprise / 6.2) * (h * 0.68);
      const r = (5 + d.surprise * 3.0) * (1 - age * 0.45);
      const alpha = (1 - age) * 0.9;
      const rgb = archColors[d.archetype] || '167, 139, 250';

      ctx2d.beginPath();
      ctx2d.arc(x, y, r, 0, Math.PI * 2);
      ctx2d.fillStyle = `rgba(${rgb}, ${alpha})`;
      ctx2d.fill();

      // Ripple ring
      ctx2d.beginPath();
      ctx2d.arc(x, y, r + age * 32, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${rgb}, ${alpha * 0.45})`;
      ctx2d.lineWidth = 1.2;
      ctx2d.stroke();

      // Show 12-TET Musical Note Name, Archetype & Motif-Mutation indicator on fresh events
      if (age < 0.48) {
        ctx2d.fillStyle = `rgba(241, 245, 249, ${(1 - age * 2.0) * 0.95})`;
        ctx2d.font = '10px "JetBrains Mono", monospace';
        const tag = archNames[d.archetype] || 'CHAOS';
        const noteLabel = d.noteName ? `${d.noteName} (${Math.round(d.freq)}Hz)` : `${Math.round(d.freq)}Hz`;
        const mutFlag = d.mutated ? ' ✦MUT' : '';
        ctx2d.fillText(`${noteLabel} · ${tag}${mutFlag}`, x + r + 5, y + 3);
      }
    }

    ctx2d.restore();
  }

  requestAnimationFrame(animate);
});
