/**
 * AETHER // Canvas visualiser
 *  - "3D space": two orthographic views of the listener (from behind: left/right & up/down; from the side:
 *    front/back & up/down) with the REBAL torus flow lines, every stream and its trail, the breath stage.
 *  - "Binaural beat": beat envelope with the γ shimmer, and the left/right Lissajous figure.
 *  - "Spectrum & melody": FFT, Shepard voices and the edge-of-chaos notes.
 */
(function (global) {
  'use strict';
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const HUES = ['56, 189, 248', '251, 191, 36', '52, 211, 153', '251, 113, 133', '167, 139, 250', '244, 114, 182'];
  // colours of the four sounds (palette "four sounds")
  const KIND_HUES = { breath: '226, 232, 240', water: '56, 189, 248', voice: '251, 191, 36', harp: '167, 139, 250' };
  const WORLD = { left: -2.5, right: 2.5, top: 1.75, bottom: -2.3 };
  const STAGE_TEXT = {
    inhale: 'INHALE ▲  energy rises from the soles up the front of the body into the head',
    holdIn: 'HOLD  the energy fills the head',
    exhale: 'EXHALE ▼  fountain out of the crown, over and down around you, into the soles',
    holdOut: 'HOLD  resting at the soles'
  };

  function create(canvas, engine) {
    const g = canvas.getContext('2d');
    let mode = 'spatial';
    const trails = [];
    const waveL = new Float32Array(512);
    const waveR = new Float32Array(512);
    const freq = new Uint8Array(512);
    let layout = null;

    function size() {
      const dpr = global.devicePixelRatio || 1;
      return { w: canvas.width / dpr, h: canvas.height / dpr };
    }

    function computeLayout(w, h) {
      const gap = 10;
      const pw = (w - gap) / 2;
      const ph = h - 44;
      const sc = Math.min(pw / (WORLD.right - WORLD.left), ph / (WORLD.top - WORLD.bottom)) * 0.96;
      const mk = (x0) => ({
        x0, y0: 22, w: pw, h: ph, sc,
        cx: x0 + pw / 2,
        cy: 22 + (ph - (WORLD.top - WORLD.bottom) * sc) / 2 + WORLD.top * sc
      });
      return { back: mk(0), side: mk(pw + gap), w, h };
    }

    const toScr = (v, a, b) => ({ x: v.cx + a * v.sc, y: v.cy - b * v.sc });

    function drawBody(v, isSide) {
      const head = toScr(v, 0, 0.02);
      g.save();
      g.strokeStyle = 'rgba(226, 232, 240, 0.5)';
      g.fillStyle = 'rgba(15, 23, 42, 0.85)';
      g.lineWidth = 1.3;
      g.beginPath();
      g.arc(head.x, head.y, 0.11 * v.sc, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      const body = (pts) => {
        g.beginPath();
        pts.forEach(([a, b], i) => {
          const p = toScr(v, a, b);
          if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
        });
        g.closePath();
        g.fill();
        g.stroke();
      };
      if (!isSide) {
        body([[-0.05, -0.09], [0.05, -0.09], [0.06, -0.2], [0.2, -0.24], [0.19, -0.82], [0.12, -0.86], [0.1, -1.6], [0.02, -1.62], [0.0, -0.95],
          [-0.02, -1.62], [-0.1, -1.6], [-0.12, -0.86], [-0.19, -0.82], [-0.2, -0.24], [-0.06, -0.2]]);
        // ears
        g.fillStyle = 'rgba(56, 189, 248, 0.7)';
        [-1, 1].forEach((s) => {
          const e = toScr(v, s * 0.11, 0);
          g.fillRect(e.x - 2, e.y - 5, 4, 10);
        });
      } else {
        body([[-0.04, -0.09], [0.04, -0.09], [0.06, -0.2], [0.12, -0.25], [0.11, -0.82], [0.08, -1.58], [0.2, -1.62], [-0.06, -1.62], [-0.07, -0.85],
          [-0.12, -0.8], [-0.13, -0.25]]);
        const n = toScr(v, 0.11, 0.03);
        g.beginPath();
        g.moveTo(n.x, n.y - 4);
        g.lineTo(n.x + 6, n.y + 1);
        g.lineTo(n.x, n.y + 3);
        g.stroke();
        const e = toScr(v, 0, 0);
        g.fillStyle = 'rgba(56, 189, 248, 0.7)';
        g.beginPath();
        g.arc(e.x, e.y, 3, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    function drawTorus(v, meridian, stage, isSide) {
      g.save();
      const outerActive = stage === 'exhale';
      [0.82, 1.0, 1.18].forEach((ls, li) => {
        [-1, 1].forEach((side) => {
          g.beginPath();
          meridian.forEach((m, i) => {
            const yy = m.y < -1.62 ? -1.62 + (m.y + 1.62) * ls : m.y > 0.13 ? 0.13 + (m.y - 0.13) * ls : m.y;
            const p = toScr(v, side * m.r * ls, yy);
            if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
          });
          g.strokeStyle = `rgba(167, 139, 250, ${(outerActive ? 0.22 : 0.12) + (li === 1 ? 0.12 : 0)})`;
          g.lineWidth = li === 1 ? 1.5 : 1;
          g.stroke();
          if (li === 1) {
            [0.22, 0.5, 0.78].forEach((u) => {
              const i = Math.floor(u * (meridian.length - 2));
              const a = toScr(v, side * meridian[i].r, meridian[i].y);
              const b = toScr(v, side * meridian[i + 1].r, meridian[i + 1].y);
              const ang = Math.atan2(b.y - a.y, b.x - a.x);
              g.fillStyle = `rgba(167, 139, 250, ${outerActive ? 0.85 : 0.45})`;
              g.beginPath();
              g.moveTo(b.x, b.y);
              g.lineTo(b.x - 8 * Math.cos(ang - 0.45), b.y - 8 * Math.sin(ang - 0.45));
              g.lineTo(b.x - 8 * Math.cos(ang + 0.45), b.y - 8 * Math.sin(ang + 0.45));
              g.closePath();
              g.fill();
            });
          }
        });
      });
      // inhale path: up the front of the body (side view), with the optional sway (back view)
      const G = global.Spatial3DModule && global.Spatial3DModule.geometry;
      const swirl = engine.params.spatial.innerSwirl || 0;
      g.strokeStyle = stage === 'inhale' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(251, 191, 36, 0.25)';
      g.lineWidth = stage === 'inhale' ? 3 : 1.6;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const p = i / 40;
        const yy = G ? G.inhaleY(p) : -1.62 + 1.75 * p;
        const a = G ? (isSide ? G.inhaleOffset(p) : G.inhaleSway(p, swirl)) : 0;
        const q = toScr(v, a, yy);
        if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
      }
      g.stroke();
      g.restore();
    }

    function drawSpatial(w, h, nowMs) {
      if (!layout || layout.w !== w || layout.h !== h) layout = computeLayout(w, h);
      const sp = engine.nodes && engine.nodes.spatial;
      const ctxA = engine.ctx;
      const disp = sp && ctxA ? sp.getDisplay(ctxA.currentTime) : null;
      const params = engine.params.spatial;
      const isRebal = params.trajectory === 'rebal';
      const views = [['back', 'FROM BEHIND  ·  left ◀ ▶ right'], ['side', 'FROM THE SIDE  ·  behind ◀ ▶ front']];
      views.forEach(([key, title]) => {
        const v = layout[key];
        g.save();
        g.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        g.strokeRect(v.x0 + 0.5, v.y0 + 0.5, v.w - 1, v.h - 1);
        g.fillStyle = 'rgba(148, 163, 184, 0.6)';
        g.font = '10px "JetBrains Mono", monospace';
        g.textAlign = 'left';
        g.fillText(title, v.x0 + 8, v.y0 + 14);
        // ear-level and floor references
        const e0 = toScr(v, WORLD.left, 0), e1 = toScr(v, WORLD.right, 0);
        g.setLineDash([3, 6]);
        g.beginPath();
        g.moveTo(e0.x, e0.y);
        g.lineTo(e1.x, e1.y);
        g.stroke();
        g.setLineDash([]);
        g.fillText('ear level', v.x0 + 8, e0.y - 4);
        g.restore();
        g.save();
        g.beginPath();
        g.rect(v.x0 + 1, v.y0 + 1, v.w - 2, v.h - 2);
        g.clip();
        if (isRebal && sp) drawTorus(v, sp.meridian(48), disp ? disp.stage : null, key === 'side');
        drawBody(v, key === 'side');
        g.restore();
      });
      if (!disp) return;
      // streams + trails
      disp.streams.forEach((s, k) => {
        if (!trails[k]) trails[k] = [];
        const tr = trails[k];
        tr.push({ x: s.x, y: s.y, z: s.z });
        if (tr.length > 80) tr.shift();
      });
      trails.length = disp.streams.length;
      views.forEach(([key]) => {
        const v = layout[key];
        const proj = (q) => (key === 'back' ? toScr(v, q.x, q.y) : toScr(v, -q.z, q.y));
          g.save();
        g.beginPath();
        g.rect(v.x0 + 1, v.y0 + 1, v.w - 2, v.h - 2);
        g.clip();
        disp.streams.forEach((s, k) => {
          const hue = (s.label && KIND_HUES[s.label]) || HUES[k % HUES.length];
          const tr = trails[k];
          if (tr && tr.length > 2) {
            g.beginPath();
            tr.forEach((q, i) => {
              const p = proj(q);
              if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
            });
            g.strokeStyle = `rgba(${hue}, 0.35)`;
            g.lineWidth = 2;
            g.stroke();
          }
          const p = proj(s);
          const depth = key === 'back' ? clamp(1 + 0.18 * s.z, 0.6, 1.5) : clamp(1 - 0.18 * s.x, 0.6, 1.5);
          const r = (8 - 3 * s.w) * depth;
          const grad = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, r * 2.6);
          grad.addColorStop(0, `rgba(${hue}, 0.98)`);
          grad.addColorStop(0.45, `rgba(${hue}, 0.4)`);
          grad.addColorStop(1, `rgba(${hue}, 0)`);
          g.fillStyle = grad;
          g.beginPath();
          g.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
          g.fill();
          if (s.w > 0.6) {
            g.strokeStyle = 'rgba(251, 191, 36, 0.8)';
            g.beginPath();
            g.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
            g.stroke();
          }
          if (s.label && s.w < 0.5) {
            g.font = '10px "JetBrains Mono", monospace';
            g.fillStyle = `rgba(${hue}, 0.9)`;
            g.textAlign = 'left';
            g.fillText(s.label, p.x + r * 1.6 + 2, p.y - r * 0.8);
          }
        });
        g.restore();
      });
      // banner + breath progress
      g.save();
      g.textAlign = 'center';
      g.font = '11px "JetBrains Mono", monospace';
      let text = disp.label || '';
      if (isRebal && disp.stage) text = `${disp.label}  ·  ${STAGE_TEXT[disp.stage] || ''}`;
      g.fillStyle = disp.stage === 'inhale' ? 'rgba(251, 191, 36, 0.95)' : 'rgba(196, 181, 253, 0.95)';
      g.fillText(text, w / 2, h - 10);
      if (params.trajectory === 'test' && disp.label) {
        g.font = 'bold 18px "JetBrains Mono", monospace';
        g.fillStyle = 'rgba(56, 189, 248, 0.95)';
        g.fillText(disp.label.replace('Localisation check: ', ''), w / 2, 46);
      }
      g.restore();
    }

    function drawPac(w, h, nowMs) {
      const p = engine.params.pac;
      const lung = engine.telemetry.breathLung !== undefined ? engine.telemetry.breathLung : 0.5;
      const midX = w * 0.54;
      const t0 = nowMs * 0.001;
      const cy = h * 0.5;
      const amp = h * 0.27 * (0.55 + 0.45 * lung);
      g.save();
      g.fillStyle = `rgba(56, 189, 248, ${0.03 + 0.08 * lung})`;
      g.fillRect(28, cy - amp * 1.05, midX - 48, amp * 2.1);
      const plot = (fn, style, lw) => {
        g.beginPath();
        for (let i = 0; i <= midX - 48; i++) {
          const t = t0 + (i / (midX - 48)) * 0.5;
          const y = cy - fn(t) * amp;
          if (i) g.lineTo(28 + i, y); else g.moveTo(28 + i, y);
        }
        g.strokeStyle = style;
        g.lineWidth = lw;
        g.stroke();
      };
      const th = (t) => Math.cos(t * p.theta * Math.PI * 2);
      plot((t) => th(t) * 0.52 + Math.sin(t * p.gamma * Math.PI * 2) * 0.55 * Math.pow(Math.max(0, th(t)), 2.2) * p.depth * 0.48, '#fbbf24', 2);
      plot((t) => th(t) * 0.52, 'rgba(56, 189, 248, 0.45)', 1.5);
      g.font = '11px "JetBrains Mono", monospace';
      g.fillStyle = 'rgba(226, 232, 240, 0.85)';
      g.fillText(`carrier ${Math.round(p.baseFreq)} Hz · beat ${p.theta.toFixed(1)} Hz · γ ${Math.round(p.gamma)} Hz · breath ${Math.round(lung * 100)}%${p.enabled ? '' : ' (module off)'}`, 28, h - 14);
      const lx = midX + (w - midX) / 2, ly = h / 2, lr = Math.min(w - midX, h) * 0.36;
      g.beginPath();
      g.arc(lx, ly, lr, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      g.stroke();
      if (engine.analyserL && engine.isRunning) {
        engine.analyserL.getFloatTimeDomainData(waveL);
        engine.analyserR.getFloatTimeDomainData(waveR);
        g.beginPath();
        for (let i = 0; i < waveL.length; i++) {
          const x = lx + waveL[i] * lr * 2.2, y = ly - waveR[i] * lr * 2.2;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 1.4;
        g.stroke();
      }
      g.fillStyle = 'rgba(148, 163, 184, 0.6)';
      g.fillText('left ear ↔  /  right ear ↕', lx - lr, ly + lr + 18);
      g.restore();
    }

    function drawChaos(w, h, nowMs) {
      g.save();
      if (engine.analyserMaster && engine.isRunning) {
        engine.analyserMaster.getByteFrequencyData(freq);
        const n = 96, bw = w / n;
        for (let i = 0; i < n; i++) {
          // logarithmic frequency axis 30 Hz .. 16 kHz
          const f = 30 * Math.pow(16000 / 30, i / n);
          const bin = Math.min(freq.length - 1, Math.round((f / (engine.ctx.sampleRate / 2)) * freq.length));
          const v = freq[bin] / 255;
          g.fillStyle = `rgba(56, 189, 248, ${0.08 + v * 0.25})`;
          g.fillRect(i * bw, h - v * h * 0.68, bw - 1, v * h * 0.68);
        }
      }
      const tel = engine.telemetry;
      if (engine.params.fractal.enabled) {
        tel.shepardVoices.forEach((sv) => {
          const x = sv.octavePos * w;
          const y = h * (0.82 - Math.min(1.2, sv.amp) * 0.48 - (sv.ripple || 0) * 0.16);
          const r = Math.max(3, 5 + Math.min(1.2, sv.amp) * 9);
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fillStyle = `rgba(52, 211, 153, ${0.25 + Math.min(1, sv.amp) * 0.65})`;
          g.fill();
          g.font = '10px "JetBrains Mono", monospace';
          g.fillStyle = 'rgba(167, 243, 208, 0.85)';
          g.fillText(`${Math.round(sv.freq)}Hz`, x - 14, y - r - 5);
        });
      }
      const colors = { metallic: '251, 191, 36', liquid: '56, 189, 248', plucked: '52, 211, 153', subglitch: '251, 113, 133', breath: '167, 139, 250' };
      tel.recentDroplets.forEach((d) => {
        const age = (nowMs - d.birth) / 3600;
        if (age > 1) return;
        const x = 40 + d.x * (w - 80);
        const y = h * 0.84 - (d.surprise / 6.2) * (h * 0.68);
        const r = (5 + d.surprise * 3) * (1 - age * 0.45);
        const rgb = colors[d.archetype] || '167, 139, 250';
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = `rgba(${rgb}, ${(1 - age) * 0.9})`;
        g.fill();
        if (age < 0.45) {
          g.fillStyle = `rgba(241, 245, 249, ${(1 - age * 2) * 0.95})`;
          g.font = '10px "JetBrains Mono", monospace';
          g.fillText(`${d.noteName}${d.mutated ? ' ✦' : ''}`, x + r + 5, y + 3);
        }
      });
      g.restore();
    }

    return {
      setMode(m) { mode = m; },
      get mode() { return mode; },
      draw(nowMs) {
        const { w, h } = size();
        g.fillStyle = 'rgba(6, 9, 17, 0.34)';
        g.fillRect(0, 0, w, h);
        if (mode === 'spatial') {
          g.clearRect(0, 0, w, h); // trails are drawn explicitly: no ghosting of text
          drawSpatial(w, h, nowMs);
        } else if (mode === 'pac') drawPac(w, h, nowMs);
        else drawChaos(w, h, nowMs);
      },
      /** canvas point -> { view: 'back'|'side', a, b } in metres (a horizontal, b vertical) */
      pick(px, py) {
        const { w, h } = size();
        if (!layout || layout.w !== w || layout.h !== h) layout = computeLayout(w, h);
        const v = px < layout.side.x0 ? layout.back : layout.side;
        return { view: v === layout.back ? 'back' : 'side', a: (px - v.cx) / v.sc, b: (v.cy - py) / v.sc };
      },
      resetTrails() { trails.length = 0; }
    };
  }

  global.AetherVisualizer = { create };
})(typeof window !== 'undefined' ? window : globalThis);
