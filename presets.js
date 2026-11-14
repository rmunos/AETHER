/**
 * AETHER // Presets and guided sessions
 * A preset lists the modules it uses; every module it does not list is switched off.
 */
(function (global) {
  'use strict';

  const PRESETS = {
    rebalGateway: {
      title: '1. REBAL, four directions',
      desc: 'Four streams, four sounds: breath in front, water on the right, a hummed voice behind, harp on the left. Up the front of the body on the inhale; out of the crown, over and down around you on the exhale. Fountain, then spiral, then the sustained balloon.',
      mechTitle: 'REBAL (Resonant Energy Balloon), Monroe Gateway Experience, Discovery #3',
      mechText: 'Breathe with the sound. INHALE: the energy rises from the soles up the front of your body and enters the head. EXHALE: it leaves the crown upwards like a fountain, arcs over, flows down around the outside of your body, curls under the feet and re-enters through the soles. After six breaths the flow becomes a spiral that winds down around you and coils back up; then the balloon is sustained. Each direction has its own sound (breath in front, water on the right, voice behind, harp on the left), so the four streams can be told apart and followed as they flow down around you; in the spiral you hear each of them circle. The sounds keep their pitch wherever they are: what moves is their position. Raise or lower the 3D intensity in module 01.',
      reverbMix: 0.3,
      breath: { rate: 6, inhale: 0.45, holdIn: 0, holdOut: 0 },
      spatial: { enabled: true, trajectory: 'rebal', rebalMode: 'program', palette: 'quad', count: 4, gain: 0.95, distance: 1.9, turns: 1.25, room: 0.45, innerSwirl: 0.5, fountainBreaths: 6, spiralBreaths: 6 },
      pac: { enabled: true, gain: 0.16, harmonics: 0.3, theta: 4.0, gamma: 40, depth: 0, breath: 0.7, baseFreq: 108 },
      sub: { enabled: true, pattern: 'breath', gain: 0.24, freq: 27, warmth: 0.5 }
    },
    rebalWaves: {
      title: '2. REBAL water waves',
      desc: 'Each breath is a wave: it swells as it rises up the body, breaks out of the crown and washes down around you, then flows back in at the soles. Four water sounds: a smooth wash in front, bubbling on the right, deep surf behind, spray on the left.',
      mechTitle: 'REBAL as water waves',
      mechText: 'The same REBAL flow carried by water: the wave gathers while you breathe in, breaks over your head when you breathe out and pours down around you, with bubbling foam that the ears can follow in space. Water is broadband and full of tiny transients, which gives the ears clear direction cues.',
      reverbMix: 0.32,
      breath: { rate: 6, inhale: 0.45, holdIn: 0, holdOut: 0 },
      spatial: { enabled: true, trajectory: 'rebal', rebalMode: 'program', palette: 'waves', count: 4, gain: 0.95, distance: 1.9, turns: 1.25, room: 0.5, innerSwirl: 0.5, fountainBreaths: 6, spiralBreaths: 6 },
      pac: { enabled: true, gain: 0.14, harmonics: 0.3, theta: 4.0, gamma: 40, depth: 0, breath: 0.7, baseFreq: 108 },
      sub: { enabled: true, pattern: 'breath', gain: 0.22, freq: 27, warmth: 0.5 }
    },
    rebalChoir: {
      title: '3. REBAL spiral, voices',
      desc: 'Four voices, one per direction, hold the notes of one chord (the lowest behind you) while they wind down around you and coil back up. Slower breathing (5 / min).',
      mechTitle: 'Spiral REBAL with resonant voices',
      mechText: 'The voices recall the Gateway "resonant tuning" hum. Each holds its note of a major chord, so only their positions move: they spiral down around you on the exhale and coil back up the body on the inhale.',
      reverbMix: 0.42,
      breath: { rate: 5, inhale: 0.42, holdIn: 1, holdOut: 0 },
      spatial: { enabled: true, trajectory: 'rebal', rebalMode: 'spiral', palette: 'choir', count: 4, gain: 0.85, distance: 2.1, turns: 1.5, room: 0.55 },
      pac: { enabled: true, gain: 0.2, harmonics: 0.4, theta: 5.0, gamma: 40, depth: 0, breath: 0.8, baseFreq: 108 },
      sub: { enabled: true, pattern: 'breath', gain: 0.3, freq: 27, warmth: 0.5 }
    },
    rebalHarp: {
      title: '4. REBAL with harp',
      desc: 'Four harps, one per direction, each on its own note of the chord: clear note onsets that are easy to follow in space.',
      mechTitle: 'REBAL traced by harp notes',
      mechText: 'Each stream plays chord notes in a free order along its path; the onsets make the streams easy to follow in space and the notes always agree with each other. Breathe with the sound: up the body on the inhale, out of the crown and down around you on the exhale.',
      reverbMix: 0.38,
      breath: { rate: 6, inhale: 0.45, holdIn: 0, holdOut: 0 },
      spatial: { enabled: true, trajectory: 'rebal', rebalMode: 'program', palette: 'harp', count: 4, gain: 0.9, distance: 1.9, turns: 1.25, room: 0.45, fountainBreaths: 6, spiralBreaths: 6 },
      pac: { enabled: true, gain: 0.18, harmonics: 0.3, theta: 4.0, gamma: 40, depth: 0, breath: 0.7, baseFreq: 108 },
      sub: { enabled: true, pattern: 'breath', gain: 0.24, freq: 27, warmth: 0.5 }
    },
    surfBowls: {
      title: '5. Breath-paced surf & bowls',
      desc: 'Ocean surf breaking once per breath, warm bowls wandering slowly around you, a soft heartbeat.',
      mechTitle: 'Slow paced breathing (≈ 6 breaths / min)',
      mechText: 'Breathing at about six breaths per minute with a longer exhale is the classic "resonance" breathing rate. The surf draws back on the inhale and breaks on the exhale, so you can follow it without counting.',
      reverbMix: 0.4,
      breath: { rate: 5.5, inhale: 0.4, holdIn: 0, holdOut: 0 },
      spatial: { enabled: true, trajectory: 'sphere', palette: 'bowl', count: 3, gain: 0.8, speed: 0.04, distance: 2.2, room: 0.55 },
      ganzfeld: { enabled: true, texture: 'surf', gain: 0.45, color: 0.55, sweep: 0.7 },
      sub: { enabled: true, pattern: 'heartbeat', gain: 0.35, freq: 32, pulse: 0.9, warmth: 0.45 }
    },
    edgeOfChaos: {
      title: '6. Edge of chaos (quiet the narrative)',
      desc: 'A melody that never quite repeats, scattered in 3D, over water droplets and a drifting cavern.',
      mechTitle: 'Unpredictable but structured sound',
      mechText: 'Near r ≈ 3.7 the logistic map produces short motifs that mutate before they can loop. Attention keeps tracking the sound without settling into prediction or inner dialogue. Each note is placed at its own point in space.',
      reverbMix: 0.5,
      spatial: { enabled: true, trajectory: 'sphere', palette: 'water', count: 3, gain: 0.55, speed: 0.06, distance: 2.4, room: 0.55 },
      chaos: { enabled: true, palette: 'hybrid', rhythm: 'avalanche', scale: 'pentatonic', gain: 0.6, r: 3.74, rate: 2.6, register: 0.45, morph: 0.6, space3d: true },
      ganzfeld: { enabled: true, texture: 'cavern', gain: 0.25, color: 0.55, sweep: 0.6 }
    },
    lucidTheta: {
      title: '7. Hypnagogic θ–γ',
      desc: '6 Hz binaural beat with a 40 Hz shimmer on its crests, breath streams orbiting at ear level, dark cavern.',
      mechTitle: 'Theta-range binaural beat with a gamma-rate shimmer',
      mechText: 'A 6 Hz interaural beat sits in the theta range associated with drowsy, image-rich states; overtones flutter at 40 Hz on its crests. Evidence that binaural beats entrain brain rhythms is mixed; treat it as a texture that many people find helpful for letting go.',
      reverbMix: 0.5,
      spatial: { enabled: true, trajectory: 'orbit', palette: 'breath', count: 2, gain: 0.55, speed: 0.05, distance: 1.6, room: 0.5 },
      pac: { enabled: true, gain: 0.6, harmonics: 0.45, theta: 6.0, gamma: 40, depth: 0.8, breath: 0.75, baseFreq: 108 },
      ganzfeld: { enabled: true, texture: 'cavern', gain: 0.22, color: 0.7, sweep: 0.45 },
      sub: { enabled: true, pattern: 'breath', gain: 0.35, freq: 27, warmth: 0.5 }
    },
    horizon: {
      title: '8. Endless horizon',
      desc: 'An endlessly rising Shepard–Risset glissando, soft chimes far away, a slow pulse.',
      mechTitle: 'Shepard–Risset paradox',
      mechText: 'Octave-spaced voices glide upwards forever under a fixed spectral envelope, so the sound rises without arriving. Combined with distant, wandering chimes it opens a sense of space and suspends the feeling of linear time.',
      reverbMix: 0.65,
      spatial: { enabled: true, trajectory: 'sphere', palette: 'chimes', count: 3, gain: 0.5, speed: 0.04, distance: 3.0, room: 0.7 },
      fractal: { enabled: true, gain: 0.6, speed: 0.05, depth: 0.7, center: 216 },
      sub: { enabled: true, pattern: 'pulse', gain: 0.3, freq: 27, pulse: 0.5, warmth: 0.45 }
    },
    grounding: {
      title: '9. Somatic grounding',
      desc: 'Low heartbeat felt in the body, bowls circling at ear level, surf, a slow delta beat.',
      mechTitle: 'Body-focused low frequencies',
      mechText: 'A 30 Hz tone with harmonics, shaped as a slow heartbeat, gives the attention something to rest on in the body while the bowls circle around you.',
      reverbMix: 0.4,
      breath: { rate: 5, inhale: 0.4 },
      spatial: { enabled: true, trajectory: 'orbit', palette: 'bowl', count: 2, gain: 0.7, speed: 0.04, distance: 1.5, room: 0.45 },
      pac: { enabled: true, gain: 0.35, harmonics: 0.5, theta: 3.0, gamma: 36, depth: 0.3, breath: 0.85, baseFreq: 108 },
      ganzfeld: { enabled: true, texture: 'surf', gain: 0.32, color: 0.75, sweep: 0.5 },
      sub: { enabled: true, pattern: 'heartbeat', gain: 0.6, freq: 30, pulse: 0.85, warmth: 0.65 }
    },
    ganzfeld: {
      title: '10. Sonic void (Ganzfeld)',
      desc: 'Uniform decorrelated noise with slowly drifting vowel resonances, faint voices looping over your head.',
      mechTitle: 'Auditory Ganzfeld',
      mechText: 'A uniform, featureless sound field (usually paired with diffuse light over closed eyes) removes external anchors; after a few minutes many people notice spontaneous imagery.',
      reverbMix: 0.7,
      spatial: { enabled: true, trajectory: 'vertical', palette: 'choir', count: 2, gain: 0.35, speed: 0.03, distance: 2.4, room: 0.65 },
      pac: { enabled: true, gain: 0.35, harmonics: 0.3, theta: 4.5, gamma: 40, depth: 0.4, breath: 0.6, baseFreq: 108 },
      ganzfeld: { enabled: true, texture: 'cavern', gain: 0.7, color: 0.65, sweep: 0.8 }
    },
    shamanic: {
      title: '11. Shamanic drum journey',
      desc: 'Frame drum and rattle at 4.5 beats / s on either side of you, resonant voices wandering, low pulse.',
      mechTitle: 'Rhythmic drumming at ≈ 4-4.5 beats per second',
      mechText: 'Steady drumming in this range is used in many traditions for "journeying". The drum alternates slightly left and right in front of you; the rattle answers from the other side.',
      reverbMix: 0.38,
      spatial: { enabled: true, trajectory: 'sphere', palette: 'choir', count: 2, gain: 0.45, speed: 0.04, distance: 2.4, room: 0.5 },
      asmr: { enabled: true, palette: 'shamanic', gain: 0.6, proximity: 0.5, rate: 4.5, resonance: 0.55 },
      sub: { enabled: true, pattern: 'breath', gain: 0.3, freq: 27, warmth: 0.5 }
    },
    closeUp: {
      title: '12. Close-up whisper & droplets',
      desc: 'A whisper circling close to your head, droplets orbiting at arm\u2019s length.',
      mechTitle: 'Near-field binaural cues',
      mechText: 'Sources close to one ear produce a large level difference between the ears even at low frequencies, which is heard as intimate and very close; many people feel tingles along the scalp.',
      reverbMix: 0.2,
      spatial: { enabled: true, trajectory: 'orbit', palette: 'water', count: 2, gain: 0.6, speed: 0.07, distance: 0.8, room: 0.2 },
      asmr: { enabled: true, palette: 'whisper', gain: 0.55, proximity: 0.1, rate: 3, resonance: 0.6 }
    },
    locTest: {
      title: '13. Localisation check',
      desc: 'Noise bursts at fixed named points (front, right, behind, left, above, below...). Use it to compare renderers and 3D intensity.',
      mechTitle: 'Check what you hear',
      mechText: 'The canvas shows where each burst is rendered. Left/right is easy for everyone; front/back and up/down depend on how well generic ear cues fit your own ears. Run the ear calibration, and try the 3D intensity slider: higher values exaggerate the cues (muffled behind and below, stronger left/right).',
      reverbMix: 0.15,
      spatial: { enabled: true, trajectory: 'test', palette: 'breath', count: 1, gain: 0.7, distance: 1.6, room: 0.4 }
    }
  };

  // Guided sessions: each step morphs every module towards its target over `fade` seconds.
  const JOURNEYS = {
    rebalSession: {
      title: 'REBAL session',
      steps: [
        { at: 0, fade: 8, label: 'Settle. Let the surf set your breathing: in as the wave draws back, out as it breaks.', preset: 'surfBowls', over: { spatial: { gain: 0.45 }, sub: { pattern: 'breath', gain: 0.3 } } },
        { at: 150, fade: 20, label: 'Resonant tuning. Hum softly with the voices on each exhale if you like.', preset: 'rebalChoir', over: { spatial: { trajectory: 'orbit', speed: 0.03, count: 3 }, breath: { rate: 6, holdIn: 0 } } },
        { at: 300, fade: 12, label: 'REBAL fountain. Inhale up the front of the body into the head; exhale out of the crown, down around you, in at the soles.', preset: 'rebalGateway', over: { spatial: { rebalMode: 'fountain' } } },
        { at: 480, fade: 10, label: 'REBAL spiral. Wind the energy down around you, coil it back up inside.', preset: 'rebalGateway', over: { spatial: { rebalMode: 'spiral' } } },
        { at: 660, fade: 25, label: 'Sustain the balloon. Let the breath slow down; rest inside the field.', preset: 'rebalGateway', over: { spatial: { rebalMode: 'balloon', gain: 0.75 }, breath: { rate: 5 }, pac: { theta: 4.0, gain: 0.35 } } },
        { at: 1020, fade: 40, label: 'Return. The beat rises to alpha; feel your body, wriggle your fingers.', preset: 'horizon', over: { fractal: { speed: 0.02, gain: 0.35 }, pac: { enabled: true, theta: 10, gain: 0.3, depth: 0.2, harmonics: 0.3, baseFreq: 108, breath: 0.5, gamma: 40 } } },
        { at: 1200, end: true, label: 'End of session.' }
      ]
    },
    deepRelax: {
      title: 'Deep relaxation',
      steps: [
        { at: 0, fade: 8, label: 'Surf and bowls. Lengthen the exhale.', preset: 'surfBowls' },
        { at: 240, fade: 30, label: 'Heartbeat slows; the bowls come closer.', preset: 'grounding', over: { sub: { pulse: 0.8 } } },
        { at: 540, fade: 40, label: 'Slow theta; let the body become heavy and still.', preset: 'lucidTheta', over: { pac: { theta: 4.5 }, spatial: { gain: 0.4 } } },
        { at: 780, fade: 40, label: 'Return gently.', preset: 'surfBowls', over: { spatial: { gain: 0.5 } } },
        { at: 900, end: true, label: 'End of session.' }
      ]
    },
    expansion: {
      title: 'Expansion',
      steps: [
        { at: 0, fade: 8, label: 'Settle with the surf.', preset: 'surfBowls', over: { spatial: { gain: 0.45 } } },
        { at: 120, fade: 12, label: 'Build the energy balloon.', preset: 'rebalGateway' },
        { at: 600, fade: 40, label: 'Open outwards: the endless horizon.', preset: 'horizon' },
        { at: 900, fade: 40, label: 'Open space: notes appear anywhere around you.', preset: 'edgeOfChaos', over: { chaos: { rate: 1.6 } } },
        { at: 1140, fade: 40, label: 'Void: let images come.', preset: 'ganzfeld' },
        { at: 1440, fade: 40, label: 'Return to the body.', preset: 'grounding', over: { pac: { theta: 9 } } },
        { at: 1680, end: true, label: 'End of session.' }
      ]
    }
  };

  global.AETHER_PRESETS = PRESETS;
  global.AETHER_JOURNEYS = JOURNEYS;
})(typeof window !== 'undefined' ? window : globalThis);
