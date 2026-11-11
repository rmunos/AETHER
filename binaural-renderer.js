/**
 * AETHER // Binaural renderer (back-end of Module 01 and of every spatialised sound)
 *
 * Head-centred coordinates in metres: +x = right ear, +y = up (towards the crown), -z = in front of the nose.
 *
 * Two renderers share one interface:
 *
 *  1. "structural" (default) — a physically based binaural model running in an AudioWorklet:
 *     - per-ear propagation delay + spherical-head delay (Woodworth / Brown & Duda 1998), computed from the
 *       full 3-D direction (lateral angle), with smooth fractional (cubic) delay lines;
 *     - Brown & Duda one-pole / one-zero head-shadow filter per ear: frequency-dependent ILD
 *       (≈ +6 dB on the near ear and down to −20 dB on the far ear at high frequencies, none at low frequencies);
 *     - near-field per-ear distance law (large broadband ILD only for sources close to one ear);
 *     - parametric pinna notches N1 / N2 that move with the polar (elevation) angle, following measured
 *       median-plane HRTF notch trajectories (N1 ≈ 6 kHz below the horizon, 7 kHz in front, 9-10 kHz at
 *       +45°, fading out towards the zenith; Raykar et al. 2005, Iida et al. 2007); rear folded onto front;
 *     - shoulder reflection for raised sources (comb below 2 kHz that depends on elevation);
 *     - direction-dependent "directional band" EQ (Blauert): front ≈ 4 kHz, overhead ≈ 8 kHz, rear ≈ 1 kHz
 *       plus a rear pinna shadow and a torso shadow for low sources, scaled by an adjustable cue strength;
 *     - six first-order image-source early reflections (shoebox room), each with its own ITD / ILD;
 *     - an "interior" path (inside the head / body: diotic, dry) cross-faded per source;
 *     - a mono reverb send (late reverb = native ConvolverNode owned by the engine).
 *
 *  2. "hrtf" — the browser's measured-HRTF PannerNode, kept as a fallback and for A/B listening.
 *
 * The worklet source is serialised with Function.prototype.toString() and loaded from a Blob URL, so the
 * renderer also works when index.html is opened from file://.
 */
