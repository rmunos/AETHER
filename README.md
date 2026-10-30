# AETHER // WebAudio Neurophenomenology & Consciousness Lab

**AETHER** is an interactive, zero-dependency real-time WebAudio synthesizer designed to explore how structured acoustic fields interact with human perception, predictive coding, spatial self-location, and neural oscillations.

> **🎧 Stereo Headphones Required:** The synthesis engine relies on interaural time/level differences (ITD/ILD), Head-Related Transfer Function (HRTF) pinna cues, and dichotic binaural phase offsets.

---

## Launch the Live App

- **🌐 Live Web App (GitHub Pages):** [https://rmunos.github.io/AETHER/](https://rmunos.github.io/AETHER/)
- **📖 Full Documentation & Guide:** [https://rmunos.github.io/AETHER/docs.html](https://rmunos.github.io/AETHER/docs.html)
- **💻 Run Locally (Zero Server Required):** Simply open [`index.html`](./index.html) directly in your browser (`file://...`), or serve locally via `python3 -m http.server 8080`.

---

## Core Architecture & Features

### Global Controls & Custom Configuration
- **Initialize Audio Engine:** Starts/pauses the real-time WebAudio synthesis graph (`44.1 / 48 kHz`) and `60 FPS` modulation & telemetry loop.
- **💾 Save Config / ↺ Restore Saved:** Saves and restores your complete hand-tuned configuration across all 6 modules (`masterGain`, `reverbMix`, and all module toggles, sliders, and selectors) via `localStorage` (`aether_custom_config_v1`).
- **SOLO Module Buttons (`SOLO 3D`, `SOLO CHAOS`, `SOLO PAC`, `SOLO FRACTAL`, `SOLO SUB`, `SOLO GANZFELD`):** Isolates any individual module by muting the others and switching to the corresponding real-time visualizer.
- **Live Telemetry Strip:** Displays real-time **Target State**, **Bayesian Surprise (bits)**, **PAC Index ($\theta\text{–}\gamma$)**, and **0.1 Hz Breath Phase (`INHALE ▲ / EXHALE ▼`)**.

---

## The 6 Real-Time Synthesis Modules

### 01 // Parietal Self-Model: Hyper-Spatial "Impossible Geometry"
Targets spatial self-location in the temporoparietal junction (TPJ) and posterior parietal cortex using 100% dry binaural HRTF `PannerNode` trajectories enhanced with psychoacoustic pinna front/back shadow filtering and 7 kHz elevation notch/peak cues.
- **3D Trajectory Geometry:**
  - `Figure-8 / Infinity (∞ Passing Through Head)`
  - `Far-Horizon Excursion (Goes Very Far & Returns)`
  - `Mixed Geometries (Circle + ∞ + Far Excursion)`
  - `360° Circular Halo (Around Perimeter of Head)`
  - `Breathing Spiral (Far Horizon ↔ Center of Head)`
  - `Counter-Rotating 3D Toroidal Knot`
- **Number of 3D Sources (`1–8`):** Select how many independent sources orbit simultaneously.
- **Lowest Source Pitch (`36–320 Hz`):** Sets the base fundamental frequency (from sub-bass `36 Hz` to `320 Hz`).
- **Trajectory Speed (`0.03–0.80 Hz`):** Controls orbital speed.
- **Pulse / Oscillation (`0%–100%`):** `0%` produces a 100% smooth continuous tone; higher values add rhythmic pulsing.
- **In-Cranial Phase Collapse (`0%–100%`):** `0%` strictly disables the phase-inverted core; raising it blends a $180^\circ$ phase-inverted dichotic wave that collapses localization inside the cranium.
- **Harmonic Tuning Intervals:** `Deep Octaves & 5ths`, `Just Intonation`, `Golden Ratio (φ = 1.618)`, `Natural Overtone Series`, `Mystic Quartal Space`.
- **Interactive 3D Canvas Drag:** Click and drag directly on the 3D radar canvas to grab Source 1 and move it around your head in real time.

---

### 02 // Default Mode Network: Predictive-Coding "Edge of Chaos"
Drives musical events using a coupled **Logistic Map** ($x_{n+1} = r x_n (1 - x_n)$) and **2D Hénon Strange Attractor** at the mathematical Edge of Chaos ($r \approx 3.57\text{–}3.82$) to maximize continuous Bayesian surprise ($-\log_2 P(x)$ bits) while preventing repetitive looping.
- **Sonic Archetype Palette:**
  - `All Archetypes (Strange-Attractor Mutation)`
  - `Inharmonic/Harmonic FM Bells, Singing Bowls & Gongs`
  - `Liquid Formant Vowels & Bio-Acoustic Calls`
  - `Modal Wood, Koto Plucks & Bowed Glass`
  - `Deep Tectonic Sub-Drops & Microsound Clicks`
  - `Reverse Envelope Swells & Throat Overtones`
- **Rhythmic & Temporal Engine:**
  - `Neuronal Avalanche (Rapid Flurries & Contemplative Silences)`
  - `Strange-Attractor Syncopated Groove`
  - `Golden-Ratio (φ) & Prime Polyrhythm (1 : 1.618 : 2.333)`
  - `Elastic Time Gravity (Accelerando ↔ Ritardando)`
  - `Logistic Cloud (r-Controlled Periodicity)`
- **Musical Notes (Strict 12-TET Multi-Octave Quantization + Anti-Repetition Engine):**
  - `All 12 Chromatic Notes`, `Dorian Mode`, `Lydian Dream Scale`, `Suspended Pentatonic`, `Phrygian Dominant`.
  - Every event is quantized to exact 12-TET frequencies ($f = 440 \cdot 2^{(m-69)/12}\text{ Hz}$). A transition-memory tracker forms 4–7 note motifs and automatically mutates any note or interval as soon as a bigram repeats more than ~1–2 times.
- **Chaos Parameter ($r$ `2.80–3.99`), Tempo (`0.5–12 /s`), Pitch Register (`Sub ↔ Crystalline`), Timbral Mutation (`0%–100%`).**

---

### 03 // Thalamocortical Binding: Cross-Frequency PAC ($\theta\text{–}\gamma$ Coupling)
Pairs a dichotic binaural beat carrier ($f_0 \pm f_\theta/2$) with **true audio-rate (`48 kHz`) Gamma bursts (`25–75 Hz`)** gated by the positive peaks of the slow Theta wave and modulated by a **10-second (`0.1 Hz`) coherent breath swell**.
- **Base Carrier Frequency (`55–432 Hz`):** Sets the fundamental pitch of the binaural drone and its harmonic Gamma overtones (`2x`, `3x`, `4x`).
- **Slow Phase Rhythm (`1.5–12.0 Hz`):** Sets the binaural beat frequency and the slow phase gate (`Delta`, `Theta`, `Alpha`).
- **Nested Gamma Burst Freq (`25–75 Hz`):** Audio-rate oscillator + raised-power pulse `WaveShaperNode` controlling the rapid pulse rate inside each Theta burst.
- **PAC Coupling Index (`0%–100%`):** At `0%` (uncoupled), only the smooth binaural wave plays; at `100%`, every Theta peak triggers a high-contrast burst of Gamma pulses while troughs drop to silence.
- **0.1 Hz Coherent Breath Swell (`0%–100%`):** 10-second Mayer-wave / HRV cycle (5s Inhale ▲, 5s Exhale ▼) that swells volume (`10% → 135%`) and blooms a resonant lowpass harmonic filter on every Inhale.

---

### 04 // Temporal Suspension: Fractal & Shepard-Risset Horizon
8 octave-spaced voices cycling through a raised-cosine spectral bell envelope with true multi-scale $1/f$ Weierstrass self-similarity.
- **Shepard Drift Velocity (`-0.25 to +0.25 oct/s`):** Endless descent, hover, or ascent.
- **Multi-Scale $1/f$ Self-Similarity (`0%–100%`):**
  - At `0%`: Pure, smooth linear Shepard-Risset glissando.
  - Toward `100%`: Keeps all 8 voices in 100% pure octave alignment while blossoming a **Pure Just-Intonation Celestial Triad (Root $1:1$, Major 3rd $5:4$ / Major 9th $9:8$, Perfect 5th $3:2$)** across a 4-scale $1/f$ Weierstrass envelope: low octaves breathe slowly in warm major-fifth swells (`~0.26 Hz`), mid octaves weave medium triad waves (`~0.85 Hz`), and high octaves shimmer with delicate consonant bell arpeggios (`~2.2 Hz`).
- **Spectral Bell Center (`65–528 Hz`):** Center frequency of the 8-octave spectral envelope.

---

### 05 // Vestibular & Vagal: Infrasound & Somatic Sub-Bass
- **Sub-Bass Carrier (`24–60 Hz`):** Deep somatic fundamental ($f_0$).
- **Vestibular Trance Pulse (`0.2–4.0 Hz`):** Amplitude modulation pulse.
- **Missing-Fundamental Warmth (`0%–100%`):** Adds $2f_0$ and $3f_0$ harmonics for psychoacoustic fundamental reconstruction.

---

### 06 // Stochastic Resonance: Auditory Ganzfeld ($1/f$ Sonic Void)
- **Color (`1/f` Pink ↔ `1/f²` Brown):** Spectral roll-off tilt between bright pink and deep cavern brown noise.
- **Cavern Formant Sweep (`0%–100%`):** Independent left/right vocal formant pairs (F1+F2) morphing through vowel shapes (oo → oh → ah → eh → ee) — a breathing, whispering cave drifting around the head.
- **Cathedral Shimmer Space (`0%–100%`):** Global 6.5-second stereo convolution reverb (35 ms pre-delay) + a shimmer choir of six high-Q resonators tuned to a just-intonation major chord, with gentle dry ducking (3D HRTF sources stay dry).

---

## Project Structure

- [`index.html`](./index.html) — Main Consciousness Lab UI, 3 real-time visualizers, preset bar, and 6 module control panels.
- [`docs.html`](./docs.html) — Full in-app interactive documentation and scientific reference guide.
- [`audio-engine.js`](./audio-engine.js) — Real-time WebAudio synthesis engine (`ConsciousnessAudioEngine`).
- [`app.js`](./app.js) — UI bindings, state presets, custom configuration persistence, and 60 FPS canvas visualizers.
- [`styles.css`](./styles.css) — Dark bioluminescent UI theme and responsive layout.
