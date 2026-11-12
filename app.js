/**
 * AETHER // UI controller: controls, presets, guided sessions (morphing), background playback, canvas.
 */
document.addEventListener('DOMContentLoaded', () => {
  const engine = new window.ConsciousnessAudioEngine();
  const PRESETS = window.AETHER_PRESETS;
  const JOURNEYS = window.AETHER_JOURNEYS;
  const MODULES = window.ConsciousnessAudioEngine.MODULES;
  const $ = (id) => document.getElementById(id);
  const DEFAULTS = JSON.parse(JSON.stringify(engine.params));
  const STORAGE_KEY = 'aether_custom_config_v6';

  // ------------------------------------------------------------------ control table
  const pct = (v) => `${Math.round(v * 100)}%`;
  const CONTROLS = [
    ['breathRate', 'breath', 'rate', (v) => `${v.toFixed(1)} /min`],
    ['breathInhale', 'breath', 'inhale', (v) => `${Math.round(v * 100)} %`],
    ['breathHoldIn', 'breath', 'holdIn', (v) => `${v.toFixed(1)} s`],
    ['breathHoldOut', 'breath', 'holdOut', (v) => `${v.toFixed(1)} s`],
    ['reverbMix', 'global', 'reverbMix', pct],
    ['spatialCount', 'spatial', 'count', (v) => `${Math.round(v)}`],
    ['spatialGain', 'spatial', 'gain', pct],
    ['spatialDistance', 'spatial', 'distance', (v) => `${v.toFixed(1)} m`],
    ['spatialTurns', 'spatial', 'turns', (v) => v.toFixed(2)],
    ['spatialStageBreaths', 'spatial', 'fountainBreaths', (v) => `${Math.round(v)}`],
    ['spatialSpeed', 'spatial', 'speed', (v) => `${v.toFixed(2)} Hz`],
    ['spatialInnerSwirl', 'spatial', 'innerSwirl', pct],
    ['spatialIntensity', 'spatial', 'intensity', (v) => (v < 0.03 ? 'natural' : `${Math.round(v * 100)}%`)],
    ['spatialRoom', 'spatial', 'room', pct],
    ['spatialCue', 'spatial', 'cue', (v) => v.toFixed(2)],
    ['chaosGain', 'chaos', 'gain', pct],
    ['chaosR', 'chaos', 'r', (v) => `${v.toFixed(2)} (${v < 3.45 ? 'periodic' : v < 3.83 ? 'edge' : 'chaotic'})`],
    ['chaosRate', 'chaos', 'rate', (v) => v.toFixed(1)],
    ['chaosRegister', 'chaos', 'register', pct],
    ['chaosMorph', 'chaos', 'morph', pct],
    ['pacGain', 'pac', 'gain', pct],
    ['pacBaseFreq', 'pac', 'baseFreq', (v) => `${Math.round(v)} Hz`],
    ['pacTheta', 'pac', 'theta', (v) => `${v.toFixed(1)} Hz ${v < 4 ? 'δ' : v < 8 ? 'θ' : v < 13 ? 'α' : 'β'}`],
    ['pacHarmonics', 'pac', 'harmonics', pct],
    ['pacGamma', 'pac', 'gamma', (v) => `${Math.round(v)} Hz`],
    ['pacDepth', 'pac', 'depth', pct],
    ['pacBreath', 'pac', 'breath', pct],
    ['fractalGain', 'fractal', 'gain', pct],
    ['fractalSpeed', 'fractal', 'speed', (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} oct/s`],
    ['fractalDepth', 'fractal', 'depth', pct],
    ['fractalCenter', 'fractal', 'center', (v) => `${Math.round(v)} Hz`],
    ['subGain', 'sub', 'gain', pct],
    ['subFreq', 'sub', 'freq', (v) => `${v.toFixed(1)} Hz`],
    ['subPulse', 'sub', 'pulse', (v) => `${v.toFixed(2)} Hz`],
    ['subWarmth', 'sub', 'warmth', pct],
    ['ganzfeldGain', 'ganzfeld', 'gain', pct],
    ['ganzfeldColor', 'ganzfeld', 'color', pct],
    ['ganzfeldSweep', 'ganzfeld', 'sweep', pct],
    ['asmrGain', 'asmr', 'gain', pct],
    ['asmrProximity', 'asmr', 'proximity', (v) => `${(0.12 + 1.3 * v).toFixed(2)} m`],
    ['asmrRate', 'asmr', 'rate', (v) => v.toFixed(1)],
    ['asmrResonance', 'asmr', 'resonance', pct]
  ];
  const SELECTS = [
    ['spatialTrajectory', 'spatial', 'trajectory'], ['spatialRebalMode', 'spatial', 'rebalMode'],
    ['spatialPalette', 'spatial', 'palette'], ['spatialRenderer', 'spatial', 'renderer'],
    ['chaosPalette', 'chaos', 'palette'], ['chaosRhythm', 'chaos', 'rhythm'], ['chaosScale', 'chaos', 'scale'],
    ['subPattern', 'sub', 'pattern'], ['ganzfeldTexture', 'ganzfeld', 'texture'], ['asmrPalette', 'asmr', 'palette']
  ];

  function setParam(mod, key, v) {
    if (mod === 'breath') { engine.setBreath(key, v); return; }
    if (mod === 'global') { if (key === 'reverbMix') engine.setReverbMix(v); return; }
    if (mod === 'spatial' && key === 'fountainBreaths') engine.updateModule('spatial', 'spiralBreaths', v);
    engine.updateModule(mod, key, v);
  }
  function getParam(mod, key) {
    if (mod === 'breath') return engine.params.breath[key];
    if (mod === 'global') return engine.params[key];
    return engine.params[mod][key];
  }

  CONTROLS.forEach(([id, mod, key, fmt]) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      const out = $(id + 'Val');
      if (out) out.textContent = fmt(v);
      if (MODULES.includes(mod) && !engine.params[mod].enabled && key !== 'gain') setEnabled(mod, true);
      setParam(mod, key, v);
      cancelJourneyOnManual();
    });
  });
  SELECTS.forEach(([id, mod, key]) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('change', () => {
      if (!engine.params[mod].enabled) setEnabled(mod, true);
      setParam(mod, key, el.value);
      if (mod === 'spatial') { updateSpatialVisibility(); updateRendererUI(); }
      cancelJourneyOnManual();
    });
  });
  MODULES.forEach((mod) => {
    const el = $(mod + 'Enabled');
    if (el) el.addEventListener('change', () => { setEnabled(mod, el.checked); cancelJourneyOnManual(); });
  });
  $('chaosSpace3d').addEventListener('change', (e) => engine.updateModule('chaos', 'space3d', e.target.checked));
  $('rootSelect').addEventListener('change', (e) => engine.setRoot(parseFloat(e.target.value)));
  $('masterGain').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    $('masterGainVal').textContent = pct(v);
    engine.setMasterGain(v);
  });

  function setEnabled(mod, on) {
    const el = $(mod + 'Enabled');
    if (el) el.checked = on;
    const card = document.querySelector(`.module-card[data-module="${mod}"]`);
    if (card) card.classList.toggle('active-module', on);
    engine.updateModule(mod, 'enabled', on);
  }

  function syncUI() {
    CONTROLS.forEach(([id, mod, key, fmt]) => {
      const el = $(id);
      const v = getParam(mod, key);
      if (!el || v === undefined || document.activeElement === el) return;
      el.value = v;
      const out = $(id + 'Val');
      if (out) out.textContent = fmt(Number(v));
    });
    SELECTS.forEach(([id, mod, key]) => {
      const el = $(id);
      if (el && engine.params[mod][key] !== undefined) el.value = engine.params[mod][key];
    });
    MODULES.forEach((mod) => {
      const el = $(mod + 'Enabled');
      if (el) el.checked = !!engine.params[mod].enabled;
      const card = document.querySelector(`.module-card[data-module="${mod}"]`);
      if (card) card.classList.toggle('active-module', !!engine.params[mod].enabled);
    });
    $('chaosSpace3d').checked = engine.params.chaos.space3d !== false;
    updateRendererUI();
    $('rootSelect').value = String(engine.params.root);
    $('masterGain').value = engine.params.masterGain;
    $('masterGainVal').textContent = pct(engine.params.masterGain);
    updateSpatialVisibility();
  }

  function earModelName(id) {
    const m = (window.AETHER_HRTF_INDEX || []).find((x) => x.id === id);
    return m ? m.name : id;
  }

  function updateRendererUI() {
    const sel = $('spatialRenderer');
    const opt = sel.querySelector('option[value="measured"]');
    const id = engine.params.spatial.earModel;
    opt.disabled = !id;
    opt.textContent = id ? `Measured ear model: ${earModelName(id)}` : 'Measured ear model (calibrate first)';
    sel.value = engine.params.spatial.renderer;
    if (engine.renderer) {
      const m = engine.renderer.mode;
      $('telemetryRenderer').textContent = m === 'measured' ? `EAR: ${earModelName(engine.renderer.earModel).toUpperCase()}` : m === 'structural' ? 'STRUCTURAL' : 'BROWSER HRTF';
    }
  }

  function applyEarModel(id) {
    engine.params.spatial.earModel = id || engine.params.spatial.earModel;
    if (id) {
      engine.renderer.earModel = id;
      engine.updateModule('spatial', 'earModel', id);
      engine.updateModule('spatial', 'renderer', 'measured');
    } else {
      engine.updateModule('spatial', 'renderer', 'structural');
    }
    syncUI();
  }

  function restoreRenderer(mode) {
    engine.updateModule('spatial', 'renderer', mode === 'measured' && engine.renderer.earModel ? 'measured' : mode);
    if (mode !== 'hrtf') engine.renderer.setMode(engine.params.spatial.renderer);
    syncUI();
  }

  function updateSpatialVisibility() {
    const traj = engine.params.spatial.trajectory;
    const hud = $('hudLeft');
    if (traj === 'manual' && !hud.textContent) hud.textContent = 'Drag on either view to move the source';
    if (traj !== 'manual') hud.textContent = '';
    document.querySelectorAll('.rebal-only').forEach((el) => { el.style.display = traj === 'rebal' ? '' : 'none'; });
    document.querySelectorAll('.free-only').forEach((el) => { el.style.display = ['orbit', 'vertical', 'sphere'].includes(traj) ? '' : 'none'; });
  }

  // ------------------------------------------------------------------ presets & morphing
  function resolveConfig(presetKey, over) {
    const p = PRESETS[presetKey] || {};
    const cfg = { reverbMix: p.reverbMix !== undefined ? p.reverbMix : DEFAULTS.reverbMix, breath: Object.assign({}, DEFAULTS.breath, p.breath || {}) };
    MODULES.forEach((m) => {
      const listed = p[m];
      cfg[m] = Object.assign({}, DEFAULTS[m], listed || {}, { enabled: !!(listed && listed.enabled !== false) });
    });
    if (over) {
      Object.keys(over).forEach((k) => {
        if (typeof over[k] === 'object') cfg[k] = Object.assign({}, cfg[k], over[k]);
        else cfg[k] = over[k];
      });
    }
    cfg.spatial.spiralBreaths = cfg.spatial.fountainBreaths;
    // listening setup chosen by the listener (renderer, ear model, cue strength) is not part of a preset
    ['renderer', 'earModel', 'cue', 'intensity'].forEach((k) => { cfg.spatial[k] = engine.params.spatial[k]; });
    return cfg;
  }

  let morph = null;
  function morphTo(cfg, seconds) {
    if (!engine.ctx) {
      // engine not started yet: just set the parameters
      engine.params.reverbMix = cfg.reverbMix;
      Object.assign(engine.params.breath, cfg.breath);
      MODULES.forEach((m) => Object.assign(engine.params[m], cfg[m]));
      morph = null;
      return;
    }
    const start = JSON.parse(JSON.stringify(engine.params));
    // switch discrete parameters now; enable modules that fade in, at zero gain
    MODULES.forEach((m) => {
      const tgt = cfg[m];
      Object.keys(tgt).forEach((k) => {
        if (k === 'enabled' || k === 'manualPos') return;
        if (typeof tgt[k] !== 'number' && tgt[k] !== engine.params[m][k]) engine.updateModule(m, k, tgt[k]);
      });
      if (tgt.enabled && !engine.params[m].enabled) {
        start[m].gain = 0;
        engine.updateModule(m, 'gain', 0);
        setEnabled(m, true);
      }
    });
    morph = { t0: engine.ctx ? engine.ctx.currentTime : 0, T: Math.max(0.05, seconds), start, cfg, last: -1 };
    if (seconds <= 0.05) stepMorph(true);
  }

  function stepMorph(force) {
    if (!morph || !engine.ctx) return;
    const now = engine.ctx.currentTime;
    if (!force && now - morph.last < 0.1) return;
    morph.last = now;
    const u = Math.min(1, (now - morph.t0) / morph.T);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const L = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a + (b - a) * e : b);
    const { start, cfg } = morph;
    engine.setReverbMix(L(start.reverbMix, cfg.reverbMix));
    Object.keys(cfg.breath).forEach((k) => engine.setBreath(k, L(start.breath[k], cfg.breath[k])));
    MODULES.forEach((m) => {
      const tgt = cfg[m];
      Object.keys(tgt).forEach((k) => {
        if (k === 'enabled' || k === 'manualPos' || typeof tgt[k] !== 'number') return;
        let v;
        if (k === 'gain' && !tgt.enabled) v = start[m].enabled ? L(start[m].gain, 0) : tgt.gain; // fade out only what is playing
        else v = L(start[m][k], tgt[k]);
        if (k === 'count' || k === 'fountainBreaths' || k === 'spiralBreaths') v = Math.round(v);
        if (engine.params[m][k] !== v) engine.updateModule(m, k, v);
      });
    });
    if (u >= 1) {
      MODULES.forEach((m) => {
        if (!cfg[m].enabled) {
          if (engine.params[m].enabled) setEnabled(m, false);
          engine.updateModule(m, 'gain', cfg[m].gain); // keep the preset level for when the module is switched on
        }
      });
      morph = null;
    }
    uiDirty = true;
  }

  function applyPreset(key, fade = 2.5) {
    const p = PRESETS[key];
    if (!p) return;
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('active', b.dataset.preset === key));
    $('mechTitle').textContent = p.mechTitle || '';
    $('mechText').textContent = p.mechText || '';
    $('telemetryState').textContent = p.title.replace(/^\d+\.\s*/, '').toUpperCase();
    morphTo(resolveConfig(key), engine.isRunning ? fade : 0);
    if (!engine.isRunning) { stepMorph(true); syncUI(); }
  }

  const grid = $('presetGrid');
  Object.entries(PRESETS).forEach(([key, p]) => {
    const b = document.createElement('button');
    b.className = 'preset-btn';
    b.dataset.preset = key;
    b.innerHTML = `<span class="preset-title"></span><span class="preset-desc"></span>`;
    b.querySelector('.preset-title').textContent = p.title;
    b.querySelector('.preset-desc').textContent = p.desc;
    b.addEventListener('click', async () => {
      unlockBackgroundAudio();
      cancelJourneyOnManual();
      if (!engine.isRunning) await toggleAudio();
      applyPreset(key);
    });
    grid.appendChild(b);
  });

  // save / restore
  try { if (localStorage.getItem(STORAGE_KEY)) $('restoreConfigBtn').disabled = false; } catch (_) { /* storage blocked */ }
  $('saveConfigBtn').addEventListener('click', () => {
    const snap = JSON.parse(JSON.stringify(engine.params));
    snap.spatial.manualPos = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snap)); } catch (_) { window.__aetherSaved = snap; }
    $('restoreConfigBtn').disabled = false;
    $('saveConfigBtn').textContent = '✓ Saved';
    setTimeout(() => { $('saveConfigBtn').textContent = '💾 Save'; }, 1500);
  });
  $('restoreConfigBtn').addEventListener('click', async () => {
    let snap = window.__aetherSaved || null;
    try { snap = JSON.parse(localStorage.getItem(STORAGE_KEY)) || snap; } catch (_) { /* ignore */ }
    if (!snap) return;
    if (!engine.isRunning) await toggleAudio();
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
    if (snap.root) engine.setRoot(snap.root);
    morphTo({ reverbMix: snap.reverbMix, breath: snap.breath, ...Object.fromEntries(MODULES.map((m) => [m, Object.assign({}, DEFAULTS[m], snap[m])])) }, 1.5);
    $('telemetryState').textContent = 'MY SETTINGS';
  });

  // solo
  let soloState = null;
  let soloMod = null;
  document.querySelectorAll('.btn-solo').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const mod = btn.dataset.solo;
      if (soloMod === mod) {
        MODULES.forEach((m) => setEnabled(m, soloState[m]));
        soloMod = null;
        soloState = null;
      } else {
        if (!soloState) soloState = Object.fromEntries(MODULES.map((m) => [m, !!engine.params[m].enabled]));
        MODULES.forEach((m) => setEnabled(m, m === mod));
        soloMod = mod;
      }
      document.querySelectorAll('.btn-solo').forEach((b) => {
        b.classList.toggle('active', b.dataset.solo === soloMod);
        b.textContent = b.dataset.solo === soloMod ? 'UNSOLO' : 'SOLO';
      });
    });
  });

  // ------------------------------------------------------------------ guided sessions
  let journey = null;
  function startJourney(id) {
    const j = JOURNEYS[id];
    if (!j) return;
    journey = { id, j, t0: engine.ctx.currentTime, idx: -1 };
    $('journeyBtn').textContent = '■ Stop session';
    journeyTick();
  }
  function stopJourney(msg) {
    journey = null;
    $('journeyBtn').textContent = '▶ Start session';
    $('journeyFill').style.width = '0%';
    $('journeyClock').textContent = '';
    if (msg) $('journeyStep').textContent = msg;
  }
  function cancelJourneyOnManual() {
    if (journey) stopJourney('Session stopped: you took over the controls.');
  }
  function journeyTick() {
    if (!journey || !engine.ctx) return;
    const t = engine.ctx.currentTime - journey.t0;
    const steps = journey.j.steps;
    const total = steps[steps.length - 1].at;
    let idx = 0;
    while (idx + 1 < steps.length && steps[idx + 1].at <= t) idx++;
    if (idx !== journey.idx) {
      journey.idx = idx;
      const s = steps[idx];
      $('journeyStep').textContent = s.label;
      if (s.end) {
        engine.setMasterGain(engine.params.masterGain); // keep slider value
        engine.masterGain.gain.setTargetAtTime(0.0001, engine.ctx.currentTime, 6);
        setTimeout(() => { if (engine.isRunning) toggleAudio(); }, 20000);
        stopJourney('Session complete. Take a moment before you get up.');
        return;
      }
      const cfg = resolveConfig(s.preset, s.over);
      $('telemetryState').textContent = journey.j.title.toUpperCase();
      morphTo(cfg, s.fade || 10);
    }
    $('journeyFill').style.width = `${Math.min(100, (t / total) * 100).toFixed(1)}%`;
    const m = Math.floor(t / 60), sec = Math.floor(t % 60);
    $('journeyClock').textContent = `${m}:${String(sec).padStart(2, '0')} / ${Math.round(total / 60)} min`;
  }
  $('journeyBtn').addEventListener('click', async () => {
    unlockBackgroundAudio();
    if (journey) { stopJourney('Session stopped.'); return; }
    if (!engine.isRunning) await toggleAudio();
    startJourney($('journeySelect').value);
  });

  // ------------------------------------------------------------------ audio power, background playback
  let wakeLock = null;
  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) { wakeLock = null; }
    }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  let silentUrl = null;
  function silentWav() {
    if (silentUrl) return silentUrl;
    const sr = 8000, n = sr * 10, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    return silentUrl;
  }
  const bgAudio = $('bgAudioKeepAlive');
  function unlockBackgroundAudio() {
    if (!bgAudio) return;
    if (!bgAudio.src || bgAudio.src.indexOf('blob:') === -1) bgAudio.src = silentWav();
    if (bgAudio.paused) bgAudio.play().then(() => setBg('ACTIVE')).catch(() => setBg('TAP TO ENABLE'));
  }
  function setBg(t) { $('telemetryBgAudio').textContent = t; }
  let worker = null;
  try {
    const src = 'let t=null;onmessage=(e)=>{if(e.data==="start"&&!t)t=setInterval(()=>postMessage(0),50);else if(e.data==="stop"&&t){clearInterval(t);t=null;}};';
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    worker.onmessage = () => { if (document.hidden && engine.isRunning) { engine.tick(); appTick(); } };
  } catch (_) { worker = null; }
  function mediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      const art = new URL('icon-512.png', window.location.href).href;
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'AETHER', artist: 'Breath-paced 3D sound', album: 'Meditation', artwork: [{ src: art, sizes: '512x512', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('play', () => { if (!engine.isRunning) toggleAudio(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (engine.isRunning) toggleAudio(); });
    } catch (_) { /* unsupported */ }
  }

  let earApplied = false;
  async function toggleAudio() {
    if (!engine.isRunning) {
      unlockBackgroundAudio();
      $('powerBtnText').textContent = 'STARTING…';
      await engine.start();
      if (worker) worker.postMessage('start');
      mediaSession();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      await acquireWakeLock();
      $('powerBtn').classList.add('active');
      $('powerBtn').setAttribute('aria-pressed', 'true');
      $('powerBtnText').textContent = 'PLAYING (PAUSE)';
      $('statusOrb').classList.add('live');
      if (!engine.renderer.workletAvailable) {
        $('spatialRenderer').querySelector('option[value="structural"]').disabled = true;
        $('calOpen').disabled = true;
      } else if (!earApplied) {
        earApplied = true;
        // the listener's calibrated choice, otherwise a measured ear model (the HUTUBS listener that represents
        // the largest group of the 93 measured people): measured ears externalise better than the modelled head
        const saved = window.AetherCalibration.loadSaved();
        const fallback = (window.AETHER_HRTF_INDEX || []).find((m) => /^hutubs-/.test(m.id));
        const id = saved ? saved.id : fallback ? fallback.id : null;
        if (id) applyEarModel(id);
      }
      updateRendererUI();
    } else {
      engine.stop();
      releaseWakeLock();
      if (worker) worker.postMessage('stop');
      if (bgAudio) bgAudio.pause();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      setBg('STANDBY');
      $('powerBtn').classList.remove('active');
      $('powerBtn').setAttribute('aria-pressed', 'false');
      $('powerBtnText').textContent = 'RESUME AUDIO';
      $('statusOrb').classList.remove('live');
    }
  }
  $('powerBtn').addEventListener('click', () => { unlockBackgroundAudio(); toggleAudio(); });
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && engine.isRunning) {
      if (engine.ctx.state === 'suspended') await engine.ctx.resume().catch(() => {});
      acquireWakeLock();
    }
  });
  document.addEventListener('touchstart', () => {
    if (engine.isRunning && engine.ctx && engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
  }, { passive: true });

  // ------------------------------------------------------------------ ear-model calibration
  const calibration = window.AetherCalibration.create(engine, {
    setEnabled,
    start: async () => { unlockBackgroundAudio(); if (!engine.isRunning) await toggleAudio(); },
    applyEarModel,
    restoreRenderer
  });
  $('calOpen').addEventListener('click', () => { cancelJourneyOnManual(); calibration.open(); });

  // ------------------------------------------------------------------ canvas
  const canvas = $('neuroCanvas');
  const viz = window.AetherVisualizer.create(canvas, engine);
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
  document.querySelectorAll('.viz-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.viz-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      viz.setMode(tab.dataset.viz);
      $('hudLeft').style.display = tab.dataset.viz === 'spatial' ? '' : 'none';
    });
  });
  $('fullscreenBtn').addEventListener('click', () => {
    const el = $('canvasContainer');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().then(() => setTimeout(resize, 100)).catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 100));

  let dragging = false;
  function dragTo(e) {
    const r = canvas.getBoundingClientRect();
    const pk = viz.pick(e.clientX - r.left, e.clientY - r.top);
    const cur = engine.params.spatial.manualPos || engine.nodes.spatial.lastManual || { x: 0, y: 0, z: -1.6 };
    const pos = pk.view === 'back' ? { x: pk.a, y: pk.b, z: cur.z } : { x: cur.x, y: pk.b, z: -pk.a };
    pos.x = Math.max(-2.5, Math.min(2.5, pos.x));
    pos.y = Math.max(-2.2, Math.min(1.7, pos.y));
    pos.z = Math.max(-2.5, Math.min(2.5, pos.z));
    engine.params.spatial.manualPos = pos;
    const d = Math.hypot(pos.x, pos.y, pos.z);
    const az = Math.round((Math.atan2(pos.x, -pos.z) * 180) / Math.PI);
    const el = Math.round((Math.atan2(pos.y, Math.hypot(pos.x, pos.z)) * 180) / Math.PI);
    $('hudLeft').textContent = `azimuth ${az}° · elevation ${el}° · ${d.toFixed(2)} m`;
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (viz.mode !== 'spatial') return;
    if (engine.params.spatial.trajectory !== 'manual') {
      $('spatialTrajectory').value = 'manual';
      engine.updateModule('spatial', 'trajectory', 'manual');
      updateSpatialVisibility();
    }
    if (!engine.params.spatial.enabled) setEnabled('spatial', true);
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    dragTo(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ------------------------------------------------------------------ main loop
  let uiDirty = false;
  let lastUi = 0;
  function appTick() {
    journeyTick();
    stepMorph(false);
  }
  function animate(nowMs) {
    requestAnimationFrame(animate);
    if (!document.hidden) {
      engine.tick();
      appTick();
    }
    const tel = engine.telemetry;
    if (engine.isRunning && engine.breath) {
      const d = engine.breath.durations();
      const names = { inhale: 'INHALE ▲', holdIn: 'HOLD', exhale: 'EXHALE ▼', holdOut: 'HOLD' };
      $('telemetryBreath').textContent = names[tel.breathStage] || '—';
      $('telemetryBreath').style.color = tel.breathStage === 'inhale' ? '#fbbf24' : tel.breathStage === 'exhale' ? '#a78bfa' : '#94a3b8';
      $('breathFill').style.width = `${Math.round(tel.breathLung * 100)}%`;
      $('telemetryBreathTimes').textContent = `${d.inhale.toFixed(1)} s in · ${d.exhale.toFixed(1)} s out`;
    }
    if (uiDirty && nowMs - lastUi > 250) { syncUI(); uiDirty = false; lastUi = nowMs; }
    viz.draw(nowMs);
  }

  applyPreset('rebalGateway', 0);
  syncUI();
  requestAnimationFrame(animate);
  window.__aether = { engine, applyPreset, resolveConfig, morphTo, startJourney, calibration, applyEarModel };
});
