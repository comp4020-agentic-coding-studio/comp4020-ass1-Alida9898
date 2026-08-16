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
  EAR_JITTER_DECIBELS,
  HIT_RADIUS as TARGET,
  HUMAN_HEIGHT_BLUR,
  roughHeight,
  earsMirrored,
  distance,
  earsRolled,
  earsWithOffset,
  itdRolled,
  MAX_ELEVATION,
  heightUncertainty,
  loudnessPerHeight,
  type Point,
  resolvesHeight,
  stereoCue,
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

// The page is about hearing, so it can also be heard. I cannot check that from
// here — no ears in this environment — but the arithmetic that drives the two
// channels is pure, and the thing worth asserting is not "it sounds nice".
// The page says an owl's ears are uneven. It does not yet say they have to be
// uneven by a LOT, and that is a separate, checkable fact: recovering height means
// dividing by how much the loudness difference moves per unit of height, so a
// nearly-level pair turns a small misreading into a wild answer.
describe("the asymmetry has to be large to be worth having", () => {
  it("agrees with the two named pairs of ears at its endpoints", () => {
    expect(
      loudnessPerHeight(earsWithOffset(25)),
      "the slider at full offset must be the same ears the hunt calls an owl's, or the exhibit contradicts the hunt",
    ).toBeCloseTo(loudnessPerHeight(EAR_MODES.uneven), 10);
    expect(loudnessPerHeight(earsWithOffset(0))).toBeCloseTo(
      loudnessPerHeight(EAR_MODES.level),
      10,
    );
  });

  it("blows the height up as the offset shrinks, in inverse proportion", () => {
    const wide = heightUncertainty(earsWithOffset(20), EAR_JITTER_DECIBELS);
    const half = heightUncertainty(earsWithOffset(10), EAR_JITTER_DECIBELS);
    const quarter = heightUncertainty(earsWithOffset(5), EAR_JITTER_DECIBELS);

    expect(half / wide, "halving the offset should double the error").toBeCloseTo(2, 6);
    expect(quarter / wide, "quartering it should quadruple the error").toBeCloseTo(4, 6);
  });

  it("is sharp at a real barn owl's offset and useless near level", () => {
    expect(
      heightUncertainty(EAR_MODES.uneven, EAR_JITTER_DECIBELS),
      "a real owl's offset should place a height to within a small part of the field",
    ).toBeLessThan(0.15);
    expect(
      heightUncertainty(earsWithOffset(2), EAR_JITTER_DECIBELS),
      "a two-degree offset should be so imprecise it is barely a reading at all",
    ).toBeGreaterThan(0.9);
  });

  it("goes to infinity exactly where infer() gives up", () => {
    expect(heightUncertainty(EAR_MODES.level, EAR_JITTER_DECIBELS)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(resolvesHeight(earsWithOffset(0))).toBe(false);
    expect(resolvesHeight(earsWithOffset(1))).toBe(true);
  });
});

// What this does and does not settle. It shows that aiming a pair WIDER buys no
// height: sweep the lateral aim from nothing to eighty degrees and the loudness
// difference still says only left-or-right. Only a difference in the VERTICAL aims
// creates a second axis.
//
// It deliberately does not claim to answer the head-tilt objection, because this
// model cannot: itd() is hardwired to azimuth and ignores the ears entirely, so a
// rolled head — which rotates the timing cue's axis along with the loudness cue's —
// is not representable here. The page answers that one in prose, and the answer is
// that a roll swaps which axis you hear rather than adding one.
describe("aiming the ears wider buys no height", () => {
  for (const lateral of [0, 5, 20, 45, 80]) {
    it(`recovers no height from a pair aimed ${lateral} degrees out but level`, () => {
      const mirrored = earsMirrored(lateral);
      expect(
        resolvesHeight(mirrored),
        `a pair aimed ${lateral} degrees out with no vertical difference reported a height; the second axis has to come from the vertical aims, not from splaying them further apart`,
      ).toBe(false);
      expect(infer(at(0.4, 0.6), mirrored).high).toBeNull();
      expect(heightUncertainty(mirrored, EAR_JITTER_DECIBELS)).toBe(Number.POSITIVE_INFINITY);
    });
  }

  it("recovers a height the moment the vertical aims differ, however slightly", () => {
    expect(
      resolvesHeight(earsWithOffset(0.5)),
      "half a degree of vertical difference is a terrible instrument but it is an instrument; the cliff is at exactly zero",
    ).toBe(true);
  });
});

// The objection this page has to survive, asserted rather than argued: tilt your
// head twenty-five degrees and are you not an owl?
//
// No, and the angle was never the point. A roll carries the ear POSITIONS round as
// well as the aims, so the timing axis turns with the loudness axis and the two
// cues stay parallel — two rulers rotated together still measure one direction. An
// owl's offset moves only the aims, prising the two axes apart.
//
// Stated as indistinguishability, which is what "one axis" actually costs you:
// under a tilt there are pairs of places far apart that sound EXACTLY alike.
describe("tilting your head is not the same as an owl's offset", () => {
  const TILT = 25;

  /** Two points separated along the axis a head tilted by `roll` cannot resolve. */
  function pairAcrossTheBlindAxis(roll: number, reach: number): [Point, Point] {
    const radians = roll * (Math.PI / 180);
    // Perpendicular to the interaural axis in angle space, back into field units.
    const dx = (-Math.sin(radians) * reach) / MAX_AZIMUTH;
    const dy = (Math.cos(radians) * reach) / MAX_ELEVATION;
    return [at(-dx, -dy), at(dx, dy)];
  }

  const [here, there] = pairAcrossTheBlindAxis(TILT, 0.32);

  it("puts two far-apart places at the same spot for a tilted head", () => {
    expect(distance(here, there), "the two probe points must be genuinely far apart").toBeGreaterThan(
      HIT_RADIUS * 4,
    );

    const tilted = earsRolled(EAR_MODES.level, TILT);
    expect(
      itdRolled(there, TILT),
      "a tilted head should hear the same timing from both places",
    ).toBeCloseTo(itdRolled(here, TILT), 9);
    expect(
      ild(there, tilted),
      "and the same loudness: both cues turned together, so both are blind along the same line",
    ).toBeCloseTo(ild(here, tilted), 9);
  });

  it("tells those same two places apart with an owl's ears", () => {
    // Ears where they always were — only the aims are offset.
    const owl = earsWithOffset(TILT);
    expect(
      Math.abs(ild(there, owl) - ild(here, owl)),
      "an owl must distinguish the two places a tilted head confuses; that gap is the entire advantage",
    ).toBeGreaterThan(1);
  });

  it("keeps the timing cue horizontal for an owl and turns it for a tilt", () => {
    const high = at(0, 0.8);
    const low = at(0, -0.8);
    expect(
      itdRolled(high, 0),
      "an owl's ears stay on either side of its head, so height must not touch the timing",
    ).toBeCloseTo(itdRolled(low, 0), 12);
    expect(
      Math.abs(itdRolled(high, TILT) - itdRolled(low, TILT)),
      "a tilted head drags the timing axis round with it, which is the half of the story I got wrong twice",
    ).toBeGreaterThan(0);
  });
});

// Levelling the ears does not leave a human helpless, and saying so would be an
// overstatement the page does not need. The two-ear comparison really does give
// nothing — that is asserted above and stays exact. What is left is a separate
// mechanism: one outer ear's spectral colouring, which places a height coarsely.
// A region rather than a reading, which is the honest version of the contrast.
describe("one human ear places height to a band, not a point", () => {
  const rolls = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200);

  it("always contains the truth", () => {
    for (const roll of rolls) {
      const truth = at(0.2, roll * 1.6 - 0.8);
      const band = roughHeight(truth, () => roll);
      expect(
        truth.y >= band.low && truth.y <= band.high,
        `the band ${band.low.toFixed(2)}..${band.high.toFixed(2)} missed a mouse at ${truth.y.toFixed(2)}; a band that can exclude the answer is worse than no band`,
      ).toBe(true);
    }
  });

  it("does not centre itself on the answer, or reading it would be free", () => {
    const truth = at(0, 0);
    const offsets = rolls.map((roll) => Math.abs(roughHeight(truth, () => roll).estimate));
    expect(
      Math.max(...offsets),
      "the estimate never strays from the truth, which would make the band decoration",
    ).toBeGreaterThan(TARGET);
  });

  it("is far wider than the target, so it cannot stand in for a reading", () => {
    const band = roughHeight(at(0, 0), () => 0.5);
    expect(
      (band.high - band.low) / (2 * TARGET),
      "a band this tight would be as good as knowing, and the page would be claiming too little for the owl",
    ).toBeGreaterThan(3);
    expect(HUMAN_HEIGHT_BLUR).toBeLessThan(1);
  });
});

