import { describe, expect, it } from "vitest";
import {
  EAR_MODES,
  HIT_RADIUS,
  MAX_AZIMUTH,
  ild,
  infer,
  isHit,
  itd,
  itdMicroseconds,
  loudnessPerHeight,
  type Point,
  resolvesHeight,
} from "../acoustics";

// This week's spec, as tests. The published brief asks for a core interaction
// stated plainly enough to write a test for, and here it is:
//
//   You are the owl in the dark: you aim by reading two acoustic cues, you
//   strike, and levelling the ears destroys the vertical cue.
//
// These assert the CONTRACT the page's argument rests on, not how the model is
// implemented, so they survive a change of approach. The invariants in
// invariants.test.ts cover what is true of any good page; this file covers what
// has to be true of THIS one.

/** Evenly spaced samples across the field, inclusive of both edges. */
function samples(count: number): number[] {
  return Array.from({ length: count }, (_, i) => -1 + (2 * i) / (count - 1));
}

function at(x: number, y: number): Point {
  return { x, y };
}

describe("the left-right cue is the timing difference", () => {
  it("increases strictly with azimuth, so it can be read as a direction", () => {
    const values = samples(21).map((x) => itd(at(x, 0)));
    for (let i = 1; i < values.length; i += 1) {
      expect(
        values[i],
        `itd should rise strictly across the field, but sample ${i} (${values[i]}) did not exceed ${values[i - 1]}`,
      ).toBeGreaterThan(values[i - 1]);
    }
  });

  it("says nothing about height, so the two cues stay separable", () => {
    for (const x of samples(9)) {
      const low = itd(at(x, -1));
      const high = itd(at(x, 1));
      expect(
        high,
        `itd at x=${x} changed with elevation (${low} -> ${high}); the timing cue must encode azimuth alone`,
      ).toBeCloseTo(low, 12);
    }
  });

  it("is centred, so straight ahead reads as no difference", () => {
    expect(itd(at(0, 0))).toBeCloseTo(0, 12);
  });

  it("stays in the tens-of-microseconds range a barn owl actually resolves", () => {
    const widest = Math.abs(itdMicroseconds(at(1, 0)));
    expect(widest).toBeGreaterThan(50);
    expect(widest).toBeLessThan(200);
  });
});

describe("the up-down cue is the loudness difference", () => {
  it("rises strictly with height when the ears are uneven", () => {
    for (const x of samples(5)) {
      const values = samples(21).map((y) => ild(at(x, y), EAR_MODES.uneven));
      for (let i = 1; i < values.length; i += 1) {
        expect(
          values[i],
          `at x=${x}, ild should rise strictly with height, but sample ${i} (${values[i]}) did not exceed ${values[i - 1]}`,
        ).toBeGreaterThan(values[i - 1]);
      }
    }
  });

  // The claim the whole page is built on. If a refactor ever leaks a little
  // vertical information back into the levelled ears, the argument quietly
  // stops holding and this goes red.
  it("carries no height information at all once the ears are levelled", () => {
    for (const x of samples(5)) {
      const values = samples(21).map((y) => ild(at(x, y), EAR_MODES.level));
      const spread = Math.max(...values) - Math.min(...values);
      expect(
        spread,
        `at x=${x}, levelled ears still varied by ${spread} dB across the full height of the field; the vertical cue must be absent, not merely weakened`,
      ).toBeCloseTo(0, 10);
    }
  });

  it("still responds to left and right when levelled, so the meter is alive but blind", () => {
    const left = ild(at(-1, 0), EAR_MODES.level);
    const right = ild(at(1, 0), EAR_MODES.level);
    expect(
      Math.abs(right - left),
      "levelled ears should still show a left-right difference; a dead meter would read as a broken page rather than a missing cue",
    ).toBeGreaterThan(1);
  });

  it("puts the louder ear on the side the prey is actually on", () => {
    expect(ild(at(0, 1), EAR_MODES.uneven)).toBeGreaterThan(0);
    expect(ild(at(0, -1), EAR_MODES.uneven)).toBeLessThan(0);
  });
});

