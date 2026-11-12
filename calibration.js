/**
 * AETHER // Ear-model calibration
 *
 * Front/back and up/down cues come from the outer ears, which differ between people. This panel lets the
 * listener pick, by ear, the ear model that suits them best (tournament selection, as in Iwaya 2006 and
 * Seeber & Fastl 2003), then measures front/back/up/down identification in a blind test.
 *
 *  1. Tournament: 8 candidates (the built-in structural model, MIT KEMAR and 6 HUTUBS listeners chosen to cover
 *     the spread of measured ears), 7 duels. In each duel A and B play noise bursts FRONT -> ABOVE -> BEHIND -> BELOW.
 *  2. Blind test: 16 bursts from FRONT, BEHIND, ABOVE or BELOW in random order, answered by the listener;
 *     optionally repeated with the built-in model for comparison.
 *  3. The choice is saved in the browser and used by every module.
 */
(function (global) {
  'use strict';
  const STORAGE_KEY = 'aether_ear_model_v1';
  const SLOT = 12; // renderer slot used only by the calibration
  const CAL_REVERB = 0.1; // late room reverb during the test (early reflections are kept)
  const DIST = 1.5;
  const POS = {
    front: { az: 0, el: 0, label: 'FRONT' },
    above: { az: 0, el: 70, label: 'ABOVE' },
    behind: { az: 180, el: 0, label: 'BEHIND' },
    below: { az: 0, el: -45, label: 'BELOW' }
  };
  const SEQUENCE = ['front', 'above', 'behind', 'below'];
  const D2R = Math.PI / 180;
  const xyz = (p) => [DIST * Math.cos(p.el * D2R) * Math.sin(p.az * D2R), DIST * Math.sin(p.el * D2R), -DIST * Math.cos(p.el * D2R) * Math.cos(p.az * D2R)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch (_) { return null; }
  }
  function save(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (_) { global.__aetherEarModel = obj; }
  }

  function create(engine, hooks) {
    const $ = (id) => document.getElementById(id);
    const modal = $('calModal');
    const body = $('calBody');
    const index = global.AETHER_HRTF_INDEX || [];
    const candidates = [{ id: null, name: 'Built-in model', source: 'structural model (no measured ears)' }].concat(index);
    let state = null;
    let noiseBuf = null;
    let playing = [];
    let saved = null;

    function noise() {
      if (noiseBuf) return noiseBuf;
      const ctx = engine.ctx;
      const n = Math.floor(ctx.sampleRate * 2);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        lp += 0.02 * (w - lp);
        d[i] = (w - lp) * 0.5; // white noise without the lowest octaves
      }
      return noiseBuf;
    }

    function stopPlayback() {
      playing.forEach((s) => { try { s.stop(); } catch (_) { /* already stopped */ } });
      playing = [];
    }

    /** schedule 3 bursts at each of the given positions; returns the duration in seconds */
    function playPositions(keys) {
      stopPlayback();
      const ctx = engine.ctx;
      const r = engine.renderer;
      r.cancelSlot(SLOT); // pressing B while A plays must not keep A's pending positions
      const input = r.input(SLOT);
      let t = ctx.currentTime + 0.12;
      keys.forEach((k) => {
        const [x, y, z] = xyz(POS[k]);
        r.jumpTo(SLOT, x, y, z, 0, t - 0.05);
        for (let b = 0; b < 3; b++) {
          const src = ctx.createBufferSource();
          src.buffer = noise();
          const g = ctx.createGain();
          const t0 = t + b * 0.22;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.55, t0 + 0.008);
          g.gain.setValueAtTime(0.55, t0 + 0.142);
          g.gain.linearRampToValueAtTime(0, t0 + 0.15);
          src.connect(g);
          g.connect(input);
          src.start(t0, Math.random() * 1.5, 0.16);
          playing.push(src);
        }
        t += 0.66 + 0.34;
      });
      return t - ctx.currentTime;
    }

    async function useCandidate(c) {
      await engine.renderer.useEarModel(c.id);
    }

    function muteModules() {
      saved = {
        enabled: Object.fromEntries(global.ConsciousnessAudioEngine.MODULES.map((m) => [m, !!engine.params[m].enabled])),
        mode: engine.renderer.mode,
        earModel: engine.renderer.earModel,
        reverbMix: engine.params.reverbMix,
        roomReverb: engine.renderer.cfg.reverb,
        exaggerate: engine.renderer.cfg.exaggerate || 0
      };
      // natural cues during the test: the 8D-style exaggeration would hide the differences between ear models
      engine.renderer.setConfig({ reverb: CAL_REVERB, exaggerate: 0 });
      global.ConsciousnessAudioEngine.MODULES.forEach((m) => hooks.setEnabled(m, false));
      engine.setReverbMix(0.1);
      if (engine.renderer.mode === 'hrtf') engine.renderer.setMode('structural');
    }

    function restoreModules() {
      if (!saved) return;
      stopPlayback();
      engine.setReverbMix(saved.reverbMix);
      engine.renderer.setConfig({ reverb: saved.roomReverb, exaggerate: saved.exaggerate });
      global.ConsciousnessAudioEngine.MODULES.forEach((m) => hooks.setEnabled(m, saved.enabled[m]));
      saved = null;
    }

    // ------------------------------------------------------------------ UI helpers
    function render(html) {
      body.innerHTML = html;
    }
    function btn(id, label, cls = '') {
      return `<button type="button" class="btn-config ${cls}" id="${id}">${label}</button>`;
    }
    function on(id, fn) {
      const el = $(id);
      if (el) el.addEventListener('click', fn);
    }

    // ------------------------------------------------------------------ steps
    function intro() {
      const cur = loadSaved();
      const curName = cur ? (candidates.find((c) => c.id === cur.id) || {}).name : null;
      render(`
        <h3>Find the ear model that fits your ears (about 4 minutes)</h3>
        <p>Front/back and up/down are heard through the shape of your outer ears, which differ from person to person.
        You will compare ear models two at a time, then do a short blind test. Use headphones, a quiet room, a moderate volume.
        Close your eyes while each sound plays: the screen shows nothing about where the sound is.</p>
        <ol>
          <li><strong>Duels (7):</strong> press <em>Play A</em> and <em>Play B</em> as often as you like. Each plays short noise bursts
          from <strong>in front</strong>, then <strong>above</strong>, then <strong>behind</strong>, then <strong>below</strong> you.
          Choose the one where these four places are most distinct and most correct, especially front vs behind.</li>
          <li><strong>Blind test (16 sounds):</strong> say where each sound comes from.</li>
        </ol>
        ${curName ? `<p class="cal-note">Current choice: <strong>${curName}</strong>.</p>` : ''}
        <div class="cal-actions">${btn('calStart', '▶ Start')} ${btn('calQuick', 'Blind test only (current model)', 'btn-config-restore')}</div>`);
      on('calStart', startTournament);
      on('calQuick', () => {
        const id = engine.renderer.mode === 'measured' ? engine.renderer.earModel : null;
        const c = candidates.find((x) => x.id === id) || candidates[0];
        state = { winner: c, results: {} };
        blindTest(c, () => results());
      });
    }

    function startTournament() {
      const order = shuffle(candidates.slice());
      state = { round: order, next: [], duel: 0, total: candidates.length - 1, results: {}, history: [] };
      Promise.all(index.map((c) => engine.renderer.prepareEarModel(c.id))).then(() => nextDuel()).catch((e) => {
        render(`<p>Could not load the ear models: ${e.message}</p><div class="cal-actions">${btn('calClose2', 'Close')}</div>`);
        on('calClose2', close);
      });
      render('<p>Loading ear models…</p>');
    }

    function nextDuel() {
      if (state.round.length === 1 && state.next.length === 0) {
        state.winner = state.round[0];
        blindTest(state.winner, () => offerCompare());
        return;
      }
      if (state.round.length < 2) {
        state.round = state.round.concat(state.next);
        state.next = [];
        if (state.round.length === 1) { nextDuel(); return; }
      }
      const pair = [state.round.shift(), state.round.shift()];
      if (Math.random() < 0.5) pair.reverse();
      state.duel += 1;
      const heard = { a: false, b: false };
      render(`
        <h3>Duel ${state.duel} of ${state.total}</h3>
        <p>Each plays bursts from <strong>front → above → behind → below</strong>. Which one puts the sound in these places more clearly?</p>
        <div class="cal-duel">
          <button type="button" class="cal-play" id="calPlayA">▶ Play A <span>(key A)</span></button>
          <button type="button" class="cal-play" id="calPlayB">▶ Play B <span>(key B)</span></button>
        </div>
        <div class="cal-actions">
          <button type="button" class="btn-config" id="calPickA" disabled>A is better (1)</button>
          <button type="button" class="btn-config" id="calPickB" disabled>B is better (2)</button>
        </div>
        <div class="cal-progress"><div style="width:${((state.duel - 1) / state.total) * 100}%"></div></div>`);
      const play = async (which) => {
        const c = which === 'a' ? pair[0] : pair[1];
        $('calPlayA').classList.toggle('active', which === 'a');
        $('calPlayB').classList.toggle('active', which === 'b');
        await useCandidate(c);
        const dur = playPositions(SEQUENCE);
        heard[which] = true;
        setTimeout(() => {
          if ($('calPickA') && heard.a && heard.b) { $('calPickA').disabled = false; $('calPickB').disabled = false; }
        }, dur * 1000);
      };
      const pick = (which) => {
        if (!(heard.a && heard.b)) return;
        stopPlayback();
        const win = which === 'a' ? pair[0] : pair[1];
        const lose = which === 'a' ? pair[1] : pair[0];
        state.history.push({ win: win.id, lose: lose.id });
        state.next.push(win);
        nextDuel();
      };
      on('calPlayA', () => play('a'));
      on('calPlayB', () => play('b'));
      on('calPickA', () => pick('a'));
      on('calPickB', () => pick('b'));
      state.keys = (e) => {
        const k = e.key.toLowerCase();
        if (k === 'a') play('a');
        else if (k === 'b') play('b');
        else if (k === '1') pick('a');
        else if (k === '2') pick('b');
      };
    }

    function blindTest(c, done) {
      const trials = shuffle([].concat(...['front', 'behind', 'above', 'below'].map((k) => [k, k, k, k])));
      for (let i = 1; i < trials.length; i++) if (trials[i] === trials[i - 1]) { const j = (i + 5) % trials.length; [trials[i], trials[j]] = [trials[j], trials[i]]; }
      const answers = [];
      let i = 0;
      let ready = false;
      const step = async () => {
        if (i >= trials.length) {
          state.results[c.id === null ? 'builtin' : c.id] = score(trials, answers);
          done();
          return;
        }
        render(`
          <h3>Blind test${state.winner && c !== state.winner ? ' (built-in model)' : ''}: sound ${i + 1} of ${trials.length}</h3>
          <p>Where does it come from? Answer with the buttons or keys <strong>F</strong> front, <strong>B</strong> behind, <strong>U</strong> above, <strong>D</strong> below.</p>
          <div class="cal-answers">
            <button type="button" class="cal-ans" data-a="front">Front (F)</button>
            <button type="button" class="cal-ans" data-a="behind">Behind (B)</button>
            <button type="button" class="cal-ans" data-a="above">Above (U)</button>
            <button type="button" class="cal-ans" data-a="below">Below (D)</button>
          </div>
          <div class="cal-actions">${btn('calReplay', '↻ Replay (R)', 'btn-config-restore')}</div>
          <div class="cal-progress"><div style="width:${(i / trials.length) * 100}%"></div></div>`);
        ready = false;
        await useCandidate(c);
        const dur = playPositions([trials[i]]);
        setTimeout(() => { ready = true; }, Math.max(200, dur * 1000 - 500));
        body.querySelectorAll('.cal-ans').forEach((b) => b.addEventListener('click', () => answer(b.dataset.a)));
        on('calReplay', () => playPositions([trials[i]]));
      };
      const answer = (a) => {
        if (!ready) return;
        answers.push(a);
        i += 1;
        setTimeout(step, 450);
      };
      state.keys = (e) => {
        const map = { f: 'front', b: 'behind', u: 'above', d: 'below' };
        const k = e.key.toLowerCase();
        if (map[k]) answer(map[k]);
        else if (k === 'r') playPositions([trials[i]]);
      };
      step();
    }

    function score(trials, answers) {
      let correct = 0, fb = 0, fbN = 0, ud = 0, udN = 0;
      const confusion = {};
      trials.forEach((t, i) => {
        const a = answers[i];
        if (a === t) correct++;
        confusion[`${t}>${a}`] = (confusion[`${t}>${a}`] || 0) + 1;
        if (t === 'front' || t === 'behind') { fbN++; if (a === t) fb++; }
        if (t === 'above' || t === 'below') { udN++; if (a === t) ud++; }
      });
      return { correct, n: trials.length, frontBack: `${fb}/${fbN}`, upDown: `${ud}/${udN}`, confusion };
    }

    function offerCompare() {
      state.keys = null;
      if (state.winner.id === null) { results(); return; }
      render(`
        <h3>Compare with the built-in model?</h3>
        <p>The same 16-sound blind test with the built-in model shows whether the measured ear model really helps you.</p>
        <div class="cal-actions">${btn('calCompare', '▶ Compare (1 min)')} ${btn('calSkip', 'Skip', 'btn-config-restore')}</div>`);
      on('calCompare', () => blindTest(candidates[0], () => results()));
      on('calSkip', results);
    }

    function results() {
      state.keys = null;
      const w = state.winner;
      const rw = state.results[w.id === null ? 'builtin' : w.id];
      const rb = w.id !== null ? state.results.builtin : null;
      const row = (name, r) => r ? `<tr><td>${name}</td><td>${r.correct}/${r.n}</td><td>${r.frontBack}</td><td>${r.upDown}</td></tr>` : '';
      let advice = '';
      if (rw) {
        const fb = Number(rw.frontBack.split('/')[0]);
        if (fb <= 5) advice = '<p class="cal-note">Front and behind are still often swapped: this is common with headphones without head tracking. Raising <em>Spectral cue strength</em> (1.3-1.6) sometimes helps; seeing the source on the canvas while listening also trains the ear.</p>';
      }
      render(`
        <h3>Result</h3>
        <p>Selected ear model: <strong>${w.name}</strong> <span class="cal-dim">(${w.source}${w.license ? ', ' + w.license : ''})</span>.</p>
        ${rw ? `<table class="cal-table"><tr><th></th><th>correct</th><th>front/behind</th><th>above/below</th></tr>${row(w.name, rw)}${row('Built-in model', rb)}</table>
        <p class="cal-dim">Chance level: 4/16 overall, 4/8 for front/behind and for above/below.</p>` : ''}
        ${advice}
        <div class="cal-actions">${btn('calUse', `Use ${w.name}`)} ${rb ? btn('calUseBuiltin', 'Use the built-in model', 'btn-config-restore') : ''} ${btn('calRedo', 'Start again', 'btn-config-restore')}</div>`);
      const apply = (c) => {
        save({ id: c.id, results: state.results, history: state.history || [], date: new Date().toISOString() });
        state.applied = c.id;
        close();
      };
      on('calUse', () => apply(w));
      on('calUseBuiltin', () => apply(candidates[0]));
      on('calRedo', intro);
    }

    // ------------------------------------------------------------------ open / close
    async function open() {
      if (!engine.isRunning) await hooks.start();
      if (!engine.renderer || !engine.renderer.workletAvailable) {
        alert('This browser does not support AudioWorklet, which the ear models need.');
        return;
      }
      muteModules();
      modal.classList.add('open');
      document.addEventListener('keydown', onKey);
      intro();
    }

    function close() {
      modal.classList.remove('open');
      document.removeEventListener('keydown', onKey);
      stopPlayback();
      if (state && state.applied !== undefined) {
        hooks.applyEarModel(state.applied);
      } else if (saved) {
        // closed without choosing: back to the renderer used before the calibration
        engine.renderer.earModel = saved.earModel;
        hooks.restoreRenderer(saved.mode);
      }
      restoreModules();
      state = null;
    }

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (state && state.keys && !e.metaKey && !e.ctrlKey) state.keys(e);
    }

    $('calClose').addEventListener('click', close);
    return { open, close, loadSaved, candidates };
  }

  global.AetherCalibration = { create, loadSaved, STORAGE_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