(function (global) {
  'use strict';

  const MAX_SOURCES = 12;

  // ===========================================================================================
  // AudioWorklet module (runs in AudioWorkletGlobalScope — must not reference anything outside)
  // ===========================================================================================
  function aetherBinauralWorklet() {
    const MAX_SOURCES = 12;
    const C = 343; // speed of sound, m/s
    const SUB = 32; // control-rate sub-block (samples)
    const BUF = 8192; // delay line per source (power of two)
    const MASK = BUF - 1;
    const PI = Math.PI;
    const HALF_PI = PI / 2;

    // Pinna notch N1 (frequency in Hz, depth in dB) versus polar angle (degrees, -90 below .. +90 above,
    // rear hemisphere folded onto the front). Piecewise-linear fit of measured median-plane notch tracks.
    const N1_POL = [-90, -45, 0, 30, 45, 60, 75, 90];
    const N1_HZ = [5600, 6200, 7000, 8400, 9400, 10500, 11200, 11500];
    const N1_DB = [-14, -15, -15, -12, -8, -4, -1, 0];
    const N2_RATIO = 1.45;
    // Brown & Duda head-shadow parameters
    const ALPHA_MIN = 0.1;
    const THETA_MIN = (150 * PI) / 180;

    // Control vector (per source), linearly interpolated per sample between sub-block targets.
    const K_DL = 0, K_DR = 1; // direct delays (samples)
    const K_AL = 2, K_AR = 3; // direct amplitudes
    const K_HL = 4, K_HR = 5; // head-shadow alpha
    const K_TD = 6, K_TG = 7; // shoulder reflection delay (relative) and gain
    const K_EXT = 8, K_INT = 9; // exterior / interior weights
    const K_IDL = 10, K_IDR = 11, K_IGL = 12, K_IGR = 13; // interior path delays & gains
    const K_SD = 14, K_SG = 15; // reverb send delay & gain
    const K_ER = 16; // 6 reflections x (delayL, delayR, gainL, gainR) -> 16..39
    const N_ER = 6;
    const NCTRL = K_ER + 4 * N_ER;

    // Mono, direction-dependent EQ chain (gains / notch frequencies recomputed per sub-block)
    const EQ_DEFS = [
      { type: 'peak', f: 4000, q: 1.1 }, // frontal band (Blauert)
      { type: 'peak', f: 8000, q: 1.8 }, // overhead band (Blauert)
      { type: 'peak', f: 1000, q: 0.9 }, // rear band (Blauert)
      { type: 'hshelf', f: 3000, q: 0.707 }, // rear pinna shadow / torso shadow
      { type: 'peak', f: 7000, q: 3.5, dyn: true }, // pinna notch N1 (frequency follows elevation)
      { type: 'peak', f: 10150, q: 4.5, dyn: true } // pinna notch N2
    ];
    const N_EQ = EQ_DEFS.length;

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const smooth = (e0, e1, v) => {
      const t = clamp((v - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    };

    // Spherical-head delay for an ear seeing the source at incidence angle th (0 = on the ear axis),
    // offset by a/c so that it is never negative. ITD = (a/c)(lat + sin lat)  (Woodworth).
    function headDelaySec(th, a) {
      return ((th < HALF_PI ? -Math.cos(th) : th - HALF_PI) + 1) * (a / C);
    }
    function hsAlpha(th) {
      return 1 + ALPHA_MIN / 2 + (1 - ALPHA_MIN / 2) * Math.cos((th / THETA_MIN) * PI);
    }
    // Magnitude of the head-shadow filter near 2 kHz: broadband ILD used for the reflections.
    function hsBroadband(alpha) {
      return Math.sqrt((1 + 2.56 * alpha * alpha) / 3.56);
    }

    function interp(xs, ys, v) {
      if (v <= xs[0]) return ys[0];
      for (let i = 1; i < xs.length; i++) {
        if (v <= xs[i]) {
          const t = (v - xs[i - 1]) / (xs[i] - xs[i - 1]);
          return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
        }
      }
      return ys[ys.length - 1];
    }

    function rdCubic(buf, w, d) {
      const rp = w - d;
      const i = Math.floor(rp);
      const f = rp - i;
      const xm1 = buf[(i - 1) & MASK];
      const x0 = buf[i & MASK];
      const x1 = buf[(i + 1) & MASK];
      const x2 = buf[(i + 2) & MASK];
      const c1 = 0.5 * (x1 - xm1);
      const c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
      const c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
      return ((c3 * f + c2) * f + c1) * f + x0;
    }
    function rdLin(buf, w, d) {
      const rp = w - d;
      const i = Math.floor(rp);
      const f = rp - i;
      const a = buf[i & MASK];
      return a + (buf[(i + 1) & MASK] - a) * f;
    }

    class Source {
      constructor() {
        this.buf = new Float32Array(BUF);
        this.w = 0;
        this.cur = new Float64Array(NCTRL);
        this.tgt = new Float64Array(NCTRL);
        this.step = new Float64Array(NCTRL);
        this.eqGain = new Float64Array(N_EQ);
        this.eqFreq = new Float64Array(N_EQ);
        this.eqCoef = new Float64Array(5 * N_EQ);
        this.eqState = new Float64Array(2 * N_EQ);
        this.hs = new Float64Array(4);
        this.erLp = new Float64Array(2);
        this.silent = 1e9;
        this.snap = true;
      }
    }

    class AetherBinauralProcessor extends AudioWorkletProcessor {
      static get parameterDescriptors() {
        const d = [];
        for (let i = 0; i < MAX_SOURCES; i++) {
          d.push({ name: 'x' + i, defaultValue: 0, automationRate: 'a-rate' });
          d.push({ name: 'y' + i, defaultValue: 0, automationRate: 'a-rate' });
          d.push({ name: 'z' + i, defaultValue: -1.5, automationRate: 'a-rate' });
          d.push({ name: 'w' + i, defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'a-rate' });
        }
        return d;
      }

      constructor(options) {
        super();
        const o = (options && options.processorOptions) || {};
        this.fs = sampleRate;
        this.n = Math.max(1, Math.min(MAX_SOURCES, o.sources || MAX_SOURCES));
        this.cfg = {
          headRadius: 0.0875, cue: 1, pinna: 1, torso: 1, er: 1, reverb: 0.35,
          roomSize: 1, refDist: 1, minDist: 0.4, shoulder: 0.17
        };
        if (o.cfg) Object.assign(this.cfg, o.cfg);
        this.names = [];
        this.src = [];
        for (let i = 0; i < this.n; i++) {
          this.names.push(['x' + i, 'y' + i, 'z' + i, 'w' + i]);
          this.src.push(new Source());
        }
        this._derive();
        this.port.onmessage = (e) => {
          const m = e.data || {};
          if (m.type === 'config' && m.cfg) {
            Object.assign(this.cfg, m.cfg);
            this._derive();
          }
        };
      }

      _derive() {
        const c = this.cfg;
        const fs = this.fs;
        this.HK = 2 * fs;
        this.HB = (2 * C) / c.headRadius;
        this.HN = 1 / (this.HK + this.HB);
        this.HA1 = (this.HB - this.HK) * this.HN;
        const s = Math.max(0.4, c.roomSize);
        this.room = { xl: -3.2 * s, xr: 3.2 * s, yf: -2.6 * s, yc: 2.0 * s, zf: -3.6 * s, zb: 3.0 * s };
        this.refl = [0.55, 0.7, 0.65, 0.65, 0.65, 0.65]; // floor, ceiling, left, right, front, back
        this.erLpK = 1 - Math.exp((-2 * PI * 5200) / fs);
        this.eqTrig = EQ_DEFS.map((e) => {
          const w0 = (2 * PI * Math.min(e.f, fs * 0.45)) / fs;
          return { type: e.type, cw: Math.cos(w0), sw: Math.sin(w0), q: e.q, dyn: !!e.dyn };
        });
      }

      _controls(x, y, z, wv, out, st) {
        const c = this.cfg;
        const fs = this.fs;
        const a = c.headRadius;
        const kS = fs / C;
        const d = Math.sqrt(x * x + y * y + z * z);
        const dc = d > 0.05 ? d : 0.05;
        const ux = x / dc, uy = y / dc, uz = z / dc;

        // ---- interaural cues (direct path)
        const thR = Math.acos(clamp(ux, -1, 1));
        const thL = PI - thR;
        const base = 3 + d * kS;
        out[K_DL] = base + headDelaySec(thL, a) * fs;
        out[K_DR] = base + headDelaySec(thR, a) * fs;
        const G = c.refDist / Math.max(d, c.minDist);
        const rR = Math.sqrt((x - a) * (x - a) + y * y + z * z);
        const rL = Math.sqrt((x + a) * (x + a) + y * y + z * z);
        out[K_AL] = G * clamp(dc / Math.max(rL, 0.02), 0.3, 2.5);
        out[K_AR] = G * clamp(dc / Math.max(rR, 0.02), 0.3, 2.5);
        out[K_HL] = hsAlpha(thL);
        out[K_HR] = hsAlpha(thR);

        // ---- pinna notches: interaural-polar angle, rear hemisphere folded onto the front
        const lat = Math.asin(clamp(ux, -1, 1));
        let pol = Math.atan2(uy, -uz);
        if (pol > HALF_PI) pol = PI - pol;
        else if (pol < -HALF_PI) pol = -PI - pol;
        const polDeg = (pol * 180) / PI;
        const latFade = Math.sqrt(Math.max(0, Math.cos(lat))); // elevation cues weaken near the interaural axis
        const n1 = interp(N1_POL, N1_HZ, polDeg);
        const n1db = interp(N1_POL, N1_DB, polDeg) * c.pinna * latFade;

        // ---- shoulder reflection (horizontal plane `shoulder` metres below the ears)
        const el = Math.asin(clamp(uy, -1, 1));
        const yi = -2 * c.shoulder - y;
        const dImg = Math.sqrt(x * x + yi * yi + z * z);
        out[K_TD] = Math.max(0.5, (dImg - dc) * kS);
        out[K_TG] = c.torso * 0.3 * smooth(0.25, 0.85, el);

        // ---- interior rendering weights (0 = outside, 1 = inside the head / body)
        const wi = clamp(wv, 0, 1);
        out[K_EXT] = Math.cos(wi * HALF_PI);
        out[K_INT] = Math.sin(wi * HALF_PI);
        const lo = clamp(x / 0.15, -1, 1) * 0.6;
        out[K_IDL] = base + (1 + Math.max(0, lo) * 1.2) * (a / C) * fs;
        out[K_IDR] = base + (1 + Math.max(0, -lo) * 1.2) * (a / C) * fs;
        const pan = (lo + 1) * PI * 0.25;
        out[K_IGL] = 0.8 * Math.SQRT2 * Math.cos(pan);
        out[K_IGR] = 0.8 * Math.SQRT2 * Math.sin(pan);

        // ---- reverb send: constant with distance, so the direct-to-reverberant ratio falls naturally
        out[K_SD] = base;
        out[K_SG] = c.reverb * (out[K_EXT] * out[K_EXT] + 0.15 * out[K_INT] * out[K_INT]);

        // ---- first-order early reflections (image sources in a shoebox room)
        const r = this.room;
        const sx = clamp(x, r.xl + 0.05, r.xr - 0.05);
        const sy = clamp(y, r.yf + 0.05, r.yc - 0.05);
        const sz = clamp(z, r.zf + 0.05, r.zb - 0.05);
        const er = c.er;
        for (let k = 0; k < N_ER; k++) {
          let ix = sx, iy = sy, iz = sz;
          if (k === 0) iy = 2 * r.yf - sy;
          else if (k === 1) iy = 2 * r.yc - sy;
          else if (k === 2) ix = 2 * r.xl - sx;
          else if (k === 3) ix = 2 * r.xr - sx;
          else if (k === 4) iz = 2 * r.zf - sz;
          else iz = 2 * r.zb - sz;
          const di = Math.sqrt(ix * ix + iy * iy + iz * iz);
          const tR = Math.acos(clamp(ix / di, -1, 1));
          const tL = PI - tR;
          const o = K_ER + k * 4;
          const b = 3 + di * kS;
          out[o] = b + headDelaySec(tL, a) * fs;
          out[o + 1] = b + headDelaySec(tR, a) * fs;
          const g = er * this.refl[k] * (c.refDist / Math.max(di, c.minDist));
          out[o + 2] = g * hsBroadband(hsAlpha(tL));
          out[o + 3] = g * hsBroadband(hsAlpha(tR));
        }

        // ---- direction-dependent spectral cues on the mono source (Blauert directional bands)
        const horiz = Math.cos(el);
        const caz = horiz > 1e-4 ? -uz / horiz : 0; // cos(azimuth): +1 front, -1 back
        const upW = smooth(0.17, 1.2, el); // ~10° .. 70°
        const downW = smooth(0.17, 1.05, -el); // ~-10° .. -60°
        const h2 = horiz * horiz;
        const frontW = Math.max(0, caz) * h2;
        const backW = Math.max(0, -caz) * h2;
        const cue = c.cue;
        const g = st.eqGain;
        const fq = st.eqFreq;
        g[0] = cue * (3.5 * frontW - 1.5 * backW);
        g[1] = cue * (6.0 * upW - 2.0 * downW);
        g[2] = cue * 3.0 * backW;
        g[3] = cue * (-4.0 * backW - 9.0 * downW);
        g[4] = n1db;
        fq[4] = n1;
        g[5] = n1db * 0.7 * (1 - smooth(20, 55, polDeg));
        fq[5] = Math.min(n1 * N2_RATIO, 0.45 * fs);
      }

      _eqCoeffs(st) {
        const g = st.eqGain;
        const cf = st.eqCoef;
        for (let k = 0; k < N_EQ; k++) {
          const t = this.eqTrig[k];
          const A = Math.pow(10, g[k] / 40);
          let cw = t.cw, sw = t.sw;
          if (t.dyn) {
            const w0 = (2 * PI * st.eqFreq[k]) / this.fs;
            cw = Math.cos(w0);
            sw = Math.sin(w0);
          }
          let b0, b1, b2, a0, a1, a2;
          if (t.type === 'peak') {
            const al = sw / (2 * t.q);
            b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A;
            a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
          } else {
            const al = (sw / 2) * Math.SQRT2;
            const sA = Math.sqrt(A);
            b0 = A * (A + 1 + (A - 1) * cw + 2 * sA * al);
            b1 = -2 * A * (A - 1 + (A + 1) * cw);
            b2 = A * (A + 1 + (A - 1) * cw - 2 * sA * al);
            a0 = A + 1 - (A - 1) * cw + 2 * sA * al;
            a1 = 2 * (A - 1 - (A + 1) * cw);
            a2 = A + 1 - (A - 1) * cw - 2 * sA * al;
          }
          const o = k * 5;
          cf[o] = b0 / a0; cf[o + 1] = b1 / a0; cf[o + 2] = b2 / a0; cf[o + 3] = a1 / a0; cf[o + 4] = a2 / a0;
        }
      }

      process(inputs, outputs, parameters) {
        const o0 = outputs[0];
        if (!o0 || !o0.length) return true;
        const oL = o0[0];
        const oR = o0.length > 1 ? o0[1] : o0[0];
        const send = outputs.length > 1 && outputs[1].length ? outputs[1][0] : null;
        const N = oL.length;
        oL.fill(0);
        if (oR !== oL) oR.fill(0);
        if (send) send.fill(0);
        for (let i = 0; i < this.n; i++) {
          const st = this.src[i];
          const chans = inputs[i];
          const inp = chans && chans.length ? chans[0] : null;
          let active = false;
          if (inp) {
            for (let j = 0; j < N; j++) {
              if (inp[j] !== 0) { active = true; break; }
            }
          }
          if (active) st.silent = 0;
          else st.silent += N;
          if (st.silent > BUF) { st.snap = true; continue; } // delay line fully flushed: skip
          this._render(st, i, active ? inp : null, parameters, oL, oR, send, N);
        }
        return true;
      }

      _render(st, i, inp, P, oL, oR, send, N) {
        const nm = this.names[i];
        const px = P[nm[0]], py = P[nm[1]], pz = P[nm[2]], pw = P[nm[3]];
        const cur = st.cur, tgt = st.tgt, stp = st.step, buf = st.buf;
        const cf = st.eqCoef, es = st.eqState, hs = st.hs, el = st.erLp;
        const HK = this.HK, HB = this.HB, HN = this.HN, HA1 = this.HA1;
        const c = this.cfg;
        const erOn = c.er > 0.0005;
        const eqOn = c.cue > 0.0005 || c.pinna > 0.0005;
        const erK = this.erLpK;
        let w = st.w;
        for (let s0 = 0; s0 < N; s0 += SUB) {
          const s1 = s0 + SUB < N ? s0 + SUB : N;
          const len = s1 - s0;
          const idx = s1 - 1;
          const x = px.length > 1 ? px[idx] : px[0];
          const y = py.length > 1 ? py[idx] : py[0];
          const z = pz.length > 1 ? pz[idx] : pz[0];
          const wv = pw.length > 1 ? pw[idx] : pw[0];
          this._controls(x, y, z, wv, tgt, st);
          if (eqOn) this._eqCoeffs(st);
          if (st.snap) { cur.set(tgt); st.snap = false; }
          const inv = 1 / len;
          for (let k = 0; k < NCTRL; k++) stp[k] = (tgt[k] - cur[k]) * inv;
          for (let j = s0; j < s1; j++) {
            for (let k = 0; k < NCTRL; k++) cur[k] += stp[k];
            let v = inp ? inp[j] : 0;
            if (eqOn) {
              for (let q = 0; q < N_EQ; q++) {
                const o = q * 5, so = q * 2;
                const yv = cf[o] * v + es[so];
                es[so] = cf[o + 1] * v - cf[o + 3] * yv + es[so + 1];
                es[so + 1] = cf[o + 2] * v - cf[o + 4] * yv;
                v = yv;
              }
            }
            buf[w] = v;

            // direct path + shoulder reflection, per ear
            const dL = cur[K_DL], dR = cur[K_DR];
            let sL = rdCubic(buf, w, dL);
            let sR = rdCubic(buf, w, dR);
            const tg = cur[K_TG];
            if (tg > 1e-4) {
              const td = cur[K_TD];
              sL += tg * rdLin(buf, w, dL + td);
              sR += tg * rdLin(buf, w, dR + td);
            }
            // head shadow: H(s) = (alpha s + beta) / (s + beta), beta = 2c/a (bilinear transform)
            const aL = cur[K_HL], aR = cur[K_HR];
            const yL = (aL * HK + HB) * HN * sL + (HB - aL * HK) * HN * hs[0] - HA1 * hs[1];
            hs[0] = sL; hs[1] = yL;
            const yR = (aR * HK + HB) * HN * sR + (HB - aR * HK) * HN * hs[2] - HA1 * hs[3];
            hs[2] = sR; hs[3] = yR;
            const ext = cur[K_EXT];
            let outLv = yL * cur[K_AL] * ext;
            let outRv = yR * cur[K_AR] * ext;

            // early reflections
            if (erOn) {
              let eL = 0, eR = 0;
              for (let k = 0; k < N_ER; k++) {
                const o = K_ER + k * 4;
                eL += cur[o + 2] * rdLin(buf, w, cur[o]);
                eR += cur[o + 3] * rdLin(buf, w, cur[o + 1]);
              }
              el[0] += erK * (eL - el[0]);
              el[1] += erK * (eR - el[1]);
              outLv += el[0] * ext;
              outRv += el[1] * ext;
            }

            // interior path (time-aligned with the direct path, so cross-fades do not comb-filter)
            const iw = cur[K_INT];
            if (iw > 1e-4) {
              outLv += iw * cur[K_IGL] * rdLin(buf, w, cur[K_IDL]);
              outRv += iw * cur[K_IGR] * rdLin(buf, w, cur[K_IDR]);
            }

            oL[j] += outLv;
            oR[j] += outRv;
            if (send) send[j] += cur[K_SG] * rdLin(buf, w, cur[K_SD]);
            w = (w + 1) & MASK;
          }
        }
        st.w = w;
      }
    }

    registerProcessor('aether-binaural', AetherBinauralProcessor);
  }

  // ===========================================================================================
  // Main-thread wrapper
  // ===========================================================================================
  const DEFAULT_CFG = {
    headRadius: 0.0875, cue: 1, pinna: 1, torso: 1, er: 1, reverb: 0.35,
    roomSize: 1, refDist: 1, minDist: 0.4, shoulder: 0.17
  };

  class BinauralRenderer {
    constructor(ctx, opts = {}) {
      this.ctx = ctx;
      this.maxSources = Math.max(1, Math.min(MAX_SOURCES, opts.sources || MAX_SOURCES));
      this.cfg = Object.assign({}, DEFAULT_CFG, opts.cfg || {});
      this.output = ctx.createGain(); // stereo binaural output
      this.reverbSend = ctx.createGain(); // mono send for the late reverb
      this.slots = [];
      for (let i = 0; i < this.maxSources; i++) {
        const input = ctx.createGain();
        input.channelCount = 1;
        input.channelCountMode = 'explicit';
        input.channelInterpretation = 'speakers';
        this.slots.push({ input, primed: false, lastT: 0, last: { x: 0, y: 0, z: -1.5, w: 0 } });
      }
      this.node = null;
      this.params = [];
      this.hrtf = null;
      this.mode = 'none';
      this.workletAvailable = false;
    }

    async init() {
      try {
        if (!this.ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
          throw new Error('AudioWorklet is not available');
        }
        if (!BinauralRenderer._moduleUrl) {
          const src = '(' + aetherBinauralWorklet.toString() + ')();';
          BinauralRenderer._moduleUrl = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
        }
        await this.ctx.audioWorklet.addModule(BinauralRenderer._moduleUrl);
        this.node = new AudioWorkletNode(this.ctx, 'aether-binaural', {
          numberOfInputs: this.maxSources,
          numberOfOutputs: 2,
          outputChannelCount: [2, 1],
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
          processorOptions: { sources: this.maxSources, cfg: this.cfg }
        });
        this.node.connect(this.output, 0);
        this.node.connect(this.reverbSend, 1);
        for (let i = 0; i < this.maxSources; i++) {
          this.params.push({
            x: this.node.parameters.get('x' + i),
            y: this.node.parameters.get('y' + i),
            z: this.node.parameters.get('z' + i),
            w: this.node.parameters.get('w' + i)
          });
        }
        this.workletAvailable = true;
      } catch (err) {
        console.warn('[AETHER] structural binaural renderer unavailable; using the browser HRTF panner.', err);
        this.workletAvailable = false;
      }
      this.setMode(this.workletAvailable ? 'structural' : 'hrtf');
      return this;
    }

    input(i) {
      return this.slots[i] ? this.slots[i].input : null;
    }

    _buildHrtf() {
      if (this.hrtf) return;
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.connect(this.output);
      const send = ctx.createGain();
      send.gain.value = this.cfg.reverb;
      send.connect(this.reverbSend);
      const slots = this.slots.map(() => {
        const extG = ctx.createGain();
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.rolloffFactor = 1;
        panner.maxDistance = 50;
        const intG = ctx.createGain();
        intG.gain.value = 0;
        extG.connect(panner);
        panner.connect(out);
        intG.connect(out);
        return { extG, panner, intG };
      });
      this.hrtf = { out, send, slots };
    }

    setMode(mode) {
      if (mode === 'structural' && !this.workletAvailable) mode = 'hrtf';
      if (mode !== 'structural' && mode !== 'hrtf') mode = this.workletAvailable ? 'structural' : 'hrtf';
      if (mode === this.mode) return this.mode;
      if (mode === 'hrtf') this._buildHrtf();
      this.slots.forEach((s, i) => {
        try { s.input.disconnect(); } catch (_) { /* not connected */ }
        if (mode === 'structural') {
          s.input.connect(this.node, 0, i);
        } else {
          const h = this.hrtf.slots[i];
          s.input.connect(h.extG);
          s.input.connect(h.intG);
          s.input.connect(this.hrtf.send);
        }
        s.primed = false;
      });
      this.mode = mode;
      // re-apply the last known positions immediately
      this.slots.forEach((s, i) => this.setPosition(i, s.last.x, s.last.y, s.last.z, s.last.w));
      return mode;
    }

    setConfig(cfg) {
      Object.assign(this.cfg, cfg || {});
      if (this.node) this.node.port.postMessage({ type: 'config', cfg: this.cfg });
      if (this.hrtf) this.hrtf.send.gain.setTargetAtTime(this.cfg.reverb, this.ctx.currentTime, 0.05);
    }

    /** Make the next setPosition of slot i jump instead of gliding. */
    unprime(i) {
      if (i === undefined) this.slots.forEach((s) => { s.primed = false; });
      else if (this.slots[i]) this.slots[i].primed = false;
    }

    /**
     * Schedule the position of slot i to be (x, y, z) with interior weight w at audio time t.
     * Successive calls build a piecewise-linear trajectory (call with t = now + lookahead).
     */
    setPosition(i, x, y, z, w = 0, t) {
      const s = this.slots[i];
      if (!s) return;
      const now = this.ctx.currentTime;
      if (t === undefined || t < now) t = now;
      const jump = !s.primed;
      if (!jump && t <= s.lastT + 0.002) return;
      const ramp = (prm, v) => {
        if (!prm) return;
        if (jump) {
          prm.cancelScheduledValues(now);
          prm.setValueAtTime(v, now);
        } else {
          prm.linearRampToValueAtTime(v, t);
        }
      };
      if (this.mode === 'structural' && this.params[i]) {
        const p = this.params[i];
        ramp(p.x, x); ramp(p.y, y); ramp(p.z, z); ramp(p.w, Math.max(0, Math.min(1, w)));
      } else if (this.mode === 'hrtf' && this.hrtf) {
        const h = this.hrtf.slots[i];
        const pn = h.panner;
        let px = x, py = y, pz = z;
        const d = Math.sqrt(x * x + y * y + z * z);
        if (d < 0.2) {
          const k = 0.2 / Math.max(1e-6, d);
          if (d < 1e-6) { px = 0; py = 0; pz = -0.2; } else { px *= k; py *= k; pz *= k; }
        }
        const wi = Math.max(0, Math.min(1, w));
        if (pn.positionX) {
          ramp(pn.positionX, px); ramp(pn.positionY, py); ramp(pn.positionZ, pz);
        } else if (pn.setPosition) {
          pn.setPosition(px, py, pz);
        }
        ramp(h.extG.gain, Math.cos(wi * Math.PI / 2));
        ramp(h.intG.gain, 0.8 * Math.sin(wi * Math.PI / 2));
      }
      s.primed = true;
      s.lastT = t;
      s.last = { x, y, z, w };
    }
  }

  global.AetherBinaural = {
    BinauralRenderer,
    MAX_SOURCES,
    DEFAULT_CFG,
    workletModule: aetherBinauralWorklet
  };
})(typeof window !== 'undefined' ? window : globalThis);