describe("a strike either lands or it does not", () => {
  it("counts a hit inside the hit radius", () => {
    expect(isHit(at(0, 0), at(0, 0))).toBe(true);
    expect(isHit(at(0, 0), at(HIT_RADIUS * 0.9, 0))).toBe(true);
  });

  it("counts a miss outside it", () => {
    expect(isHit(at(0, 0), at(HIT_RADIUS * 1.1, 0))).toBe(false);
    expect(isHit(at(-1, -1), at(1, 1))).toBe(false);
  });

  it("leaves the field mostly missable, so the cues have work to do", () => {
    const areaOfField = 4;
    const areaOfTarget = Math.PI * HIT_RADIUS * HIT_RADIUS;
    expect(
      areaOfTarget / areaOfField,
      "a blind strike should land well under a tenth of the time, or the toggle has nothing to reveal",
    ).toBeLessThan(0.1);
  });
});

// The page is really about what the two ears let you WORK OUT. A barn owl does
// not sweep its aim around hunting for a match — it hears the sound once, works
// out a direction, and strikes. So the sharp claim is about the inference, and it
// is sharper than "less accurate": levelling the ears does not make height
// imprecise, it takes height away.
describe("what the two ears let you work out", () => {
  const acrossSamples = samples(9);
  const highSamples = samples(9);

  it("recovers the exact position from uneven ears, anywhere in the field", () => {
    for (const x of acrossSamples) {
      for (const y of highSamples) {
        const worked = infer(at(x, y), EAR_MODES.uneven);
        expect(worked.across).toBeCloseTo(x, 6);
        expect(
          worked.high,
          `uneven ears reported no height for (${x}, ${y}); height must be recoverable everywhere`,
        ).not.toBeNull();
        expect(worked.high ?? Number.NaN).toBeCloseTo(y, 6);
      }
    }
  });

  it("still recovers left-right from levelled ears", () => {
    for (const x of acrossSamples) {
      expect(
        infer(at(x, 0.7), EAR_MODES.level).across,
        "levelling the ears costs height, not direction; the timing cue is untouched",
      ).toBeCloseTo(x, 6);
    }
  });

  // The claim the whole page rests on, in its strongest form.
  it("cannot report a height from levelled ears at any height", () => {
    for (const y of highSamples) {
      expect(
        infer(at(0.3, y), EAR_MODES.level).high,
        `levelled ears produced a height for y=${y}; there is no height to produce, and reporting one would be a lie the page is built on disproving`,
      ).toBeNull();
    }
  });

  it("puts that fact in the model, so callers do not have to discover it", () => {
    expect(resolvesHeight(EAR_MODES.uneven)).toBe(true);
    expect(resolvesHeight(EAR_MODES.level)).toBe(false);
  });

  it("loses height because the coefficient is exactly zero, not merely small", () => {
    expect(
      Math.abs(loudnessPerHeight(EAR_MODES.uneven)),
      "uneven ears must move the loudness difference by a readable amount per unit of height",
    ).toBeGreaterThan(1);
    expect(
      loudnessPerHeight(EAR_MODES.level),
      "a small-but-nonzero coefficient would mean height was merely hard to read; it has to be absent",
    ).toBeCloseTo(0, 12);
  });
});

describe("both cues stay readable everywhere in the field", () => {
  const corners = [at(-1, -1), at(-1, 1), at(1, -1), at(1, 1), at(0, 0)];

  for (const mode of ["uneven", "level"] as const) {
    it(`stays finite and bounded with ${mode} ears, corners included`, () => {
      for (const prey of corners) {
        const timing = itdMicroseconds(prey);
        const loudness = ild(prey, EAR_MODES[mode]);
        expect(
          Number.isFinite(timing) && Number.isFinite(loudness),
          `cues went non-finite at (${prey.x}, ${prey.y})`,
        ).toBe(true);
        expect(Math.abs(timing)).toBeLessThan(200);
        expect(
          Math.abs(loudness),
          `ild reached ${loudness} dB at (${prey.x}, ${prey.y}), past what a meter can show honestly`,
        ).toBeLessThan(20);
      }
    });
  }

  it("keeps the field inside the range where azimuth stays unambiguous", () => {
    expect(
      MAX_AZIMUTH,
      "past a quarter turn sin() folds back and two directions share one timing difference",
    ).toBeLessThan(Math.PI / 2);
  });
});
