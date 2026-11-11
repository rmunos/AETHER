# AETHER // WebAudio Neurophenomenology & Consciousness Lab

**AETHER** is an interactive, zero-dependency real-time WebAudio synthesis engine designed for meditation, neural entrainment, sensory unbinding, and consciousness exploration.

> **🎧 Stereo Headphones Required:** The spatial engine relies on explicit spherical Woodworth interaural time differences (ITD), head-shadow level differences (ILD), pinna front/back obstruction filtering, and elevation-dependent spectral sculpting.

---

## Quick Links

- **🌐 Live Web App (GitHub Pages):** [https://rmunos.github.io/AETHER/](https://rmunos.github.io/AETHER/)
- **📖 Scientific Guide & Documentation:** [https://rmunos.github.io/AETHER/docs.html](https://rmunos.github.io/AETHER/docs.html)
- **💻 Run Locally (Zero Dependencies):** Simply open [`index.html`](./index.html) directly in any modern browser (`file://...`), or serve via:
  ```bash
  python3 -m http.server 8080
  ```

---

## Module 01: 3D Sound Space & Monroe REBAL Energy Torus

Module 01 provides an explicit, psychoacoustically validated dual-ear binaural engine with pinpoint 3D localization across all axes:

### 1. The 3D Psychoacoustic Spatializer
- **Left / Right Separation:**
  - Exact spherical **Woodworth ITD** formula ($\Delta t = \frac{a}{c}(\sin|\theta| + |\theta|)$) generating physical arrival delays between $0$ and $660\,\mu\text{s}$.
  - **Acoustic Head-Shadow ILD:** Up to $-18.4\,\text{dB}$ attenuation and a steep 2nd-order low-pass filter rolling off from $19\,\text{kHz}$ down to $1.5\,\text{kHz}$ on the contralateral ear.
  - Dedicated `ChannelMergerNode(2)` bypassing the master compressor for 100% pure stereo channel isolation.
- **Front vs. Back Discrimination:**
  - **Front ($-Z$, in front of eyes):** Ear concha resonance boost ($+3.8\,\text{dB}$ at $3.6\,\text{kHz}$) with full high-frequency extension to $19\,\text{kHz}$.
  - **Back ($+Z$, behind neck):** Anatomical pinna flap obstruction filter rolling off highs down to $3.2\,\text{kHz}$ with a deep pinna notch at $7.2\,\text{kHz}$ ($-8.5\,\text{dB}$).
- **Up (Zenith / Crown) vs. Down (Nadir / Feet):**
  - **Above Head ($+Y$, Zenith):** Open-sky brilliance ($+8.5\,\text{dB}$ high-shelf at $7.5\,\text{kHz}$), low-frequency chest decoupling ($-6\,\text{dB}$), formant shift towards bright vowels, and Pratt pitch elevation lift ($+2$ semitones).
  - **Below Head ($-Y$, Feet):** Torso, jaw, and cheekbone shadow rolling off highs down to $1.6\,\text{kHz}$, paired with deep chest cavity resonance ($+8.5\,\text{dB}$ low-shelf at $180\,\text{Hz}$) and fundamental pitch grounding ($-2$ semitones).

### 2. Robert Monroe REBAL (Resonant Energy Balloon) Trajectory
Inspired by the **Monroe Institute Gateway Experience**, this 3D toroidal breath cycle aids energetic visualization:
- **Exhale ▼ ($0 \to 50\%$ cycle):** Starts at the crown of the head, releases a radiant energy burst, fountains **high overhead ($+1.5\,\text{m}$ above the head)**, splits Left & Right, and spirals down around the outside of the body past ear level to beneath the feet.
- **Inhale ▲ ($50 \to 100\%$ cycle):** Enters the soles of the feet ($-1.65\,\text{m}$, deep warm chest bass), rises **straight up through the body core and spine** into the cranium, building in luminance and radiance!
- **Sparkle Transient Anchors:** Accompanying acoustic micro-sparkles across $4\text{–}12\,\text{kHz}$ give the auditory cortex sharp arrival markers for effortless 3D tracking.

### 3. Sonic Palettes
- **⚡ Breath Energy (`energy`):** Sacred harmonic chord ($108\,\text{Hz}$ root, 5th, octave, 12th) flowing through vocal formants that breathe in phase with the cycle.
- **🥣 Singing Bowls (`bowl`):** Authentic Tibetan singing bowl partials with acoustic beating pairs and felt mallet strikes.
- **💧 Water Drops (`drops`):** Resonant Minnaert bubble chirps with surface micro-transients.
- **✨ Crystal Chimes (`chimes`):** Pure harmonic glass chimes tuned to a celestial D-major pentatonic scale.

### 4. Movement Geometries
- `REBAL Energy Torus`: Exhale crown $\to$ fountain $\to$ outer body $\to$ feet; Inhale feet $\to$ spine $\to$ head.
- `Horizontal Orbit`: Sweeps $360^\circ$ at ear level.
- `Vertical Loops`: Loops from Front $\to$ Overhead Zenith $\to$ Behind $\to$ Below.
- `Free 3D Wander`: Smoothly explores the full spherical space.
- `Hold Still (Manual)`: Click/drag on the canvas radar or elevation gauge to place a source anywhere in 3D.

---

## Other Synthesis Modules

### 02 // Predictive Coding: Edge of Chaos
- Multi-archetype synthesis (FM bells, singing bowls, liquid formants, modal wood, tectonic sub-drops, throat overtones).
- Driven by a coupled **Logistic Map** ($x_{n+1} = r x_n (1 - x_n)$) and **Hénon Strange Attractor** at the mathematical edge of chaos ($r \approx 3.74$).
- Strictly quantized to 12-TET musical scales with an anti-repetition motif engine that suspends Default Mode Network (DMN) narrative rumination.

### 03 // Thalamocortical Binding: Cross-Frequency PAC ($\theta\text{–}\gamma$)
- Pairs a pure dichotic binaural beat carrier ($f_0 \pm f_\theta/2$) with **audio-rate Gamma pulses ($25\text{–}75\,\text{Hz}$)** nested directly on the positive peaks of slow Theta waves ($1.5\text{–}12\,\text{Hz}$).
- Coherently modulated by a **$0.1\,\text{Hz}$ (10-second) Mayer-wave / vagal breath swell**.

### 04 // Temporal Suspension: Fractal & Shepard-Risset Horizon
- 8 octave-spaced voices cycling through a raised-cosine spectral envelope for endless pitch ascent or descent.
- Blends a multi-scale $1/f$ Weierstrass self-similar celestial triad (Root $1:1$, 3rd $5:4$, 5th $3:2$) across low, mid, and high octaves.

### 05 // Vestibular & Vagal: Infrasound & Somatic Sub-Bass
- Deep $24\text{–}60\,\text{Hz}$ sub-bass carrier with $2f_0$ and $3f_0$ "missing-fundamental" harmonics for psychoacoustic bass presence.
- Rhythmic $0.2\text{–}4.0\,\text{Hz}$ vestibular pulse.

### 06 // Stochastic Resonance: Auditory Ganzfeld ($1/f$ Sonic Void)
- Binaurally decorrelated $1/f$ Pink and $1/f^2$ Brown noise sculpted by dual cavern formant filters (oo $\to$ oh $\to$ ah $\to$ eh $\to$ ee).
- Global $6.5\,\text{s}$ stereo cathedral convolution reverb + shimmer choir of just-intonation resonators.

---

## Phenomenological Presets

1. **3D SINGING BOWLS:** Struck bowls wandering the sphere with measured ITD/ILD and floor reflections.
2. **DMN SUPPRESSION:** Non-repeating microtonal drops and cave water droplets at the mathematical Edge of Chaos.
3. **LUCID $\theta\text{–}\gamma$ PAC:** $40\,\text{Hz}$ gamma bursts on $6\,\text{Hz}$ theta peaks with a $0.1\,\text{Hz}$ breath swell.
4. **FRACTAL HORIZON:** Endless Shepard-Risset glissando and $1/f$ self-similar harmonic triad.
5. **SOMATIC INFRASOUND:** $30\,\text{Hz}$ sub-bass with missing-fundamental warmth and vestibular trance pulse.
6. **GANZFELD SONIC VOID:** Binaural pink/brown noise cavern with drifting vowel formants.
7. **8D SHAMANIC FLIGHT:** $110\,\text{Hz}$ overtone singing paired with a spatialized $4.5\,\text{Hz}$ frame drum.
8. **8D PERIPERSONAL ASMR:** Near-field ear-canal brushing, micro-crackles, and whispers.
9. **REBAL // MONROE GATEWAY:** Complete 3D Toroidal breath cycle: crown fountain $\to$ torus body $\to$ feet $\to$ spine ascent.

---

## Project Structure

```
ai-music/
├── index.html          # Main UI, responsive layout, 3 canvas visualizers, module controls
├── docs.html           # Full interactive scientific guide & documentation
├── spatial-engine.js   # Module 01: Dual-ear binaural 3D spatializer & REBAL torus engine
├── audio-engine.js     # Core WebAudio engine (Modules 02-06, cathedral convolver, telemetry)
├── app.js              # UI controller, preset loader, localStorage config, 60 FPS visualizers
├── styles.css          # Dark theme styles and responsive layout
├── silence.wav         # Keep-alive loop for continuous background playback on mobile
└── README.md           # Architecture overview and documentation
```

---

## License

MIT License. Designed and developed for consciousness research, meditation, and auditory neurophenomenology.
