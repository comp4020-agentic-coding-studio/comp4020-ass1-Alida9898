// Playing the two cues into a pair of headphones.
//
// Kept apart from main.ts because it is the one part of the page that cannot be
// checked here at all: there are no ears in this environment, and no browser. The
// arithmetic it consumes is pure and tested in spec/hunt.test.ts; what is left in
// this file is Web Audio plumbing, and it has to fail quietly. Audio is an
// addition to this page and never a dependency — the marking room may be silent,
// and everything the page argues is legible with the sound off.

import type { StereoCue } from "./acoustics";

/** Long enough to read as a rustle, short enough not to smear the timing cue. */
const RUSTLE_SECONDS = 0.14;

let context: AudioContext | null = null;
let rustle: AudioBuffer | null = null;

/** Whether this browser can play anything at all. */
export function canListen(): boolean {
  return typeof AudioContext === "function";
}

/**
 * A short burst of softened noise. White noise reads as a hiss and gives the ear
 * nothing to place; a gentle low-pass and a raised-sine envelope make it a rustle,
 * with no click at either end to distract from the inter-channel delay.
 */
function buildRustle(target: AudioContext, random: () => number): AudioBuffer {
  const frames = Math.floor(target.sampleRate * RUSTLE_SECONDS);
  const buffer = target.createBuffer(1, frames, target.sampleRate);
  const samples = buffer.getChannelData(0);

  let carried = 0;
  for (let i = 0; i < frames; i += 1) {
    carried = carried * 0.6 + (random() * 2 - 1) * 0.4;
    const envelope = Math.sin((Math.PI * i) / frames) ** 2;
    samples[i] = carried * envelope;
  }
  return buffer;
}

/** Browsers require a user gesture before audio starts, so this runs on the click. */
function ready(): AudioContext | null {
  if (!canListen()) return null;
  if (context === null) {
    context = new AudioContext();
    rustle = buildRustle(context, Math.random);
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
}

/**
 * Play one strike's worth of sound: the same burst down both channels, one held
 * back by the timing difference and the two balanced by the loudness difference.
 */
export function play(cue: StereoCue): boolean {
  const target = ready();
  if (target === null || rustle === null) return false;

  const source = target.createBufferSource();
  source.buffer = rustle;

  const merger = target.createChannelMerger(2);
  const channels = [
    { index: 0, gain: cue.leftGain, delay: cue.leftDelay },
    { index: 1, gain: cue.rightGain, delay: cue.rightDelay },
  ];

  for (const channel of channels) {
    const level = target.createGain();
    level.gain.value = channel.gain;
    // 10ms of headroom for a cue that never exceeds ~0.12ms.
    const lag = target.createDelay(0.01);
    lag.delayTime.value = channel.delay;
    source.connect(level).connect(lag).connect(merger, 0, channel.index);
  }

  merger.connect(target.destination);
  source.start();
  return true;
}
