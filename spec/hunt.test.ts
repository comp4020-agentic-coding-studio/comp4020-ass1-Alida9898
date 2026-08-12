import { describe, expect, it } from "vitest";
import {
  EAR_MODES,
  HIT_RADIUS,
  MAX_AZIMUTH,
  ild,
  isHit,
  itd,
  itdMicroseconds,
  loudnessAgrees,
  type Point,
  timingAgrees,
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

// The visitor's actual task is to move their aim until both readings line up with
// what they are hearing. So the sharpest form of this page's claim is about what
// lining both up is WORTH: with uneven ears it pins the prey down, and with
// levelled ears the instruments can agree while the aim is still wildly wrong.
describe("lining both readings up is what pins the prey down", () => {
  const prey: Point = { x: 0.4, y: 0.55 };

  /** Every aim the visitor could plausibly settle on. */
  const grid: Point[] = samples(41).flatMap((x) => samples(41).map((y) => at(x, y)));

  function agreeingAims(mode: "uneven" | "level"): Point[] {
    return grid.filter(
      (candidate) =>
        timingAgrees(candidate, prey) && loudnessAgrees(candidate, prey, EAR_MODES[mode]),
    );
  }

  it("leaves only one place to be when the ears are uneven", () => {
    const aims = agreeingAims("uneven");
    expect(aims.length, "no aim satisfied both cues; the task would be impossible").toBeGreaterThan(
      0,
    );
    for (const candidate of aims) {
      expect(
        isHit(candidate, prey),
        `both readings agreed at (${candidate.x.toFixed(2)}, ${candidate.y.toFixed(2)}) but the strike would miss prey at (${prey.x}, ${prey.y}); uneven ears must make a matched aim a correct aim`,
      ).toBe(true);
    }
  });

  it("leaves the whole height of the field open when the ears are levelled", () => {
    const aims = agreeingAims("level");
    const heights = aims.map((candidate) => candidate.y);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(
      spread,
      `levelled ears narrowed the matching aims to ${spread.toFixed(2)} of the field's height; the vertical must be left entirely free`,
    ).toBeGreaterThan(1.5);
  });

  it("lets the instruments agree and the strike miss anyway", () => {
    const aims = agreeingAims("level");
    const misses = aims.filter((candidate) => !isHit(candidate, prey));
    expect(
      misses.length / aims.length,
      "most aims that satisfy both levelled readings should still miss — that gap is the entire argument of the page",
    ).toBeGreaterThan(0.5);
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
