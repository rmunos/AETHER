# AETHER // 3D sound for meditation and expanded states

AETHER is a zero-dependency WebAudio app that synthesises breath-paced, binaural (3D) soundscapes in real time:
the Monroe Gateway **REBAL** energy balloon, an edge-of-chaos melody placed in 3D, binaural beats, an endless
Shepard–Risset horizon, sub-bass, ocean surf and close-up ritual sounds, with guided sessions that move between them.

> 🎧 Use stereo headphones at a moderate volume. Not while driving. Not a medical treatment.

* Live app: <https://rmunos.github.io/AETHER/> · Guide: [`docs.html`](./docs.html)
* Run locally: open `index.html` directly, or `python3 -m http.server 8080` and open <http://localhost:8080>.

## REBAL (Resonant Energy Balloon)

From the Gateway Experience manual (Discovery #3): *let energy flow out of the top of your head like a fountain,
down and around you, and back in through the bottoms of your feet; then shift the flow into a spiral, winding down
around you and coiling back up inside you.*

* **Inhale**: the energy rises inside you from the soles to the crown (rendered inside the head, brightening and
  rising in pitch).
* **Exhale**: it leaves the crown upwards (82-90° elevation), arcs over at 1.3 m above the ears, flows down on the
  outside of an apple-shaped torus (widest ~1.9 m beside the body), curls under the feet and re-enters the soles.
* **Spiral**: same torus, the outer flow winds around you, the inner flow coils up.
* **Sustained balloon**: streams keep circulating with staggered phases.
* **Guided pattern**: 6 fountain breaths → 6 spiral breaths → balloon. Breath rate, inhale share and holds are
  adjustable and shared by every module.

Default sound: four streams, one per direction, each with its own sound so they can be told apart and followed:
breath in front, water on the right, a hummed voice behind, harp on the left. Sounds keep the same pitch wherever they
are, so only their position moves. Alternatives use one kind of sound with a fixed detail per direction: breath (vowel
colour), water waves (wash, bubbling, deep surf, spray), choir, harp and bowls (a chord note each); water drops, soft
chimes. The inhale rises about 35 cm in front of the body (a rise along the body axis is straight below the ears and
cannot be heard) and the fountain leans slightly forward.

## 3D rendering (`binaural-renderer.js`, `calibration.js`, `hrtf/`)

A structural binaural model in an AudioWorklet (12 sources): spherical-head ITD, Brown & Duda head-shadow
filters (frequency-dependent ILD), near-field level differences, elevation-dependent pinna notches, Blauert
directional bands, shoulder reflection, six image-source early reflections and a natural late reverb, plus an
"interior" rendering for sounds inside the head/body.

Front/back and up/down depend on the listener's own ears, so the app also ships seven **measured ear models**
(MIT KEMAR and six HUTUBS listeners chosen to cover the spread of 93 measured people) and a 4-minute
**calibration**: a knock-out tournament of A/B duels (bursts in front, above, behind, below), then a 16-sound blind
test. The chosen model replaces the modelled head shadow and pinna cues in the same AudioWorklet (minimum-phase FIRs
rebuilt in the browser, interpolated on a 10° grid). Without a calibration the app uses HUTUBS listener A (the
medoid of the largest group). The browser's own HRTF panner remains available for comparison.

**3D intensity** (default 60 %) adds the tricks of "8D audio" on top of either renderer: up to 18 dB of extra
broadband level difference between the ears, sounds behind and below muffled, sounds above brighter.

Ear-model data: HUTUBS, TU Berlin, CC BY 4.0 (Brinkmann et al., JAES 2019, doi:10.14279/depositonce-8487);
MIT KEMAR (Gardner & Martin, JASA 1995), free use with citation.

## Modules

| # | Module | What it does |
|---|--------|--------------|
| 00 | Breath, tuning, space | breath pacer (rate, inhale share, holds), tonal centre (108 Hz default; voices, harp, binaural carrier, body tone, Shepard centre and shimmer follow it), hall reverb with tuned shimmer (3D streams included) |
| 01 | 3D space & REBAL | REBAL fountain/spiral/balloon, orbit, vertical loop, sphere wander, localisation check, drag-to-place |
| 02 | Edge of chaos | logistic map + Hénon attractor choose notes, timbres, rhythm and 3D position; motifs mutate before looping |
| 03 | Binaural beat | every partial pair beats at the same rate; overtone shimmer at γ on the beat crests; breath swell |
| 04 | Shepard–Risset | 8 voices exactly one octave apart under a raised-cosine envelope, with thirds and fifths blooming |
| 05 | Somatic | 24-60 Hz with harmonics: swells with each exhale, slow heartbeat, pulse or steady |
| 06 | Textures | ocean surf paced by the breath, pink-noise cavern with drifting vowels, rain, wind |
| 07 | Close-up & ritual | whisper, crackles, ear-to-ear wood taps, frame drum & rattle, overtone chant, rendered in the near field |

Presets (11) and guided sessions (REBAL 20 min, deep relaxation 15 min, expansion 28 min) are in `presets.js`.


## Files

```
index.html            UI
styles.css            styles
app.js                controls, presets, guided sessions (morphing), background playback
visualizer.js         canvas: two orthographic views with the REBAL torus, binaural-beat scope, spectrum
presets.js            presets and guided sessions
audio-engine.js       engine core: buses, limiter, hall + room reverbs, breath clock, module scheduling
binaural-renderer.js  AudioWorklet structural binaural renderer + browser-HRTF fallback
spatial-engine.js     Module 01: breath clock, REBAL geometry, stream generators
modules-a.js          Modules 02-04
modules-b.js          Modules 05-07
docs.html             user guide
calibration.js        ear-model calibration (tournament + blind test)
hrtf/                 measured ear models (HUTUBS listeners, MIT KEMAR)
assets/               figures
```

## License

MIT.
