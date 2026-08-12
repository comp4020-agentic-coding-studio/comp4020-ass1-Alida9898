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

/**
 * A strike counts as a hit inside this normalised distance.
 *
 * Tuned against the two modes rather than for comfort. Uneven ears let you read
 * a position straight off the gauges, so a tight target still lands every time;
 * levelled ears leave you guessing along one axis, and a tight target is what
 * stops that guess from paying off often enough to blunt the point.
 */
export const HIT_RADIUS = 0.09;

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

/**
 * What a listener can work out about where a sound came from, from nothing but
 * what its own two ears report.
 *
 * This is the thing the page is actually about, so it is a function and not a
 * paragraph. An owl does not sweep its aim around hunting for a match — it hears
 * the sound once, works out a direction, and strikes. So the page has to be able
 * to show a direction, which means being able to compute one.
 */
export interface Inference {
  /** How far across, -1..1. Recoverable from the timing difference alone. */
  readonly across: number;
  /**
   * How high, -1..1 — or null when this pair of ears cannot resolve height at
   * all. Null is not a failure to compute: see resolvesHeight below.
   */
  readonly high: number | null;
}

/** Below this, the loudness difference does not respond to height at all. */
const HEIGHT_FLOOR = 1e-9;

/**
 * How much the loudness difference moves per unit of height.
 *
 * ild is linear in azimuth and elevation, so this is exact rather than a
 * gradient estimate — and levelling the ears sends it to exactly zero, which is
 * why height stops being recoverable rather than merely getting noisy.
 */
export function loudnessPerHeight(ears: EarConfig): number {
  return ild({ x: 0, y: 1 }, ears) - ild({ x: 0, y: 0 }, ears);
}

/** Whether this pair of ears can resolve height at all. */
export function resolvesHeight(ears: EarConfig): boolean {
  return Math.abs(loudnessPerHeight(ears)) > HEIGHT_FLOOR;
}

export function infer(source: Point, ears: EarConfig): Inference {
  // Across comes straight out of the timing difference: invert the sine.
  const sine = (itd(source) * SPEED_OF_SOUND) / HEAD_WIDTH;
  const across = Math.asin(Math.min(1, Math.max(-1, sine))) / MAX_AZIMUTH;

  const perHeight = loudnessPerHeight(ears);
  if (Math.abs(perHeight) <= HEIGHT_FLOOR) {
    // Two equations, and the height term has dropped out of the second one.
    // There is no height to report — not an imprecise one, none.
    return { across, high: null };
  }

  // Otherwise solve the loudness equation for height, given the across we just
  // recovered. ild is linear, so the coefficients are differences.
  const atOrigin = ild({ x: 0, y: 0 }, ears);
  const perAcross = ild({ x: 1, y: 0 }, ears) - atOrigin;
  const high = (ild(source, ears) - atOrigin - perAcross * across) / perHeight;
  return { across, high };
}

/**
 * A pair of ears with an arbitrary vertical offset, for asking what would happen
 * if the asymmetry were smaller. The lateral aim is unchanged: only the offset
 * being explained varies.
 */
export function earsWithOffset(degrees: number): EarConfig {
  const aim = Math.abs(degrees) * TAU_DEG;
  return {
    left: { azimuthAim: -LATERAL_AIM, elevationAim: -aim },
    right: { azimuthAim: LATERAL_AIM, elevationAim: aim },
  };
}

/**
 * How far out a recovered height lands, given a wobble of this many dB in reading
 * the loudness difference. Expressed as a fraction of the field's half-height.
 *
 * This is why a barn owl's ears are offset by tens of degrees rather than a couple.
 * Recovering height means dividing by how much the loudness difference moves per
 * unit of height, and that divisor shrinks with the offset — so a nearly-level pair
 * amplifies every small misreading into a wild answer. The ears are not merely
 * uneven; they have to be uneven by a LOT, and this is the function that says so.
 *
 * Exact rather than sampled, because ild is linear in height: no Monte Carlo, no
 * seeded randomness, nothing to make flaky.
 */
export function heightUncertainty(ears: EarConfig, jitterDecibels: number): number {
  const perHeight = loudnessPerHeight(ears);
  if (Math.abs(perHeight) <= HEIGHT_FLOOR) return Number.POSITIVE_INFINITY;
  return Math.abs(jitterDecibels / perHeight);
}

/** What a barn owl can actually tell apart in a loudness comparison, roughly. */
export const EAR_JITTER_DECIBELS = 1;

/** What to feed each channel to play a sound as these ears would receive it. */
export interface StereoCue {
  /** Seconds to hold each channel back. The nearer ear is always zero. */
  readonly leftDelay: number;
  readonly rightDelay: number;
  /** Linear amplitude, not dB. */
  readonly leftGain: number;
  readonly rightGain: number;
}

/**
 * Turn the two cues into something a pair of headphones can carry.
 *
 * Worth knowing what this does and does not demonstrate. The timing difference
 * lands honestly: a hundred microseconds between channels is exactly what your own
 * head produces, and your brain reads it as a direction without being asked.
 *
 * The loudness difference does not, and that is the interesting part. Played into
 * your ears — which are level — an owl's height cue arrives as a lean to one side,
 * because a level pair has nowhere else to put it. You cannot hear it as height.
 * That is not a flaw in the simulation; it is the page's argument, in audio.
 */
export function stereoCue(source: Point, ears: EarConfig, headroom = 0.35): StereoCue {
  // itd() is (left - right), so a positive value means the left ear is later.
  const gap = itd(source);

  // dB difference (right - left) split evenly about unity, so overall loudness
  // stays put as the balance moves.
  const halfDecibels = ild(source, ears) / 2;

  return {
    leftDelay: Math.max(0, gap),
    rightDelay: Math.max(0, -gap),
    leftGain: headroom * 10 ** (-halfDecibels / 20),
    rightGain: headroom * 10 ** (halfDecibels / 20),
  };
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