describe("the cues can be played into a pair of headphones", () => {
  it("starts the nearer ear immediately and holds the far one back", () => {
    const toTheRight = stereoCue(at(0.7, 0), EAR_MODES.uneven);
    expect(toTheRight.rightDelay, "the nearer ear should not wait").toBe(0);
    expect(toTheRight.leftDelay, "the far ear should lag by the timing difference").toBeGreaterThan(
      0,
    );

    const toTheLeft = stereoCue(at(-0.7, 0), EAR_MODES.uneven);
    expect(toTheLeft.leftDelay).toBe(0);
    expect(toTheLeft.rightDelay).toBeGreaterThan(0);
  });

  it("keeps the lag inside the range a head actually produces", () => {
    const widest = stereoCue(at(1, 0), EAR_MODES.uneven);
    const microseconds = Math.max(widest.leftDelay, widest.rightDelay) * 1e6;
    expect(microseconds).toBeGreaterThan(50);
    expect(microseconds).toBeLessThan(200);
  });

  it("leans towards the ear that is aimed at the sound", () => {
    const high = stereoCue(at(0, 0.8), EAR_MODES.uneven);
    expect(
      high.rightGain,
      "the right ear is aimed up, so a sound from above should arrive louder there",
    ).toBeGreaterThan(high.leftGain);

    const low = stereoCue(at(0, -0.8), EAR_MODES.uneven);
    expect(low.leftGain).toBeGreaterThan(low.rightGain);
  });

  // The audible form of the whole argument: to a level pair of ears, two sounds at
  // completely different heights are the same sound.
  it("plays two different heights identically once the ears are level", () => {
    const high = stereoCue(at(0.3, 0.9), EAR_MODES.level);
    const low = stereoCue(at(0.3, -0.9), EAR_MODES.level);
    expect(high.leftGain).toBeCloseTo(low.leftGain, 12);
    expect(high.rightGain).toBeCloseTo(low.rightGain, 12);
    expect(high.leftDelay).toBeCloseTo(low.leftDelay, 12);
    expect(high.rightDelay).toBeCloseTo(low.rightDelay, 12);
  });

  it("stays inside the headroom it was given", () => {
    for (const x of samples(9)) {
      for (const y of samples(9)) {
        for (const mode of ["uneven", "level"] as const) {
          const cue = stereoCue(at(x, y), EAR_MODES[mode]);
          for (const gain of [cue.leftGain, cue.rightGain]) {
            expect(gain, `gain went non-finite or negative at (${x}, ${y})`).toBeGreaterThan(0);
            expect(gain, `gain would clip at (${x}, ${y}) with ${mode} ears`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
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
