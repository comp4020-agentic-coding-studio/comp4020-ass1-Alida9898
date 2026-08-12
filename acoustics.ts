// The acoustic model, kept pure and DOM-free on purpose.
//
// spec/invariants.test.ts parses the BUILT html with jsdom and never executes
// scripts, so no test in this repo can observe the rendered interaction. Keeping
// the model importable is the only way to put real backpressure on the claim the
// page makes — see spec/hunt.test.ts.
//
// Two cues, matching the real biology rather than a convenient fiction:
//
//   ITD (interaural TIME difference)  -> azimuth,   from path-length difference
//   ILD (interaural LEVEL difference) -> elevation, from each ear's AIM direction
//
// The ILD has to come from directional gain, not from distance falloff. Distance
// would smear both axes into one number and levelling the ears would merely
// degrade the vertical cue; aim direction makes it vanish outright, which is the
// whole argument of the page.

/** A position in the field, normalised to -1..1 on both axes. y is up. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Where one ear is most sensitive, in radians. */
export interface Ear {
  readonly azimuthAim: number;
  readonly elevationAim: number;
}

export interface EarConfig {
  readonly left: Ear;
  readonly right: Ear;
}

export type EarMode = "uneven" | "level";

const TAU_DEG = Math.PI / 180;

/** Half-width of the field in azimuth. Well inside 90deg, so sin stays monotonic. */
export const MAX_AZIMUTH = 50 * TAU_DEG;

/** Half-height of the field in elevation. */
export const MAX_ELEVATION = 40 * TAU_DEG;

/** Barn owl ear separation, metres. */
export const HEAD_WIDTH = 0.05;

/** Speed of sound, m/s. */
export const SPEED_OF_SOUND = 343;

/** Directional gain falloff, dB per radian squared. */
export const ILD_GAIN = 6.6;

/** A strike counts as a hit inside this normalised distance. */
export const HIT_RADIUS = 0.18;

// Both ears sit on opposite sides of the head, so both keep a lateral aim in
// every mode. Only the ELEVATION aims differ, and that difference is the thing
// being explained: levelling them is what destroys the vertical cue.
const LATERAL_AIM = 10 * TAU_DEG;
const VERTICAL_AIM = 25 * TAU_DEG;

export const EAR_MODES: Readonly<Record<EarMode, EarConfig>> = {
  // A real barn owl: the left ear opening is aimed down, the right one up.
  uneven: {
    left: { azimuthAim: -LATERAL_AIM, elevationAim: -VERTICAL_AIM },
    right: { azimuthAim: LATERAL_AIM, elevationAim: VERTICAL_AIM },
  },
  // The counterfactual: same ears, same head, aims level with each other.
  level: {
    left: { azimuthAim: -LATERAL_AIM, elevationAim: 0 },
    right: { azimuthAim: LATERAL_AIM, elevationAim: 0 },
  },
};

export function clampToField(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

export function azimuthOf(x: number): number {
  return clampToField(x) * MAX_AZIMUTH;
}

export function elevationOf(y: number): number {
  return clampToField(y) * MAX_ELEVATION;
}

/**
 * Interaural time difference, in seconds, as (time at left ear - time at right).
 * Positive means the right ear heard it first, so the prey is off to the right.
 *
 * A function of azimuth alone. Real ITD varies a little with elevation too, but
 * the owl's own neural map treats the two cues as separable, and so does this.
 */
export function itd(prey: Point): number {
  return (HEAD_WIDTH / SPEED_OF_SOUND) * Math.sin(azimuthOf(prey.x));
}

/** The same figure in microseconds, which is the readable unit for a display. */
export function itdMicroseconds(prey: Point): number {
  return itd(prey) * 1e6;
}

/**
 * How loud the prey is in one ear, in dB relative to that ear's own peak.
 * Sensitivity falls off with angular distance from where the ear is aimed.
 */
export function earLevel(prey: Point, ear: Ear): number {
  const dAzimuth = azimuthOf(prey.x) - ear.azimuthAim;
  const dElevation = elevationOf(prey.y) - ear.elevationAim;
  return -ILD_GAIN * (dAzimuth * dAzimuth + dElevation * dElevation);
}

/**
 * Interaural level difference in dB, as (right ear - left ear).
 * Positive means the right ear hears it louder.
 *
 * With uneven ears the right one is aimed up, so a positive ILD means the prey
 * is high. With level ears the elevation terms cancel and what is left depends
 * on azimuth only: the meter still moves, and it has stopped saying anything
 * about height.
 */
export function ild(prey: Point, ears: EarConfig): number {
  return earLevel(prey, ears.right) - earLevel(prey, ears.left);
}

/** The widest timing difference the field can produce, for use as a full scale. */
export function timingFullScale(): number {
  return Math.abs(itd({ x: 1, y: 0 }));
}

/** The widest loudness difference this pair of ears can produce over the field. */
export function loudnessFullScale(ears: EarConfig): number {
  const corners: Point[] = [
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];
  return Math.max(...corners.map((corner) => Math.abs(ild(corner, ears))));
}

// A reading normalised to roughly -1..1 puts both cues on one scale, so "these
// two readings agree" means the same thing to the gauge on screen and to the
// tests. Two definitions of matched would eventually disagree, and the one on
// screen is the one the visitor would believe.

export function timingReading(point: Point): number {
  return itd(point) / timingFullScale();
}

export function loudnessReading(point: Point, ears: EarConfig): number {
  return ild(point, ears) / loudnessFullScale(ears);
}

/** How close two normalised readings must be to count as lined up. */
export const CUE_TOLERANCE = 0.06;

export function timingAgrees(aim: Point, prey: Point): boolean {
  return Math.abs(timingReading(prey) - timingReading(aim)) <= CUE_TOLERANCE;
}

export function loudnessAgrees(aim: Point, prey: Point, ears: EarConfig): boolean {
  return Math.abs(loudnessReading(prey, ears) - loudnessReading(aim, ears)) <= CUE_TOLERANCE;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isHit(aim: Point, prey: Point): boolean {
  return distance(aim, prey) <= HIT_RADIUS;
}

/**
 * A fresh prey position. The random source is a parameter so tests can drive it.
 * Kept off the field edges, where the cues run out of room to disambiguate.
 */
export function randomPrey(random: () => number): Point {
  const inset = 0.85;
  return {
    x: (random() * 2 - 1) * inset,
    y: (random() * 2 - 1) * inset,
  };
}
